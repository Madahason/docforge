import { useEffect, useState } from "react";
import type { WordTimestamp } from "@/lib/studio-context";

/**
 * Returns the index of the currently spoken word for a given playback time.
 * Returns -1 when no word matches (silence / before first word).
 */
export function useWordSync(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  timestamps: WordTimestamp[] | null | undefined,
): number {
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !timestamps || timestamps.length === 0) {
      setCurrentIndex(-1);
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = el.currentTime;
      // binary search
      let lo = 0;
      let hi = timestamps.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const w = timestamps[mid];
        if (t < w.start) hi = mid - 1;
        else if (t > w.end) lo = mid + 1;
        else {
          found = mid;
          break;
        }
      }
      if (found === -1 && t >= timestamps[0].start) {
        // fall back to last word whose start <= t
        for (let i = timestamps.length - 1; i >= 0; i--) {
          if (timestamps[i].start <= t) {
            found = i;
            break;
          }
        }
      }
      setCurrentIndex((prev) => (prev === found ? prev : found));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef, timestamps]);

  return currentIndex;
}

export function formatClock(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
