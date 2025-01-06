## ツールの説明
playwrightを使用してメンバーの勤怠入力状況を自動チェックします。  
cronなどと組み合わせて自動実行させることもできます

## ツールの配置ディレクトリに関する注意(Mac)
後述するcronでの定期実行を行う際、デスクトップ配下などにツールを配置するとプライバシーとセキュリティのポップアップが毎回表示されるため、回避するには`/Users/ユーザーID/`直下などにツールを配置してみてください。

※windowsのタスクスケジューラ使用時の挙動は未確認

## 初期設定
設定ロードマップ  
=======↓playwrightを動かすのに最低限必要=======  
- node_modulesをインストールする
- `.env`の2項目を設定
- settings配下のcsvファイル2ファイルを設定  

=======↓cronで定期実行時に必要=======  
- `vpnConnect.sh`の2項目を設定
- `vpnConnect.sh`に実行権限付与
- `cron.conf`にPATH設定を追加
- `cron.conf`をcrontabに登録

---

### node_modulesの準備
- `npm install`  
※Node.jsがインストールされている必要あり

### `.env`設定
Microsoft365アカウント ログインセッション
確認方法
- 勤太郎アクセスに必要なMicrosoft365アカウントにログインする（NIJIBOX waku-2）
  - https://account.microsoft.com/account?lang=ja-jp にアクセスする
- 右上の「アカウントにサインインする」をクリック
- 「サインイン」画面になったらDevツールを開く
- 「Application」タブ=>「Cookies」=>「https://login.microsoftonline.com」を選択
- `ESTSAUTHPERSISTENT`のValueを確認し設定
  - 参考:https://learn.microsoft.com/ja-jp/entra/identity/authentication/concept-authentication-web-browser-cookies

SLACK_BOT_TOKEN
確認方法
- 以下のページにアクセスして`Bot User OAuth Token`の値を設定
  - https://api.slack.com/apps/A07RMRZ91M5/oauth?

### playwrightの準備
- slack送信設定csvファイル
  - `settings/channel_settings.csv`
    - 投稿するslackチャンネルのIDとグループ名の組み合わせを設定します
  - `settings/mention_settings.csv`
    - グループ名、勤太郎登録名、メンション用のslackユーザーIDを設定します
  - 上記の2ファイルは拡張機能のオプション画面上で設定してcsvファイルをエクスポートすることもできます

ここまでの設定が完了すると、コマンド実行でplaywrightを起動することができます。

```
npm run playwright
```

コマンド実行するとplaywrightがバックグラウンドで立ち上がり、
勤太郎アクセス→解析→slack投稿が実行されます。

## 定周期自動実行設定
さらに以下の設定を行うことで定周期で本ツールを実行することができます。  
※以下に紹介する方法以外でも定周期実行できる方法をご存知でしたらお試しください

### Mac
- vpnConnect.shの設定  
  このシェルはエニコネ接続されているか確認し、未接続ならエニコネ接続後にplaywright起動、接続済みならそのままplaywrightを起動します

  - 以下2項目を設定
    - エニーコネクト接続時のパスワード
    - 本ツールpackage.jsonのパス
      - cronで動かす際に絶対パスが必要となるため
  - 実行権限を付与
    - chmod 755 (シェルのファイルパス)/vpnConnect.sh

- cron.confを設定
  - `PATH`に`echo $PATH`に設定されているパスを記載する
    - npmコマンドを使用するが、cron起動時にはほとんどパスが通っていないため、設定が必要
    - 参考:https://qiita.com/positrium/items/a2de9af6c5b4d06b504e
    - npmのPATHが通っている環境変数をcron内で設定しないとnpmコマンドが実行できない
  - (ディレクトリ)に`vpnConnect.sh`の絶対パスを記載
    - cronで動かす際には絶対パスである必要がある
  - (お好みで)起動タイミングの変更
    - 初期設定では毎週月曜日17:55に起動するようになっています

- crontabの登録
  - `crontab -l`で現在登録されているタスクを確認
    - ※すでにcronが設定されているようだったらバックアップを取ることをおすすめします
  - cron.confを読み込ませる
    - `crontab (ファイルパス)/cron.conf`

### windows
#### お詫び
作者はwindows端末未所持のため、vpnConnect.shのようなコマンドラインからエニーコネクト接続する手段が不明です。

申し訳ないですが、windows端末利用者は事前にエニーコネクト接続している前提で定周期実行させてください。

- タスクスケジューラの設定
  - タスクスケジューラにplaywrightを起動するbatファイルを登録

## トラブルシューティング
Q.  
`npm run playwright`が実行できない  
A.  
Node.jsのインストール、`npm install`は実施済みですか？  

Q.  
`npm run playwright`の実行結果がエラーになってしまう  
A.  
`.env`ファイルの`ESTSAUTHPERSISTENT`設定は正しいですか？  

Q.  
`npm run playwright`の実行後、slack送信されない  
A.  
`.env`ファイルの`SLACK_BOT_TOKEN`設定は正しいですか？  
`settings`配下のcsvファイル設定は正しいですか？  

Q.  
`crontab`を設定したが、実行されない  
A.  
`cron.conf`にnpmコマンドのPATHは設定されていますか？    
本ツールのディレクトリ直下に`log`というファイルが出力されているか確認してみましょう。  
`cron.conf`の初期設定では、毎週月曜日17:55に起動するように設定してあるので、起動間隔を短くしてデバッグしてみてください。
