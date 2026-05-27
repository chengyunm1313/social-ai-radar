# Social AI Radar - 2026-05-27

資料來源：Computer Use 操作已登入 Chrome 讀取 X 公開搜尋結果  
分析範圍：X  
搜尋條件：`"AI Agent" since:2026-05-27 until:2026-05-28`，Top tab  
限制遵守：未按讚、未留言、未轉貼、未追蹤、未讀取私訊、未修改設定。

## 0. 評分方式

本版不依 likes 排序，改用 `signal-first-v2`：

- 優先：高留言率、高轉發率、高互動率、強 Hook、情緒強烈、爭議性、新觀點。
- 加分：留言量明顯高、收藏意圖高、低瀏覽但互動率異常高。
- 降權：只靠 likes、相關性偏弱、剛發布但尚無互動。
- 小帳號高互動：本次 X 搜尋列表未顯示 follower 數，因此不硬推測帳號大小；raw data 內標為 `unknown_follower_count_not_visible`。
- Hook 對照：參考 `knowledge/hook-library.md`，使用 `Curiosity`、`Fear`、`Productivity`、`Money` 四類標記。

## 1. 今日熱門主題

| 排名 | 主題 | 平台 | 熱度理由 | 可切入角度 |
| --- | --- | --- | --- | --- |
| 1 | AI Agent 控制層與 instruction architecture | X | CLAUDE.md 被重新定位成 agent 控制層，互動率最高。 | 「不要把 AGENTS / CLAUDE.md 當 README，要當控制層設計」 |
| 2 | Agent 安全測試與失敗排查 | X | RAMPART、Hermes agent down 這類內容引發焦慮與求助型回覆。 | 「你的 agent 不是能跑就好，還要能被攻擊測試」 |
| 3 | Agent 工程化部署 | X | agents-cli、CI、評估、資料接入等從 demo 走向 production 的痛點被反覆提到。 | 「AI Agent demo 容易，上線難在哪 5 個環節」 |
| 4 | AI Agent 學習路線與工具清單 | X | Datawhale、GitHub 趨勢、Pi Agent 教程等內容收藏價值高。 | 「從 0 到 1 學 agent，不要先追框架」 |
| 5 | 金融與交易 Agent | X | Base MCP、portfolio agent、TradingAgents-CN 把 agent 與交易、收益策略連在一起。 | 「金融 agent 的吸引力與風險邊界」 |

## 2. TOP 爆文候選

| 排名 | 分數 | 平台 | 作者 | 一句話摘要 | 爆紅原因 | URL |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | 90 | X | @Dharmikpawar31 | CLAUDE.md 不是文件，而是 AI agent 的控制層。 | `Curiosity + Productivity`：高留言率、高轉發率、高互動率；「多數開發者都搞錯」是強認知落差。 | https://x.com/Dharmikpawar31/status/2059473163172626913 |
| 2 | 90 | X | @eikofinance | Base MCP + AI agent 連接投資組合與收益策略。 | `Money + Curiosity`：低瀏覽高互動；金融、yield、swap、launch 同時拉動 FOMO。 | https://x.com/eikofinance/status/2059534268184072552 |
| 3 | 40 | X | @FakeMaidenMaker | Datawhale AI Agent 學習路線上線 9 天達 1.6K stars。 | `Curiosity + Productivity`：likes 不高但留言率高；學習路線 + stars 形成可討論素材。 | https://x.com/FakeMaidenMaker/status/2059458967097462990 |
| 4 | 36 | X | @wsl8297 | Google agents-cli 把 agent 上雲工程化流程做成技能包。 | `Productivity + Fear`：收藏意圖高；「demo 容易、上線難」點出被低估的工程風險。 | https://x.com/wsl8297/status/2059499352008343825 |
| 5 | 32 | X | @zekyure | Hermes agent 掛掉，詢問其他人是否遇到同樣問題。 | `Fear + Curiosity`：絕對留言量高；故障求助能聚集同工具使用者與排錯討論。 | https://x.com/zekyure/status/2059428282672500867 |
| 6 | 30 | X | @GitTrend0x | GitHub AI Agent 項目屠榜，整理星標暴增項目。 | `Curiosity + Productivity`：收藏意圖高於一般互動；清單型內容適合轉成資源整理。 | https://x.com/GitTrend0x/status/2059456304272556071 |
| 7 | 26 | X | @ajay_2512x | 招聘能端到端建 AI-agent solution 的工程師。 | `Money + Productivity`：招聘需求是 career signal，反映 AI-agent solution engineer 職能成形。 | https://x.com/ajay_2512x/status/2059483549624107432 |

## 3. 爆文分析

今天最強的不是「新 agent 很酷」，而是「agent 如何被控制、測試、部署、排錯」。若不看 likes，而看傳播訊號，最值得注意的是兩類：

- 低瀏覽高互動：@Dharmikpawar31、@eikofinance 的互動率明顯異常，代表 Hook 或題材足以讓看見的人立刻行動。
- 高留言討論：@zekyure、@FakeMaidenMaker 不是 likes 最高，但留言訊號強，適合拆解成求助、爭議或路線討論。

高傳播貼文多半具備三個特徵：

- 有明確痛點：輸出不穩、agent 掛掉、demo 上不了雲、訂閱太貴。
- 有可操作資源：GitHub repo、教程、framework、CLI、學習路線。
- 有身份投射：開發者會立刻判斷「這是不是我現在也遇到的問題」。

## 4. Hook Pattern

### Pattern 1：Curiosity - 多數人都搞錯

- 代表貼文：@Dharmikpawar31
- 對照 library：`Nobody talks about this...` / `This changed everything...`
- 為什麼有效：把 CLAUDE.md 從普通文件升級成控制層，讓開發者重新檢查自己的 workflow。
- 可模仿句型：多數人把 `X` 當成 `文件/設定`，但它其實是 `AI agent 的控制層`。

### Pattern 2：Fear - 工具壞了，有人也遇到嗎

- 代表貼文：@zekyure
- 對照 library：`You're already behind...`
- 為什麼有效：故障與求助能快速觸發同工具使用者回覆，留言率通常高；恐懼點不是抽象威脅，而是「我現在 workflow 會不會也壞」。
- 可模仿句型：我的 `工具/agent` 在 `情境` 下壞了，我已經試過 `A/B/C`，還有人遇到嗎？

### Pattern 3：Productivity - Demo 容易，上線困難

- 代表貼文：@wsl8297
- 對照 library：`This AI workflow saved me...`
- 為什麼有效：反差清楚，從炫技轉向真實工程問題；讀者會期待一套能省掉部署摩擦的 workflow。
- 可模仿句型：做 `AI Agent demo` 不難，真正難的是 `部署/評估/CI/資料接入`。

### Pattern 4：Productivity + Curiosity - 從零到一教程

- 代表貼文：@cellinlab、@veyhon、@FakeMaidenMaker
- 對照 library：`I tried this for 30 days...` / `This changed everything...`
- 為什麼有效：學習路線、Colab、repo、todo list 都有收藏誘因；「9 天 1.6K stars」也會強化好奇心。
- 可模仿句型：如果你今天要從 0 開始學 `AI Agent`，我會把路線拆成 `N 個階段`。

### Pattern 5：Money - Agent 直接接到資產或職涯

- 代表貼文：@eikofinance、@ajay_2512x
- 對照 library：`I made $10k using...` / `This AI tool prints money...`
- 為什麼有效：金融收益、投資組合、招聘需求都直接對應金錢誘因，容易吸引 crypto、職涯與創業受眾。
- 可模仿句型：`AI Agent` 開始真正碰到 `錢/職位/交易`，第一個值得看的不是收益，而是 `風險邊界/技能要求`。

## 5. 情緒分析

| 情緒 | 代表內容 | 傳播作用 |
| --- | --- | --- |
| FOMO | GitHub 屠榜、學習路線、RAMPART 新框架 | 讓人怕錯過新工具與新標準 |
| Anxiety | agent 掛掉、agent 可被攻擊、上線難 | 促使留言求助、收藏排錯資訊 |
| Inspiration | Pi Agent 教程、學習路線 | 促使收藏與轉發給同事 |
| Excitement | Base MCP + portfolio agent | 讓金融與 crypto 受眾轉發 |
| Surprise | CLAUDE.md 是控制層，不是 README | 反轉既有認知，提高停留與分享 |

## 6. CTA 模式

- 資源連結：GitHub repo、教程、CLI、framework，是今天最常見 CTA。
- 求助提問：故障貼文最容易帶留言。
- 招聘 CTA：AI-agent solution engineer 類職缺可吸引收藏與轉發。
- Launch 預告：金融 agent 產品用「幾小時後上線」創造 FOMO。
- 無 CTA 觀點文：只要 Hook 夠強，仍能有高互動率。

## 7. 可模仿內容

### X 貼文方向

1. 多數人把 AGENTS.md / CLAUDE.md 當文件，但真正該設計的是 agent 的控制層。
2. 做 AI Agent demo 不難，難的是部署、評估、CI、資料接入和權限邊界。
3. 你的 agent 不是「跑得動」就安全，至少要測這 5 種 failure mode。
4. 我把 AI Agent 學習路線拆成 4 階段：基礎、工具、工程化、安全評估。
5. 如果你的 agent 輸出不穩，不一定是模型問題，可能是 instruction architecture 太鬆。

### Threads 貼文方向

1. 我現在看 AI Agent，不太看 demo 有多炫，反而先看它壞掉時能不能排錯。
2. 最近越來越覺得，AI coding 的核心不是 prompt，而是控制層和驗證層。
3. 很多人問要學哪個 agent 框架，但我會先學怎麼定義工具、記憶、權限和失敗處理。
4. Agent 工程化最容易被低估：CI、資料接入、評估、部署，每個都會把 demo 打回原形。
5. 我喜歡今天這個角度：CLAUDE.md 不是 README，而是你的 AI coworker SOP。

## 8. 建議發文方向

今天最值得發的角度：

> AI Agent 真正的分水嶺不是模型，而是控制層、測試層與部署層。

建議內容結構：

1. Hook：多數人把 agent 當聊天工具，所以輸出不穩。
2. 痛點：demo 可跑，但上線會卡在權限、資料、CI、測試、觀測。
3. 方法：用 AGENTS.md / CLAUDE.md 定義控制層，用測試框架驗證 failure mode。
4. 案例：RAMPART、agents-cli、Pi Agent 教程、Datawhale learning path。
5. CTA：問讀者「你現在 agent workflow 最常壞在哪一段？」
