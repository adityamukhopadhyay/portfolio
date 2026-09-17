"use client";

import { useEffect, useState } from "react";
import { API, Glyph, IconButton } from "./AskWidget";

export type Who = { name?: string; email?: string; phone?: string; company?: string };

function clientId(): string {
  try { let v = localStorage.getItem("ask.cid"); if (!v) { v = crypto.randomUUID(); localStorage.setItem("ask.cid", v); } return v; } catch { return "anon"; }
}

/** Shared state: who the visitor said they are, and whether they've waved the prompt away. */
export function useWho() {
  const [who, setWho] = useState<Who | null>(null);
  const [dismissed, setDismissed] = useState(true);   // assume dismissed until localStorage says otherwise
  useEffect(() => {
    try {
      const w = localStorage.getItem("ask.who");
      if (w) setWho(JSON.parse(w));
      setDismissed(localStorage.getItem("ask.who.dismissed") === "1" || !!w);
    } catch { /* private mode */ }
  }, []);
  const save = (w: Who | null) => {
    setWho(w);
    try { w ? localStorage.setItem("ask.who", JSON.stringify(w)) : localStorage.removeItem("ask.who"); } catch {}
  };
  const dismiss = () => { setDismissed(true); try { localStorage.setItem("ask.who.dismissed", "1"); } catch {} };
  return { who, save, dismissed, dismiss };
}

/** The form itself — used inline under the thread and inside the header popover. */
export function WhoForm({ who, onSaved, onSkip, compact }: { who: Who | null; onSaved: (w: Who) => void; onSkip?: () => void; compact?: boolean }) {
  const [name, setName] = useState(who?.name ?? "");
  const [contact, setContact] = useState(who?.email ?? who?.phone ?? "");
  const [company, setCompany] = useState(who?.company ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEmail = contact.includes("@");
  const anything = name.trim() || contact.trim() || company.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!anything || busy) return;
    setBusy(true); setErr(null);
    const body: Who = {};
    if (name.trim()) body.name = name.trim();
    if (company.trim()) body.company = company.trim();
    if (contact.trim()) { if (isEmail) body.email = contact.trim(); else body.phone = contact.trim(); }
    try {
      const r = await fetch(`${API}/identify`, { method: "POST", headers: { "content-type": "application/json", "X-Client-Id": clientId() }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.detail ?? "Couldn't save that."); return; }
      onSaved(body);
    } catch { setErr("Couldn't reach the server."); }
    finally { setBusy(false); }
  }

  const input = "min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent/60";
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className={compact ? "space-y-2" : "flex flex-wrap gap-2"}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Your name" className={input} />
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="Email or phone" className={input} />
        {!compact && <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} placeholder="Company (optional)" className={input} />}
      </div>
      {err && <p className="text-[11.5px] text-warn">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!anything || busy} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink disabled:opacity-30">{busy ? "Saving…" : who ? "Update" : "Share"}</button>
        {onSkip && <button type="button" onClick={onSkip} className="rounded-lg px-2 py-1.5 text-[12.5px] text-faint hover:text-muted">No thanks</button>}
        <span className="ml-auto font-mono text-[10px] text-faint">all optional</span>
      </div>
    </form>
  );
}

/** One-time inline card in the thread. Appears once, only after a couple of answers. */
export function WhoCard({ onSaved, onSkip }: { onSaved: (w: Who) => void; onSkip: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-bg/60 p-3.5">
      <div className="mb-2 flex items-start gap-2.5">
        <span className="mt-0.5 text-faint"><Glyph k="person" size={14} /></span>
        <div>
          <div className="text-[13px] text-ink">Who am I talking to?</div>
          <div className="text-[12px] leading-snug text-muted">Entirely optional — if you leave a name and a way to reach you, I&apos;ll see it next to your questions and can follow up.</div>
        </div>
      </div>
      <WhoForm who={null} onSaved={onSaved} onSkip={onSkip} />
    </div>
  );
}

/** Header popover, always reachable from the person glyph. */
export function WhoPopover({ who, onSaved, onClear, onClose }: { who: Who | null; onSaved: (w: Who) => void; onClear: () => void; onClose: () => void }) {
  return (
    <div className="absolute right-3 top-12 z-20 w-[280px] rounded-xl border border-line bg-bg p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{who ? "We've met" : "Who's asking?"}</span>
        <IconButton label="Close" onClick={onClose}><Glyph k="close" size={12} /></IconButton>
      </div>
      {who && (
        <div className="mb-2 text-[12px] text-muted">
          Saved: <span className="text-ink">{[who.name, who.company, who.email, who.phone].filter(Boolean).join(" · ")}</span>
          <button onClick={onClear} className="ml-2 text-[11px] text-faint underline hover:text-warn">forget me</button>
        </div>
      )}
      <p className="mb-2 text-[11.5px] leading-snug text-faint">Optional. It just tells me who asked what — nothing is verified, and you can ask anything without it.</p>
      <WhoForm who={who} onSaved={onSaved} compact />
    </div>
  );
}
