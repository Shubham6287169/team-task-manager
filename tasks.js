const express = require("express");
const { body, query, validationResult } = require("express-validator");
const db = require("./database");
const { authenticate, requireProjectAccess } = require("./auth");

const router = express.Router();

// Helper: check project membership
function checkMembership(projectId, userId, userRole) {
  if (userRole === "admin") return { role: "admin" };
  return db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

// GET /api/tasks - Get tasks (with filters)
router.get("/", authenticate, (req, res) => {
  const { project_id, status, priority, assignee_id, overdue, search } = req.query;

  let whereClause = "1=1";
  const params = [];

  // Access control
  if (req.user.role !== "admin") {
    whereClause += " AND t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)";
    params.push(req.user.id);
  }

  if (project_id) { whereClause += " AND t.project_id = ?"; params.push(project_id); }
  if (status) { whereClause += " AND t.status = ?"; params.push(status); }
  if (priority) { whereClause += " AND t.priority = ?"; params.push(priority); }
  if (assignee_id) { whereClause += " AND t.assignee_id = ?"; params.push(assignee_id); }
  if (overdue === "true") { whereClause += " AND t.due_date < date('now') AND t.status != 'done'"; }
  if (search) { whereClause += " AND (t.title LIKE ? OR t.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  const tasks = db.prepare(`
    SELECT t.*,
      u1.name as assignee_name, u1.avatar as assignee_avatar,
      u2.name as creator_name,
      p.name as project_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assignee_id
    LEFT JOIN users u2 ON u2.id = t.creator_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${whereClause}
    ORDER BY
      CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
  `).all(...params);

  res.json(tasks);
});

// GET /api/tasks/dashboard - Dashboard summary
router.get("/dashboard", authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";

  const projectFilter = isAdmin ? "1=1" : "project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)";
  const projectParams = isAdmin ? [] : [userId];

  const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE ${projectFilter}`).get(...projectParams);
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE ${projectFilter} GROUP BY status`).all(...projectParams);
  const byPriority = db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE ${projectFilter} GROUP BY priority`).all(...projectParams);
  const overdueTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE ${projectFilter} AND due_date < date('now') AND status != 'done'`).get(...projectParams);
  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.due_date ASC NULLS LAST
    LIMIT 10
  `).all(userId);

  const recentActivity = db.prepare(`
    SELECT al.*, u.name as user_name, u.avatar
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 15
  `).all();

  const projectCount = isAdmin
    ? db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'active'").get()
    : db.prepare("SELECT COUNT(*) as count FROM project_members WHERE user_id = ?").get(userId);

  res.json({
    total_tasks: totalTasks.count,
    overdue_tasks: overdueTasks.count,
    project_count: projectCount.count,
    by_status: byStatus,
    by_priority: byPriority,
    my_tasks: myTasks,
    recent_activity: recentActivity,
  });
});

// GET /api/tasks/:id - Get single task
router.get("/:id", authenticate, (req, res) => {
  const task = db.prepare(`
    SELECT t.*,
      u1.name as assignee_name, u1.avatar as assignee_avatar, u1.email as assignee_email,
      u2.name as creator_name, u2.avatar as creator_avatar,
      p.name as project_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assignee_id
    LEFT JOIN users u2 ON u2.id = t.creator_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: "Task not found." });

  // Access check
  const membership = checkMembership(task.project_id, req.user.id, req.user.role);
  if (!membership) return res.status(403).json({ error: "Access denied." });

  // Get comments
  const comments = db.prepare(`
    SELECT tc.*, u.name as user_name, u.avatar
    FROM task_comments tc
    JOIN users u ON u.id = tc.user_id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at ASC
  `).all(task.id);

  task.comments = comments;
  res.json(task);
});

// POST /api/tasks - Create task
router.post(
  "/",
  authenticate,
  [
    body("title").trim().isLength({ min: 2, max: 300 }).withMessage("Title must be 2–300 characters."),
    body("project_id").isInt().withMessage("Valid project_id required."),
    body("status").optional().isIn(["todo", "in_progress", "review", "done"]),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
    body("due_date").optional().isDate(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, project_id, assignee_id, status, priority, due_date, tags } = req.body;

    // Check membership
    const membership = checkMembership(project_id, req.user.id, req.user.role);
    if (!membership) return res.status(403).json({ error: "You are not a member of this project." });

    // Verify assignee is a project member
    if (assignee_id) {
      const assigneeMember = checkMembership(project_id, assignee_id, null);
      if (!assigneeMember && req.user.role !== "admin") {
        return res.status(400).json({ error: "Assignee must be a project member." });
      }
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, project_id, assignee_id, creator_id, status, priority, due_date, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description || null,
      project_id,
      assignee_id || null,
      req.user.id,
      status || "todo",
      priority || "medium",
      due_date || null,
      JSON.stringify(tags || [])
    );

    db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, "created_task", "task", result.lastInsertRowid, JSON.stringify({ title, project_id }));

    const task = db.prepare(`
      SELECT t.*, u1.name as assignee_name, u1.avatar as assignee_avatar,
        u2.name as creator_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON u1.id = t.assignee_id
      LEFT JOIN users u2 ON u2.id = t.creator_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(task);
  }
);

// PUT /api/tasks/:id - Update task
router.put(
  "/:id",
  authenticate,
  [
    body("status").optional().isIn(["todo", "in_progress", "review", "done"]),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
    body("due_date").optional().isDate(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found." });

    const membership = checkMembership(task.project_id, req.user.id, req.user.role);
    if (!membership) return res.status(403).json({ error: "Access denied." });

    const { title, description, assignee_id, status, priority, due_date, tags } = req.body;
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push("title = ?"); values.push(title); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (assignee_id !== undefined) { fields.push("assignee_id = ?"); values.push(assignee_id); }
    if (status !== undefined) { fields.push("status = ?"); values.push(status); }
    if (priority !== undefined) { fields.push("priority = ?"); values.push(priority); }
    if (due_date !== undefined) { fields.push("due_date = ?"); values.push(due_date); }
    if (tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(tags)); }

    if (!fields.length) return res.status(400).json({ error: "No fields to update." });

    values.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, "updated_task", "task", req.params.id, JSON.stringify({ status }));

    const updated = db.prepare(`
      SELECT t.*, u1.name as assignee_name, u1.avatar as assignee_avatar,
        u2.name as creator_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON u1.id = t.assignee_id
      LEFT JOIN users u2 ON u2.id = t.creator_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `).get(req.params.id);

    res.json(updated);
  }
);

// DELETE /api/tasks/:id
router.delete("/:id", authenticate, (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const membership = checkMembership(task.project_id, req.user.id, req.user.role);
  if (!membership) return res.status(403).json({ error: "Access denied." });

  // Only creator, project admin, or global admin can delete
  if (
    req.user.role !== "admin" &&
    task.creator_id !== req.user.id &&
    membership.role !== "admin"
  ) {
    return res.status(403).json({ error: "Only task creator or project admin can delete tasks." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  res.json({ message: "Task deleted." });
});

// POST /api/tasks/:id/comments
router.post("/:id/comments", authenticate, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Comment content required." });

  const task = db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const membership = checkMembership(task.project_id, req.user.id, req.user.role);
  if (!membership) return res.status(403).json({ error: "Access denied." });

  const result = db.prepare("INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)")
    .run(req.params.id, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT tc.*, u.name as user_name, u.avatar
    FROM task_comments tc
    JOIN users u ON u.id = tc.user_id
    WHERE tc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
