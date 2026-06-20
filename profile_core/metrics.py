from profile_core.constants import (
    CATEGORY_DOMINANCE_THRESHOLD,
    LINE_DOWN_GAP_CEILING_WEEKS,
    SINGLE_SOURCE_CEILING,
    SPEND_SHARE_CEILING,
    WEIGHT_CATEGORY,
    WEIGHT_GAP,
    WEIGHT_SINGLE_SOURCE,
    WEIGHT_SPEND,
)


def spend_share(annual_spend_aed: int, total_spend_aed: int) -> float:
    return annual_spend_aed / total_spend_aed


def line_down_gap_weeks(avg_lead_time_weeks: int, weeks_of_cover: int) -> int:
    return max(avg_lead_time_weeks - weeks_of_cover, 0)


def category_share(supplier_spend_aed: int, category_total_spend_aed: int) -> float:
    return supplier_spend_aed / category_total_spend_aed


def is_category_dominant(category_share_value: float) -> bool:
    return category_share_value > CATEGORY_DOMINANCE_THRESHOLD


def spend_score(spend_share_value: float) -> float:
    return min(spend_share_value / SPEND_SHARE_CEILING, 1.0) * 100


def single_source_score(skus_single_sourced: int) -> float:
    return min(skus_single_sourced / SINGLE_SOURCE_CEILING, 1.0) * 100


def gap_score(line_down_gap_weeks_value: int) -> float:
    return min(line_down_gap_weeks_value / LINE_DOWN_GAP_CEILING_WEEKS, 1.0) * 100


def category_score(is_dominant: bool) -> float:
    return 100.0 if is_dominant else 0.0


def concentration_score(spend_share_value: float, skus_single_sourced: int,
                        line_down_gap_weeks_value: int, is_dominant: bool) -> float:
    sp = spend_score(spend_share_value)
    ss = single_source_score(skus_single_sourced)
    gp = gap_score(line_down_gap_weeks_value)
    cs = category_score(is_dominant)
    raw = WEIGHT_SPEND * sp + WEIGHT_SINGLE_SOURCE * ss + WEIGHT_GAP * gp + WEIGHT_CATEGORY * cs
    return round(raw, 2)
