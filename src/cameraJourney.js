/**
 * cameraJourney.js — Đường đi camera điều khiển trực tiếp bởi scroll (§7).
 * CatmullRomCurve3 + lookAt + smoothing. Có thể đảo ngược hoàn toàn.
 * Thêm: lắc nhẹ theo chuột khi ngắm trời (parallax), cộng dồn sau lookAt,
 * không phá đường scroll.
 */
import * as THREE from "three";
import { PHYSICS } from "./config.js";
import { clamp, damp, smootherstep } from "./utils/math.js";

// A: toàn cảnh → B: tiến vào → C: đi giữa hoa → D: điểm cuối
// A: toàn cảnh → B: tiến vào → C: đi giữa hoa → D: tới cây đại thụ → E: zoom thiệp
const POS_POINTS = [
  [1.6, 4.4, 34],
  [1.4, 2.6, 22],
  [1.2, 2.1, 13],
  [0.2, 1.9, 5],
  [-0.4, 1.75, -2.5],
  [0.35, 1.7, -9.5],
  [0.0, 1.8, -16],
  [0.0, 1.95, -25],
  [0.0, 2.4, -34],
  [0.0, 3.4, -43],
  [0.2, 4.6, -51],
  [0.7, 5.0, -56.5],
  [1.2, 4.7, -59.2],
  [1.6, 4.62, -59.5],
  [1.47, 4.58, -60.2],
  [1.41, 4.57, -60.55],
  [1.39, 4.57, -60.7],
  [1.388, 4.57, -60.74],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const TARGET_POINTS = [
  [0, 2.2, 4],
  [-0.4, 1.7, 4],
  [-0.6, 1.55, 0.5],
  [-0.3, 1.55, -4],
  [0.2, 1.5, -10],
  [0.0, 1.55, -16],
  [0.0, 1.7, -28],
  [0.0, 2.4, -42],
  [0.0, 4.5, -56],
  [0.0, 8.5, -60.5],
  [0.3, 7.0, -60.6],
  [0.9, 5.2, -60.65],
  [0.95, 4.8, -60.8],
  [1.06, 4.58, -61.0],
  [1.064, 4.57, -61.02],
  [1.064, 4.57, -61.02],
  [1.064, 4.57, -61.02],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

export function createCameraJourney(camera) {
  const posCurve = new THREE.CatmullRomCurve3(POS_POINTS, false, "centripetal", 0.12);
  const tgtCurve = new THREE.CatmullRomCurve3(TARGET_POINTS, false, "centripetal", 0.12);
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const smPos = new THREE.Vector3();
  const smTgt = new THREE.Vector3();
  // chuột chuẩn hoá -1..1 để lắc parallax khi ở trên trời
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  const swayEuler = new THREE.Euler(0, 0, 0, "YXZ");
  let ready = false;
  let lastProgress = -1;

  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      mouse.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouse.ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
      mouse.active = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      mouse.tx = 0; mouse.ty = 0; mouse.active = false;
    }, { passive: true });
    window.addEventListener("blur", () => {
      mouse.tx = 0; mouse.ty = 0; mouse.active = false;
    });
  }

  function snap(p) {
    const e = smootherstep(0, 1, clamp(p, 0, 1));
    posCurve.getPoint(e, pos);
    tgtCurve.getPoint(e, tgt);
    smPos.copy(pos); smTgt.copy(tgt);
    camera.position.copy(pos);
    camera.lookAt(tgt);
    lastProgress = p; ready = true;
  }

  function update(progress, dt, t = 0) {
    const p = clamp(progress, 0, 1);
    if (!ready) { snap(p); return; }
    const e = smootherstep(0, 1, p);
    posCurve.getPoint(e, pos);
    tgtCurve.getPoint(e, tgt);
    // smoothing: nhanh khi cuộn nhanh, mượt khi dừng
    const k = 1 - Math.exp(-dt * (Math.abs(p - lastProgress) > 0.002 ? 7.5 : 4.2));
    smPos.lerp(pos, k);
    smTgt.lerp(tgt, k);
    camera.position.copy(smPos);
    camera.lookAt(smTgt);
    lastProgress = p;

    // Lắc theo chuột: mạnh khi ở trên trời, nhẹ dần khi chui vào hoa
    // pointer.y>0 = nửa trên màn hình (thường là trời) → lắc nhiều hơn
    mouse.x = damp(mouse.x, mouse.tx, PHYSICS.skySwayLag, dt);
    mouse.y = damp(mouse.y, mouse.ty, PHYSICS.skySwayLag, dt);
    const skyAmount = clamp(0.35 + mouse.y * -0.65 + (1 - e) * 0.35, 0, 1);
    const amp = PHYSICS.skySwayRadius * (0.25 + skyAmount * 0.75);
    if ((Math.abs(mouse.x) > 0.001 || Math.abs(mouse.y) > 0.001) && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const wobble = Math.sin(t * PHYSICS.skySwaySpeed) * 0.12 + 1;
      swayEuler.set(
        -mouse.y * amp * wobble,
        mouse.x * amp * 1.25 * wobble,
        mouse.x * amp * -0.18,
      );
      camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(swayEuler));
    }
  }

  snap(0);
  return { update, snap };
}
