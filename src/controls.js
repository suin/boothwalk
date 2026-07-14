import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HALL } from './world.js';

const EYE_HEIGHT = 1.6;
const SNEAK_HEIGHT = 1.15; // スニーク時の目線高
const WALK_SPEED = 3.4; // m/s
const RUN_SPEED = 6.6; // ダッシュ（Wダブルタップ）
const SNEAK_FACTOR = 0.5; // スニーク時の速度倍率
const DASH_TAP_MS = 300; // Wダブルタップ判定
const EYE_TAU = 0.15; // 目線高の追従時定数（秒）
const PLAYER_R = 0.3; // プレイヤー半径（簡易円柱）
const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param {THREE.Camera} camera
 * @param {HTMLElement} domElement
 * @param {{colliders:Array, spawn:THREE.Vector3}} opts
 */
export function createControls(camera, domElement, opts = {}) {
  const colliders = opts.colliders || [];
  const startPos = (opts.spawn || new THREE.Vector3(0, EYE_HEIGHT, 9)).clone();
  startPos.y = EYE_HEIGHT;

  // ---- 一人称 ----
  const pointer = new PointerLockControls(camera, domElement);
  const keys = { forward: false, back: false, left: false, right: false, sneak: false };
  const velocity = new THREE.Vector3(); // x=右, z=前 のローカル速度
  const forwardVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const delta = new THREE.Vector3();
  let eyeHeight = EYE_HEIGHT;
  let dashing = false; // Wダブルタップ中
  let lastWDown = -Infinity;

  const setKey = (code, down) => {
    switch (code) {
      case 'KeyW': case 'ArrowUp': keys.forward = down; break;
      case 'KeyS': case 'ArrowDown': keys.back = down; break;
      case 'KeyA': case 'ArrowLeft': keys.left = down; break;
      case 'KeyD': case 'ArrowRight': keys.right = down; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sneak = down; break;
    }
  };
  const isForwardKey = (code) => code === 'KeyW' || code === 'ArrowUp';
  const onKeyDown = (e) => {
    setKey(e.code, true);
    // Wダブルタップでダッシュ開始（オートリピートは無視）
    if (isForwardKey(e.code) && !e.repeat) {
      const now = performance.now();
      if (now - lastWDown < DASH_TAP_MS) dashing = true;
      lastWDown = now;
    }
  };
  const onKeyUp = (e) => {
    setKey(e.code, false);
    if (isForwardKey(e.code)) dashing = false; // W を離すとダッシュ解除
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // ---- 俯瞰 ----
  const orbit = new OrbitControls(camera, domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.maxPolarAngle = Math.PI / 2 - 0.05;
  orbit.minDistance = 4;
  orbit.maxDistance = 40;
  orbit.target.set(0, 1.4, -6);
  orbit.enabled = false;

  let mode = 'fp';

  // 会場外周＋物体AABBとの衝突（半径 PLAYER_R を考慮）。
  function collides(x, z) {
    const r = PLAYER_R;
    if (x < -HALL.w / 2 + r || x > HALL.w / 2 - r || z < -HALL.d / 2 + r || z > HALL.d / 2 - r) return true;
    for (const c of colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  function setMode(next) {
    mode = next;
    if (mode === 'fp') {
      orbit.enabled = false;
      eyeHeight = EYE_HEIGHT;
      dashing = false;
      camera.position.copy(startPos);
      camera.lookAt(0, 1.5, -6);
    } else {
      if (pointer.isLocked) pointer.unlock();
      camera.position.set(8, 8, 4); // 会場内側の俯瞰位置（高い天井/壁でも塞がれない）
      orbit.target.set(0, 1.2, -6.5);
      orbit.enabled = true;
      orbit.update();
    }
  }

  function requestPointerLock() {
    if (mode === 'fp') pointer.lock();
  }

  function update(dt) {
    if (mode === 'orbit') {
      orbit.update();
      return;
    }
    // 一人称モード中は WASD/矢印キーで常に移動可能（PointerLock 未取得でも歩ける）。
    // マウス視点回転はロック時のみ（PointerLockControls が内部で処理）。

    // なめらかな加速・減速（短い慣性）
    const damping = Math.exp(-9 * dt);
    velocity.x *= damping;
    velocity.z *= damping;

    const dz = Number(keys.forward) - Number(keys.back);
    const dx = Number(keys.right) - Number(keys.left);
    if (!keys.forward) dashing = false; // 前進をやめたらダッシュ解除
    // スニーク優先。次にダッシュ（前進時のみ）。通常は歩き。
    let speed = WALK_SPEED;
    if (keys.sneak) speed = WALK_SPEED * SNEAK_FACTOR;
    else if (dashing && keys.forward) speed = RUN_SPEED;
    const accel = speed * 11;
    if (dz !== 0) velocity.z += dz * accel * dt;
    if (dx !== 0) velocity.x += dx * accel * dt;

    // 速度上限
    const horiz = Math.hypot(velocity.x, velocity.z);
    if (horiz > speed) {
      velocity.x = (velocity.x / horiz) * speed;
      velocity.z = (velocity.z / horiz) * speed;
    }
    if (horiz < 0.001) { velocity.x = 0; velocity.z = 0; }

    // カメラ向きから水平の前方・右方向を求める
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();
    rightVec.crossVectors(forwardVec, UP).normalize();

    delta.set(0, 0, 0);
    delta.addScaledVector(rightVec, velocity.x * dt);
    delta.addScaledVector(forwardVec, velocity.z * dt);

    // 軸ごとに衝突判定（壁ずり）
    const p = camera.position;
    const nx = p.x + delta.x;
    if (!collides(nx, p.z)) p.x = nx;
    const nz = p.z + delta.z;
    if (!collides(p.x, nz)) p.z = nz;
    // 目線高をスニーク/通常へなめらかに追従
    const targetEye = keys.sneak ? SNEAK_HEIGHT : EYE_HEIGHT;
    eyeHeight += (targetEye - eyeHeight) * (1 - Math.exp(-dt / EYE_TAU));
    p.y = eyeHeight;
  }

  camera.position.copy(startPos);
  camera.lookAt(0, 1.5, -6);

  return {
    pointer,
    orbit,
    update,
    setMode,
    requestPointerLock,
    getMode: () => mode,
    dispose() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      pointer.dispose();
      orbit.dispose();
    },
  };
}
