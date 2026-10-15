# Prediction markets

Reads live prices from Polymarket, PredictIt, and Kalshi. No API key for prices.

Ask for a keyword such as "fed" or "election". Ask why a price moved only when you want the evidence tool, which can call optional external search on the buyer's machine.

## Connect

```json
{
  "mcpServers": {
    "prediction-markets-mcp": {
      "command": "npx",
      "args": ["-y", "prediction-markets-mcp"]
    }
  }
}
```

## Package this listing

```bash
cd agensi-skills
zip -r prediction-markets.zip prediction-markets -x "*.DS_Store"
```

Upload `prediction-markets.zip` in the Agensi creator dashboard. This repository does not submit the listing.
