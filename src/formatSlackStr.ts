import type { CheckResult } from "./types";

// domから解析した情報をslack投稿用文字列にフォーマット
export const formatSlackStr = (checkResult: CheckResult[]): string => {
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
