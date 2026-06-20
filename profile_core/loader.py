import json


def load_suppliers(path: str = "data/suppliers.json") -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["suppliers"]


def total_spend(suppliers: list[dict]) -> int:
    return sum(s["annual_spend_aed"] for s in suppliers)


def category_total(suppliers: list[dict], category: str) -> int:
    return sum(s["annual_spend_aed"] for s in suppliers if s["category"] == category)
