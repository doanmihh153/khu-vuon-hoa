/**
 * main.js (1/2) — Entry: LOADING → READY → WELCOME → REVEALING_GARDEN
 * → GARDEN_OVERVIEW ⇄ GARDEN_JOURNEY ⇄ CARD. Một vòng lặp duy nhất.
 */
import { AppState, store } from "./state.js";
import { smootherstep } from "./utils/math.js";
import * as THREE from "three";
import { createCore } from "./garden-core.js";
import { plantGarden } from "./garden-planting.js";
import { plantCarpet } from "./garden-carpet.js";
import { plantHeroTree } from "./garden-tree.js";
import { buildAtmosphere } from "./garden-atmosphere.js";
import { initFlowerMaterials } from "./garden-flowers.js";
import { plantUniforms } from "./flowers/flowerFactory.js";
import { createCameraJourney } from "./cameraJourney.js";
import { createScrollDriver } from "./scrollDriver.js";
import { createFlowerInteraction } from "./interaction.js";
import { initWelcome } from "./welcome.js";
import { initCard } from "./card.js";
import { initCardActions } from "./card-actions.js";
import { HERO_WISHES } from "./greetings.js";
import { wireFlowerInfo, wireToolbar, setToolbarScroll } from "./ui-wiring.js";

/** Hướng mặt trời (world) — dùng cho SSS của cánh hoa. */
const SUN_DIR = new THREE.Vector3(18, 26, 14).normalize();
const _sunWorld = new THREE.Vector3();

export async function boot() {
  store.set(AppState.INITIALIZING);
  const welcome = initWelcome();
  store.set(AppState.LOADING);
  store.set(AppState.WELCOME);

  const stage = document.getElementById("garden-canvas-container");
  const heroWish = document.getElementById("hero-wish");
  const whiteout = document.getElementById("whiteout");
  const hint = document.getElementById("scroll-hint");
  const hero = document.getElementById("hero");
  let wi = 0;
  const rotateWish = () => {
    if (heroWish && HERO_WISHES.length) {
      heroWish.textContent = "“" + HERO_WISHES[wi % HERO_WISHES.length] + "”";
      wi++;
    }
  };
  rotateWish();
  setInterval(rotateWish, 6000);

  try {
    welcome.setLoadProgress(0.08, "Đang gieo hạt cho khu vườn…");
    const isMobile = matchMedia("(pointer: coarse)").matches;
    const qualityName = isMobile ? "low" : (window.innerWidth < 900 ? "medium" : "high");
    await new Promise((r) => setTimeout(r, 30));
    welcome.setLoadProgress(0.2, "Đang dựng bầu trời và mặt đất…");

    const core = createCore({ container: stage, qualityName });
    welcome.setLoadProgress(0.45, "Đang trồng hàng nghìn đóa hoa…");
    await new Promise((r) => setTimeout(r, 30));

    const materials = initFlowerMaterials();
    const planted = plantGarden({ scene: core.scene, noise: core.noise, groundY: core.groundY, materials, qualityName });
    plantCarpet({ scene: core.scene, noise: core.noise, groundY: core.groundY, qualityName });
    welcome.setLoadProgress(0.72, "Đang thả bướm và cánh hoa…");
    await new Promise((r) => setTimeout(r, 30));

    const atmosphere = buildAtmosphere({ scene: core.scene, rng: core.rng, quality: core.quality });
    const journey = createCameraJourney(core.camera);
    welcome.setLoadProgress(0.88, "Đang căn đường đi của camera…");

    for (let i = 0; i < 4; i++) {
      atmosphere.update(1 / 60, i / 60);
      plantUniforms.uTime.value = i / 60;
      journey.snap(0);
      core.renderer.render(core.scene, core.camera);
      await new Promise((r) => requestAnimationFrame(r));
    }

    window.addEventListener("resize", () => {
      core.camera.aspect = window.innerWidth / window.innerHeight;
      core.camera.updateProjectionMatrix();
      core.renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    const interaction = createFlowerInteraction({
      camera: core.camera, flowerMeshes: planted.flowerMeshes,
      flowerData: planted.flowerData, dom: core.renderer.domElement,
    });
    // scroll trước để card dùng được callback cuộn về
    const scroll = createScrollDriver({
      spacer: document.getElementById("journey-spacer"),
      onProgress: null,
    });
    const card = initCard({ onCloseToGarden: () => scroll.scrollTo(0) });
    initCardActions();

    // Cây đại thụ ở cuối hành trình + tấm thiệp gắn trên thân.
    // Đặt SAU initCard để lấy được nội dung thiệp hiện tại.
    welcome.setLoadProgress(0.93, "Đang trồng cây đại thụ cuối hành trình…");
    const tree = plantHeroTree({
        scene: core.scene,
        groundY: core.groundY,
        quality: core.quality,
        cardNode: card.fillTreeCard(),
    });
    wireFlowerInfo();
    wireToolbar({ card });
    // gán handler progress sau khi card đã sẵn sàng
    scroll.setHandler((p) => {
        store.setProgress(p);
        if (p > 0.02) {
          if (store.state === AppState.GARDEN_OVERVIEW) store.set(AppState.GARDEN_JOURNEY);
        } else if (store.state === AppState.GARDEN_JOURNEY) {
          store.set(AppState.GARDEN_OVERVIEW);
        }
        card.syncWithProgress(p);
        // Chuyển dần ra trắng khi camera lao vào tờ giấy trên thân cây
        if (whiteout) {
            whiteout.style.opacity = String(smootherstep(0.86, 0.972, p));
        }
        if (hero) hero.style.opacity = String(Math.max(0, 1 - p * 3.2));
        if (hint) hint.style.opacity = String(Math.max(0, 1 - p * 8));
    });
    document.getElementById("btn-open-card-fallback")?.addEventListener("click", () => card.openCard());
    document.querySelectorAll("[data-open-card]").forEach((b) => {
      if (b.id === "btn-open-card-fallback") return;
      b.addEventListener("click", () => card.openCard());
    });

    welcome.setLoadProgress(1, "Khu vườn đã sẵn sàng!");
    store.set(AppState.READY, { gardenReady: true });
    setTimeout(() => welcome.reveal(), 650);

    setToolbarScroll(scroll);

    const clock = { last: performance.now() };
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (document.hidden) { clock.last = now; return; }
      const dt = Math.min(0.05, (now - clock.last) / 1000);
      clock.last = now;
      const t = now / 1000;
      atmosphere.update(dt, t);
      tree.update(dt, t);
      plantUniforms.uTime.value = t;
      // hướng mặt trời trong không gian camera (cho SSS của cánh hoa)
      _sunWorld.copy(SUN_DIR).transformDirection(core.camera.matrixWorldInverse);
      plantUniforms.uSunViewDir.value.copy(_sunWorld);
      interaction.update(dt, t);
      tree.setReveal(scroll.progress);
      journey.update(scroll.progress, dt, t);
      core.renderer.render(core.scene, core.camera);
    };
    requestAnimationFrame(loop);
    window.__garden = { core, ...planted, journey, scroll };
  } catch (err) {
    console.error("[main] khởi tạo thất bại:", err);
    store.set(AppState.ERROR, { error: String(err?.message || err) });
    welcome.fail("Không tải được khu vườn 3D (" + (err?.message || "lỗi WebGL") + "). Bạn vẫn có thể mở thiệp bên dưới.");
  }
}

boot();
