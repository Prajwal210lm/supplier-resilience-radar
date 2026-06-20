import glob
import re

from rag.models import ContractChunk

_SUPPLIER_ID_RE = re.compile(r"\*\*Supplier ID:\*\*\s*(SUP-\d+)")
_REFERENCE_RE = re.compile(r"\*\*Reference:\*\*\s*(\S+)")
_CLAUSE_RE = re.compile(r"^##\s+(\d+)\.\s+(.+)$", re.MULTILINE)


def parse_contracts(contracts_dir: str = "data/contracts") -> list[ContractChunk]:
    chunks: list[ContractChunk] = []
    for path in sorted(glob.glob(f"{contracts_dir}/*.md")):
        with open(path, encoding="utf-8") as f:
            content = f.read()

        supplier_id = _SUPPLIER_ID_RE.search(content).group(1)
        contract_reference = _REFERENCE_RE.search(content).group(1)

        matches = list(_CLAUSE_RE.finditer(content))
        for idx, match in enumerate(matches):
            start = match.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
            chunks.append(
                ContractChunk(
                    supplier_id=supplier_id,
                    contract_reference=contract_reference,
                    clause_number=int(match.group(1)),
                    clause_title=match.group(2).strip(),
                    text=content[start:end].strip(),
                )
            )
    return chunks
