# Mermaid MCP App

An MCP App that renders [Mermaid](https://mermaid.js.org/) diagrams as interactive, zoomable UI panels — inline inside Claude, VS Code, and any MCP-compatible client.

## Features

### Diagram Types (13 supported)

| Type | Keyword |
| --- | --- |
| Flowchart | `flowchart` |
| Sequence Diagram | `sequenceDiagram` |
| Class Diagram | `classDiagram` |
| State Diagram | `stateDiagram-v2` |
| ER Diagram | `erDiagram` |
| Gantt Chart | `gantt` |
| Pie Chart | `pie` |
| Git Graph | `gitGraph` |
| Mindmap | `mindmap` |
| Timeline | `timeline` |
| User Journey | `journey` |
| Requirement Diagram | `requirementDiagram` |
| Quadrant Chart | `quadrantChart` |

### UI

- **Pan & zoom** — mouse drag to pan, scroll wheel to zoom, pinch-to-zoom on touch
- **Fit to container** — auto-fits diagram on render; reset button restores fit
- **Copy SVG** — copies the rendered SVG to clipboard
- **Source modal** — view and copy the Mermaid source code
- **Toolbar tooltips** — hover labels on all toolbar buttons
- **Theme support** — `dark` (auto-detected from system preference) and `light`

## Installation

Add to your MCP client configuration:

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

**Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**VS Code:** `.vscode/mcp.json` or user settings

## Usage

Once configured, ask the LLM to draw a diagram:

> "Draw a flowchart showing user authentication flow"

> "Create a sequence diagram for an API request lifecycle"

> "Render this mermaid diagram: `graph TD; A-->B; B-->C`"

You can also specify a theme explicitly:

> "Draw a class diagram with light theme"

## Architecture

```text
┌──────────────────┐     stdio/JSON-RPC     ┌──────────────┐
│   MCP Client     │◄──────────────────────►│  MCP Server  │
│ (Claude/VS Code) │                         │  (index.ts)  │
└────────┬─────────┘                         └──────────────┘
         │                                          │
         │  postMessage                             │ serves dist/view/index.html
         │  (tool-input / tool-result)              │ as ui:// resource
         ▼                                          │
┌──────────────────┐                                │
│  Sandboxed       │◄───────────────────────────────┘
│  iframe          │
│  (Mermaid View)  │
└──────────────────┘
```

The server registers:

1. **`render-mermaid` tool** — accepts `code` (Mermaid syntax), optional `title`, and optional `theme`
2. **`ui://mermaid/view.html` resource** — the bundled single-file HTML with Mermaid.js embedded

## Development

```bash
# Install dependencies
npm install

# Build (view + server)
npm run build

# Watch mode (view only)
npm run dev

# Start server
npm start
```

## Project Structure

```text
mermaid-mcp-app/
├── src/
│   ├── server/
│   │   └── index.ts              # MCP server — registers tool + resource
│   └── view/
│       ├── index.html            # HTML shell
│       ├── style.css             # All UI styles
│       ├── main.ts               # Rendering, pan/zoom, toolbar, MCP App connection
│       ├── dark-theme.const.ts   # Mermaid themeVariables for dark mode
│       └── light-theme.const.ts  # Mermaid themeVariables for light mode
├── dist/
│   ├── server/
│   │   └── index.js              # Compiled server
│   └── view/
│       └── index.html            # Single-file bundled HTML (Vite + vite-plugin-singlefile)
├── vite.config.ts
├── tsconfig.json
└── package.json
```
