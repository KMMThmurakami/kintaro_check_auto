import { test, chromium, Locator } from '@playwright/test';
import * as path from 'path';
import * as fs from "fs";
import { parseCsvToJson, isDeviation, categorizeByName, filterByDate } from '../src/parseCsv';
import { formatSlackStr } from '../src/formatSlackStr';
import { postToSlack } from '../src/postToSlack';
import { current } from '../src/currentDate';
import type { CheckResult, ChannelsData, MentionsData, DeviationData } from "../src/types";

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

  // csv取得:今月分のデータを選択
  const inputLocator = page.locator('input[name="YearMonth"]').nth(1);
  const inputValue = await inputLocator.getAttribute('value');
  const currentYM = current.getFullYear() + "/" + (current.getMonth() + 1);
  if (inputValue !== currentYM) {
    await page.locator('#pickernext').click();
  }

  // csvダウンロード操作
  await page.locator('#modal-WC210-select-btn').click();
  await page.locator('#modal-WC210 thead').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'ダウンロード' }).click();
  const download = await page.waitForEvent('download');
  await download.saveAs(path.join('./settings', download.suggestedFilename()));

  // 勤怠入力状況の一覧をDOMから取得
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
  // クラス名が "kinmudatalist" の中の最初のtableタグを取得
  // ※2つ目のtableタグは列固定用のDOM
  const contentHandle = page.locator('.kinmudatalist > table').first();
  const checkDate = current.getDate() - 1;
  const checkResult = await checkAttendance(contentHandle, checkDate);
  const checkResultString = formatSlackStr(checkResult);

  // =====================
  // csv解析
  // =====================
  // チャンネル設定取得
  const _csvDataChannels = fs.readFileSync('settings/channel_settings.csv').toString();
  const settingsChannel = parseCsvToJson(_csvDataChannels, "channel");

  // メンバー設定取得
  const _csvDataMember = fs.readFileSync('settings/member_settings.csv').toString();
  const settingsMember = parseCsvToJson(_csvDataMember, "member");

  // 勤太郎日次データ取得(Shift-JIS -> UTF-8に変換する)
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
    await postToSlack(
      channels as ChannelsData,
      settingsMember as MentionsData[],
      dateDeviation as DeviationData,
      checkResultString
    );
  }
  return;
});

// 稼働状況をDOMから解析（playwrightメソッドを使用しているのでここに置いている）
const checkAttendance = async (contentHandle: Locator, checkDate: number) => {
  const memberData: CheckResult[] = [];
  let notInputList: string[] = [];
  let memberCnt = 0;

  if (!contentHandle) return memberData;

  const cellsLocator = contentHandle.locator('td[data-colidx]:not([data-colidx="0"], [data-colidx="1"])');
  const cellCount = await cellsLocator.count();

  for (let i = 0; i < cellCount; i++) {
    const cellLocator = cellsLocator.nth(i);
    // data-colidx の取得
    const colIdx = await cellLocator.getAttribute("data-colidx");
    const colCnt = Number(colIdx) - 2;

    // 今日以降の日付チェックはスキップする
    if (checkDate < colCnt) continue;

    // memberData[memberCnt]が存在しない場合に新しい要素を追加
    if (!memberData[memberCnt]) {
      memberData[memberCnt] = { name: "", date: [] };
    }

    // テキスト内容の取得
    const text = await cellLocator.textContent();

    // 氏名列の処理
    if (colIdx === "2") {
      console.log('[checkAttendance] =====================================');
      console.log('[checkAttendance] 氏名:', text?.trim());

      memberData[memberCnt].name = text?.trim() || '';
      notInputList = []; // メンバーごとに初期化
      continue;
    }

    // 日付列の処理:休日（"offday"）ではない未入力日（"jsk-0"）を抽出
    const classes = await cellLocator.evaluate((node) =>
      Array.from((node as Element).classList)
    );
    const notInputWorkDay = classes.filter(
      () => !classes.includes("offday") && classes.includes("jsk-0")
    );
    if (notInputWorkDay.length > 0) {
      notInputList.push(`${colCnt}日`);
    }

    // チェック最終日の集計が終わったところで出力
    if (colCnt === checkDate) {
      console.log(`[checkAttendance] ${notInputList}`);
      memberData[memberCnt].date = notInputList;
      memberCnt++;
    }
  }

  console.log('[checkAttendance] =====================================');
  return memberData;
};
