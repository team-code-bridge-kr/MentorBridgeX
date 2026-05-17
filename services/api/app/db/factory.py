from typing import Any

from app.config import get_settings
from app.db.memory import InMemoryGraphStore, get_memory_graph_store
from app.db.neo4j import Neo4jGraphStore


def is_offline_demo() -> bool:
    return get_settings().offline_demo


def get_graph_store() -> Neo4jGraphStore | InMemoryGraphStore:
    if is_offline_demo():
        return get_memory_graph_store()
    return Neo4jGraphStore()


GraphStore = Any
