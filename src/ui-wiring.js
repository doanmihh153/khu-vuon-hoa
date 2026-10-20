/** ui-wiring.js — Nút toolbar + bong bóng hoa (chỉ nút thật). */
import { FLOWER_MESSAGES } from "./config.js";

let toolbarScroll = null;
export function setToolbarScroll(s) {
    toolbarScroll = s;
}

export function wireFlowerInfo() {
    const box = document.getElementById("flower-info");
    const latin = document.getElementById("fi-latin");
    const name = document.getElementById("fi-name");
    const desc = document.getElementById("fi-desc");
    if (!box) return;
    let lastShow = 0;
    window.__showFlower = (speciesId) => {
        const meta = FLOWER_MESSAGES[speciesId];
        if (!meta) return;
        const now = performance.now();
        if (now - lastShow < 5000) return;
        lastShow = now;
        if (latin) latin.textContent = meta.latin;
        if (name) name.textContent = meta.name;
        if (desc) desc.textContent = meta.desc;
        box.classList.remove("opacity-0", "translate-y-6");
        box.setAttribute("aria-hidden", "false");
        clearTimeout(box.__t);
        box.__t = setTimeout(() => {
            box.classList.add("opacity-0", "translate-y-6");
            box.setAttribute("aria-hidden", "true");
        }, 4200);
    };
    document
        .getElementById("fi-close")
        ?.addEventListener("click", () =>
            box.classList.add("opacity-0", "translate-y-6"),
        );
    document
        .getElementById("fi-back")
        ?.addEventListener("click", () =>
            box.classList.add("opacity-0", "translate-y-6"),
        );
    document.getElementById("fi-wish")?.addEventListener("click", () => {
        box.classList.add("opacity-0", "translate-y-6");
        if ((toolbarScroll?.progress ?? 0) >= 0.96)
            window.__cardActions?.openCard();
        else toolbarScroll?.scrollTo(1);
    });
    // hiện info hoa đang được chạm (poll nhẹ cây nghiêng mạnh nhất)
    setInterval(() => {
        const g = window.__garden;
        if (!g?.flowerData?.length) return;
        let best = null,
            bestBend = 0.16;
        for (const f of g.flowerData) {
            const b = Math.abs(f.bendX) + Math.abs(f.bendZ);
            if (b > bestBend) {
                bestBend = b;
                best = f;
            }
        }
        if (best?.meshSoft)
            window.__showFlower(best.meshSoft.userData.speciesId);
    }, 2600);
}

export function wireToolbar({ card }) {
    window.__cardActions = {
        ...(window.__cardActions || {}),
        openCard: card.openCard,
        closeCard: card.closeCard,
    };
    const petalBtn = document.getElementById("btn-petal");
    petalBtn?.addEventListener("click", () => {
        const g = window.__garden;
        if (!g) return;
        const isOn = petalBtn.dataset.state !== "off";
        petalBtn.dataset.state = isOn ? "off" : "on";
        petalBtn.setAttribute("aria-pressed", String(!isOn));
        let first = true;
        g.core.scene.traverse((o) => {
            if (o.isPoints && first) {
                first = false;
                o.visible = !isOn ? true : false;
            }
        });
    });
    document
        .getElementById("btn-music")
        ?.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const mod = await import("./audio.js").catch(() => null);
            if (!mod?.toggleAmbient) {
                btn.dataset.state = "off";
                btn.setAttribute("aria-pressed", "false");
                return;
            }
            const playing = await mod.toggleAmbient();
            btn.dataset.state = playing ? "on" : "off";
            btn.setAttribute("aria-pressed", String(playing));
            btn.setAttribute(
                "aria-label",
                playing ? "Tắt nhạc nền" : "Bật nhạc nền và âm thanh",
            );
            // đổi icon loa: tắt ↔ bật
            const icon = btn.querySelector("[data-lucide]");
            if (icon) {
                const next = playing ? "volume-2" : "volume-x";
                if (icon.getAttribute("data-lucide") !== next) {
                    icon.setAttribute("data-lucide", next);
                    if (window.lucide?.createIcons)
                        window.lucide.createIcons({ attrs: {} });
                }
            }
        });
    document.getElementById("btn-fullscreen")?.addEventListener("click", () => {
        if (document.fullscreenElement)
            document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    document.getElementById("btn-card")?.addEventListener("click", () => {
        if ((toolbarScroll?.progress ?? 0) >= 0.96) card.openCard();
        else toolbarScroll?.scrollTo(1);
    });
}
