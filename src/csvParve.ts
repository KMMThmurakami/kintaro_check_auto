import {CHANNEL_DATA_HEADER, MEMBER_DATA_HEADER, DEVIATION_DATA_HEADER} from "./constants.ts";

export const parseCsvToJson = (text: string, kind: string) => {
  const [headerRow, ...dataRows] = text
    .split("\n")
    .map((row) => row.split(","));
  const headers = headerRow.map((header) => header.trim());

  // ヘッダーチェック
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
