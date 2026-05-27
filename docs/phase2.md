好，接下來進入：

# 第二階段：建立第一個真正可重用的 Codex Skill

目標：

你之後只要輸入：

```txt id="2r5sl7"
$social-radar
```

它就會：

* 開瀏覽器
* 去 X / Threads
* 看熱門貼文
* 分析
* 產生 Markdown 報告

---

# 先理解一件事

Codex Skill 不是：

```txt id="mebkhh"
一般 prompt shortcut
```

它比較像：

# AI 工作流模組

包含：

* Prompt
* 規則
* 檔案模板
* Scripts
* Tool usage
* Agent 行為

---

# 第一步：建立 Skill 資料夾

在你的專案下建立：

```txt id="9j8v1n"
skills/social-radar/
```

裡面建立：

```txt id="qvkt3r"
skills/social-radar/
 ├── SKILL.md
 ├── prompts/
 ├── templates/
 └── examples/
```

---

# 第二步：建立 SKILL.md

這是最核心的。

直接用這版。

---

# skills/social-radar/SKILL.md

```md id="6m8fh2"
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
```

---

# 第三步：建立 Prompt 模板

建立：

```txt id="pwxwde"
skills/social-radar/prompts/daily-radar.md
```

內容：

---

```md id="8xkqao"
今天請執行 Social Radar。

平台：
- X
- Threads

關鍵字：
- ChatGPT
- AI Agent
- MCP
- Claude Code
- OpenAI
- Cursor

任務：

1. 找今天熱門貼文
2. 每平台最多 20 篇
3. 只讀公開貼文
4. 不操作互動功能

請記錄：

- author
- content
- url
- likes
- reposts
- replies
- views
- publish_time

最後產出：

1. raw-posts.json
2. social-radar-report.md

分析：

- 今日熱門趨勢
- 爆文原因
- Hook 類型
- 情緒類型
- CTA 模式
- 可模仿結構
- 今天值得發的內容
```

---

# 第四步：教 Codex 使用 Skill

這步很多人會卡。

---

# 在 Codex Desktop

開一個新 Thread。

貼：

```txt id="5z18xv"
請讀取：

skills/social-radar/SKILL.md

之後請以這個 Skill 的規則執行。
```

第一次先這樣。

---

# 然後再下：

```txt id="wq2mrm"
執行：

skills/social-radar/prompts/daily-radar.md
```

---

# 第五步：開始真正使用 Computer Use

這時：

## 你先手動：

* 打開 Chrome
* 登入 X
* 登入 Threads

---

# 然後下這段（超重要）

```txt id="nuyhns"
使用 Computer Use。

請操作我目前已登入的瀏覽器。

任務：
- 去 X 搜尋 AI Agent
- 查看 today / top
- 擷取高互動貼文
- 每平台最多 20 篇

限制：
- 不按讚
- 不留言
- 不轉貼
- 不追蹤

最後：
- 儲存 raw-posts.json
- 產出 social-radar-report.md
```

---

# 第六步：建立爆文評分

這超重要。

不要只看 likes。

---

# 第一版公式（直接用）

RadarScore = \frac{Likes + 2\times Reposts + 3\times Replies}{FollowerCount + 1}

---

# 為什麼？

因為：

## 真正有價值的是：

```txt id="pkxt54"
小帳號爆文
```

不是 Elon Musk 那種。

---

# 第七步：讓 Codex 自動分析

加入這段 Prompt。

---

```txt id="3dzvhv"
請不要只依 likes 排序。

請優先分析：

- 小帳號高互動
- 高留言率
- 高轉發率
- 情緒強烈
- 爭議性
- 新觀點
- 強 Hook
```

---

# 第八步：建立你的 Hook Library

建立：

```txt id="x8c0rq"
knowledge/hook-library.md
```

---

# 放這些

```md id="lm6h4d"
# 高傳播 Hook

## Curiosity

- Nobody talks about this...
- I tried this for 30 days...
- This changed everything...

## Fear

- You're already behind...
- Most developers will disappear...

## Productivity

- I replaced 10 hours with this...
- This AI workflow saved me...

## Money

- I made $10k using...
- This AI tool prints money...
```

---

# 然後叫 Codex：

```txt id="a94bd8"
分析爆文時，
請參考 knowledge/hook-library.md。
```

---

# 你現在已經有：

## 第一版 AI Radar 系統

包含：

* Browser Agent
* Social Analysis
* Hook Analysis
* Trend Detection
* Content Ideation

這已經很接近產品。

---

# 下一階段（你很快會需要）

之後我會建議你做：

## Phase 3

### Playwright 半自動化

因為：

Computer Use 很慢。

---

# 未來架構會變：

```txt id="3uh8t3"
Playwright 抓資料
↓
JSON
↓
Codex 分析
↓
LINE 推播
```

這會比純 Computer Use 強很多。

---

# 你下一步現在直接做

## 1

建立：

```txt id="iqe0ao"
skills/social-radar/SKILL.md
```

---

## 2

把我上面內容貼進去。

---

## 3

開 Codex Desktop。

---

## 4

貼：

```txt id="j99glf"
請讀取：
skills/social-radar/SKILL.md
```

---

## 5

再貼：

```txt id="9uhckd"
使用 Computer Use，
分析今天 AI Agent 熱門貼文。
```

---

完成後，

你下一階段就能做：

* 自動 daily radar
* LINE Bot 推播
* 自動內容生成
* 趨勢分析
* 爆文資料庫
* 個人 AI 情報中心

這會很猛。
