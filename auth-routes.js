const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const db = require("./database");
const { authenticate, generateToken } = require("./auth");

const router = express.Router();

const signupValidators = [
  body("name").trim().isLength({ min: 2, max: 120 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
];

const signupHandler = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already in use." });

  const passwordHash = bcrypt.hashSync(password, 10);
  const safeRole = role === "admin" ? "admin" : "member";
  const result = db
    .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
    .run(name, email, passwordHash, safeRole);

  const user = db.prepare("SELECT id, name, email, role, avatar FROM users WHERE id = ?").get(result.lastInsertRowid);
  const token = generateToken(user);
  res.status(201).json({ user, token });
};

router.post("/register", signupValidators, signupHandler);
router.post("/signup", signupValidators, signupHandler);

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 1 })],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!userRow) return res.status(401).json({ error: "Invalid email or password." });

    const ok = bcrypt.compareSync(password, userRow.password);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      avatar: userRow.avatar,
    };
    const token = generateToken(user);
    res.json({ user, token });
  }
);

router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

router.get("/users", authenticate, (req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name ASC")
    .all();
  res.json(users);
});

router.put("/profile", authenticate, (req, res) => {
  const { name, password } = req.body || {};
  if (!name && !password) return res.status(400).json({ error: "No fields to update." });

  const fields = [];
  const values = [];

  if (name) {
    fields.push("name = ?");
    values.push(String(name).trim());
  }

  if (password) {
    fields.push("password = ?");
    values.push(bcrypt.hashSync(String(password), 10));
  }

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const user = db
    .prepare("SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  res.json(user);
});

module.exports = router;
