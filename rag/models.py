from dataclasses import dataclass


@dataclass
class ContractChunk:
    supplier_id: str
    contract_reference: str
    clause_number: int
    clause_title: str
    text: str
