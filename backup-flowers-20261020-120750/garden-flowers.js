/** garden-flowers.js (1/2) — Khung + tiện ích trồng hoa instance. */
import * as THREE from "three";
import { QUALITY, PHYSICS } from "./config.js";
import { buildSpeciesTemplate, createPlantMaterials, plantUniforms } from "./flowers/flowerFactory.js";
import { SPECIES, SPECIES_IDS } from "./flowers/flowerSpecies.js";
import { makeRng } from "./utils/rng.js";
import { clamp } from "./utils/math.js";

export const COUNT_BY_SPECIES = {
  // FULL-WIDTH dày đặc: hero + nền đều tăng, thảm carpet lấp phần còn lại
  rose: 520, carnation: 420, peony: 340, tulip: 440, daisy: 420,
  chrysanthemum: 280, orchid: 220, lily: 340, sunflower: 200,
  babysbreath: 300, lavender: 280,
};

// Loài nền đông nhưng nặng → ép LOD thấp để giữ hiệu năng khi phủ kín.
// Hero (hồng, tulip, ly, lan) giữ LOD theo quality để vẫn đẹp khi dí sát.
export const LOD_OVERRIDE = {
  babysbreath: "low",
  lavender: "low",
  daisy: "low",
  chrysanthemum: "low",
  sunflower: "low",
  carnation: "low",
  peony: "low",
};

export function initFlowerMaterials() {
  const mats = createPlantMaterials();
  plantUniforms.uWindDir.value.set(...PHYSICS.windDirection);
  plantUniforms.uWindAmp.value = 0.16;
  plantUniforms.uWindBend.value = 0.55;
  plantUniforms.uLeafLag.value = PHYSICS.leafLag;
  return mats;
}

export function pickFlowerSpots({ rng, noise, count, speciesId }) {
  const items = [];
  let guard = 0;
  // FULL-WIDTH: lấp kín cả màn hình, không còn hàng lưa thưa.
  // 4 vùng: thảm chính rộng + rìa trái/phải xa + dải xa + sát lối đi.
  while (items.length < count && guard++ < count * 60) {
    const zone = rng.next();
    let x, z;
    if (zone < 0.42) {
      // thảm chính FULL-WIDTH: x mở tới ±30 (tràn cả 2 rìa màn hình)
      x = rng.range(-30, 30);
      z = rng.range(-40, 24);
    } else if (zone < 0.62) {
      // rìa trái / phải xa — lấp khoảng trống 2 bên khi nhìn toàn cảnh
      x = (rng.bool() ? 1 : -1) * rng.range(13, 30);
      z = rng.range(-50, 10);
    } else if (zone < 0.8) {
      // dải xa tạo chiều sâu
      x = rng.range(-28, 28);
      z = rng.range(-58, -28);
    } else {
      // sát lối đi cho tiền cảnh rực
      x = (rng.bool() ? 1 : -1) * rng.range(1.9, 5.5);
      z = rng.range(-18, 22);
    }
    if (Math.abs(x) < 1.35) continue; // giữ hành lang camera
    // xa rìa thì chấp nhận thưa hơn chút để tiết kiệm, gần thì dày đặc
    const farEdge = Math.min(1, Math.max(0, (Math.abs(x) - 14) / 14));
    const cluster = noise.fbm01(x * 0.11 + speciesId.length * 1.7, z * 0.11, 3);
    const meadow = noise.fbm01(x * 0.045 + 3.1, z * 0.045 + 9.4, 2);
    if (rng.next() > 0.28 + cluster * 0.65 + meadow * 0.35 - farEdge * 0.25) continue;
    items.push({ x, z });
  }
  return items;
}
