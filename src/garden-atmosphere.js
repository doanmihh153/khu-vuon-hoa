/** garden-atmosphere.js — Mây, bướm, cánh hoa rơi, hạt sáng. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeCanvasTexture } from "./garden-core.js";

/* ═══════════════════════════════════════════════════════════════
   BƯỚM — dựng 1 lần ở cấp module để dùng lại (khu vườn & quanh gốc cây)
   ═══════════════════════════════════════════════════════════════ */

const WING_SPAN = 0.25;

/** Đường viền một cánh bướm (cánh trước lớn + cánh sau nhỏ). */
function wingPath(ctx, X, Y) {
  ctx.moveTo(X(0.0), Y(0.03));
  ctx.bezierCurveTo(X(0.05), Y(0.1), X(0.14), Y(0.13), X(0.2), Y(0.08));
  ctx.bezierCurveTo(X(0.245), Y(0.045), X(0.24), Y(-0.01), X(0.185), Y(-0.035));
  ctx.bezierCurveTo(X(0.16), Y(-0.05), X(0.13), Y(-0.05), X(0.105), Y(-0.055));
  ctx.bezierCurveTo(X(0.125), Y(-0.115), X(0.09), Y(-0.155), X(0.045), Y(-0.15));
  ctx.bezierCurveTo(X(0.012), Y(-0.145), X(0.0), Y(-0.1), X(0.0), Y(-0.05));
  ctx.closePath();
}

/** Hoạ tiết cánh: nền cam, viền đen, gân đen, chấm trắng. */
function makeWingTexture(colors) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  const minX = -0.005, maxX = 0.25, minY = -0.16, maxY = 0.135;
  const X = (v) => ((v - minX) / (maxX - minX)) * S;
  const Y = (v) => S - ((v - minY) / (maxY - minY)) * S;

  ctx.clearRect(0, 0, S, S);
  const g = ctx.createLinearGradient(X(0), Y(0.12), X(0.25), Y(-0.14));
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  wingPath(ctx, X, Y);
  ctx.fill();

  ctx.strokeStyle = "rgba(38,22,16,.85)";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  const veins = [
    [0.2, 0.075], [0.165, 0.02], [0.125, -0.03], [0.08, -0.06],
    [0.055, -0.105], [0.03, -0.135], [0.155, -0.055], [0.215, 0.03],
  ];
  for (const [tx, ty] of veins) {
    ctx.beginPath();
    ctx.moveTo(X(0.012), Y(0.02));
    ctx.quadraticCurveTo(X(tx * 0.45), Y(ty * 0.35 + 0.02), X(tx), Y(ty));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,252,244,.92)";
  const dots = [
    [0.205, 0.055], [0.222, 0.02], [0.205, -0.012], [0.16, -0.035],
    [0.128, -0.062], [0.1, -0.1], [0.062, -0.128], [0.09, -0.118],
  ];
  for (const [dx, dy] of dots) {
    ctx.beginPath();
    ctx.ellipse(X(dx), Y(dy), 4.2, 3.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(32,18,13,.92)";
  ctx.lineWidth = 9;
  ctx.lineJoin = "round";
  ctx.beginPath();
  wingPath(ctx, X, Y);
  ctx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Hình học 2 cánh (trái + phải) nằm ngang, trục Z là hướng bay. */
function makeWingGeometry() {
  const shape = new THREE.Shape();
  wingPath(shape, (v) => v, (v) => v);
  const right = new THREE.ShapeGeometry(shape, 14);

  right.computeBoundingBox();
  const bb = right.boundingBox;
  const pos = right.attributes.position;
  const uv = right.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
      (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y),
    );
  }
  uv.needsUpdate = true;

  const left = right.clone();
  const lp = left.attributes.position;
  for (let i = 0; i < lp.count; i++) lp.setX(i, -lp.getX(i));
  lp.needsUpdate = true;
  left.computeVertexNormals();

  const geo = mergeGeometries([right, left]);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** Thân + râu bướm, gộp thành 1 mesh. */
function makeBodyGeometry() {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.014, 0.1, 4, 8);
  body.rotateX(Math.PI / 2);
  parts.push(body);
  for (const s of [-1, 1]) {
    const ant = new THREE.CylinderGeometry(0.0016, 0.0016, 0.075, 4);
    ant.rotateZ(s * 0.55);
    ant.rotateX(Math.PI / 2.6);
    ant.translate(s * 0.012, 0.006, 0.075);
    parts.push(ant);
  }
  return mergeGeometries(parts);
}

const WING_GEO = makeWingGeometry();
const BODY_GEO = makeBodyGeometry();
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

export const BUTTERFLY_SKINS = [
  { tex: [hex(0xffb347), hex(0xff8a1f), hex(0xe86a12)], body: 0x2a1a12 },
  { tex: [hex(0xfff0f5), hex(0xffd7e6), hex(0xf7b8cf)], body: 0x3a2a22 },
  { tex: [hex(0xd9c6ff), hex(0xb79bff), hex(0x9b7bea)], body: 0x2a1a12 },
  { tex: [hex(0xfff6cf), hex(0xffe89a), hex(0xf6cf4a)], body: 0x3a2a22 },
];

/**
 * Tạo một con bướm.
 * @param {object} opts cx,cz,r,r2,h — quỹ đạo bay; scale — cỡ.
 */
export function createButterfly(skinIndex, rng, opts = {}) {
  const skin = BUTTERFLY_SKINS[skinIndex % BUTTERFLY_SKINS.length];
  const mat = new THREE.MeshStandardMaterial({
    map: makeWingTexture(skin.tex),
    side: THREE.DoubleSide,
    transparent: true,
    roughness: 0.62,
    metalness: 0,
    alphaTest: 0.35,
  });
  // vẫy cánh bằng vertex shader: mỗi đỉnh xoay quanh trục thân,
  // góc tăng dần từ thân ra mép cánh → cánh cong mềm.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlap = { value: 0 };
    shader.uniforms.uSpan = { value: WING_SPAN };
    shader.vertexShader =
      "uniform float uFlap;\nuniform float uSpan;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      {
        float t = clamp(abs(transformed.x) / uSpan, 0.0, 1.0);
        float sgn = transformed.x < 0.0 ? -1.0 : 1.0;
        float a = uFlap * (0.28 + 0.72 * t) * sgn;
        float cf = cos(a), sf = sin(a);
        float px = transformed.x, py = transformed.y;
        transformed.x = px * cf - py * sf;
        transformed.y = px * sf + py * cf;
      }`,
    );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => "butterfly-wing";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: skin.body,
    roughness: 0.75,
    metalness: 0,
  });

  const group = new THREE.Group();
  const wings = new THREE.Mesh(WING_GEO, mat);
  const bodyMesh = new THREE.Mesh(BODY_GEO, bodyMat);
  group.add(wings, bodyMesh);
  group.scale.setScalar(opts.scale ?? rng.range(0.85, 1.35));
  group.userData = {
    mat,
    t: rng.range(0, 100),
    cx: opts.cx ?? rng.range(-9, 9),
    cz: opts.cz ?? rng.range(-26, 12),
    r: opts.r ?? rng.range(1.6, 5),
    r2: opts.r2 ?? rng.range(1.2, 3.4),
    h: opts.h ?? rng.range(0.9, 2.4),
    sp: opts.sp ?? rng.range(0.3, 0.6),
    flapSpeed: rng.range(9, 15),
    phase: rng.range(0, 6.283),
  };
  return { group, update: (dt, t) => updateButterfly(group, dt, t) };
}

/** Cập nhật vị trí + vẫy cánh cho một bướm. */
export function updateButterfly(b, dt, t) {
  const u = b.userData;
  u.t += dt * u.sp * 2;
  const x = u.cx + Math.cos(u.t) * u.r;
  const z = u.cz + Math.sin(u.t * 0.9) * u.r2;
  const y = u.h + Math.sin(u.t * 1.7) * 0.45 + Math.sin(t * 2.4 + u.phase) * 0.07;
  b.position.set(x, y, z);
  const hx = -Math.sin(u.t) * u.r;
  const hz = Math.cos(u.t * 0.9) * u.r2 * 0.9;
  b.rotation.y = Math.atan2(hx, hz);
  b.rotation.z = Math.sin(u.t * 1.7) * 0.22;
  b.rotation.x = Math.sin(t * 1.9 + u.phase) * 0.08;
  const sh = u.mat.userData.shader;
  if (sh) sh.uniforms.uFlap.value = Math.sin(t * u.flapSpeed + u.phase) * 0.95;
}

export function buildAtmosphere({ scene, rng, quality }) {
  const Q = quality;
  const petalTex = makeCanvasTexture((ctx, s) => {
    const gr = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,235,242,1)");
    gr.addColorStop(0.55, "rgba(248,180,205,0.9)");
    gr.addColorStop(1, "rgba(248,180,205,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s);
  });
  const moteTex = makeCanvasTexture((ctx, s) => {
    const gr = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,250,230,1)");
    gr.addColorStop(0.4, "rgba(255,230,190,0.7)");
    gr.addColorStop(1, "rgba(255,230,190,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s);
  });

  function makePoints(count, area, size, map, opacity, additive) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rng.range(-area.x, area.x);
      pos[i * 3 + 1] = rng.range(0, area.y);
      pos[i * 3 + 2] = rng.range(-area.z, area.z);
      seed[i * 4] = rng.range(0, 100);
      seed[i * 4 + 1] = rng.range(0.4, 1.4);
      seed[i * 4 + 2] = rng.range(0, 6.283);
      seed[i * 4 + 3] = rng.range(0.2, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.PointsMaterial({ size, map, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    if (additive) mat.blending = THREE.AdditiveBlending;
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  }

  const falling = makePoints(Q.fallingPetals, { x: 12, y: 9, z: 26 }, 0.34, petalTex, 0.85, false);
  falling.position.z = -6;
  const motes = makePoints(Q.motes, { x: 14, y: 7, z: 28 }, 0.12, moteTex, 0.7, true);
  motes.position.z = -6;

  const clouds = [];
  const cloudTex = makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) {
      const x = s * 0.2 + Math.random() * s * 0.6, y = s * 0.35 + Math.random() * s * 0.3, r = 10 + Math.random() * 18;
      const gr = ctx.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, "rgba(255,245,250,0.5)"); gr.addColorStop(1, "rgba(255,245,250,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }, 256);
  for (let i = 0; i < Q.cloudCount; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: rng.range(0.35, 0.7) }));
    sp.position.set(rng.range(-90, 90), rng.range(22, 48), rng.range(-120, -40));
    sp.scale.set(rng.range(22, 44), rng.range(8, 14), 1);
    sp.userData.speed = rng.range(0.1, 0.4);
    scene.add(sp); clouds.push(sp);
  }

  const butterflies = [];
  for (let i = 0; i < Q.butterflies; i++) {
    const b = createButterfly(i, rng);
    scene.add(b.group);
    butterflies.push(b.group);
  }

  function update(dt, t) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 100) c.position.x = -100;
    }
    const fp = falling.geometry.attributes.position, fs = falling.geometry.attributes.aSeed;
    for (let i = 0; i < fp.count; i++) {
      const fall = 0.35 + (((fs.getX(i) % 1) + 1) % 1) * 0.3;
      let y = fp.getY(i) - dt * fall * fs.getY(i);
      if (y < 0) y = 8 + (((fs.getX(i) % 3) + 3) % 3);
      fp.setY(i, y);
      fp.setX(i, fp.getX(i) + Math.sin(t * 0.9 + fs.getZ(i)) * dt * 0.35);
    }
    fp.needsUpdate = true;
    const mp = motes.geometry.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      mp.setY(i, mp.getY(i) + Math.sin(t * 0.7 + i) * dt * 0.12);
      mp.setX(i, mp.getX(i) + Math.cos(t * 0.5 + i * 0.7) * dt * 0.1);
    }
    mp.needsUpdate = true;
    for (const b of butterflies) updateButterfly(b, dt, t);
  }
  return { update };
}
