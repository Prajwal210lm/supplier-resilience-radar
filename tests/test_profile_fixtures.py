from profile_core.builder import build_profile, portfolio_headline
from profile_core.loader import load_suppliers, total_spend
from profile_core.metrics import is_category_dominant


def _by_id(suppliers, supplier_id):
    return next(s for s in suppliers if s["supplier_id"] == supplier_id)


def test_sup_001(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-001"), suppliers)
    assert profile.spend_share == 0.18
    assert profile.line_down_gap_weeks == 10
    assert profile.category_dominant is True
    assert profile.concentration_score == 94.0


def test_sup_002(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-002"), suppliers)
    assert profile.spend_share == 0.11
    assert profile.line_down_gap_weeks == 2
    assert profile.category_dominant is False
    assert profile.concentration_score == 29.25


def test_sup_003(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-003"), suppliers)
    assert profile.spend_share == 0.09
    assert profile.line_down_gap_weeks == 6
    assert profile.category_dominant is True
    assert profile.concentration_score == 70.75


def test_sup_004(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-004"), suppliers)
    assert profile.spend_share == 0.09
    assert profile.line_down_gap_weeks == 4
    assert profile.category_dominant is True
    assert profile.concentration_score == 55.75


def test_sup_005(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-005"), suppliers)
    assert profile.spend_share == 0.08
    assert profile.line_down_gap_weeks == 0
    assert profile.category_dominant is False
    assert profile.concentration_score == 14.0


def test_knife_edge_category_dominance(suppliers):
    profile = build_profile(_by_id(suppliers, "SUP-005"), suppliers)
    assert profile.category_share == 0.5
    assert is_category_dominant(0.5) is False
    assert is_category_dominant(0.51) is True
    assert is_category_dominant(0.50) is False


def test_portfolio_headline(suppliers):
    headline = portfolio_headline(suppliers)
    assert headline["total_strategic_spend_aed"] == 480000000
    assert headline["top_n_spend_share"] == 0.55
    assert headline["single_source_spend_share"] == 0.50


def test_loader():
    loaded = load_suppliers()
    assert len(loaded) == 25
    assert total_spend(loaded) == 480000000
