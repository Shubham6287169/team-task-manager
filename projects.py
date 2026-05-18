import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Path
from typing import Optional, List
from pydantic import BaseModel
from database import get_db
from auth import get_current_user, require_project_access

router = APIRouter()

# Models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[str] = None
    owner_id: Optional[int] = None

class ProjectMember(BaseModel):
    user_id: int
    role: str = "member"

class ProjectMemberUpdate(BaseModel):
    role: str

# Helper
def get_project_with_stats(project_id: int, user_id: int, user_role: str, db):
    project = db.execute("""
        SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.due_date < date('now') AND t.status != 'done') as overdue_tasks,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p
        JOIN users u ON u.id = p.owner_id
        WHERE p.id = ?
    """, (project_id,)).fetchone()
    
    if not project:
        return None
        
    project_dict = dict(project)
    
    if user_role != "admin":
        membership = db.execute("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?", (project_id, user_id)).fetchone()
        if not membership:
            return None
        project_dict["my_role"] = membership["role"]
    else:
        project_dict["my_role"] = "admin"
        
    return project_dict

@router.get("")
def get_projects(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if current_user["role"] == "admin":
        projects = db.execute("""
          SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.due_date < date('now') AND t.status != 'done') as overdue_tasks,
            (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
          FROM projects p
          JOIN users u ON u.id = p.owner_id
          ORDER BY p.created_at DESC
        """).fetchall()
    else:
        projects = db.execute("""
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
        """, (current_user["id"],)).fetchall()
        
    return [dict(p) for p in projects]

@router.post("", status_code=201)
def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if len(project.name) < 2 or len(project.name) > 200:
        raise HTTPException(status_code=400, detail="Project name must be 2–200 characters.")
        
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO projects (name, description, owner_id, deadline) VALUES (?, ?, ?, ?)",
        (project.name, project.description, current_user["id"], project.deadline)
    )
    project_id = cursor.lastrowid
    
    # Add creator as admin member
    db.execute("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')", (project_id, current_user["id"]))
    
    # Log
    meta = json.dumps({"name": project.name})
    db.execute(
        "INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], "created_project", "project", project_id, meta)
    )
    db.commit()
    
    return get_project_with_stats(project_id, current_user["id"], current_user["role"], db)

@router.get("/{project_id}")
def get_project(project_id: int, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    project = get_project_with_stats(project_id, current_user["id"], current_user["role"], db)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied.")
        
    members = db.execute("""
        SELECT u.id, u.name, u.email, u.avatar, u.role as global_role, pm.role as project_role, pm.joined_at
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY pm.role DESC, u.name
    """, (project_id,)).fetchall()
    
    project["members"] = [dict(m) for m in members]
    return project

@router.put("/{project_id}")
def update_project(
    project_id: int, 
    project: ProjectUpdate, 
    db=Depends(get_db), 
    _ = Depends(require_project_access("admin")),
    current_user: dict = Depends(get_current_user)
):
    fields = []
    values = []
    
    if project.name is not None:
        if len(project.name) < 2 or len(project.name) > 200:
            raise HTTPException(status_code=400, detail="Invalid name length.")
        fields.append("name = ?")
        values.append(project.name)
    if project.description is not None:
        fields.append("description = ?")
        values.append(project.description)
    if project.status is not None:
        fields.append("status = ?")
        values.append(project.status)
    if project.deadline is not None:
        fields.append("deadline = ?")
        values.append(project.deadline)
    if project.owner_id is not None:
        fields.append("owner_id = ?")
        values.append(project.owner_id)
        # also add them as admin member if not already
        db.execute("INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')", (project_id, project.owner_id))
        
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
        
    values.append(project_id)
    db.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", values)
    
    db.execute(
        "INSERT INTO activity_log (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)",
        (current_user["id"], "updated_project", "project", project_id)
    )
    db.commit()
    
    return get_project_with_stats(project_id, current_user["id"], current_user["role"], db)

@router.delete("/{project_id}")
def delete_project(
    project_id: int, 
    db=Depends(get_db),
    _ = Depends(require_project_access("admin")),
    current_user: dict = Depends(get_current_user)
):
    project = db.execute("SELECT owner_id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    if current_user["role"] != "admin" and project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the project owner can delete this project.")
        
    db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    db.commit()
    return {"message": "Project deleted successfully."}

@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id: int, 
    member: ProjectMember, 
    db=Depends(get_db),
    _ = Depends(require_project_access("admin")),
    current_user: dict = Depends(get_current_user)
):
    if member.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Role must be admin or member.")
        
    user = db.execute("SELECT id, name FROM users WHERE id = ?", (member.user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    try:
        db.execute(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
            (project_id, member.user_id, member.role)
        )
        meta = json.dumps({"user_id": member.user_id, "role": member.role})
        db.execute(
            "INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], "added_member", "project", project_id, meta)
        )
        db.commit()
        return {"message": f"{user['name']} added to project."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="User is already a member of this project.")

@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: int, 
    user_id: int, 
    db=Depends(get_db),
    _ = Depends(require_project_access("admin"))
):
    project = db.execute("SELECT owner_id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if project and project["owner_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the project owner.")
        
    db.execute("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", (project_id, user_id))
    db.commit()
    return {"message": "Member removed from project."}

@router.put("/{project_id}/members/{user_id}")
def update_member_role(
    project_id: int, 
    user_id: int, 
    role_update: ProjectMemberUpdate, 
    db=Depends(get_db),
    _ = Depends(require_project_access("admin"))
):
    if role_update.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Invalid role.")
        
    db.execute(
        "UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?",
        (role_update.role, project_id, user_id)
    )
    db.commit()
    return {"message": "Member role updated."}
