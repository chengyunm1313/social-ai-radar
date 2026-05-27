import fs from "node:fs/promises";

const LINE_JSON_PATH = "output/social-radar-line.json";

async function main() {
  const payload = JSON.parse(await fs.readFile(LINE_JSON_PATH, "utf8"));
  validateLinePayload(payload);
  console.log(JSON.stringify(payload, null, 2));
}

function validateLinePayload(payload) {
  const requiredKeys = ["title", "generatedAt", "topics", "topPosts", "contentIdeas", "sourceStatus"];
  const missingKeys = requiredKeys.filter((key) => !(key in payload));

  if (missingKeys.length > 0) {
    throw new Error(`LINE payload 缺少必要欄位：${missingKeys.join(", ")}`);
  }

  if (!Array.isArray(payload.topics)) throw new Error("LINE payload topics 必須是陣列。");
  if (!Array.isArray(payload.topPosts)) throw new Error("LINE payload topPosts 必須是陣列。");
  if (!Array.isArray(payload.contentIdeas)) throw new Error("LINE payload contentIdeas 必須是陣列。");
}

main().catch((error) => {
  console.error("[line-x] Failed:", error);
  process.exitCode = 1;
});
