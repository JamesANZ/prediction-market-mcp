# Prediction market tools

| Tool | Use it for |
| --- | --- |
| `get-prediction-markets` | Prices for a keyword across Polymarket, PredictIt, and Kalshi. Argument: `keyword` (required, max 50 characters). |
| `gather-market-movement-evidence` | Observed price move for one market, plus untrusted external evidence. Arguments: `market` (required), optional `outcome`, `lookback` (`1h`, `6h`, `24h`, `7d`, `30d`), `sources`, `queries`, `limit`. |

`get-prediction-markets` does not search the web. The evidence tool still returns the price move when Agent Reach is not installed, and marks external sources unavailable.
