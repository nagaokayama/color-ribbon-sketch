# color ribbon sketch — LUT試作

描画後にパレットを編集すると、キャンバスの対応する色も変わるお絵かきアプリの試作版。

[試作版を開く](https://nagaokayama.github.io/color-ribbon-sketch/)

512×512pxのキャンバスで、ペン・消しゴム・スポイト、パレット編集と色数変更、10操作までの取り消し・やり直し、PNG保存を試せる。パレット番号とランプ位置のデバッグ表示にも対応する。

描画内容の自動保存とプロジェクト保存は未実装。必要な絵はPNGで保存する。

## 開発・確認

`dist/index.html` をブラウザで開く。外部パッケージやビルドは不要。

```sh
node --check dist/lut.js
node --check dist/lut-core.js
node check-lut.cjs
```

設計と実機確認の手順は [LUT-PROTOTYPE.md](LUT-PROTOTYPE.md) を参照。

mainへのpushでGitHub Pagesへ公開する。

[比較用の通常版](https://nagaokayama.github.io/color-ribbon-sketch-app/)
