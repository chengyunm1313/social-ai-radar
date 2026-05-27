import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const RAW_PATH = "input/x-ai-agent-raw.json";
const MANUAL_PATH = "input/manual-x.txt";

async function main() {
  const rawStatus = await inspectRawInput();
  let isFallback = false;

  if (rawStatus.exists && rawStatus.totalPosts > 0) {
    console.log(`[radar-hybrid-x] Using ${RAW_PATH} (${rawStatus.totalPosts} posts)`);
  } else {
    isFallback = true;
    const reason = rawStatus.exists ? "raw JSON has 0 posts" : "raw JSON does not exist";
    console.log(`[radar-hybrid-x] ${reason}; falling back to ${MANUAL_PATH}`);
    await runNodeScript("scripts/import-manual-x.js");
  }

  await runNodeScript("scripts/analyze-posts.js", {
    SOCIAL_RADAR_IS_FALLBACK: isFallback ? "true" : "false"
  });
}

async function inspectRawInput() {
  try {
    const raw = JSON.parse(await fs.readFile(RAW_PATH, "utf8"));
    return {
      exists: true,
      totalPosts: Array.isArray(raw.posts) ? raw.posts.length : 0
    };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, totalPosts: 0 };
    throw new Error(`無法讀取 ${RAW_PATH}: ${error.message}`);
  }
}

function runNodeScript(scriptPath, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error("[radar-hybrid-x] Failed:", error.message);
  process.exitCode = 1;
});
