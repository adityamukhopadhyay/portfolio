"use client";

import { useEffect, useRef } from "react";

// A live neural network behind every page: neurons in loose layers, sparse
// synapses, and signals that propagate layer to layer, lighting each neuron
// they pass. Low alpha on purpose — it should be felt, not read. Canvas 2D,
// DPR-capped, paused off-screen/hidden, static under reduced motion.

type Neuron = { x: number; y: number; bx: number; by: number; layer: number; p: number; glow: number; r: number };
type Synapse = { a: number; b: number };
type Signal = { s: number; t: number; v: number };

export function NeuralField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let accent = "#0d9470", faint = "#9a9a9a";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      accent = cs.getPropertyValue("--accent").trim() || accent;
      faint = cs.getPropertyValue("--faint").trim() || faint;
    };
    readColors();
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let W = 0, H = 0, dpr = 1;
    let neurons: Neuron[] = [];
    let synapses: Synapse[] = [];
    let out: number[][] = []; // outgoing synapse indices per neuron
    const signals: Signal[] = [];
    const mouse = { x: -9999, y: -9999 };
    let lastScroll = window.scrollY, scrollV = 0;

    const build = () => {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(W < 768 ? 1.25 : 1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = W < 768 ? 4 : W < 1400 ? 6 : 8;
      const per = W < 768 ? 7 : 9;
      neurons = []; synapses = []; out = [];
      for (let l = 0; l < layers; l++) {
        const cx = ((l + 0.5) / layers) * W;
        for (let i = 0; i < per; i++) {
          const cy = ((i + 0.5) / per) * H;
          const x = cx + (Math.random() - 0.5) * (W / layers) * 0.7;
          const y = cy + (Math.random() - 0.5) * (H / per) * 0.8;
          neurons.push({ x, y, bx: x, by: y, layer: l, p: Math.random() * Math.PI * 2, glow: 0, r: 1.2 + Math.random() * 1.3 });
        }
      }
      out = neurons.map(() => []);
      // each neuron feeds 2–3 neurons in the next layer, preferring near ones
      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];
        if (n.layer === layers - 1) continue;
        const next = neurons.map((m, j) => ({ j, d: m.layer === n.layer + 1 ? Math.hypot(m.x - n.x, m.y - n.y) : Infinity })).filter((o) => o.d < Infinity).sort((a, b) => a.d - b.d);
        const k = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (const o of next.slice(0, k)) { out[i].push(synapses.length); synapses.push({ a: i, b: o.j }); }
      }
    };
    build();
    let resizeT = 0;
    const onResize = () => { clearTimeout(resizeT); resizeT = window.setTimeout(build, 150); };
    window.addEventListener("resize", onResize);
    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeaveDoc = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("mousemove", onMouse);
    document.addEventListener("mouseleave", onLeaveDoc);
    const onScroll = () => { const s = window.scrollY; scrollV += (s - lastScroll) * 0.04; lastScroll = s; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const fire = (i: number) => {
      neurons[i].glow = 1;
      for (const s of out[i]) if (Math.random() < 0.8) signals.push({ s, t: 0, v: 0.9 + Math.random() * 0.6 });
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      // synapses
      ctx.lineWidth = 1;
      for (const s of synapses) {
        const a = neurons[s.a], b = neurons[s.b];
        const g = Math.max(a.glow, b.glow);
        ctx.globalAlpha = 0.07 + g * 0.25;
        ctx.strokeStyle = g > 0.05 ? accent : faint;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // signals
      for (const sg of signals) {
        const s = synapses[sg.s]; const a = neurons[s.a], b = neurons[s.b];
        const x = a.x + (b.x - a.x) * sg.t, y = a.y + (b.y - a.y) * sg.t;
        const t0 = Math.max(0, sg.t - 0.12);
        const x0 = a.x + (b.x - a.x) * t0, y0 = a.y + (b.y - a.y) * t0;
        ctx.globalAlpha = 0.55; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 0.95; ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      // neurons
      for (const n of neurons) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.hypot(dx, dy);
        const near = d < 170 ? 1 - d / 170 : 0;
        const tw = 0.6 + 0.4 * Math.sin(now / 1100 + n.p);
        const lit = Math.max(n.glow, near * 0.7);
        if (lit > 0.03) {
          ctx.globalAlpha = lit * 0.22; ctx.fillStyle = accent;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 9 * lit, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.22 * tw + lit * 0.7;
        ctx.fillStyle = lit > 0.05 ? accent : faint;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + lit * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0, last = performance.now(), running = !document.hidden, nextFire = 600;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (!running) { last = now; return; }
      const dt = Math.min(50, now - last); last = now;
      scrollV *= 0.9;
      for (const n of neurons) {
        n.x = n.bx + Math.sin(now / 4000 + n.p) * 5;
        n.y = n.by + Math.cos(now / 5200 + n.p) * 5 - scrollV * 0.25 * (1 + n.layer * 0.1);
        n.by -= scrollV * 0.02;
        if (n.by < -30) n.by += H + 60; if (n.by > H + 30) n.by -= H + 60;
        n.glow = Math.max(0, n.glow - dt / 900);
      }
      nextFire -= dt;
      if (nextFire <= 0) {
        const inputs = neurons.map((n, i) => (n.layer === 0 ? i : -1)).filter((i) => i >= 0);
        if (inputs.length) fire(inputs[Math.floor(Math.random() * inputs.length)]);
        nextFire = 500 + Math.random() * 900;
      }
      for (let i = signals.length - 1; i >= 0; i--) {
        const sg = signals[i];
        sg.t += (dt / 1000) * sg.v * 1.6;
        if (sg.t >= 1) { fire(synapses[sg.s].b); signals.splice(i, 1); }
      }
      if (signals.length > 80) signals.splice(0, signals.length - 80);
      draw(now);
    };
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    if (reduce) draw(0); else raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf); mo.disconnect(); clearTimeout(resizeT);
      window.removeEventListener("resize", onResize); window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("mouseleave", onLeaveDoc); window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-90" />;
}
