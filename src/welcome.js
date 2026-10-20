/**
 * welcome.js — Màn hình chào + chuyển cảnh Bottom→Top (§4).
 * Không fade đơn thuần, không cho qua khi vườn chưa READY.
 */
import { AppState, store } from "./state.js";

export function initWelcome() {
    const welcome = document.getElementById("welcome");
    const bar = document.getElementById("loader-bar");
    const note = document.getElementById("loader-note");
    if (!welcome) return { setLoadProgress() {}, reveal() {}, fail() {} };

    // khóa cuộn tuyệt đối trong WELCOME
    const lock = () => {
        document.documentElement.classList.add("is-welcome");
        document.body.classList.add("is-welcome");
        window.scrollTo(0, 0);
    };
    const unlock = () => {
        document.documentElement.classList.remove("is-welcome");
        document.body.classList.remove("is-welcome");
    };
    lock();

    // chữ xuất hiện từng cụm
    const lines = welcome.querySelectorAll(".w-reveal");
    lines.forEach((el, i) => {
        el.style.transition =
            "opacity .9s ease " +
            i * 0.12 +
            "s, transform .9s cubic-bezier(.2,.7,.2,1) " +
            i * 0.12 +
            "s";
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                el.style.opacity = "1";
                el.style.transform = "translateY(0) rotate(0deg)";
            }),
        );
    });

    function setLoadProgress(p, label) {
        if (bar) bar.style.width = Math.round(p * 100) + "%";
        if (label && note) note.textContent = label;
    }

    function reveal() {
        if (store.state !== AppState.READY && store.state !== AppState.WELCOME)
            return;
        store.set(AppState.REVEALING_GARDEN);
        // trượt Bottom → Top: translateY(0 → -100%)
        welcome.classList.add("is-sliding");
        unlock();
        // mở khóa ngay để ScrollTrigger đo đúng, nhưng chặn tương tác thiệp
        setTimeout(() => {
            welcome.setAttribute("aria-hidden", "true");
            welcome.style.display = "none";
            if (store.state === AppState.REVEALING_GARDEN) {
                store.set(AppState.GARDEN_OVERVIEW, {
                    progress: store.progress,
                });
            }
        }, 1450);
    }

    function fail(msg) {
        if (note)
            note.textContent =
                msg ||
                "Không tải được khu vườn 3D. Bạn vẫn có thể mở thiệp bên dưới.";
        const fb = document.getElementById("webgl-fallback");
        if (fb) {
            fb.classList.remove("hidden");
            fb.classList.add("flex");
        }
        unlock();
    }

    return { setLoadProgress, reveal, fail };
}
