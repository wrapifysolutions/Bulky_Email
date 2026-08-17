"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Outreach at a glance",
  "Campaigns that convert",
  "Inbox health, live",
  "Send smarter, scale faster",
];

export function LiveType3D({
  phrases = PHRASES,
  className = "",
}: {
  phrases?: string[];
  className?: string;
}) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [tilt, setTilt] = useState({ x: 6, y: -8 });

  useEffect(() => {
    const current = phrases[phraseIndex] ?? "";
    const speed = deleting ? 28 : 55;

    if (!deleting && text === current) {
      const pause = setTimeout(() => setDeleting(true), 1600);
      return () => clearTimeout(pause);
    }

    if (deleting && text === "") {
      setDeleting(false);
      setPhraseIndex((i) => (i + 1) % phrases.length);
      return;
    }

    const tick = setTimeout(() => {
      const next = deleting
        ? current.slice(0, text.length - 1)
        : current.slice(0, text.length + 1);
      setText(next);
    }, speed);

    return () => clearTimeout(tick);
  }, [text, deleting, phraseIndex, phrases]);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      setTilt({
        x: 6 + Math.sin(t * 0.9) * 4,
        y: -8 + Math.cos(t * 0.7) * 5,
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: "900px" }}
      aria-live="polite"
    >
      <div
        className="relative inline-block origin-left will-change-transform"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(12px)`,
          transformStyle: "preserve-3d",
          transition: "transform 80ms linear",
        }}
      >
        <div
          className="pointer-events-none absolute -inset-3 rounded-2xl blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,131,124,0.28), rgba(63,191,179,0.16))",
            transform: "translateZ(-20px)",
          }}
        />
        <h1
          className="relative font-display text-[1.85rem] font-semibold tracking-[-0.035em] text-ink-950 sm:text-[2.2rem]"
          style={{
            textShadow:
              "0 1px 0 rgba(255,255,255,0.8), 0 10px 28px rgba(26,131,124,0.18)",
            transform: "translateZ(24px)",
          }}
        >
          <span>{text}</span>
          <span
            className="ml-0.5 inline-block w-[3px] translate-y-[2px] rounded-sm align-middle"
            style={{
              height: "1.05em",
              background: "linear-gradient(180deg, #3fbfb3, #1a837c)",
              boxShadow: "0 0 12px rgba(34,163,153,0.55)",
              animation: "typeCaret 0.9s steps(1) infinite",
            }}
          />
        </h1>
      </div>
    </div>
  );
}
