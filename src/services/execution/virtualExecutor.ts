import { Position } from '../types';

export interface VirtualTrade {
  id: number;
  signalId: number;
  marketId: string;
  marketName: string;
  side: 'YES' | 'NO';
  entryPrice: number;
  entryDeviation: number;
  amount: number;
  quantity: number;
  entryTime: Date;
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: 'PARTIAL_CLOSE' | 'FULL_CLOSE' | 'TIMEOUT' | 'MANUAL';
  pnl?: number;
  pnlPercent?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: VirtualTrade[];
}

export class VirtualExecutor {
  private trades: VirtualTrade[] = [];
  private positions: Map<string, VirtualTrade> = new Map();
  private tradeIdCounter = 1;
  
  private initialCapital: number;
  private currentCapital: number;
  private peakCapital: number;

  constructor(initialCapital: number = 1000) {
    this.initialCapital = initialCapital;
    this.currentCapital = initialCapital;
    this.peakCapital = initialCapital;
  }

  /**
   * 执行虚拟交易
   */
  executeTrade(
    signalId: number,
    marketId: string,
    marketName: string,
    side: 'YES' | 'NO',
    price: number,
    deviation: number,
    amount: number
  ): VirtualTrade {
    const quantity = amount / price;
    
    const trade: VirtualTrade = {
      id: this.tradeIdCounter++,
      signalId,
      marketId,
      marketName,
      side,
      entryPrice: price,
      entryDeviation: deviation,
      amount,
      quantity,
      entryTime: new Date(),
      status: 'OPEN',
    };

    this.trades.push(trade);
    this.positions.set(marketId, trade);
    
    this.currentCapital -= amount;
    
    console.log(`[虚拟交易] #${trade.id} 买入 ${side} $${amount} @ $${price.toFixed(4)}`);
    
    return trade;
  }

  /**
   * 检查持仓并决定操作
   */
  checkPosition(
    tradeId: number,
    currentPrices: { yesPrice: number; noPrice: number },
    hoursHeld: number
  ): { action: 'HOLD' | 'PARTIAL_CLOSE' | 'FULL_CLOSE' | 'TIMEOUT'; reason: string; pnl?: number } {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade || trade.status === 'CLOSED') {
      return { action: 'HOLD', reason: '无持仓' };
    }

    const currentPrice = trade.side === 'YES' ? currentPrices.yesPrice : currentPrices.noPrice;
    const currentTotal = currentPrices.yesPrice + currentPrices.noPrice;
    const currentDeviation = 1 - currentTotal;
    
    // 计算收益
    const priceDiff = currentPrice - trade.entryPrice;
    const pnl = priceDiff * trade.quantity;
    const pnlPercent = (pnl / trade.amount) * 100;

    // 规则1：偏离度已回归50% → 减仓50%
    const deviationRecovered = trade.entryDeviation - currentDeviation;
    const recoveryPercent = deviationRecovered / trade.entryDeviation;
    
    if (recoveryPercent >= 0.5 && !trade.exitReason) {
      return {
        action: 'PARTIAL_CLOSE',
        reason: `偏离度已回归50% (${(recoveryPercent * 100).toFixed(1)}%)`,
        pnl: pnl * 0.5  // 50%减仓
      };
    }

    // 规则2：完全回归（<0.5%）→ 全部平仓
    if (currentDeviation < 0.005) {
      return {
        action: 'FULL_CLOSE',
        reason: `偏离度已完全回归至 ${(currentDeviation * 100).toFixed(2)}%`,
        pnl
      };
    }

    // 规则3：持仓超过24小时 → 强制平仓
    if (hoursHeld >= 24) {
      return {
        action: 'TIMEOUT',
        reason: `持仓超过24小时，当前盈亏: ${pnlPercent.toFixed(2)}%`,
        pnl
      };
    }

    return {
      action: 'HOLD',
      reason: `偏离度回归 ${(recoveryPercent * 100).toFixed(1)}%，当前盈亏: ${pnlPercent.toFixed(2)}%`
    };
  }

  /**
   * 平仓
   */
  closeTrade(
    tradeId: number,
    exitPrice: number,
    exitTime: Date,
    reason: VirtualTrade['exitReason']
  ): VirtualTrade | null {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade || trade.status === 'CLOSED') return null;

    const priceDiff = exitPrice - trade.entryPrice;
    const pnl = priceDiff * trade.quantity;
    const pnlPercent = (pnl / trade.amount) * 100;

    trade.exitPrice = exitPrice;
    trade.exitTime = exitTime;
    trade.exitReason = reason;
    trade.pnl = pnl;
    trade.pnlPercent = pnlPercent;
    trade.status = 'CLOSED';

    this.currentCapital += trade.amount + pnl;
    this.positions.delete(trade.marketId);

    // 更新峰值
    if (this.currentCapital > this.peakCapital) {
      this.peakCapital = this.currentCapital;
    }

    console.log(`[虚拟平仓] #${trade.id} ${reason} 盈亏: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);

    return trade;
  }

  /**
   * 生成回测报告
   */
  generateReport(): BacktestResult {
    const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) <= 0);
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnLPercent = (totalPnL / this.initialCapital) * 100;
    
    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = this.initialCapital;
    
    for (const trade of closedTrades) {
      const capitalAfterTrade = this.initialCapital + 
        closedTrades
          .filter(t => t.exitTime && t.exitTime <= trade.exitTime!)
          .reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      if (capitalAfterTrade > peak) {
        peak = capitalAfterTrade;
      }
      
      const drawdown = (peak - capitalAfterTrade) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // 简化夏普比率计算
    const returns = closedTrades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnL,
      totalPnLPercent,
      avgReturn,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      trades: closedTrades,
    };
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    initialCapital: number;
    currentCapital: number;
    availableCapital: number;
    openPositions: number;
    totalTrades: number;
  } {
    return {
      initialCapital: this.initialCapital,
      currentCapital: this.currentCapital,
      availableCapital: this.currentCapital,
      openPositions: this.positions.size,
      totalTrades: this.trades.length,
    };
  }
}
