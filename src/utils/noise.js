/** Nhiễu value 2D + fBm — dùng cho địa hình, mây và biến đổi bề mặt. */

import { mulberry32 } from './rng.js';

const PERM_SIZE = 512;

function buildPermutation(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(PERM_SIZE);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < PERM_SIZE; i++) p[i] = base[i & 255];
  return p;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export class Noise2D {
  constructor(seed = 1337) {
    this.perm = buildPermutation(seed);
    this.grads = new Float32Array(PERM_SIZE * 2);
    for (let i = 0; i < PERM_SIZE; i++) {
      const a = (i / PERM_SIZE) * Math.PI * 2 + Math.random() * 0.01;
      this.grads[i * 2] = Math.cos(a);
      this.grads[i * 2 + 1] = Math.sin(a);
    }
  }

  grad(ix, iy) {
    const h = this.perm[(ix + this.perm[iy & 255]) & 255];
    return h;
  }

  /** Nhiễu Perlin 2D trong khoảng [-1, 1]. */
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const dot = (ix, iy, dx, dy) => {
      const h = this.grad(ix, iy) & 255;
      const gx = this.grads[h * 2];
      const gy = this.grads[h * 2 + 1];
      return gx * dx + gy * dy;
    };

    const n00 = dot(X, Y, xf, yf);
    const n10 = dot(X + 1, Y, xf - 1, yf);
    const n01 = dot(X, Y + 1, xf, yf - 1);
    const n11 = dot(X + 1, Y + 1, xf - 1, yf - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return (nx0 + v * (nx1 - nx0)) * 1.4;
  }

  /** fBm chuẩn hoá về khoảng [-1, 1]. */
  fbm(x, y, octaves = 4, lacunarity = 2.03, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / (norm || 1);
  }

  /** fBm trả về khoảng [0, 1]. */
  fbm01(x, y, octaves = 4) {
    return this.fbm(x, y, octaves) * 0.5 + 0.5;
  }
}
