import { db } from '../../database/connection';
import { defaultConfig } from '../../config';

export class RiskManager {
  private database = db.getConnection();
  
  private maxDailyLoss: number;
  private maxSingleTrade: number;
  private maxDailyTrades: number;
  private totalCapital: number;

  constructor(
    totalCapital: number = 1000,
    maxDailyLoss: number = defaultConfig.risk.maxDailyLoss,
    maxSingleTrade: number = defaultConfig.risk.maxSingleTrade,
    maxDailyTrades: number = defaultConfig.risk.maxDailyTrades
  ) {
    this.totalCapital = totalCapital;
    this.maxDailyLoss = maxDailyLoss;
    this.maxSingleTrade = maxSingleTrade;
    this.maxDailyTrades = maxDailyTrades;
  }

  checkDailyLossLimit(): { allowed: boolean; currentLoss: number; limit: number } {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.database.prepare(`
      SELECT COALESCE(SUM(pnl), 0) as total_pnl
      FROM trades
      WHERE DATE(created_at) = DATE(?)
    `);
    const result = stmt.get(today) as { total_pnl: number };
    const currentLoss = Math.abs(Math.min(0, result.total_pnl));
    const limit = this.totalCapital * this.maxDailyLoss;

    if (currentLoss >= limit) {
      this.logRiskEvent('limit_warning', `日亏损已达 ${currentLoss.toFixed(2)} 元，接近限额 ${limit.toFixed(2)} 元`, currentLoss, limit);
    }

    return {
      allowed: currentLoss < limit,
      currentLoss,
      limit,
    };
  }

  checkDailyTradeCount(): { allowed: boolean; count: number; limit: number } {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.database.prepare(`
      SELECT COUNT(*) as count
      FROM signals
      WHERE DATE(created_at) = DATE(?) AND status IN ('confirmed', 'executed')
    `);
    const result = stmt.get(today) as { count: number };
    const count = result.count;

    return {
      allowed: count < this.maxDailyTrades,
      count,
      limit: this.maxDailyTrades,
    };
  }

  checkSingleTradeLimit(amount: number): { allowed: boolean; limit: number } {
    const limit = this.totalCapital * this.maxSingleTrade;
    return {
      allowed: amount <= limit,
      limit,
    };
  }

  getRiskSummary(): {
    dailyLoss: { current: number; limit: number; allowed: boolean };
    tradeCount: { current: number; limit: number; allowed: boolean };
  } {
    const lossCheck = this.checkDailyLossLimit();
    const countCheck = this.checkDailyTradeCount();

    return {
      dailyLoss: {
        current: lossCheck.currentLoss,
        limit: lossCheck.limit,
        allowed: lossCheck.allowed,
      },
      tradeCount: {
        current: countCheck.count,
        limit: countCheck.limit,
        allowed: countCheck.allowed,
      },
    };
  }

  private logRiskEvent(type: string, message: string, exposure: number, limit: number): void {
    const stmt = this.database.prepare(`
      INSERT INTO risk_logs (log_type, message, current_exposure, limit_value)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(type, message, exposure, limit);
  }
}
