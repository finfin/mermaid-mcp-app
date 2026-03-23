import mermaid from "mermaid";
import { App } from "@modelcontextprotocol/ext-apps/app-with-deps";
import { ZoomIn, ZoomOut, RotateCcw, Copy, Code2, ClipboardCopy, Check, ClipboardCheck, Columns2, Rows2, SendHorizontal, Minimize2, Maximize2, type IconNode } from "lucide";
import { DARK_THEME_VARIABLES } from "./dark-theme.const";
import { LIGHT_THEME_VARIABLES } from "./light-theme.const";

// ─── Lucide icon helper ─────────────────────────────
function lucideIcon(data: IconNode, size = 16): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attrs] of data) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) el.setAttribute(k, String(v));
    }
    svg.appendChild(el);
  }
  return svg;
}

// Swap all SVG children in a button to a new icon, restore after `ms`
function flashIcon(btn: Element, next: IconNode, original: IconNode, ms = 5000) {
  const svg = btn.querySelector("svg");
  if (svg) svg.remove();
  btn.appendChild(lucideIcon(next));
  setTimeout(() => {
    const cur = btn.querySelector("svg");
    if (cur) cur.remove();
    btn.appendChild(lucideIcon(original));
  }, ms);
}

// ─── MCP App instance (module-level so event handlers can reach it) ───────
let mcpApp: App | null = null;

// ─── State ──────────────────────────────────────────────────
let renderCounter = 0;
let isFirstRender = true;

// Pan & Zoom state
let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SENSITIVITY = 0.002;

// ─── DOM refs ───────────────────────────────────────────────
const loadingEl = document.getElementById("loading")!;
const mainArea = document.getElementById("main-area")!;
const diagramEl = document.getElementById("diagram-container")!;
const innerEl = document.getElementById("diagram-inner")!;
const errorEl = document.getElementById("error")!;
const toolbar = document.getElementById("toolbar")!;
const editorPanel = document.getElementById("editor-panel")!;
const sourceEditor = document.getElementById("source-editor") as HTMLTextAreaElement;
const copySourceBtn = document.getElementById("btn-copy-source") as HTMLButtonElement;
const toggleLayoutBtn = document.getElementById("btn-toggle-layout") as HTMLButtonElement;
const sendToAiBtn = document.getElementById("btn-send-to-ai") as HTMLButtonElement;
const minimizeEditorBtn = document.getElementById("btn-minimize-editor") as HTMLButtonElement;
const verticalSplitBtn = document.getElementById("btn-vertical-split") as HTMLButtonElement;
const horizontalSplitBtn = document.getElementById("btn-horizontal-split") as HTMLButtonElement;
const copySourceBtnC = document.getElementById("btn-copy-source-c") as HTMLButtonElement;
const sendToAiBtnC = document.getElementById("btn-send-to-ai-c") as HTMLButtonElement;
const editorBody = document.getElementById("editor-body")!;
const collapsedBar = document.getElementById("editor-collapsed-bar")!;
const splitDivider = document.getElementById("split-divider")!;

// ─── Populate toolbar icons ──────────────────────────────────
document.getElementById("btn-zoom-in")!.appendChild(lucideIcon(ZoomIn));
document.getElementById("btn-zoom-out")!.appendChild(lucideIcon(ZoomOut));
document.getElementById("btn-reset")!.appendChild(lucideIcon(RotateCcw));
document.getElementById("btn-copy-svg")!.appendChild(lucideIcon(Copy));
copySourceBtn.appendChild(lucideIcon(ClipboardCopy));
toggleLayoutBtn.appendChild(lucideIcon(Columns2));
toggleLayoutBtn.title = "Horizontal Split";
sendToAiBtn.appendChild(lucideIcon(SendHorizontal));
minimizeEditorBtn.appendChild(lucideIcon(Minimize2));
verticalSplitBtn.appendChild(lucideIcon(Columns2));
horizontalSplitBtn.appendChild(lucideIcon(Rows2));
copySourceBtnC.appendChild(lucideIcon(ClipboardCopy));
sendToAiBtnC.appendChild(lucideIcon(SendHorizontal));

// ─── Dark mode detection ────────────────────────────────────
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");


function resolveTheme(requested?: string): string {
  // "light" = explicitly force Mermaid's default (light) theme, skip auto-detect
  if (requested === "light") return "default";
  // Any other explicit theme (dark, forest, neutral) — respect it directly
  if (requested && requested !== "default") return requested;
  // "default" or unset = auto-pick based on system color scheme
  return prefersDark.matches ? "dark" : "default";
}

function getMermaidConfig(theme: string) {
  const isDark = theme === "dark";
  const isLight = theme === "default";
  return {
    startOnLoad: false,
    theme: (isDark || isLight) ? ("base" as const) : (theme as any),
    securityLevel: "loose" as const,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    useMaxWidth: false,
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    ...(isDark ? { themeVariables: DARK_THEME_VARIABLES } : {}),
    ...(isLight ? { themeVariables: LIGHT_THEME_VARIABLES } : {}),
  };
}

// ─── Mermaid init ───────────────────────────────────────────
mermaid.initialize(getMermaidConfig(resolveTheme()) as any);

// ─── Pan & Zoom helpers ─────────────────────────────────────
function applyTransform() {
  innerEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function resetView() {
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function fitToContainer() {
  if (!innerEl.querySelector("svg")) return;
  const containerRect = diagramEl.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) return;

  // Measure innerEl at scale=1 (resetView must be called before this).
  // innerEl includes the 24px padding on all sides, so this is the true
  // content size that will be scaled and translated.
  const innerRect = innerEl.getBoundingClientRect();
  const contentW = innerRect.width;
  const contentH = innerRect.height;
  if (contentW === 0 || contentH === 0) return;

  const fitScale = Math.min(
    containerRect.width / contentW,
    containerRect.height / contentH,
    1.5, // don't over-zoom small diagrams
  );
  scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));
  panX = (containerRect.width - contentW * scale) / 2;
  panY = (containerRect.height - contentH * scale) / 2;
  applyTransform();
}

// ── Mouse wheel zoom (zoom toward cursor) ──
diagramEl.addEventListener(
  "wheel",
  (e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (1 + delta)));

    // Zoom toward mouse position
    const rect = diagramEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Adjust pan so the point under the cursor stays fixed
    const ratio = newScale / scale;
    panX = mx - ratio * (mx - panX);
    panY = my - ratio * (my - panY);
    scale = newScale;

    applyTransform();
  },
  { passive: false },
);

// ── Mouse drag pan ──
diagramEl.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0) return; // left button only
  isPanning = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
  diagramEl.classList.add("grabbing");
});

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isPanning) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  applyTransform();
});

window.addEventListener("mouseup", () => {
  if (!isPanning) return;
  isPanning = false;
  diagramEl.classList.remove("grabbing");
});

// ── Touch pan & pinch zoom ──
let lastTouchDist = 0;
let lastTouchMid = { x: 0, y: 0 };

diagramEl.addEventListener(
  "touchstart",
  (e: TouchEvent) => {
    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastTouchDist = Math.hypot(dx, dy);
      lastTouchMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  },
  { passive: false },
);

diagramEl.addEventListener(
  "touchmove",
  (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };

      if (lastTouchDist > 0) {
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, scale * (dist / lastTouchDist)),
        );
        const rect = diagramEl.getBoundingClientRect();
        const mx = mid.x - rect.left;
        const my = mid.y - rect.top;
        const ratio = newScale / scale;
        panX = mx - ratio * (mx - panX) + (mid.x - lastTouchMid.x);
        panY = my - ratio * (my - panY) + (mid.y - lastTouchMid.y);
        scale = newScale;
      }

      lastTouchDist = dist;
      lastTouchMid = mid;
      applyTransform();
    }
  },
  { passive: false },
);

diagramEl.addEventListener("touchend", () => {
  isPanning = false;
  lastTouchDist = 0;
});

// ─── Layout stability helper ────────────────────────────────
/**
 * Wait until `targets` stop resizing for `stableMs` consecutive milliseconds.
 * Resolves once layout is stable, or after `timeoutMs` as a fallback.
 */
function waitForStableLayout(
  targets: Element[],
  stableMs = 200,
  timeoutMs = 2000,
): Promise<void> {
  return new Promise((resolve) => {
    let debounce: ReturnType<typeof setTimeout>;

    const done = () => {
      observer.disconnect();
      clearTimeout(fallback);
      clearTimeout(debounce);
      resolve();
    };

    const observer = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(done, stableMs);
    });

    for (const el of targets) observer.observe(el);

    // Kick-start: if no resize events fire at all, resolve after stableMs
    debounce = setTimeout(done, stableMs);
    // Hard upper-bound
    const fallback = setTimeout(done, timeoutMs);
  });
}

// ─── Render helper ──────────────────────────────────────────
async function renderDiagram(
  code: string,
  theme = "default",
  title = "",
) {
  currentTheme = theme;
  currentTitle = title;

  // Re-init mermaid with the chosen theme (auto-detect dark mode)
  const effectiveTheme = resolveTheme(theme);
  mermaid.initialize(getMermaidConfig(effectiveTheme) as any);

  try {
    // Clear previous
    innerEl.innerHTML = "";
    errorEl.classList.remove("is-visible");

    // Each render needs a unique id
    renderCounter++;
    const id = `mermaid-output-${renderCounter}`;
    const { svg } = await mermaid.render(id, code);
    innerEl.innerHTML = svg;

    diagramEl.classList.add("is-visible");
    toolbar.classList.add("visible");
    loadingEl.classList.add("is-hidden");

    // Update source editor (only if user isn't actively editing)
    if (!sourceEditorDirty) {
      sourceEditor.value = code;
    }

    if (isFirstRender) {
      // Initial load: wait for fonts & container size to stabilise before fitting.
      isFirstRender = false;
      await document.fonts.ready;
      await waitForStableLayout([diagramEl, innerEl]);
      resetView();
      fitToContainer();
    } else {
      // Subsequent renders: lightweight double-rAF is enough.
      resetView();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitToContainer();
        });
      });
    }
  } catch (err: any) {
    diagramEl.classList.remove("is-visible");
    toolbar.classList.remove("visible");
    errorEl.textContent =
      "⚠ Mermaid Syntax Error\n\n" + (err.message || String(err));
    errorEl.classList.add("is-visible");
    loadingEl.classList.add("is-hidden");
  }
}

// ─── Toolbar buttons ────────────────────────────────────────
document.getElementById("btn-zoom-in")!.addEventListener("click", () => {
  const rect = diagramEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const newScale = Math.min(MAX_SCALE, scale * 1.25);
  const ratio = newScale / scale;
  panX = cx - ratio * (cx - panX);
  panY = cy - ratio * (cy - panY);
  scale = newScale;
  applyTransform();
});

document.getElementById("btn-zoom-out")!.addEventListener("click", () => {
  const rect = diagramEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const newScale = Math.max(MIN_SCALE, scale / 1.25);
  const ratio = newScale / scale;
  panX = cx - ratio * (cx - panX);
  panY = cy - ratio * (cy - panY);
  scale = newScale;
  applyTransform();
});

document.getElementById("btn-reset")!.addEventListener("click", () => {
  resetView();
  requestAnimationFrame(() => fitToContainer());
});

document.getElementById("btn-copy-svg")!.addEventListener("click", () => {
  const btn = document.getElementById("btn-copy-svg")!;
  const svgEl = innerEl.querySelector("svg");
  if (!svgEl) return;
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  navigator.clipboard.writeText(svgStr).then(
    () => flashIcon(btn, Check, Copy),
    () => {},
  );
});

// ─── Source editor state ─────────────────────────────────────
let sourceEditorDirty = false; // true once user starts editing
let currentTheme = "default";
let currentTitle = "";
let editorVisible = true;
let editorMinimized = false;
let isHorizontalLayout = false;
let reRenderTimer: ReturnType<typeof setTimeout> | null = null;
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
let draftId: string | null = null; // hash of original code, identifies this diagram instance
const RE_RENDER_DELAY = 400; // ms debounce
const DRAFT_SAVE_DELAY = 800; // ms debounce for saving draft to server

// Simple string hash for draft keying (FNV-1a inspired)
function hashCode(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ── Minimize / expand editor ──
function minimizeEditor() {
  editorMinimized = true;
  // Minimized always snaps to bottom (vertical layout)
  if (isHorizontalLayout) {
    isHorizontalLayout = false;
    editorPanel.style.width = "";
    editorPanel.style.height = "";
    mainArea.classList.remove("layout-horizontal");
  }
  editorBody.classList.add("is-hidden");
  collapsedBar.classList.add("is-visible");
  splitDivider.classList.remove("is-visible");
  resetView();
  requestAnimationFrame(() => fitToContainer());
}

function expandEditor() {
  editorMinimized = false;
  editorBody.classList.remove("is-hidden");
  collapsedBar.classList.remove("is-visible");
  splitDivider.classList.add("is-visible");
  resetView();
  requestAnimationFrame(() => fitToContainer());
}

// Expand into a specific layout from minimized state
function expandToLayout(horizontal: boolean) {
  editorMinimized = false;
  editorBody.classList.remove("is-hidden");
  collapsedBar.classList.remove("is-visible");
  splitDivider.classList.add("is-visible");
  editorPanel.style.width = "";
  editorPanel.style.height = "";
  isHorizontalLayout = horizontal;
  if (horizontal) {
    mainArea.classList.add("layout-horizontal");
  } else {
    mainArea.classList.remove("layout-horizontal");
  }
  // Update toggle layout button icon + tooltip in expanded state
  const svg = toggleLayoutBtn.querySelector("svg");
  if (svg) svg.remove();
  toggleLayoutBtn.appendChild(lucideIcon(horizontal ? Rows2 : Columns2));
  toggleLayoutBtn.title = horizontal ? "Vertical Split" : "Horizontal Split";
  resetView();
  requestAnimationFrame(() => fitToContainer());
}

minimizeEditorBtn.addEventListener("click", minimizeEditor);
verticalSplitBtn.addEventListener("click", () => expandToLayout(true));
horizontalSplitBtn.addEventListener("click", () => expandToLayout(false));

// Collapsed-bar action buttons mirror their expanded counterparts
copySourceBtnC.addEventListener("click", () => copySourceBtn.click());
sendToAiBtnC.addEventListener("click", () => sendToAiBtn.click());

// ── Live re-render on edit ──
sourceEditor.addEventListener("input", () => {
  sourceEditorDirty = true;
  if (reRenderTimer) clearTimeout(reRenderTimer);
  reRenderTimer = setTimeout(() => {
    const code = sourceEditor.value.trim();
    if (code) {
      renderDiagram(code, currentTheme, currentTitle);
    }
  }, RE_RENDER_DELAY);

  // Auto-save draft + auto-sync context (debounced, keyed by draftId)
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    const code = sourceEditor.value.trim();
    if (code && mcpApp && draftId) {
      mcpApp.callServerTool({ name: "save-mermaid-draft", arguments: { draftId, code } })
        .catch((err) => console.warn("[MermaidApp] Failed to save draft:", err));
    }
    // Auto-sync context so LLM always sees the latest source
    syncContextOnly();
  }, DRAFT_SAVE_DELAY);
});

// Allow Tab key to insert tab in textarea; Cmd/Ctrl+Enter to send to AI
sourceEditor.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = sourceEditor.selectionStart;
    const end = sourceEditor.selectionEnd;
    sourceEditor.value = sourceEditor.value.substring(0, start) + "  " + sourceEditor.value.substring(end);
    sourceEditor.selectionStart = sourceEditor.selectionEnd = start + 2;
    // Trigger re-render
    sourceEditor.dispatchEvent(new Event("input"));
  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    // Cmd/Ctrl+Enter → send to AI (triggers LLM response)
    e.preventDefault();
    sendSourceToAi();
  }
});

// ─── Sync context only (silent — no LLM response triggered) ──
async function syncContextOnly() {
  if (!mcpApp) return;
  const code = sourceEditor.value.trim();
  if (!code) return;

  // Only updateModelContext — LLM will see this on the NEXT user message
  await mcpApp.updateModelContext({
    content: [{
      type: "text",
      text: `Current Mermaid diagram source (updated by user):\n\`\`\`mermaid\n${code}\n\`\`\``,
    }],
  });
  console.log("[MermaidApp] Context synced (silent, no LLM turn triggered)");
}

// ─── Send to AI (triggers LLM response) ───────────────────────
async function sendSourceToAi() {
  if (!mcpApp) return;
  const code = sourceEditor.value.trim();
  if (!code) return;

  flashIcon(sendToAiBtn, Check, SendHorizontal, 2000);

  // Send full source directly as user message
  await mcpApp.sendMessage({
    role: "user",
    content: [{
      type: "text",
      text: `I've updated the Mermaid diagram source:\n\`\`\`mermaid\n${code}\n\`\`\``,
    }],
  });
  console.log("[MermaidApp] Sent to AI (LLM turn triggered)");
}

sendToAiBtn.addEventListener("click", () => sendSourceToAi());

// ── Toggle layout (vertical ↔ horizontal) ──
function updateLayoutTooltips() {
  const label = isHorizontalLayout ? "Vertical Split" : "Horizontal Split";
  toggleLayoutBtn.title = label;
}

function doToggleLayout() {
  isHorizontalLayout = !isHorizontalLayout;
  // Clear any inline size from the previous layout direction
  editorPanel.style.width = "";
  editorPanel.style.height = "";
  if (isHorizontalLayout) {
    mainArea.classList.add("layout-horizontal");
  } else {
    mainArea.classList.remove("layout-horizontal");
  }
  // Swap icon + tooltip
  const svg = toggleLayoutBtn.querySelector("svg");
  if (svg) svg.remove();
  toggleLayoutBtn.appendChild(lucideIcon(isHorizontalLayout ? Rows2 : Columns2));
  updateLayoutTooltips();
  // Reset view after layout change
  resetView();
  requestAnimationFrame(() => fitToContainer());
}
toggleLayoutBtn.addEventListener("click", doToggleLayout);

// ── Draggable split divider ──
let isDraggingSplit = false;

splitDivider.addEventListener("mousedown", (e: MouseEvent) => {
  e.preventDefault();
  isDraggingSplit = true;
  splitDivider.classList.add("is-dragging");
  document.body.style.cursor = isHorizontalLayout ? "col-resize" : "row-resize";
  document.body.style.userSelect = "none";
});

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isDraggingSplit) return;
  const mainRect = mainArea.getBoundingClientRect();

  if (isHorizontalLayout) {
    const x = e.clientX - mainRect.left;
    const ratio = Math.max(0.1, Math.min(0.9, x / mainRect.width));
    editorPanel.style.width = `${(1 - ratio) * 100}%`;
    editorPanel.style.height = "";
  } else {
    const y = e.clientY - mainRect.top;
    const ratio = Math.max(0.1, Math.min(0.9, y / mainRect.height));
    editorPanel.style.height = `${(1 - ratio) * 100}%`;
    editorPanel.style.width = "";
  }
});

window.addEventListener("mouseup", () => {
  if (!isDraggingSplit) return;
  isDraggingSplit = false;
  splitDivider.classList.remove("is-dragging");
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

// Touch support for divider
splitDivider.addEventListener("touchstart", (e: TouchEvent) => {
  e.preventDefault();
  isDraggingSplit = true;
  splitDivider.classList.add("is-dragging");
}, { passive: false });

window.addEventListener("touchmove", (e: TouchEvent) => {
  if (!isDraggingSplit) return;
  const touch = e.touches[0];
  const mainRect = mainArea.getBoundingClientRect();

  if (isHorizontalLayout) {
    const x = touch.clientX - mainRect.left;
    const ratio = Math.max(0.1, Math.min(0.9, x / mainRect.width));
    editorPanel.style.width = `${(1 - ratio) * 100}%`;
    editorPanel.style.height = "";
  } else {
    const y = touch.clientY - mainRect.top;
    const ratio = Math.max(0.1, Math.min(0.9, y / mainRect.height));
    editorPanel.style.height = `${(1 - ratio) * 100}%`;
    editorPanel.style.width = "";
  }
}, { passive: false });

window.addEventListener("touchend", () => {
  if (!isDraggingSplit) return;
  isDraggingSplit = false;
  splitDivider.classList.remove("is-dragging");
});

copySourceBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(sourceEditor.value ?? "").then(
    () => { flashIcon(copySourceBtn, ClipboardCheck, ClipboardCopy); },
    () => {},
  );
});

// ─── Parse incoming data ────────────────────────────────────
function handleMermaidData(data: Record<string, unknown>) {
  const code = data.code as string | undefined;
  const theme = (data.theme as string) || "default";
  const title = (data.title as string) || "";
  if (code) {
    renderDiagram(code, theme, title);
  }
}

function handleContentBlocks(content: any[]) {
  for (const block of content) {
    if (block.type === "text" && block.text) {
      try {
        const data = JSON.parse(block.text);
        if (data.code) {
          handleMermaidData(data);
          return;
        }
      } catch {
        // If it's not JSON, try rendering as raw mermaid
        renderDiagram(block.text);
        return;
      }
    }
  }
}

// ─── MCP App connection ─────────────────────────────────────
async function initApp() {
  try {
    const app = new App(
      { name: "MermaidViewer", version: "1.0.0" },
      {}, // capabilities
      { autoResize: true },
    );

    // Handle complete tool input (arguments from the LLM)
    app.ontoolinput = (params) => {
      console.log("[MermaidApp] ontoolinput:", params);
      if (params.arguments) {
        const args = params.arguments as Record<string, unknown>;
        // Generate draftId from original code on first receive
        if (!draftId && args.code) {
          draftId = hashCode(args.code as string);
        }
        handleMermaidData(args);
      }
    };

    // Handle streaming partial input — show a preview when possible
    app.ontoolinputpartial = (params) => {
      console.log("[MermaidApp] ontoolinputpartial:", params);
      // Could attempt progressive rendering, but incomplete mermaid syntax
      // often fails. We just keep the loading state.
    };

    // Handle tool result (after the server processes the tool call)
    app.ontoolresult = (params) => {
      console.log("[MermaidApp] ontoolresult:", params);
      if (params.content) {
        // Extract original code for draftId if not set yet
        if (!draftId) {
          for (const block of params.content as any[]) {
            if (block.type === "text" && block.text) {
              try {
                const data = JSON.parse(block.text);
                if (data.code) {
                  draftId = hashCode(data.code);
                  break;
                }
              } catch { /* not JSON */ }
            }
          }
        }
        handleContentBlocks(params.content);
      }
    };

    await app.connect();
    mcpApp = app;
    console.log("[MermaidApp] Connected to host");

    // Restore user's draft if available (survives iframe re-renders)
    // Wait a tick for ontoolinput/ontoolresult to fire and set draftId
    setTimeout(async () => {
      if (!draftId) return;
      try {
        const draftResult = await app.callServerTool({
          name: "get-mermaid-draft",
          arguments: { draftId },
        });
        const draftText = draftResult?.content?.[0];
        if (draftText && "text" in draftText && draftText.text) {
          console.log("[MermaidApp] Restoring draft for", draftId);
          sourceEditorDirty = true;
          sourceEditor.value = draftText.text;
          renderDiagram(draftText.text, currentTheme, currentTitle);
        }
      } catch (err) {
        console.warn("[MermaidApp] Could not restore draft:", err);
      }
    }, 500);
  } catch (err) {
    console.error("[MermaidApp] Failed to connect:", err);
  }
}

initApp();
