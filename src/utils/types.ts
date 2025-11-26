export type Token = {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
};

export type Market = {
  question: string;
  active: boolean;
  archived: boolean;
  market_slug: string;
  description?: string;
  tokens: Token[];
  [key: string]: any;
};

export type MarketWithOdds = Market & {
  odds: Record<string, number>;
};

export type PredictItContract = {
  id: number;
  name: string;
  shortName: string;
  status: string;
  lastTradePrice: number;
  bestBuyYesCost: number | null;
  bestBuyNoCost: number | null;
  bestSellYesCost: number | null;
  bestSellNoCost: number | null;
  lastClosePrice: number;
};

export type PredictItMarket = {
  id: number;
  name: string;
  shortName: string;
  image: string;
  url: string;
  contracts: PredictItContract[];
  timeStamp: string;
  status: string;
};

export type PredictItResponse = {
  markets: PredictItMarket[];
};

export type KalshiEvent = {
  event_ticker: string;
  series_ticker: string;
  sub_title: string;
  title: string;
  category: string;
};

export type KalshiResponse = {
  events: KalshiEvent[];
};

export type KalshiMarket = {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: string;
  market_type: string;
  last_price_dollars?: string;
  yes_ask_dollars?: string;
  yes_bid_dollars?: string;
  no_ask_dollars?: string;
  no_bid_dollars?: string;
  volume?: number;
  open_interest?: number;
  [key: string]: any; // Allow additional fields from API
};

export type KalshiMarketsResponse = {
  markets: KalshiMarket[];
  cursor: string;
};

export type KalshiEventWithMarkets = KalshiEvent & {
  markets?: KalshiMarket[];
};
