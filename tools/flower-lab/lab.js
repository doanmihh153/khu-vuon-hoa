/**
 * Flower Lab — bản kiểm thử độc lập cho hình học & vật liệu hoa.
 *
 * Được bundle thành 1 file HTML tự chứa (tools/flower-lab/flower-lab.html)
 * nên chạy được bằng giao thức file:// — không cần dev server.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    buildSpeciesTemplate,
    createPlantMaterials,
    plantUniforms,
} from "../../src/flowers/flowerFactory.js";
import { SPECIES, SPECIES_IDS } from "../../src/flowers/flowerSpecies.js";
import { makeRng } from "../../src/utils/rng.js";
import { PALETTE } from "../../src/config.js";

const params = new URLSearchParams(location.search);
const state = {
    species: params.get("s") || "rose",
    count: Number(params.get("n") || 4),
    lod: params.get("lod") || "high",
    open: Number(params.get("open") ?? 1),
    spin: params.get("spin") !== "0",
    /** Segment tùy chỉnh: ?seg=24,10 */
    seg: params.get("seg")
        ? params.get("seg").split(",").map((v) => Number(v))
        : null,
};

const stage = document.getElementById("stage");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x241d2b);

const camera = new THREE.PerspectiveCamera(
    40,
    innerWidth / innerHeight,
    0.05,
    200,
);
camera.position.set(0, 1.15, 2.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.9, 0);
controls.minDistance = 0.25;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.495;

/* ─────────────  Ánh sáng (khớp garden-core.js)  ───────────── */
scene.add(new THREE.HemisphereLight(0xffe3ee, 0x4a6b4a, 0.85));
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.1);
sun.position.set(18, 26, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    far: 90,
});
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffc4d8, 0.55);
fill.position.set(-14, 10, 18);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff0cf, 0.5);
rim.position.set(-6, 8, -24);
scene.add(rim);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x4d7a45, roughness: 0.95 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const mats = createPlantMaterials();
const dummy = new THREE.Object3D();
const colorTmp = new THREE.Color();
let softMesh = null;
let foliageMesh = null;
let group = null;

/** Dựng lại mẫu hoa theo loài / số lượng / LOD hiện tại. */
function rebuild() {
    if (group) {
        scene.remove(group);
        group.traverse((o) => o.geometry?.dispose?.());
    }
    group = new THREE.Group();
    scene.add(group);

    const species = SPECIES[state.species];
    const tpl = buildSpeciesTemplate(state.species, {
        rng: makeRng(12345),
        lod: state.lod,
        seg: state.seg ?? (state.lod === "high" ? [10, 5] : [6, 3]),
        leafSeg: state.lod === "high" ? [9, 5] : [5, 3],
    });

    const n = Math.max(1, state.count);
    const opens = new Float32Array(n).fill(state.open);
    const tints = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const scheme = species.schemes[i % species.schemes.length];
        colorTmp.set(scheme.tint);
        tints[i * 3] = colorTmp.r;
        tints[i * 3 + 1] = colorTmp.g;
        tints[i * 3 + 2] = colorTmp.b;
    }

    const mk = (geo, mat) => {
        if (!geo) return null;
        geo.setAttribute("aOpen", new THREE.InstancedBufferAttribute(opens, 1));
        geo.setAttribute(
            "aInstTint",
            new THREE.InstancedBufferAttribute(tints, 3),
        );
        const mesh = new THREE.InstancedMesh(geo, mat, n);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        return mesh;
    };

    softMesh = mk(tpl.soft, mats.soft);
    foliageMesh = mk(tpl.foliage, mats.foliage);

    const cols = Math.ceil(Math.sqrt(n));
    const gap = 1.7;
    for (let i = 0; i < n; i++) {
        const gx = (i % cols) - (cols - 1) / 2;
        const gz = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
        dummy.position.set(gx * gap, 0, gz * gap);
        dummy.rotation.set(0, i * 0.83, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        softMesh?.setMatrixAt(i, dummy.matrix);
        foliageMesh?.setMatrixAt(i, dummy.matrix);
    }
    if (softMesh) {
        softMesh.instanceMatrix.needsUpdate = true;
        group.add(softMesh);
    }
    if (foliageMesh) {
        foliageMesh.instanceMatrix.needsUpdate = true;
        group.add(foliageMesh);
    }

    const info = document.getElementById("meta");
    if (info) {
        info.textContent = `${SPECIES[state.species]?.label || state.species} · ${n} cây · LOD ${state.lod}`;
    }

    /* Đo khung đầu hoa thật từ hình học đã build → dùng để ngắm tự động */
    if (softMesh) {
        softMesh.geometry.computeBoundingBox();
        const bb = softMesh.geometry.boundingBox;
        const r = Math.max(
            Math.abs(bb.min.x),
            bb.max.x,
            Math.abs(bb.min.z),
            bb.max.z,
        );
        window.__labInfo = {
            headTop: bb.max.y,
            headBottom: bb.min.y,
            radius: r,
            headY: bb.max.y - r * 0.25,
        };
    }
    window.__labReady = true;
}

/* ─────────────  Bảng điều khiển  ───────────── */

const sel = document.getElementById("species");
for (const id of SPECIES_IDS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = SPECIES[id].label;
    sel.appendChild(opt);
}
sel.value = state.species;
sel.addEventListener("change", () => {
    state.species = sel.value;
    rebuild();
});

const cnt = document.getElementById("count");
cnt.value = String(state.count);
cnt.addEventListener("input", () => {
    state.count = Number(cnt.value);
    document.getElementById("countVal").textContent = state.count;
    rebuild();
});

const lod = document.getElementById("lod");
lod.value = state.lod;
lod.addEventListener("change", () => {
    state.lod = lod.value;
    rebuild();
});

const open = document.getElementById("open");
open.value = String(state.open);
open.addEventListener("input", () => {
    state.open = Number(open.value);
    document.getElementById("openVal").textContent = state.open.toFixed(2);
});

document.getElementById("countVal").textContent = state.count;
document.getElementById("openVal").textContent = state.open.toFixed(2);

/* ─────────────  Vòng render  ───────────── */

const sunWorld = new THREE.Vector3(18, 26, 14).normalize();
const viewTmp = new THREE.Vector3();
const clock = new THREE.Clock();

function frame() {
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    // Cập nhật góc hé nở (aOpen) khi kéo slider
    for (const mesh of [softMesh, foliageMesh]) {
        if (!mesh) continue;
        const attr = mesh.geometry.getAttribute("aOpen");
        if (!attr) continue;
        for (let i = 0; i < attr.count; i++) attr.setX(i, state.open);
        attr.needsUpdate = true;
    }

    plantUniforms.uTime.value = t;
    viewTmp.copy(sunWorld).transformDirection(camera.matrixWorldInverse);
    plantUniforms.uSunViewDir.value.copy(viewTmp);

    controls.update();
    renderer.render(scene, camera);
}

rebuild();
frame();

/* Hook cho script chụp ảnh tự động (tools/flower-lab/shoot.mjs) */
window.__lab = {
    THREE,
    scene,
    camera,
    controls,
    renderer,
    state,
    rebuild,
    /** Đặt camera nhìn một điểm cụ thể. */
    look(x, y, z, tx, ty, tz) {
        camera.position.set(x, y, z);
        controls.target.set(tx, ty, tz);
        controls.update();
    },
};
