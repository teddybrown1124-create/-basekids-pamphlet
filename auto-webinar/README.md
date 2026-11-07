# オートウェビナー（プロトタイプ）

毎日決まった時刻に録画動画を「ライブ配信風」に流し、指定時間にCTAボタンを出すツール。

- 起動: このフォルダを静的ホスティング（Vercel / GitHub Pages / `python3 -m http.server`）で公開
- 初期ログイン: ID `admin` / パスワード `webinar2026`（設定画面で変更可）
- 視聴ページ: `index.html#/w/<ウェビナーID>`（ログイン不要）

## 現状の制約
- データはブラウザの localStorage 保存。別端末の視聴者のアクセス・CTAは集計されない → Firebase 等への移行が必要
- 決済（Stripe）、LINEログイン（LIFF）は未実装
