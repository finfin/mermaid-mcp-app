# MCP Apps：當 AI 對話裡長出了互動式 UI

跟 AI 對話跟瀏覽網頁有個根本差異——對話是純文字的。LLM 再聰明，回應永遠是一段文字。圖表要你自己貼去其他工具渲染，表單要你自己開新分頁填，資料視覺化要你自己想辦法。

2026 年一月，[MCP Apps 規範](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)（SEP-1865）正式發布，把這件事改變了。MCP Server 現在可以在 Claude、VS Code Copilot 這些 AI 介面裡，直接嵌入互動式 HTML UI——圖表、表單、儀表板、地圖，什麼都行。

身為前端工程師，我對這個方向有很強的直覺：這不就是在寫前端嗎？只是你的 UI 跑在一個 sandbox iframe 裡。

花了一些時間研究規範之後，我做了一個自己很常用的 Mermaid 圖表互動工具（[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app)）。這篇就拿這個專案走一遍 MCP Apps 的架構，順便聊聊開發過程踩到的坑。

---

## MCP Apps 是什麼

### 三個角色

MCP Apps 的架構圍繞三個角色運作：

1. **MCP Server** — 後端。負責註冊工具（`registerAppTool`）和 HTML 資源（`registerAppResource`），工具定義裡的 `_meta.ui.resourceUri` 欄位把工具和 UI 綁在一起
2. **Host** — Claude Desktop、VS Code Copilot 這些 AI 介面。LLM 呼叫工具時，Host 執行工具、根據 `resourceUri` 取得 HTML、在 sandbox iframe 裡渲染
3. **View** — 跑在 iframe 裡的前端應用。用 `App` 類別建立與 Host 的 postMessage 通道，接收工具結果，也能反向呼叫 server 工具或把訊息送回對話

所有 View ↔ Server 的通訊都走 Host 代理，底層是標準的 JSON-RPC 2.0 over postMessage。這點很重要——你不需要自己處理 WebSocket 或 HTTP，MCP SDK 都幫你做好了。

```text
使用者提問 → LLM 決定呼叫工具 → Server 回傳結果
                                    ↓
                        Host 取得 ui:// HTML 資源
                                    ↓
                    sandbox iframe 渲染互動式 UI
                                    ↓
              使用者在 UI 中操作 → postMessage → Host → Server
```

### 生命週期

規範定義了四個階段：

1. **Discovery** — Host 連上 server 後看到工具清單，辨識哪些工具帶有 `_meta.ui` 元資料。Host 可以在這個階段預先取得 HTML 資源做快取和安全審查
2. **Initialize** — LLM 呼叫工具後，Host 建立 sandbox iframe、載入 HTML、透過 `ui/initialize` 完成握手。View 和 Host 在這個階段交換 capabilities——View 宣告支援哪些 display mode，Host 提供 theme、container dimensions 等上下文
3. **Interactive** — Host 把工具輸入（`tool-input`）和結果（`tool-result`）推給 View，View 渲染 UI。之後使用者在 UI 裡操作，View 可以透過 `callServerTool` 呼叫 server 工具、用 `sendMessage` 送訊息回對話、用 `updateModelContext` 同步狀態給 LLM
4. **Teardown** — 對話結束或使用者關閉 UI 時，Host 送出 `ui/resource-teardown` 讓 View 做清理

### 不只顯示，還能回話

純粹把 LLM 的輸出渲染得好看，其實不需要新規範——Markdown 就夠了。MCP Apps 真正有意思的地方是反過來：**使用者在 UI 裡操作後，能把結果送回 LLM。**

規範提供了兩個給 View 呼叫的關鍵 API：

**`sendMessage`** — 等同於使用者在聊天框打字。訊息會出現在對話裡，立即觸發 LLM 回應。

```typescript
await app.sendMessage({
  role: "user",
  content: [{ type: "text", text: `我修改了圖表：\n\`\`\`mermaid\n${code}\n\`\`\`` }],
});
```

**`updateModelContext`** — 靜默同步。不觸發回應，但 LLM 在下一輪使用者主動發訊息時會看到。每次呼叫覆蓋前一次，只保留最新一份。

```typescript
await app.updateModelContext({
  content: [{ type: "text", text: `目前的 Mermaid source：\n\`\`\`mermaid\n${code}\n\`\`\`` }],
});
```

|  | `sendMessage` | `updateModelContext` |
|---|---|---|
| 觸發 LLM 回應 | 立即 | 不觸發 |
| 在對話裡可見 | 出現為 user 訊息 | 不出現 |
| 多次呼叫 | 每次獨立 | 後蓋前，只留最新 |
| 適合場景 | 操作完成、要 LLM 回應 | 持續同步狀態、等使用者自己決定何時提問 |

這兩個 API 改變了 MCP App 的定位。它不再只是「顯示 LLM 輸出的容器」，而是一個完整的互動元件——有 input、有使用者操作、有 output 回到 LLM。想像一下：表單填完後 `sendMessage` 讓 LLM 幫你 review、在地圖上選了區域後 `updateModelContext` 同步座標等使用者問「附近有什麼餐廳」、在程式碼編輯器改了 code 後直接讓 LLM review。

除了上面兩個核心 API，View 還能呼叫 `callServerTool`（呼叫 server 端工具更新資料）、`openLink`（請 Host 開外部連結）、`downloadFile`（請 Host 下載檔案，因為 sandbox 內無法直接下載）、`requestDisplayMode`（切換 inline / fullscreen / pip）。

---

## 用 Mermaid 圖表渲染器走一遍

概念講完，用我做的 [mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 走一遍。這是一個 Mermaid 圖表渲染器——在對話裡直接嵌入可互動的圖表，支援拖曳平移、滾輪縮放、split-view 編輯器即時修改語法並 live re-render。

### 裝起來大概 30 秒

在 Claude Desktop 設定檔加上：

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

重開 Claude Desktop，說「畫一個 user authentication 的 flowchart」。圖表直接嵌在對話裡，可以拖、可以縮放、可以打開編輯器改語法。

也有打包好的 Desktop Extension（`.mcpb`）——從 [GitHub Releases](https://github.com/finfin/mermaid-mcp-app/releases) 下載後雙擊裝，不用 terminal。

### Server 端

Server 端大約 130 行，做三件事：

**註冊主要工具。** `registerAppTool` 定義 `render-mermaid` 工具，`_meta.ui.resourceUri` 指向 HTML 資源：

```typescript
registerAppTool(server, "render-mermaid", {
  title: "Render Mermaid Diagram",
  inputSchema: {
    code: z.string().describe("The Mermaid diagram syntax to render"),
    theme: z.enum(["default", "light", "dark", "forest", "neutral"]).optional(),
  },
  _meta: {
    ui: { resourceUri: "ui://mermaid/view.html" },
  },
}, async ({ code, theme }) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ code, theme: theme ?? "default" }) }],
}));
```

**提供 HTML 資源。** `registerAppResource` 把 Vite 打包好的單一 HTML 檔案作為 `ui://` 資源供 Host 取用。Server 不做渲染——它只傳資料，渲染全在 iframe 的前端完成。

**內部工具做 draft persistence。** 另外註冊了 `save-mermaid-draft` 和 `get-mermaid-draft` 兩個 tool，讓 View 可以把使用者的編輯存到 server 記憶體裡，iframe 重新渲染時恢復。這兩個工具不是給 LLM 用的，只有 View 透過 `callServerTool` 呼叫。

### View 端

View 端是標準前端應用，用 `App` 類別建立 postMessage 通道：

```typescript
const app = new App(
  { name: "MermaidViewer", version: "1.0.0" },
  {},
  { autoResize: true },
);

app.ontoolinput = (params) => {
  // LLM 呼叫工具時，Host 先把工具參數傳過來（Server 還沒處理）
  handleMermaidData(params.arguments);
};

app.ontoolresult = (params) => {
  // Server 處理完後，Host 把完整結果傳過來
  const data = JSON.parse(params.content[0].text);
  handleMermaidData(data);
};

await app.connect();
```

`ontoolinput` 和 `ontoolresult` 是兩個時機——前者是 LLM 決定呼叫工具時（參數已確定但 Server 還沒處理），後者是 Server 回傳結果後。對不需要 Server 運算的場景（像 mermaid-mcp-app），兩邊拿到的資料基本一樣，可以用 `ontoolinput` 搶先渲染。但對需要 Server 端計算的場景，兩者資料會不同。

規範還支援 `ontoolinputpartial`——LLM streaming 產生工具參數時，Host 嘗試把不完整的 JSON 修補成合法格式推給 View。對 Mermaid 來說不太實用（不完整的語法通常不能渲染），但對文字類的 UI 可以做 progressive rendering。

### 雙向互動實作

使用者打開 split-view 編輯器修改 Mermaid 語法後，有兩個操作：

**自動同步（auto context sync）**——使用者每次修改，debounced 後自動呼叫 `updateModelContext`，把當前 source 靜默同步給 LLM。LLM 不會立即回應，但使用者之後任何提問都會帶上最新的圖表狀態。

**Send to AI（⌘ Enter）**——呼叫 `sendMessage`，把修改後的完整 source 作為 user 訊息送出。LLM 立即看到並回應。

```text
使用者在 editor 修改 Mermaid source
         ↓
   自動觸發  → updateModelContext(source)
               LLM 不回應，但下次提問時知道修改內容
         或
   按 ⌘ Enter → sendMessage(source)
               LLM 立即回應：「看起來你加了 2FA 步驟，要不要...」
```

---

## 開發經驗與限制

### sandbox iframe 的 CSP 限制

這是影響最大的限制。所有 View 都在 sandbox iframe 裡跑，預設的 CSP 是：

```
default-src 'none';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'none';
```

這意味著：

- 需要 `eval()` 的函式庫不能直接用（Knockout.js、某些版本的 Handlebars、舊版 Angular template compiler）
- 外部資源載入預設被擋——沒有 CDN、沒有 Google Fonts、沒有外部 API call
- 沒有 `localStorage`、沒有 `sessionStorage`
- 沒有 `allow-downloads`，檔案下載要透過 `ui/download-file` 請 Host 代理

Server 可以透過 `_meta.ui.csp` 宣告額外需要的網域（`connectDomains`、`resourceDomains`、`frameDomains`），但 Host 不一定放行。`unsafe-eval` 這種高風險權限基本別指望。

我第一次試官方的 CesiumJS 地圖範例就踩到了——CesiumJS 底層的 Knockout.js 需要 `eval()` 解析 binding，直接被 CSP 擋掉。這不是 bug，是設計。

**打包方式的結論：** 把所有資產 inline 進一個 HTML 檔案。我用 Vite + `vite-plugin-singlefile`，把 3MB 的 Mermaid.js 連同所有 CSS 全部 inline——不是最佳實踐，是 CSP 的必然結果。

### 踩到的坑

**stdio transport 的 stdout 污染。** 這個最陰險。stdio transport 要求 stdout 只能有 JSON-RPC 訊息，任何 `console.log` 都會破壞通訊讓 Host 無法解析回應。debug 一律用 `console.error`（寫到 stderr）。我第一次連不上就是因為某個依賴在 stdout 印了 warning。

**初次渲染的 iframe 高度問題。** 這個坑比看起來難處理很多，值得單獨說清楚。

**規範定義的做法：讀 `containerDimensions`**

規範其實有明確規定怎麼處理尺寸。Host 在回應 `ui/initialize` 時，`hostContext` 裡會帶 `containerDimensions`，告訴 View 它在什麼樣的容器裡：

```typescript
interface HostContext {
  containerDimensions?: (
    | { height: number }      // fixed：Host 控制高度，View 應該填滿
    | { maxHeight?: number }  // flexible：View 自己決定高度，但不超過上限
  ) & (
    | { width: number }       // fixed：Host 控制寬度
    | { maxWidth?: number }   // flexible：View 自己決定寬度
  );
}
```

規範定義了三種模式：

| 模式 | 欄位 | 意義 |
| --- | --- | --- |
| Fixed | `height` / `width` | Host 控制大小，View 應該 `100vh` / `100vw` 填滿 |
| Flexible | `maxHeight` / `maxWidth` | View 自己決定大小，不超過上限 |
| Unbounded | 欄位省略 | View 自己決定大小，沒有上限 |

規範建議的 View 處理邏輯：

```typescript
// 在 app.connect() 拿到 hostContext 之後執行
const dims = hostContext.containerDimensions;
if (dims) {
  if ("height" in dims) {
    // Fixed：填滿 Host 給的空間
    document.documentElement.style.height = "100vh";
  } else if ("maxHeight" in dims && dims.maxHeight) {
    // Flexible：讓內容自己撐高，但不超過上限
    document.documentElement.style.maxHeight = `${dims.maxHeight}px`;
  }
  // Unbounded：不設限，View 自由成長

  if ("width" in dims) {
    document.documentElement.style.width = "100vw";
  } else if ("maxWidth" in dims && dims.maxWidth) {
    document.documentElement.style.maxWidth = `${dims.maxWidth}px`;
  }
}
```

SDK 的 `autoResize: true` 會用 ResizeObserver 偵測 body 大小，透過 `ui/notifications/size-changed` 通知 Host 更新 iframe 的實際高度。Host 收到後調整 iframe 尺寸。

**那剩下的問題是什麼？**

`containerDimensions` 解決的是「View 應該用多少空間」，但還有一個時序問題：非同步內容（Mermaid 圖表是非同步渲染的）可能在 ResizeObserver 第一次量尺寸時還沒出現，導致通知了錯誤的高度。

針對這個問題，實際有效的做法：

```css
/* 設 min-height 防止在內容載入前通報 0px */
#diagram-container {
  min-height: max(70vh, 300px);
}
```

```typescript
// 非同步內容渲染完之後，用 double rAF 確保 DOM 穩定
// 再加 300ms timeout 給比較慢的圖表（mindmap、requirement 等）
resetView();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    fitToContainer();
    setTimeout(fitToContainer, 300);
  });
});
```

```typescript
// 量尺寸用 getBoundingClientRect()，不要用 scrollHeight
// scrollHeight 在某些情況會包含 overflow 內容，導致高度被高估
const rect = innerEl.getBoundingClientRect();
```

**總結成實務規則：**

1. 先讀 `hostContext.containerDimensions`，根據模式套對應的 CSS
2. Fixed 模式用 `100vh`/`100vw` 填滿；Flexible 模式用 `maxHeight`/`maxWidth`
3. 不要對 Flexible/Unbounded 模式硬寫 `height: 100vh`——這會造成 iframe 高度的循環依賴
4. 非同步內容渲染完後用 double rAF + setTimeout 確保 ResizeObserver 量到穩定的尺寸
5. 如果你的 UI 高度是固定的（表單、dashboard），直接在 CSS 寫死 px 值最省事，不需要動態計算

**Draft persistence 需要自己做。** sandbox iframe 沒有 localStorage，而 Host 隨時可能重新渲染 iframe——對話滾動超出視窗、使用者切換分頁、Host 更新 UI，都可能觸發。這代表使用者在編輯器裡改了半天的 Mermaid 語法，一個不注意就全部消失，而且完全沒有提示。這不是 edge case，是常態。我的做法是在 server 端開兩個 internal tool（`save-mermaid-draft` / `get-mermaid-draft`），View 每次修改都透過 `callServerTool` 把 draft 存到 server 記憶體，iframe 重建後立即恢復。用原始 code 的 hash 當 key，避免同一對話裡多個圖表互相覆蓋。

### 生態現況

**Host 支援有限。** 目前確認支援的有 Claude Desktop、VS Code Copilot、Goose、Postman、MCPJam。規範要求 server 必須提供純文字 fallback——不支援 MCP Apps 的 Host 會退回普通文字，工具本身不會壞掉。

**規範仍在演化。** SEP-1865 在 2025 年 11 月由 MCP-UI 社群和 OpenAI Apps SDK 的經驗彙整而成，目前是 Final 狀態但仍有活躍的 PR。未來可能加入 external URL 支援、state persistence、View-to-View 通訊等。

**安全性隱憂。** 根據 Astrix Research 的分析，超過半數的開源 MCP server 依賴不安全的靜態密鑰，僅 8.5% 使用 OAuth。MCP Apps 本身的安全模型（sandbox + CSP + auditable JSON-RPC）是合理的，但整個 MCP 生態的安全成熟度還有很大改善空間。

---

## Takeaways

1. **MCP Apps 就是在寫前端，只是跑在 sandbox iframe 裡。** Vite、TypeScript、任何不依賴 `eval` 的前端框架都能用。你需要額外處理的是 CSP 限制和 Host 端的 capability negotiation，但核心開發體驗跟寫一般 SPA 沒有太大差別

2. **雙向資料流是關鍵。** 單純把 LLM 輸出渲染好看不需要新規範，Markdown 就夠了。`sendMessage` 和 `updateModelContext` 讓 UI 操作的結果可以推回 LLM，這才是 MCP Apps 真正有意思的地方——使用者在 UI 裡做的事，LLM 知道

3. **sandbox 限制是真的。** 沒有 `eval`、沒有 localStorage、外部資源預設擋掉。選函式庫的時候要先確認，打包策略要用 single-file inline。這個限制短期內不太會改——它是安全模型的核心

4. **從小東西開始做。** 一個工具、一個 HTML 檔案就能跑。不需要先搞懂整個規範，裝好跑起來、用 DevTools 看 postMessage 的 JSON-RPC 訊息，那就是架構在運作的樣子

5. **生態早期，值得卡位。** 如果你是前端，這是目前少數「前端技能直接適用」的 AI 開發方向。不是在寫 prompt、不是在串 API，就是在寫介面——只是你的介面跑在 AI 對話裡

想試的話，[mermaid-mcp-app](https://github.com/finfin/mermaid-mcp-app) 的 source code 大概 900 行（server 130 + view 780），可以當作 MCP Apps 的起步範本。官方的 [ext-apps examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples) 也有不同複雜度的範例。

ps. 說穿了，MCP Apps 代表的就是：AI 的回應介面正在從純文字演化成互動式應用。而這個介面層需要的正是前端的核心能力。差別只在你的 UI 跑在一個嚴格的 sandbox 裡。能在這個約束下做出好體驗的人，會是最早定義「AI-native UI」長什麼樣的人。
