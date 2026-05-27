import "dotenv/config";
import fs from "node:fs/promises";

const LINE_JSON_PATH = "output/social-radar-line.json";
const TELEGRAM_API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 3500;

type LinePayload = {
  title?: string;
  generatedAt?: string;
  runId?: string | null;
  topics?: string[];
  strongestTopic?: {
    name?: string;
    score?: number;
    postCount?: number;
  } | null;
  strongestKeyword?: {
    keyword?: string;
    score?: number;
    highScorePostCount?: number;
  } | null;
  topPosts?: Array<{
    rank?: number;
    author?: string;
    summary?: string;
    hotScore?: number | null;
    qualityScore?: number | null;
    lineScore?: number | null;
    url?: string | null;
  }>;
  contentIdeas?: string[];
  sourceStatus?: {
    runId?: string | null;
    sourceMode?: string;
    inputFile?: string;
    totalPosts?: number;
    preset?: string | null;
    keywords?: string[];
    collectiblePosts?: number;
    isFallback?: boolean;
  };
};

async function main() {
  await assertReadableFile(LINE_JSON_PATH);
  printEnvStatus();

  const missingEnv = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    throw new Error(`缺少環境變數：${missingEnv.join(", ")}`);
  }

  const payload = JSON.parse(await fs.readFile(LINE_JSON_PATH, "utf8")) as LinePayload;
  const text = truncateMessage(formatTelegramMessage(payload), MAX_MESSAGE_LENGTH);
  const response = await sendTelegramMessage({
    botToken: process.env.TELEGRAM_BOT_TOKEN as string,
    chatId: process.env.TELEGRAM_CHAT_ID as string,
    text
  });

  if (response.ok !== true) {
    console.error(`[send-telegram] Telegram API failed: error_code=${response.error_code ?? "unknown"} description=${response.description ?? "unknown"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[send-telegram] Sent Telegram message to chat ${maskChatId(process.env.TELEGRAM_CHAT_ID as string)}`);
}

function printEnvStatus() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  console.log(`[send-telegram] TELEGRAM_BOT_TOKEN: ${token ? `found (${token.slice(0, 6)}...)` : "missing"}`);
  console.log(`[send-telegram] TELEGRAM_CHAT_ID: ${chatId ? "found" : "missing"}`);
}

async function assertReadableFile(path: string) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`找不到 ${path}，請先執行 npm run analyze 或 npm run radar:hybrid:x。`);
  }
}

function formatTelegramMessage(payload: LinePayload) {
  const lines: string[] = [];
  const topics = payload.topics?.length ? payload.topics.join("、") : "資料不足";
  const topPosts = payload.topPosts ?? [];
  const contentIdeas = payload.contentIdeas ?? [];
  const sourceStatus = payload.sourceStatus ?? {};

  lines.push(payload.title ?? "Social AI Radar 今日快報");
  lines.push("");
  lines.push(`runId：${payload.runId ?? sourceStatus.runId ?? "none"}`);
  lines.push(`今日主題：${topics}`);
  lines.push(`今日最強 topic：${formatStrongestTopic(payload.strongestTopic)}`);
  lines.push(`今日最強 keyword：${formatStrongestKeyword(payload.strongestKeyword)}`);
  lines.push("");
  lines.push("TOP 5");

  if (topPosts.length === 0) {
    lines.push("1. 資料不足，請重新擷取。");
  } else {
    for (const post of topPosts.slice(0, 5)) {
      const rank = post.rank ?? topPosts.indexOf(post) + 1;
      const author = post.author ?? "unknown";
      const hotScore = formatScore(post.hotScore);
      const qualityScore = formatScore(post.qualityScore);
      const lineScore = formatScore(post.lineScore);
      lines.push(`${rank}. ${author}｜hot ${hotScore}｜Q ${qualityScore}｜line ${lineScore}`);
      lines.push(`   ${compact(post.summary, 140)}`);
      if (post.url) lines.push(`   ${post.url}`);
    }
  }

  lines.push("");
  lines.push("內容靈感");
  if (contentIdeas.length === 0) {
    lines.push("1. 暫無內容靈感。");
  } else {
    contentIdeas.slice(0, 3).forEach((idea, index) => {
      lines.push(`${index + 1}. ${compact(idea, 120)}`);
    });
  }

  lines.push("");
  lines.push("資料狀態");
  lines.push(`generatedAt: ${payload.generatedAt ?? "unknown"}`);
  lines.push(`runId: ${payload.runId ?? sourceStatus.runId ?? "none"}`);
  lines.push(`sourceMode: ${sourceStatus.sourceMode ?? "unknown"}`);
  lines.push(`inputFile: ${sourceStatus.inputFile ?? LINE_JSON_PATH}`);
  lines.push(`preset: ${sourceStatus.preset ?? "none"}`);
  lines.push(`keywords: ${sourceStatus.keywords?.join(", ") ?? "none"}`);
  lines.push(`totalPosts: ${sourceStatus.totalPosts ?? 0}`);
  lines.push(`collectiblePosts: ${sourceStatus.collectiblePosts ?? 0}`);
  lines.push(`isFallback: ${sourceStatus.isFallback ?? false}`);

  return lines.join("\n");
}

async function sendTelegramMessage(options: { botToken: string; chatId: string; text: string }) {
  const url = `${TELEGRAM_API_BASE}/bot${options.botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: options.chatId,
      text: options.text,
      disable_web_page_preview: true
    })
  });

  return await response.json() as {
    ok?: boolean;
    error_code?: number;
    description?: string;
  };
}

function truncateMessage(text: string, maxLength: number) {
  if ([...text].length <= maxLength) return text;
  return `${[...text].slice(0, maxLength - 20).join("")}\n...(已截斷)`;
}

function compact(value: unknown, maxLength: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if ([...text].length <= maxLength) return text;
  return `${[...text].slice(0, maxLength - 1).join("")}…`;
}

function formatScore(value: number | null | undefined) {
  return value == null ? "null" : value;
}

function formatStrongestTopic(topic: LinePayload["strongestTopic"]) {
  if (!topic?.name) return "資料不足";
  return `${topic.name}${topic.score == null ? "" : `（score ${topic.score}）`}`;
}

function formatStrongestKeyword(keyword: LinePayload["strongestKeyword"]) {
  if (!keyword?.keyword) return "資料不足";
  const highScoreText = keyword.highScorePostCount == null ? "" : `，高分 ${keyword.highScorePostCount} 篇`;
  return `${keyword.keyword}${keyword.score == null ? "" : `（score ${keyword.score}${highScoreText}）`}`;
}

function maskChatId(value: string) {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

main().catch((error) => {
  console.error("[send-telegram] Failed:", error.message);
  process.exitCode = 1;
});
