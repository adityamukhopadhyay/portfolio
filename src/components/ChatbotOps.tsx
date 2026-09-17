"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

// Live console for the Ask-about-Aditya chatbot: who asked what over the last 7 days, and who booked a call.
// Reads from the API with a READ-ONLY dashboard token held in localStorage — nothing secret ships in the bundle,
// and the token cannot trigger ingests, warms or any write.

const API = process.env.NEXT_PUBLIC_RAG_API_URL ?? "https://rag-api-production-5a59.up.railway.app";
const KEY = "rag-dash-key";

type Who = { name?: string; email?: string; phone?: string; company?: string };
type Q = { ts: string; question: string; pipeline: string; cached: boolean; precomputed: boolean; uid: string; latency_ms: number | null; answer_preview: string; sources: string[]; who?: Who };
type Summary = { days: number; total: number; live: number; cached: number; unique_visitors: number; identified: number; who_asked: (Who & { questions: number; last: string })[]; by_day: Record<string, number>; top_questions: { question: string; count: number }[] };
type Booking = { ts: string; name: string; email: string; company?: string | null; note?: string | null; when: { local: string; ist: string; tz: string }; delivery?: { ok?: boolean } };

const fmt = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const who1 = (w?: Who) => (w ? [w.name, w.company].filter(Boolean).join(" · ") || w.email || w.phone || "" : "");

export function ChatbotOps() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sum, setSum] = useState<Summary | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [tab, setTab] = useState<"questions" | "people" | "bookings">("questions");

  useEffect(() => { try { const k = localStorage.getItem(KEY); if (k) setKey(k); } catch {} }, []);

  const load = useCallback(async (k: string) => {
    setBusy(true); setErr(null);
    try {
      const h = { Authorization: `Bearer ${k}` };
      const [rq, rb] = await Promise.all([
        fetch(`${API}/admin/questions?days=7`, { headers: h }),
        fetch(`${API}/admin/bookings`, { headers: h }),
      ]);
      if (rq.status === 401) { setErr("That key was rejected."); setBusy(false); return false; }
      const dq = await rq.json();
      setSum(dq.summary); setQs(dq.questions ?? []);
      if (rb.ok) setBookings((await rb.json()).bookings ?? []);
      setBusy(false); return true;
    } catch { setErr("Couldn't reach the API."); setBusy(false); return false; }
  }, []);

  useEffect(() => { if (key) load(key); }, [key, load]);

  if (!key)
    return (
      <section className="mt-16 border-t border-line pt-10">
        <h2 className="text-[20px] font-bold tracking-tight text-ink">Chatbot</h2>
        <p className="mt-1 max-w-xl text-[13px] text-muted">Who has been asking the assistant on <code className="font-mono text-[12px]">/ask</code>, and who booked a call. Paste the read-only dashboard key once — it stays in this browser.</p>
        <div className="mt-4 flex max-w-md gap-2">
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="dashboard key" autoComplete="off"
                 onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { const k = input.trim(); load(k).then((ok) => { if (ok) { setKey(k); try { localStorage.setItem(KEY, k); } catch {} } }); } }}
                 className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-accent" />
          <button onClick={() => { const k = input.trim(); if (k) load(k).then((ok) => { if (ok) { setKey(k); try { localStorage.setItem(KEY, k); } catch {} } }); }}
                  disabled={!input.trim() || busy} className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-40">{busy ? "…" : "Open"}</button>
        </div>
        {err && <p className="mt-2 font-mono text-[12px] text-warn">{err}</p>}
      </section>
    );

  const maxDay = Math.max(1, ...Object.values(sum?.by_day ?? { x: 1 }));
  const tabs: [typeof tab, string, number][] = [["questions", "Questions", qs.length], ["people", "Who asked", sum?.identified ?? 0], ["bookings", "Calls booked", bookings.length]];

  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-bold tracking-tight text-ink">Chatbot</h2>
        <div className="flex items-center gap-3 font-mono text-[11px] text-faint">
          <span>last {sum?.days ?? 7} days · live from the API</span>
          <button onClick={() => key && load(key)} className="rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">{busy ? "…" : "refresh"}</button>
          <button onClick={() => { setKey(null); setSum(null); setQs([]); try { localStorage.removeItem(KEY); } catch {} }} className="rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink">lock</button>
        </div>
      </div>
      {err && <p className="mt-2 font-mono text-[12px] text-warn">{err}</p>}

      {/* headline strip */}
      {sum && (
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4">
          {[[sum.total, "questions"], [sum.live, "live"], [sum.cached, "from cache"], [sum.unique_visitors, "visitors"], [sum.identified, "said who they are"], [bookings.length, "calls booked"]].map(([n, l]) => (
            <div key={String(l)}><div className="text-[22px] font-bold leading-none text-ink">{n as number}</div><div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{l as string}</div></div>
          ))}
          {Object.keys(sum.by_day).length > 0 && (
            <div className="ml-auto flex items-end gap-1" title="questions per day">
              {Object.entries(sum.by_day).map(([d, n]) => (
                <div key={d} className="flex flex-col items-center gap-1">
                  <div className="w-4 rounded-sm bg-accent/70" style={{ height: `${Math.max(4, (n / maxDay) * 40)}px` }} />
                  <span className="font-mono text-[9px] text-faint">{d.slice(8)}</span>
                </div>))}
            </div>)}
        </div>
      )}

      {/* tabs */}
      <div className="mt-5 flex gap-1">
        {tabs.map(([t, label, n]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${tab === t ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}>
            {label} <span className="font-mono text-[10.5px] text-faint">{n}</span>
          </button>))}
      </div>

      {tab === "questions" && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {qs.length === 0 ? <p className="px-4 py-6 text-[13px] text-faint">No questions in the window yet.</p> : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface text-faint"><tr>
                <th className="px-3 py-2 text-left font-normal">when</th><th className="px-3 py-2 text-left font-normal">who</th>
                <th className="px-3 py-2 text-left font-normal">question</th><th className="px-3 py-2 text-right font-normal">time</th></tr></thead>
              <tbody>
                {qs.map((q, i) => (
                  <Fragment key={i}>
                    <tr onClick={() => setOpenRow(openRow === i ? null : i)} className="cursor-pointer border-t border-line/60 hover:bg-surface/60">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-faint">{fmt(q.ts)}</td>
                      <td className="px-3 py-2">{q.who ? <span className="text-ink">{who1(q.who)}</span> : <span className="font-mono text-[11px] text-faint">{q.uid}</span>}</td>
                      <td className="px-3 py-2 text-ink">{q.question}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] text-muted">{q.cached ? <span className="text-accent">cache</span> : `${q.latency_ms} ms`}</td>
                    </tr>
                    {openRow === i && (
                      <tr className="border-t border-line/40 bg-bg/50">
                        <td colSpan={4} className="px-3 py-3">
                          <div className="text-[12.5px] leading-relaxed text-muted">{q.answer_preview}…</div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
                            <span>pipeline {q.pipeline.toUpperCase()}</span>
                            {q.precomputed && <span className="text-accent">pre-drafted</span>}
                            {q.sources?.length > 0 && <span>sources: {q.sources.join(", ")}</span>}
                            {q.who?.email && <a className="text-accent" href={`mailto:${q.who.email}`}>{q.who.email}</a>}
                            {q.who?.phone && <span>{q.who.phone}</span>}
                          </div>
                        </td>
                      </tr>)}
                  </Fragment>))}
              </tbody>
            </table>)}
        </div>
      )}

      {tab === "people" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(sum?.who_asked ?? []).length === 0 ? <p className="text-[13px] text-faint">Nobody has shared their details yet.</p> :
            sum!.who_asked.map((w, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-4">
                <div className="text-[14px] font-semibold text-ink">{w.name ?? "(no name)"}</div>
                {w.company && <div className="text-[12.5px] text-muted">{w.company}</div>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px]">
                  {w.email && <a href={`mailto:${w.email}`} className="text-accent hover:underline">{w.email}</a>}
                  {w.phone && <a href={`tel:${w.phone.replace(/[^+\d]/g, "")}`} className="text-accent hover:underline">{w.phone}</a>}
                </div>
                <div className="mt-2 font-mono text-[10.5px] text-faint">{w.questions} question{w.questions === 1 ? "" : "s"} · last {fmt(w.last)}</div>
              </div>))}
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-3 space-y-2">
          {bookings.length === 0 ? <p className="text-[13px] text-faint">No calls booked yet.</p> :
            [...bookings].reverse().map((b, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[14px] font-semibold text-ink">{b.name}{b.company ? <span className="font-normal text-muted"> · {b.company}</span> : null}</div>
                  <div className="font-mono text-[11px] text-faint">requested {fmt(b.ts)}{b.delivery?.ok === false && <span className="text-warn"> · email failed</span>}</div>
                </div>
                <div className="mt-1 text-[13px] text-ink">{b.when.ist}{b.when.tz !== "Asia/Kolkata" && <span className="text-muted"> · their time {b.when.local} ({b.when.tz})</span>}</div>
                {b.note && <div className="mt-1.5 text-[12.5px] text-muted">“{b.note}”</div>}
                <a href={`mailto:${b.email}`} className="mt-2 inline-block font-mono text-[11.5px] text-accent hover:underline">{b.email}</a>
              </div>))}
        </div>
      )}

      {/* top questions */}
      {sum && sum.top_questions.length > 0 && tab === "questions" && (
        <div className="mt-5">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Asked most</div>
          <div className="flex flex-wrap gap-1.5">
            {sum.top_questions.slice(0, 10).map((t) => (
              <span key={t.question} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] text-muted">
                {t.question} {t.count > 1 && <span className="font-mono text-[10.5px] text-accent">×{t.count}</span>}
              </span>))}
          </div>
        </div>
      )}
    </section>
  );
}
