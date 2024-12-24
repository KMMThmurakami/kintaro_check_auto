import { test, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from "fs";
import { parseCsvToJson } from '../src/csvParve';
import type { ChannelsData, MemberData, MentionsData, DeviationData, SlackTextPayload, PostItem } from "../src/types";

const KINTARO_PAGE_URL="https://kintarou.r-reco.jp/Lysithea/JSP_Files/authentication/WC010_SSO.jsp";

test('kintaro_check', async () => {
  // Chromiumブラウザをカスタム設定で起動
  const context = await chromium.launchPersistentContext('');
  const page = await context.newPage();

  // =====================
  // 前処理
  // =====================
  // Cokkie埋め込み
  context.addCookies([
    {
      name: "ESTSAUTHPERSISTENT",
      value: process.env.ESTSAUTHPERSISTENT || "",
      domain: ".login.microsoftonline.com",
      path: "/"
    },
  ]);

  // =====================
  // 勤太郎
  // =====================
  // 勤太郎アクセス
  await page.goto(KINTARO_PAGE_URL || "");

  // 勤太郎操作
  // メンバーの勤怠情報csvを取得
  await page.getByRole('tab', { name: '代行者 参照者' }).click();
  await page.getByRole('link', { name: '日次データ出力' }).click();
  await page.getByLabel('月度指定').check();

  // 今月分のデータを選択
  const inputLocator = page.locator('input[name="YearMonth"]').nth(1);
  const inputValue = await inputLocator.getAttribute('value');
  const current = new Date();
  const currentYM = current.getFullYear() + "/" + (current.getMonth() + 1);
  if (inputValue !== currentYM) {
    await page.locator('#pickernext').click();
  }

  // ダウンロード操作
  await page.locator('#modal-WC210-select-btn').click();
  await page.locator('#modal-WC210 thead').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'OK' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ダウンロード' }).click();
  const download = await downloadPromise;
  await download.saveAs(path.join('./settings', download.suggestedFilename()));

  // 勤怠入寮状況の一覧をDOMから取得
  // ※未入力判定はDOM上を調べたほうが確実
  // ※csvには勤怠未入力日と休日両方が混ざっており、休日判定が大変
  await page.getByRole('link', { name: '承認状況一覧' }).click();
  const year = await page.locator('.mod-monthly-control .date span:nth-child(1)').textContent();
  const month = await page.locator('.mod-monthly-control .date span:nth-child(3)').textContent();
  const pageYM = `${year}/${month}`;
  if (pageYM !== currentYM) {
    await page.locator('.nav-next').nth(1).click();
  }

  // 承認状況一覧解析
  // クラス名が "kinmudatalist" の最初の要素を取得
  const contentHandle = await page.$('.kinmudatalist');

  // チェックする日付
  // const checkDate = current.getDate() - 1;
  const checkDate = 31; // デバッグ用

  // 稼働状況を解析
  const checkResult = await checkData(checkDate, contentHandle);
  const checkResultString = formatData(checkResult);

  // =====================
  // csv解析
  // =====================
  // チャンネル設定取得
  const _csvDataChannels = fs.readFileSync('settings/channel_settings.csv').toString();
  const settingsChannel = parseCsvToJson(_csvDataChannels, "channel");

  // メンバー設定取得
  const _csvDataMember = fs.readFileSync('settings/member_settings.csv').toString();
  const settingsMember = parseCsvToJson(_csvDataMember, "member");

  // 勤太郎日次データ取得(UTF-8に変換する)
  const _csvDataWork = fs.readFileSync('settings/dailyAttendance.csv');
  const decoder = new TextDecoder('shift-jis');
  const _dataWorkUtf8Str = decoder.decode(_csvDataWork);
  const _workData = parseCsvToJson(_dataWorkUtf8Str, "work");

  // 実動かい離があるメンバーを抽出
  const _workDataDeviation = isDeviation(_workData);
  const _deviationByName = categorizeByName(_workDataDeviation);
  const dateDeviation = filterByDate(_deviationByName);

  // =====================
  // slack送信
  // =====================
  // チャンネル設定csvを取得する
  // 投稿チャンネル数分ループ
  if (!settingsChannel) return;
  for (const channels of settingsChannel) {
    await postToSlack(channels as ChannelsData, settingsMember as MentionsData[], dateDeviation as DeviationData, currentYM, checkResultString); // 各投稿が完了するまで待つ
  }
  return;
});

const postToSlack = async (postChannel: ChannelsData, settingsMember: MentionsData[], workData: DeviationData, currentYM: string, checkResultString: string) => {
  try {
    const result = await request(postChannel, settingsMember, workData, currentYM, checkResultString); // 非同期処理
    if (result.ok) {
      console.error(`投稿しました! ${postChannel.group}`);
    } else {
      console.error(`投稿に失敗しました ${result.error} ${postChannel.group}`);
    }
  } catch (error: any) {
    console.error("想定外のエラー:", error);
  }
};

// slack投稿
export const request = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  DeviationData: DeviationData,
  currentYM: string,
  checkResultString: string
) => {
  const token: string | undefined = process.env.SLACK_BOT_TOKEN;
  console.log("channelId is :" + data.channelId);

  if (!token) {
    throw new Error(
      "Slackのユーザートークンが無効、もしくは設定されていません。",
    );
  }

  const postData = await getPostData(data, mentionSettings, DeviationData, currentYM, checkResultString);
  return await fetchSlackApi(token, postData);
};

const getPostData = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  DeviationData: DeviationData,
  currentYM: string,
  planeText: string
): Promise<SlackTextPayload> => {
  let postText = "勤怠未入力のメンバーはいません！\n"; // 初期文字列

  // storageのデータ取得
  const ym = currentYM;
  const postPlaneText = planeText;

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
    Object.keys(DeviationData).forEach((member) => {
      if (postTextArray.toString().includes(member)) {
        const text = `> 【かい離あり】${DeviationData[member]}\n`;
        postTextArray.forEach((row: string, index: number) => {
          if (row.includes(member)) {
            postTextArray[index] = postTextArray[index] + text;
          }
        });
      } else {
        const text = `${member} さん\n> 【かい離あり】${DeviationData[member]}\n`;
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

// 実働かい離データが存在するか判定
const isDeviation = (data: any) => {
  return data.filter((value: any) => {
    // 稼働ありで乖離あり
    const isWorkdayDeviation =
      value["状況"] !== "承認済" &&
      Number(value["実働かい離"]) > 120 &&
      value["かい離理由"] === "-" &&
      value["備考"] === "-";
    // 休日に稼働あり
    const isHolidayDeviation =
      !(value["状況"] === "承認済" || value["状況"] === "登録済")
      && value["休暇区分"] !== ""
      && value["休暇区分"] !== "半日有休"
      && value["休暇区分"] !== "半日STOC"
      && value["かい離理由"] === "-"
      && value["備考"] === "-"
      && (value["客観開始"] !== "-" || value["客観終了"] !== "-");
    return isWorkdayDeviation || isHolidayDeviation;
  });
}

// 氏名ごとに分類
const categorizeByName = (unapprovedData: any) => {
  // 氏名をキーとしたオブジェクトに変換
  return unapprovedData.reduce((result: any, item: any) => {
    const { 氏名: name, ...rest } = item;
    if (!result[name]) {
      result[name] = [];
    }
    result[name].push(rest);
    return result;
  }, {});
}

// 日付だけを'dd日'の形式で抽出
const filterByDate = (data: any) => {
  return Object.keys(data).reduce(
    (result: DeviationData, name: string) => {
      const days = data[name].map((row: any) => {
        return Number(row["日付"].split("/")[2]) + "日";
      });
      result[name] = days;
      return result;
    },
    {},
  );
}

const checkData = async (checkDate, contentHandle) => {
  const memberData: MemberData[] = [];
  let memberCnt = 0;

  if (contentHandle) {
    // contentHandle内の 'td[data-colidx]:not([data-colidx="0"], [data-colidx="1"])' を取得
    const cells = await contentHandle.$$(
      'td[data-colidx]:not([data-colidx="0"], [data-colidx="1"])'
    );

    let notInputList: string[] = [];

    for (const cellHandle of cells) {
      // visibility: hidden のチェック
      const isVisible = await cellHandle.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return style.visibility !== "hidden";
      });

      // 非表示要素はスキップ
      if (!isVisible) continue;

      // data-colidx の取得
      const colIdx = await cellHandle.getAttribute("data-colidx");
      const colCnt = Number(colIdx) - 2;

      // 今日以降の日付チェックはスキップする
      if (checkDate < colCnt) continue;

      // memberData[memberCnt]が存在しない場合に新しい要素を追加
      if (!memberData[memberCnt]) {
        memberData[memberCnt] = { name: "", date: [] };
      }

      // テキスト内容の取得
      const text = await cellHandle.textContent();

      // 氏名列の処理
      if (colIdx === "2") {
        console.log('[checkData] =====================================');
        console.log('[checkData] 氏名:', text.trim());

        memberData[memberCnt].name = text.trim();
        notInputList = [];
        continue;
      }

      // 日付列の処理
      const classes = await cellHandle.evaluate((node) =>
        Array.from(node.classList)
      );
      const notInputWorkDay = classes.filter(
        () => !classes.includes("offday") && classes.includes("jsk-0")
      );

      if (notInputWorkDay.length > 0) {
        notInputList.push(`${colCnt}日`);
      }

      // 最終日の集計が終わったところで出力
      if (colCnt === checkDate) {
        console.log(`[checkData] ${notInputList}`);
        memberData[memberCnt].date = notInputList;
        memberCnt++;
      }
    }
  }

  console.log('[checkData] =====================================');
  return memberData;
};

// domから解析した情報をslack投稿用文字列にフォーマット
const formatData = (checkResult: MemberData[]): string => {
  let resultStr = "";
  const values = Object.values(checkResult);

  for (let i = 0; i < values.length; i++) {
    if (values[i].date.length === 0) {
      continue;
    }
    resultStr += `${values[i].name} さん\n`;
    resultStr += "> 【勤怠未入力】" + values[i].date + "\n";
    resultStr += "-\n";
  }

  return resultStr;
};
