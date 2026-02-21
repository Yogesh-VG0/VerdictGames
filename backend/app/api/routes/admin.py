from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.review import Review
from app.models.user import User
from app.models.job import ScrapeJob

router = APIRouter()

@router.get("/jobs", response_model=List[dict])
def list_jobs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser)
) -> Any:
    jobs = db.query(ScrapeJob).order_by(ScrapeJob.created_at.desc()).limit(50).all()
    return [{"id": j.id, "job_type": j.job_type, "status": j.status, "last_run": j.last_run} for j in jobs]

@router.post("/jobs/trigger/{job_type}")
def trigger_job(
    job_type: str,
    target_id: str = None,
    current_user: User = Depends(deps.get_current_active_superuser)
) -> Any:
    # TODO: celery_app.send_task(f"worker.tasks.{job_type}", args=[target_id])
    return {"msg": f"Triggered job {job_type}"}

@router.delete("/reviews/{id}")
def delete_review(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser)
) -> Any:
    review = db.query(Review).filter(Review.id == id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    db.delete(review)
    db.commit()
    return {"msg": "Review deleted successfully"}

@router.post("/users/{id}/ban")
def ban_user(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser)
) -> Any:
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.add(user)
    db.commit()
    return {"msg": "User banned successfully"}
