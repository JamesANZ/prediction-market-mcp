# prediction-markets-mcp

A Model Context Protocol (MCP) server that provides real-time prediction market data from multiple platforms. This server allows you to query prediction markets for current odds, prices, and market information through a unified interface.

## Supported Platforms

- **Polymarket** - Crypto-based prediction markets with percentage-based odds
- **PredictIt** - Traditional prediction markets with dollar-based prices

## Features

- **Multi-platform Support**: Query both crypto and traditional prediction markets
- **Real-time Data**: Get current odds and prices from live markets
- **Keyword Search**: Filter markets by specific keywords or topics
- **Unified Interface**: Consistent data format across different platforms
- **Error Handling**: Graceful handling of API failures and network issues
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

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

```javascript
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

#### ECONNRESET Errors

- **Cause**: Network connectivity issues or API rate limiting
- **Solution**: The server includes retry logic and error handling
- **Prevention**: Ensure stable internet connection

#### No Markets Found

- **Cause**: Keyword too specific or no matching markets
- **Solution**: Try broader keywords or check market availability
- **Example**: Use "election" instead of "specific candidate name"

#### API Response Errors

- **Cause**: Changes in API format or endpoints
- **Solution**: Check API documentation for updates
- **Debugging**: Review server logs for specific error messages

### Error Messages

- `"No current prediction markets found for keyword: X"`: No markets match the search term
- `"Unexpected API response format"`: API response structure has changed
- `"Network error"`: Connection issues with external APIs

## Configuration

### Environment Variables

Currently, the server uses default configuration. Future versions may support:

- `POLYMARKET_API_BASE`: Custom Polymarket API endpoint
- `PREDICTIT_API_URL`: Custom PredictIt API endpoint
- `USER_AGENT`: Custom user agent string
- `REQUEST_TIMEOUT`: API request timeout (milliseconds)

### Rate Limiting

The server respects API rate limits:

- Polymarket: No specific limits documented
- PredictIt: No specific limits documented

## Contributing

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

## License

ISC License - see LICENSE file for details

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

## Changelog

### Version 1.0.0

- Initial release
- Support for Polymarket and PredictIt APIs
- Keyword-based market filtering
- Unified response format
- Error handling and retry logic
