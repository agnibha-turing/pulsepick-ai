from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.db.models import Persona
from app.api.endpoints.messages import Persona as PersonaSchema

router = APIRouter()


@router.get("/", response_model=List[PersonaSchema])
def get_personas(db: Session = Depends(get_db)):
    """
    Retrieve all saved personas.
    """
    db_personas = db.query(Persona).all()
    return [
        PersonaSchema(
            recipientName=p.recipient_name,
            jobTitle=p.job_title,
            company=p.company,
            conversationContext=p.conversation_context,
            personalityTraits=p.personality_traits
        )
        for p in db_personas
    ]


@router.post("/", response_model=PersonaSchema)
def create_persona(
    persona: PersonaSchema,
    db: Session = Depends(get_db)
):
    """
    Create a new persona.
    """
    if not persona.recipientName:
        raise HTTPException(
            status_code=400, detail="Recipient name is required")

    db_persona = Persona(
        recipient_name=persona.recipientName,
        job_title=persona.jobTitle,
        company=persona.company,
        conversation_context=persona.conversationContext,
        personality_traits=persona.personalityTraits
    )

    try:
        db.add(db_persona)
        db.commit()
        db.refresh(db_persona)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A persona with this recipient name, company, and job title already exists"
        )

    return persona


@router.put("/", response_model=PersonaSchema)
def update_persona(
    old_persona: PersonaSchema = Body(..., embed=True),
    updated_persona: PersonaSchema = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Update an existing persona.
    """
    if not old_persona.recipientName or not updated_persona.recipientName:
        raise HTTPException(
            status_code=400, detail="Recipient name is required")

    # Find the existing persona
    db_persona = db.query(Persona).filter(
        Persona.recipient_name == old_persona.recipientName,
        Persona.company == old_persona.company,
        Persona.job_title == old_persona.jobTitle
    ).first()

    if not db_persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Update the persona fields
    db_persona.recipient_name = updated_persona.recipientName
    db_persona.job_title = updated_persona.jobTitle
    db_persona.company = updated_persona.company
    db_persona.conversation_context = updated_persona.conversationContext
    db_persona.personality_traits = updated_persona.personalityTraits

    try:
        db.commit()
        db.refresh(db_persona)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A persona with this recipient name, company, and job title already exists"
        )

    return updated_persona


@router.delete("/", response_model=dict)
def delete_persona(
    persona: PersonaSchema,
    db: Session = Depends(get_db)
):
    """
    Delete a persona.
    """
    if not persona.recipientName:
        raise HTTPException(
            status_code=400, detail="Recipient name is required")

    db_persona = db.query(Persona).filter(
        Persona.recipient_name == persona.recipientName,
        Persona.company == persona.company,
        Persona.job_title == persona.jobTitle
    ).first()

    if not db_persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    db.delete(db_persona)
    db.commit()

    return {"success": True, "message": "Persona deleted successfully"}
