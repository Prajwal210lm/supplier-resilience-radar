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

// Shared severity colour buckets (red / amber / green), so every threshold scale
// below stays in sync.
const SEV_CRITICAL: Severity = { key: "critical", label: "Critical exposure", color: "#ff5470", soft: "rgba(255,84,112,0.13)", ring: "rgba(255,84,112,0.45)" };
const SEV_ELEVATED: Severity = { key: "elevated", label: "Elevated exposure", color: "#ffb020", soft: "rgba(255,176,32,0.13)", ring: "rgba(255,176,32,0.45)" };
const SEV_LOW: Severity = { key: "low", label: "Contained exposure", color: "#2ee6a6", soft: "rgba(46,230,166,0.13)", ring: "rgba(46,230,166,0.45)" };

// Concentration-score severity for the gauge and brief: high score = high
// exposure (red), low = green.
export function severity(score: number): Severity {
  if (score >= 75) return SEV_CRITICAL;
  if (score >= 50) return SEV_ELEVATED;
  return SEV_LOW;
}

// The case-file score chip uses the stated product cutoffs (red >= 80, amber
// 50-79, green < 50), independent of the gauge/brief severity() scale above.
export function chipSeverity(score: number): Severity {
  if (score >= 80) return SEV_CRITICAL;
  if (score >= 50) return SEV_ELEVATED;
  return SEV_LOW;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// The four — and only four — case-study suppliers that have a contract document
// on file. The remaining 21 suppliers in the dataset have no contract, by design.
export const CONTRACT_IDS = new Set(["SUP-001", "SUP-002", "SUP-003", "SUP-004"]);

// Real supplier metadata (name/country/category come straight from the dataset);
// `note` describes what each contract demonstrates about the analysis layer.
export type ContractEntry = {
  id: string;
  name: string;
  country: string;
  category: string;
  note: string;
};
export const CONTRACT_LIBRARY: ContractEntry[] = [
  {
    id: "SUP-001",
    name: "Rheinkomp Compressors",
    country: "Germany",
    category: "compressors",
    note: "A single-source trap: narrow force majeure, exclusivity lock-in, and no late-delivery penalty.",
  },
  {
    id: "SUP-002",
    name: "Zhejiang Scroll Tech",
    country: "China",
    category: "compressors",
    note: "A dual-source-friendly deal: an explicit right to qualify alternative suppliers.",
  },
  {
    id: "SUP-003",
    name: "Milano Controls Srl",
    country: "Italy",
    category: "controls",
    note: "A buyer-protective contract: broad force majeure and a business-continuity-plan obligation.",
  },
  {
    id: "SUP-004",
    name: "AlpenHX GmbH",
    country: "Germany",
    category: "heat_exchangers",
    note: "A neutral market-standard baseline for comparison.",
  },
];
