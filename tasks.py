from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
import json

router = APIRouter()

# Models
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: int
    assignee_id: Optional[int] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    due_date: Optional[str] = None
    tags: Optional[List[str]] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None

class CommentCreate(BaseModel):
    content: str

# Helper
def check_membership(project_id: int, user_id: int, user_role: str, db):
    if user_role == "admin":
        return {"role": "admin"}
    return db.execute(
        "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
        (project_id, user_id)
    ).fetchone()

@router.get("")
def get_tasks(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    overdue: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    where_clause = ["1=1"]
    params = []
    
    if current_user["role"] != "admin":
        where_clause.append("t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)")
        params.append(current_user["id"])
        
    if project_id is not None:
        where_clause.append("t.project_id = ?")
        params.append(project_id)
    if status is not None:
        where_clause.append("t.status = ?")
        params.append(status)
    if priority is not None:
        where_clause.append("t.priority = ?")
        params.append(priority)
    if assignee_id is not None:
        where_clause.append("t.assignee_id = ?")
        params.append(assignee_id)
    if overdue == "true":
        where_clause.append("t.due_date < date('now') AND t.status != 'done'")
    if search:
        where_clause.append("(t.title LIKE ? OR t.description LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
        
    query = f"""
        SELECT t.*,
          u1.name as assignee_name, u1.avatar as assignee_avatar,
          u2.name as creator_name,
          p.name as project_name
        FROM tasks t
        LEFT JOIN users u1 ON u1.id = t.assignee_id
        LEFT JOIN users u2 ON u2.id = t.creator_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE {' AND '.join(where_clause)}
        ORDER BY
          CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
          t.due_date ASC NULLS LAST,
          t.created_at DESC
    """
    
    tasks = db.execute(query, params).fetchall()
    
    result = []
    for t in tasks:
        td = dict(t)
        if "tags" in td and td["tags"]:
            td["tags"] = json.loads(td["tags"])
        result.append(td)
        
    return result

@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_id = current_user["id"]
    is_admin = current_user["role"] == "admin"
    
    project_filter = "1=1" if is_admin else "project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)"
    params = [] if is_admin else [user_id]
    
    total_tasks = db.execute(f"SELECT COUNT(*) as count FROM tasks WHERE {project_filter}", params).fetchone()
    by_status = db.execute(f"SELECT status, COUNT(*) as count FROM tasks WHERE {project_filter} GROUP BY status", params).fetchall()
    by_priority = db.execute(f"SELECT priority, COUNT(*) as count FROM tasks WHERE {project_filter} GROUP BY priority", params).fetchall()
    overdue_tasks = db.execute(f"SELECT COUNT(*) as count FROM tasks WHERE {project_filter} AND due_date < date('now') AND status != 'done'", params).fetchone()
    
    my_tasks = db.execute("""
        SELECT t.*, p.name as project_name, u.name as assignee_name
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.assignee_id = ? AND t.status != 'done'
        ORDER BY t.due_date ASC NULLS LAST
        LIMIT 10
    """, (user_id,)).fetchall()
    
    recent_activity = db.execute("""
        SELECT al.*, u.name as user_name, u.avatar
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 15
    """).fetchall()
    
    if is_admin:
        project_count = db.execute("SELECT COUNT(*) as count FROM projects WHERE status = 'active'").fetchone()
    else:
        project_count = db.execute("SELECT COUNT(*) as count FROM project_members WHERE user_id = ?", (user_id,)).fetchone()
        
    return {
        "total_tasks": total_tasks["count"],
        "overdue_tasks": overdue_tasks["count"],
        "project_count": project_count["count"],
        "by_status": [dict(r) for r in by_status],
        "by_priority": [dict(r) for r in by_priority],
        "my_tasks": [dict(t) for t in my_tasks],
        "recent_activity": [dict(a) for a in recent_activity]
    }

@router.get("/{task_id}")
def get_task(task_id: int, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    task = db.execute("""
        SELECT t.*,
          u1.name as assignee_name, u1.avatar as assignee_avatar, u1.email as assignee_email,
          u2.name as creator_name, u2.avatar as creator_avatar,
          p.name as project_name
        FROM tasks t
        LEFT JOIN users u1 ON u1.id = t.assignee_id
        LEFT JOIN users u2 ON u2.id = t.creator_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ?
    """, (task_id,)).fetchone()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    membership = check_membership(task["project_id"], current_user["id"], current_user["role"], db)
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    comments = db.execute("""
        SELECT tc.*, u.name as user_name, u.avatar
        FROM task_comments tc
        JOIN users u ON u.id = tc.user_id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
    """, (task_id,)).fetchall()
    
    task_dict = dict(task)
    if "tags" in task_dict and task_dict["tags"]:
        task_dict["tags"] = json.loads(task_dict["tags"])
        
    task_dict["comments"] = [dict(c) for c in comments]
    return task_dict

@router.post("", status_code=201)
def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if len(task.title) < 2 or len(task.title) > 300:
        raise HTTPException(status_code=400, detail="Title must be 2–300 characters.")
        
    membership = check_membership(task.project_id, current_user["id"], current_user["role"], db)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project.")
        
    if task.assignee_id:
        assignee_member = check_membership(task.project_id, task.assignee_id, "member", db)
        if not assignee_member and current_user["role"] != "admin":
            raise HTTPException(status_code=400, detail="Assignee must be a project member.")
            
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO tasks (title, description, project_id, assignee_id, creator_id, status, priority, due_date, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        task.title, task.description, task.project_id, task.assignee_id, current_user["id"],
        task.status, task.priority, task.due_date, json.dumps(task.tags)
    ))
    task_id = cursor.lastrowid
    
    meta = json.dumps({"title": task.title, "project_id": task.project_id})
    db.execute(
        "INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], "created_task", "task", task_id, meta)
    )
    db.commit()
    
    created_task = db.execute("""
        SELECT t.*, u1.name as assignee_name, u1.avatar as assignee_avatar,
          u2.name as creator_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u1 ON u1.id = t.assignee_id
        LEFT JOIN users u2 ON u2.id = t.creator_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ?
    """, (task_id,)).fetchone()
    
    result = dict(created_task)
    if "tags" in result and result["tags"]:
        result["tags"] = json.loads(result["tags"])
    return result

@router.put("/{task_id}")
def update_task(task_id: int, updates: TaskUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    membership = check_membership(task["project_id"], current_user["id"], current_user["role"], db)
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    fields = []
    values = []
    
    if updates.title is not None: fields.append("title = ?"); values.append(updates.title)
    if updates.description is not None: fields.append("description = ?"); values.append(updates.description)
    if updates.assignee_id is not None: fields.append("assignee_id = ?"); values.append(updates.assignee_id)
    if updates.status is not None: fields.append("status = ?"); values.append(updates.status)
    if updates.priority is not None: fields.append("priority = ?"); values.append(updates.priority)
    if updates.due_date is not None: fields.append("due_date = ?"); values.append(updates.due_date)
    if updates.tags is not None: fields.append("tags = ?"); values.append(json.dumps(updates.tags))
    
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
        
    values.append(task_id)
    db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
    
    meta = json.dumps({"status": updates.status}) if updates.status else "{}"
    db.execute(
        "INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], "updated_task", "task", task_id, meta)
    )
    db.commit()
    
    updated = db.execute("""
        SELECT t.*, u1.name as assignee_name, u1.avatar as assignee_avatar,
          u2.name as creator_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u1 ON u1.id = t.assignee_id
        LEFT JOIN users u2 ON u2.id = t.creator_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ?
    """, (task_id,)).fetchone()
    
    result = dict(updated)
    if "tags" in result and result["tags"]:
        result["tags"] = json.loads(result["tags"])
    return result

@router.delete("/{task_id}")
def delete_task(task_id: int, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    task = db.execute("SELECT project_id, creator_id FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    membership = check_membership(task["project_id"], current_user["id"], current_user["role"], db)
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    if current_user["role"] != "admin" and task["creator_id"] != current_user["id"] and membership["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only task creator or project admin can delete tasks.")
        
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return {"message": "Task deleted."}

@router.post("/{task_id}/comments", status_code=201)
def add_comment(task_id: int, comment: CommentCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not comment.content.strip():
        raise HTTPException(status_code=400, detail="Comment content required.")
        
    task = db.execute("SELECT project_id FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    membership = check_membership(task["project_id"], current_user["id"], current_user["role"], db)
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)",
        (task_id, current_user["id"], comment.content.strip())
    )
    comment_id = cursor.lastrowid
    db.commit()
    
    new_comment = db.execute("""
        SELECT tc.*, u.name as user_name, u.avatar
        FROM task_comments tc
        JOIN users u ON u.id = tc.user_id
        WHERE tc.id = ?
    """, (comment_id,)).fetchone()
    
    return dict(new_comment)
