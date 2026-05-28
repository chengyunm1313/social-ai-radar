import fs from "node:fs/promises";
import path from "node:path";

const LINE_JSON_PATH = "output/social-radar-line.json";
const RAW_PATH = "input/x-ai-agent-raw.json";
const HISTORY_DIR = "data/history";
const TIME_ZONE = process.env.SOCIAL_RADAR_TIMEZONE ?? "Asia/Taipei";

async function main() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });

  const line = JSON.parse(await fs.readFile(LINE_JSON_PATH, "utf8"));
  const raw = await readJsonIfExists(RAW_PATH);
  const date = getSnapshotDate(line.generatedAt);
  const posts = Array.isArray(raw?.posts) ? raw.posts : [];
  const snapshot = buildSnapshot({ date, line, posts });
  const outputPath = path.join(HISTORY_DIR, `${date}.json`);

  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`[history-snapshot] Wrote ${outputPath}`);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function buildSnapshot({ date, line, posts }) {
  return {
    date,
    runId: line.runId ?? null,
    preset: line.sourceStatus?.preset ?? null,
    keywords: line.sourceStatus?.keywords ?? [],
    strongestTopic: line.strongestTopic ?? null,
    strongestKeyword: line.strongestKeyword ?? null,
    keywordStats: line.keywordStats ?? [],
    topicStats: line.topicStats ?? buildTopicStatsFromLine(line),
    topPosts: (line.topPosts ?? []).slice(0, 10).map((post) => ({
      rank: post.rank,
      author: post.author,
      summary: post.summary,
      hotScore: post.hotScore ?? null,
      qualityScore: post.qualityScore ?? null,
      lineScore: post.lineScore ?? null,
      url: post.url ?? null
    })),
    avgHotScore: average(posts.map((post) => post.hotScore).filter((value) => typeof value === "number")),
    avgQualityScore: average(posts.map((post) => post.qualityScore).filter((value) => typeof value === "number")),
    totalPosts: line.sourceStatus?.totalPosts ?? posts.length
  };
}

function buildTopicStatsFromLine(line) {
  const topics = line.topics ?? [];
  return topics.map((name, index) => ({
    name,
    postCount: line.strongestTopic?.name === name ? line.strongestTopic.postCount ?? 0 : 0,
    highScorePostCount: 0,
    score: line.strongestTopic?.name === name ? line.strongestTopic.score ?? 0 : Math.max(0, topics.length - index)
  }));
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function getSnapshotDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatLocalDate(new Date());
  return formatLocalDate(date);
}

function formatLocalDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

main().catch((error) => {
  console.error("[history-snapshot] Failed:", error.message);
  process.exitCode = 1;
});
