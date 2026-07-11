"""Deprecated stub — real voice routes live in app.routers.product."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/students/me/voice-legacy", tags=["voice-planned"], include_in_schema=False)
