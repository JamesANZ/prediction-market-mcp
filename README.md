# 📊 Prediction Markets MCP Server

> **Real-time prediction market data in your AI workflow.** Get current odds and prices from Polymarket, PredictIt, and Kalshi. No API keys required.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that brings live prediction market data into AI coding environments like Cursor and Claude Desktop.

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/prediction-market-mcp)](https://archestra.ai/mcp-catalog/jamesanz__prediction-market-mcp)

<a href="https://glama.ai/mcp/servers/@JamesANZ/prediction-market-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JamesANZ/prediction-market-mcp/badge" alt="prediction-market-mcp MCP server" />
</a>

## Why Use Prediction Markets MCP?

- 🆓 **No API Keys** – Works out of the box, zero configuration
- 📈 **Multi-Platform** – Polymarket, PredictIt, and Kalshi in one interface
- ⚡ **Real-time Data** – Current odds and prices from live markets
- 🎯 **Easy Setup** – One-click install in Cursor or simple manual setup
- 🔍 **Keyword Search** – Find markets by topic or keyword

## Quick Start

Ready to explore prediction markets? Install in seconds:

**Install in Cursor (Recommended):**

[🔗 Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=prediction-markets-mcp&config=eyJwcmVkaWN0aW9uLW1hcmtldHMtbWNwIjp7ImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwicHJlZGljdGlvbi1tYXJrZXRzLW1jcCJdfX0=)

**Or install manually:**

```bash
npm install -g prediction-markets-mcp
# Or from source:
git clone https://github.com/JamesANZ/prediction-markets-mcp.git
cd prediction-markets-mcp && npm install && npm run build
```

## Features

### `get-prediction-markets`

Search for prediction markets across multiple platforms by keyword.

**Parameters:**

- `keyword` (string, required): Search term (max 50 characters)
  - Examples: "trump", "election", "supreme court"

**Returns:**

- Markets from Polymarket (percentage odds)
- Markets from PredictIt (dollar prices)
- Markets from Kalshi (regulated US markets)

### `gather-market-movement-evidence`

Given one market and a lookback window, return the observed price move and recent external evidence. The server does not decide why the market moved. The calling model does that from the evidence.

Agent Reach is optional. If it is not installed, this tool still returns the market and the price move, and marks external sources unavailable. `get-prediction-markets` does not call Agent Reach.

**Parameters:**

- `market` (string, required): A keyword, or a direct id such as `polymarket:<slug>`, `kalshi:<ticker>`, or `predictit:<marketId>:<contractId>`. A keyword that matches more than one market returns candidates and does not search the web.
- `outcome` (string, optional): Outcome to measure. Defaults to Yes when that outcome exists.
- `lookback` (string, optional): `1h`, `6h`, `24h`, `7d`, or `30d`. Default `24h`. PredictIt has no history API, so that venue compares the previous close with the last trade.
- `sources` (string array, optional): `web`, `x`, `reddit`, and/or `youtube`. Default is all four.
- `queries` (string array, optional): Up to three search queries. When set, they replace the generated query. Only the first query is executed.
- `limit` (number, optional): Maximum evidence items, 1–10. Default 8.

Evidence text is untrusted data. It is returned in `evidence[]` and is not treated as instructions.

External search uses the [Agent Reach](https://github.com/Panniantong/Agent-Reach) 1.5 command table:

- Web: Exa through `mcporter`
- YouTube: `yt-dlp` search metadata, not transcripts
- X: `twitter search` when `TWITTER_AUTH_TOKEN` and `TWITTER_CT0` are set on this server process
- Reddit: `rdt`, or desktop OpenCLI when `rdt` is absent

Facebook, Instagram, and GitHub are not searched. Install Agent Reach and run `agent-reach doctor` on the same machine as this server. A missing login, rate limit, or offline source is reported on that source and does not fail the price lookup.

```json
{
  "tool": "gather-market-movement-evidence",
  "arguments": {
    "market": "polymarket:fed-decision",
    "lookback": "24h",
    "sources": ["web", "youtube"]
  }
}
```

## Installation

### Cursor (One-Click)

Click the install link above or use:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=prediction-markets-mcp&config=eyJwcmVkaWN0aW9uLW1hcmtldHMtbWNwIjp7ImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwicHJlZGljdGlvbi1tYXJrZXRzLW1jcCJdfX0=
```

### Manual Installation

**Requirements:** Node.js 18+ and npm

```bash
# Clone and build
git clone https://github.com/JamesANZ/prediction-markets-mcp.git
cd prediction-markets-mcp
npm install
npm run build

# Run server
node build/index.js
```

## Usage Examples

### Search for Markets

Find prediction markets by keyword:

```json
{
  "tool": "get-prediction-markets",
  "arguments": {
    "keyword": "trump"
  }
}
```

### Search Election Markets

Find markets related to elections:

```json
{
  "tool": "get-prediction-markets",
  "arguments": {
    "keyword": "election"
  }
}
```

## Supported Platforms

| Platform       | Format          | Description                     |
| -------------- | --------------- | ------------------------------- |
| **Polymarket** | Percentage odds | Crypto-based prediction markets |
| **PredictIt**  | Dollar prices   | Traditional prediction markets  |
| **Kalshi**     | Regulated       | US-regulated prediction markets |

## Data Sources

- **Polymarket**: Gamma search at `https://gamma-api.polymarket.com/public-search`, with CLOB history at `https://clob.polymarket.com/prices-history`
- **PredictIt**: `https://www.predictit.org/api/marketdata/all/`
- **Kalshi**: Regulated US prediction markets

## Use Cases

- **Traders** – Monitor odds and prices across platforms
- **Researchers** – Analyze market sentiment and predictions
- **Developers** – Build apps with prediction market data
- **Analysts** – Track political and event probabilities

## Technical Details

**Built with:** Node.js, TypeScript, MCP SDK  
**Dependencies:** `@modelcontextprotocol/sdk`, `superagent`, `zod`  
**Platforms:** macOS, Windows, Linux

## Contributing

⭐ **If this project helps you, please star it on GitHub!** ⭐

Contributions welcome! Please open an issue or submit a pull request.

## License

MIT License – see LICENSE file for details.

## Support

If you find this project useful, consider supporting it:

**⚡ Lightning Network**

```
lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa
```

**₿ Bitcoin**: [bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)

**Ξ Ethereum/EVM**: [0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)
