"use client";

import { useEffect, useMemo, useState } from "react";
import { API, Glyph, IconButton } from "./AskWidget";

type Slots = { duration_min: number; ist_hours: string[]; days_ahead: number; to: string };
type Done = { when: { local: string; ist: string; day: string; tz: string; utc_start: string; utc_end: string }; calendar_url: string; delivered: boolean; message: string; to: string };

/** Universal invite (.ics) for Outlook / Apple Calendar: the visitor is the organiser, Aditya the attendee. */
function icsDataUrl(d: Done, name: string, email: string, note: string): string {
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const uid = `${d.when.utc_start}-${Math.random().toString(36).slice(2)}@adityamukhopadhyay.vercel.app`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ask-about-Aditya//booking//EN", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${d.when.utc_start}`, `DTEND:${d.when.utc_end}`,
    `SUMMARY:${esc(`Call: ${name} × Aditya Mukhopadhyay`)}`, `DESCRIPTION:${esc(note || "Intro call booked via adityamukhopadhyay.vercel.app/ask")}`,
    `ORGANIZER;CN=${esc(name)}:mailto:${email}`, `ATTENDEE;CN=Aditya Mukhopadhyay;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${d.to}`,
    `ATTENDEE;CN=${esc(name)};ROLE=REQ-PARTICIPANT:mailto:${email}`, "END:VEVENT", "END:VCALENDAR"];
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

function clientId(): string {
  try { let v = localStorage.getItem("ask.cid"); if (!v) { v = crypto.randomUUID(); localStorage.setItem("ask.cid", v); } return v; } catch { return "anon"; }
}
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Convert an IST wall-clock hour on a given date to the visitor's local HH:MM. */
function istToLocal(date: string, hhmm: string, tz: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  // IST is UTC+5:30 with no DST
  const utc = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h - 5, m - 30);
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(utc));
}

export function BookCallModal({ onClose }: { onClose: () => void }) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata", []);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");           // local HH:MM
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<Done | null>(null);

  useEffect(() => { fetch(`${API}/book/slots`).then((r) => r.json()).then(setSlots).catch(() => setSlots({ duration_min: 30, ist_hours: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"], days_ahead: 21, to: "" })); }, []);

  // next 14 days as quick-pick chips (skip nothing — he can decline), plus a native date input for anything else
  const days = useMemo(() => { const out: { iso: string; dow: string; dd: string; mon: string }[] = []; const t = new Date(); for (let i = 1; i <= 14; i++) { const d = new Date(t); d.setDate(t.getDate() + i); out.push({ iso: iso(d), dow: d.toLocaleDateString("en-GB", { weekday: "short" }), dd: pad(d.getDate()), mon: d.toLocaleDateString("en-GB", { month: "short" }) }); } return out; }, []);
  const dayLabel = date ? new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";
  const times = useMemo(() => (slots && date ? slots.ist_hours.map((h) => ({ ist: h, local: istToLocal(date, h, tz) })) : []), [slots, date, tz]);
  const canSubmit = !!date && !!time && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/book`, { method: "POST", headers: { "content-type": "application/json", "X-Client-Id": clientId() },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), date, time, tz, note: note.trim() || null }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.detail ?? "Something went wrong — email adul.m.2003@gmail.com instead."); return; }
      setDone(d);
    } catch { setErr("Network error — email adul.m.2003@gmail.com instead."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_90px_-20px_rgba(0,0,0,.7)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/avatar.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-line" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold text-ink">Let&apos;s talk — 30 minutes with Aditya</div>
              <div className="font-mono text-[10.5px] text-faint">pick a day and a time · I get an email straight away</div>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}><Glyph k="close" size={13} /></IconButton>
        </div>

        {done ? (
          <div className="px-5 py-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Glyph k="check" size={15} /></span>
              <div>
                <div className="text-[15px] font-semibold text-ink">{done.delivered ? "Booked. I'll confirm by email." : "Request received."}</div>
                <div className="mt-1 text-[13.5px] text-muted">{done.when.local} <span className="text-faint">({done.when.tz})</span>{done.when.tz !== "Asia/Kolkata" && <> · {done.when.ist}</>}</div>
                {!done.delivered && <div className="mt-1 text-[12.5px] text-faint">{done.message}</div>}
                <div className="mt-3 text-[12.5px] text-muted">One more step: put it on your calendar — that sends me the invite from your account, and we both get the reminder.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={done.calendar_url} target="_blank" rel="noreferrer" className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink">Add to Google Calendar</a>
                  <a href={icsDataUrl(done, name, email, note)} download={`call-with-aditya-${date}.ics`} className="rounded-xl border border-line px-3.5 py-2 text-[13px] text-muted hover:text-ink">Download .ics (Outlook / Apple)</a>
                  <button onClick={onClose} className="rounded-xl border border-line px-3.5 py-2 text-[13px] text-muted hover:text-ink">Done</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4">
            {/* day */}
            <div className="mb-1.5 flex items-baseline justify-between"><span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Day</span>{dayLabel && <span className="text-[12px] text-muted">{dayLabel}</span>}</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {days.map((d) => (
                <button key={d.iso} type="button" onClick={() => { setDate(d.iso); setTime(""); }}
                        className={`flex w-[52px] shrink-0 flex-col items-center rounded-xl border py-1.5 transition-colors ${date === d.iso ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted hover:border-rule hover:text-ink"}`}>
                  <span className="font-mono text-[10px] uppercase">{d.dow}</span><span className="text-[15px] font-semibold leading-tight">{d.dd}</span><span className="font-mono text-[10px]">{d.mon}</span>
                </button>))}
              <label className={`flex w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border text-[10px] ${date && !days.some((d) => d.iso === date) ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-faint hover:text-ink"}`}>
                <span>other</span><input type="date" className="sr-only" min={iso(new Date())} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
              </label>
            </div>

            {/* time */}
            <div className="mb-1.5 mt-4 flex items-baseline justify-between"><span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Time</span><span className="font-mono text-[10.5px] text-faint">shown in your time zone · {tz}</span></div>
            {date ? (
              <div className="grid grid-cols-5 gap-1.5">
                {times.map((t) => (
                  <button key={t.ist} type="button" onClick={() => setTime(t.local)} title={`${t.ist} IST`}
                          className={`rounded-lg border py-1.5 font-mono text-[12.5px] transition-colors ${time === t.local ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted hover:border-rule hover:text-ink"}`}>{t.local}</button>))}
              </div>
            ) : <div className="rounded-lg border border-dashed border-line py-3 text-center text-[12px] text-faint">pick a day first</div>}

            {/* who */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} required
                     className="rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent/60" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" required
                     className="rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent/60" />
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note — what you'd like to talk about (optional)" maxLength={600} rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent/60" />

            {err && <div className="mt-2 text-[12.5px] text-warn">{err}</div>}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-faint">{slots?.duration_min ?? 30} min · Google Meet or phone · no account needed</span>
              <button type="submit" disabled={!canSubmit} className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink transition-opacity disabled:opacity-30">{busy ? "Booking…" : "Book the call"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
