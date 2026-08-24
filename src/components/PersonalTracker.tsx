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
  variant: string; fit: string; status: string; updated: string; notes: Note[];
};
type Nudge = { id: string; text: string; kind: "approval" | "hint" };
type Data = { updated: string; profile: Record<string, string>; nudges: Nudge[]; jobs: Job[] };

const STAGES = ["awaiting-approval", "shortlisted", "applied", "interviewing", "offer", "closed"] as const;

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

  useEffect(() => {
    fetch("/personal-data.enc.json")
      .then((r) => r.json())
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
                    <span className="rounded-full border border-line px-2 py-0.5">{j.variant}</span>
                    <span className="text-faint transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
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
    </div>
  );
}
