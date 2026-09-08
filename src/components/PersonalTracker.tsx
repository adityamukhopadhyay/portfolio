"use client";

import { useEffect, useMemo, useState } from "react";

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
type Lead = {
  id: string; name: string; title?: string; company: string; phone?: string; email?: string; linkedin?: string;
  roleFor?: string; jobUrl?: string; source?: string; confidence?: string; priority?: string; status?: string;
  location?: string; updated?: string; notes?: (Note | string)[];
};
type SyllabusItem = { n: number; title: string; status: string }; // current | pending | done
type Topic = { n: number; title: string; generated?: string; status?: string; md: string };
type Revision = { syllabus: SyllabusItem[]; topics: Topic[]; rule?: string };
type RevProgress = { topic: number; done: boolean; at: string };
type Data = { updated: string; profile: Record<string, string>; nudges: Nudge[]; jobs: Job[]; leads?: Lead[]; rulesLedger?: Rule[]; monitoring?: Mon; revision?: Revision };

const STAGES = ["awaiting-approval", "approved", "shortlisted", "applied", "interviewing", "offer", "needs_user", "held", "closed"] as const;
const LEAD_ORDER = ["to_call", "call_back", "to_email", "called", "emailed", "replied", "no_answer", "name_only", "closed"];
const telHref = (p: string) => "tel:" + p.replace(/[^+\d]/g, "");

async function decrypt(payload: { salt: string; iv: string; ct: string }, pass: string): Promise<Data> {
  const b = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b(payload.salt), iterations: 200000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(payload.iv) }, key, b(payload.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── Revision topics: a minimal Markdown renderer (## / ### headings, paragraphs,
// - and 1. lists, pipe tables with a header row, **bold**, `code`, ---). No
// library: the text is written by Claude sessions into the encrypted tracker.
type Block =
  | { k: "h2" | "h3" | "p"; text: string }
  | { k: "ul" | "ol"; items: string[] }
  | { k: "table"; head: string[]; rows: string[][] }
  | { k: "hr" };
const BLOCK_START = /^(#{2,3}\s|\||\s*[-*]\s|\s*\d+\.\s|\s*(-{3,}|\*{3,})\s*$)/;

function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{2,3})\s+(.*)$/);
    if (h) { out.push({ k: h[1].length === 2 ? "h2" : "h3", text: h[2] }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push({ k: "hr" }); i++; continue; }
    if (l.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\|?\s*:?-{2,}/.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      out.push({ k: "table", head: head ?? [], rows: body });
      continue;
    }
    const listRe = /^\s*[-*]\s+/.test(l) ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+/.test(l) ? /^\s*\d+\.\s+(.*)$/ : null;
    if (listRe) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(listRe);
        if (m) items.push(m[1]);
        else if (!BLOCK_START.test(lines[i])) items[items.length - 1] += " " + lines[i].trim(); // wrapped line
        else break;
        i++;
      }
      out.push({ k: listRe.source.startsWith("^\\s*[-*]") ? "ul" : "ol", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) { para.push(lines[i].trim()); i++; }
    if (para.length) out.push({ k: "p", text: para.join(" ") });
    else i++;
  }
  return out;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 4 && p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        : p.length > 2 && p.startsWith("`") && p.endsWith("`") ? <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-ink">{p.slice(1, -1)}</code>
        : p,
      )}
    </>
  );
}

function Markdown({ lines }: { lines: string[] }) {
  return (
    <div className="text-[13.5px] leading-relaxed text-muted">
      {parseBlocks(lines).map((b, i) => {
        switch (b.k) {
          case "h2": return <h3 key={i} className="mt-1 text-[17px] font-bold tracking-tight text-ink"><Inline text={b.text} /></h3>;
          case "h3": return <h4 key={i} className="mt-5 text-[14.5px] font-semibold text-ink"><Inline text={b.text} /></h4>;
          case "p": return <p key={i} className="mt-2"><Inline text={b.text} /></p>;
          case "ul": return (
            <ul key={i} className="mt-2 space-y-1.5">
              {b.items.map((it, j) => <li key={j} className="flex gap-2.5"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-faint" /><span><Inline text={it} /></span></li>)}
            </ul>
          );
          case "ol": return (
            <ol key={i} className="mt-2 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-[11px] marker:text-faint">
              {b.items.map((it, j) => <li key={j} className="pl-1"><Inline text={it} /></li>)}
            </ol>
          );
          case "table": return (
            <div key={i} className="mt-3 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[520px] border-collapse text-[13px]">
                <thead><tr>{b.head.map((c, j) => <th key={j} className="border-b border-line bg-surface-2 px-3 py-2 text-left font-semibold text-ink"><Inline text={c} /></th>)}</tr></thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="border-b border-line px-3 py-2 align-top"><Inline text={c} /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
          );
          case "hr": return <hr key={i} className="my-5 border-line" />;
        }
      })}
    </div>
  );
}

// Split a topic into body + self-check questions + short answers (matched by number).
const H_SELF = /^#{2,3}\s+(?:[\d.]+\s+)?self-check/i;
const H_ANS = /^#{2,3}\s+(?:[\d.]+\s+)?short answers/i;
function numbered(lines: string[]) {
  const items: { n: number; text: string }[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*(\d+)\.\s+(.*)$/);
    if (m) items.push({ n: +m[1], text: m[2] });
    else if (l.trim() && items.length) items[items.length - 1].text += " " + l.trim();
  }
  return items;
}
function splitTopic(md: string) {
  const lines = md.replace(/\r/g, "").split("\n");
  const nextHeading = (from: number) => { const j = lines.findIndex((l, idx) => idx > from && /^#{2,3}\s/.test(l)); return j < 0 ? lines.length : j; };
  const sc = lines.findIndex((l) => H_SELF.test(l));
  const sa = lines.findIndex((l) => H_ANS.test(l));
  if (sc < 0) return { body: lines, heading: "", questions: [] as { n: number; text: string }[], answers: [] as { n: number; text: string }[] };
  const cut = new Set<number>();
  for (let i = sc; i < nextHeading(sc); i++) cut.add(i);
  if (sa >= 0) for (let i = sa; i < nextHeading(sa); i++) cut.add(i);
  return {
    body: lines.filter((_, i) => !cut.has(i)),
    heading: lines[sc].replace(/^#+\s+/, ""),
    questions: numbered(lines.slice(sc + 1, nextHeading(sc))),
    answers: sa < 0 ? [] : numbered(lines.slice(sa + 1, nextHeading(sa))),
  };
}

function TopicBody({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const { body, heading, questions, answers } = useMemo(() => splitTopic(topic.md), [topic.md]);
  return (
    <>
      <Markdown lines={body} />
      {questions.length ? (
        <div className="mt-5 rounded-lg border border-line bg-surface-2/60 px-4 py-3.5">
          <h4 className="text-[14.5px] font-semibold text-ink"><Inline text={heading} /></h4>
          <ol className="mt-2 space-y-2.5 text-[13.5px] leading-relaxed text-muted">
            {questions.map((q) => {
              const a = answers.find((x) => x.n === q.n)?.text;
              return (
                <li key={q.n} className="flex gap-2.5">
                  <span className="mt-[2px] font-mono text-[11px] text-faint">{q.n}.</span>
                  <div className="min-w-0 flex-1">
                    <span><Inline text={q.text} /></span>
                    {a ? (
                      <button onClick={() => setOpen((o) => ({ ...o, [q.n]: !o[q.n] }))} className="ml-2 font-mono text-[10.5px] text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                        {open[q.n] ? "hide answer" : "show answer"}
                      </button>
                    ) : null}
                    {a && open[q.n] ? <p className="mt-1.5 border-l-2 border-accent/40 pl-3 text-ink"><Inline text={a} /></p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </>
  );
}

export function PersonalTracker() {
  const [enc, setEnc] = useState<{ salt: string; iv: string; ct: string } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dec, setDec] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [prog, setProg] = useState<RevProgress | null>(null);
  const [revCopied, setRevCopied] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { setDec(JSON.parse(localStorage.getItem("personal-decisions") ?? "{}")); } catch {}
      try { setProg(JSON.parse(localStorage.getItem("revision-progress") ?? "null")); } catch {}
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
  function toggleTopicDone(n: number) {
    const next: RevProgress | null = prog?.done && prog.topic === n ? null : { topic: n, done: true, at: new Date().toISOString() };
    setProg(next);
    try {
      if (next) localStorage.setItem("revision-progress", JSON.stringify(next));
      else localStorage.removeItem("revision-progress");
    } catch {}
  }
  async function generateNextTopic(cur: Topic, next: SyllabusItem) {
    // The site is static: this only copies the request. Claude Code generates
    // the topic into revision/REVISION.md + tracker.revision; it shows after sync.
    const txt = `Revision: topic ${cur.n} (${cur.title}) done. Generate topic ${next.n} (${next.title}) into revision/REVISION.md and tracker.revision, with short answers.`;
    if (!(prog?.done && prog.topic === cur.n)) toggleTopicDone(cur.n);
    try { await navigator.clipboard.writeText(txt); setRevCopied(true); setTimeout(() => setRevCopied(false), 3000); } catch {}
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
  const rev = data.revision;
  const curTopic = rev?.topics.find((t) => t.status === "current") ?? (rev?.topics.length ? rev.topics[rev.topics.length - 1] : undefined);
  const doneTopics = rev && curTopic ? rev.topics.filter((t) => t !== curTopic && (t.status === "done" || t.n < curTopic.n)).sort((a, b) => b.n - a.n) : [];
  const nextItem = rev && curTopic ? rev.syllabus.find((s) => s.n === curTopic.n + 1) : undefined;
  const curDone = !!(curTopic && prog?.done && prog.topic === curTopic.n);

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

      {/* leads — people to call */}
      {data.leads?.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            leads to call <span className="text-faint">· {data.leads.length} · phone first, then email</span>
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {[...data.leads]
              .sort((a, b) => LEAD_ORDER.indexOf(a.status ?? "to_call") - LEAD_ORDER.indexOf(b.status ?? "to_call") || (a.phone ? 0 : 1) - (b.phone ? 0 : 1))
              .map((l) => (
                <details key={l.id} className="group px-5 py-3.5">
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-semibold text-ink">{l.name}</span>
                    <span className="text-[13px] text-muted">{l.title ? `${l.title} · ` : ""}{l.company}</span>
                    {l.phone ? <a onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] text-accent underline decoration-accent/40 underline-offset-2" href={telHref(l.phone)}>{l.phone}</a> : null}
                    {l.email ? <a onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] text-accent underline decoration-accent/40 underline-offset-2" href={`mailto:${l.email}`}>{l.email}</a> : null}
                    <span className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-faint">
                      <span className="rounded-full border border-line px-2 py-0.5">{l.status ?? "to_call"}</span>
                      {l.confidence ? <span>{l.confidence}</span> : null}
                      <span className="text-faint transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted">
                    {l.roleFor ? <p><span className="text-ink">Role:</span> {l.roleFor}{l.location ? ` · ${l.location}` : ""}</p> : null}
                    <p>
                      {l.jobUrl ? <a className="text-accent underline decoration-accent/40 underline-offset-2" href={l.jobUrl} target="_blank" rel="noreferrer">job posting ↗</a> : null}
                      {l.linkedin ? <> {l.jobUrl ? "· " : ""}<a className="text-accent underline decoration-accent/40 underline-offset-2" href={l.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></> : null}
                      {l.source ? <span className="text-faint"> · source: {l.source}</span> : null}
                    </p>
                    {l.notes?.length ? (
                      <ul className="space-y-1 border-l border-line pl-3">
                        {l.notes.map((n, i) => (
                          <li key={i}>{typeof n === "string" ? n : <><span className="font-mono text-[10.5px] text-faint">{new Date(n.t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span> — {n.note}</>}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              ))}
          </div>
        </section>
      ) : null}

      {/* revision — one interview-prep topic at a time; generation happens in Claude Code */}
      {rev && curTopic ? (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            revision <span className="text-faint">· topic {curTopic.n} of {rev.syllabus.length} · {rev.syllabus.filter((s) => s.status === "done").length} done</span>
          </h2>
          <div className="rounded-xl border border-line bg-surface">
            {/* syllabus */}
            <details className="group px-5 py-3.5" open>
              <summary className="flex cursor-pointer list-none items-baseline font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint [&::-webkit-details-marker]:hidden">
                syllabus · {rev.syllabus.length} topics
                <span className="ml-auto normal-case tracking-normal transition-transform group-open:rotate-45">+</span>
              </summary>
              <ol className="mt-3 space-y-1.5 text-[13px]">
                {rev.syllabus.map((s) => {
                  const local = !!(prog?.done && prog.topic === s.n && s.status !== "done");
                  return (
                    <li key={s.n} className="flex items-baseline gap-2.5">
                      <span className="w-5 shrink-0 font-mono text-[10.5px] text-faint">{String(s.n).padStart(2, "0")}</span>
                      <span className={s.status === "current" ? "font-semibold text-ink" : s.status === "done" ? "text-faint" : "text-muted"}>{s.title}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${local ? "border-warn/40 bg-warn-soft text-warn" : s.status === "current" ? "border-accent/40 bg-accent-soft text-accent" : s.status === "done" ? "border-line text-muted" : "border-line text-faint"}`}>
                        {local ? "done here · awaiting sync" : s.status}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </details>

            {/* current topic */}
            <div className="border-t border-line px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-faint">
                <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-accent">current</span>
                <span>topic {curTopic.n}{curTopic.generated ? ` · generated ${curTopic.generated}` : ""}</span>
                {curDone && prog ? <span className="rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-warn">marked done on this device · {new Date(prog.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span> : null}
              </div>
              <div className="mt-3"><TopicBody topic={curTopic} /></div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleTopicDone(curTopic.n)}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${curDone ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:border-rule hover:text-ink"}`}
                >
                  {curDone ? `Topic ${curTopic.n} done ✓` : `Mark topic ${curTopic.n} done`}
                </button>
                <button
                  onClick={() => nextItem && generateNextTopic(curTopic, nextItem)}
                  disabled={!nextItem}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-ink disabled:opacity-50"
                >
                  {revCopied ? "Copied — paste to Claude Code" : nextItem ? "Generate next topic" : "Syllabus complete"}
                </button>
              </div>
              <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-faint">
                This site is static: “Generate next topic” copies the request; generation runs in Claude Code, which writes the topic into revision/REVISION.md and the tracker, and it appears here after the next sync.
              </p>
            </div>

            {/* previously done topics */}
            {doneTopics.map((t) => (
              <details key={t.n} className="group border-t border-line px-5 py-3.5">
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
                  <span className="text-[14px] font-semibold text-ink">Topic {t.n} — {t.title}</span>
                  <span className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-faint">
                    <span className="rounded-full border border-line px-2 py-0.5">done</span>
                    {t.generated ? <span>{t.generated}</span> : null}
                    <span className="transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <div className="mt-3"><TopicBody topic={t} /></div>
              </details>
            ))}
          </div>
          {rev.rule ? <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-faint">{rev.rule}</p> : null}
        </section>
      ) : null}

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
