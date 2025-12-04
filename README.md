# prediction-markets-mcp

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/prediction-market-mcp)](https://archestra.ai/mcp-catalog/jamesanz__prediction-market-mcp)

A Model Context Protocol (MCP) server that provides real-time prediction market data from multiple platforms. This server allows you to query prediction markets for current odds, prices, and market information through a unified interface.

<a href="https://glama.ai/mcp/servers/@JamesANZ/prediction-market-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JamesANZ/prediction-market-mcp/badge" alt="prediction-market-mcp MCP server" />
</a>

## Supported Platforms

- **Polymarket** - Crypto-based prediction markets with percentage-based odds
- **PredictIt** - Traditional prediction markets with dollar-based prices
- **Kalshi** - Regulated US prediction markets

## Features

- **Multi-platform Support**: Query both crypto and traditional prediction markets
- **Real-time Data**: Get current odds and prices from live markets
- **Keyword Search**: Filter markets by specific keywords or topics
- **Unified Interface**: Consistent data format across different platforms
- **Error Handling**: Graceful handling of API failures and network issues
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

### Installing in Cursor

You can install this MCP server directly in Cursor using the one-click install link:

**🔗 [Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=prediction-markets-mcp&config=eyJwcmVkaWN0aW9uLW1hcmtldHMtbWNwIjp7ImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwicHJlZGljdGlvbi1tYXJrZXRzLW1jcCJdfX0=)**

This will automatically configure the MCP server using `npx`. No API keys are required.

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd prediction-markets-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Usage

### Running the Server

Start the MCP server:

```bash
node build/index.js
```

The server runs on stdio and can be integrated with MCP-compatible clients.

### API Endpoints

The server provides a single tool: `get-prediction-markets`

#### Parameters

- `keyword` (string, required): Search term to filter markets
  - Maximum length: 50 characters
  - Examples: "trump", "election", "supreme court"

#### Example Queries

```
// Search for Trump-related markets
{
  "keyword": "trump"
}

// Search for election markets
{
  "keyword": "election"
}

// Search for Supreme Court markets
{
  "keyword": "supreme court"
}
```

### Response Format

The server returns prediction market data in the following format:

#### Polymarket Markets

```
**Polymarket: Will Trump win the 2024 election?**
Yes: 45.2% | No: 54.8%
```

#### PredictIt Markets

```
**PredictIt: Which party will win the 2025 gubernatorial election in Virginia?**
Democratic: 89.0% | Republican: 11.0%
```

## Data Sources

### Polymarket API

- **Base URL**: `https://clob.polymarket.com/markets`
- **Format**: JSON
- **Odds Display**: Percentages (e.g., 65.2%)
- **Data**: Market questions, active status, token prices

### PredictIt API

- **Base URL**: `https://www.predictit.org/api/marketdata/all/`
- **Format**: JSON
- **Odds Display**: Dollar amounts (e.g., $0.65)
- **Data**: Market names, contracts, trade prices, status

## Development

### Project Structure

```
prediction-markets-mcp/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Key Components

#### Type Definitions

```typescript
// Polymarket types
type Market = {
  question: string;
  active: boolean;
  archived: boolean;
  tokens: Token[];
};

// PredictIt types
type PredictItMarket = {
  id: number;
  name: string;
  shortName: string;
  contracts: PredictItContract[];
  status: string;
};
```

#### Core Functions

- `getPolymarketPredictionData()`: Fetches and processes Polymarket data
- `getPredictItMarkets()`: Fetches all PredictIt markets
- `makeApiRequest()`: Handles HTTP requests with proper headers

### Building

```bash
# Development build
npm run build

# Watch mode (if needed)
npm run dev
```

### Testing

To test the server manually:

1. Start the server:

```bash
node build/index.js
```

2. Send test requests through an MCP client or test the API endpoints directly.

## Troubleshooting

### Common Issues

#### No Markets Found

- **Cause**: Keyword too specific or no matching markets
- **Solution**: Try broader keywords or check market availability
- **Example**: Use "election" instead of "specific candidate name"

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Ensure all builds pass before submitting

## Donate

If you find this project useful, consider supporting it with Bitcoin:

**⚡ Lightning Network**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/lightning.jpeg" alt="Lightning QR Code" width="120" />

<code>lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa</code>

**₿ On-Chain**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/onchain.jpg" alt="Bitcoin Address QR Code" width="120" />

<code>[bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)</code>

**Ξ Ethereum / EVM Networks**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/ethereum.jpg" alt="Ethereum Address QR Code" width="120" />

<code>[0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)</code>

*Donations from any EVM-compatible network (Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, etc.) will work perfectly! You can also send tokens like USDT, USDC, DAI, and other ERC-20 tokens to this address.*

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information