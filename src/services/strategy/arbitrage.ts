import { ArbitrageOpportunity, SignalLevel } from '../types';

export class ArbitrageStrategy {
  private minGap: number = 0.015;

  detectOpportunity(
    marketId: string,
    marketName: string,
    yesPrice: number,
    noPrice: number
  ): ArbitrageOpportunity | null {
    const totalPrice = yesPrice + noPrice;
    const deviation = 1 - totalPrice;
    const deviationPercent = deviation * 100;

    if (deviation < this.minGap) return null;

    let level: SignalLevel;
    let expiryMinutes: number;
    let warningMessage: string | undefined;

    if (deviationPercent >= 5) {
      level = 'RISKY';
      expiryMinutes = 10;
      warningMessage = '⚠️ 偏离度超过5%，可能存在隐藏风险（流动性问题、事件临近等），请谨慎评估';
    } else if (deviationPercent >= 3) {
      level = 'AGGRESSIVE';
      expiryMinutes = 5;
    } else {
      level = 'CONSERVATIVE';
      expiryMinutes = 3;
      warningMessage = '💡 偏离度较小，收益空间有限，请确认gas费不会吃掉利润';
    }

    const confidence = Math.min(0.95, deviation * 5);
    const estimatedFee = 0.005;
    const expectedReturn = deviation - estimatedFee;

    return {
      marketId,
      marketName,
      yesPrice,
      noPrice,
      totalPrice,
      deviation,
      deviationPercent,
      level,
      expiryMinutes,
      warningMessage,
      recommendation: this.getRecommendation(yesPrice, noPrice, deviationPercent),
      confidence,
      expectedReturn,
    };
  }

  private getRecommendation(
    yesPrice: number,
    noPrice: number,
    deviationPercent: number
  ): 'BUY_YES' | 'BUY_NO' | 'WAIT' {
    if (deviationPercent < 2) return 'WAIT';
    return yesPrice < noPrice ? 'BUY_YES' : 'BUY_NO';
  }
}
