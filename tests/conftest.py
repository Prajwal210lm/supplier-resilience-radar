import json

import pytest


@pytest.fixture
def suppliers():
    with open("data/suppliers.json", encoding="utf-8") as f:
        data = json.load(f)
    return data["suppliers"]
