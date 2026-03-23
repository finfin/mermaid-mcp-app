# MCP Apps：讓 AI 聊天介面不再只能回文字

MCP 出來之後我一直在想一個問題——Server 能幫 LLM 接上各種工具和資料源，但回應還是只有文字。你問 Claude 分析一組資料，它回你一段摘要。你想看圖表？它幫你寫程式碼，但不會直接顯示。你想填表單？它一個欄位一個欄位問你，來回五六輪才收集完。

然後 MCP Apps 出來了。

它讓 MCP Server 可以在 Claude、ChatGPT、VS Code 的對話中，直接嵌入互動式 HTML UI——圖表、表單、儀表板、地圖，什麼都行。這是 Model Context Protocol 的第一個官方擴展規範（SEP-1865），2026 年 1 月正式發布，由 Anthropic、OpenAI 和 MCP-UI 社群聯合制定。

我花了一些時間研究這個規範，然後做了一個 Mermaid 圖表渲染器（[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)）來驗證。這篇是研究筆記——從架構設計、安全模型、雙向資料流，到實作過程中踩的坑，完整走一遍。

---

## 架構：三個角色、一條 postMessage 通道

MCP Apps 的架構有三個角色：

**MCP Server** — 你用 TypeScript 寫的後端。做兩件事：用 `registerAppTool` 註冊工具，用 `registerAppResource` 註冊 `ui://` HTML 資源。工具定義裡的 `_meta.ui.resourceUri` 欄位把工具和 UI 連結在一起。

**Host** — Claude Desktop、ChatGPT 這些聊天介面。當 LLM 呼叫你的工具時，Host 做三件事：執行工具拿到結果、根據 `_meta.ui.resourceUri` 去取 HTML 資源、在 sandbox iframe 裡渲染。之後所有 View ↔ Server 的通訊都透過 Host 代理。

**View** — 跑在 iframe 裡的前端應用。用 `App` 類別建立與 Host 的 `postMessage` 通道，接收工具結果（`ontoolresult`），也能反向呼叫 server 的工具（`callServerTool`）或把訊息送回對話（`sendMessage`）。

整個流程：

```text
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

View 端拿到的 `App` 物件提供了這些方法：

- `callServerTool` — 呼叫 server 端的工具，取回結果更新 UI
- `sendMessage` — 以使用者身份傳送訊息至對話，**立即觸發 LLM 回應**
- `updateModelContext` — 靜默更新 LLM 上下文，資料會在下一輪對話時被 LLM 看到，但不觸發回應
- `readServerResource` — 讀取 server 端的資源
- `openLink` — 請求 Host 在瀏覽器開啟外部連結
- `downloadFile` — 請求 Host 下載檔案（sandbox 內無法直接下載）
- `requestDisplayMode` — 切換顯示模式（inline / fullscreen / pip）

其中 `sendMessage` 和 `updateModelContext` 是讓 MCP App 從「單向顯示」變成「雙向互動元件」的關鍵——後面會專門展開。

### 三種顯示模式

- `inline` — 嵌入對話流中，適合圖表、預覽
- `fullscreen` — 全螢幕接管，適合編輯器、複雜儀表板
- `pip` — 子母畫面，適合音樂播放器、計時器

---

## 生命週期

MCP Apps 定義了五個階段：

1. **Discovery** — Host 發現 server 的工具清單，看到哪些工具帶有 `_meta.ui` 元資料
2. **Initialize** — LLM 呼叫工具後，Host 建立 iframe、渲染 HTML、透過 `ui/initialize` 完成握手
3. **Data Delivery** — Host 把工具輸入和結果透過 postMessage 傳遞給 View
4. **Interactive** — 使用者在 View 中操作，View 透過 `callServerTool` 呼叫 server 工具的互動迴圈
5. **Teardown** — 對話結束或使用者關閉 UI，資源釋放

---

## 安全模型：sandbox iframe 的限制

這是跟傳統 web app 開發最大的差異——**你不能假設所有瀏覽器 API 都可用。**

預設的 CSP 只允許 `script-src 'self' 'unsafe-inline'`，這意味著：

- 需要 `eval()` 的函式庫不能直接用（Knockout.js、某些版本的 Handlebars、舊版 Angular template compiler）
- 外部資源載入預設被擋，除非 server 在 `_meta.ui.csp` 明確宣告允許的網域
- 沒有 `localStorage`、沒有 `sessionStorage`

我第一次試官方的 CesiumJS 地圖範例就踩到——CesiumJS 底層的 Knockout.js 需要 `eval()` 解析 binding，直接被 CSP 擋掉。這不是 bug，是設計。Server 可以透過 `_meta.ui.csp` 宣告額外的 CSP 規則，但 `unsafe-eval` 這種高風險權限，Host 不一定會放行。

打包方式推薦用 Vite + `vite-plugin-singlefile`，把所有資產 inline 進一個 HTML 檔案，避開外部資源載入被 CSP 擋的問題。

---

## 雙向資料流：不只是顯示，還能回話

到這裡為止，MCP App 的資料流看起來是單向的——LLM 產生資料、View 顯示。但真正有意思的是反過來：**使用者在 UI 裡操作後，能不能把結果送回 LLM？**

可以。MCP Apps 提供了兩個 API 讓 View 主動把資料推回對話。

### `sendMessage`：直接對 LLM 說話

```typescript
await app.sendMessage({
  role: "user",
  content: [{
    type: "text",
    text: `我修改了圖表：\n\`\`\`mermaid\n${code}\n\`\`\``,
  }],
});
```

效果等同於使用者在聊天框打字後按送出——訊息會出現在對話裡，**立即觸發 LLM 回應**。LLM 可以根據使用者在 UI 裡的操作繼續對話。

### `updateModelContext`：靜默同步狀態

```typescript
await app.updateModelContext({
  content: [{
    type: "text",
    text: `目前的 Mermaid source：\n\`\`\`mermaid\n${code}\n\`\`\``,
  }],
});
```

這個 API 不會觸發任何回應。它把資料放進一個「context slot」，LLM 在**下一輪**使用者主動發訊息時才會看到。每次呼叫都會覆蓋前一次的 context——只保留最新一份。

### 兩者的差異

| | `sendMessage` | `updateModelContext` |
| --- | --- | --- |
| 觸發 LLM 回應 | 立即觸發 | 不觸發 |
| 在對話裡可見 | 出現為一條 user 訊息 | 不出現在對話 UI |
| 多次呼叫 | 每次獨立訊息 | 後蓋前，只保留最新 |
| 適合場景 | 使用者完成操作、要求 LLM 回應 | 持續同步 UI 狀態、等使用者自己決定何時提問 |

想像一下這個模式套到不同場景：

- 表單填完後，`sendMessage` 把結構化資料送回 LLM，讓它幫你檢查或產生摘要
- 在地圖上選了一個區域，`updateModelContext` 同步座標，等使用者問「這附近有什麼餐廳？」時 LLM 就知道位置
- 在程式碼編輯器裡修改了一段 code，`sendMessage` 讓 LLM 立即 review

這改變了 MCP App 的定位。它不再只是「顯示 LLM 輸出的容器」，而是一個**完整的互動元件**——有 input、有使用者操作、有 output 回到 LLM。

---

## 用 Mermaid 圖表渲染器跑一遍

概念講完，用實際的範例走一遍。我做的 [mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 是一個 Mermaid 圖表渲染器——在對話裡直接嵌入可互動的圖表，支援拖曳平移、滾輪縮放、split-view 編輯器即時修改語法並 live re-render。

### 先跑起來看看

在 Claude Desktop 的設定檔加上：

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

完全關閉再重開 Claude Desktop，然後說「畫一個 user authentication 的 flowchart」。圖表會直接嵌在對話裡。

也有打包好的 Desktop Extension（`.mcpb`）——從 [GitHub Releases](https://github.com/finfin/mermaid-mcp-app/releases) 下載後雙擊即安裝，不需要 terminal 也不需要改設定檔。

### Server 端：註冊工具 + 提供 HTML

Server 端大約 100 行，核心就兩個 API。`registerAppTool` 定義工具，重點是 `_meta.ui.resourceUri` 把工具和 UI 綁在一起：

```typescript
registerAppTool(server, "render-mermaid", {
  title: "Render Mermaid Diagram",
  inputSchema: {
    code: z.string().describe("The Mermaid diagram syntax to render"),
    theme: z.enum(["default", "light", "dark", "forest", "neutral"]).optional(),
  },
  _meta: {
    ui: { resourceUri: "ui://mermaid/view.html" },  // 工具 ↔ UI 的連結點
  },
}, async ({ code, theme }) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ code, theme: theme ?? "default" }) }],
}));
```

`registerAppResource` 則把 Vite 打包好的單一 HTML 檔案作為 `ui://` 資源提供給 Host。Server 不做渲染——它只負責傳遞資料，渲染全部在 iframe 裡的前端完成。

### View 端：接收資料、渲染 UI

View 端是標準前端應用，用 `App` 類別建立 postMessage 通道：

```typescript
const app = new App(
  { name: "MermaidViewer", version: "1.0.0" },
  {},
  { autoResize: true },
);

app.ontoolinput = (params) => {
  // LLM 呼叫工具時，Host 先把工具參數傳過來（Server 還沒處理）
  renderDiagram(params.arguments.code, params.arguments.theme);
};

app.ontoolresult = (params) => {
  // Server 處理完後，Host 把工具結果傳過來
  const data = JSON.parse(params.content[0].text);
  renderDiagram(data.code, data.theme);
};

await app.connect();
```

`ontoolinput` 和 `ontoolresult` 是兩個時機——前者是 LLM 決定呼叫工具時（參數已確定但 Server 還沒處理），後者是 Server 回傳結果後。對不需要 Server 運算的場景，兩邊拿到的資料一樣；但對需要 Server 端計算的 MCP App（像 budget-allocator），兩者的資料會不同。

### 雙向互動：Send to AI

前面講的 `sendMessage` 和 `updateModelContext`，在 mermaid-mcp-app 裡有具體的實作。使用者打開 split-view 編輯器修改 Mermaid 語法後，有兩個按鈕：

**Sync Context（🔄）**——呼叫 `updateModelContext`，把當前 source 靜默同步給 LLM。LLM 不會立即回應，但使用者之後任何提問，LLM 都知道圖表被改過了。

**Send to AI（➤）**——呼叫 `sendMessage`，把修改後的完整 source 作為 user 訊息送出。LLM 立即看到並回應——可能是確認修改、提出建議、或根據修改繼續延伸對話。

```text
使用者在 editor 修改 Mermaid source
         ↓
   按 Sync Context → updateModelContext(source)
                      LLM 不回應，但下次提問時會知道修改內容
         或
   按 Send to AI   → sendMessage(source)
                      LLM 立即回應：「看起來你加了 2FA 步驟，要不要...」
```

### 打包策略

sandbox iframe 的 CSP 限制直接影響打包方式。View 端用 `vite-plugin-singlefile` 把所有 JS/CSS（包括 3MB 的 Mermaid.js）inline 進一個 HTML 檔案——不是最佳實踐，是 CSP 的必然結果。Server 端用 esbuild 打包成單一 JS 檔，發佈為 Desktop Extension（`.mcpb`）時整個 extension 只有 1.7MB。

### 踩到的坑

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

## 其他 Agent UI 標準

MCP Apps 不是唯一在做「AI 回應帶 UI」的標準。目前有三個協議在不同層面解決這個問題：

**MCP Apps** — Server 提供完整的 HTML 應用，Host 在 sandbox iframe 中執行。自由度最高，但受限於 iframe 隔離。跨平台支援最廣：Claude、ChatGPT、VS Code、Goose。

**A2UI**（Google 開源）— Agent 回傳純 JSON 結構描述 UI 元素（按鈕、文字欄位、卡片），Host 用自己的原生元件渲染。不傳可執行的程式碼，安全風險更低，UI 能完美融入 Host 設計系統。目前主要在 Google 生態系（Gemini、Flutter GenUI SDK）中使用。

**AG-UI**（CopilotKit 創建）— 不定義 UI 長什麼樣，而是標準化 agent 與前端之間的事件串流協議。定義了工具呼叫生命週期事件，讓前端能即時視覺化 agent 的每一步操作。

這三者不是競爭關係，而是不同層的協議：

- MCP Apps → Host 內嵌 UI（在別人的聊天介面裡顯示你的 UI）
- A2UI → 宣告式原生渲染（Agent 描述 UI 結構，Host 用自己的元件渲染）
- AG-UI → Agent↔前端事件串流（即時同步 agent 的操作狀態）

如果你想在現有的 AI 聊天介面裡嵌入互動式 UI，MCP Apps 是目前唯一跨平台的選項。如果你自己就是 Host（在自己的應用裡加 AI 功能），A2UI 或 AG-UI 可能更合適。

---

## 前端工程師可以做什麼

如果你想試 MCP Apps，建議的路徑：

1. **先裝來玩**——[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 或官方的 Budget Allocator，在 Claude Desktop 裡感受完整的互動流程
2. **自己做一個**——不需要很複雜，一個工具、一個 HTML 檔案就夠。用 DevTools 觀察 postMessage 的 JSON-RPC 訊息，那就是整個架構在運作的樣子
3. **打包發佈**——打包成 Desktop Extension（`.mcpb`）發佈到 GitHub Releases，讓非技術使用者也能雙擊安裝

說穿了，MCP Apps 代表的是：AI 的回應介面正在從純文字演化為互動式應用。而這個介面層需要的正是前端的核心能力——不只是把 LLM 的輸出變好看，更是讓使用者能在 UI 裡操作、產生內容、再推回 LLM 形成人機協作迴圈。

差別只在你的 UI 跑在一個有嚴格安全限制的 sandbox iframe 裡。能在這個約束下做出好體驗的人，會是最早定義「AI-native UI」長什麼樣的人。

ps. 完整原始碼在 [github.com/finfin/mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)，可以直接參考 Server 端和 View 端的實作。官方的 quickstart 和範例在 [github.com/modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)。
