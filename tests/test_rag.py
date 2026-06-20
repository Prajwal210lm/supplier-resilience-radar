import numpy as np
import pytest

from rag.chunker import parse_contracts
from rag.embedder import embed
from rag.store import ContractStore


@pytest.fixture(scope="module")
def chunks():
    return parse_contracts()


@pytest.fixture(scope="module")
def store(chunks):
    return ContractStore(chunks)


def test_chunker_structure():
    chunks = parse_contracts()
    assert len(chunks) == 36
    by_supplier = {}
    for c in chunks:
        by_supplier.setdefault(c.supplier_id, []).append(c)
    for supplier_id, supplier_chunks in by_supplier.items():
        assert len(supplier_chunks) == 9

    fm = next(
        c for c in chunks if c.supplier_id == "SUP-001" and c.clause_number == 2
    )
    assert fm.clause_title == "Force Majeure"
    assert "five (5) business days" in fm.text

    assert all(c.supplier_id for c in chunks)


def test_embedder_dimensionality():
    vectors = embed(["force majeure", "delivery lead time"])
    assert vectors.shape == (2, 384)


def test_embedder_determinism():
    a = embed(["force majeure notice period"])
    b = embed(["force majeure notice period"])
    assert np.array_equal(a, b)


def test_known_answer(store):
    q = "force majeure notice period to claim relief"
    results = store.contract_search(q, supplier_id="SUP-001", k=3)
    assert results[0].supplier_id == "SUP-001"
    assert results[0].clause_number == 2
    assert "five (5) business days" in results[0].text
    assert all(c.supplier_id == "SUP-001" for c in results)


def test_two_german_isolation(store):
    q = "force majeure notice period to claim relief"
    results = store.contract_search(q, supplier_id="SUP-001", k=3)
    assert all(c.supplier_id != "SUP-004" for c in results)


def test_no_filter_negative_control(store):
    q = "force majeure notice period to claim relief"
    results = store.contract_search(q, supplier_id=None, k=5)
    assert any(
        c.supplier_id == "SUP-004" and c.clause_number == 2 for c in results
    )
