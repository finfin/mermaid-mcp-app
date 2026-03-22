#!/usr/bin/env node

// Fail fast with a clear message if running on an unsupported Node.js version.
// Older npx (Node 14) silently drops the -y flag and prints its own help text,
// so the server process never actually starts. Require >= 20 explicitly.
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  process.stderr.write(
    `[mermaid-mcp-app] ERROR: Node.js >= 20 is required (current: v${process.versions.node}).\n` +
    `  If you use nvm, run: nvm use 20 (or set a default with nvm alias default 20)\n` +
    `  Then restart your MCP client so it picks up the new PATH.\n`,
  );
  process.exit(1);
}

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

// Tool: render-mermaid
// Accepts Mermaid syntax and sends it to the UI for rendering
registerAppTool(
  server,
  "render-mermaid",
  {
    title: "Render Mermaid Diagram",
    description:
      "Render a Mermaid diagram from Mermaid syntax. Supports flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, gitgraph, mindmaps, timelines, and more.",
    inputSchema: {
      code: z
        .string()
        .describe("The Mermaid diagram syntax to render"),
      title: z
        .string()
        .optional()
        .describe("Optional title for the diagram"),
      theme: z
        .enum(["default", "light", "dark", "forest", "neutral"])
        .optional()
        .describe("Mermaid theme to use. 'default' auto-detects dark/light mode. 'light' forces the light theme. 'dark', 'forest', 'neutral' are explicit choices."),
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
  console.error("Mermaid MCP App server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
