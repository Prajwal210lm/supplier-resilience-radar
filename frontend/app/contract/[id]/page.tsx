"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Alert, ArrowRight, Doc } from "@/components/icons";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; num: string | null; text: string; id: string | null }
  | { type: "meta"; key: string; value: string }
  | { type: "p"; text: string };

// A small, dependency-free markdown parser for the supplier contracts. Handles
// a title (#), bold key/value meta lines (**Key:** value), numbered clause
// headings (## 2. Force Majeure) → id="clause-2" anchors, and plain paragraphs.
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
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [status]);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-base)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[820px] items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-3.5">
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 font-display text-[0.9rem] font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent-bright)]"
            >
              <ArrowRight size={14} className="rotate-180" />
              All contracts
            </Link>
            <span className="h-4 w-px bg-[var(--color-line-strong)]" />
            <Link
              href="/"
              className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink-2)]"
            >
              Home
            </Link>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
            <Doc size={12} /> Reference contract · {id}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[820px] scroll-smooth px-6 pb-32 sm:px-8">
        {status === "loading" && (
          <p className="mt-24 text-center font-mono text-sm text-[var(--color-ink-3)]">Loading contract…</p>
        )}

        {status === "missing" && (
          <div className="mt-20 rounded-2xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/[0.06] p-7">
            <div className="flex items-center gap-2">
              <Alert size={16} className="text-[var(--color-amber)]" />
              <h1 className="font-display text-xl font-semibold text-[var(--color-ink)]">Contract not available</h1>
            </div>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-[var(--color-ink-2)]">
              No contract is on file for <span className="font-mono text-[var(--color-ink)]">{id}</span> — only the four
              case-study suppliers (SUP-001 to SUP-004) have a contract document.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-20 rounded-2xl border border-[var(--color-crit)]/30 bg-[var(--color-crit)]/[0.06] p-7">
            <div className="flex items-center gap-2">
              <Alert size={16} className="text-[var(--color-crit)]" />
              <h1 className="font-display text-xl font-semibold text-[var(--color-ink)]">Could not load the contract</h1>
            </div>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-[var(--color-ink-2)]">
              The contract service did not respond. The backend endpoint{" "}
              <span className="font-mono text-[var(--color-ink)]">GET /api/contract/{id}</span> may not be available on
              this deployment.
            </p>
          </div>
        )}

        {status === "ok" && blocks && (
          <article className="mt-14">
            {blocks.map((b, i) => {
              if (b.type === "h1") {
                return (
                  <h1 key={i} className="font-display text-[2.2rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--color-ink)]">
                    {b.text}
                  </h1>
                );
              }
              if (b.type === "meta") {
                return (
                  <p key={i} className="mt-1.5 font-mono text-[0.8rem] text-[var(--color-ink-3)]">
                    <span className="text-[var(--color-ink-2)]">{b.key}:</span> {b.value}
                  </p>
                );
              }
              if (b.type === "h2") {
                return (
                  <h2
                    key={i}
                    id={b.id ?? undefined}
                    className="mt-11 scroll-mt-24 border-t border-[var(--color-line)] pt-7 font-display text-[1.45rem] font-semibold text-[var(--color-ink)]"
                  >
                    {b.num ? (
                      <>
                        <span className="font-mono text-[1rem] text-[var(--color-accent)]">{b.num}.</span> {b.text}
                      </>
                    ) : (
                      b.text
                    )}
                  </h2>
                );
              }
              return (
                <p key={i} className="mt-4 text-[1rem] leading-[1.78] text-[var(--color-ink-2)]">
                  {b.text}
                </p>
              );
            })}
          </article>
        )}
      </main>
    </div>
  );
}
