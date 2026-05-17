from fastapi import APIRouter

from app.db.factory import is_offline_demo
from app.db.neo4j import get_neo4j_driver
from app.db.redis_client import ping_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    if is_offline_demo():
        return {
            "status": "ok",
            "mode": "offline_demo",
            "neo4j": False,
            "redis": False,
            "postgres": False,
        }

    neo4j_ok = False
    try:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run("RETURN 1 AS ok")
            record = await result.single()
            neo4j_ok = bool(record and record["ok"] == 1)
    except Exception:
        neo4j_ok = False

    return {
        "status": "ok",
        "mode": "full",
        "neo4j": neo4j_ok,
        "redis": await ping_redis(),
    }
