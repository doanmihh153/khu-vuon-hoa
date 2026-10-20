/** card.js (1/2) — Dữ liệu thiệp + mở/đóng đồng bộ scroll (§9). */
import { AppState, store } from "./state.js";
import { CARD, QUICK_WISHES } from "./greetings.js";
import { STORAGE_KEY } from "./config.js";

export const CARD_OPEN_AT = 0.992;

export function initCard({ onCloseToGarden }) {
  const overlay = document.getElementById("card-overlay");
  const shell = document.getElementById("card-shell");
  const flap = document.getElementById("env-flap");
  const petal = document.getElementById("card-petal");
  const body = document.getElementById("card-body");
  const sign = document.getElementById("card-sign");
  const title = document.getElementById("card-title");
  const toast = document.getElementById("card-toast");
  const inR = document.getElementById("in-recipient");
  const inS = document.getElementById("in-sender");
  const inM = document.getElementById("in-message");
  const presetBox = document.getElementById("preset-list");
  if (!overlay) return { syncWithProgress() {}, isOpen: () => false };

  title.textContent = CARD.title;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { saved = {}; }
  if (inR) inR.value = saved.recipient || "";
  if (inS) inS.value = saved.sender || "";
  if (inM) inM.value = saved.message || CARD.body;

  const composeSign = () => {
    const r = inR?.value.trim(), s = inS?.value.trim();
    if (r && s) return "Gửi " + r + " — " + s;
    if (r) return "Gửi " + r + " " + CARD.sign;
    if (s) return CARD.sign + " " + s;
    return CARD.sign;
  };
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ recipient: inR?.value || "", sender: inS?.value || "", message: inM?.value || "" })); } catch { /* kệ */ }
  };
  const say = (msg) => { if (toast) { toast.textContent = msg; setTimeout(() => { if (toast.textContent === msg) toast.textContent = ""; }, 2600); } };

  function render() {
    if (body) body.textContent = inM?.value || CARD.body;
    if (sign) {
      const sg = composeSign();
      sign.textContent = sg;
      // Chu ky rong -> an luon de khong lai khoang trong
      sign.style.display = sg.trim() ? "" : "none";
    }
  }
  if (presetBox) {
    presetBox.innerHTML = "";
    QUICK_WISHES.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rounded-full border border-[#c58aa8]/40 bg-white/70 px-3.5 py-2 text-left text-xs leading-relaxed text-[#7a3b57] transition hover:bg-white";
      b.textContent = w.length > 46 ? w.slice(0, 46) + "…" : w;
      b.title = w;
      b.addEventListener("click", () => { if (inM) { inM.value = w; render(); persist(); say("Đã chèn mẫu lời chúc."); } });
      presetBox.appendChild(b);
    });
  }
  [inR, inS, inM].forEach((el) => el?.addEventListener("input", () => { render(); persist(); }));
  render();

  let open = false;
  let typingTimer = 0;
  function typewriter() {
    if (!body || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const full = body.textContent;
    body.innerHTML = "";
    const txt = document.createElement("span");
    const cur = document.createElement("span");
    cur.className = "cursor";
    body.append(txt, cur);
    let i = 0;
    clearInterval(typingTimer);
    typingTimer = setInterval(() => {
      i += 3;
      txt.textContent = full.slice(0, i);
      if (i >= full.length) clearInterval(typingTimer);
    }, 24);
  }

  function openCard() {
    if (open) return;
    open = true;
    store.set(AppState.CARD_REVEAL, { progress: store.progress });
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    // thiệp cuộn nội bộ (overlay overscroll-contain), body vẫn giữ scroll
    // để wheel/touch ngược vẫn tới window → cuộn ngược đóng thiệp (§7.5)
    requestAnimationFrame(() => {
      shell?.classList.add("is-open");
      if (flap) flap.style.transform = "rotateX(168deg)";
      if (petal) { petal.style.transition = "opacity .8s ease .35s"; petal.style.opacity = "1"; }
    });
    typewriter();
    setTimeout(() => { if (open) store.set(AppState.CARD_ACTIVE, { progress: store.progress }); }, 900);
  }

  function closeCard(opts = {}) {
    if (!open) return;
    open = false;
    clearInterval(typingTimer);
    shell?.classList.remove("is-open");
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    store.set(store.progress > 0.5 ? AppState.GARDEN_JOURNEY : AppState.GARDEN_OVERVIEW, { progress: store.progress });
    if (opts.scrollBack) onCloseToGarden?.();
  }

  document.getElementById("card-close")?.addEventListener("click", () => closeCard());
  // Nút "Trở về": đóng thiệp + nhảy thẳng về màn hình home (đầu trang).
  // Dùng "instant" để không bị kẹt khi tab chạy nền; camera vẫn chuyển
  // động mượt nhờ damping của cameraJourney.
  document.getElementById("card-back")?.addEventListener("click", () => {
    closeCard({ scrollBack: true });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  });
  document.getElementById("card-backdrop")?.addEventListener("click", () => closeCard());
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) closeCard(); });
  window.__cardActions = { openCard, closeCard, say, getBody: () => body, getSign: () => sign, getTitle: () => title };

  function syncWithProgress(p) {
    if (p >= CARD_OPEN_AT && !open && (store.state === AppState.GARDEN_JOURNEY || store.state === AppState.GARDEN_OVERVIEW || store.state === AppState.CARD_REVEAL)) {
      openCard();
    } else if (p < CARD_OPEN_AT - 0.02 && open) {
      open = false;
      clearInterval(typingTimer);
      shell?.classList.remove("is-open");
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
      store.set(AppState.GARDEN_JOURNEY, { progress: p });
    }
  }
  /** Đổ nội dung thiệp hiện tại vào node #tree-card (để dựng ảnh cho cây). */
  function fillTreeCard() {
    const node = document.getElementById("tree-card");
    if (!node) return null;
    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const t = document.getElementById("card-title")?.textContent || CARD.title;
    const b = document.getElementById("card-body")?.textContent || CARD.body;
    const sg = document.getElementById("card-sign")?.textContent || CARD.sign;
    node.innerHTML =
      '<p style="font-size:15px;letter-spacing:.28em;text-transform:uppercase;color:#a9768f">Thiệp chúc mừng · 20/10</p>' +
      '<h2 style="margin-top:14px;font-family:Lora,serif;font-size:36px;line-height:1.2;color:#5b1f3f">' +
      esc(t) +
      "</h2>" +
      '<div style="margin-top:8px;height:2px;width:70px;background:linear-gradient(90deg,#e8a9c2,transparent)"></div>' +
      '<p style="margin-top:20px;font-size:19px;line-height:1.85;color:#5d3a4c">' +
      esc(b).replace(/\n/g, "<br>") +
      "</p>" +
      '<p style="margin-top:22px;font-family:Lora,serif;font-style:italic;font-size:23px;color:#7a3b57">' +
      esc(sg) +
      "</p>" +
      '<p style="margin-top:26px;font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:#c58aa8">20 · 10 · KHU VƯỜN CỦA TRÁI TIM</p>';
    return node;
  }

  return {
    syncWithProgress,
    isOpen: () => open,
    openCard,
    closeCard,
    fillTreeCard,
    CARD_OPEN_AT,
  };
}
