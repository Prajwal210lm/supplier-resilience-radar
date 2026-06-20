import numpy as np

from rag.embedder import embed
from rag.models import ContractChunk


def cosine(a, b) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class ContractStore:
    def __init__(self, chunks: list[ContractChunk]):
        self.chunks = chunks
        self.vectors = embed([c.text for c in chunks])  # (36, 384)

    def contract_search(self, query: str, supplier_id: str | None = None,
                        k: int = 3) -> list[ContractChunk]:
        qv = embed([query])[0]
        candidate_indices = list(range(len(self.chunks)))
        if supplier_id is not None:
            candidate_indices = [
                i for i in candidate_indices
                if self.chunks[i].supplier_id == supplier_id
            ]
        ranked = sorted(
            candidate_indices,
            key=lambda i: cosine(qv, self.vectors[i]),
            reverse=True,
        )
        return [self.chunks[i] for i in ranked[:k]]
