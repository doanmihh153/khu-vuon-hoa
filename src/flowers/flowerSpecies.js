/**
 * Cấu hình hình thái từng loài hoa.
 *
 * Mỗi loài có bộ tham số riêng cho:
 *   petalCount · petalLength · petalWidth · curvature · curl · twist
 *   radialOffset · layerCount · colorGradient · bloomOpenness
 *
 * Không loài nào dùng chung mô hình — hình thái, lớp cánh, thân, lá và
 * chi tiết giữa hoàn toàn khác nhau.
 */

import { TAU } from "../utils/math.js";
import { stemPoint } from "./petalGeometry.js";

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Điểm trên trục giữa của thân tại tham số u ∈ [0,1] (0 = gốc, 1 = ngọn).
 * Cùng công thức với createStemGeometry() nên lá/cành bám đúng vào thân.
 */
export { stemPoint };

/** Vị trí đỉnh thân (để gắn đầu hoa đúng chỗ). */
function stemTop(h, lean, leanDir, bow) {
    return stemPoint(h, lean, leanDir, bow, 1);
}

/**
 * Điểm bám trên thân tại u ∈ [0,1], lệch ngang theo hướng az.
 * Dùng cho vị trí lá/cành để chúng bám đúng thân đã cong.
 */
function stemAttach(h, lean, leanDir, bow, u, az, radius = 0) {
    const p = stemPoint(h, lean, leanDir, bow, u);
    return [
        p.x + Math.cos(az) * radius,
        p.y,
        p.z + Math.sin(az) * radius,
    ];
}

/** Số cánh giảm dần ở mức chi tiết thấp để giữ hiệu năng. */
function n(base, lod, min = 3) {
    return Math.max(min, Math.round(base * (lod === "low" ? 0.62 : 1)));
}

/* ══════════════════════════════════════════════════════════════ */

export const SPECIES = {
    /* ───────────────  1. HOA HỒNG  ─────────────── */
    rose: {
        id: "rose",
        label: "Hoa Hồng",
        height: [0.86, 1.34],
        schemes: [
            { id: "ruby", tint: 0x9c1b40 },
            { id: "blush", tint: 0xee9db6 },
            { id: "peach", tint: 0xf2b192 },
            { id: "cream", tint: 0xf7ead6 },
            { id: "champagne", tint: 0xe4c489 },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.86, 1.34);
            const lean = rng.range(0.05, 0.15);
            const leanDir = rng.range(0, TAU);
            const bow = rng.range(0.14, 0.24);

            builder.stem({
                height: h,
                radiusBase: 0.021,
                radiusTop: 0.012,
                lean,
                leanDir,
                bow,
                radialSegments: 6,
                heightSegments: 9,
            });

            // lá kép (pinnate): mỗi lá gồm cuống chung + 5 lá chét so le
            const leaves = lod === "low" ? 2 : 3;
            for (let i = 0; i < leaves; i++) {
                const t = 0.2 + i * 0.27 + rng.range(-0.03, 0.03);
                const az = rng.range(0, TAU);
                const pitch = rng.range(0.2, 0.45);
                const rachisLen = rng.range(0.17, 0.21);

                // điểm bám trên thân (thân đã cong → dùng trục thật)
                const [bx, y, bz] = stemAttach(
                    h,
                    lean,
                    leanDir,
                    bow,
                    t,
                    az,
                    0.015,
                );
                // hướng cuống chung
                const dx = Math.cos(pitch) * Math.cos(az);
                const dy = Math.sin(pitch);
                const dz = Math.cos(pitch) * Math.sin(az);
                // hướng vuông góc (trong mặt phẳng ngang) để xếp lá chét so le
                const sx = -Math.sin(az);
                const sz = Math.cos(az);

                // cuống chung nối thân với cành lá
                builder.branch(
                    [bx, y, bz],
                    [
                        bx + dx * rachisLen,
                        y + dy * rachisLen,
                        bz + dz * rachisLen,
                    ],
                    0.0035,
                    { leaf: 1 },
                );

                for (let k = 0; k < 5; k++) {
                    const s = (k + 0.6) / 5.4;
                    const sign = k % 2 ? 1 : -1;
                    // hướng lá chét: lệch sang bên + hơi ngược về đầu lá + hơi lên
                    const vx = sx * sign * 0.72 + dx * 0.6;
                    const vy = dy * 0.6 + 0.34;
                    const vz = sz * sign * 0.72 + dz * 0.6;
                    const vlen = Math.hypot(vx, vy, vz);

                    const lAz = Math.atan2(vz, vx);
                    const lPitch = Math.asin(vy / vlen);
                    const lLen = 0.155 * (1 - s * 0.25);
                    const lWid = 0.034 * (1 - s * 0.22);

                    builder.leaf({
                        position: [
                            bx + dx * rachisLen * s + sx * sign * 0.004,
                            y + dy * rachisLen * s,
                            bz + dz * rachisLen * s + sz * sign * 0.004,
                        ],
                        azimuth: lAz,
                        pitch: lPitch,
                        roll: sign * rng.range(0.1, 0.3),
                        length: lLen,
                        halfWidth: lWid,
                        profile: "ovate",
                        rib: 0.3,
                        droop: 0.1,
                        curl: 0.05,
                        serration: 0.15,
                        serrationFreq: 7,
                    });
                }

                // lá chét đầu (nằm cuối cuống chung)
                builder.leaf({
                    position: [
                        bx + dx * rachisLen,
                        y + dy * rachisLen,
                        bz + dz * rachisLen,
                    ],
                    azimuth: az,
                    pitch: pitch * 0.85,
                    roll: rng.range(-0.2, 0.2),
                    length: 0.1,
                    halfWidth: 0.034,
                    profile: "ovate",
                    rib: 0.3,
                    droop: 0.12,
                    curl: 0.05,
                    serration: 0.15,
                    serrationFreq: 7,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // đài hoa
            for (let i = 0; i < 5; i++) {
                builder.leaf({
                    position: [0, -0.03, 0],
                    azimuth: (i / 5) * TAU + 0.3,
                    pitch: -1.0,
                    length: 0.095,
                    halfWidth: 0.024,
                    profile: "lance",
                    rib: 0.3,
                    droop: 0.12,
                    curl: 0.05,
                });
            }

            // các lớp cánh xếp xoắn
            const LAYERS = [
                {
                    n: 7,
                    len: 1.0,
                    hw: 0.4,
                    tilt: 0.95,
                    off: 0.015,
                    prof: "obovate",
                    bend: -0.52,
                    cup: 0.3,
                    ruffle: 0.055,
                    fold: 1.12,
                    ramp: [0.5, 0.82, 1.2],
                },
                {
                    n: 6,
                    len: 0.84,
                    hw: 0.335,
                    tilt: 0.8,
                    off: 0.02,
                    prof: "obovate",
                    bend: -0.34,
                    cup: 0.27,
                    ruffle: 0.05,
                    fold: 1.3,
                    ramp: [0.52, 0.84, 1.17],
                },
                {
                    n: 6,
                    len: 0.66,
                    hw: 0.275,
                    tilt: 0.62,
                    off: 0.022,
                    prof: "oval",
                    bend: -0.16,
                    cup: 0.24,
                    ruffle: 0.045,
                    fold: 1.46,
                    ramp: [0.54, 0.86, 1.15],
                },
                {
                    n: 5,
                    len: 0.48,
                    hw: 0.205,
                    tilt: 0.44,
                    off: 0.018,
                    prof: "oval",
                    bend: 0.02,
                    cup: 0.21,
                    ruffle: 0.04,
                    fold: 1.57,
                    ramp: [0.56, 0.88, 1.13],
                },
                {
                    n: 4,
                    len: 0.31,
                    hw: 0.135,
                    tilt: 0.28,
                    off: 0.012,
                    prof: "oval",
                    bend: 0.1,
                    cup: 0.18,
                    ruffle: 0.035,
                    fold: 1.67,
                    ramp: [0.58, 0.9, 1.1],
                },
                {
                    n: 3,
                    len: 0.18,
                    hw: 0.08,
                    tilt: 0.15,
                    off: 0.006,
                    prof: "oval",
                    bend: 0.14,
                    cup: 0.15,
                    ruffle: 0.025,
                    fold: 1.73,
                    ramp: [0.6, 0.92, 1.08],
                },
            ];

            let phase = rng.range(0, TAU);
            for (const L of LAYERS) {
                const count = n(L.n, lod);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: phase + i * step + rng.range(-0.055, 0.055),
                        tilt: L.tilt + rng.range(-0.055, 0.055),
                        radialOffset: L.off + rng.range(-0.004, 0.004),
                        length: L.len * rng.range(0.94, 1.06),
                        halfWidth: L.hw * rng.range(0.93, 1.07),
                        profile: L.prof,
                        bend: L.bend,
                        cup: L.cup,
                        ruffle: L.ruffle,
                        ruffleFreq: 3,
                        fold: L.fold,
                        ramp: L.ramp,
                        thickness: 0.013,
                    });
                }
                phase += step * 0.58; // xoắn đặc trưng của hoa hồng
            }

            if (lod !== "low") {
                for (let i = 0; i < 8; i++) {
                    builder.stamen({
                        azimuth: (i / 8) * TAU + 0.3,
                        tilt: 0.95,
                        length: 0.045,
                        radius: 0.0035,
                        antherRadius: 0.007,
                        antherLength: 0.011,
                        position: [0, 0.012, 0],
                        filamentColor: 0xe9dd92,
                        antherColor: 0xf0b73c,
                    });
                }
            }
            return { headY: top.y };
        },
    },

    /* ───────────────  2. HOA CẨM CHƯỚNG  ─────────────── */
    carnation: {
        id: "carnation",
        label: "Hoa Cẩm Chướng",
        height: [0.52, 0.78],
        schemes: [
            { id: "deeppink", tint: 0xd9447a },
            { id: "red", tint: 0xc4263f },
            { id: "white", tint: 0xfaf3ee },
            { id: "pastel", tint: 0xf4bfd2 },
            { id: "lilac", tint: 0xc6a2d6 },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.52, 0.78);
            const lean = rng.range(0.04, 0.12);
            const leanDir = rng.range(0, TAU);
            const bow = rng.range(0.1, 0.2);

            builder.stem({
                height: h,
                radiusBase: 0.013,
                radiusTop: 0.008,
                lean,
                leanDir,
                bow,
                radialSegments: 5,
                heightSegments: 7,
            });

            for (let i = 0; i < (lod === "low" ? 2 : 3); i++) {
                const az = rng.range(0, TAU);
                const u = 0.24 + i * 0.26;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.012),
                    azimuth: az,
                    pitch: rng.range(0.1, 0.45),
                    length: 0.19,
                    halfWidth: 0.035,
                    profile: "lance",
                    rib: 0.5,
                    droop: 0.24,
                    curl: 0.12,
                    wave: 0.14,
                    waveFreq: 3,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // ống đài
            builder.blob({
                position: [0, -0.035, 0],
                radius: 0.035,
                scale: [1, 1.9, 1],
                color: 0x5f9a4a,
                ramp: [0.7, 1.0],
                foliage: true,
            });

            const LAYERS = [
                {
                    n: 11,
                    len: 0.66,
                    hw: 0.29,
                    tilt: 0.92,
                    fold: 0.95,
                    ramp: [0.55, 0.85, 1.18],
                },
                {
                    n: 10,
                    len: 0.58,
                    hw: 0.25,
                    tilt: 1.04,
                    fold: 1.1,
                    ramp: [0.56, 0.86, 1.16],
                },
                {
                    n: 9,
                    len: 0.48,
                    hw: 0.215,
                    tilt: 1.14,
                    fold: 1.25,
                    ramp: [0.57, 0.87, 1.15],
                },
                {
                    n: 8,
                    len: 0.37,
                    hw: 0.16,
                    tilt: 1.24,
                    fold: 1.4,
                    ramp: [0.58, 0.88, 1.13],
                },
                {
                    n: 6,
                    len: 0.25,
                    hw: 0.105,
                    tilt: 1.32,
                    fold: 1.5,
                    ramp: [0.6, 0.9, 1.1],
                },
                {
                    n: 4,
                    len: 0.14,
                    hw: 0.062,
                    tilt: 1.38,
                    fold: 1.6,
                    ramp: [0.62, 0.92, 1.08],
                },
            ];

            let phase = rng.range(0, TAU);
            for (const L of LAYERS) {
                const count = n(L.n, lod);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: phase + i * step + rng.range(-0.05, 0.05),
                        tilt: L.tilt + rng.range(-0.06, 0.06),
                        radialOffset: 0.012 + rng.range(0, 0.012),
                        length: L.len * rng.range(0.92, 1.08),
                        halfWidth: L.hw * rng.range(0.92, 1.08),
                        profile: "roundBlunt",
                        bend: 0.12,
                        cup: 0.16,
                        ruffle: 0.16,
                        ruffleFreq: 9,
                        tipNotch: 0.22,
                        tipNotchFreq: 4,
                        fold: L.fold,
                        ramp: L.ramp,
                        thickness: 0.009,
                    });
                }
                phase += step * 0.47;
            }
            return { headY: top.y };
        },
    },

    /* ───────────────  3. HOA MẪU ĐƠN  ─────────────── */
    peony: {
        id: "peony",
        label: "Hoa Mẫu Đơn",
        height: [0.72, 1.0],
        schemes: [
            { id: "cream", tint: 0xf6e5d3 },
            { id: "blush", tint: 0xf2b2b8 },
            { id: "rose", tint: 0xdf8aa3 },
            { id: "white", tint: 0xf9f3ee },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.72, 1.0);
            const lean = rng.range(0.04, 0.11);
            const leanDir = rng.range(0, TAU);
            const bow = rng.range(0.08, 0.18);

            builder.stem({
                height: h,
                radiusBase: 0.02,
                radiusTop: 0.011,
                lean,
                leanDir,
                bow,
                radialSegments: 6,
                heightSegments: 8,
            });

            for (let i = 0; i < (lod === "low" ? 2 : 3); i++) {
                const az = rng.range(0, TAU);
                const u = 0.2 + i * 0.28;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.015),
                    azimuth: az,
                    pitch: rng.range(0.05, 0.35),
                    length: 0.26,
                    halfWidth: 0.085,
                    profile: "ovate",
                    rib: 0.6,
                    droop: 0.16,
                    curl: 0.08,
                    serration: 0.06,
                    serrationFreq: 5,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            const LAYERS = [
                {
                    n: 8,
                    len: 0.96,
                    hw: 0.5,
                    tilt: 0.64,
                    prof: "broadBlunt",
                    bend: -0.2,
                    cup: 0.32,
                    ruffle: 0.06,
                    fold: 1.0,
                    ramp: [0.52, 0.84, 1.18],
                },
                {
                    n: 8,
                    len: 0.86,
                    hw: 0.45,
                    tilt: 0.53,
                    prof: "broadBlunt",
                    bend: -0.14,
                    cup: 0.29,
                    ruffle: 0.055,
                    fold: 1.15,
                    ramp: [0.54, 0.85, 1.16],
                },
                {
                    n: 7,
                    len: 0.72,
                    hw: 0.375,
                    tilt: 0.43,
                    prof: "oval",
                    bend: -0.08,
                    cup: 0.26,
                    ruffle: 0.05,
                    fold: 1.3,
                    ramp: [0.55, 0.86, 1.15],
                },
                {
                    n: 7,
                    len: 0.56,
                    hw: 0.29,
                    tilt: 0.33,
                    prof: "oval",
                    bend: -0.02,
                    cup: 0.23,
                    ruffle: 0.045,
                    fold: 1.45,
                    ramp: [0.57, 0.88, 1.13],
                },
                {
                    n: 6,
                    len: 0.4,
                    hw: 0.21,
                    tilt: 0.25,
                    prof: "oval",
                    bend: 0.06,
                    cup: 0.2,
                    ruffle: 0.04,
                    fold: 1.55,
                    ramp: [0.59, 0.9, 1.1],
                },
                {
                    n: 5,
                    len: 0.26,
                    hw: 0.135,
                    tilt: 0.17,
                    prof: "oval",
                    bend: 0.12,
                    cup: 0.17,
                    ruffle: 0.03,
                    fold: 1.65,
                    ramp: [0.61, 0.92, 1.08],
                },
            ];

            let phase = rng.range(0, TAU);
            for (const L of LAYERS) {
                const count = n(L.n, lod);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: phase + i * step + rng.range(-0.07, 0.07),
                        tilt: L.tilt + rng.range(-0.07, 0.07),
                        radialOffset: 0.016 + rng.range(0, 0.016),
                        length: L.len * rng.range(0.92, 1.08),
                        halfWidth: L.hw * rng.range(0.92, 1.08),
                        profile: L.prof,
                        bend: L.bend,
                        cup: L.cup,
                        ruffle: L.ruffle,
                        ruffleFreq: 3,
                        fold: L.fold,
                        ramp: L.ramp,
                        thickness: 0.012,
                    });
                }
                phase += step * 0.5;
            }

            // nhị vàng ở giữa
            const stamens = lod === "low" ? 8 : 16;
            for (let i = 0; i < stamens; i++) {
                const a = (i / stamens) * TAU + rng.range(0, 0.3);
                builder.stamen({
                    azimuth: a,
                    tilt: rng.range(0.85, 1.15),
                    length: 0.055,
                    radius: 0.004,
                    antherRadius: 0.0085,
                    antherLength: 0.013,
                    position: [Math.cos(a) * 0.022, 0.02, Math.sin(a) * 0.022],
                    filamentColor: 0xf0e2a0,
                    antherColor: 0xf0c24a,
                });
            }
            return { headY: top.y };
        },
    },

    /* ───────────────  4. HOA TULIP  ─────────────── */
    tulip: {
        id: "tulip",
        label: "Hoa Tulip",
        height: [0.58, 0.84],
        schemes: [
            { id: "red", tint: 0xcf3348 },
            { id: "yellow", tint: 0xf3c544 },
            { id: "pink", tint: 0xef9db0 },
            { id: "purple", tint: 0x9a6db4 },
            { id: "white", tint: 0xf7f1e8 },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.58, 0.84);
            const lean = rng.range(0.02, 0.08);
            const leanDir = rng.range(0, TAU);
            const bow = 0.1;

            builder.stem({
                height: h,
                radiusBase: 0.019,
                radiusTop: 0.012,
                lean,
                leanDir,
                bow,
                radialSegments: 6,
                heightSegments: 8,
            });

            // lá dài, mềm, ôm thân
            const leaves = lod === "low" ? 2 : 3;
            for (let i = 0; i < leaves; i++) {
                const az = rng.range(0, TAU);
                const u = 0.16 + i * 0.26;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.012),
                    azimuth: az,
                    pitch: rng.range(0.35, 0.75),
                    roll: rng.range(-0.25, 0.25),
                    length: 0.4,
                    halfWidth: 0.055,
                    profile: "strap",
                    rib: 0.35,
                    droop: 0.32,
                    curl: 0.18,
                    wave: 0.16,
                    waveFreq: 2,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // hai vòng 3 cánh tạo dáng chén
            for (let w = 0; w < 2; w++) {
                for (let i = 0; i < 3; i++) {
                    builder.petal({
                        azimuth:
                            w * (Math.PI / 3) +
                            (i / 3) * TAU +
                            rng.range(-0.06, 0.06),
                        tilt: 1.26 + w * 0.15 + rng.range(-0.05, 0.05),
                        radialOffset: 0.008 + w * 0.006,
                        length: 0.88 - w * 0.09,
                        halfWidth: 0.4 - w * 0.035,
                        profile: "chalice",
                        bend: 0.3,
                        cup: 0.46,
                        cupCurve: 1.7,
                        fold: 0.3,
                        ramp: [0.5, 0.84, 1.16],
                        thickness: 0.014,
                    });
                }
            }

            // nhị + nhụy
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU + 0.2;
                builder.stamen({
                    azimuth: a,
                    tilt: 1.0,
                    length: 0.11,
                    radius: 0.004,
                    antherRadius: 0.008,
                    antherLength: 0.015,
                    position: [Math.cos(a) * 0.018, 0.02, Math.sin(a) * 0.018],
                    filamentColor: 0xeae0a2,
                    antherColor: 0xe8ac3c,
                });
            }
            builder.blob({
                position: [0, 0.16, 0],
                radius: 0.018,
                scale: [1, 1.6, 1],
                color: 0xdff0c8,
                ramp: [0.8, 1.05],
            });
            return { headY: top.y };
        },
    },

    /* ───────────────  5. HOA CÚC (DAISY)  ─────────────── */
    daisy: {
        id: "daisy",
        label: "Hoa Cúc",
        height: [0.42, 0.64],
        schemes: [
            { id: "white", tint: 0xfbfaf5 },
            { id: "cream", tint: 0xf8efd8 },
            { id: "yellow", tint: 0xf5d45c },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.42, 0.64);
            const lean = rng.range(0.05, 0.16);
            const leanDir = rng.range(0, TAU);
            const bow = 0.14;

            builder.stem({
                height: h,
                radiusBase: 0.011,
                radiusTop: 0.007,
                lean,
                leanDir,
                bow,
                radialSegments: 5,
                heightSegments: 7,
            });

            for (let i = 0; i < (lod === "low" ? 2 : 4); i++) {
                const az = rng.range(0, TAU);
                const u = 0.12 + i * 0.16;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.01),
                    azimuth: az,
                    pitch: rng.range(0.15, 0.5),
                    length: 0.16,
                    halfWidth: 0.032,
                    profile: "lance",
                    rib: 0.45,
                    droop: 0.2,
                    curl: 0.1,
                    serration: 0.1,
                    serrationFreq: 8,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // hai vòng cánh thon dài
            const rings = [
                {
                    count: 16,
                    len: 0.82,
                    hw: 0.115,
                    tilt: 0.3,
                    off: 0.016,
                    phase: 0,
                },
                {
                    count: 13,
                    len: 0.64,
                    hw: 0.1,
                    tilt: 0.48,
                    off: 0.012,
                    phase: 0.22,
                },
            ];
            for (const r of rings) {
                const count = n(r.count, lod, 6);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: r.phase + i * step + rng.range(-0.03, 0.03),
                        tilt: r.tilt + rng.range(-0.05, 0.05),
                        radialOffset: r.off,
                        length: r.len * rng.range(0.94, 1.06),
                        halfWidth: r.hw * rng.range(0.9, 1.1),
                        profile: "thread",
                        bend: 0.14,
                        cup: 0.08,
                        tipNotch: 0.1,
                        tipNotchFreq: 3,
                        fold: 0.55,
                        ramp: [0.6, 0.88, 1.12],
                        thickness: 0.008,
                    });
                }
            }

            // nhụy vàng
            builder.disc({
                radius: 0.165,
                flatten: 0.52,
                color: 0xf3c424,
                ramp: [0.7, 1.14],
                segments: 16,
            });
            const seeds = lod === "low" ? 10 : 22;
            for (let i = 0; i < seeds; i++) {
                const a = (i / seeds) * TAU + 0.2;
                builder.blob({
                    position: [Math.cos(a) * 0.15, 0.062, Math.sin(a) * 0.15],
                    radius: 0.016,
                    scale: [1, 0.62, 1],
                    color: 0xffd84a,
                    ramp: [0.85, 1.12],
                    segments: 6,
                    segments2: 4,
                });
            }
            return { headY: top.y };
        },
    },

    /* ───────────────  6. HOA CÚC MÙA THU  ─────────────── */
    chrysanthemum: {
        id: "chrysanthemum",
        label: "Hoa Cúc Mùa Thu",
        height: [0.55, 0.82],
        schemes: [
            { id: "gold", tint: 0xefb23e },
            { id: "peach", tint: 0xf2a880 },
            { id: "lilac", tint: 0xc4a4d4 },
            { id: "white", tint: 0xf7f1e6 },
            { id: "red", tint: 0xd4535e },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.55, 0.82);
            const lean = rng.range(0.03, 0.12);
            const leanDir = rng.range(0, TAU);
            const bow = 0.12;

            builder.stem({
                height: h,
                radiusBase: 0.014,
                radiusTop: 0.009,
                lean,
                leanDir,
                bow,
                radialSegments: 5,
                heightSegments: 7,
            });

            for (let i = 0; i < (lod === "low" ? 2 : 4); i++) {
                const az = rng.range(0, TAU);
                const u = 0.14 + i * 0.2;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.012),
                    azimuth: az,
                    pitch: rng.range(0.15, 0.5),
                    length: 0.2,
                    halfWidth: 0.05,
                    profile: "ovate",
                    rib: 0.5,
                    droop: 0.22,
                    curl: 0.12,
                    serration: 0.14,
                    serrationFreq: 9,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            const LAYERS = [
                {
                    n: 13,
                    len: 0.76,
                    hw: 0.115,
                    tilt: 0.98,
                    fold: 0.9,
                    ramp: [0.56, 0.86, 1.16],
                },
                {
                    n: 12,
                    len: 0.67,
                    hw: 0.11,
                    tilt: 0.8,
                    fold: 1.05,
                    ramp: [0.57, 0.87, 1.15],
                },
                {
                    n: 11,
                    len: 0.56,
                    hw: 0.1,
                    tilt: 0.62,
                    fold: 1.2,
                    ramp: [0.58, 0.88, 1.13],
                },
                {
                    n: 9,
                    len: 0.44,
                    hw: 0.09,
                    tilt: 0.44,
                    fold: 1.35,
                    ramp: [0.6, 0.9, 1.11],
                },
                {
                    n: 7,
                    len: 0.32,
                    hw: 0.075,
                    tilt: 0.28,
                    fold: 1.5,
                    ramp: [0.62, 0.92, 1.09],
                },
                {
                    n: 5,
                    len: 0.2,
                    hw: 0.055,
                    tilt: 0.15,
                    fold: 1.62,
                    ramp: [0.64, 0.94, 1.07],
                },
            ];

            let phase = rng.range(0, TAU);
            for (const L of LAYERS) {
                const count = n(L.n, lod, 4);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: phase + i * step + rng.range(-0.05, 0.05),
                        tilt: L.tilt + rng.range(-0.06, 0.06),
                        radialOffset: 0.014 + rng.range(0, 0.014),
                        length: L.len * rng.range(0.93, 1.07),
                        halfWidth: L.hw * rng.range(0.9, 1.1),
                        profile: "thread",
                        bend: 0.3,
                        cup: 0.14,
                        tipNotch: 0.08,
                        tipNotchFreq: 3,
                        fold: L.fold,
                        ramp: L.ramp,
                        thickness: 0.007,
                    });
                }
                phase += step * 0.42;
            }

            builder.disc({
                radius: 0.1,
                flatten: 0.6,
                color: 0xf6cd55,
                ramp: [0.75, 1.1],
                segments: 14,
            });
            return { headY: top.y };
        },
    },

    /* ───────────────  7. HOA LAN  ─────────────── */
    orchid: {
        id: "orchid",
        label: "Hoa Lan",
        height: [0.48, 0.72],
        schemes: [
            { id: "white", tint: 0xf9f2ec },
            { id: "magenta", tint: 0xd06bb2 },
            { id: "pink", tint: 0xefb6cd },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.48, 0.72);
            const lean = rng.range(0.04, 0.12);
            const leanDir = rng.range(0, TAU);
            const bow = 0.16;

            builder.stem({
                height: h,
                radiusBase: 0.013,
                radiusTop: 0.008,
                lean,
                leanDir,
                bow,
                radialSegments: 5,
                heightSegments: 7,
            });

            // lá dày, bản, xếp chồng ở gốc
            for (let i = 0; i < (lod === "low" ? 2 : 3); i++) {
                const az = rng.range(0, TAU);
                const u = 0.12 + i * 0.2;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.02),
                    azimuth: az,
                    pitch: rng.range(0.25, 0.6),
                    roll: rng.range(-0.3, 0.3),
                    length: 0.22,
                    halfWidth: 0.07,
                    profile: "ovate",
                    rib: 0.55,
                    droop: 0.14,
                    curl: 0.06,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // 3 đài hoa: một đài lưng, hai đài bên
            // Mặt hoa hướng +Z (az = PI/2): 1 đài lưng + 2 đài bên
            const sepals = [
                { az: -Math.PI / 2, tilt: 1.32, len: 0.52, hw: 0.2 },
                { az: -Math.PI / 2 - 1.02, tilt: 0.98, len: 0.48, hw: 0.19 },
                { az: -Math.PI / 2 + 1.02, tilt: 0.98, len: 0.48, hw: 0.19 },
            ];
            for (const s of sepals) {
                builder.petal({
                    azimuth: s.az + rng.range(-0.06, 0.06),
                    tilt: s.tilt,
                    radialOffset: 0.012,
                    length: s.len,
                    halfWidth: s.hw,
                    profile: "sepal",
                    bend: 0.14,
                    cup: 0.2,
                    fold: 0.9,
                    ramp: [0.58, 0.86, 1.12],
                    thickness: 0.009,
                });
            }

            // 2 cánh bên rộng
            for (const s of [-1, 1]) {
                builder.petal({
                    azimuth: Math.PI / 2 + s * 1.0 + rng.range(-0.07, 0.07),
                    tilt: 0.5 + rng.range(-0.06, 0.06),
                    radialOffset: 0.016,
                    length: 0.54,
                    halfWidth: 0.245,
                    profile: "broadBlunt",
                    bend: 0.1,
                    cup: 0.3,
                    ruffle: 0.08,
                    ruffleFreq: 3,
                    fold: 0.85,
                    ramp: [0.56, 0.86, 1.15],
                    thickness: 0.01,
                });
            }

            // môi hoa (cánh môi) — màu riêng, không bị nhuộm
            builder.petal({
                azimuth: Math.PI / 2,
                tilt: -0.18,
                radialOffset: 0.05,
                length: 0.36,
                halfWidth: 0.225,
                profile: "roundBlunt",
                bend: 0.3,
                cup: 0.85,
                cupCurve: 1.5,
                fold: 0.5,
                tint: false,
                color: 0xc2387c,
                ramp: [0.7, 1.2],
                thickness: 0.012,
            });

            // trụ hoa + nắp bao phấn
            builder.blob({
                position: [0, 0.075, 0],
                radius: 0.018,
                scale: [1, 2.2, 1],
                color: 0xf7e9b4,
                ramp: [0.85, 1.1],
                segments: 7,
                segments2: 5,
            });
            builder.blob({
                position: [0, 0.115, 0],
                radius: 0.014,
                scale: [1.3, 0.8, 1.3],
                color: 0xf5d64a,
                ramp: [0.85, 1.12],
                segments: 7,
                segments2: 5,
            });
            return { headY: top.y };
        },
    },

    /* ───────────────  8. HOA LY  ─────────────── */
    lily: {
        id: "lily",
        label: "Hoa Ly",
        height: [0.85, 1.25],
        schemes: [
            { id: "white", tint: 0xf9f2e4 },
            { id: "pink", tint: 0xf2bfd0 },
            { id: "yellow", tint: 0xf3d889 },
            { id: "red", tint: 0xd2537a },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.85, 1.25);
            const lean = rng.range(0.03, 0.1);
            const leanDir = rng.range(0, TAU);
            const bow = 0.14;

            builder.stem({
                height: h,
                radiusBase: 0.019,
                radiusTop: 0.011,
                lean,
                leanDir,
                bow,
                radialSegments: 6,
                heightSegments: 9,
            });

            for (let i = 0; i < (lod === "low" ? 3 : 5); i++) {
                const az = rng.range(0, TAU);
                const u = 0.1 + i * 0.16;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.014),
                    azimuth: az,
                    pitch: rng.range(0.4, 0.85),
                    roll: rng.range(-0.3, 0.3),
                    length: 0.3,
                    halfWidth: 0.04,
                    profile: "lance",
                    rib: 0.45,
                    droop: 0.34,
                    curl: 0.2,
                    wave: 0.12,
                    waveFreq: 3,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // 3 tepal ngoài + 3 tepal trong
            for (let i = 0; i < 3; i++) {
                builder.petal({
                    azimuth: (i / 3) * TAU + rng.range(-0.05, 0.05),
                    tilt: 0.72 + rng.range(-0.05, 0.05),
                    radialOffset: 0.012,
                    length: 1.0 * rng.range(0.94, 1.06),
                    halfWidth: 0.3,
                    profile: "pointed",
                    bend: -0.3,
                    cup: 0.22,
                    twist: rng.range(-0.12, 0.12),
                    fold: 0.75,
                    ramp: [0.55, 0.85, 1.16],
                    thickness: 0.009,
                });
                builder.petal({
                    azimuth:
                        (i / 3) * TAU + Math.PI / 3 + rng.range(-0.05, 0.05),
                    tilt: 0.95 + rng.range(-0.05, 0.05),
                    radialOffset: 0.01,
                    length: 0.86,
                    halfWidth: 0.27,
                    profile: "pointed",
                    bend: -0.34,
                    cup: 0.2,
                    twist: rng.range(-0.12, 0.12),
                    fold: 0.85,
                    ramp: [0.56, 0.86, 1.14],
                    thickness: 0.009,
                });
            }

            // 6 nhị hoa dài, bao phấn dài
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU + 0.25;
                builder.stamen({
                    azimuth: a,
                    tilt: 0.55,
                    length: 0.16,
                    radius: 0.0045,
                    antherRadius: 0.009,
                    antherLength: 0.038,
                    position: [Math.cos(a) * 0.022, 0.03, Math.sin(a) * 0.022],
                    filamentColor: 0xf3e6b4,
                    antherColor: 0xb9773a,
                });
            }
            // nhụy
            builder.blob({
                position: [0, 0.1, 0],
                radius: 0.011,
                scale: [1, 3.0, 1],
                color: 0xfbf4e0,
                ramp: [0.85, 1.08],
                segments: 6,
                segments2: 4,
            });
            return { headY: top.y };
        },
    },

    /* ───────────────  9. HOA HƯỚNG DƯƠNG  ─────────────── */
    sunflower: {
        id: "sunflower",
        label: "Hoa Hướng Dương",
        height: [1.25, 1.85],
        schemes: [{ id: "gold", tint: 0xf0b52c }],
        build({ builder, rng, lod }) {
            const h = rng.range(1.25, 1.85);
            const lean = rng.range(0.05, 0.16);
            const leanDir = rng.range(0, TAU);
            const bow = 0.1;

            builder.stem({
                height: h,
                radiusBase: 0.036,
                radiusTop: 0.021,
                lean,
                leanDir,
                bow,
                radialSegments: 7,
                heightSegments: 9,
                wiggle: 0.14,
            });

            // lá to, gân rõ
            for (let i = 0; i < (lod === "low" ? 2 : 4); i++) {
                const az = rng.range(0, TAU);
                const u = 0.16 + i * 0.22;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.03),
                    azimuth: az,
                    pitch: rng.range(0.35, 0.75),
                    roll: rng.range(-0.4, 0.4),
                    length: 0.42,
                    halfWidth: 0.18,
                    profile: "ovate",
                    rib: 0.75,
                    droop: 0.2,
                    curl: 0.1,
                    serration: 0.09,
                    serrationFreq: 6,
                    wave: 0.08,
                    waveFreq: 2,
                });
            }

            const top = stemTop(h, lean, leanDir, bow);
            builder.setOrigin(top.x, top.y, top.z);

            // hai vòng cánh vàng
            const rings = [
                {
                    count: 20,
                    len: 0.86,
                    hw: 0.165,
                    tilt: 0.24,
                    off: 0.28,
                    phase: 0,
                },
                {
                    count: 16,
                    len: 0.7,
                    hw: 0.145,
                    tilt: 0.42,
                    off: 0.255,
                    phase: 0.19,
                },
            ];
            for (const r of rings) {
                const count = n(r.count, lod, 8);
                const step = TAU / count;
                for (let i = 0; i < count; i++) {
                    builder.petal({
                        azimuth: r.phase + i * step + rng.range(-0.03, 0.03),
                        tilt: r.tilt + rng.range(-0.04, 0.04),
                        radialOffset: r.off,
                        length: r.len * rng.range(0.94, 1.06),
                        halfWidth: r.hw * rng.range(0.92, 1.08),
                        profile: "oval",
                        bend: 0.1,
                        cup: 0.07,
                        tipNotch: 0.14,
                        tipNotchFreq: 3,
                        fold: 0.45,
                        ramp: [0.58, 0.87, 1.14],
                        thickness: 0.008,
                    });
                }
            }

            // nhụy nâu gồm các hạt xoắn ốc
            builder.seedHead({
                radius: 0.31,
                count: lod === "low" ? 42 : 88,
                seedRadius: 0.017,
                seedHeight: 0.026,
                color: 0x4a2e1d,
            });
            return { headY: top.y };
        },
    },

    /* ───────────────  10. HOA BABY'S BREATH  ─────────────── */
    babysbreath: {
        id: "babysbreath",
        label: "Hoa Baby's Breath",
        height: [0.4, 0.62],
        schemes: [
            { id: "white", tint: 0xfbf8f4 },
            { id: "pink", tint: 0xf3c9d7 },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.4, 0.62);
            const lean = rng.range(0.02, 0.07);
            const leanDir = rng.range(0, TAU);
            const bow = 0.1;
            builder.stem({
                height: h,
                radiusBase: 0.0055,
                radiusTop: 0.0035,
                lean,
                leanDir,
                bow,
                radialSegments: 4,
                heightSegments: 6,
                wiggle: 0.2,
            });

            // lá nhỏ ở gốc
            for (let i = 0; i < 3; i++) {
                const az = rng.range(0, TAU);
                const u = 0.08 + i * 0.1;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.006),
                    azimuth: az,
                    pitch: rng.range(0.3, 0.6),
                    length: 0.11,
                    halfWidth: 0.018,
                    profile: "lance",
                    rib: 0.4,
                    droop: 0.2,
                    curl: 0.08,
                });
            }

            const branches = lod === "low" ? 5 : 8;
            for (let b = 0; b < branches; b++) {
                const az = (b / branches) * TAU + rng.range(-0.3, 0.3);
                const u = 0.42 + (b / branches) * 0.5;
                // gốc cành bám vào thân chính (theo trục thân đã cong)
                const sp = stemPoint(h, lean, leanDir, bow, u);
                const bx = sp.x + Math.cos(az) * 0.006;
                const by = sp.y;
                const bz = sp.z + Math.sin(az) * 0.006;
                const bl = rng.range(0.1, 0.17);
                const blLean = rng.range(0.5, 0.95);

                builder.stem({
                    height: bl,
                    radiusBase: 0.0032,
                    radiusTop: 0.002,
                    lean: blLean,
                    leanDir: az,
                    bow: 0.15,
                    radialSegments: 4,
                    heightSegments: 4,
                    position: [bx, by, bz],
                    wiggle: 0.2,
                });

                // ngọn cành phụ: cùng công thức với createStemGeometry
                const bt = stemPoint(bl, blLean, az, 0.15, 1);
                const tipX = bx + bt.x;
                const tipY = by + bt.y;
                const tipZ = bz + bt.z;

                const flowers = lod === "low" ? 3 : 5;
                for (let f = 0; f < flowers; f++) {
                    const fa = rng.range(0, TAU);
                    const fr = rng.range(0.005, 0.028);
                    const fx = tipX + Math.cos(fa) * fr;
                    const fy = tipY + rng.range(-0.02, 0.01);
                    const fz = tipZ + Math.sin(fa) * fr;

                    builder.setOrigin(fx, fy, fz);
                    const petals = lod === "low" ? 5 : 5;
                    for (let p = 0; p < petals; p++) {
                        builder.petal({
                            azimuth: (p / petals) * TAU + rng.range(-0.1, 0.1),
                            tilt: rng.range(0.2, 0.7),
                            radialOffset: 0.004,
                            length: 0.036,
                            halfWidth: 0.019,
                            profile: "round",
                            bend: 0.08,
                            cup: 0.14,
                            fold: 0.6,
                            ramp: [0.68, 0.92, 1.1],
                            thickness: 0.006,
                            segments: [4, 2],
                        });
                    }
                    builder.blob({
                        position: [0, 0.004, 0],
                        radius: 0.009,
                        color: 0xf7e6a0,
                        ramp: [0.8, 1.08],
                        segments: 6,
                        segments2: 4,
                    });
                }
            }
            builder.setOrigin(0, 0, 0);
            return { headY: h };
        },
    },

    /* ───────────────  11. HOA OẢI HƯƠNG  ─────────────── */
    lavender: {
        id: "lavender",
        label: "Hoa Oải Hương",
        height: [0.5, 0.74],
        schemes: [
            { id: "purple", tint: 0x8c6ec6 },
            { id: "deep", tint: 0x6d50a6 },
            { id: "soft", tint: 0xa98fd6 },
        ],
        build({ builder, rng, lod }) {
            const h = rng.range(0.5, 0.74);
            const lean = rng.range(0.02, 0.08);
            const leanDir = rng.range(0, TAU);
            const bow = 0.08;
            builder.stem({
                height: h,
                radiusBase: 0.007,
                radiusTop: 0.004,
                lean,
                leanDir,
                bow,
                radialSegments: 4,
                heightSegments: 7,
                wiggle: 0.16,
            });

            // lá hẹp ở gốc
            for (let i = 0; i < 3; i++) {
                const az = rng.range(0, TAU);
                const u = 0.06 + i * 0.07;
                builder.leaf({
                    position: stemAttach(h, lean, leanDir, bow, u, az, 0.006),
                    azimuth: az,
                    pitch: rng.range(0.5, 0.9),
                    roll: rng.range(-0.3, 0.3),
                    length: 0.17,
                    halfWidth: 0.016,
                    profile: "strap",
                    rib: 0.3,
                    droop: 0.24,
                    curl: 0.12,
                });
            }

            // cụm hoa nhỏ chạy dọc ngọn thân
            const florets = lod === "low" ? 16 : 30;
            const golden = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < florets; i++) {
                const t = i / (florets - 1);
                const u = 0.5 + t * 0.5;
                const a = i * golden;
                const r = 0.018 * (1 - t * 0.45);
                // bám theo trục thân (thân cong) thay vì đường thẳng
                const sp = stemPoint(h, lean, leanDir, bow, u);
                const fx = sp.x + Math.cos(a) * r;
                const fy = sp.y;
                const fz = sp.z + Math.sin(a) * r;

                builder.setOrigin(fx, fy, fz);
                // mỗi hoa có 2 cánh nhỏ (nhị ở trên)
                for (let p = 0; p < 2; p++) {
                    builder.petal({
                        azimuth: a + p * Math.PI + rng.range(-0.2, 0.2),
                        tilt: rng.range(0.9, 1.4),
                        radialOffset: 0.004,
                        length: 0.03,
                        halfWidth: 0.014,
                        profile: "round",
                        bend: 0.2,
                        cup: 0.2,
                        fold: 0.5,
                        ramp: [0.6, 0.88, 1.14],
                        thickness: 0.005,
                        segments: [4, 2],
                    });
                }
            }
            builder.setOrigin(0, 0, 0);
            return { headY: h };
        },
    },
};

export const SPECIES_IDS = Object.keys(SPECIES);
