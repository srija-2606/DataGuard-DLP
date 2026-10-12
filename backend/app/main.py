import os, json
from pathlib import Path
from datetime import timezone
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from .database import Base, engine, get_db
from .models import User, AuditEvent
from .schemas import RegisterIn, LoginIn, TokenOut, TextScanIn
from .security import hash_password, verify_password, create_access_token, get_current_user
from .dlp import scan_text

load_dotenv()
Base.metadata.create_all(bind=engine)
app = FastAPI(title="DataGuard DLP API", version="1.0.0",
              description="Educational data leakage prevention prototype.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://data-guard-dlp.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "2000000"))
ALLOWED_EXTENSIONS = {".txt", ".csv", ".json", ".md"}

def record_event(db: Session, user: User, filename: str, result: dict):
    categories = sorted({f["category"] for f in result["findings"]})
    event = AuditEvent(
        user_id=user.id, filename=Path(filename).name[:255],
        risk_level=result["risk_level"], risk_score=result["risk_score"],
        action=result["policy_action"], finding_count=result["finding_count"],
        categories=", ".join(categories)
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def event_dict(event: AuditEvent):
    created = event.created_at
    if created and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {
        "id": event.id, "created_at": created.isoformat() if created else None,
        "filename": event.filename, "risk_level": event.risk_level,
        "risk_score": event.risk_score, "action": event.action,
        "finding_count": event.finding_count, "categories": event.categories
    }

@app.get("/")
def root():
    return {"name": "DataGuard DLP API", "status": "running", "docs": "/docs"}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id, user.email), email=user.email)

@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenOut(access_token=create_access_token(user.id, user.email), email=user.email)

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}

@app.post("/api/scan/text")
def scan_text_endpoint(payload: TextScanIn, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    result = scan_text(payload.text)
    record_event(db, user, payload.filename, result)
    # Raw submitted content is not stored in the audit database.
    return result

@app.post("/api/scan/file")
async def scan_file(file: UploadFile = File(...), db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    filename = Path(file.filename or "upload.txt").name
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload TXT, CSV, JSON, or MD files.")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES} bytes.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text.")
    result = scan_text(content)
    record_event(db, user, filename, result)
    return result

@app.get("/api/audit")
def audit_log(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    events = (db.query(AuditEvent).filter(AuditEvent.user_id == user.id)
              .order_by(AuditEvent.id.desc()).limit(100).all())
    return [event_dict(e) for e in events]

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    events = (db.query(AuditEvent).filter(AuditEvent.user_id == user.id)
              .order_by(AuditEvent.id.desc()).limit(1000).all())
    return {
        "total_scans": len(events),
        "blocked": sum(e.action == "BLOCK" for e in events),
        "warnings": sum(e.action == "WARN" for e in events),
        "high_risk": sum(e.risk_level == "HIGH" for e in events),
        "recent_events": [event_dict(e) for e in events[:5]]
    }
