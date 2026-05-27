import fs from "node:fs/promises";
import crypto from "node:crypto";
import { chromium } from "playwright";

const DEFAULT_KEYWORD = process.env.SOCIAL_RADAR_QUERY ?? "AI Agent";
const OUTPUT_PATH = "input/x-ai-agent-raw.json";
const TOPIC_PRESETS_PATH = "config/topic-presets.json";
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
const POSTS_PER_KEYWORD = Number(process.env.SOCIAL_RADAR_POSTS_PER_KEYWORD ?? 10);
const SEARCH_TAB = process.env.X_SEARCH_TAB ?? "top";

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

  const searchPlan = await buildSearchPlan();
  const browserSession = await openBrowserSession();
  const { page } = browserSession;
  const capturedAt = new Date().toISOString();
  const seen = {
    urls: new Set(),
    textHashes: new Set()
  };
  const posts = [];

  console.log(`[scrape-x] Search mode: ${searchPlan.preset ? `preset:${searchPlan.preset}` : "single keyword"}`);
  console.log(`[scrape-x] Keywords: ${searchPlan.keywords.join(", ")}`);
  console.log(`[scrape-x] Browser mode: ${BROWSER_MODE}`);
  if (BROWSER_MODE === "cdp") console.log(`[scrape-x] CDP endpoint: ${CDP_URL}`);
  if (BROWSER_MODE !== "cdp") {
    console.log(`[scrape-x] Browser channel: ${BROWSER_CHANNEL}`);
    console.log(`[scrape-x] Persistent profile: ${USER_DATA_DIR}`);
  }
  console.log("[scrape-x] Read-only rules:");
  for (const rule of RULES) console.log(`- ${rule}`);

  for (const [keywordIndex, keyword] of searchPlan.keywords.entries()) {
    const searchUrl = buildSearchUrl(keyword);
    const beforeCount = posts.length;

    console.log(`[scrape-x] Opening ${searchUrl}`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });

    if (keywordIndex === 0) {
      console.log(`[scrape-x] Waiting ${Math.round(WAIT_MS / 1000)} seconds for manual login or page adjustment...`);
      await page.waitForTimeout(WAIT_MS);
    } else {
      await page.waitForTimeout(SCROLL_DELAY_MS);
    }

    await collectFromPage(page, posts, seen, keyword, POSTS_PER_KEYWORD);

    for (let i = 1; i <= SCROLL_TIMES && countKeywordPosts(posts, keyword) < POSTS_PER_KEYWORD; i += 1) {
      console.log(`[scrape-x] ${keyword}: scrolling ${i}/${SCROLL_TIMES}`);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(SCROLL_DELAY_MS);
      await collectFromPage(page, posts, seen, keyword, POSTS_PER_KEYWORD);
    }

    console.log(`[scrape-x] ${keyword}: saved ${posts.length - beforeCount} new posts (${countKeywordPosts(posts, keyword)} total for keyword)`);
  }

  const debug = await writeDebugArtifacts(page);
  console.log(`[scrape-x] page.url(): ${debug.url}`);
  console.log(`[scrape-x] document.title: ${debug.title}`);
  console.log(`[scrape-x] article count: ${debug.articleCount}`);
  console.log(`[scrape-x] body text length: ${debug.bodyText.length}`);
  console.log(`[scrape-x] first 1000 chars of body text:\n${debug.bodyText.slice(0, 1000)}`);

  if (posts.length === 0 && debug.bodyText.trim()) {
    console.log("[scrape-x] No structured tweets found. Falling back to body text blocks.");
    collectFromBodyText(debug.bodyText, posts, seen, searchPlan.keywords[0], POSTS_PER_KEYWORD);
  }

  const payload = {
    schema_version: "0.5",
    collection_mode: "phase3_playwright_manual_read_only",
    search_mode: searchPlan.preset ? "preset" : "single_keyword",
    preset: searchPlan.preset,
    platform: "x",
    query: searchPlan.keywords.length === 1 ? searchPlan.keywords[0] : searchPlan.keywords,
    keywords: searchPlan.keywords,
    url: buildSearchUrl(searchPlan.keywords[0]),
    captured_at: capturedAt,
    rules: RULES,
    limits: {
      wait_ms: WAIT_MS,
      scroll_times: SCROLL_TIMES,
      scroll_delay_ms: SCROLL_DELAY_MS,
      posts_per_keyword: POSTS_PER_KEYWORD
    },
    posts
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[scrape-x] Saved ${posts.length} posts to ${OUTPUT_PATH}`);

  await closeBrowserSession(browserSession);
}

async function buildSearchPlan() {
  const preset = getCliOption("preset") ?? process.env.SOCIAL_RADAR_PRESET ?? process.env.npm_config_preset ?? null;
  if (!preset) {
    return {
      preset: null,
      keywords: [getCliOption("keyword") ?? DEFAULT_KEYWORD]
    };
  }

  const presets = JSON.parse(await fs.readFile(TOPIC_PRESETS_PATH, "utf8"));
  const keywords = presets[preset];
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error(`找不到 topic preset：${preset}。請檢查 ${TOPIC_PRESETS_PATH}`);
  }

  return {
    preset,
    keywords
  };
}

function getCliOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function buildSearchUrl(keyword) {
  return `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=${encodeURIComponent(SEARCH_TAB)}`;
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
          "Chrome 若已經在執行，macOS 可能只會打開既有工作階段，不會套用 --remote-debugging-port。",
          "做法 A：完全關閉 Chrome 後，再用以下指令啟動：",
          '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222',
          "做法 B：保留原本 Chrome，另外開一個獨立 debug profile：",
          'open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.social-ai-radar/chrome-debug"',
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

async function collectFromPage(page, posts, seen, keyword, maxPostsForKeyword) {
  if (countKeywordPosts(posts, keyword) >= maxPostsForKeyword) return;

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
      if (countKeywordPosts(posts, keyword) >= maxPostsForKeyword) return;

      const text = await element.innerText().catch(() => "");
      if (!looksLikePostText(text, keyword)) continue;

      const url = await element
        .locator('a[href*="/status/"]')
        .evaluateAll((links) => links.map((link) => link.href).find(Boolean))
        .catch(() => null);

      addPost({
        posts,
        seen,
        keyword,
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

function collectFromBodyText(bodyText, posts, seen, keyword, maxPostsForKeyword) {
  const blocks = splitCandidateBlocks(bodyText);
  console.log(`[scrape-x] body text candidate block count: ${blocks.length}`);

  for (const block of blocks) {
    if (countKeywordPosts(posts, keyword) >= maxPostsForKeyword) return;
    if (!looksLikePostText(block, keyword)) continue;
    addPost({
      posts,
      seen,
      keyword,
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
  return blocks;
}

function addPost({ posts, seen, keyword, text, url, sourceMethod }) {
  const cleanedText = text.trim();
  const textHash = hashText(cleanedText);
  if (!cleanedText) return;
  if (url && seen.urls.has(url)) return;
  if (seen.textHashes.has(textHash)) return;
  if (url) seen.urls.add(url);
  seen.textHashes.add(textHash);

  const engagement = parseEngagement(cleanedText);
  const authorHandle = firstMatch(cleanedText, /@([A-Za-z0-9_]+)/);
  const publishTime = firstMatch(cleanedText, /(\d+\s*(?:秒|分鐘|小時)前|\d+月\d+日|\d{4}年\d+月\d+日)/);

  posts.push({
    index: posts.length + 1,
    platform: "x",
    keyword,
    author: parseAuthor(cleanedText),
    author_handle: authorHandle ? `@${authorHandle}` : null,
    publish_time: publishTime,
    post_text: cleanedText,
    text: cleanedText,
    url,
    captured_at: new Date().toISOString(),
    source_method: sourceMethod,
    text_hash: textHash,
    metrics: engagement.metrics,
    engagementParseDebug: engagement.debug
  });
}

function looksLikePostText(text, keyword = DEFAULT_KEYWORD) {
  const cleaned = String(text ?? "").trim();
  if (cleaned.length < 20) return false;
  if (!matchesKeyword(cleaned, keyword) && !/AI|agent|Claude|Cursor|MCP|OpenAI|Gemini|SaaS|startup|automation|workflow|人工智慧|智能體/i.test(cleaned)) return false;
  if (/搜尋篩選|跟隨誰|流行趨勢|服務條款|隱私政策/.test(cleaned)) return false;
  return true;
}

function matchesKeyword(text, keyword) {
  return keyword
    .split(/\s+/)
    .filter(Boolean)
    .some((part) => new RegExp(escapeRegex(part), "i").test(text));
}

function countKeywordPosts(posts, keyword) {
  return posts.filter((post) => post.keyword === keyword).length;
}

function hashText(text) {
  return crypto
    .createHash("sha1")
    .update(String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase())
    .digest("hex");
}

function parseEngagement(text) {
  const labeled = parseLabeledMetrics(text);
  const tail = parseXMetricTail(text);
  const metrics = mergeMetrics(labeled.metrics, tail.metrics);

  return {
    metrics,
    debug: {
      before: emptyMetrics(),
      after: metrics,
      sourceMethods: [
        ...labeled.methods,
        ...tail.methods
      ],
      rawTail: String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-10).join("\n")
    }
  };
}

function parseLabeledMetrics(text) {
  const metrics = {
    replies: metricNearLabel(text, ["replies", "reply", "回覆", "則回覆"]),
    reposts: metricNearLabel(text, ["reposts", "repost", "retweets", "retweet", "轉貼", "轉發", "次轉發"]),
    likes: metricNearLabel(text, ["likes", "like", "喜歡", "個喜歡"]),
    bookmarks: metricNearLabel(text, ["bookmarks", "bookmark", "書籤", "收藏", "個書籤"]),
    views: metricNearLabel(text, ["views", "view", "觀看", "次觀看", "次瀏覽"])
  };

  return {
    metrics,
    methods: hasAnyMetric(metrics) ? ["labeled engagement text"] : []
  };
}

function metricNearLabel(text, labels) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const numberPattern = "([0-9][0-9,]*(?:\\.[0-9]+)?\\s*(?:萬|K|M)?)";
  const normalized = String(text ?? "");
  const beforeLabel = new RegExp(`${numberPattern}\\s*(?:${labelPattern})`, "i");
  const afterLabel = new RegExp(`(?:${labelPattern})\\s*${numberPattern}`, "i");
  const match = normalized.match(beforeLabel) ?? normalized.match(afterLabel);
  return match ? parseCount(match[1]) : null;
}

function parseXMetricTail(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const values = [];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!isMetricToken(line)) {
      if (values.length > 0) break;
      continue;
    }
    values.unshift(parseCount(line));
  }

  if (values.length < 4) {
    return {
      metrics: emptyMetrics(),
      methods: values.length > 0 ? [`x numeric tail ignored (${values.length} values)`] : []
    };
  }

  const [replies, reposts, likes, views] = values.slice(-4);
  return {
    metrics: {
      replies,
      reposts,
      likes,
      bookmarks: null,
      views
    },
    methods: ["x numeric tail"]
  };
}

function isMetricToken(value) {
  return /^[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:萬|K|M)?$/i.test(String(value ?? "").trim());
}

function mergeMetrics(primary = emptyMetrics(), fallback = emptyMetrics()) {
  return {
    replies: primary.replies ?? fallback.replies ?? null,
    reposts: primary.reposts ?? fallback.reposts ?? null,
    likes: primary.likes ?? fallback.likes ?? null,
    bookmarks: primary.bookmarks ?? fallback.bookmarks ?? null,
    views: primary.views ?? fallback.views ?? null
  };
}

function emptyMetrics() {
  return {
    replies: null,
    reposts: null,
    likes: null,
    bookmarks: null,
    views: null
  };
}

function hasAnyMetric(metrics) {
  return Object.values(metrics ?? {}).some((value) => value != null);
}

function parseCount(value) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  const number = Number.parseFloat(raw);
  if (Number.isNaN(number)) return null;
  if (raw.includes("萬")) return Math.round(number * 10000);
  if (/K/i.test(raw)) return Math.round(number * 1000);
  if (/M/i.test(raw)) return Math.round(number * 1_000_000);
  return Math.round(number);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
