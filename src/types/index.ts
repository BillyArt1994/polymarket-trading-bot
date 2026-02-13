export interface Market {
  id: string;
  slug: string;
  question: string;
  category?: string;
  created_at?: Date;
  resolution_time?: Date;
  resolved: boolean;
  active: boolean;
}

export interface PriceSnapshot {
  id?: number;
  market_id: string;
  timestamp?: Date;
  yes_price: number;
  no_price: number;
  yes_liquidity?: number;
  no_liquidity?: number;
  volume_24h?: number;
}

export interface ArbitrageOpportunity {
  id?: number;
  market_id: string;
  detected_at?: Date;
  yes_price: number;
  no_price: number;
  total_price: number;
  deviation: number;
  deviation_percent: number;
  status: 'open' | 'confirmed' | 'expired' | 'executed';
}

export interface Signal {
  id?: number;
  market_id: string;
  opportunity_id?: number;
  signal_type: 'BUY_YES' | 'BUY_NO' | 'ARBITRAGE' | 'HOLD';
  confidence: number;
  reason?: string;
  trigger_price?: number;
  suggested_amount?: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'executed';
  created_at?: Date;
  confirmed_at?: Date;
  executed_at?: Date;
}

export interface Trade {
  id?: number;
  signal_id?: number;
  market_id: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  quantity: number;
  gas_fee?: number;
  tx_hash?: string;
  pnl?: number;
  status: 'pending' | 'confirmed' | 'settled';
  created_at?: Date;
  settled_at?: Date;
}
