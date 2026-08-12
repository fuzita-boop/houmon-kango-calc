# 完全ローカルPWA移行チェックリスト

- [x] 現在の保存方式、外部依存、GitHubリポジトリ設定を監査する。
- [x] 既存データの移行可否を確認し、バックアップと復元の手順を設計する。
- [x] IndexedDBによる端末内永続化を実装する。
- [x] JSON形式のデータエクスポート・インポート機能を実装する。
- [x] 既存のブラウザ保存データを検出してIndexedDBへ移行する。
- [x] Web App Manifest、アイコン、Service Workerを追加し、アプリシェルを事前キャッシュする。
- [x] GitHub Pagesのサブパスで動作するViteビルド設定を追加する。
- [x] GitHub ActionsによるGitHub Pages自動デプロイを設定する。
- [x] GitHubリポジトリを公開し、GitHub Pagesを有効化する。
- [x] GitHub Pagesの公開URLにアクセスして動作を確認する。
- [x] ビルド、サブパス、オフライン起動、データ保存・復元、公開URLを検証する。
- [x] 移行結果、バックアップ方法、GitHub Pages公開手順を報告する。
