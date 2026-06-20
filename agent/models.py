from dataclasses import dataclass, field
from enum import Enum


class SignalType(str, Enum):
    COMPANY = "company"
    COUNTRY = "country"
    LOGISTICS = "logistics"
    CONTRACT = "contract"


@dataclass
class Finding:
    signal_type: str
    claim: str
    source: str
    relevance: str


@dataclass
class FindingsLedger:
    web_urls: set = field(default_factory=set)
    clause_refs: set = field(default_factory=set)  # tuples (supplier_id, clause_number)

    def add_web(self, web_findings):
        for wf in web_findings:
            self.web_urls.add(wf.url)

    def add_contract(self, chunks):
        for c in chunks:
            self.clause_refs.add((c.supplier_id, c.clause_number))


@dataclass
class ResearchFindings:
    findings: list
    searched_found_nothing: list
    ledger: FindingsLedger
    dropped: list
    turns: int
    forced: bool
