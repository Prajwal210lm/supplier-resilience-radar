SPEND_SHARE_CEILING = 0.20
# at/above 20% of total spend, spend exposure is maximal; a fifth of all
# procurement through one supplier is already board-level concentration

SINGLE_SOURCE_CEILING = 10
# at/above 10 single-sourced models, dependency is maximal; the fix
# (qualify alternatives) is the same whether it's 10 or 25

LINE_DOWN_GAP_CEILING_WEEKS = 10
# at/above a 10-week production halt, gap severity is maximal; beyond that
# you are already in full crisis and severity flattens

CATEGORY_DOMINANCE_THRESHOLD = 0.50
# dominant only if STRICTLY greater than half a category's spend; an even
# 50/50 split between two qualified sources is the definition of having an
# alternative, so a tie is NOT dominance

WEIGHT_SPEND = 0.35
# magnitude of money exposed; the base everything else modifies

WEIGHT_SINGLE_SOURCE = 0.25
# vulnerability axis: no alternative

WEIGHT_GAP = 0.25
# vulnerability axis: slow to recover; equal weight to single-source

WEIGHT_CATEGORY = 0.15
# lightest; partly correlates with spend, heavier would double-count
