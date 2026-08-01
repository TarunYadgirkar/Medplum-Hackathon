'use client';
// The Prelude voice orb — direct port of the motion system embedded in the
// Claude Design handoff ("Prelude UI Handoff.dc.html" dc-script): a bright
// morphing orb with wandering color auroras, volume-reactive scale, syllable
// ripples and wobbly halo rings, driven by either a speech-like simulated
// envelope (mode="sim") or the live microphone (mode="mic", falls back to
// sim if the mic is unavailable). Circles are reserved for the voice — this
// is that circle.

import { useEffect, useRef } from 'react';
import { ensureMic, readLevel } from '@/lib/mic-level';

interface VoiceOrbProps {
  /** Main orb diameter in px (design: 220 landing, 250 call screen) */
  size?: number;
  /** "sim" = speech-envelope animation; "mic" = live microphone drive */
  mode?: 'sim' | 'mic';
  /** Scales the reactivity (design's orbIntensity), default 1 */
  intensity?: number;
  /** When true, settle into a gentle low-energy breathe (e.g. call ended) */
  idle?: boolean;
  /** When true, the orb speeds up its animation while the cursor hovers it */
  hoverInteractive?: boolean;
  className?: string;
}

interface Ripple { born: number; amp: number }

export default function VoiceOrb({ size = 220, mode = 'sim', intensity = 1, idle = false, hoverInteractive = false, className = '' }: VoiceOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const idleRef = useRef(idle);
  const intensityRef = useRef(intensity);
  const hoverRef = useRef(false);
  modeRef.current = mode;
  idleRef.current = idle;
  intensityRef.current = intensity;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-vz]'));
    const morphs = Array.from(root.querySelectorAll<HTMLElement>('[data-morph]'));
    const orbits = Array.from(root.querySelectorAll<HTMLElement>('[data-orbit]'));
    const canvas = root.querySelector<HTMLCanvasElement>('[data-ring]');
    const smoothed = new WeakMap<HTMLElement, number>();

    let t = 0;
    let v = 0.2;
    let vSlow = 0.2;
    let raf = 0;
    let lastRipple = 0;
    let ripples: Ripple[] = [];
    const hist = new Array<number>(90).fill(0.2);
    let histAt = 0;

    // Shared mic source ('@/lib/mic-level') — one stream feeds the orb AND the
    // visualizer bars. readLevel() → null means mic unavailable → sim fallback.
    let micOn = false;
    async function initMic() {
      if (modeRef.current !== 'mic') return;
      micOn = await ensureMic();
    }
    const retryMic = () => { if (!micOn) void initMic(); };
    const micLevel = (): number | null => readLevel();

    /* speech-like envelope: slow breath + syllable pulses, gated into phrases */
    function env(tt: number): number {
      const p = tt % 13;
      const gate = p < 4.6 ? 1 : p < 6.0 ? 0.06 : p < 11.2 ? 1 : 0.05;
      const syl = Math.abs(Math.sin(tt * 5.1) * Math.sin(tt * 2.3 + 1.1)) * 0.74 + Math.abs(Math.sin(tt * 9.6 + 0.6)) * 0.26;
      const breath = 0.5 + 0.5 * Math.sin(tt * 0.83 + 0.4);
      return Math.max(0.09, Math.min(1, gate * (0.2 + 0.44 * breath + 0.58 * syl - 0.14)));
    }

    /* asymmetric smoothing: quick attack, slow release — kills flicker */
    const smooth = (prev: number, target: number, up: number, down: number) =>
      prev + (target - prev) * (target > prev ? up : down);

    /* per-element offsets read a delayed sample of the live signal */
    function delayed(offset: number): number {
      const back = Math.min(hist.length - 1, Math.round(offset * 26));
      const i = (histAt - back + hist.length * 2) % hist.length;
      return hist[i];
    }

    function drawRing(c: HTMLCanvasElement) {
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, base = w * 0.4;
      for (const r of ripples) {
        const age = (t - r.born) / 3.2;
        const e = 1 - Math.pow(1 - age, 3);
        ctx.beginPath();
        ctx.arc(cx, cy, base * (0.8 + e * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(35,64,127,${(0.22 * (1 - age) * r.amp).toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      const rings = [
        { k: 1.0, col: '35,64,127', lw: 1.4, sp: 0.5 },
        { k: 1.07, col: '168,52,43', lw: 1, sp: -0.32 },
      ];
      rings.forEach((rg, idx) => {
        ctx.beginPath();
        const steps = 90;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2 + t * 0.16 * rg.sp;
          const wob = Math.sin(a * 3 + t * 0.9 + idx) * 0.05
            + Math.sin(a * 5 - t * 1.25 + idx * 1.7) * 0.03
            + Math.sin(a * 7 + t * 1.7) * 0.016;
          const rad = base * rg.k * (0.82 + 0.1 * vSlow + wob * (0.55 + 1.1 * v));
          const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${rg.col},${(0.18 + 0.42 * vSlow).toFixed(3)})`;
        ctx.lineWidth = rg.lw;
        ctx.stroke();
      });
    }

    function tick() {
      const speedMul = hoverRef.current ? 1.7 : 1;
      t += speedMul / 60;
      const gain = (intensityRef.current ?? 1) * (idleRef.current ? 0.3 : 1) * (hoverRef.current ? 1.15 : 1);
      const live = micOn && !idleRef.current ? micLevel() : null;
      const raw = Math.min(1, (live == null ? env(t) : live) * gain);
      histAt = (histAt + 1) % hist.length;
      hist[histAt] = raw;
      v = smooth(v, raw, live == null ? 0.24 : 0.42, live == null ? 0.085 : 0.13);
      vSlow = smooth(vSlow, raw, 0.075, 0.04);

      nodes.forEach((el) => {
        const o = parseFloat(el.getAttribute('data-vz-offset') || '0');
        const slow = el.hasAttribute('data-vz-slow');
        const target = Math.min(1, (live == null ? env(t + o) : delayed(o)) * gain);
        const prev = smoothed.get(el) ?? target;
        const next = slow ? smooth(prev, target, 0.055, 0.03) : smooth(prev, target, 0.22, 0.08);
        smoothed.set(el, next);
        el.style.setProperty('--v', next.toFixed(4));
      });

      /* organic silhouette: 8 continuously-modulated radii, amplitude tracks volume */
      morphs.forEach((el) => {
        const amp = parseFloat(el.getAttribute('data-morph-amp') || '10') * (0.7 + 2.1 * (smoothed.get(el) ?? v));
        const sp = parseFloat(el.getAttribute('data-morph-speed') || '0.55') * 1.5;
        const r: string[] = [];
        for (let i = 0; i < 8; i++) {
          const w = Math.sin(t * sp + i * 1.31) * 0.58 + Math.sin(t * sp * 1.73 + i * 2.11) * 0.3 + Math.sin(t * sp * 2.9 + i * 0.83) * 0.16;
          r.push((50 + amp * w).toFixed(2) + '%');
        }
        el.style.borderRadius = r.slice(0, 4).join(' ') + ' / ' + r.slice(4).join(' ');
      });

      /* interior aurora: JS-driven wandering so the gradient never sits still */
      orbits.forEach((el) => {
        const ph = parseFloat(el.getAttribute('data-orbit') || '0');
        const R = parseFloat(el.getAttribute('data-orbit-r') || '40') * (0.7 + 1.7 * (smoothed.get(el) ?? v));
        const x = Math.cos(t * 0.82 + ph) * R + Math.sin(t * 1.53 + ph * 1.7) * R * 0.52;
        const y = Math.sin(t * 0.69 + ph * 1.3) * R + Math.cos(t * 1.27 + ph) * R * 0.46;
        el.style.setProperty('--mx', x.toFixed(1) + 'px');
        el.style.setProperty('--my', y.toFixed(1) + 'px');
      });

      if (v > 0.58 && (!lastRipple || t - lastRipple > 0.6)) {
        lastRipple = t;
        ripples.push({ born: t, amp: v });
      }
      ripples = ripples.filter((r) => t - r.born < 3.2);
      if (canvas) drawRing(canvas);

      raf = requestAnimationFrame(tick);
    }

    if (modeRef.current === 'mic') {
      void initMic();
      document.addEventListener('pointerdown', retryMic);
    }
    raf = requestAnimationFrame(tick);

    const onEnter = () => { hoverRef.current = true; };
    const onLeave = () => { hoverRef.current = false; };
    if (hoverInteractive) {
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointerleave', onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', retryMic);
      if (hoverInteractive) {
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointerleave', onLeave);
      }
      // shared mic stream stays alive for other consumers (bars, next mount)
    };
  }, [hoverInteractive]);

  const k = size / 220; // design ratios are set at the 220px landing orb
  const px = (n: number) => `${Math.round(n * k)}px`;

  return (
    <div ref={rootRef} className={`relative flex items-center justify-center ${className}`} style={{ width: px(340), height: px(340) }}>
      {/* outer glow wash */}
      <div
        data-vz="1" data-vz-slow="1" data-morph="1" data-morph-amp="13" data-morph-speed="0.5"
        className="absolute"
        style={{
          width: px(300), height: px(300),
          background: 'radial-gradient(circle,rgba(232,178,84,.4),rgba(168,52,43,.2) 52%,transparent 70%)',
          filter: 'blur(40px)',
          transform: 'scale(calc(.94 + var(--v,.2) * .3))',
        }}
      />
      {/* main orb */}
      <div
        data-vz="1" data-vz-slow="1" data-morph="1" data-morph-amp="10" data-morph-speed="0.62"
        className="relative overflow-hidden"
        style={{
          width: px(220), height: px(220),
          background: '#fcfbf7',
          boxShadow: '0 0 0 1px rgba(252,251,247,.25),0 24px 60px rgba(0,0,0,.4)',
          transform: 'scale(calc(1 + var(--v,.2) * .07))',
        }}
      >
        <div className="absolute" style={{ inset: '-30%', filter: 'saturate(1.2)' }}>
          <div
            data-vz="1" data-orbit="0" data-orbit-r={String(Math.round(48 * k))} data-vz-offset="0.2"
            className="absolute rounded-full"
            style={{
              width: px(220), height: px(220), left: '12%', top: '8%',
              background: 'radial-gradient(circle,rgba(35,64,127,.95),rgba(35,64,127,0) 66%)',
              filter: 'blur(22px)',
              opacity: 'calc(.5 + var(--v,.2) * .5)',
              transform: 'translate3d(var(--mx,0px),var(--my,0px),0) scale(calc(.82 + var(--v,.2) * .42))',
            }}
          />
          <div
            data-vz="1" data-orbit="2.1" data-orbit-r={String(Math.round(54 * k))} data-vz-offset="0.75"
            className="absolute rounded-full"
            style={{
              width: px(204), height: px(204), right: '8%', top: '22%',
              background: 'radial-gradient(circle,rgba(168,52,43,.9),rgba(168,52,43,0) 64%)',
              filter: 'blur(23px)',
              opacity: 'calc(.4 + var(--v,.2) * .55)',
              transform: 'translate3d(var(--mx,0px),var(--my,0px),0) scale(calc(.78 + var(--v,.2) * .5))',
            }}
          />
          <div
            data-vz="1" data-orbit="4.2" data-orbit-r={String(Math.round(44 * k))} data-vz-offset="1.35"
            className="absolute rounded-full"
            style={{
              width: px(210), height: px(210), left: '8%', bottom: '6%',
              background: 'radial-gradient(circle,rgba(184,134,43,.92),rgba(184,134,43,0) 65%)',
              filter: 'blur(22px)',
              opacity: 'calc(.38 + var(--v,.2) * .54)',
              transform: 'translate3d(var(--mx,0px),var(--my,0px),0) scale(calc(.8 + var(--v,.2) * .46))',
            }}
          />
          {mode === 'mic' && (
            <div
              data-vz="1" data-orbit="1.15" data-orbit-r={String(Math.round(38 * k))} data-vz-offset="0.45"
              className="absolute rounded-full"
              style={{
                width: px(180), height: px(180), left: '24%', top: '30%',
                background: 'radial-gradient(circle,rgba(252,251,247,.92),rgba(252,251,247,0) 62%)',
                filter: 'blur(20px)',
                opacity: 'calc(.35 + var(--v,.2) * .4)',
                transform: 'translate3d(var(--mx,0px),var(--my,0px),0)',
              }}
            />
          )}
        </div>
        {/* top-left sheen + bottom inner shade */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 32% 24%,rgba(252,251,247,.92),rgba(252,251,247,0) 46%)' }} />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 -20px 36px rgba(23,22,26,.14)' }} />
      </div>
      {/* wobbly halo rings + syllable ripples */}
      <canvas data-ring="1" className="absolute block pointer-events-none z-[3]" style={{ width: px(340), height: px(340) }} />
    </div>
  );
}
