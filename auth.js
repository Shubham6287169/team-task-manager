const jwt = require("jsonwebtoken");
const db = require("./database");

const JWT_SECRET = process.env.JWT_SECRET || "team-task-secret-change-in-production";

// Verify JWT token
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = db.prepare("SELECT id, name, email, role, avatar FROM users WHERE id = ?").get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Invalid token. User not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
};

// Require admin role globally
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin role required." });
  }
  next();
};

// Require admin OR project admin
const requireProjectAccess = (role = "member") => (req, res, next) => {
  const projectId = req.params.projectId || req.params.id || req.body.project_id;

  if (req.user.role === "admin") return next(); // Global admin bypasses

  const membership = db
    .prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, req.user.id);

  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this project." });
  }

  if (role === "admin" && membership.role !== "admin") {
    return res.status(403).json({ error: "Project admin access required." });
  }

  req.projectMembership = membership;
  next();
};

// Generate token
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
};

module.exports = { authenticate, requireAdmin, requireProjectAccess, generateToken };
