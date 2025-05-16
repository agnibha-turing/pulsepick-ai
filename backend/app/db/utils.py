from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound
import json

from app.db.models import SystemMetadata


def get_system_metadata(db: Session, key: str, default=None):
    """Get a system metadata value by key"""
    try:
        metadata = db.query(SystemMetadata).filter(
            SystemMetadata.key == key).one()
        return metadata.value
    except NoResultFound:
        return default


def set_system_metadata(db: Session, key: str, value):
    """Set a system metadata value by key"""
    try:
        metadata = db.query(SystemMetadata).filter(
            SystemMetadata.key == key).one()
        metadata.value = value
        metadata.updated_at = datetime.utcnow()
    except NoResultFound:
        metadata = SystemMetadata(
            key=key,
            value=value,
            updated_at=datetime.utcnow()
        )
        db.add(metadata)

    db.commit()
    return metadata


def update_articles_timestamp(db: Session):
    """Update the timestamp when articles are fetched or reranked"""
    now = datetime.utcnow()
    timestamp = now.isoformat()

    set_system_metadata(db, "articles_last_updated", {
        "timestamp": timestamp
    })

    return timestamp


def get_articles_timestamp(db: Session):
    """Get the timestamp when articles were last updated"""
    data = get_system_metadata(db, "articles_last_updated")

    if data and "timestamp" in data:
        return data["timestamp"]

    # If no timestamp exists, create one now
    return update_articles_timestamp(db)
