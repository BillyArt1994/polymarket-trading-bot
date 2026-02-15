import { HistoricalPrice } from './backtestEngine';

export class MockDataGenerator {
  /**
   * 生成模拟的市场价格数据
   * 模拟真实市场的波动和套利机会
   */
  static generateMockData(
    marketId: string,
    marketName: string,
    days: number = 7,
    intervalMinutes: number = 5
  ): HistoricalPrice[] {
    const data: HistoricalPrice[] = [];
    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // 基准价格（随机起始）
    let baseYesPrice = 0.45 + Math.random() * 0.1;  // 0.45 - 0.55
    let baseNoPrice = 0.95 - baseYesPrice;  // 初始偏离
    
    for (let i = 0; i < (days * 24 * 60) / intervalMinutes; i++) {
      const timestamp = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
      
      // 模拟价格波动
      const volatility = 0.005;  // 0.5% 波动
      const trend = Math.sin(i / 100) * 0.01;  // 缓慢趋势
      
      // 强制产生套利机会：30% 概率出现偏离
      let deviation = 0;
      
      // 30% 概率出现套利机会
      if (Math.random() < 0.3) {
        // 随机选择偏离度：1.5% - 6%
        deviation = 0.015 + Math.random() * 0.045;
      }
      
      // 10% 概率出现大偏离（高风险信号）
      if (Math.random() < 0.1) {
        deviation = 0.05 + Math.random() * 0.03;  // 5% 到 8% 偏离
      }
      
      // 计算价格（从均衡价格开始）
      const equilibriumYes = 0.5;
      const equilibriumNo = 0.5;
      
      // 根据偏离度调整价格
      const halfDeviation = deviation / 2;
      let yesPrice = equilibriumYes - halfDeviation + (Math.random() - 0.5) * 0.01;
      let noPrice = equilibriumNo - halfDeviation + (Math.random() - 0.5) * 0.01;
      
      // 确保价格在有效范围
      yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
      noPrice = Math.max(0.01, Math.min(0.99, noPrice));
      
      data.push({
        timestamp,
        marketId,
        marketName,
        yesPrice: Math.round(yesPrice * 10000) / 10000,
        noPrice: Math.round(noPrice * 10000) / 10000,
      });
      
      // 更新基准价格（保持一定连续性）
      baseYesPrice = yesPrice;
      baseNoPrice = noPrice;
    }
    
    return data;
  }

  /**
   * 生成多个市场的模拟数据
   */
  static generateMultiMarketData(
    markets: { id: string; name: string }[],
    days: number = 7
  ): HistoricalPrice[] {
    const allData: HistoricalPrice[] = [];
    
    for (const market of markets) {
      const marketData = this.generateMockData(market.id, market.name, days);
      allData.push(...marketData);
    }
    
    return allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 生成特定的套利场景数据
   */
  static generateArbitrageScenario(
    scenario: 'QUICK_RETURN' | 'SLOW_RETURN' | 'NO_RETURN' | 'WORSEN',
    marketId: string = 'test-market',
    marketName: string = 'Test Market'
  ): HistoricalPrice[] {
    const data: HistoricalPrice[] = [];
    const now = new Date();
    
    // 起始：偏离3%
    let yesPrice = 0.62;
    let noPrice = 0.35;  // total = 0.97, deviation = 3%
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now.getTime() + i * 5 * 60 * 1000);  // 5分钟间隔
      
      switch (scenario) {
        case 'QUICK_RETURN':
          // 快速回归：20个点内回归
          if (i < 20) {
            const progress = i / 20;
            yesPrice = 0.62 - (0.62 - 0.51) * progress;
            noPrice = 0.35 + (0.49 - 0.35) * progress;
          } else {
            yesPrice = 0.51 + (Math.random() - 0.5) * 0.01;
            noPrice = 0.49 + (Math.random() - 0.5) * 0.01;
          }
          break;
          
        case 'SLOW_RETURN':
          // 慢回归：60个点内回归
          if (i < 60) {
            const progress = i / 60;
            yesPrice = 0.62 - (0.62 - 0.51) * progress;
            noPrice = 0.35 + (0.49 - 0.35) * progress;
          }
          break;
          
        case 'NO_RETURN':
          // 不回归：保持偏离
          yesPrice = 0.62 + (Math.random() - 0.5) * 0.02;
          noPrice = 0.35 + (Math.random() - 0.5) * 0.02;
          break;
          
        case 'WORSEN':
          // 恶化：偏离更大
          yesPrice = 0.62 + i * 0.001;
          noPrice = 0.35 - i * 0.0005;
          break;
      }
      
      // 边界检查
      yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
      noPrice = Math.max(0.01, Math.min(0.99, noPrice));
      
      data.push({
        timestamp,
        marketId,
        marketName,
        yesPrice: Math.round(yesPrice * 10000) / 10000,
        noPrice: Math.round(noPrice * 10000) / 10000,
      });
    }
    
    return data;
  }
}
