/** garden-planting.js — Trồng hoa InstancedMesh theo loài.
 * Full-density: giữ hành lang camera, còn lại phủ kín 3 vùng. */
import * as THREE from "three";
import { QUALITY } from "./config.js";
import { buildSpeciesTemplate } from "./flowers/flowerFactory.js";
import { SPECIES, SPECIES_IDS } from "./flowers/flowerSpecies.js";
import { makeRng } from "./utils/rng.js";
import { clamp } from "./utils/math.js";
import {
    COUNT_BY_SPECIES,
    LOD_OVERRIDE,
    FlowerOccupancy,
    pickFlowerSpots,
} from "./garden-flowers.js";

export function plantGarden({ scene, noise, groundY, materials, qualityName }) {
    const Q = QUALITY[qualityName] || QUALITY.medium;
    const rng = makeRng(20251020);
    const flowerMeshes = [];
    const flowerData = [];
    const dummy = new THREE.Object3D();
    const tmp = new THREE.Color();
    // Lưới chặn va chạm dùng chung cho MỌI loài — nhờ vậy hoa không
    // cắm chồng lên nhau (trước đây mỗi loài trồng độc lập nên bị lồng nhau)
    const occupancy = new FlowerOccupancy(3.5);
    // Full-density trên mobile: LOD thấp cho tất cả để giữ 60fps
    const forceLow = qualityName !== "high";

    for (const id of SPECIES_IDS) {
        const species = SPECIES[id];
        const count = Math.round((COUNT_BY_SPECIES[id] || 40) * Q.fieldDetail);
        if (count < 4) continue;
        const lod = forceLow ? "low" : LOD_OVERRIDE[id] || qualityName;
        const tpl = buildSpeciesTemplate(id, {
            rng: makeRng(20251020 + id.length * 977 + count),
            lod,
            seg: Q.petalSegments,
            leafSeg: Q.leafSegments,
        });
        if (!tpl.soft && !tpl.foliage) continue;
        // Bán kính đầu hoa đo thật từ hình học vừa build (giữa vòng cánh ngoài)
        let headRadius = 0.4;
        if (tpl.soft) {
            tpl.soft.computeBoundingBox();
            const bb = tpl.soft.boundingBox;
            headRadius = Math.max(
                Math.abs(bb.min.x),
                bb.max.x,
                Math.abs(bb.min.z),
                bb.max.z,
            );
        }
        const hR = species.height || [0.5, 1];
        const scaleBias = Q.flowerScale * (0.9 + (hR[1] - 0.4) * 0.22);
        const spots = pickFlowerSpots({
            rng,
            noise,
            count,
            speciesId: id,
            headRadius,
            scaleBias,
            occupancy,
        });
        const n = spots.length;
        if (!n) continue;
        const opens = new Float32Array(n);
        const tints = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            opens[i] = rng.range(0.72, 1);
            tmp.set(rng.pick(species.schemes).tint);
            const hsl = {};
            tmp.getHSL(hsl);
            tmp.setHSL(
                hsl.h + rng.range(-0.015, 0.015),
                clamp(hsl.s * rng.range(0.9, 1.1), 0, 1),
                clamp(hsl.l * rng.range(0.92, 1.08), 0, 1),
            );
            tints[i * 3] = tmp.r;
            tints[i * 3 + 1] = tmp.g;
            tints[i * 3 + 2] = tmp.b;
        }
        const mk = (geo, mat) => {
            if (!geo) return null;
            geo.setAttribute(
                "aOpen",
                new THREE.InstancedBufferAttribute(opens, 1),
            );
            geo.setAttribute(
                "aInstTint",
                new THREE.InstancedBufferAttribute(tints, 3),
            );
            const mesh = new THREE.InstancedMesh(geo, mat, n);
            // Full-density: chỉ hero (LOD cao) đổ bóng để giữ 60fps,
            // loài nền + thảm cỏ không đổ bóng nhưng vẫn nhận sáng.
            mesh.castShadow = !!Q.shadows && lod !== "low";
            mesh.frustumCulled = false;
            mesh.userData.speciesId = id;
            return mesh;
        };
        const softMesh = mk(tpl.soft, materials.soft);
        const folMesh = mk(tpl.foliage, materials.foliage);
        for (let i = 0; i < n; i++) {
            const { x, z, scale } = spots[i];
            const y = groundY(x, z);
            const s = Math.max(0.4, scale);
            dummy.position.set(x, y - 0.02, z);
            dummy.rotation.set(
                rng.range(-0.05, 0.05),
                rng.range(0, 6.283),
                rng.range(-0.05, 0.05),
            );
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            if (softMesh) softMesh.setMatrixAt(i, dummy.matrix);
            if (folMesh) folMesh.setMatrixAt(i, dummy.matrix);
            flowerData.push({
                x,
                y,
                z,
                scale: s,
                rotY: dummy.rotation.y,
                phase: rng.range(0, 6.283),
                bendX: 0,
                bendZ: 0,
                velX: 0,
                velZ: 0,
                meshSoft: softMesh,
                meshFoliage: folMesh,
                index: i,
                headY: y + (tpl.meta?.headY || 0.8) * s,
            });
        }
        if (softMesh) {
            softMesh.instanceMatrix.needsUpdate = true;
            scene.add(softMesh);
            flowerMeshes.push(softMesh);
        }
        if (folMesh) {
            folMesh.instanceMatrix.needsUpdate = true;
            scene.add(folMesh);
            flowerMeshes.push(folMesh);
        }
    }
    return { flowerMeshes, flowerData };
}
