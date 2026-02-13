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
  };
  wallet: {
    address: string;
  };
}

export const defaultConfig: BotConfig = {
  telegram: {
    botToken: process.env.BOT_TOKEN || '',
    allowedChatId: parseInt(process.env.ALLOWED_CHAT_ID || '0'),
  },
  database: {
    path: process.env.DB_PATH || './data/trading_bot.db',
  },
  risk: {
    maxDailyLoss: 0.05,
    maxSingleTrade: 0.20,
    maxDailyTrades: 3,
    minArbitrageGap: 0.015,
  },
  strategy: {
    checkInterval: 300000,
    priceHistoryDays: 30,
  },
  wallet: {
    address: process.env.WALLET_ADDRESS || '',
  },
};
