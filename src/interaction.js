/**
 * interaction.js — 2 chế độ theo vị trí con trỏ:
 *  • Chuột ở TRÊN TRỜI (ray không chạm hoa/đất): trả về mode "sky",
 *    cameraJourney sẽ lắc parallax theo chuột.
 *  • Chuột ở DƯỚI HOA (ray chạm hoa): mode "flower", hoa gần điểm chạm
 *    rung theo lò xo riêng, không rung đồng loạt, không chiếm scroll.
 */
import * as THREE from "three";
import { PHYSICS } from "./config.js";
import { clamp } from "./utils/math.js";

export function createFlowerInteraction({ camera, flowerMeshes, flowerData, dom }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const target = new THREE.Vector3();
  let active = false;
  let lastX = 0, lastY = 0;
  const dummy = new THREE.Object3D();
  const hit = new THREE.Vector3();

  function setPointer(cx, cy) {
    const r = dom.getBoundingClientRect();
    pointer.x = ((cx - r.left) / r.width) * 2 - 1;
    pointer.y = -((cy - r.top) / r.height) * 2 + 1;
  }

  dom.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    setPointer(e.clientX, e.clientY);
    lastX = e.clientX; lastY = e.clientY;
    active = true;
  }, { passive: true });

  dom.addEventListener("pointerleave", () => { active = false; pointer.set(-10, -10); }, { passive: true });
  dom.addEventListener("pointerdown", (e) => { setPointer(e.clientX, e.clientY); active = true; }, { passive: true });
  dom.addEventListener("pointerup", () => { if (matchMedia("(pointer: coarse)").matches) { active = false; pointer.set(-10, -10); } }, { passive: true });

  // Mặt phẳng ngang tầm hoa để tính điểm chạm:
  // rẻ hơn raycast vào mesh hàng nghìn instance rất nhiều,
  // mà vẫn chính xác cảm nhận "chuột đang chỉ vào hoa".
  const flowerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
  const planeHit = new THREE.Vector3();
  // Ngưỡng NDC: chuột ở nửa trên màn hình coi như đang ngắm trời
  const SKY_NDC_Y = 0.18;

  // Lưới không gian thô: chỉ xét hoa trong ô lân cận điểm chạm,
  // thay vì duyệt hàng nghìn cây mỗi frame khi vườn full-density.
  const CELL = 4;
  const grid = new Map();
  const gridKey = (gx, gz) => gx * 73856093 ^ gz * 19349663;
  for (let i = 0; i < flowerData.length; i++) {
    const f = flowerData[i];
    const gx = Math.floor(f.x / CELL), gz = Math.floor(f.z / CELL);
    const k = gridKey(gx, gz);
    let arr = grid.get(k);
    if (!arr) { arr = []; grid.set(k, arr); }
    arr.push(i);
  }
  // hoa đang nghiêng (cần hồi vị) — chỉ update nhóm này + nhóm gần chuột
  const activeSet = new Set();
  const pendingCurve = new Set();

  function update(dt, t) {
    // lò xo hồi vị cho mọi cây (rẻ: chỉ tính toán số)
    const k = PHYSICS.springStiffness, d = PHYSICS.damping;
    let hasTarget = false;
    let mode = "idle";
    if (active) {
      raycaster.setFromCamera(pointer, camera);
      const ray = raycaster.ray;
      const lookingAtSky = pointer.y > SKY_NDC_Y || ray.direction.y > 0.03;
      if (!lookingAtSky && ray.intersectPlane(flowerPlane, planeHit)) {
        if (Math.abs(planeHit.x) < 30 && planeHit.z > -60 && planeHit.z < 24) {
          hit.copy(planeHit);
          hasTarget = true;
          mode = "flower";
        } else {
          mode = "sky";
        }
      } else {
        mode = "sky";
      }
    }
    const R = PHYSICS.interactionRadius;
    const R2 = R * R;
    // thu thập index cần update: ô lân cận điểm chạm + hoa đang nghiêng
    let candidates = null;
    if (hasTarget) {
      candidates = activeSet;
      candidates.clear();
      const gx0 = Math.floor((hit.x - R) / CELL), gx1 = Math.floor((hit.x + R) / CELL);
      const gz0 = Math.floor((hit.z - R) / CELL), gz1 = Math.floor((hit.z + R) / CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const arr = grid.get(gridKey(gx, gz));
          if (arr) for (let a = 0; a < arr.length; a++) candidates.add(arr[a]);
        }
      }
      // cộng thêm hoa đang nghiêng dở (để hồi vị mượt)
      for (const i of pendingCurve) candidates.add(i);
    } else {
      candidates = pendingCurve.size ? pendingCurve : null;
      if (candidates) {
        // copy ra vì sẽ xóa dần trong vòng lặp
        activeSet.clear();
        for (const i of candidates) activeSet.add(i);
        candidates = activeSet;
      }
    }
    const dirtyMeshes = new Set();
    if (candidates) {
      for (const i of candidates) {
        const f = flowerData[i];
        if (!f) continue;
        let fx = 0, fz = 0;
        if (hasTarget) {
          const dx = f.x - hit.x, dz = f.z - hit.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < R2) {
            const dist = Math.sqrt(d2) || 0.001;
            const fall = Math.pow(1 - dist / R, PHYSICS.distanceFalloff);
            // đẩy ra xa điểm chạm + nghiêng theo hướng con trỏ
            const push = fall * PHYSICS.interactionStrength * 0.5;
            fx = (dx / dist) * push + Math.sin(t * 3 + f.phase) * 0.03 * fall;
            fz = (dz / dist) * push + Math.cos(t * 2.6 + f.phase) * 0.03 * fall;
          }
        }
        // tích phân lò xo
        f.velX += ((-k * (f.bendX - fx)) - d * f.velX) * dt;
        f.velZ += ((-k * (f.bendZ - fz)) - d * f.velZ) * dt;
        f.bendX += f.velX * dt;
        f.bendZ += f.velZ * dt;
        // kẹp góc nghiêng
        f.bendX = clamp(f.bendX, -PHYSICS.maxBendAngle, PHYSICS.maxBendAngle);
        f.bendZ = clamp(f.bendZ, -PHYSICS.maxBendAngle, PHYSICS.maxBendAngle);
        const moving = Math.abs(f.bendX) > 0.0006 || Math.abs(f.bendZ) > 0.0006
          || Math.abs(f.velX) > 0.002 || Math.abs(f.velZ) > 0.002;
        if (moving || hasTarget) {
          dummy.position.set(f.x, f.y - 0.02, f.z);
          dummy.rotation.set(f.bendX, f.rotY, f.bendZ);
          dummy.scale.setScalar(f.scale);
          dummy.updateMatrix();
          if (f.meshSoft) { f.meshSoft.setMatrixAt(f.index, dummy.matrix); dirtyMeshes.add(f.meshSoft); }
          if (f.meshFoliage) { f.meshFoliage.setMatrixAt(f.index, dummy.matrix); dirtyMeshes.add(f.meshFoliage); }
        }
        if (moving) pendingCurve.add(i);
        else pendingCurve.delete(i);
      }
    }
    // chỉ upload GPU những mesh vừa đổi instance
    for (const m of dirtyMeshes) m.instanceMatrix.needsUpdate = true;
    // target cho bong bóng lời chúc (nếu cần)
    if (hasTarget) target.copy(hit);
    return { hasTarget, point: target, mode };
  }

  return { update };
}
