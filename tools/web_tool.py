from dataclasses import dataclass

WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search", "max_uses": 5}


@dataclass
class WebFinding:
    url: str
    title: str
    page_age: str | None = None


def extract_web_findings(response) -> list:
    findings = []
    for block in response.content:
        if getattr(block, "type", None) == "web_search_tool_result":
            inner = getattr(block, "content", None)
            if isinstance(inner, list):  # skip error blocks
                for item in inner:
                    if getattr(item, "type", None) == "web_search_result":
                        findings.append(WebFinding(
                            url=item.url, title=item.title,
                            page_age=getattr(item, "page_age", None)))
    return findings


def search_web(client, prompt: str, model: str = "claude-sonnet-4-6",
               max_tokens: int = 1024) -> list:
    resp = client.messages.create(
        model=model, max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        tools=[WEB_SEARCH_TOOL],
    )
    return extract_web_findings(resp)
