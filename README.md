# mcp-ine-pt

Statistics Portugal (INE) JSON indicator MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `indicator_meta` | Metadata for an INE (Statistics Portugal) indicator: title, periodicity, unit, time range, and the full list of dimensions with their valid dimension-value codes. Call this BEFORE get_indicator so you know which Dim1/Dim2/... codes are valid. Requires the indicator code (varcd) — INE has no keyword/search endpoint, so look the code up on https://www.ine.pt first. |
| `get_indicator` | Fetch data values for an INE (Statistics Portugal) indicator. Pass the indicator code (varcd) and optionally a `dims` object mapping dimension slots ("Dim1","Dim2",...) to dimension-value codes to select a slice (codes come from indicator_meta). Omit a Dim slot to return all of its values. Requires varcd — INE has no keyword/search endpoint, so look the code up on https://www.ine.pt first. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ine-pt": {
      "url": "https://gateway.pipeworx.io/ine-pt/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Ine Pt data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
