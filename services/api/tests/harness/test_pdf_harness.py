from pathlib import Path

import fitz
import pytest
import yaml

from app.parsers.pdf_extractor import parse_pdf_bytes
from app.parsers.token_extractor import extract_token_frequencies

FIXTURES = Path(__file__).parent / "fixtures"
CASES_PATH = Path(__file__).parent / "cases" / "pdf_token_extraction.yaml"
REPO_ROOT = Path(__file__).resolve().parents[4]
STUDENT_PDF = REPO_ROOT / "student_file"


def _load_cases() -> list[dict]:
    raw = yaml.safe_load(CASES_PATH.read_text(encoding="utf-8"))
    return raw["cases"]


def _pdf_bytes_from_text(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
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

    parsed = parse_pdf_bytes(_pdf_bytes_from_text(text))
    assert parsed.page_count >= 1
    assert parsed.full_text.strip()
    assert parsed.sections
    assert parsed.unique_token_count >= case["expect"]["min_unique_tokens"]

    expected_freqs = extract_token_frequencies(parsed.full_text)
    assert len(parsed.token_frequencies) == len(expected_freqs), (
        "token list must not be truncated"
    )
    assert parsed.token_frequencies == expected_freqs

    if min_sections := case["expect"].get("min_sections"):
        assert len(parsed.sections) >= min_sections

    labels = [label for label, _ in parsed.token_frequencies]
    for token in case["expect"].get("contains_tokens", []):
        assert token in labels


@pytest.mark.skipif(
    not STUDENT_PDF.exists() or not list(STUDENT_PDF.glob("*.pdf")),
    reason="student_file PDF not present locally",
)
def test_real_student_pdf_extracts_all_tokens() -> None:
    pdf_path = next(STUDENT_PDF.glob("*.pdf"))
    parsed = parse_pdf_bytes(pdf_path.read_bytes())
    assert parsed.page_count >= 1
    assert parsed.unique_token_count >= 100
    assert len(parsed.token_frequencies) == parsed.unique_token_count
    assert len(parsed.sections) >= 2
    subjects = [s.title for s in parsed.sections if s.section_type.value == "subject_specific"]
    assert len(subjects) >= 2, subjects
