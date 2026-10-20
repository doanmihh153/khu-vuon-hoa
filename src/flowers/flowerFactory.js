/**
 * Bộ tạo hoa.
 *
 * Một "cây hoa" được dựng hoàn toàn bằng hình học thủ tục, sau đó gộp
 * (merge) thành đúng 2 mesh:
 *   • soft    — cánh hoa + phần chi tiết ở giữa (màu thật, không bị nhuộm)
 *   • foliage — thân + lá (được nhuộm xanh bởi uTint)
 *
 * Toàn bộ hoa trong vườn dùng chung 2 vật liệu, nên draw call rất thấp.
 * Mỗi cây là một instance trong InstancedMesh: màu riêng (aInstTint),
 * góc hé nở riêng (aOpen) và góc nghiêng riêng (instanceMatrix).
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
    createPetalGeometry,
    createLeafGeometry,
    createStemGeometry,
    WidthProfile,
} from "./petalGeometry.js";
import { SPECIES } from "./flowerSpecies.js";
import { PALETTE } from "../config.js";
import { TAU, lerp, clamp } from "../utils/math.js";

/* ─────────────────────  Khung định hướng  ───────────────────── */

const _m = new THREE.Matrix4();
const _rx = new THREE.Matrix4();

/**
 * Khung trục cho một cánh/lá:
 *   X → chiều dài (hướng ra ngoài, nghiêng lên `tilt`)
 *   Y → pháp tuyến mặt trước
 *   Z → chiều ngang
 */
export function frameMatrix(azimuth, tilt, roll = 0) {
    const ca = Math.cos(tilt);
    const sa = Math.sin(tilt);
    const ct = Math.cos(azimuth);
    const st = Math.sin(azimuth);

    _m.makeBasis(
        new THREE.Vector3(ca * ct, sa, ca * st),
        new THREE.Vector3(-sa * ct, ca, -sa * st),
        new THREE.Vector3(-st, 0, ct),
    );

    if (roll) {
        _rx.makeRotationX(roll);
        _m.multiply(_rx);
    }
    return _m.clone();
}

/* ─────────────────────  Builder  ───────────────────── */

export class PlantBuilder {
    constructor({ rng, seg = [8, 4], leafSeg = [7, 3] } = {}) {
        this.rng = rng;
        this.seg = seg;
        this.leafSeg = leafSeg;
        this.soft = [];
        this.foliage = [];
        this.origin = new THREE.Vector3(0, 0, 0);
    }

    setOrigin(x, y, z) {
        this.origin.set(x, y, z);
        return this;
    }

    /* --- gán thuộc tính tùy biến cho một hình học --- */
    _tag(
        geo,
        {
            mask = 1,
            leaf = 0,
            petal = 0,
            foldPivot = null,
            foldTheta = 0,
            foldAmount = 0,
        } = {},
    ) {
        const count = geo.attributes.position.count;

        if (!geo.attributes.normal) geo.computeVertexNormals();
        if (!geo.attributes.uv) {
            geo.setAttribute(
                "uv",
                new THREE.BufferAttribute(new Float32Array(count * 2), 2),
            );
        }
        if (!geo.attributes.color) {
            const c = new Float32Array(count * 3).fill(1);
            geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
        }

        const flex = new Float32Array(count);
        const pos = geo.attributes.position.array;
        for (let i = 0; i < count; i++) flex[i] = pos[i * 3 + 1];

        geo.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));

        // Gói 4 giá trị nhỏ vào 1 vec4 để tiết kiệm attribute slot
        // (WebGL chỉ cho 16 slot: position/normal/uv/color + 4 của instanceMatrix).
        //   aFlags = (mask, leaf, petal, thin)
        const flags = new Float32Array(count * 4);
        // độ mỏng: 0 = vật liệu đặc, 1 = cánh mỏng (ánh sáng xuyên qua được)
        const uvA = geo.attributes.uv;
        for (let i = 0; i < count; i++) {
            // cánh mỏng dần từ gốc ra đầu
            const u = uvA ? uvA.getX(i) : 0.5;
            const thin = petal > 0 ? 0.28 + 0.72 * u : 0;
            flags[i * 4] = mask;
            flags[i * 4 + 1] = leaf;
            flags[i * 4 + 2] = petal;
            flags[i * 4 + 3] = thin;
        }
        geo.setAttribute("aFlags", new THREE.BufferAttribute(flags, 4));

        const pivot = new Float32Array(count * 3);
        if (foldPivot) {
            for (let i = 0; i < count; i++) {
                pivot[i * 3] = foldPivot.x;
                pivot[i * 3 + 1] = foldPivot.y;
                pivot[i * 3 + 2] = foldPivot.z;
            }
        }
        geo.setAttribute("aFoldPivot", new THREE.BufferAttribute(pivot, 3));
        geo.setAttribute(
            "aFoldTheta",
            new THREE.BufferAttribute(
                new Float32Array(count).fill(foldTheta),
                1,
            ),
        );
        geo.setAttribute(
            "aFoldAmount",
            new THREE.BufferAttribute(
                new Float32Array(count).fill(foldAmount),
                1,
            ),
        );
        geo.deleteAttribute("normal");
        geo.computeVertexNormals();
        return geo;
    }

    /* ─────────────  Cánh hoa  ───────────── */

    petal(o = {}) {
        const rng = this.rng;
        const seg = o.segments || this.seg;

        const geo = createPetalGeometry({
            length: o.length ?? 0.6,
            halfWidth: o.halfWidth ?? 0.3,
            // Độ dày tối thiểu theo bề rộng: cánh phải có "bụng" mềm chứ
            // không được phẳng như tờ giấy.
            thickness: Math.max(o.thickness ?? 0.014, (o.halfWidth ?? 0.3) * 0.09),
            segmentsLength: seg[0],
            segmentsWidth: seg[1],
            widthProfile:
                typeof o.profile === "function"
                    ? o.profile
                    : WidthProfile[o.profile || "oval"],
            bendAngle: o.bend ?? 0,
            bendCurve: o.bendCurve ?? 1.25,
            cup: o.cup ?? 0,
            cupCurve: o.cupCurve ?? 2.1,
            twist: o.twist ?? 0,
            ruffle: o.ruffle ?? 0,
            ruffleFreq: o.ruffleFreq ?? 6,
            rufflePhase: o.rufflePhase ?? rng.range(0, TAU),
            tipNotch: o.tipNotch ?? 0,
            tipNotchFreq: o.tipNotchFreq ?? 3,
            basePinch: o.basePinch ?? 0,
            vein: o.vein ?? 0.16,
            veinFreq: o.veinFreq ?? 7,
            micro: o.micro ?? 0.045,
            rampFrom: o.ramp ? o.ramp[0] : 0.58,
            rampMid: o.ramp ? (o.ramp[1] ?? (o.ramp[0] + o.ramp[o.ramp.length - 1]) / 2) : 0.84,
            rampTo: o.ramp ? o.ramp[o.ramp.length - 1] : 1.12,
        });

        const az = o.azimuth ?? 0;
        const tilt = o.tilt ?? 0;
        geo.applyMatrix4(frameMatrix(az, tilt, o.roll ?? 0));

        const pos = o.position
            ? new THREE.Vector3(
                  this.origin.x + o.position[0],
                  this.origin.y + o.position[1],
                  this.origin.z + o.position[2],
              )
            : new THREE.Vector3(
                  this.origin.x + Math.cos(az) * (o.radialOffset ?? 0),
                  this.origin.y + (o.lift ?? 0),
                  this.origin.z + Math.sin(az) * (o.radialOffset ?? 0),
              );

        geo.translate(pos.x, pos.y, pos.z);

        // Cánh mang màu riêng (không bị nhuộm theo instance) — dùng cho môi hoa lan.
        if (o.tint === false && o.color !== undefined) {
            // Lấy đúng 2 đầu của dải sáng, không phải ramp[2] (có thể undefined
            // → màu vertex thành NaN → cánh hoá đen).
            const rp = o.ramp
                ? [o.ramp[0], o.ramp[o.ramp.length - 1]]
                : [0.75, 1.15];
            paintGeometry(geo, o.color, rp);
        }

        this._tag(geo, {
            mask: o.tint === false ? 0 : 1,
            petal: 1,
            foldPivot: pos,
            foldTheta: az,
            foldAmount: o.fold ?? 0,
        });
        this.soft.push(geo);
        return geo;
    }

    /* ─────────────  Thân  ───────────── */

    stem(o = {}) {
        const geo = createStemGeometry({
            height: o.height ?? 1,
            radiusBase: o.radiusBase ?? 0.022,
            radiusTop: o.radiusTop ?? 0.011,
            lean: o.lean ?? 0.12,
            leanDir: o.leanDir ?? 0,
            bow: o.bow ?? 0.22,
            radialSegments: o.radialSegments ?? 6,
            heightSegments: o.heightSegments ?? 8,
            wiggle: o.wiggle ?? 0.1,
        });

        /* KHÔNG xoay thêm ở đây: createStemGeometry đã bake sẵn độ nghiêng
           (lean/leanDir) và độ uốn (bow) vào hình học, và stemTop() tính
           đúng ngọn thân theo cùng công thức đó. Nếu xoay thêm một lần
           nữa, thân nghiêng đúp còn đầu hoa thì lệch khỏi ngọn thân. */
        geo.translate(
            o.position ? o.position[0] : 0,
            o.position ? o.position[1] : 0,
            o.position ? o.position[2] : 0,
        );

        this._tag(geo, { mask: 1, leaf: 0 });
        this.foliage.push(geo);
        return geo;
    }

    /* ─────────────  Cành / cuống nối 2 điểm  ───────────── */

    /**
     * Ống mảnh nối từ `from` tới `to` — dùng cho cuống lá, gân chung của
     * lá kép, cành phụ. Giữ trong nhóm foliage (thân/lá).
     */
    branch(from, to, radius = 0.004, { leaf = 0, taper = 0.65 } = {}) {
        const a = new THREE.Vector3(...from);
        const b = new THREE.Vector3(...to);
        const dir = b.clone().sub(a);
        const len = dir.length();
        if (len < 1e-5) return null;
        dir.normalize();

        const geo = new THREE.CylinderGeometry(
            radius * taper,
            radius,
            len,
            5,
            1,
            true,
        );
        geo.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir,
        );
        geo.applyQuaternion(q);
        geo.translate(a.x, a.y, a.z);

        this._tag(geo, { mask: 1, leaf });
        this.foliage.push(geo);
        return geo;
    }

    /* ─────────────  Lá  ───────────── */

    leaf(o = {}) {
        const seg = o.segments || this.leafSeg;
        const geo = createLeafGeometry({
            length: o.length ?? 0.28,
            halfWidth: o.halfWidth ?? 0.075,
            segmentsLength: seg[0],
            segmentsWidth: seg[1],
            profile: o.profile ?? "ovate",
            rib: o.rib ?? 0.5,
            droop: o.droop ?? 0.16,
            curl: o.curl ?? 0.08,
            serration: o.serration ?? 0,
            serrationFreq: o.serrationFreq ?? 9,
            wave: o.wave ?? 0,
            waveFreq: o.waveFreq ?? 3,
        });

        const az = o.azimuth ?? 0;
        geo.applyMatrix4(frameMatrix(az, o.pitch ?? 0.25, o.roll ?? 0));
        geo.translate(
            this.origin.x + (o.position ? o.position[0] : 0),
            this.origin.y + (o.position ? o.position[1] : 0),
            this.origin.z + (o.position ? o.position[2] : 0),
        );

        this._tag(geo, { mask: 1, leaf: 1 });
        this.foliage.push(geo);
        return geo;
    }

    /* ─────────────  Nhị hoa  ───────────── */

    stamen(o = {}) {
        const len = o.length ?? 0.08;
        const az = o.azimuth ?? 0;
        const tilt = o.tilt ?? 0.4;
        const dir = new THREE.Vector3(
            Math.cos(tilt) * Math.cos(az),
            Math.sin(tilt),
            Math.cos(tilt) * Math.sin(az),
        );

        const base = new THREE.Vector3(
            this.origin.x + (o.position ? o.position[0] : 0),
            this.origin.y + (o.position ? o.position[1] : 0),
            this.origin.z + (o.position ? o.position[2] : 0),
        );

        // cuộng nhị
        const fil = new THREE.CylinderGeometry(
            o.radius ?? 0.0045,
            (o.radius ?? 0.0045) * 0.7,
            len,
            5,
            1,
            true,
        );
        fil.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir,
        );
        fil.applyQuaternion(q);
        fil.translate(base.x, base.y, base.z);
        paintGeometry(
            fil,
            o.filamentColor ?? 0xd8e08a,
            o.filamentRamp ?? [0.7, 1.05],
        );
        this._tag(fil, { mask: 0 });
        this.soft.push(fil);

        // bao phấn
        const an = new THREE.SphereGeometry(o.antherRadius ?? 0.009, 7, 5);
        an.scale(
            o.antherLength ? o.antherLength / (o.antherRadius ?? 0.009) : 1.6,
            1,
            1,
        );
        an.applyQuaternion(q);
        const tip = base.clone().add(dir.clone().multiplyScalar(len));
        an.translate(tip.x, tip.y, tip.z);
        paintGeometry(
            an,
            o.antherColor ?? 0xf0b73c,
            o.antherRamp ?? [0.72, 1.12],
        );
        this._tag(an, { mask: 0 });
        this.soft.push(an);
    }

    /* ─────────────  Khối tròn nhỏ  ───────────── */

    blob(o = {}) {
        const r = o.radius ?? 0.02;
        const geo = new THREE.SphereGeometry(
            r,
            o.segments ?? 8,
            o.segments2 ?? 6,
        );
        if (o.scale) geo.scale(o.scale[0], o.scale[1], o.scale[2]);
        geo.translate(
            this.origin.x + (o.position ? o.position[0] : 0),
            this.origin.y + (o.position ? o.position[1] : 0),
            this.origin.z + (o.position ? o.position[2] : 0),
        );
        paintGeometry(geo, o.color ?? 0xf0b73c, o.ramp ?? [0.7, 1.1]);
        this._tag(geo, { mask: o.mask ?? 0 });
        (o.foliage ? this.foliage : this.soft).push(geo);
        return geo;
    }

    /* ─────────────  Đĩa nhụy  ───────────── */

    disc(o = {}) {
        const r = o.radius ?? 0.15;
        const geo = new THREE.SphereGeometry(
            r,
            o.segments ?? 18,
            8,
            0,
            TAU,
            0,
            Math.PI * (o.half ?? 0.42),
        );
        geo.scale(1, o.flatten ?? 0.55, 1);
        geo.translate(
            this.origin.x + (o.position ? o.position[0] : 0),
            this.origin.y + (o.position ? o.position[1] : 0),
            this.origin.z + (o.position ? o.position[2] : 0),
        );
        paintGeometry(geo, o.color ?? 0xf2c022, o.ramp ?? [0.68, 1.12]);
        this._tag(geo, { mask: 0 });
        this.soft.push(geo);
        return geo;
    }

    /* ─────────────  Nhụy hướng dương (hạt xoắn ốc)  ───────────── */

    seedHead(o = {}) {
        const r = o.radius ?? 0.3;
        const count = o.count ?? 96;
        const golden = Math.PI * (3 - Math.sqrt(5));
        const seedR = o.seedRadius ?? r * 0.052;
        const h = o.seedHeight ?? r * 0.072;
        const domeR = r * 0.95;
        const domeH = o.domeHeight ?? r * 0.26;

        // Đế nhụy: bán cầu, mép dưới nằm ngang tại y = 0 → không có gì
        // thò ra dưới đầu hoa. Mặt dưới tô xanh đài hoa (không đen xì),
        // chuyển dần lên nâu ở mặt trên nhụy.
        const base = new THREE.SphereGeometry(
            domeR,
            26,
            12,
            0,
            TAU,
            0,
            Math.PI * 0.5,
        );
        base.scale(1, domeH / domeR, 1);
        {
            const n = base.attributes.position.count;
            const col = new Float32Array(n * 3);
            const brown = new THREE.Color(o.color ?? 0x2e1c0d);
            const green = new THREE.Color(o.receptacle ?? 0x3f6b34);
            const c = new THREE.Color();
            const p = base.attributes.position;
            for (let i = 0; i < n; i++) {
                const t = clamp(p.getY(i) / domeH, 0, 1);
                c.copy(green).lerp(brown, Math.pow(t, 0.42));
                const k = 0.72 + 0.3 * t;
                col[i * 3] = c.r * k;
                col[i * 3 + 1] = c.g * k;
                col[i * 3 + 2] = c.b * k;
            }
            base.setAttribute("color", new THREE.BufferAttribute(col, 3));
        }
        base.translate(this.origin.x, this.origin.y, this.origin.z);
        this._tag(base, { mask: 0 });
        // Đế nhụy nằm ở vật liệu matte (không sheen) để giữ màu nâu đậm,
        // không bị hồng nhạt như cánh hoa.
        this.foliage.push(base);

        // Nắp đáy: mặt đài hoa (xanh) khép kín vòm nhụy.
        // Không có nắp này thì nhìn từ dưới sẽ thấy ra mặt trong tối đen.
        const bottom = new THREE.CircleGeometry(domeR, 26);
        bottom.rotateX(Math.PI / 2); // mặt quay xuống (-Y)
        bottom.translate(this.origin.x, this.origin.y, this.origin.z);
        paintGeometry(bottom, o.receptacle ?? 0x3f6b34, [0.7, 0.96]);
        this._tag(bottom, { mask: 0 });
        this.foliage.push(bottom);

        // Hạt: xoắn ốc Fibonacci, nằm trên vòm nhụy, đỉnh hướng ra ngoài
        // theo pháp tuyến và chìm vào đế → chỉ lộ phần đỉnh nhỏ.
        const up = new THREE.Vector3(0, 1, 0);
        const n = new THREE.Vector3();
        const q = new THREE.Quaternion();
        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count;
            // hạt chỉ nằm trong 88% bán kính → phần rìa đĩa trơn, không mọc gai
            const rad = domeR * 0.88 * Math.sqrt(t);
            const a = i * golden;
            const x = Math.cos(a) * rad;
            const z = Math.sin(a) * rad;
            const k = rad / domeR;
            const y = domeH * Math.sqrt(Math.max(0, 1 - k * k));

            // pháp tuyến ellipsoid tại điểm (x, y, z)
            n.set(x / (domeR * domeR), y / (domeH * domeH), z / (domeR * domeR)).normalize();

            const geo = new THREE.ConeGeometry(seedR, h, 5, 1);
            q.setFromUnitVectors(up, n);
            geo.applyQuaternion(q);
            // chìm hạt vừa phải → lộ đỉnh thành nốt nhỏ, không thành gai
            geo.translate(
                this.origin.x + x - n.x * h * 0.38,
                this.origin.y + y - n.y * h * 0.38,
                this.origin.z + z - n.z * h * 0.38,
            );
            const shade = 0.62 + 0.5 * (1 - t);
            paintGeometry(geo, o.color ?? 0x4a2e1d, [shade, shade * 1.25]);
            this._tag(geo, { mask: 0 });
            this.foliage.push(geo);
        }
    }

    /* ─────────────  Gộp  ───────────── */

    build() {
        const soft = this.soft.length
            ? mergeGeometries(this.soft, false)
            : null;
        const foliage = this.foliage.length
            ? mergeGeometries(this.foliage, false)
            : null;
        if (soft) {
            soft.computeBoundingSphere();
            soft.computeBoundingBox();
        }
        if (foliage) {
            foliage.computeBoundingSphere();
            foliage.computeBoundingBox();
        }
        this.soft.length = 0;
        this.foliage.length = 0;
        return { soft, foliage };
    }
}

/* ─────────────────────  Tô màu hình học  ───────────────────── */

export function paintGeometry(geo, colorHex, ramp = [0.7, 1.1]) {
    const c = new THREE.Color(colorHex);
    const count = geo.attributes.position.count;
    const arr = new Float32Array(count * 3);
    const uv = geo.attributes.uv;
    for (let i = 0; i < count; i++) {
        let t = 0.5;
        if (uv) t = uv.getY(i);
        const k = lerp(ramp[0], ramp[1], t);
        arr[i * 3] = c.r * k;
        arr[i * 3 + 1] = c.g * k;
        arr[i * 3 + 2] = c.b * k;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return geo;
}

/* ─────────────────────  Vật liệu  ───────────────────── */

const PLANT_UNIFORMS = {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.82, 0.57) },
    uWindAmp: { value: 0.0 },
    uWindBend: { value: 0.05 },
    uLeafLag: { value: 0.85 },
    /** Hướng tới mặt trời trong không gian camera (cập nhật mỗi frame). */
    uSunViewDir: { value: new THREE.Vector3(0.45, 0.6, 0.35).normalize() },
    /** Cường độ truyền sáng qua cánh (SSS). */
    uSSS: { value: 1.0 },
    /** Màu ánh sáng lọc qua cánh. */
    uSSSColor: { value: new THREE.Color(0xff9ab5) },
};

export const plantUniforms = PLANT_UNIFORMS;

/**
 * Gắn hiệu ứng gió, hiệu ứng hé nở và nhuộm màu theo instance vào vật liệu.
 */
export function patchPlantMaterial(
    mat,
    { tintStrength = 1, sheen = 0, tint = 0xffffff, instanceTint = true } = {},
) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = PLANT_UNIFORMS.uTime;
        shader.uniforms.uWindDir = PLANT_UNIFORMS.uWindDir;
        shader.uniforms.uWindAmp = PLANT_UNIFORMS.uWindAmp;
        shader.uniforms.uWindBend = PLANT_UNIFORMS.uWindBend;
        shader.uniforms.uLeafLag = PLANT_UNIFORMS.uLeafLag;
        shader.uniforms.uSunViewDir = PLANT_UNIFORMS.uSunViewDir;
        shader.uniforms.uSSS = PLANT_UNIFORMS.uSSS;
        shader.uniforms.uSSSColor = PLANT_UNIFORMS.uSSSColor;
        shader.uniforms.uTintStrength = { value: tintStrength };
        shader.uniforms.uTint = { value: new THREE.Color(tint) };
        shader.uniforms.uInstanceTint = { value: instanceTint ? 1 : 0 };

        shader.vertexShader =
            `
      attribute float aFlex;
      attribute vec4 aFlags;
      attribute vec3 aFoldPivot;
      attribute float aFoldTheta;
      attribute float aFoldAmount;
      attribute float aOpen;
      attribute vec3 aInstTint;

      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindAmp;
      uniform float uWindBend;
      uniform float uLeafLag;

      varying float vMask;
      varying vec3 vInstTint;
      varying float vPetal;
      varying float vThin;
      varying float vLeaf;
    ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            /* glsl */ `
      #include <begin_vertex>
      {
        float fold = aFoldAmount * (1.0 - aOpen);
        if (fold > 0.0001) {
          vec3 axis = vec3(-sin(aFoldTheta), 0.0, cos(aFoldTheta));
          vec3 rel = transformed - aFoldPivot;
          float cf = cos(fold);
          float sf = sin(fold);
          transformed = aFoldPivot + rel * cf + cross(axis, rel) * sf + axis * dot(axis, rel) * (1.0 - cf);
        }
        vMask = aFlags.x;
        vInstTint = aInstTint;
        vPetal = aFlags.z;
        vThin = aFlags.w;
        vLeaf = aFlags.y;
      }
      `,
        );

        shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            /* glsl */ `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif

      {
        vec4 base = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif
        float phase = base.x * 0.27 + base.z * 0.21;
        float k = aFlex * aFlex * uWindBend;
        float s1 = sin(uTime * 1.05 + phase);
        float s2 = sin(uTime * 2.23 + phase * 1.73 + 1.1);
        float sway = (s1 * 0.62 + s2 * 0.38) * k;
        float leafPhase = sin(uTime * 1.05 + phase - uLeafLag) - s1;
        sway += leafPhase * vLeaf * k * 0.9;
        vec3 swayWorld = vec3(uWindDir.x, 0.0, uWindDir.y) * sway * uWindAmp;
        vec4 worldPos = modelMatrix * mvPosition;
        worldPos.xyz += swayWorld;
        mvPosition = viewMatrix * worldPos;
      }
      gl_Position = projectionMatrix * mvPosition;
      `,
        );

        shader.fragmentShader =
            `
      uniform float uTintStrength;
      uniform vec3 uTint;
      uniform float uInstanceTint;
      uniform float uSSS;
      uniform vec3 uSSSColor;
      uniform vec3 uSunViewDir;
      varying float vMask;
      varying vec3 vInstTint;
      varying float vPetal;
      varying float vThin;
    ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            /* glsl */ `
      #include <color_fragment>
      {
        /* uTint = màu nền của vật liệu (lá/thân = xanh lá).
           vInstTint = màu riêng của từng cây (màu hoa), chỉ áp cho vật liệu soft.
           uInstanceTint = 0 -> bỏ qua màu instance (dùng cho thân/lá). */
        float m = clamp(vMask * uTintStrength, 0.0, 1.0);
        vec3 tint = mix(vec3(1.0), uTint, m);
        tint = mix(tint, tint * vInstTint, m * uInstanceTint);
        diffuseColor.rgb *= tint;
      }
      `,
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            /* glsl */ `
      {
        /* ---- SSS: ánh sáng xuyên qua cánh hoa mỏng ---- */
        if (vPetal > 0.5 && uSSS > 0.001) {
          float ndl = dot(normal, uSunViewDir);
          // ánh sáng chiếu từ phía sau cánh -> lọc qua mô mềm
          float back = max(0.0, -ndl);
          // diffuse bọc quanh mép (wrap lighting) - mềm như cánh thật
          float wrap = max(0.0, (ndl + 0.55) / 1.55);
          float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);
          float sss = uSSS * vThin * (back * 0.85 + wrap * 0.22 + rim * 0.16);
          outgoingLight += uSSSColor * sss * diffuseColor.rgb;
          // viền sáng mảnh ở mép cánh
          outgoingLight += uSSSColor * rim * vThin * uSSS * 0.1;
        }
      }
      #include <opaque_fragment>
      `,
        );

        mat.userData.shader = shader;
    };
    mat.customProgramCacheKey = () => `plant-${sheen}-${tintStrength}`;
    return mat;
}

/** Tạo bộ vật liệu dùng chung cho toàn bộ khu vườn. */
export function createPlantMaterials() {
    const soft = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        color: 0xffffff,
        roughness: 0.58,
        metalness: 0,
        side: THREE.DoubleSide,
        sheen: 0.9,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0xffcfe0),
        clearcoat: 0.14,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.75,
    });
    patchPlantMaterial(soft, { tintStrength: 1, sheen: 1, tint: 0xffffff, instanceTint: true });

    const foliage = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: 0xffffff,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
        envMapIntensity: 0.55,
    });
    /* Thân + lá: nhuộm xanh lá, KHÔNG nhân với màu instance (màu hoa).
       instanceTint = 0 -> giữ đúng màu lá/thân. */
    patchPlantMaterial(foliage, {
        tintStrength: 1,
        sheen: 0,
        tint: new THREE.Color(PALETTE.leaf),
        instanceTint: false,
    });

    return { soft, foliage };
}

/* ─────────────────────  Kho mẫu  ───────────────────── */

/**
 * Dựng hình học của một loài hoa ở một mức chi tiết.
 * @returns {{soft: THREE.BufferGeometry|null, foliage: THREE.BufferGeometry|null, meta: object}}
 */
export function buildSpeciesTemplate(
    speciesId,
    { rng, lod = "high", seg, leafSeg } = {},
) {
    const species = SPECIES[speciesId];
    if (!species) throw new Error(`Không tìm thấy loài hoa: ${speciesId}`);

    const builder = new PlantBuilder({ rng, seg, leafSeg });
    const meta = species.build({ builder, rng, lod });

    const { soft, foliage } = builder.build();
    return { soft, foliage, meta };
}

export { SPECIES };
