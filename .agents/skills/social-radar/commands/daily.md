---
description: 執行 Social Radar 每日 AI / Tech 公開貼文分析。
argument-hint: <關鍵字、平台或補充限制>
---

你正在使用專案內的 `social-radar` skill。

請先閱讀同一個 skill 目錄的 `SKILL.md`，並遵守本專案 `AGENTS.md` 的限制：

- 只讀取公開貼文。
- 不按讚、不留言、不轉貼、不追蹤。
- 不讀取私人訊息。
- 不修改帳號設定。
- 不儲存登入資訊。
- 不捏造互動數據或貼文內容；資料不足時要明確標示。

任務補充：

$ARGUMENTS

若使用者沒有指定平台，預設分析：

- X
- Threads

若使用者沒有指定關鍵字，預設使用：

- ChatGPT
- AI Agent
- MCP
- Claude Code
- OpenAI
- Cursor

輸出要求：

1. 將 raw data 寫入 `input/` 或本次 run 的 `raw-posts.json`。
2. 將 Markdown 報告寫入 `output/social-radar-report.md` 或本次 run 的 `social-radar-report.md`。
3. 報告必須包含熱門主題、爆文候選、Hook 分析、趨勢分析、可模仿內容。
4. 最後用台灣繁體中文回報實際產出檔案與資料限制。
