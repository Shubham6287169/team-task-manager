const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("./database");
const { authenticate, requireProjectAccess } = require("./auth");

const router = express.Router();

// Helper: get project with stats
function getProjectWithStats(projectId, userId, userRole) {
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.due_date < date('now') AND t.status != 'done') as overdue_tasks,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.id = ?
  `).get(projectId);

  if (!project) return null;

  // Check access
  if (userRole !== "admin") {
    const membership = db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(projectId, userId);
    if (!membership) return null;
    project.my_role = membership.role;
  } else {
    project.my_role = "admin";
  }

  return project;
}

// GET /api/projects - List projects for current user
router.get("/", authenticate, (req, res) => {
  let projects;

  if (req.user.role === "admin") {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.due_date < date('now') AND t.status != 'done') as overdue_tasks,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
        pm.role as my_role,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.due_date < date('now') AND t.status != 'done') as overdue_tasks,
        (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }

  res.json(projects);
});

// POST /api/projects - Create project
router.post(
  "/",
  authenticate,
  [
    body("name").trim().isLength({ min: 2, max: 200 }).withMessage("Project name must be 2–200 characters."),
    body("description").optional().trim().isLength({ max: 1000 }),
    body("deadline").optional().isDate().withMessage("Valid date required."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, deadline } = req.body;

    const result = db
      .prepare("INSERT INTO projects (name, description, owner_id, deadline) VALUES (?, ?, ?, ?)")
      .run(name, description || null, req.user.id, deadline || null);

    // Add creator as admin member
    db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')")
      .run(result.lastInsertRowid, req.user.id);

    db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, "created_project", "project", result.lastInsertRowid, JSON.stringify({ name }));

    const project = getProjectWithStats(result.lastInsertRowid, req.user.id, req.user.role);
    res.status(201).json(project);
  }
);

// GET /api/projects/:id - Get single project
router.get("/:id", authenticate, (req, res) => {
  const project = getProjectWithStats(req.params.id, req.user.id, req.user.role);
  if (!project) return res.status(404).json({ error: "Project not found or access denied." });

  // Get members
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar, u.role as global_role, pm.role as project_role, pm.joined_at
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.role DESC, u.name
  `).all(req.params.id);

  project.members = members;
  res.json(project);
});

// PUT /api/projects/:id - Update project
router.put(
  "/:id",
  authenticate,
  requireProjectAccess("admin"),
  [
    body("name").optional().trim().isLength({ min: 2, max: 200 }),
    body("status").optional().isIn(["active", "archived", "completed"]),
    body("deadline").optional().isDate(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, status, deadline } = req.body;
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (status !== undefined) { fields.push("status = ?"); values.push(status); }
    if (deadline !== undefined) { fields.push("deadline = ?"); values.push(deadline); }

    if (!fields.length) return res.status(400).json({ error: "No fields to update." });

    values.push(req.params.id);
    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)")
      .run(req.user.id, "updated_project", "project", req.params.id);

    const project = getProjectWithStats(req.params.id, req.user.id, req.user.role);
    res.json(project);
  }
);

// DELETE /api/projects/:id
router.delete("/:id", authenticate, requireProjectAccess("admin"), (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });

  // Only global admin or project owner can delete
  if (req.user.role !== "admin" && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can delete this project." });
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ message: "Project deleted successfully." });
});

// POST /api/projects/:id/members - Add member
router.post("/:id/members", authenticate, requireProjectAccess("admin"), (req, res) => {
  const { user_id, role = "member" } = req.body;

  if (!user_id) return res.status(400).json({ error: "user_id is required." });
  if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Role must be admin or member." });

  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "User not found." });

  try {
    db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)")
      .run(req.params.id, user_id, role);

    db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, "added_member", "project", req.params.id, JSON.stringify({ user_id, role }));

    res.status(201).json({ message: `${user.name} added to project.` });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "User is already a member of this project." });
    }
    throw err;
  }
});

// DELETE /api/projects/:id/members/:userId - Remove member
router.delete("/:id/members/:userId", authenticate, requireProjectAccess("admin"), (req, res) => {
  const { id, userId } = req.params;

  const project = db.prepare("SELECT owner_id FROM projects WHERE id = ?").get(id);
  if (project && project.owner_id == userId) {
    return res.status(400).json({ error: "Cannot remove the project owner." });
  }

  db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(id, userId);
  res.json({ message: "Member removed from project." });
});

// PUT /api/projects/:id/members/:userId - Update member role
router.put("/:id/members/:userId", authenticate, requireProjectAccess("admin"), (req, res) => {
  const { role } = req.body;
  if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Invalid role." });

  db.prepare("UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?")
    .run(role, req.params.id, req.params.userId);

  res.json({ message: "Member role updated." });
});

module.exports = router;
