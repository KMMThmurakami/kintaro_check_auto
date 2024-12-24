import type {
  ChannelsData,
  MentionsData,
  DeviationData,
  SlackTextPayload,
  PostItem,
} from "./types";
import { current } from './currentDate';

export const postToSlack = async (
  postChannel: ChannelsData,
  settingsMember: MentionsData[],
  workData: DeviationData,
  checkResultString: string
) => {
  try {
    const result = await request(
      postChannel,
      settingsMember,
      workData,
      checkResultString
    ); // 非同期処理
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
const request = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  DeviationData: DeviationData,
  checkResultString: string
) => {
  const token: string | undefined = process.env.SLACK_BOT_TOKEN;
  console.log("channelId is :" + data.channelId);

  if (!token) {
    throw new Error(
      "Slackのユーザートークンが無効、もしくは設定されていません。"
    );
  }

  const postData = await getPostData(
    data,
    mentionSettings,
    DeviationData,
    checkResultString
  );
  return await fetchSlackApi(token, postData);
};

const getPostData = async (
  data: ChannelsData,
  mentionSettings: MentionsData[],
  DeviationData: DeviationData,
  planeText: string
): Promise<SlackTextPayload> => {
  let postText = "勤怠未入力のメンバーはいません！\n"; // 初期文字列

  const ym = current.getFullYear() + "年" + (current.getMonth() + 1) + "月";;
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
            `${mentionData?.kintaroName} さん <@${mentionData?.slackUserID}>`
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
