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

const TAU_2 = Math.PI * 2;

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
  /**
   * Cánh TRÒN ĐẦU: rộng gần như tới đầu rồi bo nhanh.
   *
   * Quan trọng: hàng đỉnh của lưới vẫn phải giữ lại một chút bề rộng.
   * Nếu bề rộng chụm về 0 ở hàng cuối thì đầu cánh thành ĐIỂM NHỌN
   * (nhìn cạnh là lưỡi dao) hoặc thành mảnh giấy bị cắt gọt.
   * Cánh thật luôn bo tròn ở mép, nên ta giữ ~24% bề rộng ở đầu.
   */
  roundBlunt: (u) => {
    const t = clamp(u, 0, 1);
    const body =
      Math.pow(1 - Math.pow(1 - t, 2.4), 0.55) * (1 - 0.78 * Math.pow(t, 8));
    return Math.max(body, 0.26 * Math.pow(t, 0.6));
  },
  /** Cánh rộng + tròn đầu — mẫu đơn, đào. */
  broadBlunt: (u) => {
    const t = clamp(u, 0, 1);
    const body =
      Math.pow(Math.sin(Math.PI * Math.pow(t, 0.5)), 0.55) *
      (1 - 0.78 * Math.pow(t, 6));
    return Math.max(body, 0.24 * Math.pow(t, 0.6));
  },
  /** Dải dài ôm thân — tulip dùng tên 'strap'. */
  strap: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.62)), 0.55),
  /**
   * Đài hoa: hẹp ở gốc, nở dần, đầu bo tròn (dùng cho hoa lan).
   * Dạng 'lance' cũ tạo ra tam giác sắc như giấy cắt, trông rất giả.
   */
  sepal: (u) => {
    const t = clamp(u, 0, 1);
    const body =
      Math.pow(1 - Math.pow(1 - t, 1.8), 0.6) * (1 - 0.78 * Math.pow(t, 6));
    return Math.max(body, 0.24 * Math.pow(t, 0.6));
  },
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
    bendCurve: 1.25,
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
    /** Gân hoa: 0 = phẳng, 1 = gân nổi rõ (gân giữa + gân phụ toả ra). */
    vein: 0,
    /** Số gân phụ dọc cánh. */
    veinFreq: 7,
    /** Nhiễu vi mô (hạt phấn / texture) biên độ 0..0.2. */
    micro: 0.05,
    /** Dải sáng: giá trị ở gốc / giữa / đầu (dùng làm vertex color). */
    rampFrom: 0.58,
    rampMid: 0.84,
    rampTo: 1.12,
    ...o,
  };

  const rows = Math.max(2, p.segmentsLength + 1);
  // Vòng kín quanh thiết diện: mặt trước (j = 0..sw) + mặt sau (j = sw+1..2sw).
  // Cột cuối (2sw) trùng vị trí cột 0 → mép cánh khép kín, không hở.
  const cols = Math.max(4, p.segmentsWidth * 2);
  const count = rows * cols;

  /* ── GIỚI HẠN TẦN SỐ THEO LƯỚI (chống aliasing) ──
     Mẫu lấy trên lưới N điểm chỉ biểu diễn được tối đa ~N/2 chu kỳ.
     Nếu nhiễu/gân/gợn mép vượt ngưỡng đó, các đỉnh lấy mẫu lệch nhau →
     mặt cánh bị "vỡ" thành mảnh kính, trông như giấy gấp rối.
     Ở đây ta dùng SỐ CHU KỲ cố định, luôn an toàn với mọi mức LOD. */
  // số điểm lấy mẫu thực tế theo 2 hướng
  const nU = p.segmentsLength + 1; // dọc chiều dài cánh
  const nV = p.segmentsWidth * 2 + 1; // quanh thiết diện

  // hệ số nhân để đưa tần số về dưới ngưỡng Nyquist
  const fU = Math.max(1, nU * 0.16); // ~1.7 chu kỳ dọc cánh
  const fV = Math.max(1, nV * 0.14); // ~1.3 chu kỳ quanh mặt cắt
  const veinFreq = Math.max(1, Math.min(p.veinFreq, nV * 0.16));
  // Gợn mép & khía răng cưa cũng phải giới hạn theo lưới, nếu không sẽ
  // sinh "gai kim" mảnh nhọn xuyên ra khỏi cánh.
  const ruffleFreq = Math.max(1, Math.min(p.ruffleFreq, nU * 0.2));
  const notchFreq = Math.max(1, Math.min(p.tipNotchFreq, nU * 0.18));

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
      const saw = Math.abs(Math.sin(u * Math.PI * notchFreq));
      w *= 1 - p.tipNotch * nearTip * saw;
    }
    w = Math.max(w, 1e-4);

    // mép cánh dày hơn ở gốc, mỏng dần về đầu
    const h = p.thickness * (0.32 + 0.68 * Math.pow(1 - u, 0.55));

    // gợn mép
    const wave =
      1 + p.ruffle * Math.sin(u * ruffleFreq * Math.PI * 2 + p.rufflePhase);

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
        // mặt trước (phồng về +Y): từ mép trái (z = -w) qua đỉnh tới mép phải (z = +w)
        const phi = (j / p.segmentsWidth) * Math.PI;
        zc = -w * Math.cos(phi);
        yc = h * Math.sin(phi);
      } else {
        // Mặt sau (lõm về -Y): tiếp tục từ mép phải quay lại mép trái.
        // Dùng sw-1 đoạn (thay vì sw) để mép cánh khép kín mà KHÔNG cần
        // thêm cột đỉnh — giữ nguyên số tam giác như bản gốc.
        const backSpan = Math.max(1, p.segmentsWidth - 1);
        const phi = ((j - p.segmentsWidth - 1) / backSpan) * Math.PI;
        zc = w * Math.cos(phi);
        yc = -h * Math.sin(phi);
      }

      zc *= wave;

      // ôm chén: mép cánh nhấc lên theo bát tròn mượt (không tạo nếp gấp)
      const vn = clamp(zc / w, -1, 1);
      yc += cupK * Math.pow(Math.max(0, 1 - vn * vn), p.cupCurve * 0.5);

      /* ---- Gân hoa: gân giữa nổi + gân phụ chạy dọc cánh ---- */
      if (p.vein > 0) {
        // gân chính ở giữa cánh
        const mid = Math.exp(-vn * vn * 11.0);
        // gân phụ toả ra từ giữa, mạnh dần về mép
        const side = 0.5 + 0.5 * Math.cos(vn * Math.PI * veinFreq);
        const grow = 0.25 + 0.75 * Math.pow(u, 0.55);
        yc += p.vein * w * (mid * 0.55 + side * 0.16) * grow;
      }

      /* ---- Nhiễu vi mô: bề mặt không hoàn hảo, có hạt phấn ---- */
      if (p.micro > 0) {
        // 1.7 / 0.9 / 2.3 chu kỳ — luôn dưới ngưỡng Nyquist của lưới
        const n1 =
          Math.sin((u * 1.7 + vn * 0.6) * TAU_2) *
          Math.sin((u * 0.9 - vn * 1.1) * TAU_2);
        const n2 = Math.sin((u * 2.3 + vn * 1.3) * TAU_2);
        yc += p.micro * w * (n1 * 0.6 + n2 * 0.4);
      }

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
      let c = ramp * edgeShade;
      // gân sáng hơn nền (ánh sáng lướt trên gân)
      if (p.vein > 0) {
        const mid = Math.exp(-vn * vn * 11.0);
        const side = 0.5 + 0.5 * Math.cos(vn * Math.PI * veinFreq);
        c *= 1 + p.vein * (mid * 0.24 + side * 0.07) * (0.3 + 0.7 * u);
      }
      // hạt phấn lấm tấm
      if (p.micro > 0) {
        const g1 =
          Math.sin((u * 1.9 + vn * 0.7) * TAU_2) *
          Math.sin((u * 1.1 - vn * 1.2) * TAU_2);
        c *= 1 + p.micro * g1 * 1.6;
      }
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
 * Điểm trên trục giữa của thân tại tham số u ∈ [0,1] (0 = gốc, 1 = ngọn).
 * Dùng chung với createStemGeometry() để lá/cành bám đúng vào thân cong.
 */
export function stemPoint(h, lean, leanDir, bow, u) {
    const s = Math.sin(lean * u) * h * 0.5;
    return {
        x: s * Math.cos(leanDir),
        y: u * h - bow * Math.pow(u, 2.2) * h * 0.5,
        z: s * Math.sin(leanDir),
    };
}

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
    const c = stemPoint(p.height, p.lean, p.leanDir, p.bow, u);
    centers.push([c.x, c.y, c.z]);
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
