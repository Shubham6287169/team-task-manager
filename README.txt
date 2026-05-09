================================================================================
                     TEAM TASK — PROJECT & TASK MANAGER
              Full-Stack Web Application with Role-Based Access Control
================================================================================

TABLE OF CONTENTS
-----------------
1.  Overview
2.  Features
3.  Tech Stack
4.  Project Structure
5.  Local Setup & Installation
6.  Environment Variables
7.  API Reference
8.  Role-Based Access Control (RBAC)
9.  Database Schema
10. Deployment on Railway
11. Usage Guide
12. Troubleshooting


================================================================================
1. OVERVIEW
================================================================================

Team Task is a full-stack project and task management platform built for teams.
It allows admins and members to collaborate on projects, assign tasks, track
progress through a Kanban board, and view real-time dashboard metrics.

The backend is built with Node.js + Express + SQLite (via better-sqlite3),
and the frontend is a React SPA served directly from the Express server.


================================================================================
2. FEATURES
================================================================================

AUTHENTICATION
  - Email/password signup and login
  - JWT-based authentication (7-day token expiry)
  - Profile update (name, password)
  - Secure bcrypt password hashing (12 rounds)

ROLE-BASED ACCESS CONTROL
  - Two global roles: Admin and Member
  - Two project-level roles: Project Admin and Project Member
  - Admins see and manage ALL projects and tasks
  - Members only access projects they've been added to
  - Project Admins can manage members and project settings

PROJECT MANAGEMENT
  - Create, edit, and archive projects
  - Set project deadlines
  - Track progress (% complete based on tasks)
  - Per-project member management
  - Real-time stats: total, done, and overdue tasks

TASK MANAGEMENT
  - Create tasks with title, description, priority, status, due date
  - Assign tasks to project members
  - Four statuses: To Do → In Progress → Review → Done
  - Four priority levels: Low, Medium, High, Critical
  - Inline status updates from list and board views
  - Task search and filter (status, priority, overdue)
  - Task comments (threaded discussion)

VIEWS
  - Dashboard: stats, status breakdown, activity feed, my open tasks
  - Project list with progress bars and overdue indicators
  - Task list view with inline status toggles
  - Kanban board (4-column drag-free board)
  - Team members tab with role management
  - My Tasks page (all tasks assigned to current user)

DASHBOARD METRICS
  - Total tasks, overdue count, active projects, completed tasks
  - Progress chart by status
  - Recent activity log
  - Quick access to open personal tasks


================================================================================
3. TECH STACK
================================================================================

BACKEND
  - Runtime:      Node.js 18+
  - Framework:    Express 4.18
  - Database:     SQLite via better-sqlite3 9.x (file-based, zero config)
  - Auth:         JSON Web Tokens (jsonwebtoken 9.x)
  - Passwords:    bcryptjs 2.x
  - Validation:   express-validator 7.x
  - CORS:         cors 2.x

FRONTEND
  - Library:      React 18 (via CDN — no build step needed)
  - Transpilation: Babel Standalone (in-browser JSX)
  - Styling:      Custom CSS-in-JS with CSS variables
  - Fonts:        Space Mono (display) + DM Sans (body) via Google Fonts
  - HTTP:         Native fetch API

DEPLOYMENT
  - Platform:     Railway (recommended)
  - Config:       railway.toml (included)
  - DB Storage:   SQLite file persisted on Railway volume


================================================================================
4. PROJECT STRUCTURE
================================================================================

Team Task/
├── server.js              # Express app entry point
├── package.json           # Dependencies and scripts
├── railway.toml           # Railway deployment config
├── .env.example           # Environment variable template
├── .gitignore
│
├── db/
│   └── database.js        # SQLite init, schema, triggers
│
├── middleware/
│   └── auth.js            # JWT verify, requireAdmin, requireProjectAccess
│
├── routes/
│   ├── auth.js            # POST /signup, /login; GET /me, /users; PUT /profile
│   ├── projects.js        # CRUD projects + member management
│   └── tasks.js           # CRUD tasks + comments + dashboard
│
├── public/
│   └── index.html         # Full React SPA (single file, CDN React)
│
└── data/                  # Created at runtime — holds taskmanager.db
    └── taskmanager.db     # SQLite database (auto-created on first run)


================================================================================
5. LOCAL SETUP & INSTALLATION
================================================================================

PREREQUISITES
  - Node.js 18 or higher  →  https://nodejs.org/
  - npm (comes with Node)

STEPS

  1. Clone or extract the project folder:
       cd "Team Task"

  2. Install dependencies:
       npm install

  3. Copy the example env file and configure it:
       cp .env.example .env
       # Edit .env with your preferred settings (see Section 6)

  4. Start the development server:
       npm run dev       # uses nodemon (auto-restart on file changes)
       # OR
       npm start         # plain node

  5. Open your browser at:
       http://localhost:3000

  The database (data/taskmanager.db) is auto-created on first startup.
  No migrations to run — schema is applied automatically.

  CREATE YOUR FIRST ADMIN ACCOUNT:
    - Go to http://localhost:3000
    - Click "Sign Up"
    - Select "Admin" role
    - Sign up — you now have full access to all projects


================================================================================
6. ENVIRONMENT VARIABLES
================================================================================

Variable         Default                          Description
---------------------------------------------------------------------------
PORT             3000                             Server port
NODE_ENV         development                      Environment flag
JWT_SECRET       team-task-secret-...             Secret key for signing JWTs
                                                  ⚠ CHANGE IN PRODUCTION!
DB_PATH          ./data/taskmanager.db            Path to SQLite database file
FRONTEND_URL     *                                CORS allowed origin

Example .env:
  PORT=3000
  NODE_ENV=production
  JWT_SECRET=my-super-secret-production-key-abc123
  DB_PATH=./data/taskmanager.db
  FRONTEND_URL=https://your-app.railway.app


================================================================================
7. API REFERENCE
================================================================================

BASE URL: /api

--- AUTHENTICATION ---

POST   /auth/signup           Register a new user
  Body: { name, email, password, role? }
  Response: { token, user }

POST   /auth/login            Log in
  Body: { email, password }
  Response: { token, user }

GET    /auth/me               Get current user (auth required)
  Response: { id, name, email, role, avatar, created_at }

PUT    /auth/profile          Update profile (auth required)
  Body: { name?, password? }

GET    /auth/users            List all users (auth required)


--- PROJECTS ---

GET    /projects              List accessible projects
GET    /projects/:id          Get project details + members
POST   /projects              Create project
  Body: { name, description?, deadline? }

PUT    /projects/:id          Update project (project admin)
  Body: { name?, description?, status?, deadline? }

DELETE /projects/:id          Delete project (project owner or global admin)

POST   /projects/:id/members          Add member (project admin)
  Body: { user_id, role? }

DELETE /projects/:id/members/:userId  Remove member (project admin)
PUT    /projects/:id/members/:userId  Update member role (project admin)
  Body: { role }


--- TASKS ---

GET    /tasks                 List tasks with optional filters
  Query: project_id, status, priority, assignee_id, overdue, search

GET    /tasks/dashboard       Dashboard summary (stats + activity)

GET    /tasks/:id             Get task + comments

POST   /tasks                 Create task
  Body: { title, project_id, description?, assignee_id?, status?,
          priority?, due_date?, tags? }

PUT    /tasks/:id             Update task
  Body: { title?, description?, assignee_id?, status?,
          priority?, due_date?, tags? }

DELETE /tasks/:id             Delete task (creator or project admin)

POST   /tasks/:id/comments    Add comment
  Body: { content }


--- HEALTH ---

GET    /api/health            Server health check


ALL PROTECTED ROUTES require:
  Header: Authorization: Bearer <your-jwt-token>


================================================================================
8. ROLE-BASED ACCESS CONTROL (RBAC)
================================================================================

GLOBAL ROLES
  admin   → Can access ALL projects, ALL tasks; can add members to any project;
             can delete any project; sees full user list with created_at.
  member  → Can only access projects they are a member of; limited to their
             assigned tasks by default.

PROJECT-LEVEL ROLES (project_members table)
  admin   → Can edit/delete the project; add/remove/change member roles;
             delete any task in the project.
  member  → Can create and update tasks; can view all project content;
             can only delete tasks they created.

ACCESS MATRIX
  Action                          Global Admin  Project Admin  Member
  ─────────────────────────────   ────────────  ─────────────  ──────
  View all projects               ✓             ✗              ✗
  Create project                  ✓             ✓              ✓
  Edit project                    ✓             ✓              ✗
  Delete project                  ✓             owner only     ✗
  Add/remove members              ✓             ✓              ✗
  Change member role              ✓             ✓              ✗
  Create task                     ✓             ✓              ✓
  Update any task status          ✓             ✓              ✓
  Delete any task                 ✓             ✓              own only
  View dashboard                  ✓ (all)       ✓ (projects)   ✓ (own)


================================================================================
9. DATABASE SCHEMA
================================================================================

USERS
  id           INTEGER PK AUTOINCREMENT
  name         TEXT NOT NULL
  email        TEXT UNIQUE NOT NULL
  password     TEXT NOT NULL           (bcrypt hash)
  role         TEXT DEFAULT 'member'   (admin | member)
  avatar       TEXT                    (initials, e.g. "JD")
  created_at   DATETIME
  updated_at   DATETIME

PROJECTS
  id           INTEGER PK AUTOINCREMENT
  name         TEXT NOT NULL
  description  TEXT
  status       TEXT DEFAULT 'active'   (active | archived | completed)
  owner_id     INTEGER FK → users.id
  deadline     DATE
  created_at   DATETIME
  updated_at   DATETIME

PROJECT_MEMBERS
  id           INTEGER PK AUTOINCREMENT
  project_id   INTEGER FK → projects.id ON DELETE CASCADE
  user_id      INTEGER FK → users.id ON DELETE CASCADE
  role         TEXT DEFAULT 'member'   (admin | member)
  joined_at    DATETIME
  UNIQUE(project_id, user_id)

TASKS
  id           INTEGER PK AUTOINCREMENT
  title        TEXT NOT NULL
  description  TEXT
  status       TEXT DEFAULT 'todo'     (todo | in_progress | review | done)
  priority     TEXT DEFAULT 'medium'   (low | medium | high | critical)
  project_id   INTEGER FK → projects.id ON DELETE CASCADE
  assignee_id  INTEGER FK → users.id ON DELETE SET NULL
  creator_id   INTEGER FK → users.id ON DELETE CASCADE
  due_date     DATE
  tags         TEXT DEFAULT '[]'       (JSON array)
  created_at   DATETIME
  updated_at   DATETIME

TASK_COMMENTS
  id           INTEGER PK AUTOINCREMENT
  task_id      INTEGER FK → tasks.id ON DELETE CASCADE
  user_id      INTEGER FK → users.id ON DELETE CASCADE
  content      TEXT NOT NULL
  created_at   DATETIME

ACTIVITY_LOG
  id           INTEGER PK AUTOINCREMENT
  user_id      INTEGER FK → users.id ON DELETE SET NULL
  action       TEXT NOT NULL           (e.g. "created_task", "updated_project")
  entity_type  TEXT NOT NULL           (user | project | task)
  entity_id    INTEGER
  meta         TEXT DEFAULT '{}'       (JSON metadata)
  created_at   DATETIME


================================================================================
10. DEPLOYMENT ON RAILWAY
================================================================================

STEP-BY-STEP RAILWAY DEPLOYMENT

  1. Create a GitHub repository:
       git init
       git add .
       git commit -m "Initial commit: Team Task Manager"
       git remote add origin https://github.com/YOUR_USERNAME/team-task.git
       git push -u origin main

  2. Sign up at https://railway.app (free tier available)

  3. Click "New Project" → "Deploy from GitHub repo"
     Select your repository.

  4. Railway auto-detects Node.js and runs `npm start`.
     The railway.toml config sets the health check path.

  5. Add environment variables in Railway dashboard → Variables tab:
       JWT_SECRET    = (generate a random 32+ char string)
       NODE_ENV      = production
       PORT          = 3000   (or let Railway auto-assign)

  6. Add a Volume for database persistence:
       - Railway dashboard → your service → Volumes tab
       - Mount path: /app/data
       - Then set: DB_PATH = /app/data/taskmanager.db

  7. Deploy — Railway builds and launches automatically.
     Your app will be live at: https://your-app-name.railway.app

  IMPORTANT: Without a Volume, the SQLite database resets on every deploy.
  Always mount a persistent volume in production!

  HEALTH CHECK: GET /api/health — returns { status: "ok", timestamp, version }


================================================================================
11. USAGE GUIDE
================================================================================

GETTING STARTED

  1. Navigate to your app URL
  2. Sign up with "Admin" role to get full access
  3. Create your first project (+ New Project button)
  4. Add team members to the project (Members tab → + Add Member)
     Note: Members must first register their own accounts
  5. Create tasks and assign them to team members
  6. Track progress in the Board (Kanban) or List view

WORKFLOW TIPS

  → Create projects first, then invite members
  → Use priorities to sort critical work to the top
  → Use the Board tab for a visual overview of task flow
  → The Dashboard always shows your most urgent open tasks
  → Admins can see all projects without being added as members
  → Set due dates to get overdue warnings (shown in red)

ROLE SETUP FOR A TEAM

  Recommended structure:
    - Project Manager   → Global Admin role
    - Team Leads        → Member role (global) + Project Admin (per project)
    - Developers        → Member role (global) + Project Member (per project)


================================================================================
12. TROUBLESHOOTING
================================================================================

"Module not found: better-sqlite3"
  → Run: npm install
  → If on Windows, you may need: npm install --build-from-source

Database permission error
  → Ensure the ./data/ directory is writable
  → On Railway, ensure a Volume is mounted at /app/data

JWT token errors (401 Unauthorized)
  → Token has expired — log in again
  → Ensure JWT_SECRET matches across restarts

Port already in use
  → Change PORT in .env
  → Or kill existing process: lsof -ti :3000 | xargs kill

CORS errors in browser
  → Set FRONTEND_URL in .env to your exact frontend origin
  → In development, the default "*" should work

React not rendering
  → Check browser console for errors
  → Ensure CDN scripts loaded (needs internet access)
  → Verify /api/health returns OK

SQLite "SQLITE_BUSY" errors
  → WAL mode is enabled by default — this should be rare
  → Restart the server; SQLite WAL handles concurrent reads well


================================================================================
                       LICENSE: MIT — Free to use and modify
================================================================================
