/**
 * Light-mode themeVariables for Mermaid.
 * Used with `theme: "base"` when light mode is explicitly requested or auto-detected.
 *
 * Pairing rules:
 *   - cScale{i}    = 100-weight pastel background
 *   - cScaleInv{i} = 500-weight border of the SAME hue
 *   - cScaleLabel  = dark text for contrast on light backgrounds
 */
export const LIGHT_THEME_VARIABLES = {
  // ── General ────────────────────────────────────────────────────────────────
  background: "transparent",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // ── Primary nodes ──────────────────────────────────────────────────────────
  primaryColor:       "#dbeafe",
  primaryTextColor:   "#1e293b",
  primaryBorderColor: "#3b82f6",

  // ── Secondary nodes ────────────────────────────────────────────────────────
  secondaryColor:       "#dcfce7",
  secondaryTextColor:   "#1e293b",
  secondaryBorderColor: "#22c55e",

  // ── Tertiary nodes ─────────────────────────────────────────────────────────
  tertiaryColor:       "#f1f5f9",
  tertiaryTextColor:   "#1e293b",
  tertiaryBorderColor: "#94a3b8",

  // ── Lines & edges ──────────────────────────────────────────────────────────
  lineColor: "#64748b",
  textColor: "#1e293b",

  // ── Node defaults ──────────────────────────────────────────────────────────
  mainBkg:      "#f8fafc",
  nodeBorder:   "#94a3b8",
  nodeTextColor:"#1e293b",

  // ── ER diagram attribute rows ──────────────────────────────────────────────
  rowOdd:  "#f8fafc",
  rowEven: "#f1f5f9",

  // ── Cluster / subgraph ─────────────────────────────────────────────────────
  clusterBkg:    "#f1f5f9",
  clusterBorder: "#cbd5e1",
  titleColor:    "#0f172a",

  // ── Edge labels ────────────────────────────────────────────────────────────
  edgeLabelBackground: "#f8fafc",

  // ── Flowchart ──────────────────────────────────────────────────────────────
  defaultLinkColor: "#64748b",

  // ── GitGraph branch colors ─────────────────────────────────────────────────
  git0: "#2563eb",
  git1: "#16a34a",
  git2: "#7c3aed",
  git3: "#ea580c",
  git4: "#0891b2",
  git5: "#db2777",
  git6: "#4f46e5",
  git7: "#0d9488",
  gitBranchLabel0: "#ffffff",
  gitBranchLabel1: "#ffffff",
  gitBranchLabel2: "#ffffff",
  gitBranchLabel3: "#ffffff",
  gitBranchLabel4: "#ffffff",
  gitBranchLabel5: "#ffffff",
  gitBranchLabel6: "#ffffff",
  gitBranchLabel7: "#ffffff",
  gitInv0: "#bfdbfe",
  gitInv1: "#bbf7d0",
  gitInv2: "#ddd6fe",
  gitInv3: "#fed7aa",
  gitInv4: "#a5f3fc",
  gitInv5: "#fbcfe8",
  gitInv6: "#c7d2fe",
  gitInv7: "#99f6e4",

  // ── Pie chart slice colors ─────────────────────────────────────────────────
  pie1:  "#3b82f6",
  pie2:  "#22c55e",
  pie3:  "#8b5cf6",
  pie4:  "#f97316",
  pie5:  "#14b8a6",
  pie6:  "#ec4899",
  pie7:  "#0ea5e9",
  pie8:  "#f59e0b",
  pie9:  "#6366f1",
  pie10: "#10b981",
  pie11: "#a855f7",
  pie12: "#ef4444",

  // ── Mindmap / Timeline node bg (cScale) + border (cScaleInv, same hue) ─────
  // cScale  = 100-weight pastel fill
  // cScaleInv = 500-weight border of the same hue
  cScale0:  "#dbeafe",  // blue-100
  cScale1:  "#dcfce7",  // green-100
  cScale2:  "#ede9fe",  // violet-100
  cScale3:  "#ffedd5",  // orange-100
  cScale4:  "#cffafe",  // cyan-100
  cScale5:  "#fce7f3",  // pink-100
  cScale6:  "#e0e7ff",  // indigo-100
  cScale7:  "#ccfbf1",  // teal-100
  cScale8:  "#dbeafe",
  cScale9:  "#dcfce7",
  cScale10: "#ede9fe",
  cScale11: "#ffedd5",

  cScaleInv0:  "#3b82f6",  // blue-500
  cScaleInv1:  "#22c55e",  // green-500
  cScaleInv2:  "#8b5cf6",  // violet-500
  cScaleInv3:  "#f97316",  // orange-500
  cScaleInv4:  "#06b6d4",  // cyan-500
  cScaleInv5:  "#ec4899",  // pink-500
  cScaleInv6:  "#6366f1",  // indigo-500
  cScaleInv7:  "#14b8a6",  // teal-500
  cScaleInv8:  "#3b82f6",
  cScaleInv9:  "#22c55e",
  cScaleInv10: "#8b5cf6",
  cScaleInv11: "#f97316",

  cScaleLabel0:  "#1e293b",
  cScaleLabel1:  "#1e293b",
  cScaleLabel2:  "#1e293b",
  cScaleLabel3:  "#1e293b",
  cScaleLabel4:  "#1e293b",
  cScaleLabel5:  "#1e293b",
  cScaleLabel6:  "#1e293b",
  cScaleLabel7:  "#1e293b",
  cScaleLabel8:  "#1e293b",
  cScaleLabel9:  "#1e293b",
  cScaleLabel10: "#1e293b",
  cScaleLabel11: "#1e293b",

  // ── User Journey actor column fills ────────────────────────────────────────
  actor0: "#2563eb",
  actor1: "#16a34a",
  actor2: "#7c3aed",
  actor3: "#ea580c",
  actor4: "#0d9488",
  actor5: "#db2777",
  faceColor: "#f8fafc",

  // ── Gantt chart task bars ──────────────────────────────────────────────────
  taskBkgColor:          "#3b82f6",
  doneTaskBkgColor:      "#cbd5e1",
  critTaskBkgColor:      "#ef4444",
  activeTaskBkgColor:    "#0ea5e9",
  taskBorderColor:       "#2563eb",
  doneTaskBorderColor:   "#94a3b8",
  critTaskBorderColor:   "#dc2626",
  activeTaskBorderColor: "#0284c7",
  taskTextColor:         "#ffffff",
  taskTextLightColor:    "#1e293b",
  taskTextOutsideColor:  "#1e293b",
  taskTextClickableColor:"#1d4ed8",
  todayLineColor:        "#f59e0b",
} as const;
