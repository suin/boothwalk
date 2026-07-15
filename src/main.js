import * as THREE from 'three';
import { SCHEMES, SCHEME_TEXTURES, DISPLAY_TEXTURES } from './schemes.js';
import { buildWorld } from './world.js';
import { createControls } from './controls.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const loading = $('loading');
const loadingTitle = $('loading-title');
const loadingBar = $('loading-bar');
const loadingDetail = $('loading-detail');
const assetStatus = $('asset-status');

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
// QA用: 検証スクリプトからカメラを直接操作できるようにする
window.__booth = { camera };

// ---- テクスチャ読み込み ----
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const loader = new THREE.TextureLoader();
const textures = new Map();

function showLoading(title, loaded, total) {
  loadingTitle.textContent = title;
  loadingBar.style.width = `${total ? (loaded / total) * 100 : 0}%`;
  loadingDetail.textContent = `${loaded} / ${total}`;
  loading.hidden = false;
}

function hideLoading() {
  loading.hidden = true;
}

async function loadTextures(urls, onProgress = () => {}) {
  const pending = [...new Set(urls)].filter((url) => !textures.has(url));
  let completed = 0;
  onProgress(completed, pending.length);

  await Promise.all(pending.map(async (url) => {
    try {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAniso;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      textures.set(url, texture);
    } catch (error) {
      console.warn('テクスチャ未ロード（フォールバック表示）:', url, error);
    } finally {
      completed += 1;
      onProgress(completed, pending.length);
    }
  }));
}

async function initialize() {
  await loadTextures(SCHEME_TEXTURES.A, (loaded, total) => {
    showLoading('A案を読み込んでいます', loaded, total);
  });
  start();
  hideLoading();
}

function start() {
  const world = buildWorld(scene, textures);

  // ---- 状態 ----
  const state = { scheme: 'A', bright: true, mode: 'fp', schemeLoading: false };
  world.applyScheme(state.scheme);
  world.setVenueBright(state.bright);

  const controls = createControls(camera, renderer.domElement, {
    colliders: world.colliders,
    spawn: world.spawn,
  });
  controls.setMode('fp');

  // ================= UI =================
  const hint = $('hint');
  const crosshair = $('crosshair');

  function refreshButtons() {
    $('btn-a').classList.toggle('active', state.scheme === 'A');
    $('btn-b').classList.toggle('active', state.scheme === 'B');
    $('btn-a').disabled = state.schemeLoading;
    $('btn-b').disabled = state.schemeLoading;
    $('btn-bright').classList.toggle('active', state.bright);
    $('btn-dark').classList.toggle('active', !state.bright);
    $('btn-fp').classList.toggle('active', state.mode === 'fp');
    $('btn-orbit').classList.toggle('active', state.mode === 'orbit');
    $('scheme-name').textContent = SCHEMES[state.scheme].name;
    $('scheme-tagline').textContent = SCHEMES[state.scheme].tagline;
  }

  async function setScheme(key) {
    if (state.schemeLoading || state.scheme === key) return;
    state.schemeLoading = true;
    refreshButtons();
    await loadTextures(SCHEME_TEXTURES[key], (loaded, total) => {
      showLoading(`${SCHEMES[key].name}を読み込んでいます`, loaded, total);
    });
    state.scheme = key;
    state.schemeLoading = false;
    world.applyScheme(key);
    refreshButtons();
    hideLoading();
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

  $('btn-a').addEventListener('click', () => void setScheme('A'));
  $('btn-b').addEventListener('click', () => void setScheme('B'));
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

  // 画面素材は初回描画後に、表示時刻に合わせて段階的にロードする。
  async function loadDisplayBatch(urls) {
    await loadTextures(urls, (loaded, total) => {
      assetStatus.textContent = loaded < total ? `画面素材を読み込み中 ${loaded} / ${total}` : '';
    });
    world.refreshDisplayTextures();
    assetStatus.textContent = '';
  }

  void loadDisplayBatch([DISPLAY_TEXTURES.slides[0], DISPLAY_TEXTURES.website, DISPLAY_TEXTURES.zundamon]);
  window.setTimeout(() => void loadDisplayBatch([DISPLAY_TEXTURES.slides[1]]), 3000);
  window.setTimeout(() => void loadDisplayBatch([DISPLAY_TEXTURES.slides[2]]), 7000);

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

initialize().catch((error) => {
  console.error('初期化に失敗しました:', error);
  loadingTitle.textContent = '表示の初期化に失敗しました';
  loadingDetail.textContent = 'ページを再読み込みしてください';
  loadingBar.style.width = '100%';
});

// ---- リサイズ ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
