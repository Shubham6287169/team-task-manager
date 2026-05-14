import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime

from database import init_db
from auth import router as auth_router
from projects import router as projects_router
from tasks import router as tasks_router

app = FastAPI(title="Team Task Manager")

# Initialize database
init_db()

# Middleware
frontend_url = os.environ.get("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])

@app.get("/api/health")
def health_check():
    return {
        "status": "ok", 
        "timestamp": datetime.utcnow().isoformat() + "Z", 
        "version": "1.0.0"
    }

# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled error: {exc}")
    detail = str(exc) if os.environ.get("NODE_ENV") == "development" else "Internal server error."
    return JSONResponse(status_code=500, content={"error": "Internal server error.", "details": detail})

# Serve static frontend
# Mount current directory to serve static assets (js, css, images) if requested
BASE_DIR = Path(__file__).resolve().parent

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # If the file exists on disk (e.g., CSS, JS, images), serve it
    file_path = BASE_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # Otherwise, fallback to index.html for React SPA
    index_path = BASE_DIR / "index.html"
    return FileResponse(index_path)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
