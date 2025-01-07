#!/bin/bash
set -eu

##############
# 手動設定項目
##############
PASS='' # エニーコネクト接続時のパスワード
APP_PATH='' # アプリケーション（playwright）のpackage.jsonがあるパス（絶対パスを記載）

##############
# 以下編集不要
##############
# 前処理
VPN_COMMAND=/opt/cisco/secureclient/bin/vpn
USER=$(whoami)
TARGET_SERVER='リクルートエニーコネクト'

# vpnコマンドがなければエラー
if [ ! -e $VPN_COMMAND ]; then
  echo "Cisco \`vpn\` command is not installed" >&2
  exit 1
fi

# 既にVPN接続されていれば終了
# isconnected=$($VPN_COMMAND state | grep "Connected" | wc -l) # HACK: `grep -c` だとマッチしない場合終了する
# if [ $isconnected -gt 0 ]; then
if $VPN_COMMAND state | grep -q "Connected"; then
  echo "VPN already connected."
  # exit 0
else
  # VPN接続
  output=$(printf "${USER}\n${PASS}" | $VPN_COMMAND -s connect $TARGET_SERVER)
  nlerror=$(echo "$output" | grep "error" | wc -l)

  # 接続エラー時：G7の場合ここに入る
  if [ $nlerror -gt 0 ]; then
    echo "An error occurred during the VPN connection process. The VPN process is currently being killed. Please try again later." >&2
    # sudo pkill vpn
    # sudo pkill cisco
    # exit 1
  fi

  echo "$output"
fi

# 勤太郎チェックを起動
npm run playwright --prefix "$APP_PATH" | tee "$APP_PATH"/log
