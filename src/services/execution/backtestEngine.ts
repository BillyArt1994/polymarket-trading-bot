import { ArbitrageStrategy } from '../strategy/arbitrage';
import { SignalGenerator } from '../strategy/signalGenerator';
import { VirtualExecutor, VirtualTrade, BacktestResult } from '../execution/virtualExecutor';
import { Signal } from '../../types';

export interface HistoricalPrice {
  timestamp: Date;
  marketId: string;
  marketName: string;
  yesPrice: number;
  noPrice: number;
}

export interface BacktestConfig {
  initialCapital: number;
  startDate: Date;
  endDate: Date;
  minArbitrageGap: number;
}

/**
 * 简化版风控管理器（内存实现，不依赖数据库）
 */
class SimpleRiskManager {
  private dailyLoss = 0;
  private dailyTrades = 0;
  private readonly maxDailyLoss: number;
  private readonly maxDailyTrades: number;
  private readonly maxSingleTrade: number;
  private currentDate: string = '';

  constructor(
    private totalCapital: number,
    maxDailyLoss: number = 0.05,
    maxSingleTrade: number = 0.20,
    maxDailyTrades: number = 3
  ) {
    this.maxDailyLoss = maxDailyLoss;
    this.maxSingleTrade = maxSingleTrade;
    this.maxDailyTrades = maxDailyTrades;
  }

  checkDate(timestamp: Date): void {
    const dateStr = timestamp.toISOString().split('T')[0];
    if (dateStr !== this.currentDate) {
      this.currentDate = dateStr;
      this.dailyLoss = 0;
      this.dailyTrades = 0;
    }
  }

  checkDailyLossLimit(): { allowed: boolean; currentLoss: number; limit: number } {
    const limit = this.totalCapital * this.maxDailyLoss;
    return {
      allowed: this.dailyLoss < limit,
      currentLoss: this.dailyLoss,
      limit,
    };
  }

  checkDailyTradeCount(): { allowed: boolean; count: number; limit: number } {
    return {
      allowed: this.dailyTrades < this.maxDailyTrades,
      count: this.dailyTrades,
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

  recordTrade(pnl: number): void {
    this.dailyTrades++;
    if (pnl < 0) {
      this.dailyLoss += Math.abs(pnl);
    }
  }
}

export class BacktestEngine {
  private strategy: ArbitrageStrategy;
  private signalGenerator: SignalGenerator;
  private executor: VirtualExecutor;
  private riskManager: SimpleRiskManager;
  private config: BacktestConfig;
  
  private signals: Map<number, { signal: Signal; opportunity: any }> = new Map();
  private signalIdCounter = 1;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.strategy = new ArbitrageStrategy(config.minArbitrageGap);
    this.signalGenerator = new SignalGenerator();
    this.executor = new VirtualExecutor(config.initialCapital);
    this.riskManager = new SimpleRiskManager(config.initialCapital);
  }

  /**
   * 运行回测
   */
  async runBacktest(priceData: HistoricalPrice[]): Promise<BacktestResult> {
    console.log(`🔄 开始回测: ${this.config.startDate.toISOString()} ~ ${this.config.endDate.toISOString()}`);
    console.log(`📊 价格数据点数: ${priceData.length}`);
    
    // 按时间排序
    const sortedData = priceData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // 处理每个时间点的数据
    let signalCount = 0;
    for (const dataPoint of sortedData) {
      const hasSignal = await this.processPricePoint(dataPoint);
      if (hasSignal) signalCount++;
    }

    console.log(`\n📊 总信号数: ${signalCount}`);

    // 强制平掉所有持仓
    this.closeAllPositions(sortedData[sortedData.length - 1]);

    // 生成报告
    const report = this.executor.generateReport();
    
    this.printReport(report);
    
    return report;
  }

  /**
   * 处理单个价格点
   */
  private async processPricePoint(data: HistoricalPrice): Promise<boolean> {
    // 更新日期
    this.riskManager.checkDate(data.timestamp);

    // 1. 检查现有持仓
    const openTrades = this.executor.getOpenTrades();
    for (const trade of openTrades) {
      if (trade.marketId === data.marketId) {
        const hoursHeld = (data.timestamp.getTime() - trade.entryTime.getTime()) / (1000 * 60 * 60);
        const decision = this.executor.checkPosition(trade.id, {
          yesPrice: data.yesPrice,
          noPrice: data.noPrice,
        }, hoursHeld);

        if (decision.action === 'FULL_CLOSE' || decision.action === 'TIMEOUT') {
          const exitPrice = trade.side === 'YES' ? data.yesPrice : data.noPrice;
          const closedTrade = this.executor.closeTrade(trade.id, exitPrice, data.timestamp, decision.action);
          if (closedTrade?.pnl !== undefined) {
            this.riskManager.recordTrade(closedTrade.pnl);
            console.log(`       🔒 平仓 #${trade.id} 原因: ${decision.reason} 盈亏: $${closedTrade.pnl.toFixed(2)}`);
          }
        } else if (decision.action === 'PARTIAL_CLOSE') {
          const exitPrice = trade.side === 'YES' ? data.yesPrice : data.noPrice;
          const closedTrade = this.executor.closeTrade(trade.id, exitPrice, data.timestamp, 'PARTIAL_CLOSE');
          if (closedTrade?.pnl !== undefined) {
            this.riskManager.recordTrade(closedTrade.pnl);
            console.log(`       🔒 部分平仓 #${trade.id} 盈亏: $${closedTrade.pnl.toFixed(2)}`);
          }
        }
      }
    }

    // 2. 检查新的套利机会
    const opportunity = this.strategy.detectOpportunity(
      data.marketId,
      data.marketName,
      data.yesPrice,
      data.noPrice
    );

    if (opportunity && opportunity.recommendation !== 'WAIT') {
      // 风控检查
      const lossCheck = this.riskManager.checkDailyLossLimit();
      const countCheck = this.riskManager.checkDailyTradeCount();
      
      if (!lossCheck.allowed) {
        return true;
      }
      if (!countCheck.allowed) {
        return true;
      }

      // 生成信号
      const { signal } = this.signalGenerator.generateFromArbitrage(data.marketId, opportunity);
      const signalId = this.signalIdCounter++;
      
      this.signals.set(signalId, { signal, opportunity });

      // 检查单笔限额
      let amount = signal.suggested_amount || 200;
      const amountCheck = this.riskManager.checkSingleTradeLimit(amount);
      if (!amountCheck.allowed) {
        // 如果建议金额超过限额，使用限额金额
        amount = amountCheck.limit;
      }

      // 模拟执行（假设立即确认）
      const trade = this.executor.executeTrade(
        signalId,
        data.marketId,
        data.marketName,
        opportunity.recommendation === 'BUY_YES' ? 'YES' : 'NO',
        opportunity.recommendation === 'BUY_YES' ? data.yesPrice : data.noPrice,
        opportunity.deviation,
        amount
      );

      console.log(`[回测] ${data.timestamp.toISOString()} ${data.marketName}`);
      console.log(`       偏离度: ${opportunity.deviationPercent.toFixed(2)}% | 建议: ${opportunity.recommendation} | 等级: ${opportunity.level}`);
      console.log(`       ✅ 执行交易 #${trade.id} 金额: $${amount}`);

      return true;
    }

    return false;
  }

  /**
   * 平掉所有持仓
   */
  private closeAllPositions(lastPrice: HistoricalPrice): void {
    const openTrades = this.executor.getOpenTrades();
    
    for (const trade of openTrades) {
      const exitPrice = trade.side === 'YES' ? lastPrice.yesPrice : lastPrice.noPrice;
      const closedTrade = this.executor.closeTrade(trade.id, exitPrice, lastPrice.timestamp, 'MANUAL');
      if (closedTrade?.pnl) {
        this.riskManager.recordTrade(closedTrade.pnl);
      }
    }
  }

  /**
   * 打印回测报告
   */
  private printReport(report: BacktestResult): void {
    console.log('\n========================================');
    console.log('📊 回测报告');
    console.log('========================================');
    console.log(`总交易数: ${report.totalTrades}`);
    console.log(`盈利交易: ${report.winningTrades}`);
    console.log(`亏损交易: ${report.losingTrades}`);
    console.log(`胜率: ${report.winRate.toFixed(2)}%`);
    console.log(`总盈亏: $${report.totalPnL.toFixed(2)} (${report.totalPnLPercent.toFixed(2)}%)`);
    console.log(`平均收益: ${report.avgReturn.toFixed(2)}%`);
    console.log(`最大回撤: ${report.maxDrawdown.toFixed(2)}%`);
    console.log(`夏普比率: ${report.sharpeRatio.toFixed(2)}`);
    console.log('========================================\n');

    // 打印交易明细
    if (report.trades.length > 0) {
      console.log('📝 交易明细 (最近10笔):');
      for (const trade of report.trades.slice(-10)) {
        const emoji = (trade.pnl || 0) > 0 ? '🟢' : '🔴';
        console.log(`  ${emoji} #${trade.id} ${trade.marketName} ${trade.side} 盈亏: $${trade.pnl?.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)`);
      }
      console.log('');
    }
  }
}
