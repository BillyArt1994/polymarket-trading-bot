import 'dotenv/config';
import { BotConfig } from '../types';

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
    thresholds: {
      minArbitrageGap: 0.015,
      conservative: { min: 0.015, max: 0.03 },
      standard: { min: 0.03, max: 0.05 },
      aggressive: { min: 0.05 },
    },
    expiryMinutes: {
      conservative: 3,
      standard: 5,
      aggressive: 10,
    },
    takeProfit: {
      partialCloseAt: 0.5,
      fullCloseAt: 0.005,
      maxHoldHours: 24,
    },
  },
  wallet: {
    address: process.env.WALLET_ADDRESS || '',
  },
  mode: (process.env.MODE as 'SIMULATION' | 'LIVE') || 'SIMULATION',
  simulation: {
    initialCapital: 1000,
    logTrades: true,
    notifyOnSignal: true,
  },
};
