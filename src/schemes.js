// A案 / B案 の素材定義。テクスチャは public/textures/ に配置済み（Vite が / から配信する）。
// monitors[0] = コピー入りKV（本文）、monitors[1] = コピー入りKV（別版）。
// logoX = プレーンKV内でロゴ（船アイコン+AppThrust）が位置する水平方向の正規化座標。
export const SCHEMES = {
  A: {
    key: 'A',
    name: 'A案（白×爽快）',
    tagline: '間口を広げる',
    wall: '/textures/kv-a.jpg',
    monitors: ['/textures/kv-a-copy.jpg', '/textures/kv-a-copy-heroku.jpg'],
    banner: '/textures/banner-a.jpg',
    label: '/textures/label-a.png', // ノベルティボトルのラベル（中央=正面、左右端は無地）
    // カンプから射影抽出した面ごとの専用テクスチャ
    stockfront: '/textures/stockfront-a.png',
    partition: '/textures/partition-a.png', // 間仕切り主エリア側（前面と1枚続きのグラデ）
    backwall: '/textures/backwall-a.png',
    sidewall: '/textures/sidewall-a.png',
    counter: '/textures/counter-a.png',
    // 受付カウンター小口（前面と一続きの同心円グラデ）。B案はフラット色のため未使用。
    counterEndL: '/textures/counter-end-left-a.png',
    counterEndR: '/textures/counter-end-right-a.png',
  },
  B: {
    key: 'B',
    name: 'B案（紺×精密）',
    tagline: '信頼を先に立てる',
    wall: '/textures/kv-b.jpg',
    monitors: ['/textures/kv-b-copy.jpg', '/textures/kv-b-bright.jpg'],
    banner: '/textures/banner-b.jpg',
    label: '/textures/label-b.png',
    stockfront: '/textures/stockfront-b.png',
    partition: '/textures/partition-b.png',
    backwall: '/textures/backwall-b.png',
    sidewall: '/textures/sidewall-b.png',
    counter: '/textures/counter-b.png',
  },
};

// 事前ロードするテクスチャの一覧（重複なし）。
export const ALL_TEXTURES = [
  ...new Set(
    Object.values(SCHEMES).flatMap((s) => [
      s.wall, ...s.monitors, s.banner, s.label,
      s.stockfront, s.partition, s.backwall, s.sidewall, s.counter,
      s.counterEndL, s.counterEndR,
    ]).filter(Boolean),
  ),
];

// ディスプレイの固定コンテンツ（A/B非依存）。ファイル未配置時は各自 404 → 黒フォールバック。
export const DISPLAY_TEXTURES = {
  slides: ['/textures/slide-1.png', '/textures/slide-2.png', '/textures/slide-3.png'],
  website: '/textures/screen-website.png',
  zundamon: '/textures/screen-zundamon.png',
};
