// Pure presentation helpers shared across the app. No data is invented here —
// everything derives from values the API actually returns.

export function isHttp(c: string): boolean {
  return c.trim().toLowerCase().startsWith("http");
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// "SUP-001 Clause 2" -> { sid: "SUP-001", num: 2 }
export function parseClause(c: string): { sid: string; num: number } | null {
  const m = c.match(/(SUP-\d+).*?Clause\s+(\d+)/i);
  return m ? { sid: m[1], num: parseInt(m[2], 10) } : null;
}

// Split a claim into a bold lead (first sentence) and the remainder. Requires a
// capital letter after the terminator so abbreviations ("U.S. ", "approx. ")
// don't split mid-sentence.
export function splitLead(text: string): { lead: string; rest: string } {
  const t = (text ?? "").trim();
  const idx = t.search(/[.!?]\s+[A-Z]/);
  if (idx === -1) return { lead: t, rest: "" };
  return { lead: t.slice(0, idx + 1).trim(), rest: t.slice(idx + 1).trim() };
}

export type SeverityKey = "critical" | "elevated" | "low";
export type Severity = {
  key: SeverityKey;
  label: string;
  color: string;
  soft: string;
  ring: string;
};

// Concentration-score severity: high score = high exposure (red), low = green.
export function severity(score: number): Severity {
  if (score >= 75)
    return { key: "critical", label: "Critical exposure", color: "#ff5470", soft: "rgba(255,84,112,0.13)", ring: "rgba(255,84,112,0.45)" };
  if (score >= 50)
    return { key: "elevated", label: "Elevated exposure", color: "#ffb020", soft: "rgba(255,176,32,0.13)", ring: "rgba(255,176,32,0.45)" };
  return { key: "low", label: "Contained exposure", color: "#2ee6a6", soft: "rgba(46,230,166,0.13)", ring: "rgba(46,230,166,0.45)" };
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// A neutral one-line description derived strictly from the supplier's real
// category. Deliberately no invented product specifics — the only fields the API
// returns are id/name/country/category/score/spend_share, so the blurb must not
// assert anything beyond the category itself.
export function supplierBlurb(category: string): string {
  return `Supplies ${category.replace(/_/g, " ")} into GCI's production line`;
}

// The four case-study suppliers that have a contract document on file.
export const CONTRACT_IDS = new Set(["SUP-001", "SUP-002", "SUP-003", "SUP-004"]);
export const REFERENCE_CONTRACTS: { id: string; name: string }[] = [
  { id: "SUP-001", name: "Rheinkomp" },
  { id: "SUP-002", name: "Zhejiang Scroll" },
  { id: "SUP-003", name: "Milano Controls" },
  { id: "SUP-004", name: "AlpenHX" },
];
