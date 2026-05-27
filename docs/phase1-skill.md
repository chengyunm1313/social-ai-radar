需要，但不是第一天就要做。

你現在最適合的是：

# 第一階段：先靠 Prompt 跑順流程

# 第二階段：再把流程固化成 Skill

很多新手一開始就想：

```txt
我要不要先設計 skill？
```

其實會太早。

---

# 你現在真正該做的順序

## 第 1 階段（現在）

先用：

```txt
普通 Thread + Prompt
```

確認：

* 你要抓哪些平台
* 哪些資料真的有用
* 哪種摘要最好
* 哪種 Hook 分析最準
* 哪種輸出格式最適合你

這階段最重要。

---

# 為什麼先不要做 Skill？

因為：

Skill 本質上是：

# 「可重複的工作流封裝」

如果你的流程都還在變：

* Prompt 每天改
* 分析方式還在調
* 欄位還沒定義

那 Skill 很快就過時。

---

# 我建議的時間點

當你已經：

## 連續用了 3–7 天

而且發現：

```txt
我每天都在重複貼同樣 Prompt
```

這時候才做 Skill。

---

# 你的未來 Skill 長這樣

例如：

```txt
$social-radar
```

之後你只要打：

```txt
$social-radar 今天分析 AI Agent
```

Codex 就會自動：

* 開瀏覽器
* 去 X
* 去 Threads
* 抓熱門貼文
* 分析
* 產出 Markdown 報告

這才是 Skill 的真正價值。

---

# 你未來至少會有 4 個 Skill

## 1. social-radar

負責：

* 抓熱門貼文
* 排序
* 摘要

---

## 2. hook-analyzer

分析：

* Hook
* 情緒
* 爆紅模式

---

## 3. thread-writer

根據爆文：

* 幫你生成 Thread
* 幫你生成 X 貼文
* 幫你生成 Threads 貼文

---

## 4. trend-detector

跨平台分析：

* 今天大家都在講什麼
* 新 trend 是什麼

---

# Skill 的結構其實很簡單

Codex Skill 本質上就是：

```txt
my-skill/
 ├── SKILL.md
 ├── scripts/
 ├── references/
 └── assets/
```

OpenAI 官方文件就是這樣定義。([OpenAI 開發者][1])

---

# 你現在先做這件事就好

在專案根目錄建立：

```txt
AGENTS.md
```

這比 Skill 更重要。

---

# 你的 AGENTS.md（直接照抄）

```md
# Social AI Radar Agent Rules

你是社群爆文分析助理。

目標：
從 X、Threads、Facebook 找出高傳播性的 AI / Tech 內容。

工作原則：
- 只讀取公開貼文
- 不操作按讚、留言、追蹤
- 不讀取私人訊息
- 不修改帳號設定

分析重點：
- Hook pattern
- 情緒強度
- CTA 類型
- 爆紅原因
- 可模仿結構

輸出格式：
- Markdown report
- JSON raw data

每次分析都要產出：
1. 熱門主題
2. 爆文候選
3. Hook 分析
4. 趨勢分析
5. 可模仿內容
```

---

# 為什麼 AGENTS.md 很重要？

因為：

之後每個 thread：

Codex 都會先讀它。([OpenAI 開發者][2])

你不用每天重講：

* 不要亂按按鈕
* 不要追蹤
* 不要留言
* 要輸出 markdown

超重要。

---

# 你現在最適合的工作流

## 第一週

### 不做 Skill

只做：

* Prompt
* AGENTS.md
* 手動流程

---

## 第二週

開始：

```txt
Create Skill from Thread
```

Codex Desktop 已經內建這能力。([OpenAI][3])

---

# Skill 真正適合封裝的東西

例如：

## 這種很適合

```txt
每天固定：
- 搜尋 AI Agent
- 看 today/top
- 抓 20 篇
- 分析 hook
- 生成報告
```

---

## 這種不適合

```txt
今天忽然想分析 Elon Musk
明天分析 NBA
後天分析台股
```

因為變動太大。

---

# 你現在最重要的不是 Skill

而是：

# 建立「你的分析框架」

這才是核心資產。

不是程式碼。

---

# 我建議你下一步

現在立刻：

## Step 1

建立：

```txt
social-ai-radar/
 ├── AGENTS.md
 ├── prompts/
 ├── input/
 ├── output/
```

---

## Step 2

把我上面給你的 AGENTS.md 放進去。

---

## Step 3

開 Codex Desktop。

---

## Step 4

貼這段：

```txt
請根據 AGENTS.md，
建立第一版 Social AI Radar workflow。

先不要做全自動。

請建立：
1. prompts/social-radar.md
2. input/posts-template.json
3. output/sample-report.md

並幫我規劃：
- X 分析流程
- Threads 分析流程
- 爆文評分機制
```

---

等你完成這步，

下一回我就能繼續教你：

# 如何建立第一個真正的 Codex Skill

包括：

* 怎麼按 UI
* 怎麼命名
* SKILL.md 怎麼寫
* 如何讓 Computer Use 自動觸發
* 如何讓它自己產出報告
* 如何做 daily automation
* 如何接 LINE Bot

這才會是完整 AI Radar 系統。

[1]: https://developers.openai.com/codex/skills?utm_source=chatgpt.com "Agent Skills – Codex | OpenAI Developers"
[2]: https://developers.openai.com/codex/concepts/customization?utm_source=chatgpt.com "Customization – Codex | OpenAI Developers"
[3]: https://openai.com/index/introducing-the-codex-app/?utm_source=chatgpt.com "Introducing the Codex app | OpenAI"
