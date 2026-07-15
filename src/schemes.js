// A案 / B案 の素材定義。テクスチャは public/textures/ に配置済み（Vite が / から配信する）。
// monitors[0] = コピー入りKV（本文）、monitors[1] = コピー入りKV（別版）。
// logoX = プレーンKV内でロゴ（船アイコン+AppThrust）が位置する水平方向の正規化座標。
export const SCHEMES = {
  A: {
    key: 'A',
    name: 'A案（白×爽快）',
    tagline: '間口を広げる',
    wall: '/textures/kv-a.webp',
    monitors: ['/textures/kv-a-copy.webp', '/textures/kv-a-copy-heroku.webp'],
    banner: '/textures/banner-a.webp',
    label: '/textures/label-a.webp', // ノベルティボトルのラベル（中央=正面、左右端は無地）
    // カンプから射影抽出した面ごとの専用テクスチャ
    stockfront: '/textures/stockfront-a.webp',
    partition: '/textures/partition-a.webp', // 間仕切り主エリア側（前面と1枚続きのグラデ）
    backwall: '/textures/backwall-a.webp',
    sidewall: '/textures/sidewall-a.webp',
    counter: '/textures/counter-a.webp',
    // 受付カウンター小口（前面と一続きの同心円グラデ）。B案はフラット色のため未使用。
    counterEndL: '/textures/counter-end-left-a.webp',
    counterEndR: '/textures/counter-end-right-a.webp',
  },
  B: {
    key: 'B',
    name: 'B案（紺×精密）',
    tagline: '信頼を先に立てる',
    wall: '/textures/kv-b.webp',
    monitors: ['/textures/kv-b-copy.webp', '/textures/kv-b-bright.webp'],
    banner: '/textures/banner-b.webp',
    label: '/textures/label-b.webp',
    stockfront: '/textures/stockfront-b.webp',
    partition: '/textures/partition-b.webp',
    backwall: '/textures/backwall-b.webp',
    sidewall: '/textures/sidewall-b.webp',
    counter: '/textures/counter-b.webp',
  },
};

// 実際に3D空間へ貼る画像だけを案ごとにロードする。wall/monitors は現在未使用。
export const SCHEME_TEXTURES = Object.fromEntries(
  Object.entries(SCHEMES).map(([key, s]) => [key, [
    s.banner, s.label, s.stockfront, s.partition, s.backwall, s.sidewall,
    s.counter, s.counterEndL, s.counterEndR,
  ].filter(Boolean)]),
);

// ディスプレイの固定コンテンツ（A/B非依存）。ファイル未配置時は各自 404 → 黒フォールバック。
export const DISPLAY_TEXTURES = {
  slides: ['/textures/slide-1.webp', '/textures/slide-2.webp', '/textures/slide-3.webp'],
  website: '/textures/screen-website.webp',
  zundamon: '/textures/screen-zundamon.webp',
};
