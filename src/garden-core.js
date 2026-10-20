/**
 * garden-core.js — Renderer + scene + ánh sáng + bầu trời + mặt đất.
 * Khởi tạo 1 lần duy nhất, không tạo lại giữa các trạng thái (§13).
 */
import * as THREE from "three";
import { PALETTE, GARDEN, QUALITY, CAMERA } from "./config.js";
import { Noise2D } from "./utils/noise.js";
import { makeRng } from "./utils/rng.js";
import { clamp, lerp } from "./utils/math.js";

export function makeCanvasTexture(draw, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCore({ container, qualityName }) {
  const Q = QUALITY[qualityName] || QUALITY.medium;
  const rng = makeRng(20251020);
  const noise = new Noise2D(20251020);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  if (Q.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog).getHex(), 20, 130);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.intro.pos);

  scene.add(new THREE.HemisphereLight(0xffe3ee, 0x4a6b4a, 0.85));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.1);
  sun.position.set(18, 26, 14);
  sun.castShadow = !!Q.shadows;
  if (Q.shadows) {
    sun.shadow.mapSize.set(Q.shadowMapSize, Q.shadowMapSize);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -30, far: 90 });
    sun.shadow.bias = -0.0006;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffc4d8, 0.55);
  fill.position.set(-14, 10, 18);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0cf, 0.5);
  rim.position.set(-6, 8, -24);
  scene.add(rim);

  // Bầu trời dome gradient
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(230, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(PALETTE.skyTop) },
        mid: { value: new THREE.Color(PALETTE.skyMid) },
        hor: { value: new THREE.Color(PALETTE.skyHorizon) },
        glow: { value: new THREE.Color(PALETTE.skyGlow) },
        sunDir: { value: new THREE.Vector3(18, 26, 14).normalize() },
      },
      vertexShader: "varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform vec3 top,mid,hor,glow; uniform vec3 sunDir; varying vec3 vDir;",
        "void main(){",
        " float h=clamp(vDir.y,-0.2,1.0);",
        " vec3 col=mix(hor,mid,smoothstep(0.0,0.32,h));",
        " col=mix(col,top,smoothstep(0.28,0.85,h));",
        " float s=max(dot(normalize(vDir),normalize(sunDir)),0.0);",
        " col+=glow*pow(s,24.0)*0.55+vec3(1.0,0.9,0.75)*pow(s,220.0)*0.9;",
        " col+=hor*0.12*(1.0-smoothstep(0.0,0.25,abs(vDir.y)));",
        " gl_FragColor=vec4(col,1.0); }",
      ].join("\n"),
    })
  );
  scene.add(sky);

  // Độ cao mặt đất: phẳng ở lối đi, nhấp nhô ở xa
  const groundY = (x, z) => {
    const n = noise.fbm(x * 0.08 + 7.3, z * 0.08 + 2.1, 4);
    let y = n * 1.1;
    const pathMask = 1 - clamp((Math.abs(x) - GARDEN.pathWidth * 0.5) / 2.2, 0, 1);
    y *= 1 - pathMask * 0.92;
    y += noise.fbm(x * 0.02, z * 0.02, 2) * 1.6 * clamp(Math.abs(z) / 40, 0, 1);
    return y;
  };

  // Mặt đất vertex-color
  const size = GARDEN.groundSize;
  const seg = Math.round(GARDEN.groundSegments * Q.fieldDetail);
  const g = new THREE.PlaneGeometry(size, size, seg, Math.min(seg, 110));
  g.rotateX(-Math.PI / 2);
  {
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(PALETTE.grassA), cB = new THREE.Color(PALETTE.grassB);
    const cC = new THREE.Color(PALETTE.grassC), dry = new THREE.Color(PALETTE.grassDry);
    const pA = new THREE.Color(PALETTE.pathA), pB = new THREE.Color(PALETTE.pathB);
    const soil = new THREE.Color(0x5a4030);
    const c1 = new THREE.Color(), c2 = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, groundY(x, z));
      const n1 = noise.fbm01(x * 0.15, z * 0.15, 3);
      const n2 = noise.fbm01(x * 0.5 + 31, z * 0.5, 2);
      c1.copy(cA).lerp(cB, n1).lerp(cC, n2 * 0.5);
      c1.lerp(dry, clamp((Math.abs(x) + Math.abs(z)) / 90, 0, 0.35) * n2);
      const inWalk = z < 22 && z > -42, d = Math.abs(x);
      if (inWalk && d < GARDEN.pathWidth * 0.5 + 0.55) {
        const e = clamp((d - GARDEN.pathWidth * 0.5) / 0.55, 0, 1);
        c2.copy(pA).lerp(pB, n2).lerp(soil, 0.12 * (1 - n1));
        c1.lerp(c2, 1 - e * e);
      } else if (inWalk && d < 8.5) {
        c1.lerp(soil, 0.28 * (1 - n1 * 0.5));
      }
      const shade = lerp(1.06, 0.82, clamp((-z + 20) / 70, 0, 1));
      colors[i * 3] = c1.r * shade; colors[i * 3 + 1] = c1.g * shade; colors[i * 3 + 2] = c1.b * shade;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
  }
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = !!Q.shadows;
  scene.add(ground);

  return { renderer, scene, camera, rng, noise, groundY, quality: Q };
}
