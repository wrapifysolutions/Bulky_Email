"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";

export function TiltCard({
  children,
  className,
  style,
  intensity = 8,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (0.5 - py) * intensity,
      y: (px - 0.5) * intensity,
    });
  };

  return (
    <div
      ref={ref}
      className={clsx("panel-3d will-change-transform", className)}
      style={{
        ...style,
        transform: hover
          ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`
          : "perspective(900px) rotateX(0deg) rotateY(0deg)",
        transition: hover ? "transform 80ms linear" : "transform 350ms ease-out",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setHover(false);
        setTilt({ x: 0, y: 0 });
      }}
    >
      {children}
    </div>
  );
}
