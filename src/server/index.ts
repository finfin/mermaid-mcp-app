#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "mermaid-diagram",
  version: "1.0.0",
});

// ─── In-memory draft store (survives across iframe re-renders) ───
// Keyed by draftId (hash of original code) so multiple diagrams don't collide.
const drafts = new Map<string, string>();

// Internal tools for the View to save/restore user edits across re-renders.
// These are NOT intended for LLM use — the View calls them via callServerTool.
server.tool(
  "save-mermaid-draft",
  "Save the user's edited Mermaid source (internal, used by the viewer)",
  { draftId: z.string(), code: z.string() },
  async ({ draftId, code }) => {
    drafts.set(draftId, code);
    return { content: [{ type: "text" as const, text: "ok" }] };
  },
);

server.tool(
  "get-mermaid-draft",
  "Retrieve the user's last edited Mermaid source (internal, used by the viewer)",
  { draftId: z.string() },
  async ({ draftId }) => {
    return {
      content: [{
        type: "text" as const,
        text: drafts.get(draftId) ?? "",
      }],
    };
  },
);

// Tool: render-mermaid
// Accepts Mermaid syntax and sends it to the UI for rendering
registerAppTool(
  server,
  "mermaid-mcp-app",
  {
    title: "Mermaid MCP App",
    description:
      "Render a Mermaid diagram in an interactive viewer with pan, zoom, and a built-in source editor. The user can edit the diagram and send changes back to the conversation. Supports all Mermaid diagram types.",
    inputSchema: {
      code: z
        .string()
        .describe("The Mermaid diagram syntax to render"),
      title: z
        .string()
        .optional()
        .describe("Optional title for the diagram"),
      theme: z
        .enum(["default", "light", "dark"])
        .optional()
        .describe("Mermaid theme to use. 'default' auto-detects dark/light mode. 'light' forces the light theme. 'dark' forces the dark theme."),
    },
    _meta: {
      ui: {
        resourceUri: "ui://mermaid/view.html",
      },
    },
  },
  async ({ code, title, theme }) => {
    // Return the mermaid code as text content — the UI will pick it up via ontoolresult
    const result = {
      code,
      title: title ?? "",
      theme: theme ?? "default",
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  },
);

// Resource: the HTML view for the mermaid renderer
registerAppResource(
  server,
  "Mermaid Diagram View",
  "ui://mermaid/view.html",
  {
    description: "Interactive Mermaid diagram renderer",
  },
  async () => {
    // Read the built single-file HTML
    const htmlPath = path.resolve(__dirname, "../view/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    return {
      contents: [
        {
          uri: "ui://mermaid/view.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Mermaid MCP App server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
