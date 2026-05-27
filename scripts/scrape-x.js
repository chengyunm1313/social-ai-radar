import fs from "node:fs/promises";
import { chromium } from "playwright";

const SEARCH_URL = "https://x.com/search?q=AI%20Agent&src=typed_query&f=top";
const OUTPUT_PATH = "input/x-ai-agent-raw.json";
const DEBUG_HTML_PATH = "output/debug-x-page.html";
const DEBUG_SCREENSHOT_PATH = "output/debug-x-screenshot.png";
const DEBUG_TEXT_PATH = "output/debug-x-text.txt";
const BROWSER_MODE = process.env.SOCIAL_RADAR_BROWSER_MODE ?? "cdp";
const CDP_URL = process.env.SOCIAL_RADAR_CDP_URL ?? "http://127.0.0.1:9222";
const USER_DATA_DIR = process.env.SOCIAL_RADAR_USER_DATA_DIR ?? ".playwright/x-chrome-profile";
const BROWSER_CHANNEL = process.env.SOCIAL_RADAR_BROWSER_CHANNEL ?? "chrome";
const WAIT_MS = Number(process.env.SOCIAL_RADAR_WAIT_MS ?? 60_000);
const SCROLL_TIMES = Number(process.env.SOCIAL_RADAR_SCROLL_TIMES ?? 5);
const SCROLL_DELAY_MS = Number(process.env.SOCIAL_RADAR_SCROLL_DELAY_MS ?? 2_000);

const RULES = [
  "只讀取公開可見貼文",
  "允許使用者手動登入或調整頁面",
  "不自動登入",
  "不繞過平台限制",
  "不按讚",
  "不留言",
  "不轉貼",
  "不追蹤",
  "不讀私人訊息",
  "不修改帳號設定"
];

async function main() {
  await fs.mkdir("input", { recursive: true });
  await fs.mkdir("output", { recursive: true });

  const browserSession = await openBrowserSession();
  const { page } = browserSession;
  const capturedAt = new Date().toISOString();
  const seen = new Set();
  const posts = [];

  console.log(`[scrape-x] Opening ${SEARCH_URL}`);
  console.log(`[scrape-x] Browser mode: ${BROWSER_MODE}`);
  if (BROWSER_MODE === "cdp") console.log(`[scrape-x] CDP endpoint: ${CDP_URL}`);
  if (BROWSER_MODE !== "cdp") {
    console.log(`[scrape-x] Browser channel: ${BROWSER_CHANNEL}`);
    console.log(`[scrape-x] Persistent profile: ${USER_DATA_DIR}`);
  }
  console.log("[scrape-x] Read-only rules:");
  for (const rule of RULES) console.log(`- ${rule}`);

  if (!page.url().includes("/search")) {
    await page.goto(SEARCH_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
  }

  console.log(`[scrape-x] Waiting ${Math.round(WAIT_MS / 1000)} seconds for manual login or page adjustment...`);
  await page.waitForTimeout(WAIT_MS);

  await collectFromPage(page, posts, seen);

  for (let i = 1; i <= SCROLL_TIMES; i += 1) {
    console.log(`[scrape-x] Scrolling ${i}/${SCROLL_TIMES}`);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(SCROLL_DELAY_MS);
    await collectFromPage(page, posts, seen);
  }

  const debug = await writeDebugArtifacts(page);
  console.log(`[scrape-x] page.url(): ${debug.url}`);
  console.log(`[scrape-x] document.title: ${debug.title}`);
  console.log(`[scrape-x] article count: ${debug.articleCount}`);
  console.log(`[scrape-x] body text length: ${debug.bodyText.length}`);
  console.log(`[scrape-x] first 1000 chars of body text:\n${debug.bodyText.slice(0, 1000)}`);

  if (posts.length === 0 && debug.bodyText.trim()) {
    console.log("[scrape-x] No structured tweets found. Falling back to body text blocks.");
    collectFromBodyText(debug.bodyText, posts, seen);
  }

  const payload = {
    schema_version: "0.3",
    collection_mode: "phase3_playwright_manual_read_only",
    platform: "x",
    query: "AI Agent",
    url: SEARCH_URL,
    captured_at: capturedAt,
    rules: RULES,
    limits: {
      wait_ms: WAIT_MS,
      scroll_times: SCROLL_TIMES,
      scroll_delay_ms: SCROLL_DELAY_MS
    },
    posts
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[scrape-x] Saved ${posts.length} posts to ${OUTPUT_PATH}`);

  await closeBrowserSession(browserSession);
}

async function openBrowserSession() {
  if (BROWSER_MODE === "cdp") {
    let browser;
    try {
      browser = await chromium.connectOverCDP(CDP_URL);
    } catch (error) {
      throw new Error(
        [
          `無法連到真實 Chrome remote debugging session：${CDP_URL}`,
          "請先用以下指令啟動一個可被 Playwright 連線的 Chrome：",
          '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222',
          "然後在該 Chrome 視窗手動登入 X，再重新執行 npm run radar:x。",
          `原始錯誤：${error.message}`
        ].join("\n")
      );
    }

    const context = browser.contexts()[0];
    if (!context) throw new Error("CDP 已連線，但找不到 Chrome browser context。");

    const pages = context.pages();
    const existingSearchPage = pages.find((candidate) => candidate.url().includes("x.com/search"));
    const existingXPage = pages.find((candidate) => candidate.url().includes("x.com/"));
    const page = existingSearchPage ?? existingXPage ?? await context.newPage();

    return {
      mode: "cdp",
      browser,
      context,
      page
    };
  }

  await fs.mkdir(".playwright", { recursive: true });
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: BROWSER_CHANNEL,
    headless: false,
    viewport: { width: 1440, height: 1200 },
    locale: "zh-TW"
  });

  return {
    mode: "persistent",
    context,
    page: await context.newPage()
  };
}

async function closeBrowserSession(session) {
  if (session.mode === "cdp") {
    console.log("[scrape-x] Leaving the real Chrome session open.");
    // Avoid browser.close() here because the CDP target is the user's real Chrome.
    setTimeout(() => process.exit(0), 50);
    return;
  }

  await session.context.close();
}

async function collectFromPage(page, posts, seen) {
  const strategies = [
    {
      name: 'article[data-testid="tweet"]',
      locator: page.locator('article[data-testid="tweet"]')
    },
    {
      name: '[data-testid="cellInnerDiv"]',
      locator: page.locator('[data-testid="cellInnerDiv"]')
    },
    {
      name: "article",
      locator: page.locator("article")
    }
  ];

  for (const strategy of strategies) {
    const elements = await strategy.locator.all();
    console.log(`[scrape-x] ${strategy.name} count: ${elements.length}`);

    for (const element of elements) {
      const text = await element.innerText().catch(() => "");
      if (!looksLikePostText(text)) continue;

      const url = await element
        .locator('a[href*="/status/"]')
        .evaluateAll((links) => links.map((link) => link.href).find(Boolean))
        .catch(() => null);

      addPost({
        posts,
        seen,
        text,
        url,
        sourceMethod: strategy.name
      });
    }
  }
}

async function writeDebugArtifacts(page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const html = await page.content();
  const url = page.url();
  const title = await page.title().catch(() => "");
  const articleCount = await page.locator("article").count().catch(() => 0);

  await fs.writeFile(DEBUG_HTML_PATH, html);
  await fs.writeFile(DEBUG_TEXT_PATH, bodyText);
  await page.screenshot({
    path: DEBUG_SCREENSHOT_PATH,
    fullPage: true
  });

  return {
    url,
    title,
    articleCount,
    bodyText
  };
}

function collectFromBodyText(bodyText, posts, seen) {
  const blocks = splitCandidateBlocks(bodyText);
  console.log(`[scrape-x] body text candidate block count: ${blocks.length}`);

  for (const block of blocks) {
    if (!looksLikePostText(block)) continue;
    addPost({
      posts,
      seen,
      text: block,
      url: firstMatch(block, /(https?:\/\/\S+)/),
      sourceMethod: "document.body.innerText fallback"
    });
  }
}

function splitCandidateBlocks(bodyText) {
  const lines = bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let current = [];

  for (const line of lines) {
    const startsNewPost = /^@?[A-Za-z0-9_]{2,}$/.test(line) || /已認證的帳戶/.test(line);
    if (startsNewPost && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
    if (current.length >= 18) {
      blocks.push(current.join("\n"));
      current = [];
    }
  }

  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks.filter((block) => /AI Agent|agent|Agent|人工智慧|智能體/i.test(block));
}

function addPost({ posts, seen, text, url, sourceMethod }) {
  const cleanedText = text.trim();
  const key = url || cleanedText.slice(0, 220);
  if (!cleanedText || seen.has(key)) return;
  seen.add(key);

  const metrics = parseMetrics(cleanedText);
  const authorHandle = firstMatch(cleanedText, /@([A-Za-z0-9_]+)/);
  const publishTime = firstMatch(cleanedText, /(\d+\s*(?:秒|分鐘|小時)前|\d+月\d+日|\d{4}年\d+月\d+日)/);

  posts.push({
    index: posts.length + 1,
    platform: "x",
    keyword: "AI Agent",
    author: parseAuthor(cleanedText),
    author_handle: authorHandle ? `@${authorHandle}` : null,
    publish_time: publishTime,
    post_text: cleanedText,
    text: cleanedText,
    url,
    captured_at: new Date().toISOString(),
    source_method: sourceMethod,
    metrics
  });
}

function looksLikePostText(text) {
  const cleaned = String(text ?? "").trim();
  if (cleaned.length < 20) return false;
  if (!/AI Agent|agent|Agent|人工智慧|智能體/i.test(cleaned)) return false;
  if (/搜尋篩選|跟隨誰|流行趨勢|服務條款|隱私政策/.test(cleaned)) return false;
  return true;
}

function parseMetrics(text) {
  return {
    replies: metricBefore(text, /則回覆|repl(?:y|ies)/i),
    reposts: metricBefore(text, /次轉發|reposts?/i),
    likes: metricBefore(text, /個喜歡|likes?/i),
    bookmarks: metricBefore(text, /個書籤|bookmarks?/i),
    views: metricBefore(text, /次觀看|views?/i)
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

function parseAuthor(text) {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return null;
  return firstLine.replace(/已認證的帳戶.*$/, "").replace(/@.*$/, "").trim() || null;
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : null;
}

main().catch((error) => {
  console.error("[scrape-x] Failed:", error);
  process.exitCode = 1;
});
