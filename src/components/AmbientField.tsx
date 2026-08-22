"use client";

import { useEffect, useRef } from "react";

// A slow constellation behind every page: nodes drift, link when close, part
// gently around the cursor, and slide with scroll velocity. Very low alpha —
// it should be felt more than seen. Pauses when hidden; static when reduced motion.
export function AmbientField() {
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
    type N = { x: number; y: number; vx: number; vy: number; r: number; p: number };
    let nodes: N[] = [];
    const mouse = { x: -9999, y: -9999 };
    let lastScroll = window.scrollY, scrollV = 0;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(W < 768 ? 1.25 : 1.75, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(W < 768 ? 34 : 90, Math.max(28, (W * H) / 22000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
        r: 1 + Math.random() * 1.4, p: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);
    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("mousemove", onMouse);
    document.addEventListener("mouseleave", onLeave);
    const onScroll = () => { const s = window.scrollY; scrollV += (s - lastScroll) * 0.05; lastScroll = s; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const LINK = 130;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const d = Math.sqrt(d2);
            ctx.globalAlpha = (1 - d / LINK) * 0.2;
            ctx.strokeStyle = faint; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.hypot(dx, dy);
        const near = d < 180 ? 1 - d / 180 : 0;
        const tw = 0.55 + 0.45 * Math.sin(t / 900 + n.p);
        ctx.globalAlpha = 0.3 * tw + near * 0.6;
        ctx.fillStyle = near > 0 ? accent : faint;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + near * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0, last = performance.now(), running = !document.hidden;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (!running) { last = now; return; }
      const dt = Math.min(50, now - last); last = now;
      scrollV *= 0.9;
      for (const n of nodes) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < 160 && d > 0.1) { const f = (1 - d / 160) * 0.05; n.vx += (dx / d) * f; n.vy += (dy / d) * f; }
        n.vx *= 0.985; n.vy *= 0.985;
        n.x += n.vx * dt * 0.06; n.y += n.vy * dt * 0.06 - scrollV * 0.3;
        if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      }
      draw(now);
    };
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    if (reduce) draw(0); else raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf); mo.disconnect();
      window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("mouseleave", onLeave); window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
