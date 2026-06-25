"use client";

import { MotionConfig } from "framer-motion";

/* reducedMotion="user" makes EVERY framer-motion animation honour the OS
   prefers-reduced-motion setting automatically — transforms (x/y/scale/rotate)
   are dropped while opacity fades are kept. This backstops every animated
   component app-wide, on top of the per-component guards. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
