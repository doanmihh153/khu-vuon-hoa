/** garden-carpet.js — Thảm hoa nền phủ kín mặt đất.
 *  Rất rẻ: 2 InstancedMesh (1 hoa tí hon + 1 cỏ), 1 draw call mỗi loại.
 *  Lấp mọi khoảng đất trống giữa các hoa hero → "thế giới hoa".
 */
import * as THREE from "three";
import { makeRng } from "./utils/rng.js";
import { clamp } from "./utils/math.js";

/** Hoa tí hon 5 cánh (2 tam giác / cánh) — dùng cho thảm hoa & quanh gốc cây. */
export function buildCarpetFlowerGeometry() {
    const petalPos = [];
    const petalCol = [];
    const petalIdx = [];
    let vi = 0;
    const pushVert = (x, y, z, shade) => {
        petalPos.push(x, y, z);
        petalCol.push(shade, shade * 0.9, shade * 0.96);
    };
    for (let p = 0; p < 5; p++) {
        const a0 = (p / 5) * Math.PI * 2;
        const a1 = ((p + 0.85) / 5) * Math.PI * 2;
        const r0 = 0.015, r1 = 0.075;
        const cx = Math.cos(a0) * r0, cz = Math.sin(a0) * r0;
        const ox = Math.cos(a0) * r1, oz = Math.sin(a0) * r1;
        const sx = Math.cos(a1) * r0, sz = Math.sin(a1) * r0;
        pushVert(cx, 0.1, cz, 0.52);
        pushVert(ox, 0.12, oz, 0.62);
        pushVert(sx, 0.1, sz, 0.52);
        petalIdx.push(vi, vi + 1, vi + 2);
        vi += 3;
    }
    // nhụy vàng
    pushVert(0, 0.13, 0, 0.72);
    pushVert(0.02, 0.11, 0.012, 0.6);
    pushVert(-0.018, 0.11, 0.014, 0.6);
    petalIdx.push(vi, vi + 1, vi + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(petalPos), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(petalCol), 3));
    geo.setIndex(petalIdx);
    geo.computeVertexNormals();
    return geo;
}

/** Cỏ 3 lá — màu xanh lá thật. */
export function buildCarpetGrassGeometry() {
    const grassPos = [];
    const grassCol = [];
    const grassIdx = [];
    let vi = 0;
    for (let b = 0; b < 3; b++) {
        const tilt = 0.5 + b * 0.22;
        const az = (b / 3) * Math.PI * 2;
        const dx = Math.cos(az), dz = Math.sin(az);
        const bx = 0, bz = 0, by = 0;
        const tx = dx * 0.09, tz = dz * 0.09, ty = 0.16 - tilt * 0.05;
        grassPos.push(
            bx, by, bz,
            tx, ty, tz,
            bx - dz * 0.02, by + 0.02, bz + dx * 0.02,
        );
        const sh = 0.4 + b * 0.09;
        grassCol.push(
            sh * 0.72, sh, sh * 0.5,
            sh * 0.78, sh * 1.08, sh * 0.55,
            sh * 0.72, sh, sh * 0.5,
        );
        grassIdx.push(vi, vi + 1, vi + 2);
        vi += 3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(grassPos), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(grassCol), 3));
    geo.setIndex(grassIdx);
    geo.computeVertexNormals();
    return geo;
}

export const CARPET_PALETTE = [
    0xf7a8c4, 0xffffff, 0xf9dc7a, 0xc9a8e8, 0xef7fa0, 0xffd9e6,
];

export function plantCarpet({ scene, noise, groundY, qualityName, count = 5200 }) {
    const rng = makeRng(9992025);
    const isLow = qualityName === "low";
    const n = isLow ? Math.round(count * 0.5) : count;

    const flowerGeo = buildCarpetFlowerGeometry();
    const grassGeo = buildCarpetGrassGeometry();

    const flowerMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        side: THREE.DoubleSide,
    });
    const grassMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        side: THREE.DoubleSide,
    });

    const palette = CARPET_PALETTE.map((h) => new THREE.Color(h));
    const dummy = new THREE.Object3D();
    const tmp = new THREE.Color();

    const spots = [];
    let guard = 0;
    while (spots.length < n && guard++ < n * 12) {
        const x = rng.range(-34, 34);
        const z = rng.range(-60, 26);
        if (Math.abs(x) < 1.3) continue; // hành lang camera
        const farEdge = Math.min(1, Math.max(0, (Math.abs(x) - 16) / 16));
        const meadow = noise.fbm01(x * 0.09 + 11.7, z * 0.09 + 4.2, 3);
        if (rng.next() > 0.3 + meadow * 0.85 - farEdge * 0.2) continue;
        spots.push({ x, z });
    }

    const fm = new THREE.InstancedMesh(flowerGeo, flowerMat, spots.length);
    const gm = new THREE.InstancedMesh(grassGeo, grassMat, spots.length);
    fm.frustumCulled = false;
    gm.frustumCulled = false;
    for (let i = 0; i < spots.length; i++) {
        const { x, z } = spots[i];
        const y = groundY(x, z);
        dummy.position.set(x, y - 0.01, z);
        dummy.rotation.set(0, rng.range(0, 6.283), 0);
        dummy.scale.setScalar(rng.range(0.8, 1.9));
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
        tmp.copy(rng.pick(palette));
        fm.setColorAt(i, tmp);
        dummy.position.set(
            x + rng.range(-0.15, 0.15),
            y - 0.01,
            z + rng.range(-0.15, 0.15),
        );
        dummy.rotation.set(0, rng.range(0, 6.283), 0);
        dummy.scale.setScalar(rng.range(0.9, 2.2));
        dummy.updateMatrix();
        gm.setMatrixAt(i, dummy.matrix);
    }
    fm.instanceMatrix.needsUpdate = true;
    gm.instanceMatrix.needsUpdate = true;
    if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    scene.add(fm, gm);
    return { count: spots.length };
}
