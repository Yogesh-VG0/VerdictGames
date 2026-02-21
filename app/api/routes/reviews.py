from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.review import Review
from app.schemas.review import ReviewCreate, Review as ReviewSchema, ReviewUpdate
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=ReviewSchema)
def create_review(
    *,
    db: Session = Depends(deps.get_db),
    review_in: ReviewCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Create a new game review. Spawns Celery task to update async aggregates.
    """
    # Verify exact one review per user per game per platform
    existing = db.query(Review).filter(
        Review.user_id == current_user.id,
        Review.game_id == review_in.game_id,
        Review.platform_id == review_in.platform_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this game on this platform.")

    review = Review(
        user_id=current_user.id,
        game_id=review_in.game_id,
        platform_id=review_in.platform_id,
        rating=review_in.rating,
        text=review_in.text,
        device_specs=review_in.device_specs,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # TODO: Trigger celery task here `recalculate_rating_aggregates.delay(review.game_id)`
    
    return review

@router.put("/{id}", response_model=ReviewSchema)
def update_review(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    review_in: ReviewUpdate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Update a review.
    """
    review = db.query(Review).filter(Review.id == id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    
    update_data = review_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(review, field, update_data[field])
        
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # TODO: Trigger celery task here `recalculate_rating_aggregates.delay(review.game_id)`
    
    return review
