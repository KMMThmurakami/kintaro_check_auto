import {CHANNEL_DATA_HEADER, MEMBER_DATA_HEADER, DEVIATION_DATA_HEADER} from "./csvHeader.ts";
import type { DeviationData } from "./types";

export const parseCsvToJson = (text: string, kind: string) => {
  const [headerRow, ...dataRows] = text
    .split("\n")
    .map((row) => row.split(","));
  const headers = headerRow.map((header) => header.trim());

  // ヘッダーチェック
  const validHeader: string[] = checkCsvKind(kind);

  const isValidFormat = validHeader.every((header) => headers.includes(header));
  if (!isValidFormat) {
    console.log(`${kind} : 不正な形式のファイルです`);
    return null;
  }

  const importData = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const rowData = row.map((cell) => cell.trim());
      return headers.reduce((acc, header, index) => {
        acc[header] = rowData[index] || "";
        return acc;
      }, {} as Record<string, string>);
    });

  if (kind === "channel") {
    const valid = importData
      .map((item) => item.channelId.trim())
      .filter((id, index, array) => array.indexOf(id) !== index);
    if (valid.length > 0) {
      console.log(`${kind} : 重複しているチャンネルIDがあります`);
      return;
    }
  }
  return importData;
};

const checkCsvKind = (kind: string) => {
  let validHeader: string[] = [];
  switch (kind) {
    case "channel":
      validHeader = CHANNEL_DATA_HEADER;
      break;
    case "member":
      validHeader = MEMBER_DATA_HEADER;
      break;
    case "work":
      validHeader = DEVIATION_DATA_HEADER;
      break;
    default:
      break;
  }
  return validHeader;
}

// 実働かい離データが存在するか判定
export const isDeviation = (data: any) => {
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
export const categorizeByName = (unapprovedData: any) => {
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
export const filterByDate = (data: any) => {
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
