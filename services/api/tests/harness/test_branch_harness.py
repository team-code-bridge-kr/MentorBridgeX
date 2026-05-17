from pathlib import Path

import pytest
import yaml

from app.adapters.ml_mock import MockMLAdapter
from app.schemas.graph import GraphSnapshot

CASES_PATH = Path(__file__).parent / "cases" / "branch_recommendation.yaml"


def _load_cases() -> list[dict]:
    raw = yaml.safe_load(CASES_PATH.read_text(encoding="utf-8"))
    return raw["cases"]


@pytest.mark.parametrize("case", _load_cases(), ids=lambda c: c["name"])
@pytest.mark.asyncio
async def test_branch_recommendation_harness(case: dict) -> None:
    ml = MockMLAdapter()
    inp = case["input"]
    exp = case["expect"]

    suggestions = await ml.suggest_branch_keywords(
        user_id="harness-user",
        seeds=inp["seeds"],
        graph=GraphSnapshot(nodes=[], edges=[]),
        retrieval_labels=[],
        max_results=inp.get("max_results", 10),
    )

    labels = [s.label for s in suggestions]
    assert len(suggestions) >= exp["min_suggestions"], labels

    for required in exp.get("contains_labels", []):
        assert required in labels, f"missing {required} in {labels}"
