# Mermaid MCP App

An MCP App that renders [Mermaid](https://mermaid.js.org/) diagrams as interactive, inline UI inside Claude, ChatGPT, VS Code, and any MCP-compatible client.

## Features

- Renders all Mermaid diagram types: flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, gitgraph, mindmaps, timelines, and more
- Theme support: `default`, `dark`, `forest`, `neutral`
- Zoom in/out controls
- Copy SVG to clipboard
- View source code toggle
- Auto-resize to fit content
- Dark/light mode support

## Architecture

```
┌──────────────────┐     stdio/JSON-RPC     ┌──────────────┐
│  Claude Desktop  │◄──────────────────────► │  MCP Server  │
│  (Host)          │                         │  (index.ts)  │
└────────┬─────────┘                         └──────────────┘
         │                                          │
         │  postMessage                             │ reads dist/view/index.html
         │  (tool-input / tool-result)              │ as ui:// resource
         ▼                                          │
┌──────────────────┐                                │
│  Sandboxed       │◄───────────────────────────────┘
│  iframe          │
│  (Mermaid View)  │
└──────────────────┘
```

The server registers:
1. **`render-mermaid` tool** — accepts `code` (Mermaid syntax), `title`, and `theme` parameters
2. **`ui://mermaid/view.html` resource** — the bundled single-file HTML containing Mermaid.js

When the LLM calls `render-mermaid`, the host:
1. Sends tool arguments to the iframe via `ontoolinput`
2. Executes the tool on the server
3. Delivers the result via `ontoolresult`

The view picks up the Mermaid code from either event and renders the diagram.

## Setup

```bash
npm install
npm run build
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH>/mermaid-mcp-app/dist/server/index.js", "--stdio"]
    }
  }
}
```

Replace `<ABSOLUTE_PATH>` with the actual path, for example:

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "bash",
      "args": ["-c", "cd ~/workspace/mermaid-mcp-app && npm run build >&2 && node dist/server/index.js --stdio"]
    }
  }
}
```

## Usage

Once configured, ask Claude something like:

> "Draw a flowchart showing user authentication flow"

or

> "Create a sequence diagram for an API request lifecycle"

or paste Mermaid code directly:

> "Render this mermaid diagram: `graph TD; A-->B; B-->C; C-->A;`"

## Development

```bash
# Watch mode
npm run dev

# Build everything
npm run build

# Start server (stdio)
npm start
```

## Project Structure

```
mermaid-mcp-app/
├── src/
│   ├── server/
│   │   └── index.ts          # MCP server — registers tool + resource
│   └── view/
│       ├── index.html         # HTML shell
│       └── main.ts            # App logic — mermaid rendering + MCP App connection
├── dist/
│   ├── server/
│   │   └── index.js           # Compiled server
│   └── view/
│       └── index.html         # Single-file bundled HTML (Vite + vite-plugin-singlefile)
├── vite.config.ts
├── tsconfig.json
└── package.json
```
