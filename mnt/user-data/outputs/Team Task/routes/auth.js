const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const db = require("../db/database");
const { authenticate, generateToken } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/signup
router.post(
  "/signup",
  [
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters."),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
    body("role").optional().isIn(["admin", "member"]).withMessage("Role must be admin or member."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role = "member" } = req.body;

    try {
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (existing) return res.status(409).json({ error: "Email already registered." });

      const hashed = await bcrypt.hash(password, 12);
      const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

      const result = db
        .prepare("INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)")
        .run(name, email, hashed, role, initials);

      const user = db
        .prepare("SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?")
        .get(result.lastInsertRowid);

      const token = generateToken(user);

      // Log activity
      db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)")
        .run(user.id, "signed_up", "user", user.id);

      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error during signup." });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
    body("password").notEmpty().withMessage("Password required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) return res.status(401).json({ error: "Invalid credentials." });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials." });

      const { password: _, ...safeUser } = user;
      const token = generateToken(safeUser);

      db.prepare("INSERT INTO activity_log (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)")
        .run(user.id, "logged_in", "user", user.id);

      res.json({ token, user: safeUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error during login." });
    }
  }
);

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  res.json(user);
});

// PUT /api/auth/profile
router.put(
  "/profile",
  authenticate,
  [
    body("name").optional().trim().isLength({ min: 2, max: 100 }),
    body("password").optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, password } = req.body;
    const updates = [];
    const values = [];

    if (name) {
      updates.push("name = ?");
      values.push(name);
    }
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      updates.push("password = ?");
      values.push(hashed);
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update." });

    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const user = db
      .prepare("SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?")
      .get(req.user.id);
    res.json(user);
  }
);

// GET /api/auth/users (admin only)
router.get("/users", authenticate, (req, res) => {
  if (req.user.role !== "admin") {
    // Members can still get basic user list for assignment purposes
    const users = db.prepare("SELECT id, name, email, role, avatar FROM users ORDER BY name").all();
    return res.json(users);
  }
  const users = db.prepare("SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

module.exports = router;
