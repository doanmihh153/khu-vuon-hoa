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

/**
 * Lưới không gian chặn va chạm cho TOÀN VƯỜN.
 *
 * Trước đây mỗi loài trồng độc lập nên hoa của loài khác cứ cắm chồng lên
 * nhau (đầu hoa xuyên vào thân / đầu hoa kế bên) — trông như "pixel đè pixel".
 * Lưới này ghi nhớ mọi bông đã đặt (kèm bán kính đầu hoa) và từ chối mọi
 * vị trí sẽ khiến hai bông hoa cắt vào nhau.
 */
export class FlowerOccupancy {
    constructor(cell = 3) {
        this.cell = cell;
        this.map = new Map();
    }

    _key(gx, gz) {
        return gx * 73856093 ^ gz * 19349663;
    }

    /** Vị trí này có trùng với bông nào đã đặt không? */
    canPlace(x, z, r) {
        const c = this.cell;
        const gx0 = Math.floor((x - r) / c);
        const gx1 = Math.floor((x + r) / c);
        const gz0 = Math.floor((z - r) / c);
        const gz1 = Math.floor((z + r) / c);
        for (let gx = gx0; gx <= gx1; gx++) {
            for (let gz = gz0; gz <= gz1; gz++) {
                const arr = this.map.get(this._key(gx, gz));
                if (!arr) continue;
                for (let i = 0; i < arr.length; i++) {
                    const o = arr[i];
                    const dx = o.x - x;
                    const dz = o.z - z;
                    const min = o.r + r;
                    if (dx * dx + dz * dz < min * min) return false;
                }
            }
        }
        return true;
    }

    add(x, z, r) {
        const c = this.cell;
        const gx = Math.floor(x / c);
        const gz = Math.floor(z / c);
        const k = this._key(gx, gz);
        let arr = this.map.get(k);
        if (!arr) {
            arr = [];
            this.map.set(k, arr);
        }
        arr.push({ x, z, r });
    }
}

/**
 * Chọn vị trí trồng cho một loài.
 * @param headRadius bán kính đầu hoa (đơn vị thế giới) — dùng để chặn va chạm
 * @param occupancy  lưới FlowerOccupancy dùng chung cho cả vườn
 * @returns {Array<{x:number,z:number,scale:number}>}
 */
/** Tỉ lệ bán kính lõi so với bán kính đầu hoa — quyết định độ chặt. */
export const CORE_RATIO = 0.52;

export function pickFlowerSpots({
    rng,
    noise,
    count,
    speciesId,
    headRadius = 0.4,
    scaleRange = [0.85, 1.28],
    scaleBias = 1,
    occupancy = null,
}) {
    const items = [];
    let guard = 0;
    // FULL-WIDTH: lấp kín cả màn hình, không còn hàng lưa thưa.
    // 4 vùng: thảm chính rộng + rìa trái/phải xa + dải xa + sát lối đi.
    while (items.length < count && guard++ < count * 120) {
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
        const cluster = noise.fbm01(
            x * 0.11 + speciesId.length * 1.7,
            z * 0.11,
            3,
        );
        const meadow = noise.fbm01(x * 0.045 + 3.1, z * 0.045 + 9.4, 2);
        if (rng.next() > 0.28 + cluster * 0.65 + meadow * 0.35 - farEdge * 0.25)
            continue;

        // Cỡ hoa & kiểm tra va chạm với các bông đã có trong vườn.
        // Chỉ chặn va chạm ở phần LÕI đầu hoa (bán kính × CORE_RATIO);
        // mép cánh vẫn được phép ôm nhau như một bó hoa thật → vườn vẫn
        // dày đặc mà không bị "xuyên" vào nhau.
        const scale = rng.range(scaleRange[0], scaleRange[1]) * scaleBias;
        const r = headRadius * CORE_RATIO * scale + 0.04;
        if (occupancy && !occupancy.canPlace(x, z, r)) continue;
        occupancy?.add(x, z, r);

        items.push({ x, z, scale });
    }
    return items;
}
