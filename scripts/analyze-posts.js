import fs from "node:fs/promises";

const INPUT_PATH = "input/x-ai-agent-raw.json";
const OUTPUT_PATH = "output/social-radar-report.md";
const LINE_OUTPUT_PATH = "output/social-radar-line.txt";
const LINE_JSON_OUTPUT_PATH = "output/social-radar-line.json";
const ENGAGEMENT_DEBUG_PATH = "output/debug-engagement-parse.json";

async function main() {
  await fs.mkdir("output", { recursive: true });

  const raw = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
  const posts = (raw.posts ?? [])
    .map((post) => analyzePost(post))
    .sort((a, b) => b.signal_score - a.signal_score);

  const normalizedRaw = {
    ...raw,
    schema_version: "0.5",
    normalized_at: new Date().toISOString(),
    posts: posts.map((post, index) => ({
      ...post,
      index: index + 1
    }))
  };

  await fs.writeFile(INPUT_PATH, JSON.stringify(normalizedRaw, null, 2) + "\n");
  await fs.writeFile(ENGAGEMENT_DEBUG_PATH, JSON.stringify(buildEngagementDebug(posts), null, 2) + "\n");
  await fs.writeFile(OUTPUT_PATH, renderReport(raw, posts) + "\n");
  await fs.writeFile(LINE_OUTPUT_PATH, renderLineBrief(raw, posts) + "\n");
  await fs.writeFile(LINE_JSON_OUTPUT_PATH, JSON.stringify(renderLineJson(raw, posts), null, 2) + "\n");
  console.log(`[analyze-posts] Read ${posts.length} posts from ${INPUT_PATH}`);
  console.log(`[analyze-posts] Wrote ${ENGAGEMENT_DEBUG_PATH}`);
  console.log(`[analyze-posts] Wrote ${OUTPUT_PATH}`);
  console.log(`[analyze-posts] Wrote ${LINE_OUTPUT_PATH}`);
  console.log(`[analyze-posts] Wrote ${LINE_JSON_OUTPUT_PATH}`);
}

function analyzePost(post) {
  const text = normalizeText(stripXMetadata(post.text));
  const engagement = normalizeEngagement(post, text);
  const metrics = engagement.metrics;
  const hotScore = calculateHotScore(metrics);
  const timestampConfidence = classifyTimestampConfidence(post);
  const engagementSummary = summarizeEngagement(metrics, hotScore);
  const hookTypes = classifyHook(text);
  const emotionTypes = classifyEmotion(text);
  const ctaType = classifyCta(text);
  const quality = scoreQuality(text, hookTypes, ctaType);
  const viralSignals = scoreSignals(metrics, text, hookTypes, emotionTypes);

  return {
    ...post,
    text,
    metrics,
    hotScore,
    engagementParseDebug: {
      ...engagement.debug,
      hotScore
    },
    timestampConfidence,
    engagementSummary,
    summary: summarize(text),
    qualityScore: quality.score,
    qualitySignals: quality.signals,
    qualityFlags: quality.flags,
    isCollectible: quality.isCollectible,
    hook_types: hookTypes,
    emotion_types: emotionTypes,
    cta_type: ctaType,
    viral_signals: viralSignals.labels,
    signal_score: viralSignals.score,
    viral_reason: inferViralReason(text, metrics, hookTypes, emotionTypes, viralSignals.labels),
    remix_angle: inferRemixAngle(text, hookTypes, ctaType)
  };
}

function calculateHotScore(metrics) {
  const coreMetrics = [metrics.likes, metrics.reposts, metrics.replies];
  if (coreMetrics.every((value) => value == null)) return null;
  return (metrics.likes ?? 0) + (metrics.reposts ?? 0) * 2 + (metrics.replies ?? 0) * 3;
}

function classifyTimestampConfidence(post) {
  const timestamp = extractTimestampValue(post);
  if (!timestamp) return "low";
  if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|^\d{1,2}月\d{1,2}日/.test(timestamp)) return "high";
  if (/^\d+\s*(?:秒|分鐘|小時|天|日|週|周)(?:前)?$/.test(timestamp)) return "medium";
  return "medium";
}

function extractTimestampValue(post) {
  const direct = String(post.publish_time ?? post.published_at ?? post.created_at ?? "").trim();
  if (direct) return direct;
  const text = String(post.text ?? post.post_text ?? "");
  return text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}月\d{1,2}日|\d+\s*(?:秒|分鐘|小時|天|日|週|周)(?:前)?)/)?.[1] ?? "";
}

function summarizeEngagement(metrics, hotScore) {
  if (hotScore == null) return "互動數未取得；score: null";
  return `score: ${hotScore}；回覆 ${formatMetric(metrics.replies)}、轉發 ${formatMetric(metrics.reposts)}、喜歡 ${formatMetric(metrics.likes)}、收藏 ${formatMetric(metrics.bookmarks)}、觀看 ${formatMetric(metrics.views)}`;
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

function normalizeEngagement(post, text) {
  const before = normalizeMetrics(post.metrics);
  const rawText = String(post.post_text ?? post.text ?? text ?? "");
  const fromLabels = parseLabeledMetrics(rawText);
  const fromTail = parseXMetricTail(rawText);
  const parsed = mergeMetrics(fromLabels.metrics, fromTail.metrics);
  const beforeHasMetrics = hasAnyMetric(before);
  const parsedHasMetrics = hasAnyMetric(parsed);
  const beforeLooksLikeUnknownZeros = ["replies", "reposts", "likes", "views"].every((key) => before[key] === 0 || before[key] == null);
  const metrics = parsedHasMetrics
    ? beforeLooksLikeUnknownZeros
      ? parsed
      : mergeMetrics(before, parsed, { preferFirst: true })
    : beforeLooksLikeUnknownZeros || !beforeHasMetrics
      ? emptyMetrics()
      : before;

  return {
    metrics,
    debug: {
      before,
      after: metrics,
      sourceMethods: [
        ...fromLabels.methods,
        ...fromTail.methods
      ],
      rawTail: rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-10).join("\n")
    }
  };
}

function normalizeMetrics(metrics = {}) {
  return {
    replies: normalizeMetricValue(metrics.replies),
    reposts: normalizeMetricValue(metrics.reposts),
    likes: normalizeMetricValue(metrics.likes),
    bookmarks: normalizeMetricValue(metrics.bookmarks),
    views: normalizeMetricValue(metrics.views)
  };
}

function normalizeMetricValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseCount(value);
}

function parseLabeledMetrics(text) {
  const methods = [];
  const metrics = {
    replies: metricNearLabel(text, ["replies", "reply", "回覆", "則回覆"]),
    reposts: metricNearLabel(text, ["reposts", "repost", "retweets", "retweet", "轉貼", "轉發", "次轉發"]),
    likes: metricNearLabel(text, ["likes", "like", "喜歡", "個喜歡"]),
    bookmarks: metricNearLabel(text, ["bookmarks", "bookmark", "書籤", "收藏", "個書籤"]),
    views: metricNearLabel(text, ["views", "view", "觀看", "次觀看", "次瀏覽"])
  };
  if (hasAnyMetric(metrics)) methods.push("labeled engagement text");
  return { metrics, methods };
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

function mergeMetrics(primary = emptyMetrics(), fallback = emptyMetrics(), options = {}) {
  const preferFirst = options.preferFirst ?? true;
  const keys = ["replies", "reposts", "likes", "bookmarks", "views"];
  return Object.fromEntries(keys.map((key) => {
    const first = primary[key];
    const second = fallback[key];
    return [key, preferFirst ? (first ?? second ?? null) : (second ?? first ?? null)];
  }));
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
  if (raw.includes("萬")) return Math.round(number * 10_000);
  if (/K/i.test(raw)) return Math.round(number * 1_000);
  if (/M/i.test(raw)) return Math.round(number * 1_000_000);
  return Math.round(number);
}

function formatMetric(value) {
  return value == null ? "未取得" : value;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildEngagementDebug(posts) {
  return {
    generated_at: new Date().toISOString(),
    engagementParseDebug: posts.map((post, index) => ({
      index: index + 1,
      author: post.author_handle ?? post.author ?? "unknown",
      url: post.url ?? null,
      ...post.engagementParseDebug
    }))
  };
}

function scoreSignals(metrics, text, hookTypes, emotionTypes) {
  const engagement = (metrics.likes ?? 0) + (metrics.reposts ?? 0) * 2 + (metrics.replies ?? 0) * 1.5 + (metrics.bookmarks ?? 0) * 1.25;
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

function scoreQuality(text, hookTypes, ctaType) {
  const signals = [];
  const flags = [];
  let score = 0;

  if (hasHighInformationDensity(text)) {
    score += 28;
    signals.push("資訊密度高");
  } else if (text.length >= 120) {
    score += 16;
    signals.push("資訊量中等");
  } else {
    flags.push("低資訊量");
  }

  if (hasClearPointOfView(text, hookTypes)) {
    score += 24;
    signals.push("觀點明確");
  } else {
    flags.push("觀點不明確");
  }

  if (isConvertibleToContentIdea(text, hookTypes, ctaType)) {
    score += 28;
    signals.push("可轉化成內容靈感");
  } else {
    flags.push("轉化價值低");
  }

  if (hasSpecificEvidence(text)) {
    score += 12;
    signals.push("有具體例子或數字");
  }

  if (hookTypes.length > 0) {
    score += 8;
    signals.push("Hook 可辨識");
  }

  if (isPureAdOrGiveaway(text)) {
    score -= 45;
    flags.push("疑似純廣告或抽獎");
  } else if (isPromotional(text)) {
    score -= 18;
    flags.push("偏促銷");
  }

  if (isLowInformationPost(text)) {
    score -= 25;
    if (!flags.includes("低資訊量")) flags.push("低資訊量");
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);

  return {
    score: normalizedScore,
    signals,
    flags,
    isCollectible: normalizedScore >= 45 && !flags.includes("疑似純廣告或抽獎")
  };
}

function hasClearPointOfView(text, hookTypes) {
  return hookTypes.some((type) => ["Controversy", "Fear", "Productivity", "Step-by-step", "Money", "AI Replacement"].includes(type)) ||
    /不是|其實|反而|難的是|關鍵|本質|我認為|我覺得|重點|should|need to|the key|not .* but/i.test(text);
}

function isConvertibleToContentIdea(text, hookTypes, ctaType) {
  if (ctaType === "follow") return false;
  if (hookTypes.some((type) => ["Fear", "Productivity", "Step-by-step", "Controversy", "Money"].includes(type))) return true;
  return /workflow|framework|guide|tutorial|checklist|roadmap|deploy|security|open source|github|工作流|框架|教程|指南|清單|部署|安全|開源|优化|檢測|協作/i.test(text);
}

function hasSpecificEvidence(text) {
  return /\d|github|http|open source|repo|benchmark|case|example|項|個|層|步|星|開源|案例|工具|框架/i.test(text);
}

function isPureAdOrGiveaway(text) {
  const lower = text.toLowerCase();
  return /giveaway|airdrop|reward pool|rewards campaign|claim now|抽獎|空投|白名單|邀请码|邀請碼|限時領取|免費領|轉發.*抽|关注.*抽|追蹤.*抽/.test(lower);
}

function isPromotional(text) {
  const lower = text.toLowerCase();
  return /sign up|join now|use my code|promo|discount|campaign|register|邀請碼|註冊|報名|優惠|活動|申請資格/.test(lower);
}

function isLowInformationPost(text) {
  const compactText = String(text ?? "").replace(/\s+/g, " ").trim();
  return compactText.length < 90 || /^(check this out|gm|wow|nice|launching soon|coming soon|跟隨)/i.test(compactText);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const topicStats = buildTopicStats(posts);
  const keywordStats = buildKeywordStats(posts);

  lines.push(`# Social AI Radar - X Phase 3`);
  lines.push("");
  if (dataStatus.isFallback) {
    lines.push("> 注意：本報告使用手動輸入資料");
    lines.push("");
  }
  lines.push("## 資料狀態");
  lines.push("");
  lines.push(`- generatedAt: ${dataStatus.generatedAt}`);
  lines.push(`- runId: ${dataStatus.runId ?? "none"}`);
  lines.push(`- sourceMode: ${dataStatus.sourceMode}`);
  lines.push(`- inputFile: ${dataStatus.inputFile}`);
  lines.push(`- totalPosts: ${dataStatus.totalPosts}`);
  lines.push(`- preset: ${dataStatus.preset ?? "none"}`);
  lines.push(`- keywords: ${dataStatus.keywords.join(", ") || "none"}`);
  lines.push(`- unknownAuthorCount: ${dataStatus.unknownAuthorCount}`);
  lines.push(`- hasTimestampCount: ${dataStatus.hasTimestampCount}`);
  lines.push(`- isFallback: ${dataStatus.isFallback}`);
  lines.push("");
  lines.push("## 今日 TOP 10 熱門貼文");
  lines.push("");
  renderHotPostTable(posts).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## Topic / Keyword 熱度");
  lines.push("");
  renderTopicKeywordStats(topicStats, keywordStats).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## 爆文模式分析");
  lines.push("");
  renderViralPatternAnalysis(posts).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## 可模仿貼文模板");
  lines.push("");
  renderImitationTemplates(posts).forEach((line) => lines.push(line));
  lines.push("");
  lines.push("## 資料限制說明");
  lines.push("");
  renderDataLimitations(dataStatus, posts).forEach((line) => lines.push(line));
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

function renderHotPostTable(posts) {
  if (posts.length === 0) return ["資料不足。"];

  const lines = [
    "| 排名 | score | qualityScore | 作者 | 互動摘要 | 時間信心 | 一句話摘要 |",
    "| --- | ---: | ---: | --- | --- | --- | --- |"
  ];

  topByHotScore(posts).slice(0, 10).forEach((post, index) => {
    lines.push(
      `| ${index + 1} | ${formatScore(post.hotScore)} | ${post.qualityScore} | ${post.author_handle ?? post.author ?? "unknown"} | ${escapeTable(post.engagementSummary)} | ${post.timestampConfidence} | ${escapeTable(post.summary)} |`
    );
  });

  return lines;
}

function renderViralPatternAnalysis(posts) {
  if (posts.length === 0) return ["- 資料不足，無法判斷爆文模式。"];

  const patterns = new Map();
  for (const post of posts.slice(0, 10)) {
    const key = post.hook_types.join(" + ");
    const current = patterns.get(key) ?? { count: 0, example: post, hotScore: 0 };
    current.count += 1;
    current.hotScore += post.hotScore ?? 0;
    if ((post.hotScore ?? -1) > (current.example.hotScore ?? -1)) current.example = post;
    patterns.set(key, current);
  }

  return [...patterns.entries()]
    .sort((a, b) => b[1].hotScore - a[1].hotScore)
    .slice(0, 5)
    .map(([pattern, data]) => `- ${pattern}：出現 ${data.count} 次，代表貼文 ${data.example.author_handle ?? data.example.author ?? "unknown"}；可用「${data.example.remix_angle}」重寫。`);
}

function renderImitationTemplates(posts) {
  const templates = [
    "「多數人以為 AI Agent 卡在模型，其實卡在 ______。我把它拆成 4 層：____、____、____、____。」",
    "「我測了 ______ 類 AI Agent 工具，真正值得收藏的是這 3 個判準：____、____、____。」",
    "「如果你今天才開始做 AI Agent，不要先追框架，先照這條路線：第 1 步____，第 2 步____，第 3 步____。」"
  ];

  if (posts.some((post) => post.hook_types.includes("Fear"))) {
    templates.unshift("「你的 AI Agent 會失敗，不是因為模型弱，而是少了這個檢查：____。」");
  }

  return templates.slice(0, 4).map((template) => `- ${template}`);
}

function renderDataLimitations(dataStatus, posts) {
  const lowTimestampCount = posts.filter((post) => post.timestampConfidence === "low").length;
  const missingMetricCount = posts.filter((post) =>
    ["replies", "reposts", "likes"].some((key) => post.metrics[key] == null)
  ).length;
  const unknownScoreCount = posts.filter((post) => post.hotScore == null).length;

  return [
    `- 本報告依 ${dataStatus.inputFile} 產生，sourceMode 為 ${dataStatus.sourceMode}。`,
    `- timestampConfidence 為 low 的貼文共 ${lowTimestampCount} 篇；時間排序只能作輔助判斷。`,
    `- replies/reposts/likes 任一欄位未取得的貼文共 ${missingMetricCount} 篇；若三項核心互動數都未取得，score 會顯示 null。`,
    `- 互動數未取得、無法計算 hotScore 的貼文共 ${unknownScoreCount} 篇；這些貼文會排在已取得互動數的貼文後方。`,
    `- qualityScore 低於 45 或疑似純廣告、抽獎的貼文不進入 LINE TOP 5；目前可收錄貼文共 ${posts.filter((post) => post.isCollectible).length} 篇。`,
    "- X 頁面可見範圍與平台排序會影響樣本，結果適合做內容雷達，不等同全量社群統計。"
  ];
}

function renderTopicKeywordStats(topicStats, keywordStats) {
  const lines = [];
  const strongestTopic = topicStats[0];
  const strongestKeyword = keywordStats[0];

  lines.push(`- 今日最強 topic：${strongestTopic ? `${strongestTopic.name}（${strongestTopic.postCount} 篇，score ${strongestTopic.score}）` : "資料不足"}`);
  lines.push(`- 今日最強 keyword：${strongestKeyword ? `${strongestKeyword.keyword}（高分貼文 ${strongestKeyword.highScorePostCount} 篇，score ${strongestKeyword.score}）` : "資料不足"}`);
  lines.push("");
  lines.push("| 排名 | Topic | 貼文數 | 高分貼文 | 熱度分數 |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  topicStats.slice(0, 5).forEach((topic, index) => {
    lines.push(`| ${index + 1} | ${topic.name} | ${topic.postCount} | ${topic.highScorePostCount} | ${topic.score} |`);
  });
  lines.push("");
  lines.push("| 排名 | Keyword | 貼文數 | 高分貼文 | 熱度分數 |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  keywordStats.slice(0, 8).forEach((keyword, index) => {
    lines.push(`| ${index + 1} | ${keyword.keyword} | ${keyword.postCount} | ${keyword.highScorePostCount} | ${keyword.score} |`);
  });
  return lines;
}

function topByHotScore(posts) {
  return [...posts].sort((a, b) => {
    const aHasScore = a.hotScore != null;
    const bHasScore = b.hotScore != null;
    if (aHasScore !== bHasScore) return aHasScore ? -1 : 1;
    if (aHasScore && bHasScore && b.hotScore !== a.hotScore) return b.hotScore - a.hotScore;
    return timestampSortValue(b) - timestampSortValue(a) || b.signal_score - a.signal_score;
  });
}

function topByLineScore(posts) {
  const collectible = posts.filter((post) => post.isCollectible);
  const pool = collectible.length > 0 ? collectible : posts;
  const maxHotScore = Math.max(1, ...pool.map((post) => post.hotScore ?? 0));

  return [...pool]
    .map((post) => ({
      ...post,
      lineScore: calculateLineScore(post, maxHotScore)
    }))
    .sort((a, b) => b.lineScore - a.lineScore || timestampSortValue(b) - timestampSortValue(a) || b.signal_score - a.signal_score);
}

function calculateLineScore(post, maxHotScore) {
  const hotScore = post.hotScore ?? 0;
  const normalizedHotScore = maxHotScore > 0 ? (hotScore / maxHotScore) * 100 : 0;
  return Math.round((normalizedHotScore * 0.6 + (post.qualityScore ?? 0) * 0.4) * 10) / 10;
}

function buildTopicStats(posts) {
  const maxHotScore = Math.max(1, ...posts.map((post) => post.hotScore ?? 0));
  const definitions = [
    {
      name: "Agent 工程化部署",
      pattern: /deploy|ci|production|cloud|browser|terminal|cli|部署|上線|雲|瀏覽器|終端/i
    },
    {
      name: "Agent 失敗與安全",
      pattern: /fail|broken|risk|attack|security|hallucination|detect|壞|失敗|風險|攻擊|安全|幻覺|檢測|检测/i
    },
    {
      name: "Agent 學習路線",
      pattern: /guide|tutorial|roadmap|learn|course|step|學|教學|教程|指南|路線|步驟/i
    },
    {
      name: "Money / Career Agent",
      pattern: /portfolio|yield|hiring|money|startup|saas|business|revenue|投資|收益|招聘|創業|商業|營收/i
    },
    {
      name: "AI Agent 工作流",
      pattern: /workflow|automation|agent|task|workspace|tool|自動化|工作流|任務|工具|智能體/i
    },
    {
      name: "模型與平台動態",
      pattern: /openai|gemini|claude|cursor|mcp|notion|github/i
    }
  ];

  const stats = definitions.map((definition) => {
    const matchedPosts = posts.filter((post) => definition.pattern.test(`${post.text} ${post.keyword ?? ""}`));
    return buildGroupedStat(definition.name, matchedPosts, maxHotScore);
  });

  return stats
    .filter((stat) => stat.postCount > 0)
    .sort((a, b) => b.score - a.score || b.highScorePostCount - a.highScorePostCount || b.postCount - a.postCount);
}

function buildKeywordStats(posts) {
  const maxHotScore = Math.max(1, ...posts.map((post) => post.hotScore ?? 0));
  const groups = new Map();
  for (const post of posts) {
    const keyword = post.keyword ?? "unknown";
    groups.set(keyword, [...(groups.get(keyword) ?? []), post]);
  }

  return [...groups.entries()]
    .map(([keyword, groupPosts]) => ({
      keyword,
      ...buildGroupedStat(keyword, groupPosts, maxHotScore)
    }))
    .sort((a, b) => b.highScorePostCount - a.highScorePostCount || b.score - a.score || b.postCount - a.postCount);
}

function buildGroupedStat(name, groupPosts, maxHotScore) {
  const scoredPosts = groupPosts.map((post) => ({
    post,
    lineScore: calculateLineScore(post, maxHotScore)
  }));
  const score = Math.round(scoredPosts.reduce((sum, item) => sum + item.lineScore, 0) * 10) / 10;
  const highScorePostCount = scoredPosts.filter((item) => item.lineScore >= 40 || (item.post.hotScore ?? 0) >= 100 || (item.post.qualityScore ?? 0) >= 80).length;

  return {
    name,
    postCount: groupPosts.length,
    highScorePostCount,
    score
  };
}

function timestampSortValue(post) {
  const value = extractTimestampValue(post);
  if (!value) return 0;
  const capturedAt = Date.parse(post.captured_at ?? "") || Date.now();
  const relative = value.match(/^(\d+)\s*(秒|分鐘|小時|天|日|週|周)(?:前)?$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multipliers = {
      秒: 1_000,
      分鐘: 60_000,
      小時: 3_600_000,
      天: 86_400_000,
      日: 86_400_000,
      週: 604_800_000,
      周: 604_800_000
    };
    return capturedAt - amount * multipliers[unit];
  }

  const monthDay = value.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (monthDay) {
    const year = new Date(capturedAt).getFullYear();
    return new Date(year, Number(monthDay[1]) - 1, Number(monthDay[2])).getTime();
  }

  const parsed = Date.parse(value.replace("年", "-").replace("月", "-").replace("日", ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildDataStatus(raw, posts) {
  const sourceMode = raw.collection_mode ?? "unknown";
  const envFallback = process.env.SOCIAL_RADAR_IS_FALLBACK;
  const inputFile = envFallback === "true" ? (raw.source_input ?? "input/manual-x.txt") : INPUT_PATH;
  const isManualSource = /manual-x\.txt$/.test(inputFile);

  return {
    generatedAt: new Date().toISOString(),
    runId: process.env.SOCIAL_RADAR_RUN_ID ?? raw.runId ?? null,
    sourceMode,
    inputFile,
    totalPosts: posts.length,
    preset: raw.preset ?? null,
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [raw.query].filter(Boolean),
    unknownAuthorCount: posts.filter((post) => !(post.author_handle ?? post.author)).length,
    hasTimestampCount: posts.filter((post) => post.timestampConfidence !== "low").length,
    isFallback: envFallback === "true" || (envFallback !== "false" && isManualSource)
  };
}

function renderLineBrief(raw, posts) {
  const payload = renderLineJson(raw, posts);
  const topics = payload.topics.join("、") || "資料不足";
  const topPosts = payload.topPosts;
  const ideas = payload.contentIdeas;

  const lines = [];
  lines.push(payload.title);
  lines.push(`主題：${topics}`);
  lines.push(`最強 topic：${payload.strongestTopic?.name ?? "資料不足"}`);
  lines.push(`最強 keyword：${payload.strongestKeyword?.keyword ?? "資料不足"}`);
  lines.push("");
  lines.push("TOP 5：");

  if (topPosts.length === 0) {
    lines.push("1. 資料不足，請重新擷取。");
  } else {
    topPosts.forEach((post, index) => {
      lines.push(`${index + 1}. ${post.author}｜${formatScore(post.hotScore)}｜Q${post.qualityScore}｜${compact(post.summary, 52)}`);
    });
  }

  lines.push("");
  lines.push("內容靈感：");
  ideas.forEach((idea, index) => lines.push(`${index + 1}. ${compact(idea, 72)}`));

  lines.push("");
  lines.push(`資料：${payload.sourceStatus.sourceMode}，${payload.sourceStatus.totalPosts} 篇`);

  const text = lines.join("\n");
  return text.length <= 1000 ? text : `${text.slice(0, 997)}...`;
}

function renderLineJson(raw, posts) {
  const dataStatus = buildDataStatus(raw, posts);
  const topicStats = buildTopicStats(posts);
  const keywordStats = buildKeywordStats(posts);
  const topics = (topicStats.length > 0 ? topicStats : inferTopics(posts)).slice(0, 3);
  const topPosts = topByLineScore(posts).slice(0, 5);

  return {
    title: "Social AI Radar 今日快報",
    generatedAt: new Date().toISOString(),
    runId: dataStatus.runId,
    topics: topics.map((topic) => topic.name),
    strongestTopic: topicStats[0] ?? null,
    strongestKeyword: keywordStats[0] ?? null,
    keywordStats,
    topPosts: topPosts.map((post, index) => ({
      rank: index + 1,
      author: post.author_handle ?? post.author ?? "unknown",
      url: post.url ?? null,
      summary: post.summary,
      hotScore: post.hotScore,
      qualityScore: post.qualityScore,
      lineScore: post.lineScore,
      qualitySignals: post.qualitySignals ?? [],
      qualityFlags: post.qualityFlags ?? [],
      hookTypes: post.hook_types ?? [],
      emotionTypes: post.emotion_types ?? [],
      engagementSummary: post.engagementSummary
    })),
    contentIdeas: buildPostIdeas(posts).slice(0, 3),
    sourceStatus: {
      ...dataStatus,
      runId: dataStatus.runId,
      inputFile: dataStatus.inputFile,
      totalPosts: posts.length,
      collectiblePosts: posts.filter((post) => post.isCollectible).length,
      preset: dataStatus.preset,
      keywords: dataStatus.keywords,
      scoring: "lineScore = normalizedHotScore * 0.6 + qualityScore * 0.4"
    }
  };
}

function compact(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function formatScore(value) {
  return value == null ? "score: null" : value;
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
