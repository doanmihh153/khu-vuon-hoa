/**
 * Hệ thống hình học cánh hoa thủ tục.
 *
 * Mỗi cánh hoa được dựng từ một "mặt bề mặt" tham số:
 *   • trục dọc  X : từ gốc (0) ra đầu cánh (length)
 *   • trục pháp  Y : hướng mặt trước của cánh (bề mặt "bụng")
 *   • trục ngang Z: chiều rộng của cánh
 *
 * Bề mặt là một vỏ kín (lens) nên cánh có độ dày thị giác thật:
 * mặt trước phồng lên, mặt sau lõm xuống, mép cánh mỏng dần.
 *
 * Các biến dạng (cong dọc, ôm chén, xoắn, gợn mép, khía răng cưa…) được
 * áp dụng theo đúng thứ tự để giữ cho hình khối luôn mềm mại:
 *   profile → mép gợn → ôm chén → xoắn → cong dọc
 */

import * as THREE from 'three';
import { clamp, lerp } from '../utils/math.js';

/* ─────────────────────────  Hồ sơ bề rộng  ───────────────────────── */

/** Các hồ sơ bề rộng tiêu chuẩn — mỗi loài hoa có một dáng riêng. */
export const WidthProfile = {
  /** Bầu dục: hẹp ở gốc, rộng nhất ở 2/3, thu về đầu. */
  oval: (u) => Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.78)),
  /** Alias cho loài dùng tên 'ovate' (lá/hồng). */
  ovate: (u) => Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.78)),
  /** Rộng: mở rộng sớm, dùng cho mẫu đơn, đào. */
  broad: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.52)), 0.72),
  /** Tròn: mép tròn đều, dùng cho cúc mèo, cẩm chướng. */
  round: (u) => Math.sqrt(Math.max(0, 1 - Math.pow(2 * clamp(u, 0, 1) - 1, 2))),
  /** Nhọn: dẹt ở gốc, đầu nhọn — hoa ly. */
  pointed: (u) => Math.pow(Math.max(0, 1 - u), 0.52) * Math.pow(clamp(u, 0, 1), 0.26),
  /** Chén: rộng ở giữa, đầu hơi cụp tròn — tulip. */
  chalice: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.62)), 0.55),
  /** Sợi: rất hẹp, dài — cánh cúc, cánh oải hương. */
  thread: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.9)), 0.45),
  /** Trở: hẹp ở gốc, rộng ở đầu — cánh môi của lan. */
  spatulate: (u) => Math.pow(clamp(u, 0, 1), 0.7) * Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 1.5) * 0.5 + 0.4),
  /** Ngược: hẹp ở đầu, rộng ở 1/3 — cánh ngoài của hồng. */
  obovate: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.66)), 0.85),
  /** Dải dài ôm thân — tulip dùng tên 'strap'. */
  strap: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.62)), 0.55),
  /** Nhọn dài — lan/tulip dùng tên 'lance'. */
  lance: (u) => Math.pow(Math.max(0, 1 - u), 0.35) * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.7)), 0.6),
};

/* ─────────────────────────  Hàm dựng cánh  ───────────────────────── */

/**
 * @param {object} o thông số cánh hoa
 * @returns {THREE.BufferGeometry}
 */
export function createPetalGeometry(o = {}) {
  const p = {
    length: 1,
    halfWidth: 0.4,
    thickness: 0.016,
    segmentsLength: 8,
    segmentsWidth: 4,
    widthProfile: WidthProfile.oval,

    /** Tổng góc cong của trục dọc (radian). Dương = đầu cánh ngả về mặt trước. */
    bendAngle: 0.45,
    bendCurve: 1.7,
    /** Độ ôm chén theo chiều ngang (radian tương đương). */
    cup: 0.1,
    cupCurve: 2.1,
    /** Xoắn dọc trục (radian). */
    twist: 0,
    /** Gợn mép: biên độ (tỉ lệ bề rộng) & số lần gợn dọc. */
    ruffle: 0,
    ruffleFreq: 6,
    rufflePhase: 0,
    /** Khía răng cưa ở đầu cánh (cẩm chướng). */
    tipNotch: 0,
    tipNotchFreq: 3,
    /** Siết nhỏ rất gốc. */
    basePinch: 0,
    /** Dải sáng: giá trị ở gốc / giữa / đầu (dùng làm vertex color). */
    rampFrom: 0.58,
    rampMid: 0.84,
    rampTo: 1.12,
    ...o,
  };

  const rows = Math.max(2, p.segmentsLength + 1);
  const cols = Math.max(4, p.segmentsWidth * 2); // vòng kín quanh thiết diện
  const count = rows * cols;

  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);

  /* ---- Đường sống (spine) của cánh ---- */
  const spineX = new Float32Array(rows);
  const spineY = new Float32Array(rows);
  const psi = new Float32Array(rows);
  const step = p.length / (rows - 1);

  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    psi[i] = p.bendAngle * Math.pow(u, p.bendCurve);
    if (i > 0) {
      const uMid = (i - 0.5) / (rows - 1);
      const pm = p.bendAngle * Math.pow(uMid, p.bendCurve);
      spineX[i] = spineX[i - 1] + step * Math.cos(pm);
      spineY[i] = spineY[i - 1] + step * Math.sin(pm);
    }
  }

  /* ---- Dựng mặt bề mặt ---- */
  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);

    let w = p.halfWidth * p.widthProfile(u);
    if (p.basePinch > 0) w *= 1 - p.basePinch * Math.exp(-u * 10);
    if (p.tipNotch > 0) {
      const nearTip = Math.pow(clamp((u - 0.7) / 0.3, 0, 1), 1.4);
      const saw = Math.abs(Math.sin(u * Math.PI * p.tipNotchFreq));
      w *= 1 - p.tipNotch * nearTip * saw;
    }
    w = Math.max(w, 1e-4);

    // mép cánh dày hơn ở gốc, mỏng dần về đầu
    const h = p.thickness * (0.32 + 0.68 * Math.pow(1 - u, 0.55));

    // gợn mép
    const wave = 1 + p.ruffle * Math.sin(u * p.ruffleFreq * Math.PI * 2 + p.rufflePhase);

    const cupK = p.cup * w;
    const twistA = p.twist * u;
    const cT = Math.cos(twistA);
    const sT = Math.sin(twistA);
    const cP = Math.cos(psi[i]);
    const sP = Math.sin(psi[i]);

    // dải sáng theo chiều dài
    let ramp;
    if (u < 0.45) ramp = lerp(p.rampFrom, p.rampMid, u / 0.45);
    else ramp = lerp(p.rampMid, p.rampTo, (u - 0.45) / 0.55);

    for (let j = 0; j < cols; j++) {
      let zc;
      let yc;

      if (j <= p.segmentsWidth) {
        // mặt trước (phồng về +Y)
        const phi = (j / p.segmentsWidth) * Math.PI;
        zc = -w * Math.cos(phi);
        yc = h * Math.sin(phi);
      } else {
        // mặt sau (lõm về -Y)
        const phi = ((j - p.segmentsWidth) / p.segmentsWidth) * Math.PI;
        zc = w * Math.cos(phi);
        yc = -h * Math.sin(phi);
      }

      zc *= wave;

      // ôm chén: mép cánh nhấc lên
      const vn = clamp(zc / w, -1, 1);
      yc += cupK * Math.pow(Math.abs(vn), p.cupCurve);

      // xoắn quanh trục dọc
      const ty = yc * cT - zc * sT;
      const tz = yc * sT + zc * cT;

      // cong dọc: xoay thiết diện quanh trục ngang
      const ry = ty * cP - tz * sP;
      const rz = ty * sP + tz * cP;

      const idx = (i * cols + j) * 3;
      positions[idx] = spineX[i];
      positions[idx + 1] = spineY[i] + ry;
      positions[idx + 2] = rz;

      const uidx = (i * cols + j) * 2;
      uvs[uidx] = u;
      uvs[uidx + 1] = j / cols;

      // sáng dần về đầu, mép hơi tối để tạo chiều sâu
      const edgeShade = 1 - Math.pow(Math.abs(vn), 3) * 0.1;
      const c = ramp * edgeShade;
      colors[idx] = c;
      colors[idx + 1] = c;
      colors[idx + 2] = c;
    }
  }

  /* ---- Chỉ mục ---- */
  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = (i + 1) * cols + j2;
      const d = (i + 1) * cols + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ─────────────────────────  Lá  ───────────────────────── */

/**
 * Lá đơn giản, mềm mại: có gân giữa nổi, mép hơi gợn, đầu nhọn.
 * Mặt đơn — vật liệu lá dùng DoubleSide.
 */
export function createLeafGeometry(o = {}) {
  const p = {
    length: 0.3,
    halfWidth: 0.085,
    segmentsLength: 7,
    segmentsWidth: 3,
    profile: 'ovate',
    /** Gân giữa nổi (0..1 × bề rộng). */
    rib: 0.5,
    /** Mép lá rủ xuống. */
    droop: 0.16,
    /** Cong ngược (lá uốn về dưới). */
    curl: 0.1,
    /** Răng cưa mép lá. */
    serration: 0,
    serrationFreq: 9,
    wave: 0,
    waveFreq: 3,
    ...o,
  };

  const profiles = {
    ovate: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.82)), 0.9),
    lance: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.72),
    strap: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.34)), 0.4),
    round: (u) => Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))) * 0.95 + 0.05,
  };
  const profile = profiles[p.profile] || profiles.ovate;

  const rows = Math.max(2, p.segmentsLength + 1);
  const cols = Math.max(2, p.segmentsWidth + 1);
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    let w = p.halfWidth * profile(u);
    if (p.serration > 0) {
      w *= 1 + p.serration * Math.sin(u * p.serrationFreq * Math.PI * 2) * Math.pow(u, 0.6);
    }
    if (p.wave > 0) {
      w *= 1 + p.wave * Math.sin(u * p.waveFreq * Math.PI * 2);
    }
    w = Math.max(w, 1e-4);

    const droop = -p.droop * Math.pow(u, 2.1) * p.length;
    const curl = -p.curl * Math.pow(u, 2.4) * p.length;

    for (let j = 0; j < cols; j++) {
      const v = -1 + (2 * j) / (cols - 1);
      const z = v * w;
      // gân giữa nổi lên, mép lá rủ nhẹ
      const y = -p.rib * w * v * v + droop + curl;

      const idx = (i * cols + j) * 3;
      positions[idx] = u * p.length;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      const uidx = (i * cols + j) * 2;
      uvs[uidx] = u;
      uvs[uidx + 1] = (v + 1) * 0.5;

      // lá sáng ở gân, tối ở mép
      const shade = lerp(1.12, 0.72, Math.pow(Math.abs(v), 1.6)) * lerp(0.86, 1.0, u);
      colors[idx] = shade;
      colors[idx + 1] = shade;
      colors[idx + 2] = shade;
    }
  }

  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = i * cols + j + 1;
      const c = (i + 1) * cols + j + 1;
      const d = (i + 1) * cols + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ─────────────────────────  Thân cây  ───────────────────────── */

/**
 * Thân cây dạng ống theo đường cong, thon dần — dùng chung cho các loài
 * nhưng tham số khác nhau nên mỗi loài vẫn có thân riêng.
 */
export function createStemGeometry(o = {}) {
  const p = {
    height: 1,
    radiusBase: 0.022,
    radiusTop: 0.011,
    /** Độ cong ngang của thân (radian). */
    lean: 0.12,
    leanDir: 0,
    /** Độ uốn dọc (radian, tổng). */
    bow: 0.22,
    bowDir: 0,
    radialSegments: 6,
    heightSegments: 8,
    /** Biến dạng thân. */
    wiggle: 0.1,
    ...o,
  };

  const rows = p.heightSegments + 1;
  const cols = p.radialSegments;
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);

  const centers = [];
  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    const x = Math.sin(p.lean * u) * Math.cos(p.leanDir) * p.height * 0.5;
    const z = Math.sin(p.lean * u) * Math.sin(p.leanDir) * p.height * 0.5;
    const y = u * p.height - p.bow * Math.pow(u, 2.2) * p.height * 0.5;
    centers.push([x, y, z]);
  }

  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    const [cx, cy, cz] = centers[i];
    const r = lerp(p.radiusBase, p.radiusTop, Math.pow(u, 0.7));

    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      const wob = 1 + p.wiggle * Math.sin(u * 7.3 + a * 2.1) * 0.5;
      const idx = (i * cols + j) * 3;
      positions[idx] = cx + Math.cos(a) * r * wob;
      positions[idx + 1] = cy;
      positions[idx + 2] = cz + Math.sin(a) * r * wob;

      const uidx = (i * cols + j) * 2;
      uvs[uidx] = j / cols;
      uvs[uidx + 1] = u;

      const shade = lerp(0.72, 1.06, u);
      colors[idx] = shade;
      colors[idx + 1] = shade;
      colors[idx + 2] = shade;
    }
  }

  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = (i + 1) * cols + j2;
      const d = (i + 1) * cols + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
