import { Signal, ArbitrageOpportunity, SignalLevel } from '../../types';

export interface SignalResult {
  signal: Signal;
  opportunity: ArbitrageOpportunity;
}

export class SignalGenerator {
  generateFromArbitrage(
    marketId: string,
    opportunity: ArbitrageOpportunity
  ): SignalResult {
    const signalType = this.mapRecommendationToSignalType(opportunity.recommendation);
    
    const signal: Signal = {
      market_id: marketId,
      signal_type: signalType,
      confidence: opportunity.confidence,
      reason: this.buildReason(opportunity),
      trigger_price: opportunity.recommendation === 'BUY_YES' 
        ? opportunity.yesPrice 
        : opportunity.noPrice,
      suggested_amount: this.calculateSuggestedAmount(opportunity.expectedReturn),
      status: 'pending',
      level: opportunity.level,
      expiry_minutes: opportunity.expiryMinutes,
    };

    return { signal, opportunity };
  }

  private mapRecommendationToSignalType(
    recommendation: ArbitrageOpportunity['recommendation']
  ): Signal['signal_type'] {
    switch (recommendation) {
      case 'BUY_YES':
        return 'BUY_YES';
      case 'BUY_NO':
        return 'BUY_NO';
      default:
        return 'HOLD';
    }
  }

  private buildReason(opportunity: ArbitrageOpportunity): string {
    const parts: string[] = [
      `套利偏离: ${opportunity.deviationPercent.toFixed(2)}%`,
      `预期收益: ${(opportunity.expectedReturn * 100).toFixed(2)}%`,
      `信号等级: ${this.translateLevel(opportunity.level)}`,
    ];
    
    if (opportunity.warningMessage) {
      parts.push(`提醒: ${opportunity.warningMessage}`);
    }
    
    return parts.join('; ');
  }

  private translateLevel(level: SignalLevel): string {
    const map: Record<SignalLevel, string> = {
      'CONSERVATIVE': '保守',
      'STANDARD': '标准',
      'AGGRESSIVE': '激进',
      'RISKY': '高风险',
    };
    return map[level] || level;
  }

  private calculateSuggestedAmount(expectedReturn: number): number {
    const baseAmount = 200;
    const multiplier = Math.min(1 + expectedReturn * 10, 2);
    return Math.round(baseAmount * multiplier);
  }
}
