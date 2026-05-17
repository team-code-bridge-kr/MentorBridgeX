from fastapi import APIRouter

router = APIRouter(prefix="/v1/students/me/voice", tags=["voice-planned"])


@router.post("/sessions")
async def create_voice_session() -> dict:
    return {
        "status": "planned",
        "message": "음성 녹음 API는 음성 담당 트랙에서 구현 예정입니다.",
    }
