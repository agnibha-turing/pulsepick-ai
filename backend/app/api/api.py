from fastapi import APIRouter

from app.api.endpoints import articles, messages, personas

api_router = APIRouter()
api_router.include_router(
    articles.router, prefix="/articles", tags=["articles"])
api_router.include_router(
    messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(
    personas.router, prefix="/personas", tags=["personas"])
