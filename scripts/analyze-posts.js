import fs from "node:fs/promises";

const INPUT_PATH = "input/x-ai-agent-raw.json";
const OUTPUT_PATH = "output/social-radar-report.md";

async function main() {
  await fs.mkdir("output", { recursive: true });

  const raw = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
  const posts = (raw.posts ?? [])
    .map((post) => analyzePost(post))
    .sort((a, b) => b.signal_score - a.signal_score);

  await fs.writeFile(OUTPUT_PATH, renderReport(raw, posts) + "\n");
  console.log(`[analyze-posts] Read ${posts.length} posts from ${INPUT_PATH}`);
  console.log(`[analyze-posts] Wrote ${OUTPUT_PATH}`);
}

function analyzePost(post) {
  const text = normalizeText(stripXMetadata(post.text));
  const metrics = normalizeMetrics(post.metrics);
  const hookTypes = classifyHook(text);
  const emotionTypes = classifyEmotion(text);
  const ctaType = classifyCta(text);
  const viralSignals = scoreSignals(metrics, text, hookTypes, emotionTypes);

  return {
    ...post,
    text,
    metrics,
    summary: summarize(text),
    hook_types: hookTypes,
    emotion_types: emotionTypes,
    cta_type: ctaType,
    viral_signals: viralSignals.labels,
    signal_score: viralSignals.score,
    viral_reason: inferViralReason(text, metrics, hookTypes, emotionTypes, viralSignals.labels),
    remix_angle: inferRemixAngle(text, hookTypes, ctaType)
  };
}

function stripXMetadata(value) {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let index = 0;

  if (lines[index + 1] && /^@[A-Za-z0-9_]{2,}$/.test(lines[index + 1])) {
    index += 2;
    if (lines[index] === "·") index += 1;
    if (/^(\d+\s*(?:秒|分鐘|小時)(?:前)?|\d+月\d+日|\d{4}年\d+月\d+日)$/.test(lines[index])) {
      index += 1;
    }
  }

  if (lines[index] === "回覆") {
    index += 1;
    if (/^@[A-Za-z0-9_]{2,}$/.test(lines[index])) index += 1;
  }

  return lines.slice(index).join("\n");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMetrics(metrics = {}) {
  return {
    replies: metrics.replies ?? 0,
    reposts: metrics.reposts ?? 0,
    likes: metrics.likes ?? 0,
    bookmarks: metrics.bookmarks ?? 0,
    views: metrics.views ?? 0
  };
}

function scoreSignals(metrics, text, hookTypes, emotionTypes) {
  const engagement = metrics.likes + metrics.reposts * 2 + metrics.replies * 1.5 + metrics.bookmarks * 1.25;
  const replyRate = metrics.views ? metrics.replies / metrics.views : 0;
  const repostRate = metrics.views ? metrics.reposts / metrics.views : 0;
  const engagementRate = metrics.views ? engagement / metrics.views : 0;
  const labels = [];
  let score = 0;

  if (replyRate >= 0.01) {
    labels.push("高留言率");
    score += 20;
  }
  if (repostRate >= 0.01) {
    labels.push("高轉發率");
    score += 18;
  }
  if (engagementRate >= 0.08) {
    labels.push("高互動率");
    score += 18;
  }
  if (metrics.replies >= 20) {
    labels.push("高留言量");
    score += 8;
  }
  if (metrics.bookmarks >= 10 && metrics.bookmarks >= metrics.likes * 0.5) {
    labels.push("高收藏意圖");
    score += 6;
  }
  if (hookTypes.length > 0) {
    labels.push("強 Hook");
    score += 14;
  }
  if (emotionTypes.length > 0) {
    labels.push("情緒強烈");
    score += emotionTypes.length >= 2 ? 10 : 6;
  }
  if (hasNovelOrControversialPoint(text)) {
    labels.push("爭議性或新觀點");
    score += 10;
  }
  if (hasHighInformationDensity(text)) {
    labels.push("高資訊密度");
    score += 8;
  }

  return {
    score,
    labels,
    engagement,
    reply_rate: replyRate,
    repost_rate: repostRate,
    engagement_rate: engagementRate
  };
}

function classifyHook(text) {
  const lower = text.toLowerCase();
  const types = [];

  if (/why|how|what|nobody|most people|most developers|你知道|為什麼|怎麼|大多數|沒人/.test(lower)) types.push("Curiosity");
  if (/mistake|but|vs|controvers|不是|其實|反而|爭議|打臉|錯/.test(lower)) types.push("Controversy");
  if (/broken|down|fail|risk|attack|behind|壞|失敗|風險|攻擊|落後|焦慮/.test(lower)) types.push("Fear");
  if (/\$|money|revenue|profit|portfolio|yield|hiring|salary|賺|錢|收益|投資|招聘|薪/.test(lower)) types.push("Money");
  if (/workflow|saved|replace|hours|build|deploy|tool|automation|效率|工作流|自動化|部署|工具|省/.test(lower)) types.push("Productivity");
  if (/replace|disappear|取代|消失|裁員|不需要人/.test(lower)) types.push("AI Replacement");
  if (/step|guide|tutorial|roadmap|from zero|how to|教學|步驟|路線|從零/.test(lower)) types.push("Step-by-step");
  if (/i tried|i built|my|我|親測|踩坑|經驗/.test(lower)) types.push("Personal Story");

  return [...new Set(types.length > 0 ? types : ["Curiosity"])];
}

function classifyEmotion(text) {
  const lower = text.toLowerCase();
  const emotions = [];

  if (/🔥|amazing|excited|launch|猛|強|酷|上線/.test(lower)) emotions.push("Excitement");
  if (/broken|down|fail|risk|attack|壞|失敗|風險|攻擊|焦慮/.test(lower)) emotions.push("Anxiety");
  if (/new|today|just|stars|trending|behind|剛|今天|爆|趨勢|落後/.test(lower)) emotions.push("FOMO");
  if (/learn|guide|tutorial|roadmap|學|教學|指南|路線|步驟/.test(lower)) emotions.push("Inspiration");
  if (/angry|wtf|ridiculous|怒|氣|荒謬/.test(lower)) emotions.push("Anger");
  if (/first|dropped|surprise|竟然|第一|首個|震撼|原來/.test(lower)) emotions.push("Surprise");

  return [...new Set(emotions.length > 0 ? emotions : ["FOMO"])];
}

function classifyCta(text) {
  const lower = text.toLowerCase();
  if (/comment|reply|留言|回覆|有人|anyone/.test(lower)) return "comment";
  if (/github|http|https|link|repo|下載|開源|連結/.test(lower)) return "click_link";
  if (/follow|追蹤/.test(lower)) return "follow";
  if (/star|bookmark|收藏/.test(lower)) return "save";
  if (/try|試用|試試|demo/.test(lower)) return "try";
  if (/hiring|apply|招聘|職缺|應徵/.test(lower)) return "apply";
  return "none";
}

function hasNovelOrControversialPoint(text) {
  return /mistake|not a readme|most developers|demo .* hard|first platform|control layer|不是|難的是|第一|控制層|其實|反而/i.test(text);
}

function hasHighInformationDensity(text) {
  return text.length > 220 || /1\\.|2\\.|3\\.|- |、|，.*，.*，/.test(text);
}

function summarize(text) {
  if (!text) return "無可分析文字。";
  return text.slice(0, 88) + (text.length > 88 ? "..." : "");
}

function inferViralReason(text, metrics, hookTypes, emotionTypes, signals) {
  const reasons = [];
  if (signals.includes("高留言率") || signals.includes("高留言量")) reasons.push("能引發回覆或排錯討論");
  if (signals.includes("高轉發率")) reasons.push("轉發誘因明確");
  if (signals.includes("高收藏意圖") || hookTypes.includes("Step-by-step")) reasons.push("具收藏與工具價值");
  if (hookTypes.includes("Fear")) reasons.push("有失敗、風險或落後焦慮");
  if (hookTypes.includes("Money")) reasons.push("連到金錢、職涯或投資誘因");
  if (hookTypes.includes("Controversy")) reasons.push("有反常識或爭議觀點");
  if (emotionTypes.includes("Surprise")) reasons.push("具新奇感或反轉");
  if (reasons.length === 0) reasons.push("主題與 AI Agent 熱度相關，但需要更強 Hook 才容易擴散");
  return reasons.join("；");
}

function inferRemixAngle(text, hookTypes, ctaType) {
  if (hookTypes.includes("Fear")) return "改寫成「失敗情境 + 排查清單 + 你是否也遇到」";
  if (hookTypes.includes("Money")) return "改寫成「機會 + 風險邊界 + 適合誰」";
  if (hookTypes.includes("Step-by-step") || hookTypes.includes("Productivity")) return "改寫成「前後對比 + 具體流程 + 可複製步驟」";
  if (ctaType === "comment") return "改寫成「我的觀察 + 一個具體問題」促進留言";
  return "改寫成「反常識觀察 + 具體例子 + 行動建議」";
}

function renderReport(raw, posts) {
  const lines = [];
  const topPosts = posts.slice(0, 10);
  const dataStatus = buildDataStatus(raw, posts);

  lines.push(`# Social AI Radar - X Phase 3`);
  lines.push("");
  if (dataStatus.isFallback) {
    lines.push("> 注意：本報告使用手動輸入資料");
    lines.push("");
  }
  lines.push("## 資料狀態");
  lines.push("");
  lines.push(`- generatedAt: ${dataStatus.generatedAt}`);
  lines.push(`- sourceMode: ${dataStatus.sourceMode}`);
  lines.push(`- inputFile: ${dataStatus.inputFile}`);
  lines.push(`- totalPosts: ${dataStatus.totalPosts}`);
  lines.push(`- unknownAuthorCount: ${dataStatus.unknownAuthorCount}`);
  lines.push(`- hasTimestampCount: ${dataStatus.hasTimestampCount}`);
  lines.push(`- isFallback: ${dataStatus.isFallback}`);
  lines.push("");
  lines.push(`資料來源：${raw.platform ?? "x"} / ${raw.collection_mode ?? "unknown"}`);
  lines.push(`搜尋 URL：${raw.url ?? ""}`);
  lines.push(`擷取時間：${raw.captured_at ?? "unknown"}`);
  lines.push(`原始資料：\`${INPUT_PATH}\``);
  lines.push("");

  if (posts.length === 0) {
    lines.push("## 1. 今日熱門主題");
    lines.push("");
    lines.push("資料不足：目前 raw data 沒有可分析貼文。請重新執行 `npm run scrape:x`，在 60 秒等待期間完成 X 登入或確認搜尋頁已載入。");
    lines.push("");
    lines.push("## 2. TOP 爆文");
    lines.push("");
    lines.push("資料不足。");
    lines.push("");
    lines.push("## 3. 爆文分析");
    lines.push("");
    lines.push("尚無貼文可分析。");
    lines.push("");
    lines.push("## 4. Hook Pattern");
    lines.push("");
    lines.push("建議優先找 Curiosity、Fear、Productivity、Money 類型 Hook。");
    lines.push("");
    lines.push("## 5. 情緒分析");
    lines.push("");
    lines.push("尚無貼文可分析。");
    lines.push("");
    lines.push("## 6. 可模仿內容");
    lines.push("");
    lines.push("- 多數人做 AI Agent demo 都卡在上線，不是模型不夠強，而是少了部署、評估、權限與失敗排查。");
    lines.push("- 如果你的 AI Agent 輸出不穩，先別急著換模型，先檢查 instruction、工具權限與驗證流程。");
    lines.push("");
    lines.push("## 7. 建議發文方向");
    lines.push("");
    lines.push("今天可先發「AI Agent demo 到 production 的落差」：用部署、測試、權限、失敗排查四個角度切入。");
    return lines.join("\n");
  }

  lines.push("## 1. 今日熱門主題");
  lines.push("");
  lines.push("| 排名 | 主題 | 熱度理由 | 可切入角度 |");
  lines.push("| --- | --- | --- | --- |");
  inferTopics(posts).forEach((topic, index) => {
    lines.push(`| ${index + 1} | ${topic.name} | ${topic.reason} | ${topic.angle} |`);
  });
  lines.push("");

  lines.push("## 2. TOP 爆文");
  lines.push("");
  lines.push("| 排名 | 分數 | 作者 | 一句話摘要 | Hook | 情緒 | 爆紅原因 | URL |");
  lines.push("| --- | ---: | --- | --- | --- | --- | --- | --- |");
  topPosts.forEach((post, index) => {
    lines.push(`| ${index + 1} | ${post.signal_score} | ${post.author_handle ?? post.author ?? "unknown"} | ${escapeTable(post.summary)} | ${post.hook_types.join(" + ")} | ${post.emotion_types.join(" + ")} | ${escapeTable(post.viral_reason)} | ${post.url ?? ""} |`);
  });
  lines.push("");

  lines.push("## 3. 爆文分析");
  lines.push("");
  for (const post of topPosts.slice(0, 5)) {
    lines.push(`- ${post.author_handle ?? post.author ?? "unknown"}：${post.viral_signals.join("、") || "一般訊號"}。${post.viral_reason}`);
  }
  lines.push("");

  lines.push("## 4. Hook Pattern");
  lines.push("");
  for (const post of topPosts.slice(0, 5)) {
    lines.push(`### ${post.hook_types.join(" + ")}：${post.author_handle ?? post.author ?? "unknown"}`);
    lines.push("");
    lines.push(`- 代表摘要：${post.summary}`);
    lines.push(`- 為什麼有效：${post.viral_reason}`);
    lines.push(`- 可模仿句型：${post.remix_angle}`);
    lines.push("");
  }

  lines.push("## 5. 情緒分析");
  lines.push("");
  lines.push("| 情緒 | 代表貼文 | 傳播作用 |");
  lines.push("| --- | --- | --- |");
  for (const emotion of ["Excitement", "Anxiety", "FOMO", "Inspiration", "Anger", "Surprise"]) {
    const examples = posts.filter((post) => post.emotion_types.includes(emotion)).slice(0, 2);
    if (examples.length === 0) continue;
    lines.push(`| ${emotion} | ${examples.map((post) => post.author_handle ?? post.author ?? "unknown").join("、")} | ${emotionEffect(emotion)} |`);
  }
  lines.push("");

  lines.push("## 6. 可模仿內容");
  lines.push("");
  for (const idea of buildPostIdeas(posts)) lines.push(`- ${idea}`);
  lines.push("");

  lines.push("## 7. 建議發文方向");
  lines.push("");
  lines.push("今天優先發「AI Agent 從 demo 到 production 的落差」：開頭用反常識 Hook，正文拆控制層、工具權限、測試、部署，結尾問讀者目前最常卡在哪一段。");

  return lines.join("\n");
}

function buildDataStatus(raw, posts) {
  const sourceMode = raw.collection_mode ?? "unknown";
  const envFallback = process.env.SOCIAL_RADAR_IS_FALLBACK;
  const inputFile = envFallback === "true" ? (raw.source_input ?? "input/manual-x.txt") : INPUT_PATH;
  const isManualSource = /manual/i.test(sourceMode) || /manual-x\.txt$/.test(inputFile);

  return {
    generatedAt: new Date().toISOString(),
    sourceMode,
    inputFile,
    totalPosts: posts.length,
    unknownAuthorCount: posts.filter((post) => !(post.author_handle ?? post.author)).length,
    hasTimestampCount: posts.filter((post) => Boolean(post.publish_time ?? post.published_at ?? post.created_at)).length,
    isFallback: envFallback === "true" || (envFallback !== "false" && isManualSource)
  };
}

function inferTopics(posts) {
  const text = posts.map((post) => post.text).join(" ").toLowerCase();
  const topics = [];
  if (/deploy|ci|production|部署|上線/.test(text)) topics.push({ name: "Agent 工程化部署", reason: "demo 到 production 的落差能引發工程受眾共鳴。", angle: "拆 CI、評估、資料接入與權限邊界。" });
  if (/fail|broken|risk|attack|壞|失敗|風險|攻擊/.test(text)) topics.push({ name: "Agent 失敗與安全", reason: "故障、攻擊、風險會推高留言與收藏。", angle: "列出 failure mode 與排查流程。" });
  if (/guide|tutorial|roadmap|學|教學|路線/.test(text)) topics.push({ name: "Agent 學習路線", reason: "教學與路線型內容容易被收藏。", angle: "做成階段式 checklist。" });
  if (/portfolio|yield|hiring|money|投資|收益|招聘/.test(text)) topics.push({ name: "Money / Career Agent", reason: "金錢與職涯誘因容易創造 FOMO。", angle: "同時講機會與風險邊界。" });
  topics.push({ name: "AI Agent 工作流", reason: "AI Agent 仍是核心搜尋主題。", angle: "用具體 workflow 取代抽象工具介紹。" });
  return topics.slice(0, 5);
}

function emotionEffect(emotion) {
  return {
    Excitement: "推動轉發與試用",
    Anxiety: "推動留言求助與收藏排錯",
    FOMO: "推動收藏與快速跟進",
    Inspiration: "推動學習與分享",
    Anger: "推動爭議討論",
    Surprise: "推動停留與轉發"
  }[emotion];
}

function buildPostIdeas(posts) {
  const hooks = new Set(posts.flatMap((post) => post.hook_types));
  const ideas = [];
  if (hooks.has("Fear")) ideas.push("你的 AI Agent 不是能跑就好，真正要測的是它在哪些情境會失敗。");
  if (hooks.has("Productivity")) ideas.push("我把 AI Agent workflow 拆成 4 層：任務、工具、記憶、驗證。少一層都不穩。");
  if (hooks.has("Money")) ideas.push("AI Agent 開始碰到交易、投資與招聘，但越接近錢，越需要權限邊界。");
  if (hooks.has("Step-by-step")) ideas.push("如果今天從 0 開始學 AI Agent，我會先照 4 階段路線，而不是先追框架。");
  ideas.push("多數人問哪個 Agent 最強，但我更想問：哪個 workflow 最容易被驗證？");
  return ideas;
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

main().catch((error) => {
  console.error("[analyze-posts] Failed:", error);
  process.exitCode = 1;
});
