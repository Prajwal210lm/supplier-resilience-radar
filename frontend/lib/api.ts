const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SupplierRow = {
  supplier_id: string;
  name: string;
  country: string;
  category: string;
  concentration_score: number;
  spend_share: number;
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
  const r = await fetch(
    `${BASE}/api/risk-brief/${id}${fresh ? "?fresh=true" : ""}`,
    { method: "POST" }
  );
  if (r.status === 404) throw new Error("supplier not found");
  if (!r.ok) throw new Error("assessment failed");
  return r.json();
}
