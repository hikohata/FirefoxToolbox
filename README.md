# Web Browsing Toolbox
(日本語は最下部)

Web Browsing Toolbox is a Firefox/Chrome WebExtension designed to make web browsing more convenient.
It is secure since it runs locally without any external access.

## Main Features

1. **Page Operations**
   * **Open as Popup:** Reopen the current page in a small popup window.
   * **Rich Link Copy:** Copy the page title and URL to the clipboard simultaneously in both hyperlink format (for Excel/Word) and plain text.

2. **Element Selection & Copy**
   * Copy tables or specific block elements from the page in a format that preserves styling for pasting into Word or Excel.

3. **Edit & Restriction Removal**
   * **Edit Mode:** Make the entire page editable (ContentEditable).
   * **Remove Elements:** Remove intrusive ad overlays or unwanted elements with a single click.
   * **Bypass Restrictions:** Force-remove restrictions such as right-click disable, text-selection disable, and copy blocking.

4. **Quick Text**
   * Store frequently used snippets (addresses, email signatures, etc.) and paste them into input fields with one click.

5. **Domain Blocker**
   * Detect domains of external resources loaded on the page (e.g., ad servers) and temporarily redirect them to `localhost` to block network requests.

6. **QR Code Generation**
   * Generate a QR code for the current URL. Generation is done locally using a JavaScript library only, ensuring it remains secure.

## File Structure

* `manifest.json`: Extension manifest
* `popup.html`: Popup UI HTML
* `popup.css`: Popup styles
* `popup.js`: Feature implementation scripts
* `icon.svg`: App icon
* `qrcode.min.js`: QR code generation library (3rd party)
* `data-l10n.js`: Localization library
* `LICENSE`: License file

## License

This project is released under the [MIT License](LICENSE).

### Included Libraries
* **qrcode.min.js** — Copyright (c) 2012 davidshimjs (MIT License)


-----
# Web Browsing Toolbox

Webブラウジングを快適にするためのFirefox/Chrome用アドオン（WebExtension）です。
外部アクセス無しのローカルで動作する為、セキュアです。

## 主な機能

1.  **ページ操作**
    * **ポップアップウィンドウ化**: 現在のページを小さなポップアップウィンドウで開き直します。
    * **リッチリンクコピー**: ページのタイトルとURLをハイパーリンク形式（Excel/Word用）とテキスト形式で同時にクリップボードへコピーします。

2.  **要素選択コピー**
    * ページ内の表や特定のブロック要素を、スタイルを保ったままWordやExcelに貼り付けられる形式でコピーします。

3.  **編集・制限解除**
    * **編集モード**: ページ全体を編集可能（ContentEditable）にします。
    * **要素削除**: 邪魔な広告オーバーレイや不要な要素をクリック一つで削除します。
    * **制限解除**: 右クリック禁止、テキスト選択禁止、コピー禁止などの制限を強制的に解除します。

4.  **クイックテキスト**
    * よく使う定型文（住所、メールアドレスなど）を登録し、入力フォームへワンクリックで貼り付けます。

5.  **ドメインブロッカー**
    * ページ内で読み込まれている外部リソースのドメイン（広告配信サーバーなど）を検出し、一時的に `localhost` へリダイレクトさせることで通信をブロックします。

6.  **QRコード生成**
    * 現在のURLのQRコードを生成します。ローカルのJavaScriptライブラリのみで生成するためセキュアです。

## ファイル構成

* `manifest.json`: 拡張機能の定義ファイル
* `popup.html`: ポップアップ画面のHTML
* `popup.css`: ポップアップ画面のスタイル
* `popup.js`: 機能実装のスクリプト
* `icon.svg`: アプリアイコン
* `qrcode.min.js`: QRコード生成ライブラリ(3rd party)
* `data-l10n.js`: 多言語対応用ライブラリ
* `LICENSE`: ライセンスファイル

## ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。

### 使用ライブラリ
* **qrcode.min.js**: Copyright (c) 2012 davidshimjs (MIT License)
