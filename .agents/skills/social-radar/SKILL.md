# Social Radar Skill

## Purpose

分析 X、Threads、Facebook 的熱門 AI / Tech 貼文，
找出高傳播性內容與可模仿模式。

---

## Responsibilities

1. 搜尋今日熱門貼文
2. 分析高互動原因
3. 辨識 Hook Pattern
4. 分析情緒與 CTA
5. 生成內容靈感
6. 產出 Markdown 報告

---

## Rules

- 只讀取公開貼文
- 不按讚
- 不留言
- 不追蹤
- 不讀取私人訊息
- 不修改帳號設定

---

## Platforms

- X
- Threads
- Facebook

---

## Output

產出：

1. raw-posts.json
2. social-radar-report.md

---

## Radar Analysis Framework

分析：

### Hook Type

- Curiosity
- Controversy
- Fear
- Money
- Productivity
- AI Replacement
- Step-by-step
- Personal Story

---

### Emotion Type

- Excitement
- Anxiety
- FOMO
- Inspiration
- Anger
- Surprise

---

### Viral Signals

優先保留：

- 高留言率
- 高轉發率
- 小帳號高互動
- 快速成長貼文
- 高資訊密度

---

## Final Report

報告必須包含：

1. 今日熱門主題
2. TOP 爆文
3. 爆文分析
4. Hook Pattern
5. 情緒分析
6. 可模仿內容
7. 建議發文方向

## Phase 3 Playwright Mode

當使用者要求半自動化時：

1. 優先使用 Playwright
2. 使用 headless: false
3. 允許使用者手動登入
4. 不自動操作互動按鈕
5. 只擷取公開可見內容
6. raw data 儲存到 input/
7. report 儲存到 output/

## Hybrid Mode：Computer Use + Playwright/Node

當 X 限制 Playwright Chromium 登入，或使用者要求改用已登入的真實 Chrome session 時：

1. 使用者用平常 Chrome 手動登入 X。
2. Codex 使用 Computer Use 操作該 Chrome 視窗。
3. 到 X 搜尋指定關鍵字，例如 `AI Agent`。
4. 依任務需要切換 Top / Latest。
5. 只滾動與讀取公開可見內容。
6. 不按讚、不留言、不轉貼、不追蹤、不讀私人訊息、不修改帳號設定。
7. 將可見頁面文字或選取內容儲存為 `input/manual-x.txt`。
8. 執行 `node scripts/import-manual-x.js` 轉成 `input/x-ai-agent-raw.json`。
9. 執行 `node scripts/analyze-posts.js` 產出 `output/social-radar-report.md`。

Hybrid Mode 的資料來源要在 raw data 與 report 中標示為人工/半自動整理，不得宣稱為全自動爬蟲。
