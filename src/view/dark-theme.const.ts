/**
 * Dark-mode-friendly themeVariables for Mermaid.
 * Used when `theme: "base"` is selected (i.e. system prefers dark mode).
 *
 * Pairing rules:
 *   - cScaleInv{i}  = 400-weight of same hue as cScale{i}  (hover/border accent)
 *   - gitBranchLabel{i} = "#ffffff" (white on saturated branch color)
 *   - gitInv{i}     = 700-weight of same hue as git{i}     (commit dot fill)
 */
export const DARK_THEME_VARIABLES = {
  // ── General ────────────────────────────────────────────────────────────────
  background: "transparent",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // ── Primary nodes (rectangles) ─────────────────────────────────────────────
  primaryColor:       "#1e3a5f",
  primaryTextColor:   "#e2e8f0",
  primaryBorderColor: "#3b82f6",

  // ── Secondary nodes ────────────────────────────────────────────────────────
  secondaryColor:       "#1e3a2f",
  secondaryTextColor:   "#e2e8f0",
  secondaryBorderColor: "#22c55e",

  // ── Tertiary nodes ─────────────────────────────────────────────────────────
  // ER attribute rows use tertiaryColor as alt background.
  // Match mainBkg so there is no alternating-row contrast issue.
  tertiaryColor:       "#1e293b",
  tertiaryTextColor:   "#e2e8f0",
  tertiaryBorderColor: "#475569",

  // ── Lines & edges ──────────────────────────────────────────────────────────
  lineColor: "#94a3b8",
  textColor: "#e2e8f0",

  // ── Node defaults ──────────────────────────────────────────────────────────
  mainBkg:      "#1e293b",  // entity / node background
  nodeBorder:   "#e2e8f0",  // border stroke + .label text in ER diagrams
  nodeTextColor:"#e2e8f0",

  // ── ER diagram attribute row fills ─────────────────────────────────────────
  // base theme computes near-white odd rows via lighten(mainBkg, 75%); override:
  rowOdd:  "#1e293b",
  rowEven: "#263248",

  // ── Cluster / subgraph ─────────────────────────────────────────────────────
  clusterBkg:    "#1e293b",
  clusterBorder: "#475569",
  titleColor:    "#f1f5f9",

  // ── Edge labels ────────────────────────────────────────────────────────────
  edgeLabelBackground: "#1e293b",

  // ── Flowchart ──────────────────────────────────────────────────────────────
  defaultLinkColor: "#94a3b8",

  // ── GitGraph branch colors (git0–git7) ────────────────────────────────────
  git0: "#3b82f6",  // blue
  git1: "#22c55e",  // green
  git2: "#a855f7",  // purple
  git3: "#f97316",  // orange
  git4: "#06b6d4",  // cyan
  git5: "#ec4899",  // pink
  git6: "#eab308",  // yellow
  git7: "#14b8a6",  // teal
  gitBranchLabel0: "#ffffff",
  gitBranchLabel1: "#ffffff",
  gitBranchLabel2: "#ffffff",
  gitBranchLabel3: "#ffffff",
  gitBranchLabel4: "#ffffff",
  gitBranchLabel5: "#ffffff",
  gitBranchLabel6: "#ffffff",
  gitBranchLabel7: "#ffffff",
  gitInv0: "#1e40af",
  gitInv1: "#15803d",
  gitInv2: "#7e22ce",
  gitInv3: "#c2410c",
  gitInv4: "#0e7490",
  gitInv5: "#be185d",
  gitInv6: "#a16207",
  gitInv7: "#0f766e",

  // ── Pie chart slice colors (pie1–pie12, independent from cScale) ───────────
  pie1:  "#1d4ed8",  // blue
  pie2:  "#15803d",  // green
  pie3:  "#7c3aed",  // purple
  pie4:  "#c2410c",  // orange
  pie5:  "#0f766e",  // teal
  pie6:  "#be185d",  // rose
  pie7:  "#0369a1",  // sky
  pie8:  "#b45309",  // amber
  pie9:  "#4338ca",  // indigo
  pie10: "#047857",  // emerald
  pie11: "#9333ea",  // violet
  pie12: "#dc2626",  // red

  // ── Mindmap / Timeline node bg (cScale) + border accent (cScaleInv) ────────
  cScale0:  "#2563eb",  // blue-600
  cScale1:  "#16a34a",  // green-600
  cScale2:  "#7c3aed",  // violet-600
  cScale3:  "#ea580c",  // orange-600
  cScale4:  "#0891b2",  // cyan-600
  cScale5:  "#db2777",  // pink-600
  cScale6:  "#4f46e5",  // indigo-600
  cScale7:  "#0d9488",  // teal-600
  cScale8:  "#2563eb",  // (repeats from 0)
  cScale9:  "#16a34a",
  cScale10: "#7c3aed",
  cScale11: "#ea580c",

  cScaleInv0:  "#60a5fa",  // blue-400
  cScaleInv1:  "#4ade80",  // green-400
  cScaleInv2:  "#a78bfa",  // violet-400
  cScaleInv3:  "#fb923c",  // orange-400
  cScaleInv4:  "#22d3ee",  // cyan-400
  cScaleInv5:  "#f472b6",  // pink-400
  cScaleInv6:  "#818cf8",  // indigo-400
  cScaleInv7:  "#2dd4bf",  // teal-400
  cScaleInv8:  "#60a5fa",
  cScaleInv9:  "#4ade80",
  cScaleInv10: "#a78bfa",
  cScaleInv11: "#fb923c",

  cScaleLabel0:  "#ffffff",
  cScaleLabel1:  "#ffffff",
  cScaleLabel2:  "#ffffff",
  cScaleLabel3:  "#ffffff",
  cScaleLabel4:  "#ffffff",
  cScaleLabel5:  "#ffffff",
  cScaleLabel6:  "#ffffff",
  cScaleLabel7:  "#ffffff",
  cScaleLabel8:  "#ffffff",
  cScaleLabel9:  "#ffffff",
  cScaleLabel10: "#ffffff",
  cScaleLabel11: "#ffffff",

  // ── User Journey actor column fills ────────────────────────────────────────
  actor0: "#1d4ed8",  // blue
  actor1: "#15803d",  // green
  actor2: "#7c3aed",  // purple
  actor3: "#c2410c",  // orange
  actor4: "#0f766e",  // teal
  actor5: "#be185d",  // rose

  // User Journey face/head fill (default cornsilk #FFF8DC is too light in dark mode)
  faceColor: "#1e293b",

  // ── Gantt chart task bars ──────────────────────────────────────────────────
  // Mermaid default doneTaskBkgColor is #d3d3d3 (light gray) — unreadable in dark mode.
  taskBkgColor:          "#1d4ed8",  // active/default — blue
  doneTaskBkgColor:      "#334155",  // :done — dark slate
  critTaskBkgColor:      "#b91c1c",  // :crit — dark red
  activeTaskBkgColor:    "#0369a1",  // today-active highlight
  taskBorderColor:       "#3b82f6",
  doneTaskBorderColor:   "#64748b",
  critTaskBorderColor:   "#ef4444",
  activeTaskBorderColor: "#0284c7",
  taskTextColor:         "#ffffff",  // text inside bars
  taskTextLightColor:    "#1e293b",  // fallback for accidentally-light bars
  taskTextOutsideColor:  "#e2e8f0",  // label outside the bar
  taskTextClickableColor:"#bfdbfe",  // clickable task — light blue
  todayLineColor:        "#f59e0b",  // amber today-marker
} as const;
