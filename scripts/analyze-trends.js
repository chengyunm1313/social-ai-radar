import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_DIR = "data/history";
const OUTPUT_PATH = "output/trend-analysis.json";
const WINDOW_DAYS = 7;

async function main() {
  await fs.mkdir("output", { recursive: true });
  const snapshots = await readRecentSnapshots();
  const analysis = analyzeTrends(snapshots);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(analysis, null, 2) + "\n");
  console.log(`[analyze-trends] Read ${snapshots.length} snapshots`);
  console.log(`[analyze-trends] Wrote ${OUTPUT_PATH}`);
}

async function readRecentSnapshots() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  const files = (await fs.readdir(HISTORY_DIR))
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .slice(-WINDOW_DAYS);

  const snapshots = [];
  for (const file of files) {
    const snapshot = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, file), "utf8"));
    snapshots.push(snapshot);
  }
  return snapshots;
}

function analyzeTrends(snapshots) {
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.slice(0, -1);
  const risingKeywords = rankRisingItems(snapshots, "keywordStats", "keyword");
  const risingTopics = rankRisingItems(snapshots, "topicStats", "name");
  const emergingKeywords = findEmergingKeywords(latest, previous);
  const sustainedHotTopics = findSustainedHotTopics(snapshots);

  return {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    snapshotCount: snapshots.length,
    dateRange: {
      from: snapshots[0]?.date ?? null,
      to: latest?.date ?? null
    },
    risingKeyword: risingKeywords[0] ?? null,
    risingKeywords,
    risingTopic: risingTopics[0] ?? null,
    risingTopics,
    sustainedHotTopics,
    emergingKeywords,
    latest: latest ? {
      date: latest.date,
      preset: latest.preset ?? null,
      strongestTopic: latest.strongestTopic ?? null,
      strongestKeyword: latest.strongestKeyword ?? null,
      totalPosts: latest.totalPosts ?? 0,
      avgHotScore: latest.avgHotScore ?? null,
      avgQualityScore: latest.avgQualityScore ?? null
    } : null
  };
}

function rankRisingItems(snapshots, field, keyName) {
  const latest = snapshots.at(-1);
  if (!latest) return [];

  const previous = snapshots.slice(0, -1);
  const latestMap = statsMap(latest[field] ?? [], keyName);
  const previousMaps = previous.map((snapshot) => statsMap(snapshot[field] ?? [], keyName));

  return [...latestMap.entries()]
    .map(([name, latestStat]) => {
      const previousScores = previousMaps.map((map) => map.get(name)?.score ?? 0);
      const previousAverage = average(previousScores);
      const momentum = round((latestStat.score ?? 0) - previousAverage);
      return {
        name,
        keyword: keyName === "keyword" ? name : undefined,
        score: latestStat.score ?? 0,
        previousAverage,
        momentum,
        postCount: latestStat.postCount ?? 0,
        highScorePostCount: latestStat.highScorePostCount ?? 0
      };
    })
    .sort((a, b) => b.momentum - a.momentum || b.score - a.score)
    .slice(0, 5);
}

function findEmergingKeywords(latest, previous) {
  if (!latest) return [];
  const previousKeywords = new Set(previous.flatMap((snapshot) => (snapshot.keywordStats ?? []).map((item) => item.keyword)));

  return (latest.keywordStats ?? [])
    .filter((item) => item.keyword && !previousKeywords.has(item.keyword))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((item) => ({
      keyword: item.keyword,
      score: item.score ?? 0,
      postCount: item.postCount ?? 0,
      highScorePostCount: item.highScorePostCount ?? 0
    }));
}

function findSustainedHotTopics(snapshots) {
  const groups = new Map();

  for (const snapshot of snapshots) {
    for (const item of snapshot.topicStats ?? []) {
      const current = groups.get(item.name) ?? { name: item.name, appearances: 0, totalScore: 0, highScorePostCount: 0 };
      current.appearances += 1;
      current.totalScore += item.score ?? 0;
      current.highScorePostCount += item.highScorePostCount ?? 0;
      groups.set(item.name, current);
    }
  }

  return [...groups.values()]
    .map((item) => ({
      name: item.name,
      appearances: item.appearances,
      averageScore: round(item.totalScore / item.appearances),
      highScorePostCount: item.highScorePostCount
    }))
    .filter((item) => item.appearances >= Math.min(3, snapshots.length))
    .sort((a, b) => b.averageScore - a.averageScore || b.appearances - a.appearances)
    .slice(0, 5);
}

function statsMap(items, keyName) {
  return new Map(items.filter((item) => item[keyName]).map((item) => [item[keyName], item]));
}

function average(values) {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

main().catch((error) => {
  console.error("[analyze-trends] Failed:", error.message);
  process.exitCode = 1;
});
