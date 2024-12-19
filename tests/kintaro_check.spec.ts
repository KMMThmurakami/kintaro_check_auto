import { test, chromium } from '@playwright/test';
import * as path from 'path';
// import * as OTPAuth from "otpauth";

const KINTARO_PAGE_URL="https://kintarou.r-reco.jp/Lysithea/JSP_Files/authentication/WC010_SSO.jsp";

test('kintaro_check', async () => {
  // Chromiumブラウザをカスタム設定で起動
  const context = await chromium.launchPersistentContext('');
  const page = await context.newPage();

  // =====================
  // 勤太郎
  // =====================
  // ログイン
  // Cokkie埋め込み
  context.addCookies([
    {
      name: "ESTSAUTHPERSISTENT",
      value: process.env.ESTSAUTHPERSISTENT || "",
      domain: ".login.microsoftonline.com",
      path: "/"
    },
  ]);
  // 1. Open the login page
  await page.goto(KINTARO_PAGE_URL || "");

  // // 2. Enter the email address
  // const emailInput = page.locator("input[type=email]");
  // await emailInput.click();
  // await emailInput.fill(process.env.M365_USERNAME || "");

  // // 3. Click on the "Next" button
  // await page.getByRole("button", { name: "Next" }).click();

  // // 4. Enter the password
  // const passwordInput = page.locator("input[type=password]");
  // await passwordInput.click();
  // await passwordInput.fill(process.env.M365_PASSWORD || "");

  // // 5. Click on the "Sign in" button
  // await page.locator("input[type=submit]").click();

  // // 6. Check if the account has the Microsoft Authenticator app configured
  // const otherWayLink = page.locator("a#signInAnotherWay");
  // await otherWayLink.waitFor({ timeout: 5000 });
  // if (await otherWayLink.isVisible()) {
  //   // Select the TOTP option
  //   await otherWayLink.click();

  //   const otpLink = page.locator(`div[data-value="PhoneAppOTP"]`);
  //   await otpLink.click();
  // }

  // // 7. Enter the TOTP code
  // const otpInput = await page.waitForSelector("input#idTxtBx_SAOTCC_OTC");
  // let totp = new OTPAuth.TOTP({
  //   issuer: "Microsoft",
  //   label: process.env.M365_USERNAME,
  //   algorithm: "SHA1",
  //   digits: 6,
  //   period: 30,
  //   secret: process.env.M365_OTP_SECRET,
  // });
  // const code = totp.generate();
  // await otpInput.fill(code);

  // // 8. Click on the "Next" button
  // await page.locator("input[type=submit]").click();
  // await page.getByRole('button', { name: 'Yes' }).click();

  // 勤太郎操作
  await page.getByRole('tab', { name: '代行者 参照者' }).click();
  await page.getByRole('link', { name: '日次データ出力' }).click();
  await page.getByLabel('月度指定').check();

  const inputLocator = page.locator('input[name="YearMonth"]').nth(1);
  const inputValue = await inputLocator.getAttribute('value');
  const current = new Date();
  const currentYM = current.getFullYear() + "/" + (current.getMonth() + 1);
  if (inputValue !== currentYM) {
    console.log('先月分表示...');
    await page.locator('#pickernext').click();
  } else {
    console.log('今月分表示');
  }

  await page.locator('#modal-WC210-select-btn').click();
  await page.locator('#modal-WC210 thead').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'OK' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ダウンロード' }).click();
  const download = await downloadPromise;
  await download.saveAs(path.join('./settings', download.suggestedFilename()));

  // =====================
  // csv解析
  // =====================

  // =====================
  // slack送信
  // =====================
  // チャンネル設定csvを取得する
  // 投稿チャンネル数分ループ
  
  // const token = process.env.SLACK_BOT_TOKEN || "";
  // const payload = getPayload("C0836RGN2GJ");
  // await fetchSlackApi(token, payload);
  return;

  // await page.getByRole('link', { name: '承認状況一覧' }).click();
  // const year = await page.locator('.mod-monthly-control .date span:nth-child(1)').textContent();
  // const month = await page.locator('.mod-monthly-control .date span:nth-child(3)').textContent();
  // const pageYM = `${year}/${month}`;
  // if (pageYM !== currentYM) {
  //   console.log('先月分表示...');
  //   await page.locator('.nav-next').nth(1).click();
  // } else {
  //   console.log('今月分表示');
  // }
  // await page.waitForTimeout(500);

  // =====================
  // 拡張機能
  // =====================
  // オプションページのURLを開く
  // const optionsPageUrl = `chrome-extension://${process.env.EXTENSION_ID}/options.html`; // 拡張機能のオプションページURL
  // await page.goto(optionsPageUrl);
  // // csv各種読み込み
  // const fileInputC = page.locator('input[type="file"]#fileInputChannel');
  // await fileInputC.setInputFiles(path.join('./settings', 'channel_settings.csv'));
  // const fileInputM = page.locator('input[type="file"]#fileInputMention');
  // await fileInputM.setInputFiles(path.join('./settings', 'mention_settings.csv'));
  // const fileInputK = page.locator('input[type="file"]#fileInputKairi');
  // await fileInputK.setInputFiles(path.join('./settings', download.suggestedFilename()));

  // // 拡張機能起動
  // const popupPageUrl = `chrome-extension://${process.env.EXTENSION_ID}/popup.html`;
  // await page.goto(popupPageUrl);
  // await page.waitForTimeout(5000);
});

// const postToSlack = async (data: ChannelsData) => {
//   try {
//     const result = await request(data, mentionSettings, kairiData); // 非同期処理
//     console.log(result);

//     if (result.ok) {
//       // setContent(domSuccess); // 成功時のポップアップ
//       resultSuccess.push(data.group);
//     } else {
//       // setContent(domError(POST_ERROR, result.error)); // 失敗時のポップアップ
//       resultError.push(data.group);
//       resultErrorReason.push(result.error);
//     }
//   } catch (error: any) {
//     console.error("想定外のエラー:", error);
//     resultError.push(data.group);
//     resultErrorReason.push(error.toString());
//   }

//   return { resultSuccess, resultError, resultErrorReason };
// };

// slack投稿
export const request = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  kairiData: KairiData,
) => {
  // const userPostMode = await loadFromChromeStorage("userPostMode");
  // const mode = userPostMode
  //   ? process.env.PLASMO_PUBLIC_SLACK_USER_TOKEN
  //   : process.env.PLASMO_PUBLIC_SLACK_BOT_TOKEN;

  const token: string | undefined = process.env.SLACK_BOT_TOKEN;
  console.log("channelId is :" + data.channelId);

  if (!token) {
    throw new Error(
      "Slackのユーザートークンが無効、もしくは設定されていません。",
    );
  }

  const postData = await getPostData(data, mentionSettings, kairiData);
  return await fetchSlackApi(token, postData);
};

const getPostData = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  kairiData: KairiData,
): Promise<SlackTextPayload> => {
  let postText = "勤怠未入力のメンバーはいません！\n"; // 初期文字列

  // storageのデータ取得
  const ym = "2024/12";
  const postPlaneText = "";

  // 選択中グループ対象者を抽出
  const postGroupArray = mentionSettings.filter((member) => {
    return member.group === data.group;
  });

  if (postPlaneText !== null && postGroupArray.length > 0) {
    // 保存文字列を配列に戻す
    const postPlaneTextArray = postPlaneText.split("-\n");

    const postTextArray = postPlaneTextArray.filter((str: string) => {
      const ret = postGroupArray.filter((member) => {
        return str.includes(member.kintaroName);
      });
      return ret.length > 0;
    });

    // かい離情報を追加する
    Object.keys(kairiData).forEach((member) => {
      if (postTextArray.toString().includes(member)) {
        const text = `> 【かい離あり】${kairiData[member]}\n`;
        postTextArray.forEach((row: string, index: number) => {
          if (row.includes(member)) {
            postTextArray[index] = postTextArray[index] + text;
          }
        });
      } else {
        const text = `${member} さん\n> 【かい離あり】${kairiData[member]}\n`;
        postTextArray.push(text);
      }
    });

    // メッセージ整形
    postTextArray.forEach((row: string, index: number) => {
      if (index === 0) {
        postText = "--------------------\n";
      }
      // slackUserIDが設定されていたらメンション情報を追加する
      const mentionData = mentionSettings.find((member) => {
        return row.includes(member.kintaroName);
      });
      const postRow = mentionData?.slackUserID
        ? row.replace(
            `${mentionData?.kintaroName} さん`,
            `${mentionData?.kintaroName} さん <@${mentionData?.slackUserID}>`,
          )
        : row;
      postText += postRow;
      postText += "--------------------\n";
      if (index === postTextArray.length - 1) {
        postText += "\nご確認ください！\n";
      }
    });
  }

  // メッセージを置換
  const payload = getPayload(data.channelId);
  payload.blocks[0].text.text = payload.blocks[0].text.text.replace("YM", ym);
  payload.blocks[1] = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: postText,
    },
  };

  return payload;
};

// slackAPIに要求
const fetchSlackApi = async (token: string, payload: SlackTextPayload) => {
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.ok) {
      console.log("success");
    } else {
      console.log("miss");
    }
    return data;
  } catch (e) {
    console.error(e);
    return e;
  }
};

// payload取得
const getPayload = (channelId: string): SlackTextPayload => {
  // payload を関数内で新しく作成して、毎回リセット
  const payload: SlackTextPayload = {
    channel: channelId,
    blocks: [], // 型を PostItem[] で明示することでエラーを防ぐ
  };

  // templateMessage もここで新たに作成
  const templateMessage: PostItem = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*【勤怠入力状況のお知らせ】*\n\n*YM*",
    },
  };

  payload.blocks.push(templateMessage);
  return payload;
};

export type PostParts = {
  type: string;
  text: string;
};

export type PostItem = {
  type: string;
  text: PostParts;
};

export type SlackTextPayload = {
  channel: string | null;
  blocks: PostItem[];
};

export type MemberData = {
  name: string;
  date: string[];
};

export type MentionsData = {
  group: string;
  kintaroName: string;
  slackUserID: string;
};

export type KairiData = {
  [key: string]: string[];
};

export type ChannelsData = {
  channelId: string;
  group: string;
};

export type PostResult = {
  resultSuccess: string[];
  resultError: string[];
  resultErrorReason: string[];
};
