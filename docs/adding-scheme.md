# 新しいキービジュアル案を追加する

この文書では、A案・B案に続く新しい案を追加する手順を説明します。以下では、例として「C案」を追加します。

## 全体の流れ

1. 面ごとの画像をWebPで用意する
2. `public/textures/`へ画像を置く
3. `src/schemes.js`へ案を定義する
4. `index.html`へ案のボタンを追加する
5. `src/main.js`へボタンの状態更新とクリック処理を追加する
6. 必要なら`src/world.js`の無地色指定を追加する
7. ローカル表示と本番ビルドを確認する

## 1. 必要な素材

案ごとに、次の画像を用意します。ファイル名の末尾は案のキーを小文字にしたものにそろえてください。C案なら`-c.webp`です。

| 用途 | C案のファイル名 | 推奨サイズ | 3D空間上の面 | 必須 |
|---|---|---:|---:|---|
| ストックスペース前面 | `stockfront-c.webp` | 970 × 1290 px | 1.94 × 2.58 m | 必須 |
| 間仕切り | `partition-c.webp` | 1078 × 1290 px | 2.10 × 2.58 m | 必須 |
| 背面壁 | `backwall-c.webp` | 1600 × 599 px | 約6.90 × 2.58 m | 必須 |
| 側面壁 | `sidewall-c.webp` | 1100 × 970 px | 2.93 × 2.58 m | 必須 |
| 受付カウンター前面 | `counter-c.webp` | 900 × 750 px | 0.90 × 0.75 m | 必須 |
| ロールアップバナー | `banner-c.webp` | 591 × 1600 px | 0.80 × 2.00 m | 必須 |
| ボトルラベル | `label-c.webp` | 512 × 512 px | 円筒へ巻き付け | 必須 |
| 受付カウンター左小口 | `counter-end-left-c.webp` | 450 × 750 px | 0.45 × 0.75 m | 任意 |
| 受付カウンター右小口 | `counter-end-right-c.webp` | 450 × 750 px | 0.45 × 0.75 m | 任意 |

画像の縦横比は、表のサイズに合わせてください。縦横比が異なる画像は、3D空間へ貼る際に中央付近が切り抜かれます。

### 素材制作時の注意

- 形式はWebPを使います。
- 長辺は原則1600px以下にします。
- ボトルラベルは小さく表示されるため、512 × 512pxで十分です。
- 背面壁、側面壁、カウンターは、表の縦横比に合わせて面ごとの画像を作ります。
- ロゴや文字は、面の端ぎりぎりに置かないでください。表示環境や切り抜きによって端が見切れることがあります。
- ボトルラベルは左右がつながって見えても不自然にならない背景にし、正面へ見せたいロゴを画像中央付近に置きます。
- 受付カウンターの左右小口を前面と連続した柄にする場合は、左右それぞれの画像を用意します。
- WebP化した後、ロゴ、文字、グラデーション、縦横比を目視確認してください。

現在の全画像は約1 MiBです。新しい案1件の読み込み量は、できれば合計300 KiB以下を目安にしてください。

### WebPへの変換例

長辺を1600px以下にして変換する例です。

```sh
ffmpeg -i source.png \
  -vf "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease" \
  -c:v libwebp -quality 84 -compression_level 6 -preset picture -frames:v 1 \
  public/textures/backwall-c.webp
```

ボトルラベルは512 × 512pxへ縮小します。

```sh
ffmpeg -i source-label.png \
  -vf "scale=512:512:force_original_aspect_ratio=decrease" \
  -c:v libwebp -quality 84 -compression_level 6 -preset picture -frames:v 1 \
  public/textures/label-c.webp
```

## 2. 画像を配置する

作成したWebPをすべて`public/textures/`へ置きます。

```text
public/textures/
├── backwall-c.webp
├── banner-c.webp
├── counter-c.webp
├── counter-end-left-c.webp       # 任意
├── counter-end-right-c.webp      # 任意
├── label-c.webp
├── partition-c.webp
├── sidewall-c.webp
└── stockfront-c.webp
```

ブラウザからは`/textures/backwall-c.webp`のようなURLで参照します。`src`からの相対パスにはしません。

## 3. 案を定義する

`src/schemes.js`の`SCHEMES`へC案を追加します。

```js
C: {
  key: 'C',
  name: 'C案（画面に表示する名前）',
  tagline: '短い説明文',
  banner: '/textures/banner-c.webp',
  label: '/textures/label-c.webp',
  stockfront: '/textures/stockfront-c.webp',
  partition: '/textures/partition-c.webp',
  backwall: '/textures/backwall-c.webp',
  sidewall: '/textures/sidewall-c.webp',
  counter: '/textures/counter-c.webp',
  counterEndL: '/textures/counter-end-left-c.webp',
  counterEndR: '/textures/counter-end-right-c.webp',
},
```

`counterEndL`と`counterEndR`を使わない場合は省略できます。ただし、省略時の色を`src/world.js`へ追加する必要があります。詳しくは「6. 無地色を指定する」を参照してください。

`SCHEME_TEXTURES`は`SCHEMES`から自動生成されるため、通常は変更不要です。

### `wall`と`monitors`について

A案・B案には`wall`と`monitors`がありますが、現在の3D空間では使っていません。新しい案では通常、省略して構いません。将来これらを3D空間で使う場合は、`SCHEME_TEXTURES`の読み込み対象と`src/world.js`の表示面を同時に追加してください。

## 4. 案のボタンを追加する

`index.html`の「キービジュアル」にC案ボタンを追加します。

```html
<div class="row">
  <button id="btn-a" data-scheme="A">A案</button>
  <button id="btn-b" data-scheme="B">B案</button>
  <button id="btn-c" data-scheme="C">C案</button>
</div>
```

ボタンが増えて横幅が狭くなりすぎる場合は、`.row`の折り返しや`#ui`の幅も調整してください。

## 5. ボタンの処理を追加する

`src/main.js`の`refreshButtons()`へ、C案ボタンの選択状態と無効状態を追加します。

```js
$('btn-c').classList.toggle('active', state.scheme === 'C');
$('btn-c').disabled = state.schemeLoading;
```

続いて、既存のA案・B案と同じ場所へクリック処理を追加します。

```js
$('btn-c').addEventListener('click', () => void setScheme('C'));
```

`setScheme()`自体は案のキーを受け取る共通処理なので、通常は変更不要です。C案の画像は、C案ボタンが初めて押された時に読み込まれます。

### 最初に表示する案を変える場合

現在はA案を最初に表示します。C案を最初に表示する場合は、`src/main.js`にある次の2か所も変更します。

```js
await loadTextures(SCHEME_TEXTURES.C, ...);
```

```js
const state = { scheme: 'C', bright: true, mode: 'fp', schemeLoading: false };
```

読み込み中の文言も「C案を読み込んでいます」へ変更してください。

## 6. 無地色を指定する

`src/world.js`には、画像ではなく案ごとの無地色を使う場所があります。新しい案では、次の2か所を確認してください。

### 連結ローカウンター

`runWrapOpt`へC案の色を追加します。

```js
const runWrapOpt = {
  flat: {
    A: 0x1d3fa8,
    B: 0x05080f,
    C: 0x123456,
  },
};
```

C案の色を指定しない場合、`wall`画像を使おうとします。現在`wall`は読み込み対象外なので、フォールバック色になります。

### 受付カウンター小口

小口画像を用意しない場合は、`endFlat`へC案の色を追加します。

```js
const endFlat = {
  flat: {
    B: 0x0b1330,
    C: 0x123456,
  },
};
```

小口画像を用意した場合、C案を`endFlat`へ追加しないでください。色指定が画像より優先されます。

## 7. 共通の画面素材を変える場合

次の素材は案ごとではなく、A案・B案・C案で共通です。新しい案を追加するだけなら変更不要です。

- `slide-1.webp`、`slide-2.webp`、`slide-3.webp`
- `screen-website.webp`
- `screen-zundamon.webp`

変更する場合は`public/textures/`の画像を置き換えるか、`src/schemes.js`の`DISPLAY_TEXTURES`を更新します。これらは初回の3D描画後、表示時刻に合わせて段階的に読み込まれます。

## 8. 動作確認

依存パッケージをまだ入れていない場合は、最初に次を実行します。

```sh
npm install
```

開発サーバーを起動します。

```sh
npm run dev
```

ブラウザで表示し、次を確認してください。

- 初回にA案が表示される
- C案ボタンを押した時だけC案の読み込み表示が出る
- C案へ切り替わり、全ての面に意図した画像または色が出る
- 背面壁、側面壁、間仕切り、カウンターでロゴや文字が見切れていない
- ボトルラベルの正面と継ぎ目が不自然でない
- A案・B案へ戻しても表示が崩れない
- ブラウザの開発者ツールに404やJavaScriptエラーが出ていない

最後に本番用ビルドを確認します。

```sh
npm run build
```

## 追加時のチェックリスト

- [ ] 必要な面ごとのWebPを用意した
- [ ] ファイル名を`*-c.webp`のように案のキーとそろえた
- [ ] 画像を`public/textures/`へ置いた
- [ ] `src/schemes.js`の`SCHEMES`へ案を追加した
- [ ] `index.html`へ案ボタンを追加した
- [ ] `src/main.js`へボタンの状態更新とクリック処理を追加した
- [ ] `src/world.js`の連結ローカウンター色を追加した
- [ ] 小口画像を使わない場合は小口色を追加した
- [ ] ローカルで全案の切り替えを確認した
- [ ] 404とコンソールエラーがないことを確認した
- [ ] `npm run build`が成功した

## よくある問題

### 面が青い無地になる

画像URLの間違い、画像の置き忘れ、または`SCHEME_TEXTURES`の対象外が考えられます。ブラウザの開発者ツールで404を確認してください。

### C案ボタンを押しても変わらない

`src/main.js`のクリック処理、`refreshButtons()`、`src/schemes.js`のキーがすべて`C`になっているか確認してください。

### 画像が引き伸ばされた、または見切れる

画像サイズではなく縦横比を表へ合わせてください。画像は面の縦横比に合わせて切り抜かれます。

### 受付カウンター小口の画像が出ない

`endFlat`に同じ案の色が定義されていると、画像より無地色が優先されます。その案を`endFlat`から外してください。

### 初回表示がまた遅くなった

最初に表示する案の画像合計、画像の長辺、`SCHEME_TEXTURES`へ不要な画像を追加していないかを確認してください。使っていない画像を初回読み込みへ含めないことが重要です。
