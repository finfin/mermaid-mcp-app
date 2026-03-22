import mermaid from "mermaid";
import { App } from "@modelcontextprotocol/ext-apps/app-with-deps";
import { ZoomIn, ZoomOut, RotateCcw, Copy, Code2, ClipboardCopy, Check, ClipboardCheck, type IconNode } from "lucide";
import { DARK_THEME_VARIABLES } from "./dark-theme.const";

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

// ─── State ──────────────────────────────────────────────────
let renderCounter = 0;

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
const diagramEl = document.getElementById("diagram-container")!;
const innerEl = document.getElementById("diagram-inner")!;
const errorEl = document.getElementById("error")!;
const toolbar = document.getElementById("toolbar")!;
const sourceEl = document.getElementById("source-code")!;
const toggleSourceBtn = document.getElementById("toggle-source")!;
const copySourceBtn = document.getElementById("btn-copy-source") as HTMLButtonElement;
const modalEl = document.getElementById("source-modal") as HTMLElement;
const closeModalBtn = document.getElementById("btn-close-modal") as HTMLButtonElement;

// ─── Populate toolbar icons ──────────────────────────────────
document.getElementById("btn-zoom-in")!.appendChild(lucideIcon(ZoomIn));
document.getElementById("btn-zoom-out")!.appendChild(lucideIcon(ZoomOut));
document.getElementById("btn-reset")!.appendChild(lucideIcon(RotateCcw));
document.getElementById("btn-copy-svg")!.appendChild(lucideIcon(Copy));
toggleSourceBtn.appendChild(lucideIcon(Code2));
copySourceBtn.appendChild(lucideIcon(ClipboardCopy));

// ─── Dark mode detection ────────────────────────────────────
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");


function resolveTheme(requested?: string): string {
  // If the user/LLM explicitly chose a theme other than "default", respect it
  if (requested && requested !== "default") return requested;
  // Otherwise, auto-pick based on system color scheme
  return prefersDark.matches ? "dark" : "default";
}

function getMermaidConfig(theme: string) {
  const isDark = theme === "dark";
  return {
    startOnLoad: false,
    theme: isDark ? ("base" as const) : (theme as any),
    securityLevel: "loose" as const,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Disable useMaxWidth so all diagram types output explicit pixel width/height
    // instead of width="100%" (flowchart default), which would expand SVGs to fill
    // the container and cause inconsistent sizing across diagram types.
    useMaxWidth: false,
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    ...(isDark ? { themeVariables: DARK_THEME_VARIABLES } : {}),
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

// ─── Render helper ──────────────────────────────────────────
async function renderDiagram(
  code: string,
  theme = "default",
  title = "",
) {
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

    // Update source
    sourceEl.textContent = code;

    // Fit diagram to view.
    // resetView() first so scale=1 for accurate measurement.
    // Double-rAF: first frame applies display:block + min-height layout,
    // second frame gives us stable container dimensions to fit against.
    // Extra 300ms timeout catches slow-rendering diagrams (mindmap, requirement, etc.)
    resetView();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitToContainer();
        setTimeout(fitToContainer, 300);
      });
    });
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

toggleSourceBtn.addEventListener("click", () => {
  modalEl.classList.add("is-visible");
  toggleSourceBtn.classList.add("active");
});

function closeModal() {
  modalEl.classList.remove("is-visible");
  toggleSourceBtn.classList.remove("active");
}

closeModalBtn.addEventListener("click", closeModal);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl.classList.contains("is-visible")) closeModal();
});

copySourceBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(sourceEl.textContent ?? "").then(
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
        handleMermaidData(params.arguments as Record<string, unknown>);
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
        handleContentBlocks(params.content);
      }
    };

    await app.connect();
    console.log("[MermaidApp] Connected to host");
  } catch (err) {
    console.error("[MermaidApp] Failed to connect:", err);
  }
}

initApp();
