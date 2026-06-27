const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FRESH_SECRET = process.env.NEXT_PUBLIC_FRESH_SECRET || "";

export type SupplierRow = {
  supplier_id: string;
  name: string;
  country: string;
  category: string;
  concentration_score: number;
  spend_share: number;
  description: string;
};

export type Claim = { text: string; citations: string[] };

export type RiskBriefResponse = {
  supplier_id: string;
  supplier_name: string;
  profile: {
    spend_share: number;
    spend_share_display: string;
    skus_single_sourced: number;
    line_down_gap_weeks: number;
    concentration_score: number;
  };
  brief: null | {
    concentration_profile: Claim[];
    risk_signals: Claim[];
    contract_implications: Claim[];
    recommended_actions: Claim[];
    confidence: string[];
  };
  violations: string[];
  meta: {
    turns: number;
    forced: boolean;
    dropped_findings: number;
    cached: boolean;
    generated_at: string;
  };
};

export async function getSuppliers(): Promise<SupplierRow[]> {
  const r = await fetch(`${BASE}/api/suppliers`);
  if (!r.ok) throw new Error("failed to load suppliers");
  return r.json();
}

export async function runRiskBrief(
  id: string,
  fresh: boolean
): Promise<RiskBriefResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (fresh && FRESH_SECRET) headers["x-api-secret"] = FRESH_SECRET;
  const r = await fetch(
    `${BASE}/api/risk-brief/${id}${fresh ? "?fresh=true" : ""}`,
    { method: "POST", headers }
  );
  if (r.status === 401) throw new Error("Live research is not available on this deployment.");
  if (r.status === 404) throw new Error("supplier not found");
  if (!r.ok) throw new Error("assessment failed");
  return r.json();
}

// One-line plain-English summaries of each contract clause, keyed by clause
// number (string). Returns null when the supplier has no contract on file (404).
export type ClauseSummaries = Record<string, string>;

export async function getClauseSummary(id: string): Promise<ClauseSummaries | null> {
  const r = await fetch(`${BASE}/api/clause-summary/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("failed to load clause summaries");
  const data = await r.json();
  return (data.clauses ?? null) as ClauseSummaries | null;
}
