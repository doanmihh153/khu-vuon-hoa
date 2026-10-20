/**
 * garden-tree.js — CÂY ĐẠI THỤ ở cuối hành trình.
 *
 * Cây là mốc địa lý "điểm đến": to bằng ~20 lần một bông hoa, ẩn khỏi
 * khung cảnh cho tới giữa hành trình rồi hiện ra, tấm thiệp gắn trên thân,
 * xung quanh gốc có cỏ - hoa - bướm - hạt sáng.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createStemGeometry, stemPoint } from "./flowers/petalGeometry.js";
import { buildCarpetFlowerGeometry, buildCarpetGrassGeometry, CARPET_PALETTE } from "./garden-carpet.js";
import { createButterfly } from "./garden-atmosphere.js";
import { toPngWithFonts } from "./font-embed.js";
import { makeRng } from "./utils/rng.js";
import { TAU, lerp, clamp, easeOutCubic } from "./utils/math.js";

/** Gốc cây — nằm ngoài rìa khu vườn hoa. */
export const TREE_POS = new THREE.Vector3(0, 0, -62);
/** Vị trí tờ giấy trên thân (toạ độ cục bộ của cây) — sát mặt thân. */
export const TREE_CARD_POS = new THREE.Vector3(0.72, 4.4, 0.66);
/** Góc xoay để mặt giấy hướng ra ngoài (nhìn thẳng từ camera). */
export const TREE_CARD_ROT = 0.82;

/** Ngưỡng xuất hiện: ẩn hoàn toàn cho tới khi cuộn qua giữa hành trình. */
const REVEAL_AT = 0.44;
const REVEAL_OVER = 0.16;


/* ═══════════════════════════════════════════════════════════════
   Ống cong mượt — dùng cho thân cây & cành.
   Không dùng createStemGeometry vì bản đó có "wiggle" tạo mặt
   góc cạnh như mảnh vỡ, trông rất xấu với thân cây.
   ═══════════════════════════════════════════════════════════════ */
function tube({
    spine,           // (t) => [x, y, z]  — đường sống của ống
    radius,          // (t) => r
    rows = 18,
    cols = 18,
    wobble = 0.012,  // gợn vỏ cây
    seed = 0,
}) {
    const pos = [];
    const idx = [];
    const uvs = [];
    for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1);
        const [cx, cy, cz] = spine(t);
        const r = radius(t);
        // khung trục: hướng chính của đường sống
        const [ax, ay, az] = spine(Math.min(1, t + 0.01));
        const [bx, by, bz] = spine(Math.max(0, t - 0.01));
        let tx = ax - bx, ty = ay - by, tz = az - bz;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        // trục ngang & trục vuông góc
        let ux = -tz, uy = 0, uz = tx;
        const ul = Math.hypot(ux, uy, uz) || 1;
        ux /= ul; uz /= ul;
        const vx = ty * uz - tz * uy;
        const vy = tz * ux - tx * uz;
        const vz = tx * uy - ty * ux;
        for (let j = 0; j < cols; j++) {
            const a = (j / cols) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            const w = 1 + wobble * Math.sin(a * 5 + t * 11 + seed) +
                wobble * 0.6 * Math.sin(a * 9 - t * 7 + seed * 1.7);
            const rr = r * w;
            pos.push(
                cx + (ux * ca + vx * sa) * rr,
                cy + (uy * ca + vy * sa) * rr,
                cz + (uz * ca + vz * sa) * rr,
            );
            uvs.push(j / cols, t);
        }
    }
    for (let i = 0; i < rows - 1; i++) {
        for (let j = 0; j < cols; j++) {
            const j2 = (j + 1) % cols;
            const a = i * cols + j, b = i * cols + j2;
            const c = (i + 1) * cols + j2, d = (i + 1) * cols + j;
            idx.push(a, d, b, b, d, c);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
}



/** Vân vỏ cây: sọc dọc nâu + đốm rêu xanh. Bám theo UV của ống (u = vòng, v = cao). */
function makeBarkTexture() {
    const W = 256, H = 512;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#8a6446";
    ctx.fillRect(0, 0, W, H);

    // sọc dọc
    for (let i = 0; i < 190; i++) {
        const x = Math.random() * W;
        const w = 1 + Math.random() * 4.5;
        const dark = Math.random() < 0.55;
        ctx.fillStyle = dark
            ? `rgba(38,24,16,${0.1 + Math.random() * 0.3})`
            : `rgba(168,128,92,${0.06 + Math.random() * 0.2})`;
        let y = -20;
        while (y < H) {
            const len = 40 + Math.random() * 190;
            ctx.fillRect(x + (Math.random() - 0.5) * 3, y, w, len);
            y += len + Math.random() * 26;
        }
    }
    // vết nứt ngang
    for (let i = 0; i < 46; i++) {
        const y = Math.random() * H;
        const x = Math.random() * W;
        const w = 12 + Math.random() * 60;
        ctx.fillStyle = `rgba(30,18,12,${0.12 + Math.random() * 0.22})`;
        ctx.fillRect(x, y, w, 1 + Math.random() * 2.4);
    }
    // rêu / địa y ở chỗ tối
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = 3 + Math.random() * 13;
        ctx.fillStyle = `rgba(96,124,72,${0.05 + Math.random() * 0.16})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 5);
    t.anisotropy = 4;
    return t;
}

/** Texture tờ giấy trắng: nền ấm, sợi giấy mịn, viền mờ. */
function makePaperTexture() {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = S * 2; c.height = S;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf6";
    ctx.fillRect(0, 0, S, S);
    // vân giấy
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 9;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.8));
    }
    ctx.putImageData(img, 0, 0);
    // viền tối nhẹ ở rìa
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(120,90,80,.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S * 2, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

export function plantHeroTree({ scene, groundY, quality, cardNode }) {
    const rng = makeRng(20251021);
    const root = new THREE.Group();
    root.position.set(TREE_POS.x, groundY(TREE_POS.x, TREE_POS.z), TREE_POS.z);
    root.visible = false;
    scene.add(root);

    const group = new THREE.Group();
    root.add(group);

    /* ═══════════════  THÂN CÂY  ═══════════════ */
    const TRUNK_H = 16.5;
    const lean = 0.04;
    const leanDir = 0.6;
    const bow = 0.07;

    const trunkParts = [];

    // Đường sống thân: cong nhẹ kiểu chữ S, tự nhiên
    const trunkSpine = (t) => {
        const s1 = Math.sin(t * 1.35) * TRUNK_H * 0.028;
        const s2 = Math.sin(t * 2.4 + 0.8) * TRUNK_H * 0.016;
        return [
            s1 * Math.cos(leanDir) - s2 * Math.sin(leanDir),
            t * TRUNK_H,
            s1 * Math.sin(leanDir) + s2 * Math.cos(leanDir),
        ];
    };
    // Bán kính: thon dần + phình dần ở gốc (rễ nở)
    const trunkRadius = (t) => {
        let r = lerp(1.12, 0.4, Math.pow(t, 0.62));
        r += 0.85 * Math.exp(-t * 9); // phình gốc
        r *= 1 + 0.035 * Math.sin(t * 5.2 + 1.1);
        return r;
    };
    trunkParts.push(
        tube({
            spine: trunkSpine,
            radius: trunkRadius,
            rows: 26,
            cols: 22,
            wobble: 0.016,
            seed: 0.7,
        }),
    );

    // Rễ nở: 8 rễ cong mượt, GẤM XUỐNG ĐẤT (không trôi ngang như ván)
    for (let i = 0; i < 8; i++) {
        const az = (i / 8) * TAU + rng.range(-0.2, 0.2);
        const len = rng.range(1.7, 2.9);
        const ca = Math.cos(az), sa = Math.sin(az);
        trunkParts.push(
            tube({
                spine: (t) => {
                    const out = Math.pow(t, 0.8) * len;
                    const down = -Math.pow(t, 1.35) * 0.85;
                    return [ca * out, 0.55 + down, sa * out];
                },
                radius: (t) => lerp(0.46, 0.1, Math.pow(t, 0.5)),
                rows: 10,
                cols: 12,
                wobble: 0.022,
                seed: i * 1.7,
            }),
        );
    }

    // Cành chính: cong mượt từ thân vươn ra
    const branchTips = [];
    for (let i = 0; i < 13; i++) {
        const az = (i / 13) * TAU + rng.range(-0.2, 0.2);
        const t0 = 0.4 + (i / 13) * 0.5;
        const st = trunkSpine(t0);
        const len = rng.range(4.6, 8.4);
        const ca = Math.cos(az), sa = Math.sin(az);
        const upBias = rng.range(0.55, 0.95);
        const br = tube({
            spine: (t) => {
                const out = Math.pow(t, 0.85) * len;
                const up = t * len * upBias * 0.72;
                return [st[0] + ca * out, st[1] + up, st[2] + sa * out];
            },
            radius: (t) => lerp(0.42, 0.09, Math.pow(t, 0.55)),
            rows: 14,
            cols: 14,
            wobble: 0.022,
            seed: i * 2.3,
        });
        trunkParts.push(br);
        const tipT = 1;
        branchTips.push({
            x: st[0] + ca * len,
            y: st[1] + len * upBias * 0.72,
            z: st[2] + sa * len,
        });
    }

    const trunkGeo = mergeGeometries(trunkParts);
    paintTrunk(trunkGeo, TRUNK_H);
    const trunkMat = new THREE.MeshStandardMaterial({
        map: makeBarkTexture(),
        vertexColors: true,
        roughness: 0.98,
        metalness: 0,
    });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.castShadow = !!quality.shadows;
    trunkMesh.receiveShadow = !!quality.shadows;
    group.add(trunkMesh);

    /* ═══════════════  TÁN LÁ  ═══════════════ */
    const leafParts = [];
    const blobs = 38;
    for (let i = 0; i < blobs; i++) {
        let bx, by, bz;
        if (i < branchTips.length && i % 2 === 0) {
            const tp = branchTips[i];
            bx = tp.x + rng.range(-1.0, 1.0);
            by = tp.y + rng.range(0.1, 1.8);
            bz = tp.z + rng.range(-1.0, 1.0);
        } else {
            const a = rng.range(0, TAU);
            const rr = rng.range(0.5, 6.5);
            bx = Math.cos(a) * rr;
            by = rng.range(TRUNK_H * 0.72, TRUNK_H * 1.1);
            bz = Math.sin(a) * rr;
        }
        const r = rng.range(1.5, 3.2);
        const geo = new THREE.IcosahedronGeometry(r, 2);
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
            const n =
                Math.sin(x * 0.9 + i) * 0.5 +
                Math.cos(z * 0.7 - i) * 0.5 +
                Math.sin(y * 0.8) * 0.4;
            const f = 1 + n * 0.07;
            pos.setXYZ(k, x * f, y * f * 0.82, z * f);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        geo.translate(bx, by, bz);
        leafParts.push(geo);
    }
    const canopyGeo = mergeGeometries(leafParts);
    paintCanopy(canopyGeo, TRUNK_H);
    const canopyMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.castShadow = !!quality.shadows;
    group.add(canopy);

    /* ═══════════════  TẤM THIỆP TRÊN THÂN  ═══════════════ */
    const cardGroup = new THREE.Group();
    cardGroup.position.set(TREE_CARD_POS.x, TREE_CARD_POS.y, TREE_CARD_POS.z);
    cardGroup.rotation.y = TREE_CARD_ROT;
    group.add(cardGroup);

    /* ═══ ĐÈN ẤM + ĐÈN LỒNG ═══
       Không có đèn thì khoảng cuối hành trình tối đen. Đèn ấm + đèn lồng
       treo trên cành làm nổi bầu trời khu vườn. */
    const lamp = new THREE.PointLight(0xffc98a, 34, 22, 2);
    lamp.position.set(
        TREE_CARD_POS.x + 0.7,
        TREE_CARD_POS.y + 1.4,
        TREE_CARD_POS.z + 1.2,
    );
    group.add(lamp);

    const glowMat = new THREE.MeshStandardMaterial({
        color: 0xfff0c4,
        emissive: 0xffbe66,
        emissiveIntensity: 3.4,
        roughness: 0.5,
    });
    const lanternParts = [];
    for (let i2 = 0; i2 < 8; i2++) {
        const a = (i2 / 8) * TAU + rng.range(-0.2, 0.2);
        const rr = rng.range(2.5, 7.5);
        const y = rng.range(TRUNK_H * 0.6, TRUNK_H * 0.95);
        const g = new THREE.SphereGeometry(rng.range(0.16, 0.3), 10, 8);
        g.scale(1, 1.25, 1);
        g.translate(Math.cos(a) * rr, y, Math.sin(a) * rr);
        lanternParts.push(g);
    }
    const lanterns = new THREE.Mesh(mergeGeometries(lanternParts), glowMat);
    group.add(lanterns);

    /* ═══ BÁO THƯ gắn trên thân cây ═══
       Khi camera tới gần (scroll), nắp báo thư mở ra và tờ giấy
       trượt ra khỏi bưng — người xem đọc được lời chúc ngay trên thân. */
    const ENV_W = 2.6;
    const ENV_H = 1.5;
    const ENV_D = 0.12;

    const envGroup = new THREE.Group();
    envGroup.position.set(TREE_CARD_POS.x, TREE_CARD_POS.y, TREE_CARD_POS.z);
    envGroup.rotation.y = TREE_CARD_ROT;
    group.add(envGroup);

    const envMat = new THREE.MeshStandardMaterial({
        color: 0xf6efe3,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    // Nắp xanh dương (theo mẫu)
    const flapMat = new THREE.MeshStandardMaterial({
        color: 0x2f55c0,
        roughness: 0.7,
        metalness: 0.03,
        side: THREE.DoubleSide,
    });
    const envInner = new THREE.MeshStandardMaterial({
        color: 0xfff6f7,
        roughness: 0.9,
        side: THREE.DoubleSide,
    });

    // Vỏ báo thư: mặt sau + mặt trước + đáy + 2 cạnh (miệng mở ở trên)
    const shell = new THREE.Group();
    envGroup.add(shell);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, ENV_H), envMat);
    back.position.z = -ENV_D / 2;
    shell.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, ENV_H), envMat);
    front.position.z = ENV_D / 2;
    shell.add(front);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, ENV_D), envMat);
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -ENV_H / 2;
    shell.add(bottom);
    for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(ENV_D, ENV_H), envMat);
        side.rotation.y = Math.PI / 2;
        side.position.set((sx * ENV_W) / 2, 0, 0);
        shell.add(side);
    }
    // mép trên (nơi tờ giấy trượt ra)
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, 0.1), envInner);
    lip.rotation.x = -Math.PI / 2;
    lip.position.y = ENV_H / 2;
    shell.add(lip);

    // Nắp báo thư (hình tam giác) quay quanh cạnh trên
    // Nắp là HÌNH THANG (đơn giản, như hình mẫu)
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-ENV_W / 2, 0);
    flapShape.lineTo(ENV_W / 2, 0);
    flapShape.lineTo(ENV_W * 0.32, -ENV_H * 0.46);
    flapShape.lineTo(-ENV_W * 0.32, -ENV_H * 0.46);
    flapShape.closePath();
    const flapPivot = new THREE.Group();
    flapPivot.position.set(0, ENV_H / 2, ENV_D / 2);
    const flapGeo = new THREE.ShapeGeometry(flapShape, 12);
    {
        // nắp hơi cong về phía ngoài cho mềm
        const pp = flapGeo.attributes.position;
        for (let i = 0; i < pp.count; i++) {
            const x = pp.getX(i);
            const y = pp.getY(i);
            pp.setZ(i, Math.pow(1 - Math.abs(y) / (ENV_H * 0.46), 2) * 0.07);
        }
        pp.needsUpdate = true;
        flapGeo.computeVertexNormals();
    }
    const flap = new THREE.Mesh(flapGeo, flapMat);
    flapPivot.add(flap);
    envGroup.add(flapPivot);

    /* ── Tờ giấy (ảnh lời chúc) bên trong bưng ── */
    const LETTER_W = ENV_W * 0.92;
    const LETTER_H = ENV_H * 0.86;
    const letterGeo = new THREE.PlaneGeometry(LETTER_W, LETTER_H, 10, 12);
    {
        const p2 = letterGeo.attributes.position;
        for (let i = 0; i < p2.count; i++) {
            const x = p2.getX(i);
            const y = p2.getY(i);
            const u = y / LETTER_H + 0.5;
            // mép dưới cong nhẹ, phần trên hơi quăn
            p2.setZ(i, Math.pow(u, 3) * 0.1 + Math.cos((x / LETTER_W) * Math.PI) * 0.03);
        }
        p2.needsUpdate = true;
        letterGeo.computeVertexNormals();
    }
    /* TỜ GIẤY TRẮNG — khi camera dí sát, giấy lấp kín màn hình
       rồi bảng thiệp HTML hiện ra. Giấy có texture mịn (không chữ)
       để không lộ chi tiết lạ. */
    const paperTex = makePaperTexture();
    const cardMat = new THREE.MeshBasicMaterial({
        map: paperTex,
        color: 0xffffff,
        side: THREE.DoubleSide,
        toneMapped: true,
    });
    const cardMesh = new THREE.Mesh(letterGeo, cardMat);
    const letterPivot = new THREE.Group();
    letterPivot.add(cardMesh);
    envGroup.add(letterPivot);

    // hạt sáng quanh thiệp
    const sparkCount = 40;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkSeed = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
        const a = rng.range(0, TAU);
        const r = rng.range(0.3, 1.2);
        sparkPos[i * 3] = Math.cos(a) * r;
        sparkPos[i * 3 + 1] = rng.range(-1.1, 1.1);
        sparkPos[i * 3 + 2] = Math.sin(a) * r * 0.5 + 0.2;
        sparkSeed[i] = rng.range(0, 100);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute("aSeed", new THREE.BufferAttribute(sparkSeed, 1));
    const sparkMat = new THREE.PointsMaterial({
        size: 0.07,
        color: 0xffe2a8,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    cardGroup.add(sparks);

    if (cardNode && window.htmlToImage) {
        toPngWithFonts(cardNode, { pixelRatio: 2 })
            .then((url) => {
                const tex = new THREE.TextureLoader().load(url);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.anisotropy = 8;
                cardMat.map = tex;
                cardMat.needsUpdate = true;
            })
            .catch(() => {});
    }

    /* ═══════════════  CẢNH QUAN QUANH GỐC CÂY  ═══════════════ */
    // hoa nhỏ + cỏ vẽn quanh gốc
    const baseGroup = new THREE.Group();
    root.add(baseGroup);

    const flowerGeo = buildCarpetFlowerGeometry();
    const grassGeo = buildCarpetGrassGeometry();
    const flMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        side: THREE.DoubleSide,
    });
    const grMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        side: THREE.DoubleSide,
    });

    const N_FLOWER = 320;
    const N_GRASS = 520;
    const fMesh = new THREE.InstancedMesh(flowerGeo, flMat, N_FLOWER);
    const gMesh = new THREE.InstancedMesh(grassGeo, grMat, N_GRASS);
    fMesh.frustumCulled = false;
    gMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < N_FLOWER; i++) {
        const a = rng.range(0, TAU);
        const rr = rng.range(1.6, 13);
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr * 0.85;
        dummy.position.set(x, groundY(TREE_POS.x + x, TREE_POS.z + z) - TREE_POS.y - 0.02, z);
        dummy.rotation.set(0, rng.range(0, TAU), 0);
        dummy.scale.setScalar(rng.range(1.0, 2.4));
        dummy.updateMatrix();
        fMesh.setMatrixAt(i, dummy.matrix);
        col.set(rng.pick(CARPET_PALETTE));
        fMesh.setColorAt(i, col);
    }
    for (let i = 0; i < N_GRASS; i++) {
        const a = rng.range(0, TAU);
        const rr = rng.range(1.2, 16);
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr * 0.85;
        dummy.position.set(x, groundY(TREE_POS.x + x, TREE_POS.z + z) - TREE_POS.y - 0.02, z);
        dummy.rotation.set(0, rng.range(0, TAU), 0);
        dummy.scale.setScalar(rng.range(0.9, 2.0));
        dummy.updateMatrix();
        gMesh.setMatrixAt(i, dummy.matrix);
    }
    fMesh.instanceMatrix.needsUpdate = true;
    gMesh.instanceMatrix.needsUpdate = true;
    if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
    baseGroup.add(fMesh, gMesh);

    // bướm quanh thân
    const treeButterflies = [];
    for (let i = 0; i < 5; i++) {
        const b = createButterfly(i, rng, {
            cx: rng.range(-4, 4),
            cz: rng.range(-4, 4),
            r: rng.range(3.5, 7),
            r2: rng.range(2.5, 5),
            h: rng.range(2.5, 9),
            sp: rng.range(0.22, 0.45),
            scale: rng.range(1.6, 2.6),
        });
        baseGroup.add(b.group);
        treeButterflies.push(b);
    }

    // hạt sáng bay quanh gốc
    const dustCount = 160;
    const dustPos = new Float32Array(dustCount * 3);
    const dustSeed = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
        const a = rng.range(0, TAU);
        const rr = rng.range(1, 14);
        dustPos[i * 3] = Math.cos(a) * rr;
        dustPos[i * 3 + 1] = rng.range(0.2, 9);
        dustPos[i * 3 + 2] = Math.sin(a) * rr * 0.8;
        dustSeed[i] = rng.range(0, 100);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dustSeed, 1));
    const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
            size: 0.12,
            color: 0xffeccb,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }),
    );
    baseGroup.add(dust);

    /* ═══════════════  MỞ BÁO THƯ THEO SCROLL  ═══════════════ */
    function setOpen(p) {
        // nắp mở trước, tờ giấy trượt ra sau
        const flapT = clamp((p - 0.795) / 0.085, 0, 1);
        const letterT = clamp((p - 0.855) / 0.1, 0, 1);
        const fe = flapT * flapT * (3 - 2 * flapT);
        const le = letterT * letterT * (3 - 2 * letterT);
        flapPivot.rotation.x = -2.45 * fe;
        // tờ giấy trượt lên + đẩy ra ngoài, xoay nhẹ về phía camera
        letterPivot.position.set(0, -0.2 + 0.72 * le, -0.05 + 0.52 * le);
        letterPivot.rotation.x = -0.22 * le;
        letterPivot.visible = le > 0.001;
    }

    /* ═══════════════  HIỆN / ẨN THEO HÀNH TRÌNH  ═══════════════ */
    let reveal = 0;
    function setReveal(p) {
        const t = clamp((p - REVEAL_AT) / REVEAL_OVER, 0, 1);
        if (t <= 0.0005) {
            root.visible = false;
            reveal = 0;
            return;
        }
        root.visible = true;
        reveal = t;
        const s = 0.04 + 0.96 * easeOutCubic(t);
        group.scale.setScalar(s);
        baseGroup.scale.setScalar(0.3 + 0.7 * easeOutCubic(t));
        setOpen(p);
    }

    function update(dt, t) {
        if (!root.visible) return;
        // báo thư đung đưa nhẹ theo nhịp thở
        envGroup.rotation.z = Math.sin(t * 0.7) * 0.016;
        envGroup.position.y = TREE_CARD_POS.y + Math.sin(t * 0.85) * 0.02;
        // hạt sáng trôi lên
        const p = sparkGeo.attributes.position;
        for (let i = 0; i < sparkCount; i++) {
            let y = p.getY(i) + dt * 0.16;
            if (y > 1.2) y = -1.2;
            p.setY(i, y);
            p.setX(i, p.getX(i) + Math.sin(t * 0.8 + sparkSeed[i]) * dt * 0.05);
        }
        p.needsUpdate = true;
        // bụi quanh gốc
        const dp = dustGeo.attributes.position;
        for (let i = 0; i < dustCount; i++) {
            let y = dp.getY(i) + dt * 0.22;
            if (y > 9.5) y = 0.2;
            dp.setY(i, y);
            dp.setX(i, dp.getX(i) + Math.sin(t * 0.5 + dustSeed[i]) * dt * 0.08);
        }
        dp.needsUpdate = true;
        // bướm quanh thân
        for (const b of treeButterflies) b.update(dt, t);
    }

    return { root, group, update, setReveal, cardGroup, cardMesh, cardMat };
}

/* ═══════════════  Tô màu  ═══════════════ */

function paintTrunk(geo, trunkH) {
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        // sáng hơn ở trên, tối + rêu ở gốc
        const k = lerp(0.8, 1.18, Math.min(1, Math.max(0, y / trunkH)));
        const n = 0.9 + 0.16 * Math.sin(y * 2.4 + pos.getX(i) * 1.7);
        col[i * 3] = 0.92 * k * n;
        col[i * 3 + 1] = 0.88 * k * n;
        col[i * 3 + 2] = 0.8 * k * n;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

function paintCanopy(geo, trunkH) {
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const deep = new THREE.Color(0x2c5730);
    const mid = new THREE.Color(0x4b8a41);
    const light = new THREE.Color(0x8cb95d);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = Math.min(1, Math.max(0, (y - trunkH * 0.6) / (trunkH * 0.55)));
        c.copy(deep).lerp(mid, t);
        c.lerp(light, Math.max(0, t - 0.42) * 1.5);
        const n = 0.86 + 0.28 * Math.sin(pos.getX(i) * 0.9 + pos.getZ(i) * 0.7);
        col[i * 3] = c.r * n;
        col[i * 3 + 1] = c.g * n;
        col[i * 3 + 2] = c.b * n;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
