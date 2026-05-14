import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from database import get_db

# Constants
JWT_SECRET = os.environ.get("JWT_SECRET", "team-task-manager-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Password hashing (bcrypt directly — passlib is incompatible with bcrypt 4.1+)

# Routers
router = APIRouter()

# Models
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "member"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None

# Utils
def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    # bcrypt rejects secrets longer than 72 bytes
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

# Dependency: Get Current User
def get_current_user(authorization: str = Header(None), db=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    
    user = db.execute("SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")
    
    return dict(user)

# Dependency Factory: Require Project Access
def require_project_access(required_role: str):
    def dependency(project_id: int, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
        if current_user["role"] == "admin":
            return current_user
        
        membership = db.execute(
            "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
            (project_id, current_user["id"])
        ).fetchone()
        
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied — not a project member.")
            
        if required_role == "admin" and membership["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required for this action.")
            
        return current_user
    return dependency

# Endpoints
@router.post("/register", status_code=201)
@router.post("/signup", status_code=201)
def signup(user: UserSignup, db=Depends(get_db)):
    if len(user.name) < 2 or len(user.name) > 120 or len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Invalid input length.")
        
    existing = db.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use.")
        
    safe_role = "admin" if user.role == "admin" else "member"
    hashed_password = get_password_hash(user.password)
    
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        (user.name, user.email, hashed_password, safe_role)
    )
    db.commit()
    user_id = cursor.lastrowid
    
    new_user = db.execute("SELECT id, name, email, role, avatar FROM users WHERE id = ?", (user_id,)).fetchone()
    new_user_dict = dict(new_user)
    token = create_access_token(new_user_dict)
    
    return {"user": new_user_dict, "token": token}

@router.post("/login")
def login(user: UserLogin, db=Depends(get_db)):
    user_row = db.execute("SELECT * FROM users WHERE email = ?", (user.email,)).fetchone()
    if not user_row or not verify_password(user.password, user_row["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    user_dict = {
        "id": user_row["id"],
        "name": user_row["name"],
        "email": user_row["email"],
        "role": user_row["role"],
        "avatar": user_row["avatar"]
    }
    token = create_access_token(user_dict)
    return {"user": user_dict, "token": token}

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.get("/users")
def get_users(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    users = db.execute("SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name ASC").fetchall()
    return [dict(u) for u in users]

@router.put("/profile")
def update_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not profile.name and not profile.password:
        raise HTTPException(status_code=400, detail="No fields to update.")
        
    fields = []
    values = []
    
    if profile.name:
        fields.append("name = ?")
        values.append(profile.name.strip())
        
    if profile.password:
        fields.append("password = ?")
        values.append(get_password_hash(profile.password))
        
    values.append(current_user["id"])
    query = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"
    db.execute(query, values)
    db.commit()
    
    updated_user = db.execute(
        "SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?", 
        (current_user["id"],)
    ).fetchone()
    return dict(updated_user)
