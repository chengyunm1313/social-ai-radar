import fs from "node:fs/promises";

const INPUT_PATH = "input/manual-x.txt";
const OUTPUT_PATH = "input/x-ai-agent-raw.json";
const KEYWORD = "AI Agent";

async function main() {
  await fs.mkdir("input", { recursive: true });

  const manualText = await fs.readFile(INPUT_PATH, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      throw new Error(
        [
          `找不到 ${INPUT_PATH}。`,
          "請先用 Computer Use 在已登入的 Chrome X 搜尋頁複製可見頁面文字，存成 input/manual-x.txt。",
          "限制：不按讚、不留言、不轉貼、不追蹤、不讀私人訊息。"
        ].join("\n")
      );
    }
    throw error;
  });

  const capturedAt = new Date().toISOString();
  const posts = splitCandidatePosts(manualText).map((block, index) => {
    const postText = cleanPostText(block);
    return {
      index: index + 1,
      platform: "x",
      keyword: KEYWORD,
      post_text: postText,
      text: postText,
      url: extractUrl(block),
      captured_at: capturedAt,
      source_method: "computer_use_manual_text_import",
      metrics: parseMetrics(block),
      author_handle: extractHandle(block),
      publish_time: extractPublishTime(block)
    };
  });

  const payload = {
    schema_version: "0.4",
    collection_mode: "hybrid_computer_use_manual_text",
    platform: "x",
    keyword: KEYWORD,
    captured_at: capturedAt,
    source_input: INPUT_PATH,
    rules: [
      "使用平常 Chrome 登入 X",
      "Codex 使用 Computer Use 操作 Chrome",
      "只讀取公開可見內容",
      "不按讚",
      "不留言",
      "不轉貼",
      "不追蹤",
      "不讀私人訊息",
      "不修改帳號設定"
    ],
    posts
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[import-manual-x] Read ${manualText.length} chars from ${INPUT_PATH}`);
  console.log(`[import-manual-x] Wrote ${posts.length} posts to ${OUTPUT_PATH}`);
}

function splitCandidatePosts(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lineBlocks = splitByXAuthorRows(lines);
  if (lineBlocks.length > 0) {
    return dedupe(
      lineBlocks
        .map((block) => block.trim())
        .filter((block) => looksLikeRelevantPost(block))
    );
  }

  const rawBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const blocks = [];
  let current = [];

  for (const rawBlock of rawBlocks) {
    const startsLikePost = /@[A-Za-z0-9_]{2,}/.test(rawBlock) || /已認證的帳戶/.test(rawBlock);
    const hasStatusUrl = /x\.com\/[^/\s]+\/status\/\d+/.test(rawBlock);

    if ((startsLikePost || hasStatusUrl) && current.length > 0) {
      blocks.push(current.join("\n\n"));
      current = [];
    }

    current.push(rawBlock);

    if (current.join("\n").length > 1800) {
      blocks.push(current.join("\n\n"));
      current = [];
    }
  }

  if (current.length > 0) blocks.push(current.join("\n\n"));

  const candidates = blocks
    .map((block) => block.trim())
    .filter((block) => looksLikeRelevantPost(block));

  return dedupe(candidates);
}

function splitByXAuthorRows(lines) {
  const starts = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!isHandleLine(lines[index])) continue;
    if (!looksLikeXTimestamp(lines[index + 2]) && lines[index + 1] !== "·") continue;

    const authorIndex = findAuthorLine(lines, index);
    if (authorIndex === null) continue;
    starts.push(authorIndex);
  }

  const blocks = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1] ?? lines.length;
    const blockLines = trimRightRail(lines.slice(start, end))
      .filter((line) => !isUiNoiseLine(line));
    const block = blockLines.join("\n").trim();
    if (block) blocks.push(block);
  }

  return blocks;
}

function findAuthorLine(lines, handleIndex) {
  for (let index = handleIndex - 1; index >= Math.max(0, handleIndex - 4); index -= 1) {
    if (isUiNoiseLine(lines[index])) continue;
    if (isHandleLine(lines[index])) continue;
    if (lines[index] === "·") continue;
    return index;
  }
  return null;
}

function isHandleLine(line) {
  return /^@[A-Za-z0-9_]{2,}$/.test(line);
}

function looksLikeXTimestamp(line = "") {
  return /^(\d+\s*(?:秒|分鐘|小時)|\d+月\d+日|\d{4}年\d+月\d+日)$/.test(line);
}

function isUiNoiseLine(line) {
  return /^(若要查看鍵盤快速鍵，請按問號|查看鍵盤快速鍵|首頁|探索|通知|聊天|Grok|書籤|創作者工作室|Premium|個人資料|更多|發佈|熱門|最新|人物|媒體|列表|查看新貼文|搜尋時間軸|搜尋篩選|來自任何人|你跟隨的人|位置|任何地方|在你附近|進階搜尋|流行趨勢|有什麼新鮮事|台灣 的流行趨勢|商業・金融 · 流行趨勢|跟隨誰|跟隨|顯示更多|引用|參考資料|Machine Learning- Data Science|機器學習-資料科學|服務條款|隱私政策|Cookie 使用政策|協助工具|廣告資訊|© 2026 X Corp\.|長文翻譯前後不一致？|試用 AI 精翻，結合已讀語境，譯文更連貫。|本次免費試用)$/.test(line);
}

function trimRightRail(lines) {
  const stopIndex = lines.findIndex((line) =>
    /^(搜尋篩選|流行趨勢|有什麼新鮮事|跟隨誰|服務條款)$/.test(line)
  );
  return stopIndex >= 0 ? lines.slice(0, stopIndex) : lines;
}

function looksLikeRelevantPost(block) {
  if (block.length < 30) return false;
  if (/服務條款|隱私政策|Cookie 使用|搜尋篩選|跟隨誰|流行趨勢|有什麼新鮮事/.test(block)) return false;
  return /AI Agent|agent|Agent|人工智慧|智能體|Claude|Codex|Cursor|MCP/i.test(block);
}

function dedupe(blocks) {
  const seen = new Set();
  const result = [];

  for (const block of blocks) {
    const key = extractUrl(block) ?? block.replace(/\s+/g, " ").slice(0, 220);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(block);
  }

  return result;
}

function cleanPostText(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^顯示更多$/.test(line))
    .join("\n")
    .slice(0, 3000);
}

function extractUrl(block) {
  const statusPath = block.match(/(?:https?:\/\/)?x\.com\/[^/\s]+\/status\/\d+/i)?.[0];
  if (statusPath) return statusPath.startsWith("http") ? statusPath : `https://${statusPath}`;
  return block.match(/https?:\/\/\S+/)?.[0] ?? null;
}

function extractHandle(block) {
  const handle = block.match(/@([A-Za-z0-9_]{2,})/)?.[1];
  return handle ? `@${handle}` : null;
}

function extractPublishTime(block) {
  return block.match(/(\d+\s*(?:秒|分鐘|小時)(?:前)?|\d+月\d+日|\d{4}年\d+月\d+日)/)?.[1] ?? null;
}

function parseMetrics(block) {
  return {
    replies: metricBefore(block, /則回覆|repl(?:y|ies)/i),
    reposts: metricBefore(block, /次轉發|reposts?/i),
    likes: metricBefore(block, /個喜歡|likes?/i),
    bookmarks: metricBefore(block, /個書籤|bookmarks?/i),
    views: metricBefore(block, /次觀看|views?/i)
  };
}

function metricBefore(text, labelPattern) {
  const normalized = text.replace(/,/g, "");
  const regex = new RegExp(`([0-9]+(?:\\.[0-9]+)?\\s*(?:萬|K|M)?)\\s*(?:${labelPattern.source})`, "i");
  const match = normalized.match(regex);
  return match ? parseCount(match[1]) : null;
}

function parseCount(value) {
  const raw = String(value).trim();
  const number = Number.parseFloat(raw);
  if (Number.isNaN(number)) return null;
  if (raw.includes("萬")) return Math.round(number * 10000);
  if (/K/i.test(raw)) return Math.round(number * 1000);
  if (/M/i.test(raw)) return Math.round(number * 1_000_000);
  return Math.round(number);
}

main().catch((error) => {
  console.error("[import-manual-x] Failed:", error.message);
  process.exitCode = 1;
});
