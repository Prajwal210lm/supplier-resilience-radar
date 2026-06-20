from dataclasses import dataclass, field


@dataclass
class Claim:
    text: str
    citations: list = field(default_factory=list)


@dataclass
class RiskBrief:
    concentration_profile: list
    risk_signals: list
    contract_implications: list
    recommended_actions: list
    confidence: list
