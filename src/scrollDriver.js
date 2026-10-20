/**
 * scrollDriver.js — Ánh xạ vị trí cuộn → tiến trình 0..1 (§7.3).
 * Vùng cuộn dài tạo hành trình ~10-15s khi cuộn vừa phải.
 */
import { clamp } from "./utils/math.js";

export function createScrollDriver({ spacer, onProgress }) {
  let progress = 0;
  let ticking = false;
  let handler = onProgress || null;

  function measure() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(1, max);
  }

  function read() {
    const max = measure();
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    progress = clamp(y / max, 0, 1);
    handler?.(progress);
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(read);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  read();

  return {
    get progress() { return progress; },
    setHandler(fn) { handler = fn; read(); },
    scrollTo(p, behavior = "smooth") {
      const max = measure();
      window.scrollTo({ top: p * max, behavior });
    },
    dispose() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}
