type PostParts = {
  type: string;
  text: string;
};

// slack投稿テキスト
export type PostItem = {
  type: string;
  text: PostParts;
};

// 投稿チャンネル + slack投稿テキスト
export type SlackTextPayload = {
  channel: string | null;
  blocks: PostItem[];
};

// 勤怠状況DOM解析結果
export type CheckResult = {
  name: string;
  date: string[];
};

// csv チャンネル設定格納用
export type ChannelsData = {
  channelId: string;
  group: string;
};

// csv メンション設定格納用
export type MentionsData = {
  group: string;
  kintaroName: string;
  slackUserID: string;
};

// csv 勤怠データ（実績かい離分析）格納用
export type DeviationData = {
  [key: string]: string[];
};

