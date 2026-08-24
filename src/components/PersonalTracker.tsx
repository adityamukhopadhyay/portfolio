"use client";

import { useEffect, useState } from "react";

// Private ops console at /personal. The payload ships encrypted (AES-256-GCM,
// PBKDF2 key) because this repo and site are public; the passphrase lives with
// Aditya and unlocks client-side. Data is written by Claude sessions and served
// statically — always the last deployed state.

type Note = { t: string; note: string };
type Job = {
  id: string; title: string; company: string; loc: string; posted: string;
  applyType: string; applyUrl?: string; url: string; score?: number;
  mailConfirmed?: { by: string; at: string; seen: string }; rulesApplied?: string[];
  variant: string; fit: string; status: string; updated: string; notes: Note[];
};
type Nudge = { id: string; text: string; kind: "approval" | "hint" };
type Rule = { rule: string; status: string };
type Mon = { lastChecked: string; source: string; cadence: string; confirmedMails: number };
type Data = { updated: string; profile: Record<string, string>; nudges: Nudge[]; jobs: Job[]; rulesLedger?: Rule[]; monitoring?: Mon };

const STAGES = ["awaiting-approval", "approved", "shortlisted", "applied", "interviewing", "offer", "closed"] as const;

async function decrypt(payload: { salt: string; iv: string; ct: string }, pass: string): Promise<Data> {
  const b = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b(payload.salt), iterations: 200000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(payload.iv) }, key, b(payload.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

export function PersonalTracker() {
  const [enc, setEnc] = useState<{ salt: string; iv: string; ct: string } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dec, setDec] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { setDec(JSON.parse(localStorage.getItem("personal-decisions") ?? "{}")); } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    // Read data from GitHub raw first (updates via `git push`, no Vercel deploy),
    // falling back to the deployed copy. This keeps the dashboard live even when
    // the Vercel free-tier daily deploy cap is hit.
    const RAW = "https://raw.githubusercontent.com/adityamukhopadhyay/portfolio/main/public/personal-data.enc.json";
    fetch(`${RAW}?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .catch(() => fetch(`/personal-data.enc.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()))
      .then((p) => p)
      .then((p) => {
        setEnc(p);
        let stored: string | null = null;
        try { stored = localStorage.getItem("personal-key"); } catch {}
        if (stored) decrypt(p, stored).then(setData).catch(() => {});
      })
      .catch(() => setErr("no data file"));
  }, []);

  async function unlock() {
    if (!enc) return;
    setBusy(true); setErr("");
    try {
      const d = await decrypt(enc, pass.trim());
      setData(d);
      try { localStorage.setItem("personal-key", pass.trim()); } catch {}
    } catch {
      setErr("wrong passphrase");
    }
    setBusy(false);
  }
  function decide(id: string, v: string) {
    setDec((prev) => {
      const n = { ...prev };
      if (n[id] === v) delete n[id];
      else n[id] = v;
      try { localStorage.setItem("personal-decisions", JSON.stringify(n)); } catch {}
      return n;
    });
  }
  async function copyDecisions() {
    const groups: Record<string, string[]> = {};
    for (const [id, v] of Object.entries(dec)) (groups[v] ??= []).push(id);
    const txt = `DECISIONS ${new Date().toISOString().slice(0, 16)} — ` +
      Object.entries(groups).map(([v, ids]) => `${v}: ${ids.join(", ")}`).join(" · ");
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  function lock() {
    try { localStorage.removeItem("personal-key"); } catch {}
    setData(null); setPass("");
  }

  if (!data)
    return (
      <div className="mx-auto max-w-sm py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">private</p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="passphrase"
          className="mt-6 w-full rounded-md border border-line bg-surface px-4 py-2.5 text-center font-mono text-sm text-ink outline-none focus:border-accent"
          autoFocus
        />
        <button onClick={unlock} disabled={busy || !pass} className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
          {busy ? "…" : "Unlock"}
        </button>
        {err ? <p className="mt-3 font-mono text-[12px] text-warn">{err}</p> : null}
      </div>
    );

  const byStage = (s: string) => data.jobs.filter((j) => j.status === s);

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Job ops</h1>
        <div className="flex items-center gap-3 font-mono text-[11px] text-faint">
          <span>last updated {new Date(data.updated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
          <button onClick={lock} className="rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">lock</button>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {data.profile.mode} · notice: {data.profile.notice} · CTC when forced: {data.profile.ctcWhenForced}. Updated automatically by Claude sessions; this page always serves the last deployed state.
      </p>

      {/* monitoring strip */}
      {data.monitoring ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-3 text-[12.5px] text-muted">
          <span className="flex items-center gap-2"><span className="live-dot" /> Monitoring active</span>
          <span>last checked {new Date(data.monitoring.lastChecked).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
          <span>{data.monitoring.confirmedMails} confirmation mails seen</span>
          <span className="text-faint">source: {data.monitoring.source}</span>
        </div>
      ) : null}

      {/* rules ledger */}
      {data.rulesLedger?.length ? (
        <details className="mt-4 rounded-xl border border-line bg-surface px-5 py-3" open>
          <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Rules applied to every application</summary>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
            {data.rulesLedger.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{r.rule} <span className="font-mono text-[10.5px] text-faint">· {r.status}</span></span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* nudges — the human-in-the-loop queue */}
      <div className="mt-8 grid gap-3 lg:grid-cols-3">
        {data.nudges.map((n) => (
          <div key={n.id} className={`rounded-xl border p-4 text-[13.5px] leading-relaxed ${n.kind === "approval" ? "border-accent/40 bg-accent-soft/50 text-ink" : "border-line bg-surface text-muted"}`}>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{n.kind === "approval" ? "needs you" : "the automation can"}</div>
            {n.text}
          </div>
        ))}
      </div>

      {/* board */}
      {STAGES.filter((s) => byStage(s).length).map((s) => (
        <section key={s} className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {s.replace("-", " ")} <span className="text-faint">· {byStage(s).length}</span>
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {byStage(s).map((j) => (
              <details key={j.id} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 [&::-webkit-details-marker]:hidden">
                  <span className="text-[15px] font-semibold text-ink">{j.title}</span>
                  <span className="text-[13px] text-muted">{j.company} · {j.loc}</span>
                  <span className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-faint">
                    <span>{j.applyType}</span>
                    {j.mailConfirmed ? <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-accent">✉ confirmed {j.mailConfirmed.at}</span> : null}
                    <span className="rounded-full border border-line px-2 py-0.5">{j.variant}</span>
                    <span className="text-faint transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["approve", "hold", "skip"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={(e) => { e.preventDefault(); decide(j.id, v); }}
                        className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${dec[j.id] === v ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:border-rule hover:text-ink"}`}
                      >
                        {v}
                      </button>
                    ))}
                    <span className="font-mono text-[10.5px] text-faint">decisions save on this device; copy below to send to Claude</span>
                  </div>
                  <p><span className="text-ink">Why:</span> {j.fit}</p>
                  <p>
                    <a className="text-accent underline decoration-accent/40 underline-offset-2" href={j.url} target="_blank" rel="noreferrer">posting ↗</a>
                    {j.applyUrl ? <> · <a className="text-accent underline decoration-accent/40 underline-offset-2" href={j.applyUrl} target="_blank" rel="noreferrer">apply link ↗</a></> : null}
                    {" "}· posted {j.posted} · match score {j.score ?? "—"}
                  </p>
                  <ul className="space-y-1 border-l border-line pl-3">
                    {j.notes.map((n, i) => (
                      <li key={i}><span className="font-mono text-[10.5px] text-faint">{new Date(n.t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span> — {n.note}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      {Object.keys(dec).length ? (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-fit rounded-full border border-line bg-surface px-4 py-2 shadow-2xl">
          <span className="mr-3 font-mono text-[11.5px] text-muted">{Object.keys(dec).length} decision{Object.keys(dec).length > 1 ? "s" : ""}</span>
          <button onClick={copyDecisions} className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-ink">
            {copied ? "Copied ✓ — paste to Claude" : "Copy decisions for Claude"}
          </button>
          <button onClick={() => { setDec({}); try { localStorage.removeItem("personal-decisions"); } catch {} }} className="ml-2 font-mono text-[11px] text-faint hover:text-ink">clear</button>
        </div>
      ) : null}
    </div>
  );
}
