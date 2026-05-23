from pathlib import Path

import fitz
import pytest
import yaml

from app.parsers.pdf_extractor import parse_pdf_bytes
from app.parsers.token_extractor import extract_token_frequencies

FIXTURES = Path(__file__).parent / "fixtures"
CASES_PATH = Path(__file__).parent / "cases" / "pdf_token_extraction.yaml"


def _load_cases() -> list[dict]:
    raw = yaml.safe_load(CASES_PATH.read_text(encoding="utf-8"))
    return raw["cases"]


def _pdf_bytes_from_text(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    # Built-in CJK font — required for UTF-8 Korean in test PDFs
    page.insert_text((72, 72), text, fontname="korea", fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.mark.parametrize("case", _load_cases(), ids=lambda c: c["name"])
def test_pdf_token_extraction_harness(case: dict) -> None:
    exp = case["expect"]
    if "fixture" in case:
        text = (FIXTURES / case["fixture"]).read_text(encoding="utf-8")
    else:
        text = case["text"]

    freqs = extract_token_frequencies(text)
    labels = [label for label, _ in freqs]
    freq_map = dict(freqs)

    assert len(freqs) >= exp["min_unique_tokens"], labels[:30]

    for token in exp.get("contains_tokens", []):
        assert token in labels, f"missing token {token!r} in {labels[:40]}"

    for token, minimum in exp.get("min_token_occurrences", {}).items():
        assert freq_map.get(token, 0) >= minimum, freq_map.get(token)


@pytest.mark.parametrize("case", _load_cases(), ids=lambda c: c["name"])
def test_pdf_parse_pipeline_harness(case: dict) -> None:
    if "fixture" in case:
        text = (FIXTURES / case["fixture"]).read_text(encoding="utf-8")
    else:
        text = case["text"]

    parsed = parse_pdf_bytes(_pdf_bytes_from_text(text), keyword_top_n=50)
    assert parsed.page_count >= 1
    assert parsed.full_text.strip()
    assert parsed.sections
    assert parsed.unique_token_count >= case["expect"]["min_unique_tokens"]

    labels = [label for label, _ in parsed.token_frequencies]
    all_labels = [label for label, _ in extract_token_frequencies(text)]
    for token in case["expect"].get("contains_tokens", []):
        assert token in labels or token in all_labels
