"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const NAVY = "#1B2A4A";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; num: string | null; text: string; id: string | null }
  | { type: "meta"; key: string; value: string }
  | { type: "p"; text: string };

// A small, dependency-free markdown parser for the supplier contracts. Handles
// the shapes these documents actually use: a title (#), bold key/value meta
// lines (**Key:** value), numbered clause headings (## 2. Force Majeure) which
// receive id="clause-2" anchors, and plain paragraphs.
function parseContract(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      const rest = line.slice(3).trim();
      const m = rest.match(/^(\d+)\.\s+(.*)$/);
      if (m) blocks.push({ type: "h2", num: m[1], text: m[2], id: `clause-${m[1]}` });
      else blocks.push({ type: "h2", num: null, text: rest, id: null });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
    } else {
      const meta = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
      if (meta) {
        flush();
        blocks.push({ type: "meta", key: meta[1], value: meta[2] });
      } else {
        para.push(line);
      }
    }
  }
  flush();
  return blocks;
}

export default function ContractPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [loaded, setLoaded] = useState<{
    id: string;
    status: "ok" | "missing" | "error";
    blocks: Block[] | null;
  }>({ id: "", status: "error", blocks: null });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`${BASE}/api/contract/${id}`)
      .then(async (r) => {
        if (r.status === 404) return { missing: true as const };
        if (!r.ok) throw new Error(String(r.status));
        // Accept either raw markdown text or { markdown | content | text } JSON.
        const body = await r.text();
        let md = body;
        try {
          const j = JSON.parse(body);
          md = j.markdown ?? j.content ?? j.text ?? body;
        } catch {
          /* body was raw markdown, not JSON */
        }
        return { md };
      })
      .then((res) => {
        if (cancelled) return;
        if ("missing" in res) setLoaded({ id, status: "missing", blocks: null });
        else setLoaded({ id, status: "ok", blocks: parseContract(res.md) });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id, status: "error", blocks: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Loading until the fetched data is for the current id (avoids a sync setState
  // in the effect while still resetting when the contract id changes).
  const ready = id !== "" && loaded.id === id;
  const status: "loading" | "ok" | "missing" | "error" = ready ? loaded.status : "loading";
  const blocks = ready ? loaded.blocks : null;

  // Once content is rendered, honour a #clause-N hash by scrolling to it.
  useEffect(() => {
    if (status !== "ok") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status]);

  return (
    <main className="mx-auto w-full max-w-[760px] scroll-smooth px-6 pb-28 sm:px-8">
      <div className="flex items-center justify-between border-b border-slate-200 py-5">
        <Link href="/" className="font-display text-sm font-semibold tracking-tight transition-colors hover:opacity-70" style={{ color: NAVY }}>
          ← Supplier Resilience Radar
        </Link>
        <span className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-slate-400">
          Reference Contract · {id}
        </span>
      </div>

      {status === "loading" && (
        <p className="mt-20 text-center font-sans text-sm text-slate-400">Loading contract…</p>
      )}

      {status === "missing" && (
        <div className="mt-16 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="font-display text-xl font-semibold" style={{ color: NAVY }}>Contract not available</h1>
          <p className="mt-2 font-sans text-[0.92rem] leading-relaxed text-slate-700">
            No contract is on file for <span className="font-mono">{id}</span> — only the four
            case-study suppliers (SUP-001 to SUP-004) have a contract document.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-16 rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-display text-xl font-semibold text-red-800">Could not load the contract</h1>
          <p className="mt-2 font-sans text-[0.92rem] leading-relaxed text-slate-700">
            The contract service did not respond. The backend endpoint{" "}
            <span className="font-mono">GET /api/contract/{id}</span> may not be available on this
            deployment.
          </p>
        </div>
      )}

      {status === "ok" && blocks && (
        <article className="mt-12">
          {blocks.map((b, i) => {
            if (b.type === "h1") {
              return (
                <h1 key={i} className="font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.01em]" style={{ color: NAVY }}>
                  {b.text}
                </h1>
              );
            }
            if (b.type === "meta") {
              return (
                <p key={i} className="mt-1 font-sans text-[0.85rem] text-slate-500">
                  <span className="font-semibold text-slate-600">{b.key}:</span> {b.value}
                </p>
              );
            }
            if (b.type === "h2") {
              return (
                <h2
                  key={i}
                  id={b.id ?? undefined}
                  className="mt-10 scroll-mt-24 border-t border-slate-100 pt-7 font-display text-[1.45rem] font-semibold"
                  style={{ color: NAVY }}
                >
                  {b.num ? (
                    <>
                      <span className="text-slate-300">{b.num}.</span> {b.text}
                    </>
                  ) : (
                    b.text
                  )}
                </h2>
              );
            }
            return (
              <p key={i} className="mt-4 font-sans text-[1rem] leading-[1.75] text-slate-700">
                {b.text}
              </p>
            );
          })}
        </article>
      )}
    </main>
  );
}
