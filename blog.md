# MCP Apps：讓 AI 聊天介面不再只能回文字

AI 聊天介面有一個根本的限制——回應只有文字。

你問 Claude 分析一組資料，它回你一段摘要。你想看圖表？它幫你寫程式碼，但不會直接顯示圖表。你想填表單？它一個欄位一個欄位問你，來回五六輪才收集完。

MCP Apps 就是來解決這件事的。它讓 MCP Server 可以在 Claude、ChatGPT、VS Code 的對話中，直接嵌入互動式 HTML UI——圖表、表單、儀表板、地圖，什麼都行。

這是 Model Context Protocol 的第一個官方擴展規範（SEP-1865），2026 年 1 月正式發布，由 Anthropic、OpenAI 和 MCP-UI 社群聯合制定。對前端工程師來說，你熟悉的 HTML/CSS/JavaScript 直接成為 AI 回應介面的構建工具。

這篇文章記錄我從零開始理解 MCP Apps 架構、實際用它做了一個 Mermaid 圖表渲染器（[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)）、到踩坑與解坑的完整過程。

---

## 架構：三個角色、一條 postMessage 通道

MCP Apps 的架構有三個角色：

**MCP Server** — 你用 TypeScript 寫的後端。做兩件事：用 `registerAppTool` 註冊工具，用 `registerAppResource` 註冊 `ui://` HTML 資源。工具定義裡的 `_meta.ui.resourceUri` 欄位把工具和 UI 連結在一起。

**Host** — Claude Desktop、ChatGPT 這些聊天介面。當 LLM 呼叫你的工具時，Host 做三件事：執行工具拿到結果、根據 `_meta.ui.resourceUri` 去取 HTML 資源、在 sandbox iframe 裡渲染。之後所有 View ↔ Server 的通訊都透過 Host 代理。

**View** — 跑在 iframe 裡的前端應用。用 `App` 類別建立與 Host 的 `postMessage` 通道，接收工具結果（`ontoolresult`），也能反向呼叫 server 的工具（`callServerTool`）或把訊息送回對話（`ui/message`）。

整個流程：

```
使用者提問 → LLM 決定呼叫工具 → Server 回傳結果
                                    ↓
                        Host 取得 ui:// HTML 資源
                                    ↓
                    sandbox iframe 渲染互動式 UI
                                    ↓
              使用者在 UI 中操作 → postMessage → Host → Server

```

一個關鍵的設計決策：**View 與 Host 必須在不同 origin。** iframe 裡的程式碼無法直接存取 Host 的 DOM、cookie 或 storage，所有互動被限制在 `postMessage` 這個單一通道內。

### View 可以呼叫的方法

- `tools/call` — 呼叫 server 端的其他工具

- `ui/message` — 傳送訊息至對話（讓 LLM 看到使用者在 UI 裡做了什麼）

- `ui/update-model-context` — 更新 LLM 上下文

- `resources/read` — 讀取 server 端的資源

### 三種顯示模式

- `inline` — 嵌入對話流中，適合圖表、預覽

- `fullscreen` — 全螢幕接管，適合編輯器、複雜儀表板

- `pip` — 子母畫面，適合音樂播放器、計時器

---

## 生命週期：五個階段

MCP Apps 定義了完整的生命週期：

1. **Discovery** — Host 發現 server 的工具清單，看到哪些工具帶有 `_meta.ui` 元資料

2. **Initialize** — LLM 呼叫工具後，Host 建立 iframe、渲染 HTML、透過 `ui/initialize` 完成握手

3. **Data Delivery** — Host 把工具輸入和結果透過 postMessage 傳遞給 View

4. **Interactive** — 使用者在 View 中操作，View 透過 `tools/call` 呼叫 server 工具的互動迴圈

5. **Teardown** — 對話結束或使用者關閉 UI，資源釋放

---

## 安全模型：sandbox iframe 的限制

MCP Apps 的安全模型採用嚴格的 sandbox iframe 策略。這是跟傳統 web app 開發最大的差異——**你不能假設所有瀏覽器 API 都可用。**

預設的 CSP 只允許 `script-src 'self' 'unsafe-inline'`，這意味著：

- 需要 `eval()` 的函式庫不能直接用（Knockout.js、某些版本的 Handlebars、舊版 Angular template compiler）

- 外部資源載入預設被擋，除非 server 在 `_meta.ui.csp` 明確宣告允許的網域

- 沒有 `localStorage`、沒有 `sessionStorage`

我第一次試官方的 CesiumJS 地圖範例就踩到這個問題——CesiumJS 底層的 Knockout.js 需要 `eval()` 解析 binding，直接被 CSP 擋掉。這不是 bug，是設計。Server 可以透過 `_meta.ui.csp` 宣告額外的 CSP 規則，但 `unsafe-eval` 這種高風險權限，Host 不一定會放行。

打包方式推薦用 Vite + `vite-plugin-singlefile`，把所有資產 inline 進一個 HTML 檔案，避開外部資源載入被 CSP 擋的問題。

---

## 實際體驗：五分鐘跑起一個 MCP App

我做的 [mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 可以直接體驗。在 Claude Desktop 的設定檔（`~/Library/Application Support/Claude/claude_desktop_config.json`）加上：

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "npx",
      "args": ["-y", "mermaid-mcp-app", "--stdio"]
    }
  }
}
```

完全關閉再重開 Claude Desktop，然後說「畫一個 user authentication 的 flowchart」。你會看到一個可互動的 Mermaid 圖表直接嵌在對話裡——可以滑鼠拖曳平移、滾輪縮放、打開 split-view 編輯器即時修改 Mermaid 語法並 live re-render。

如果你想更快，也有打包好的 Desktop Extension（`.mcpb`）——從 [GitHub Releases](https://github.com/finfin/mermaid-mcp-app/releases) 下載後雙擊即安裝，不需要 terminal 也不需要改設定檔。

官方 repo 裡也有很多範例，發布為 `@modelcontextprotocol/server-<name>` npm 套件：

- `server-budget-allocator` — 預算分配互動工具（雙向互動的好範例）

- `server-system-monitor` — 系統監控儀表板

- `server-threejs` — Three.js 3D 場景

- `server-cohort-heatmap` — 群組分析熱力圖

- `server-wiki-explorer` — Wikipedia 互動式探索

建議先裝 1-2 個就好。全部一起裝反而會混亂——工具列表太長，LLM 選擇工具時容易搞混。

---

## 從零手刻一個 MCP App——以 Mermaid 圖表渲染器為例

體驗過別人的範例後，自己從零做一個才能真正理解架構。以下是我做 [mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 的實際經驗。

### 工具鏈

- TypeScript — Server 端和 View 端都用

- Vite + vite-plugin-singlefile — 把 View 端的 HTML/JS/CSS/Mermaid.js 打包成單一 HTML 檔案（~3MB，CSP 要求所有資源 inline）

- esbuild — 把 Server 端打包成單一 JS 檔案（~1.1MB，不需要帶 node_modules）

- `@modelcontextprotocol/sdk` — MCP Server SDK

- `@modelcontextprotocol/ext-apps` — MCP Apps 擴展，提供 Server 端的 `registerAppTool` / `registerAppResource` 和 View 端的 `App` 類別

### Server 端：兩個 API 呼叫搞定

整個 Server 端只有約 100 行。核心就做兩件事：

**1. `registerAppTool` 註冊工具**——定義一個 `render-mermaid` 工具，接受 `code`（Mermaid 語法）、`title`、`theme` 三個參數。關鍵是 `_meta.ui.resourceUri` 欄位，把工具和 UI 連結在一起：

```typescript
registerAppTool(
  server,
  "render-mermaid",
  {
    title: "Render Mermaid Diagram",
    description: "Render a Mermaid diagram from Mermaid syntax...",
    inputSchema: {
      code: z.string().describe("The Mermaid diagram syntax to render"),
      title: z.string().optional().describe("Optional title"),
      theme: z.enum(["default", "light", "dark", "forest", "neutral"]).optional(),
    },
    _meta: {
      ui: {
        resourceUri: "ui://mermaid/view.html",  // 這行把工具和 UI 綁在一起
      },
    },
  },
  async ({ code, title, theme }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ code, title: title ?? "", theme: theme ?? "default" }),
      }],
    };
  },
);
```

**2. `registerAppResource` 註冊 UI 資源**——讀取 Vite 打包好的單一 HTML 檔，作為 `ui://` 資源提供給 Host：

```typescript
registerAppResource(
  server,
  "Mermaid Diagram View",
  "ui://mermaid/view.html",
  { description: "Interactive Mermaid diagram renderer" },
  async () => {
    const htmlPath = path.resolve(__dirname, "../view/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    return {
      contents: [{
        uri: "ui://mermaid/view.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
      }],
    };
  },
);
```

就這樣。Server 端不做任何圖表渲染——它只負責把 Mermaid 語法傳遞給 View 端，渲染全部在 iframe 裡的前端完成。

### View 端：接收資料、渲染圖表

View 端是一個標準的前端應用，用 `App` 類別建立 postMessage 通道：

```typescript
const app = new App(
  { name: "MermaidViewer", version: "1.0.0" },
  {}, // capabilities
  { autoResize: true },
);

// LLM 呼叫工具時，Host 會先把工具參數傳過來
app.ontoolinput = (params) => {
  if (params.arguments) {
    renderDiagram(params.arguments.code, params.arguments.theme);
  }
};

// Server 處理完後，Host 把工具結果傳過來
app.ontoolresult = (params) => {
  if (params.content) {
    // 解析 JSON，取出 code/theme/title，呼叫 renderDiagram()
  }
};

await app.connect();
```

`ontoolinput` 和 `ontoolresult` 是兩個不同的時機點——前者是 LLM 決定呼叫工具時（參數已確定但 Server 還沒處理），後者是 Server 處理完回傳結果後。對 Mermaid 來說兩邊拿到的資料一樣，但對需要 Server 運算的 MCP App（像 budget-allocator），兩者的資料可能不同。

這裡有一個設計選擇：`autoResize: true` 讓 SDK 自動用 `ResizeObserver` 監聽 `document.body` 的大小變化，通知 Host 調整 iframe 高度。你也可以手動呼叫 `app.sendSizeChanged({ width, height })` 精確控制。

### 打包：為什麼需要 single-file

Mermaid.js 本身約 3MB，加上所有 CSS 和 JS，View 端打包後是一個 3MB 的 HTML 檔案。這不是最佳實踐——是 CSP 的必然結果。sandbox iframe 預設不允許載入外部資源，所有東西必須 inline。

`vite-plugin-singlefile` 會把所有 JS 和 CSS inline 進 HTML，包括 Mermaid.js 這種大型函式庫。好處是零網路依賴，壞處是檔案很大。

Server 端我用 esbuild 打包成單一 JS 檔案（~1.1MB），這樣發佈為 Desktop Extension（`.mcpb`）時不需要帶 node_modules，整個 extension 只有 1.7MB。

### 實際踩到的坑

**stdio transport 的 stdout 污染。** stdio transport 要求 stdout 只能有 JSON-RPC 訊息。任何 `console.log` 都會破壞通訊，讓 Host 無法解析回應。debug 訊息一律用 `console.error`（寫到 stderr）。我第一次連不上就是因為某個依賴在 stdout 印了 warning。

**初次渲染的 iframe 高度問題。** `autoResize` 會根據 body 大小通知 Host，但 Mermaid 圖表是非同步渲染的——iframe 先出現、body 還是空的，Host 就算了一個很小的高度。解法是設 `min-height: 600px` 保底，加上 `document.fonts.ready` + `ResizeObserver` 等佈局穩定後再做 fit-to-container。

**Desktop Extension 的 Node.js 路徑問題。** Claude Desktop 走系統 PATH，如果你用 nvm 切了多版本 Node，可能會跑到舊版（我踩到 Node v14 的 npx 不支援 `-y` flag）。解法是在設定檔用完整路徑指定 node binary。但如果打包成 `.mcpb` 就不用擔心——Desktop Extension 由 Claude Desktop 管理 runtime。

---

## 目前的限制

MCP Apps 生態還在早期，幾個限制需要清楚認知：

**Host 支援有限。** 目前確認支援的有 Claude、ChatGPT、VS Code、Goose、Postman、MCPJam。Cursor 和 Cline 尚未確認。規範要求 server 必須提供純文字 fallback，不支援 MCP Apps 的 Host 會退回到普通的文字回應。

**sandbox iframe 限制真實存在。** 沒有 localStorage、沒有 eval、外部資源預設被擋。複雜的前端應用（像醫療影像檢視器、重型資料視覺化）目前不太適合做成 MCP App。

**協議仍在快速演化。** 從 2024 年 11 月到現在，MCP 核心規範已經歷多次重大更新。MCP 已捐贈給 Linux Foundation 旗下的 Agentic AI Foundation，治理結構正在穩定中。

**安全性隱憂。** 根據 Astrix Research 的分析，超過半數的開源 MCP server 依賴不安全的靜態密鑰，僅 8.5% 使用 OAuth。生態的安全成熟度還有很大的改善空間。

---

## 前端工程師可以開始做什麼

如果你想體驗 MCP Apps，建議的路徑：

1. 先裝 1-2 個現成範例（[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)、官方的 Budget Allocator），在 Claude Desktop 裡感受完整的互動流程

2. 自己從零做一個——不需要很複雜，一個工具、一個 HTML 檔案就夠。用 DevTools 觀察 postMessage 的 JSON-RPC 訊息，那就是整個架構在運作的樣子

3. 打包成 Desktop Extension（`.mcpb`）發佈到 GitHub Releases，讓非技術使用者也能雙擊安裝

對前端工程師來說，MCP Apps 代表的是：AI 的回應介面正在從「純文字」演化為「互動式應用」，而這個介面層需要的正是前端工程師的核心能力。

差別只在於，你的 UI 不再跑在瀏覽器的完整環境裡，而是跑在一個有嚴格安全限制的 sandbox iframe 中。能在這個約束下做出好體驗的人，會是最早定義「AI-native UI」長什麼樣的人。

---

## 附錄：MCP Apps 之外的 Agent UI 標準

MCP Apps 不是唯一在做「AI 回應帶 UI」的標準。目前有三個協議在不同層面解決這個問題：

**MCP Apps** — Server 提供完整的 HTML 應用，Host 在 sandbox iframe 中執行。自由度最高，但受限於 iframe 隔離。跨平台支援最廣：Claude、ChatGPT、VS Code、Goose。

**A2UI**（Google 開源）— Agent 回傳純 JSON 結構描述 UI 元素（按鈕、文字欄位、卡片），Host 用自己的原生元件渲染。不傳可執行的程式碼，安全風險更低，UI 能完美融入 Host 設計系統。目前主要在 Google 生態系（Gemini、Flutter GenUI SDK）中使用。

**AG-UI**（CopilotKit 創建）— 不定義 UI 長什麼樣，而是標準化 agent 與前端之間的事件串流協議。定義了工具呼叫生命週期事件，讓前端能即時視覺化 agent 的每一步操作。

這三者不是競爭關係，而是不同層的協議：

- MCP Apps → Host 內嵌 UI（在別人的聊天介面裡顯示你的 UI）

- A2UI → 宣告式原生渲染（Agent 描述 UI 結構，Host 用自己的元件渲染）

- AG-UI → Agent↔前端事件串流（即時同步 agent 的操作狀態）

如果你想在現有的 AI 聊天介面裡嵌入互動式 UI，MCP Apps 是目前唯一跨平台的選項。如果你自己就是 Host（在自己的應用裡加 AI 功能），A2UI 或 AG-UI 可能更合適。

ps. 我做的 Mermaid 圖表渲染器完整原始碼在 [github.com/finfin/mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)，可以直接參考 Server 端和 View 端的實作。官方的 quickstart 和範例在 [github.com/modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)。