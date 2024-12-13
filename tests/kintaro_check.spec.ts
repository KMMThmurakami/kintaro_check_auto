import { test, chromium } from '@playwright/test';
import * as path from 'path';
import * as OTPAuth from "otpauth";

const KINTARO_PAGE_URL="https://kintarou.r-reco.jp/Lysithea/JSP_Files/authentication/WC010_SSO.jsp";

test('kintaro_check', async () => {
  // Chromiumブラウザをカスタム設定で起動
  const context = await chromium.launchPersistentContext('', {
    headless: false, // ヘッドレスモードを無効化
    args: [
      `--disable-extensions-except=${path.resolve(process.env.PATH_EXTENSION || "")}`, // 他の拡張機能を無効化
      `--load-extension=${path.resolve(process.env.PATH_EXTENSION || "")}` // 対象拡張機能をロード
    ]
  });

  // 新しいページを作成
  const page = await context.newPage();

  // =====================
  // 勤太郎
  // =====================
  // ログイン
  // 1. Open the login page
  await page.goto(KINTARO_PAGE_URL || "");

  // 2. Enter the email address
  const emailInput = page.locator("input[type=email]");
  await emailInput.click();
  await emailInput.fill(process.env.M365_USERNAME || "");

  // 3. Click on the "Next" button
  await page.getByRole("button", { name: "Next" }).click();

  // 4. Enter the password
  const passwordInput = page.locator("input[type=password]");
  await passwordInput.click();
  await passwordInput.fill(process.env.M365_PASSWORD || "");

  // 5. Click on the "Sign in" button
  await page.locator("input[type=submit]").click();

  // 6. Check if the account has the Microsoft Authenticator app configured
  const otherWayLink = page.locator("a#signInAnotherWay");
  await otherWayLink.waitFor({ timeout: 5000 });
  if (await otherWayLink.isVisible()) {
    // Select the TOTP option
    await otherWayLink.click();

    const otpLink = page.locator(`div[data-value="PhoneAppOTP"]`);
    await otpLink.click();
  }

  // 7. Enter the TOTP code
  const otpInput = await page.waitForSelector("input#idTxtBx_SAOTCC_OTC");
  let totp = new OTPAuth.TOTP({
    issuer: "Microsoft",
    label: process.env.M365_USERNAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: process.env.M365_OTP_SECRET,
  });
  const code = totp.generate();
  await otpInput.fill(code);

  // 8. Click on the "Next" button
  await page.locator("input[type=submit]").click();
  await page.getByRole('button', { name: 'Yes' }).click();

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

  await page.getByRole('link', { name: '承認状況一覧' }).click();
  const year = await page.locator('.mod-monthly-control .date span:nth-child(1)').textContent();
  const month = await page.locator('.mod-monthly-control .date span:nth-child(3)').textContent();
  const pageYM = `${year}/${month}`;
  if (pageYM !== currentYM) {
    console.log('先月分表示...');
    await page.locator('.nav-next').nth(1).click();
  } else {
    console.log('今月分表示');
  }
  await page.waitForTimeout(500);

  // =====================
  // 拡張機能
  // =====================
  // オプションページのURLを開く
  const optionsPageUrl = `chrome-extension://${process.env.EXTENSION_ID}/options.html`; // 拡張機能のオプションページURL
  await page.goto(optionsPageUrl);
  // csv各種読み込み
  const fileInputC = page.locator('input[type="file"]#fileInputChannel');
  await fileInputC.setInputFiles(path.join('./settings', 'channel_settings.csv'));
  const fileInputM = page.locator('input[type="file"]#fileInputMention');
  await fileInputM.setInputFiles(path.join('./settings', 'mention_settings.csv'));
  const fileInputK = page.locator('input[type="file"]#fileInputKairi');
  await fileInputK.setInputFiles(path.join('./settings', download.suggestedFilename()));

  // 拡張機能起動
  const popupPageUrl = `chrome-extension://${process.env.EXTENSION_ID}/popup.html`;
  await page.goto(popupPageUrl);
  await page.waitForTimeout(5000);
});
