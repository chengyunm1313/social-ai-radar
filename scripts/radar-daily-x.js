import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ARTIFACTS = [
  "input/x-ai-agent-raw.json",
  "input/manual-x.txt",
  "output/social-radar-report.md",
  "output/social-radar-line.json",
  "output/social-radar-line.txt",
  "output/trend-analysis.json",
  "output/debug-engagement-parse.json",
  "output/debug-x-page.html",
  "output/debug-x-screenshot.png",
  "output/debug-x-text.txt"
];

async function main() {
  const runId = createRunId();
  const runDir = path.join("runs", runId);
  const options = getDailyOptions();
  const env = {
    ...process.env,
    SOCIAL_RADAR_RUN_ID: runId
  };

  if (options.preset) env.npm_config_preset = options.preset;
  if (options.keyword) {
    env.npm_config_keyword = options.keyword;
    env.SOCIAL_RADAR_QUERY = options.keyword;
  }

  console.log(`[radar-daily-x] runId=${runId}`);
  console.log(`[radar-daily-x] preset=${options.preset ?? "none"}`);
  console.log(`[radar-daily-x] keyword=${options.keyword ?? "none"}`);

  const steps = [
    {
      name: "radar:x",
      command: ["npm", "run", "radar:x"]
    },
    {
      name: "radar:hybrid:x",
      command: ["npm", "run", "radar:hybrid:x"]
    },
    {
      name: "history:snapshot",
      command: ["npm", "run", "history:snapshot"]
    },
    {
      name: "trends:analyze",
      command: ["npm", "run", "trends:analyze"]
    },
    {
      name: "analyze",
      command: ["npm", "run", "analyze"]
    },
    {
      name: "radar:line:x",
      command: ["npm", "run", "radar:line:x"]
    },
    {
      name: "radar:send:telegram",
      command: ["npm", "run", "radar:send:telegram"]
    }
  ];

  let failedStep = null;

  try {
    for (const step of steps) {
      console.log(`[radar-daily-x] Running ${step.name}`);
      await runStep(step.command, env);
    }
  } catch (error) {
    failedStep = error.stepName ?? "unknown";
    console.error(`[radar-daily-x] Failed step: ${failedStep}`);
    console.error(`[radar-daily-x] ${error.message}`);
    process.exitCode = 1;
  } finally {
    await copyArtifacts(runDir, {
      runId,
      preset: options.preset,
      keyword: options.keyword,
      failedStep
    });
    console.log(`[radar-daily-x] Artifacts copied to ${runDir}`);
  }
}

function getDailyOptions() {
  return {
    preset: getCliOption("preset") ?? process.env.npm_config_preset ?? process.env.SOCIAL_RADAR_PRESET ?? null,
    keyword: getCliOption("keyword") ?? process.env.npm_config_keyword ?? null
  };
}

function getCliOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function createRunId(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function runStep(command, env) {
  return new Promise((resolve, reject) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      stdio: "inherit",
      env
    });

    child.on("error", (error) => {
      error.stepName = args.at(-1) ?? bin;
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const error = new Error(`${command.join(" ")} exited with code ${code}`);
      error.stepName = args.at(-1) ?? bin;
      reject(error);
    });
  });
}

async function copyArtifacts(runDir, metadata) {
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, "run-meta.json"), JSON.stringify({
    ...metadata,
    copiedAt: new Date().toISOString()
  }, null, 2) + "\n");

  for (const artifact of ARTIFACTS) {
    try {
      await fs.access(artifact);
    } catch {
      continue;
    }

    const destination = path.join(runDir, artifact);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(artifact, destination);
  }
}

main().catch((error) => {
  console.error("[radar-daily-x] Failed:", error.message);
  process.exitCode = 1;
});
