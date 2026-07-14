import * as THREE from 'three';
import { SCHEMES, ALL_TEXTURES, DISPLAY_TEXTURES } from './schemes.js';
import { buildWorld } from './world.js';
import { createControls } from './controls.js';

const app = document.getElementById('app');

// ---- レンダラ ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// near は深度精度改善のため 0.25（会場スケール30mなので支障なし）
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.25, 200);

// ---- テクスチャの事前ロード ----
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const textures = new Map();

// ディスプレイ固定コンテンツも同じ manager 経由でロード（未配置なら 404 → 黒フォールバック）。
const displayUrls = [...DISPLAY_TEXTURES.slides, DISPLAY_TEXTURES.website, DISPLAY_TEXTURES.zundamon];
for (const url of [...ALL_TEXTURES, ...displayUrls]) {
  loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    textures.set(url, t);
  });
}

// 未配置のディスプレイ/間仕切りテクスチャは 404 → フォールバック表示。error ではなく warn。
manager.onError = (url) => console.warn('テクスチャ未ロード（フォールバック表示）:', url);
manager.onLoad = start;

function start() {
  const world = buildWorld(scene, textures);

  // ---- 状態 ----
  const state = { scheme: 'A', bright: true, mode: 'fp' };
  world.applyScheme(state.scheme);
  world.setVenueBright(state.bright);

  const controls = createControls(camera, renderer.domElement, {
    colliders: world.colliders,
    spawn: world.spawn,
  });
  controls.setMode('fp');

  // ================= UI =================
  const $ = (id) => document.getElementById(id);
  const hint = $('hint');
  const crosshair = $('crosshair');

  function refreshButtons() {
    $('btn-a').classList.toggle('active', state.scheme === 'A');
    $('btn-b').classList.toggle('active', state.scheme === 'B');
    $('btn-bright').classList.toggle('active', state.bright);
    $('btn-dark').classList.toggle('active', !state.bright);
    $('btn-fp').classList.toggle('active', state.mode === 'fp');
    $('btn-orbit').classList.toggle('active', state.mode === 'orbit');
    $('scheme-name').textContent = SCHEMES[state.scheme].name;
    $('scheme-tagline').textContent = SCHEMES[state.scheme].tagline;
  }

  function setScheme(key) {
    state.scheme = key;
    world.applyScheme(key);
    refreshButtons();
  }
  function setBright(bright) {
    state.bright = bright;
    world.setVenueBright(bright);
    refreshButtons();
  }
  function setMode(mode) {
    state.mode = mode;
    controls.setMode(mode);
    updateHint();
    refreshButtons();
  }

  $('btn-a').addEventListener('click', () => setScheme('A'));
  $('btn-b').addEventListener('click', () => setScheme('B'));
  $('btn-bright').addEventListener('click', () => setBright(true));
  $('btn-dark').addEventListener('click', () => setBright(false));
  $('btn-fp').addEventListener('click', () => setMode('fp'));
  $('btn-orbit').addEventListener('click', () => setMode('orbit'));

  // 一人称: canvas クリックで PointerLock
  renderer.domElement.addEventListener('click', () => {
    if (state.mode === 'fp') controls.requestPointerLock();
  });

  function updateHint() {
    const locked = controls.pointer.isLocked;
    const showHint = state.mode === 'fp' && !locked;
    hint.classList.toggle('hidden', !showHint);
    crosshair.classList.toggle('on', state.mode === 'fp' && locked);
  }
  controls.pointer.addEventListener('lock', updateHint);
  controls.pointer.addEventListener('unlock', updateHint);

  refreshButtons();
  updateHint();

  // ================= レンダーループ =================
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    controls.update(dt);
    world.update(clock.getElapsedTime()); // スライドショー等の時間依存表示
    renderer.render(scene, camera);
  }
  animate();
}

// ---- リサイズ ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
