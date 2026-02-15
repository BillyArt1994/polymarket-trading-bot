import { ArbitrageStrategy } from '../strategy/arbitrage';
import { SignalGenerator } from '../strategy/signalGenerator';
import { VirtualExecutor, VirtualTrade, BacktestResult } from '../execution/virtualExecutor';
import { RiskManager } from '../risk/riskManager';
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

export class BacktestEngine {
  private strategy: ArbitrageStrategy;
  private signalGenerator: SignalGenerator;
  private executor: VirtualExecutor;
  private riskManager: RiskManager;
  private config: BacktestConfig;
  
  private signals: Map<number, { signal: Signal; opportunity: any }> = new Map();
  private signalIdCounter = 1;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.strategy = new ArbitrageStrategy(config.minArbitrageGap);
    this.signalGenerator = new SignalGenerator();
    this.executor = new VirtualExecutor(config.initialCapital);
    this.riskManager = new RiskManager(config.initialCapital);
  }

  /**
   * 运行回测
   */
  async runBacktest(priceData: HistoricalPrice[]): Promise<BacktestResult> {
    console.log(`🔄 开始回测: ${this.config.startDate.toISOString()} ~ ${this.config.endDate.toISOString()}`);
    console.log(`📊 价格数据点数: ${priceData.length}`);
    
    // 按时间排序
    const sortedData = priceData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // 按市场分组
    const marketData = this.groupByMarket(sortedData);
    
    // 处理每个时间点的数据
    for (const dataPoint of sortedData) {
      await this.processPricePoint(dataPoint);
    }

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
  private async processPricePoint(data: HistoricalPrice): Promise<void> {
    // 1. 检查现有持仓
    const openTrades = this.getOpenTrades();
    for (const trade of openTrades) {
      if (trade.marketId === data.marketId) {
        const hoursHeld = (data.timestamp.getTime() - trade.entryTime.getTime()) / (1000 * 60 * 60);
        const decision = this.executor.checkPosition(trade.id, {
          yesPrice: data.yesPrice,
          noPrice: data.noPrice,
        }, hoursHeld);

        if (decision.action === 'FULL_CLOSE' || decision.action === 'TIMEOUT') {
          const exitPrice = trade.side === 'YES' ? data.yesPrice : data.noPrice;
          this.executor.closeTrade(trade.id, exitPrice, data.timestamp, decision.action);
        } else if (decision.action === 'PARTIAL_CLOSE') {
          // 简化处理：部分减仓直接全平
          const exitPrice = trade.side === 'YES' ? data.yesPrice : data.noPrice;
          this.executor.closeTrade(trade.id, exitPrice, data.timestamp, 'PARTIAL_CLOSE');
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
      
      if (!lossCheck.allowed || !countCheck.allowed) {
        return;
      }

      // 生成信号
      const { signal } = this.signalGenerator.generateFromArbitrage(data.marketId, opportunity);
      const signalId = this.signalIdCounter++;
      
      this.signals.set(signalId, { signal, opportunity });

      // 模拟执行（假设立即确认）
      const trade = this.executor.executeTrade(
        signalId,
        data.marketId,
        data.marketName,
        opportunity.recommendation === 'BUY_YES' ? 'YES' : 'NO',
        opportunity.recommendation === 'BUY_YES' ? data.yesPrice : data.noPrice,
        opportunity.deviation,
        signal.suggested_amount || 200
      );

      console.log(`[回测] ${data.timestamp.toISOString()} 发现信号 #${signalId} 偏离度: ${opportunity.deviationPercent.toFixed(2)}%`);
    }
  }

  /**
   * 平掉所有持仓
   */
  private closeAllPositions(lastPrice: HistoricalPrice): void {
    const openTrades = this.getOpenTrades();
    
    for (const trade of openTrades) {
      const exitPrice = trade.side === 'YES' ? lastPrice.yesPrice : lastPrice.noPrice;
      this.executor.closeTrade(trade.id, exitPrice, lastPrice.timestamp, 'MANUAL');
    }
  }

  /**
   * 按市场分组
   */
  private groupByMarket(data: HistoricalPrice[]): Map<string, HistoricalPrice[]> {
    const groups = new Map<string, HistoricalPrice[]>();
    
    for (const point of data) {
      const existing = groups.get(point.marketId) || [];
      existing.push(point);
      groups.set(point.marketId, existing);
    }
    
    return groups;
  }

  /**
   * 获取未平仓交易
   */
  private getOpenTrades(): VirtualTrade[] {
    const status = this.executor.getStatus();
    // 这里简化处理，实际应该从 executor 获取
    return [];
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
      console.log('📝 交易明细:');
      for (const trade of report.trades.slice(-10)) {  // 只显示最后10笔
        const emoji = (trade.pnl || 0) > 0 ? '🟢' : '🔴';
        console.log(`  ${emoji} #${trade.id} ${trade.marketName} ${trade.side} 盈亏: $${trade.pnl?.toFixed(2)}`);
      }
    }
  }
}
