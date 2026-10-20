/**
 * state.js — Máy trạng thái duy nhất của toàn bộ trải nghiệm (§11).
 *
 * INITIALIZING → LOADING → READY → WELCOME → REVEALING_GARDEN
 *   → GARDEN_OVERVIEW ⇄ GARDEN_JOURNEY ⇄ CARD_REVEAL ⇄ CARD_ACTIVE
 *   ↘ ERROR (từ bất kỳ đâu khi khởi tạo thất bại, có fallback cho user)
 *
 * Mọi module (welcome / scroll / card / garden) đều đọc & ghi qua store này,
 * không tạo hệ trạng thái cạnh tranh.
 */

export const AppState = Object.freeze({
  INITIALIZING: "INITIALIZING",
  LOADING: "LOADING",
  READY: "READY",
  WELCOME: "WELCOME",
  REVEALING_GARDEN: "REVEALING_GARDEN",
  GARDEN_OVERVIEW: "GARDEN_OVERVIEW",
  GARDEN_JOURNEY: "GARDEN_JOURNEY",
  CARD_REVEAL: "CARD_REVEAL",
  CARD_ACTIVE: "CARD_ACTIVE",
  ERROR: "ERROR",
});

const listeners = new Set();

export const store = {
  state: AppState.INITIALIZING,
  /** Tiến trình cuộn 0..1 của hành trình camera */
  progress: 0,
  /** Cảnh 3D đã render ổn định ≥ N frame? */
  gardenReady: false,
  /** Thông điệp lỗi khi rơi vào ERROR */
  error: null,

  set(next, extra = {}) {
    if (this.state === next && !("progress" in extra)) return;
    this.state = next;
    if (typeof extra.progress === "number") {
      this.progress = Math.min(1, Math.max(0, extra.progress));
    }
    if ("gardenReady" in extra) this.gardenReady = !!extra.gardenReady;
    if ("error" in extra) this.error = extra.error;
    for (const fn of listeners) {
      try {
        fn(this.state, this);
      } catch (e) {
        console.error("[state] listener lỗi:", e);
      }
    }
  },

  setProgress(p) {
    const v = Math.min(1, Math.max(0, p));
    if (Math.abs(v - this.progress) < 1e-5) return;
    this.progress = v;
    for (const fn of listeners) {
      try {
        fn(this.state, this);
      } catch (e) {
        console.error("[state] listener lỗi:", e);
      }
    }
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function isGardenLive(s = store.state) {
  return (
    s === AppState.GARDEN_OVERVIEW ||
    s === AppState.GARDEN_JOURNEY ||
    s === AppState.CARD_REVEAL ||
    s === AppState.CARD_ACTIVE
  );
}
