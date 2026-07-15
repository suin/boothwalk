import * as THREE from 'three';
import { SCHEMES, DISPLAY_TEXTURES } from './schemes.js';

// 会場・ブースの寸法（単位: m）
export const HALL = { w: 30, d: 20, h: 15 };
// C plan 1小間: 間口9.0 × 奥行3.0、壁高2.7、前面開放。背面壁の中心 z = -9。
export const BOOTH = { w: 9, d: 3, wallH: 2.7, backZ: -9 };
const FRONT_Z = BOOTH.backZ + BOOTH.d; // -6（通路側の開口）
const X_L = -BOOTH.w / 2; // -4.5
const X_R = BOOTH.w / 2; //  4.5
const STOCK_W = 1.98; // ストックスペース間口
const STOCK_X = X_L + STOCK_W; // 主エリアとの間仕切り x = -2.52
const BOARD_H = 2.58; // 出力ボード高 H2580
const BOARD_Y = BOARD_H / 2 + 0.02;
const T = 0.1; // 壁厚

// 画像を歪ませずに面へ収め、focus(正規化・左上原点)を中心付近に置く。zoom>=1 で拡大。
function applyCrop(texture, planeAspect, fx = 0.5, fy = 0.5, zoom = 1) {
  const img = texture.image;
  const imgAspect = img.width / img.height;
  // center は既定(0,0)のまま。offset は「切り出し開始座標」そのものとして扱う。
  let rx, ry;
  if (planeAspect > imgAspect) { rx = 1; ry = imgAspect / planeAspect; }
  else { rx = planeAspect / imgAspect; ry = 1; }
  rx /= zoom; ry /= zoom;
  texture.repeat.set(rx, ry);
  // three のUVは下原点。画像の上下(fy)は v = 1 - fy に対応。
  let ox = fx - rx / 2;
  let oy = (1 - fy) - ry / 2;
  ox = Math.min(Math.max(ox, 0), 1 - rx);
  oy = Math.min(Math.max(oy, 0), 1 - ry);
  texture.offset.set(ox, oy);
  texture.needsUpdate = true;
}

// CanvasTexture で文字板を作る。
function makeTextTexture(text, { bg = '#ffffff', fg = '#111417', w = 1024, h = 128 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.round(h * 0.5)}px "Helvetica Neue", Arial, "Hiragino Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 会場とブースを構築する。
 * @returns {{applyScheme, setVenueBright, colliders, spawn}}
 */
export function buildWorld(scene, textures) {
  const tex = (url) => textures.get(url);
  const colliders = [];
  const addCollider = (cx, cz, sx, sz) =>
    colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });

  // グラフィック面の登録簿。src はスキームのどの画像を使うか、fx=null はロゴ位置を使う。
  const graphics = [];
  // flat: 案ごとにテクスチャの代わりに使う無地カラー { A: hex, B: hex }（未指定案はテクスチャ）。
  const addGfx = (mat, src, aspect, { fx = 0.5, fy = 0.5, zoom = 1, flat = null, fallbackSrc = null, cylinder = false } = {}) =>
    graphics.push({ mat, src, aspect, fx, fy, zoom, flat, fallbackSrc, cylinder });

  scene.background = new THREE.Color(0x0a0d14);

  // ---- 床（コンクリート風の暖色ライトグレー。小間内・通路とも同色）----
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6f6f66, roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ブース床は会場通路と同じグレー（下の床がそのまま見える）。スキームで色は変えない。

  // ---- 天井（FrontSide・明るい白〜ライトグレーの大空間天井）----
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xe4e7e8, roughness: 1.0, side: THREE.FrontSide });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = HALL.h;
  scene.add(ceiling);

  // ---- 会場外周壁（FrontSide=内向き面のみ。俯瞰で外に出ても壁裏が視界を塞がない）----
  const hallWallMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 1.0, side: THREE.FrontSide });
  const mkHallWall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, HALL.h), hallWallMat);
    m.position.set(x, HALL.h / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  mkHallWall(HALL.w, 0, -HALL.d / 2, 0);
  mkHallWall(HALL.w, 0, HALL.d / 2, Math.PI);
  mkHallWall(HALL.d, -HALL.w / 2, 0, Math.PI / 2);
  mkHallWall(HALL.d, HALL.w / 2, 0, -Math.PI / 2);

  // ---- 天井照明（会場全体。会場トグル対象）----
  const ceilingLights = [];
  const lightPanels = [];
  for (const px of [-9, 0, 9]) {
    for (const pz of [-6, 2]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      panel.rotation.x = Math.PI / 2;
      panel.position.set(px, HALL.h - 0.05, pz);
      scene.add(panel);
      lightPanels.push(panel);
      // 高い天井から地上を照らすため range を広げる（強度は setVenueBright で調整）
      const pl = new THREE.PointLight(0xffffff, 40, 70, 2);
      pl.position.set(px, HALL.h - 0.4, pz);
      scene.add(pl);
      ceilingLights.push(pl);
    }
  }

  const ambient = new THREE.HemisphereLight(0xdfe8f5, 0x6b7482, 1.9);
  scene.add(ambient);

  // ================= ブース構造（基礎パネル 白系）=================
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.75 });

  // 背面壁（全幅9m）
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(BOOTH.w, BOOTH.wallH, T), baseMat);
  backWall.position.set(0, BOOTH.wallH / 2, BOOTH.backZ);
  backWall.receiveShadow = true;
  scene.add(backWall);
  addCollider(0, BOOTH.backZ, BOOTH.w, T);

  // 側面壁 左右（奥行3m）
  const mkSide = (x) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(T, BOOTH.wallH, BOOTH.d), baseMat);
    w.position.set(x, BOOTH.wallH / 2, BOOTH.backZ + BOOTH.d / 2);
    scene.add(w);
    addCollider(x, BOOTH.backZ + BOOTH.d / 2, T, BOOTH.d);
  };
  mkSide(X_L);
  mkSide(X_R);

  // 間仕切り壁（白い基礎パネル）
  const partition = new THREE.Mesh(new THREE.BoxGeometry(T, BOOTH.wallH, BOOTH.d), baseMat);
  partition.position.set(STOCK_X, BOOTH.wallH / 2, BOOTH.backZ + BOOTH.d / 2);
  scene.add(partition);
  addCollider(STOCK_X, BOOTH.backZ + BOOTH.d / 2, T, BOOTH.d);

  // ---- 壁面ボード / モニター / ラッピングの生成ヘルパ ----
  const mkBoard = (w, h, pos, ry, src, cropOpt) => {
    // polygonOffset で下地面より手前に描画し、Zファイティングを防ぐ
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    addGfx(mat, src, w / h, cropOpt);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.rotation.y = ry;
    scene.add(m);
    return mat;
  };
  // ディスプレイ（A/B非依存の固定コンテンツ）。screenMat を返し、内容は別途 map で差し込む。
  // map 未設定時は黒画面フォールバック。
  const mkScreen = (w, pos, ry) => {
    const h = w * 9 / 16;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.07, h + 0.07, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4, metalness: 0.3 }),
    );
    g.add(frame);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = 0.026;
    g.add(screen);
    g.position.copy(pos);
    g.rotation.y = ry;
    scene.add(g);
    return screenMat;
  };
  // ロード済みなら map をセット（全体表示）、無ければ黒。
  const setScreen = (mat, url) => {
    const t = tex(url);
    if (t) { mat.map = t; mat.color.setHex(0xffffff); } else { mat.map = null; mat.color.setHex(0x000000); }
    mat.needsUpdate = true;
  };
  const mkWrap = (w, h, pos, ry, src, cropOpt) => {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    addGfx(mat, src, w / h, cropOpt);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.rotation.y = ry;
    scene.add(m);
  };

  // ================= ストックスペース前面（通路側・全面フラット壁）=================
  // 幅1.98mを隙間なく全面壁に。専用テクスチャ（1.94:2.58）を全面貼り、中央にモニター。
  const SP_CX = (X_L + STOCK_X) / 2; // -3.51
  const spPanel = new THREE.Mesh(new THREE.BoxGeometry(STOCK_W, BOOTH.wallH, T), baseMat);
  spPanel.position.set(SP_CX, BOOTH.wallH / 2, FRONT_Z);
  scene.add(spPanel);
  addCollider(SP_CX, FRONT_Z, STOCK_W, T);
  // 板幅1.94m＝テクスチャと同アスペクト（0.752）なのでクロップなしの全面貼り。
  // パラペット前面(z=FRONT_Z+0.06)と同一平面にならないよう +0.10 まで手前に出す。
  mkBoard(STOCK_W - 0.04, BOARD_H, new THREE.Vector3(SP_CX, BOARD_Y, FRONT_Z + 0.1), 0, 'stockfront');
  // 中央モニター＝スライドショー（slide-1/2/3 を4秒間隔で単純切替、A/B共通）
  const slideScreen = mkScreen(1.1, new THREE.Vector3(SP_CX, 1.4, FRONT_Z + 0.1), 0);
  let slides = [];

  // ================= 間仕切りの主エリア側（+x）=================
  // 手前(前寄り)約2.0m: 専用テクスチャ partition（前面と1枚続きのグラデ）。奥(背面側)約0.9m: ドア。
  const PART_X = STOCK_X + 0.06;
  const DOOR_DEPTH = 0.9;
  const GFX_DEPTH = BOOTH.d - DOOR_DEPTH; // 2.1
  const gfxCz = FRONT_Z - GFX_DEPTH / 2; // 前寄り 2.1m の中心
  mkBoard(GFX_DEPTH, BOARD_H, new THREE.Vector3(STOCK_X + 0.08, BOARD_Y, gfxCz), Math.PI / 2, 'partition', { fallbackSrc: 'sidewall' });
  // 白いアコーディオンドア（奥0.9m・+x向き・縦スリット）
  const DOOR_H = 2.1;
  const doorCz = BOOTH.backZ + DOOR_DEPTH / 2; // -8.55
  const doorWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 0.55 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, DOOR_H, DOOR_DEPTH), doorWhiteMat);
  door.position.set(STOCK_X + 0.05, DOOR_H / 2, doorCz);
  scene.add(door);
  const slitMat = new THREE.MeshStandardMaterial({ color: 0xcdd3da, roughness: 0.6 });
  for (let i = 1; i < 9; i++) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.065, DOOR_H - 0.1, 0.012), slitMat);
    slit.position.set(STOCK_X + 0.05, DOOR_H / 2, BOOTH.backZ + (DOOR_DEPTH * i) / 9);
    scene.add(slit);
  }

  // ================= 背面 大判KV（item 3）=================
  // 主エリア背面（x = STOCK_X..X_R）に横長帯を切り出す
  const BM_W = X_R - STOCK_X - 0.12; // ≈6.9
  const bmCx = (STOCK_X + X_R) / 2;
  // 専用テクスチャ（ロゴ左寄り・右半分は空き）を全面貼り
  mkBoard(BM_W, BOARD_H, new THREE.Vector3(bmCx, BOARD_Y, BOOTH.backZ + 0.08), 0, 'backwall');
  // 壁付けモニター2台（固定コンテンツ・A/B非依存）。左=サイト、右=ずんだもん。
  const webScreen = mkScreen(1.05, new THREE.Vector3(1.7, 1.7, BOOTH.backZ + 0.1), 0);
  const zundamonScreen = mkScreen(1.05, new THREE.Vector3(3.3, 1.7, BOOTH.backZ + 0.1), 0);
  function refreshDisplayTextures() {
    slides = DISPLAY_TEXTURES.slides.map((u) => tex(u)).filter(Boolean);
    slideIdx = -1;
    setScreen(webScreen, DISPLAY_TEXTURES.website);
    setScreen(zundamonScreen, DISPLAY_TEXTURES.zundamon);
  }

  // ================= 側面ボード（item 8・ロゴなしのグラデ/モチーフ領域）=================
  // ロゴは手前のバナーにあるため壁面には出さない。zoom で切り出しを狭め、
  // plainX（A=右の航跡側 / B=左のソナー側）を中心にロゴを含まない帯を見せる。
  // 右側面（内壁 -x）専用グラデ（ロゴなし）を全面貼り
  mkBoard(2.93, BOARD_H, new THREE.Vector3(X_R - 0.08, BOARD_Y, BOOTH.backZ + BOOTH.d / 2), -Math.PI / 2, 'sidewall');
  // ストック左外側面（内壁 +x）は側面グラデを流用（ロゴなし）
  mkBoard(1.94, BOARD_H, new THREE.Vector3(X_L + 0.08, BOARD_Y, BOOTH.backZ + BOOTH.d / 2), Math.PI / 2, 'sidewall');

  // ================= パラペット（item 6・白/シルバー、両案共通）=================
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.4 });
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(BOOTH.w, 0.3, 0.12), parapetMat);
  parapet.position.set(0, BOOTH.wallH - 0.15, FRONT_Z);
  scene.add(parapet);

  // ブース内照明×6（旧・蛍光灯バー）。器具の見た目メッシュは撤去し、光源のみ残して明るさを維持。
  for (let i = 0; i < 6; i++) {
    const x = -3.75 + i * 1.5;
    const pl = new THREE.PointLight(0xfff6e0, 11, 7, 2);
    pl.position.set(x, BOOTH.wallH - 0.4, FRONT_Z - 1.1);
    scene.add(pl);
  }

  // 社名プレート（item 6・白地に黒角ゴシック）
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.2),
    new THREE.MeshBasicMaterial({ map: makeTextTexture('AppThrust'), toneMapped: false }),
  );
  plateMesh.position.set(0, BOOTH.wallH - 0.15, FRONT_Z + 0.07);
  scene.add(plateMesh);

  // ================= 柱（前面開放部の支柱 4本）=================
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.5 });
  for (const px of [X_L, -1.0, 1.0, X_R]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, BOOTH.wallH, 0.1), postMat);
    post.position.set(px, BOOTH.wallH / 2, FRONT_Z);
    scene.add(post);
    addCollider(px, FRONT_Z, 0.16, 0.16);
  }

  // ================= 連結ローカウンター（item 4）=================
  // 3台連結（1.98×2 + 0.99 = 4.95）を主エリア右寄りに一続きで配置
  const RUN_W = 4.95, RUN_D = 0.7, RUN_H = 1.0;
  const RUN_CX = 0.99;
  const RUN_CZ = BOOTH.backZ + 0.1 + RUN_D / 2; // -8.55
  const runBody = new THREE.Mesh(
    new THREE.BoxGeometry(RUN_W, RUN_H, RUN_D),
    new THREE.MeshStandardMaterial({ color: 0xf6f8fa, roughness: 0.55 }),
  );
  runBody.position.set(RUN_CX, RUN_H / 2, RUN_CZ);
  runBody.castShadow = true;
  runBody.receiveShadow = true;
  scene.add(runBody);
  // 天板（白〜ライトグレー）
  const runTop = new THREE.Mesh(
    new THREE.BoxGeometry(RUN_W + 0.04, 0.05, RUN_D + 0.04),
    new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.35 }),
  );
  runTop.position.set(RUN_CX, RUN_H + 0.01, RUN_CZ);
  scene.add(runTop);
  // 前面（+z）と両小口: A案=無地ロイヤルブルー、B案=無地の超ダークネイビー（どちらもフラット）。
  const runFrontZ = RUN_CZ + RUN_D / 2 + 0.005;
  const runWrapOpt = { flat: { A: 0x1d3fa8, B: 0x05080f } };
  mkWrap(RUN_W, RUN_H - 0.06, new THREE.Vector3(RUN_CX, (RUN_H - 0.06) / 2, runFrontZ), 0, 'wall', runWrapOpt);
  mkWrap(RUN_D, RUN_H - 0.06, new THREE.Vector3(RUN_CX - RUN_W / 2 - 0.005, (RUN_H - 0.06) / 2, RUN_CZ), -Math.PI / 2, 'wall', runWrapOpt);
  mkWrap(RUN_D, RUN_H - 0.06, new THREE.Vector3(RUN_CX + RUN_W / 2 + 0.005, (RUN_H - 0.06) / 2, RUN_CZ), Math.PI / 2, 'wall', runWrapOpt);
  addCollider(RUN_CX, RUN_CZ, RUN_W, RUN_D);

  // ================= 受付カウンター（item 5）=================
  // ストック入口凹みのすぐ右・前寄り。前面と側面をKVラッピング、前面中央にロゴ。天板白。
  const cW = 0.9, cD = 0.45, cH = 0.8, cX = -1.75, cZ = FRONT_Z - 0.45;
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(cW, cH, cD),
    new THREE.MeshStandardMaterial({ color: 0xf6f8fa, roughness: 0.55 }),
  );
  counter.position.set(cX, cH / 2, cZ);
  counter.castShadow = true;
  scene.add(counter);
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(cW + 0.06, 0.05, cD + 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  );
  counterTop.position.set(cX, cH + 0.01, cZ);
  scene.add(counterTop);
  // 前面: 専用テクスチャ（ロゴ中央）を全面貼り
  mkWrap(cW, cH - 0.05, new THREE.Vector3(cX, (cH - 0.05) / 2, cZ + cD / 2 + 0.005), 0, 'counter');
  // 小口: A案=前面と一続きの同心円グラデ用テクスチャ、B案=フラットな深い紺
  const endFlat = { flat: { B: 0x0b1330 } };
  mkWrap(cD, cH - 0.05, new THREE.Vector3(cX - cW / 2 - 0.005, (cH - 0.05) / 2, cZ), -Math.PI / 2, 'counterEndL', endFlat);
  mkWrap(cD, cH - 0.05, new THREE.Vector3(cX + cW / 2 + 0.005, (cH - 0.05) / 2, cZ), Math.PI / 2, 'counterEndR', endFlat);
  addCollider(cX, cZ, cW, cD);
  // 折りたたみ椅子（簡素）
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x40464f, roughness: 0.7 });
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), chairMat);
  chairSeat.position.set(cX, 0.45, cZ - 0.7);
  scene.add(chairSeat);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.05), chairMat);
  chairBack.position.set(cX, 0.68, cZ - 0.88);
  scene.add(chairBack);
  for (const [lx, lz] of [[-0.17, -0.53], [0.17, -0.53], [-0.17, -0.87], [0.17, -0.87]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), chairMat);
    leg.position.set(cX + lx, 0.22, cZ + lz);
    scene.add(leg);
  }

  // ================= ノベルティのミニペットボトル（天板に3本・整列）=================
  // 専用ラベル（label-a/b）を胴の下側〜中央に巻く。キャップ白（リング付き）、肩・首は透明、
  // ラベルより上の胴はわずかに透明で中が見える。コライダー不要。
  const bottleBodyMat = new THREE.MeshStandardMaterial({ color: 0xeaf3fb, roughness: 0.08, transparent: true, opacity: 0.3 });
  const bottleClearMat = new THREE.MeshStandardMaterial({ color: 0xeaf3fb, roughness: 0.05, transparent: true, opacity: 0.22 });
  const bottleCapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const topY = cH + 0.035; // 天板上面
  // 350ml のやや低くずんぐり（全高≈0.16、胴径≈0.064、縦横比≈2.5）
  const R = 0.032;
  const BODY_H = 0.105;        // 胴（ボトルの大部分）
  const SHOULDER_H = 0.02;     // 丸みのある肩
  const NECK_R = 0.013;
  const NECK_H = 0.014;
  const CAP_H = 0.022;
  const LABEL_BOTTOM = 0.008;  // 底から約0.8cm上
  const LABEL_TOP = 0.104;     // 肩の付け根のすぐ下
  const LABEL_H = LABEL_TOP - LABEL_BOTTOM; // 胴の約85%を覆う
  const makeBottle = (bx, bz) => {
    const g = new THREE.Group();
    // 胴
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BODY_H, 24), bottleBodyMat);
    body.position.y = BODY_H / 2;
    g.add(body);
    // 肩（テーパー・透明）
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(NECK_R, R, SHOULDER_H, 24), bottleClearMat);
    shoulder.position.y = BODY_H + SHOULDER_H / 2;
    g.add(shoulder);
    // 首（細い透明）
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK_R, NECK_R, NECK_H, 20), bottleClearMat);
    neck.position.y = BODY_H + SHOULDER_H + NECK_H / 2;
    g.add(neck);
    // キャップ（白）＋リング
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, CAP_H, 20), bottleCapMat);
    cap.position.y = BODY_H + SHOULDER_H + NECK_H + CAP_H / 2;
    g.add(cap);
    const capRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.006, 20), bottleCapMat);
    capRing.position.y = BODY_H + SHOULDER_H + NECK_H + 0.003;
    g.add(capRing);
    // ラベル（胴の大部分・正面=+z、専用テクスチャ。円筒巻き）
    const labelMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    addGfx(labelMat, 'label', 1, { cylinder: true });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.001, R + 0.001, LABEL_H, 24, 1, true), labelMat);
    label.position.y = LABEL_BOTTOM + LABEL_H / 2;
    g.add(label);
    g.position.set(bx, topY, bz);
    scene.add(g);
  };
  // 3本とも同じ向き・少しだけ間隔を空けて整列
  makeBottle(cX - 0.14, cZ - 0.02);
  makeBottle(cX, cZ - 0.02);
  makeBottle(cX + 0.14, cZ - 0.02);

  // ================= ロールアップバナー（item 7・右端やや内向き）=================
  const bannerMat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
  addGfx(bannerMat, 'banner', 0.8 / 2.0, { fx: 0.5, fy: 0.5 });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.0), bannerMat);
  banner.position.set(3.95, 1.05, FRONT_Z - 0.55);
  banner.rotation.y = -0.4; // やや内向き
  scene.add(banner);
  const bannerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x888f98, metalness: 0.6, roughness: 0.4 }),
  );
  bannerBase.position.set(3.95, 0.04, FRONT_Z - 0.55);
  scene.add(bannerBase);
  addCollider(3.95, FRONT_Z - 0.55, 0.5, 0.4);

  // ================= ブースを照らすスポット =================
  const spot = new THREE.SpotLight(0xffffff, 110, 24, Math.PI / 4.5, 0.4, 1.5);
  // 天井が高くなってもブースを効かせるため、スポットは実用的な高さ(約6.5m)から照らす
  spot.position.set(0, 6.5, FRONT_Z + 2.5);
  spot.target.position.set(0.5, 1.4, BOOTH.backZ);
  scene.add(spot);
  scene.add(spot.target);

  // ================= 隣接ブース =================
  const makeNeighbor = (cx, label) => {
    const g = new THREE.Group();
    const nMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.85 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(6, BOOTH.wallH, T), nMat);
    back.position.set(0, BOOTH.wallH / 2, BOOTH.backZ);
    g.add(back);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(T, BOOTH.wallH, BOOTH.d), nMat);
    sl.position.set(-3, BOOTH.wallH / 2, BOOTH.backZ + BOOTH.d / 2);
    g.add(sl);
    const sr = sl.clone();
    sr.position.x = 3;
    g.add(sr);
    const panelTex = makeTextTexture(label, { bg: '#2b3340', fg: '#aeb8c6', w: 1024, h: 512 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: panelTex, toneMapped: false }));
    panel.position.set(0, 1.5, BOOTH.backZ + 0.07);
    g.add(panel);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0xc7ccd3, roughness: 0.7 }));
    table.position.set(0, 0.45, FRONT_Z - 0.6);
    g.add(table);
    g.position.x = cx;
    scene.add(g);
    addCollider(cx, BOOTH.backZ, 6, T);
    addCollider(cx - 3, BOOTH.backZ + BOOTH.d / 2, T, BOOTH.d);
    addCollider(cx + 3, BOOTH.backZ + BOOTH.d / 2, T, BOOTH.d);
  };
  makeNeighbor(-9, 'PARTNER A');
  makeNeighbor(9, 'PARTNER B');

  // ================= A案/B案の適用 =================
  let clones = [];
  let curBright = true; // 現在の会場照明状態（グラフィック明度の再計算に使用）
  function applyScheme(key) {
    const s = SCHEMES[key];
    const urlOf = {
      wall: s.wall, mon0: s.monitors[0], mon1: s.monitors[1], banner: s.banner, label: s.label,
      stockfront: s.stockfront, partition: s.partition,
      backwall: s.backwall, sidewall: s.sidewall, counter: s.counter,
      counterEndL: s.counterEndL, counterEndR: s.counterEndR,
    };
    clones.forEach((c) => c.dispose());
    clones = [];
    for (const g of graphics) {
      // 案ごとに無地カラー指定がある面はテクスチャを使わずフラット色
      const flatColor = g.flat ? g.flat[key] : undefined;
      if (flatColor != null) {
        g.mat.map = null;
        g.mat.color.setHex(flatColor);
        g.mat.needsUpdate = true;
        continue;
      }
      // 円筒ラベル: テクスチャ中央がボトル正面(+z)に来るよう offset.x=0.5、円周方向は繰り返し
      if (g.cylinder) {
        const b = tex(urlOf[g.src]);
        if (!b) { g.mat.map = null; g.mat.color.setHex(key === 'A' ? 0x1d3fa8 : 0x0b1330); g.mat.needsUpdate = true; continue; }
        const t = b.clone();
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.center.set(0, 0);
        t.repeat.set(1, 1);
        t.offset.set(0.5, 0);
        t.needsUpdate = true;
        clones.push(t);
        g.mat.map = t;
        g.mat.color.setScalar(curBright ? 1.0 : 1.18);
        g.mat.needsUpdate = true;
        continue;
      }
      // テクスチャ未ロード（未配置で404 等）は fallbackSrc → それも無ければ無地でしのぐ
      let base = tex(urlOf[g.src]);
      if (!base && g.fallbackSrc) base = tex(urlOf[g.fallbackSrc]);
      if (!base) {
        g.mat.map = null;
        g.mat.color.setHex(0x1b3566);
        g.mat.needsUpdate = true;
        continue;
      }
      const t = base.clone();
      t.needsUpdate = true;
      // 端で反対側の行をサンプルしてゴミ（黒ブロックノイズ）が出るのを防ぐ
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      const fx = g.fx === null ? s.logoX : g.fx; // null はロゴ中心（KV直接クロップ用）
      applyCrop(t, g.aspect, fx, g.fy, g.zoom);
      clones.push(t);
      g.mat.map = t;
      g.mat.color.setScalar(curBright ? 1.0 : 1.18); // 自発光グラフィックの明度（暗会場で強調）
      g.mat.needsUpdate = true;
    }
  }

  // ================= 会場照明の切替 =================
  function setVenueBright(bright) {
    curBright = bright;
    ambient.intensity = bright ? 1.9 : 0.14;
    ambient.groundColor.setHex(bright ? 0x6b7482 : 0x2a2f38);
    // 天井が約15mへ上がったぶん強度を大幅に上げ、地上の明るさを現状同等に保つ
    for (const pl of ceilingLights) pl.intensity = bright ? 620 : 55;
    for (const panel of lightPanels) panel.material.color.setHex(bright ? 0xffffff : 0x3a4048);
    // 天井は明るい白〜ライトグレー。暗い会場でも黒潰れさせず中間トーンに
    ceilingMat.color.setHex(bright ? 0xe4e7e8 : 0x3a3e44);
    hallWallMat.color.setHex(bright ? 0x8c929b : 0x24282e);
    spot.intensity = bright ? 110 : 150;
    // テクスチャ付きの自発光グラフィックのみ明度調整。無地カラー面（map=null）は触らない。
    for (const g of graphics) {
      if (g.mat.map) g.mat.color.setScalar(bright ? 1.0 : 1.18);
    }
    scene.background.setHex(bright ? 0x2a3340 : 0x04060a);
  }

  // ================= 時間依存表示（スライドショー）=================
  let slideIdx = -1;
  function update(elapsed) {
    if (!slides.length) return; // スライド未配置なら黒画面のまま
    const idx = Math.floor(elapsed / 4) % slides.length; // 4秒間隔・単純切替
    if (idx !== slideIdx) {
      slideIdx = idx;
      slideScreen.map = slides[idx];
      slideScreen.color.setHex(0xffffff);
      slideScreen.needsUpdate = true;
    }
  }

  const spawn = new THREE.Vector3(0, 1.6, 9);
  refreshDisplayTextures();
  return { applyScheme, refreshDisplayTextures, setVenueBright, update, colliders, spawn };
}
