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

export type DeviationData = {
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
