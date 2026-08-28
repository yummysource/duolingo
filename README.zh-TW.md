# @yummysource/duolingo-cli

[English](README.md) | [繁體中文](README.zh-TW.md)

這是一個以 TypeScript 實作的唯讀 Duolingo 工具包，同時提供
**TypeScript API、CLI、跨 Agent Skill 與 MCP Server**。四種介面共用同一套
Duolingo Client 與工具邏輯，不需要為不同使用方式重複實作。

> 本專案使用 Duolingo 非官方 API。端點可能隨時變動；所有已提供的能力皆為
> 唯讀，不會提交答案、購買商品、修改帳號設定或寫入學習進度。

## 目錄

- [選擇適合的介面](#選擇適合的介面)
- [依情境快速開始](#依情境快速開始)
- [取得與保存 JWT](#取得與保存-jwt)
- [CLI](#cli)
- [Skill](#skill)
- [MCP Server](#mcp-server)
- [TypeScript API](#typescript-api)
- [Review 資料的限制](#review-資料的限制)
- [開發與驗證](#開發與驗證)

## 選擇適合的介面

| 介面  | 適用情境                               | 設定方式                        | 輸出                         |
| ----- | -------------------------------------- | ------------------------------- | ---------------------------- |
| API   | TypeScript 應用、資料管線、自訂整合    | 安裝套件並建立 `DuolingoClient` | 型別化物件                   |
| CLI   | 人工操作、Shell Script、CI、本機自動化 | 安裝 CLI，執行一次 `auth init`  | Markdown 或 JSON             |
| Skill | 讓不同 Agent 透過自然語言使用 Duolingo | 安裝 CLI 與 `duolingo-learn`    | 由 Skill 選擇並組合 CLI 結果 |
| MCP   | 已支援 MCP 的 Client 與既有工具流程    | 啟動 `duolingo-cli mcp`         | MCP Tool Response            |

如果只需要查詢資料，優先使用 CLI；需要整合進程式時使用 API；需要跨 Agent
自然語言流程時使用 Skill；既有環境已採用 MCP 時則保留 MCP Server。

## 依情境快速開始

### 查看最近七天的西班牙文學習並準備複習材料

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli auth init
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review material --language es --limit 10 --json
```

### 讓 Agent 處理 Duolingo 學習資料

```bash
npx skills add yummysource/duolingo -y -g
```

安裝後可提出例如：「整理我最近七天的西班牙文學習內容，並準備最多十句複習
句子。」Skill 會先檢查授權，再選擇穩定的 CLI 指令與 JSON 輸出。

### 在 TypeScript 中讀取帳號資料

```typescript
import { DuolingoClient } from '@yummysource/duolingo-cli';

const client = new DuolingoClient(username, jwt);
const profile = await client.getUserData();
console.log(profile.site_streak);
```

### 啟動 MCP Server

```bash
duolingo-cli mcp
```

完整英文指南：

- [API Guide](docs/guides/api.md)
- [CLI Guide](docs/guides/cli.md)
- [Skill Guide](docs/guides/skill.md)
- [MCP Guide](docs/guides/mcp.md)

## 取得與保存 JWT

1. 在瀏覽器登入 [duolingo.com](https://www.duolingo.com)。
2. 開啟瀏覽器開發者工具的 Console。
3. 執行：

   ```js
   document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11);
   ```

4. 在自己的終端執行 `duolingo-cli auth init`，依提示輸入使用者名稱與 JWT。

CLI 會隱藏 JWT 輸入，將 JWT 保存到作業系統憑證管理器，只把使用者名稱寫入
權限限制為擁有者可讀寫的設定檔。請勿把 JWT 貼到聊天、寫進程式碼、提交到
Git，或當成命令列參數傳入。

若同時設定完整的 `DUOLINGO_USERNAME` 與 `DUOLINGO_JWT` 環境變數，它們會
優先於已保存的憑證；只設定其中一個會直接回報錯誤。

## CLI

### 安裝與授權

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli --version
duolingo-cli auth init
duolingo-cli auth show
duolingo-cli auth show --status
```

`auth show --status` 只會輸出 `authorized` 或 `unauthorized`，適合 Script 做
前置檢查。`auth logout` 會刪除本機保存的憑證，但不會修改目前 Shell 的環境
變數。

### 帳號與語言

```bash
duolingo-cli account profile [--username USER] [--json]
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language skills --language LANG [--username USER] [--json]
```

### Review

```bash
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]
```

- `recent` 預設查詢 7 天，從指定語言的 Calendar 取得 XP 與活動；若新版學習
  路徑沒有舊版 Skill 資料，總 XP 與 `activities` 仍會保留，但 `skills` 與
  `words` 可能為空。
- `sentences` 預設抽樣 1 個 Session，最多回傳 20 句目前練習內容。
- `material` 預設挑選 5 個弱項主題、抽樣 3 個 Session，最多回傳 20 句。
- `--limit` 是上限而非保證數量；空 Session 與去重可能讓實際結果較少。
- 未指定 `--from` 時會從符合的課程推導基礎語言，不應預設一定是英文。

預設輸出為 Markdown；需要 Script 或 Agent 處理時加上 `--json`。成功回傳
Exit Code 0，包括合法的空結果；驗證、授權、網路或 API 錯誤回傳 Exit Code 1。

詳見 [CLI Guide](docs/guides/cli.md)。

## Skill

`duolingo-learn` 把穩定的 CLI 工作流程包裝成跨 Agent 可使用的 Skill：

```text
skills/duolingo-learn/
├── SKILL.md
└── references/
    └── cli-commands.md
```

它不包含 `agents/openai.yaml`、特定 Agent Runtime、內嵌憑證或 MCP 設定。Skill
負責授權前置檢查、選擇 CLI 指令、使用 JSON 結果，以及向使用者說明資料限制；
實際 API 邏輯仍由 CLI 與共用工具處理。

安裝：

```bash
npx skills add yummysource/duolingo -y -g
```

如果尚未授權，Skill 應停止查詢並要求使用者在自己的互動式終端執行：

```bash
duolingo-cli auth init
```

它不應要求使用者把 JWT 貼到對話中。詳見
[Skill Guide](docs/guides/skill.md)。

## MCP Server

CLI 已授權時可直接啟動：

```bash
duolingo-cli mcp
```

通用 stdio 設定：

```json
{
  "mcpServers": {
    "duolingo": {
      "command": "duolingo-cli",
      "args": ["mcp"]
    }
  }
}
```

原有 `duolingo-mcp` Binary 仍然保留，適合由容器或 CI 的 Secret Manager 注入
完整環境變數。不要把真實 JWT 寫進可提交的 JSON 設定檔。

MCP Tool 分為：

- Account：Profile、設定、Streak、每日 XP、課程、好友、日曆、排行榜、商店、
  Hearts、貨幣與 Streak Goal。
- Language：語言進度、主題、已知單字、已學 Skill、TTS Voice 與 Audio URL。
- Review：`duolingo_get_recent_learning`、
  `duolingo_get_practice_sentences`、`duolingo_get_review_material`。
- Utilities：語言名稱與縮寫轉換。

所有 Tool 都標記為唯讀、非破壞性。詳見
[MCP Guide](docs/guides/mcp.md)。

## TypeScript API

```bash
npm install @yummysource/duolingo-cli
```

```typescript
import { DuolingoAuthError, DuolingoClient } from '@yummysource/duolingo-cli';

const client = new DuolingoClient(username, jwt);

try {
  const user = await client.getUserData();
  const current = await client.getUserDataV2(user.id);
  console.log(current.courses);
} catch (error) {
  if (error instanceof DuolingoAuthError) {
    // 更新憑證，但不要記錄舊 JWT。
  }
}
```

主要方法群組：

- User：`getUserData`、`getUserDataV2`、`getUserDataById`、
  `getUserIdByUsername`。
- Social：`getFollowing`、`getFollowers`、`getLeaderboard`。
- Account：`getShopItems`、`getHealth`、`getCurrencies`。
- Streak：`getStreakGoalCurrent`、`getStreakGoalNextOptions`。
- Practice / Audio：`getGlobalPracticeSession`、`getLanguageVoices`、
  `buildAudioUrl`、Voice URL Dictionary。

詳見 [API Guide](docs/guides/api.md)。

## Review 資料的限制

- 最近 XP 活動只含可對應到 Skill 的 Metadata，無法還原過去課程的精確題目與
  句子。
- 練習句子來自目前的 Global Practice Sample，不是已完成課程的重播。
- Practice Session 可能為空，重複呼叫也可能得到不同內容。
- 指定語言的近期統計會排除無法對應 Skill 或屬於其他課程的 XP 活動。
- 本專案不會提交答案或改變學習進度。

## 開發與驗證

```bash
git clone https://github.com/yummysource/duolingo.git
cd duolingo
npm install
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Live Integration Test 需要完整的 `DUOLINGO_USERNAME` 與 `DUOLINGO_JWT`，請透過
本機環境或 CI Secret 注入，不要提交 `.env`。

## 授權

MIT，詳見 [LICENSE](LICENSE)。
