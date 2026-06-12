# Search Battle — 設計ドキュメント

「お題を出す → ユーザーがアプリ内ブラウザで調べる → 証拠をスクショ → OCR → 答えとの類似率でポイント算出」という検索クイズゲームの技術検証と実装設計。

## 結論：技術的に可能か？

**可能。** ただし素直に作ると詰むポイントが1つあり、そこの方式選定がこのアプリの設計の核になる。

### 最大の課題：「アプリ内ブラウザ + スクショ」

直感的には `<iframe>` で外部サイトを表示して `html2canvas` 等でスクショ、と考えがちだが、これは**ほぼ機能しない**。

| 問題 | 内容 |
|---|---|
| iframe 拒否 | Google・Wikipedia など主要サイトは `X-Frame-Options: DENY` / `CSP frame-ancestors` で iframe 埋め込みを拒否する |
| クロスオリジン汚染 | 仮に表示できても、クロスオリジンの iframe 内容は canvas に描画できない（セキュリティ制約）。クライアント側スクショは不可能 |
| チート耐性 | クライアント側でスクショを生成する方式だと、任意の画像をアップロードする改竄が容易 |

### 解決策：サーバーサイド・リモートブラウザ方式（採用）

「アプリ内ブラウザ」を**サーバー側のヘッドレス Chromium** として実装する。

```
ユーザー操作（URL入力/検索/タップ/スクロール）
        │  コマンドとして送信
        ▼
  Next.js API Route（Vercel Function）
        │  puppeteer-core + @sparticuz/chromium
        ▼
  ヘッドレス Chromium がページを開きスクリーンショットを撮影
        │  画像を返却（＋ページテキストも取得しておく）
        ▼
  クライアントは「画像」としてブラウザ画面を表示
```

この方式が優れている点：

1. **スクショは常にサーバーが生成** → OS のスクショ機能やアップロード画像は構造的に無効。「Windows のスクショは無効」という要件が認証ロジックなしで自動的に満たされる
2. **スマホ対応が容易** → クライアントは画像を表示してタップ座標を送るだけ。デバイス性能に依存しない
3. **OCR の補助情報が手に入る** → スクショと同時にページの DOM テキストも取得できるため、OCR 結果のクロスチェック（チート検証）に使える
4. **iframe 制約と無関係** → どんなサイトでも表示できる

トレードオフ：

- 操作のたびにサーバー往復が発生する（体感ラグ）。→ MVP では「URL/検索語を入れる → ページ表示 → スクロール/リンクタップ → ここだ！でスクショ確定」という**コマンド単位の操作**に割り切る。ヌルヌル操作は不要
- Vercel Function の実行時間制限（Hobby: 既定10秒〜最大60秒、Fluid Compute で延長可）。1操作=1リクエストに分割すれば問題ない
- セッション維持：サーバーレスはステートレスなので、ページ状態は「現在のURL + スクロール位置」をクライアントが保持し、毎リクエストで復元する（または Browserless 等の外部ブラウザサービスで永続セッションを持つ）

> 代替案として Browserless.io / ScreenshotOne などの外部ヘッドレスブラウザ SaaS を使う手もある。Vercel Function のサイズ制限（250MB）やコールドスタートが問題になったら移行する。

## 全体アーキテクチャ

```
┌─────────────────────────────────────────────┐
│ Next.js (App Router) on Vercel              │
│                                             │
│  フロント (React)                            │
│   ├ お題表示画面                              │
│   ├ リモートブラウザ画面（画像 + 操作UI）       │
│   └ 結果画面（OCR結果・類似率・ポイント）       │
│                                             │
│  API Routes (Vercel Functions)              │
│   ├ GET  /api/quiz          お題取得         │
│   ├ POST /api/browser       ブラウザ操作+スクショ│
│   ├ POST /api/submit        スクショ確定→採点  │
│   └ POST /api/quiz/create   お題投稿（追々）   │
└──────────┬──────────────────────────────────┘
           │
   ┌───────┼──────────────┬─────────────────┐
   ▼       ▼              ▼                 ▼
 Supabase  ヘッドレス      OCR             Realtime
 (Postgres Chromium       (Cloud Vision    (Supabase
  + Auth    (@sparticuz/   or Tesseract.js  Realtime,
  + Storage) chromium)     or LLM Vision)   追々の対戦用)
```

### 技術スタック

| レイヤ | 採用 | 理由 |
|---|---|---|
| フレームワーク | Next.js 15 (App Router) + TypeScript | 要件指定。API Routes でサーバー処理も完結 |
| ホスティング | Vercel | 要件指定 |
| ヘッドレスブラウザ | `puppeteer-core` + `@sparticuz/chromium` | Vercel Function 上で動く軽量 Chromium。実績多数 |
| DB | Supabase (Postgres) + Drizzle ORM | お題・スコア・ユーザー。Realtime/Auth/Storage が揃っており追々機能と相性が良い |
| OCR | Google Cloud Vision API（推奨）/ Tesseract.js（無料代替） | 日本語精度は Cloud Vision が圧倒的。月1,000件まで無料 |
| 類似率 | 文字列正規化 + レーベンシュタイン / trigram。数値お題は相対誤差 | 後述 |
| 認証 | Supabase Auth | 追々機能（投稿・対戦）で必須。MVP では匿名セッションでも可 |
| リアルタイム対戦 | Supabase Realtime | Vercel Functions は WebSocket 常時接続不可のため外部 Realtime が必須 |

## コア機能のロジック

### 1. お題を出す

```sql
-- quizzes テーブル
id, type ('what' | 'number'), question, image_url,
answer_text,        -- 正解（"東京スカイツリー" など）
answer_aliases,     -- 別解 ["スカイツリー", "Tokyo Skytree"]
answer_number,      -- 数値お題の正解値 (634)
answer_unit,        -- 'm', 'kg' など
created_by, likes_count, created_at
```

- お題タイプを2種類に分ける：
  - **`what`（これって何？）** → 文字列マッチで採点
  - **`number`（高さは？）** → 数値抽出 + 相対誤差で採点
- 画像は Supabase Storage に置き、出題APIはランダム or 日替わりで1問返す

### 2. アプリ内ブラウザ + スクショ

`POST /api/browser` のリクエスト/レスポンス：

```ts
// リクエスト
{ sessionId, action: 'navigate'|'search'|'click'|'scroll',
  url?, query?, x?, y?, deltaY? , currentUrl?, scrollY? }

// レスポンス
{ screenshotUrl,        // 撮影画像（Supabase Storage に保存し署名URL返却）
  screenshotId,         // サーバー発行ID（これが「正当なスクショ」の証明）
  currentUrl, scrollY,  // 次リクエストでの状態復元用
  pageText }            // サーバー側にのみ保存（チート検証用）
```

処理フロー：

1. Chromium 起動（モバイル相当の viewport: 390×844）
2. `navigate`: URL へ遷移 / `search`: `https://www.bing.com/search?q=...` へ遷移（Google は bot 検知が厳しいため Bing or DuckDuckGo を既定にする）
3. `click`: 画像上のタップ座標をそのまま `page.mouse.click(x, y)` に渡す → 遷移先を撮影
4. `scroll`: `window.scrollBy` 後に撮影
5. スクショを Storage に保存し、`screenshotId` と `pageText` を DB に記録

**チート対策の要**：採点 API はクライアントから画像を受け取らない。`screenshotId` だけを受け取り、サーバーに保存済みの画像を採点する。これで端末スクショ・画像アップロード・画像差し替えは全て無効。

### 3. スクショ OCR

`POST /api/submit` で `{ sessionId, quizId, screenshotId }` を受け取り：

1. Storage から該当スクショを取得
2. Cloud Vision API `DOCUMENT_TEXT_DETECTION` で全文 OCR（日本語対応）
3. （任意の検証）OCR テキストと保存済み `pageText` の重なりを確認 — 大きく乖離していたら不正フラグ

> コスト最優先なら Tesseract.js をサーバー側で実行（無料・日本語精度は中程度）。
> 将来的には LLM Vision（Claude 等）に「この画像から答えに該当する記述を抜き出せ」と投げる方式が最も賢く、OCR + 抽出 + 表記ゆれ吸収を一発でやれる。MVP は Cloud Vision で十分。

### 4. 類似率算出 → ポイント

#### 文字列お題（これって何？）

```
正規化: NFKC → 小文字化 → カタカナ→ひらがな → 空白・記号除去
候補生成: OCR全文を n-gram スライドで走査し、正解(+別解)と最も近い部分文字列を探す
類似率 = max(
  1 - levenshtein(候補, 正解) / max(len),   // 編集距離ベース
  trigramJaccard(候補, 正解)                 // 部分一致に強い
)
```

- OCR は「答えそのもの」ではなく「答えを含むページ全文」を返すので、**全文 vs 正解の完全一致ではなく、全文中のベストマッチ部分文字列**を探すのがポイント
- 類似率 ≥ 0.85 → 正解（100pt）、0.6〜0.85 → 部分点（類似率×100）、未満 → 0pt

#### 数値お題（高さ・重さ等）

```
1. OCR テキストから 数値+単位 のペアを正規表現で全抽出（"634m", "634 メートル", "0.634km"）
2. 単位を正規化して基準単位に変換
3. 正解に最も近い値を採用し、相対誤差 e = |x - 正解| / 正解
4. スコア = 100 × max(0, 1 - e / 0.10)   // 誤差10%で0点になる線形減点（要調整）
```

#### ボーナス

- 回答時間ボーナス：`残り時間/制限時間 × 20pt` を加算（対戦時の差別化要素）

### 5. 追々：リアルタイム 1vs1 対戦

Vercel の Function は WebSocket の常時接続を張れないため、**Supabase Realtime**（または Pusher/Ably）を使う。

```
matches テーブル: id, quiz_id, player1, player2, status, started_at
match_events: マッチ進行イベント（参加・スクショ確定・採点完了）
```

- マッチング：「対戦待ち」テーブルに INSERT → 2人揃ったら match 作成（Postgres の advisory lock か Edge Function で原子的に）
- 進行同期：両クライアントが `match:{id}` チャンネルを subscribe。相手の「調査中…」「スクショ確定！」をリアルタイム表示
- 採点はサーバー（`/api/submit`）が単一の真実。Realtime は表示同期のみに使い、スコア改竄余地を残さない

### 6. 追々：ユーザーお題投稿（いいね付き）

- `quizzes.created_by` + `likes (user_id, quiz_id)` テーブル。`likes_count` は非正規化カウンタ
- 投稿フォーム：問題文・画像アップロード（Supabase Storage）・正解・別解・タイプ
- 公開前モデレーション用に `status: draft | published | rejected` を持たせる
- 出題APIは「いいね順 / 新着 / ランダム」でフィード

## 画面フロー（MVP）

```
[ホーム] ─ プレイ開始 → [お題画面]（画像+問題文、制限時間タイマー）
                          │ 「調べる」
                          ▼
                       [リモートブラウザ画面]
                        ├ 検索バー（Bing検索 or URL直打ち）
                        ├ ページ画像（タップでリンク遷移、ボタンでスクロール）
                        └ 📸「これを証拠にする」ボタン
                          │ screenshotId 確定
                          ▼
                       [結果画面]
                        ├ OCR で見つかった答え候補のハイライト
                        ├ 類似率 ○○% → 獲得 ○○pt
                        └ もう一回 / シェア
```

## 実装フェーズ

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| **P1: コア検証** | Vercel 上で puppeteer + @sparticuz/chromium が動くか最優先で検証。navigate→screenshot の API 1本 | Vercel 本番でスクショが返る |
| **P2: MVP** | お題（シードデータ数問）→ リモートブラウザ → スクショ確定 → OCR → 採点の一連フロー | 1人プレイが端から端まで動く |
| **P3: 永続化** | Supabase 導入。お題DB・スコア履歴・匿名認証 | スコアが記録される |
| **P4: 対戦** | Supabase Realtime でマッチング + 1vs1 | 2ブラウザで対戦が成立 |
| **P5: UGC** | お題投稿・いいね・フィード・モデレーション | ユーザー投稿お題でプレイできる |

## リスクと対策まとめ

| リスク | 深刻度 | 対策 |
|---|---|---|
| iframe でのアプリ内ブラウザは不可能 | 高 | サーバーサイド・リモートブラウザ方式で回避（本設計の前提） |
| Vercel Function のサイズ/時間制限 | 中 | @sparticuz/chromium は実績あり。ダメなら Browserless.io へ移行 |
| 検索エンジンの bot 検知 | 中 | Bing/DuckDuckGo を既定に。UA・ヘッダを通常ブラウザ相当に設定 |
| 操作ラグ（毎回サーバー往復） | 中 | コマンド単位操作のUI設計に割り切る。スクショは WebP 品質調整で軽量化 |
| OCR の日本語精度 | 中 | Cloud Vision 採用。無料枠超過時は Tesseract.js + LLM 抽出を検討 |
| チート（画像差し替え） | 低 | screenshotId 方式により構造的に不可能 |
| ヘッドレスブラウザの悪用（SSRF） | 中 | navigate 先を http/https のみに制限、プライベートIP帯（169.254.x, 10.x 等）をブロック |
| コスト | 低〜中 | スクショ実行時間課金。1プレイ≒5〜10操作。Hobby 枠で検証し、伸びたら従量を試算 |

## コスト目安（月間1,000プレイ想定）

- Vercel: Hobby 無料枠内（Function 実行 ≒ 1プレイ20秒 × 1,000 = 5.5時間/月）
- Supabase: Free プラン内（DB 500MB / Storage 1GB / Realtime 200同時接続）
- Cloud Vision: 1,000件/月まで無料 → ちょうど無料枠

**MVP は完全無料で運用可能。**
