export interface BotConfig {
  telegram: {
    botToken: string;
    allowedChatId: number;
  };
  database: {
    path: string;
  };
  risk: {
    maxDailyLoss: number;
    maxSingleTrade: number;
    maxDailyTrades: number;
    minArbitrageGap: number;
  };
  strategy: {
    checkInterval: number;
    priceHistoryDays: number;
    thresholds: {
      minArbitrageGap: number;
      conservative: { min: number; max: number };
      standard: { min: number; max: number };
      aggressive: { min: number };
    };
    expiryMinutes: {
      conservative: number;
      standard: number;
      aggressive: number;
    };
    takeProfit: {
      partialCloseAt: number;
      fullCloseAt: number;
      maxHoldHours: number;
    };
  };
  wallet: {
    address: string;
  };
  mode: 'SIMULATION' | 'LIVE';
  simulation: {
    initialCapital: number;
    logTrades: boolean;
    notifyOnSignal: boolean;
  };
}

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

export type SignalLevel = 'CONSERVATIVE' | 'STANDARD' | 'AGGRESSIVE' | 'RISKY';

export interface ArbitrageOpportunity {
  marketId: string;
  marketName: string;
  yesPrice: number;
  noPrice: number;
  totalPrice: number;
  deviation: number;
  deviationPercent: number;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'WAIT';
  confidence: number;
  expectedReturn: number;
  level: SignalLevel;
  expiryMinutes: number;
  warningMessage?: string;
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
  status: 'pending' | 'confirmed' | 'rejected' | 'executed' | 'expired';
  created_at?: Date;
  confirmed_at?: Date;
  executed_at?: Date;
  level?: SignalLevel;
  expiry_minutes?: number;
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

export interface Position {
  id: number;
  marketId: string;
  side: 'YES' | 'NO';
  entryPrice: number;
  entryDeviation: number;
  quantity: number;
  amount: number;
  entryTime: Date;
  status: 'OPEN' | 'PARTIAL_CLOSE' | 'CLOSED';
}
