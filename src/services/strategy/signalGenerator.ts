import { Signal, ArbitrageOpportunity } from '../../types';

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
      reason: `套利偏离: ${(opportunity.deviationPercent * 100).toFixed(2)}%, 预期收益: ${(opportunity.expectedReturn * 100).toFixed(2)}%`,
      trigger_price: opportunity.recommendation === 'BUY_YES' ? opportunity.yesPrice : opportunity.noPrice,
      suggested_amount: this.calculateSuggestedAmount(opportunity.expectedReturn),
      status: 'pending',
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
      case 'BUY_BOTH':
        return 'ARBITRAGE';
      default:
        return 'HOLD';
    }
  }

  private calculateSuggestedAmount(expectedReturn: number): number {
    const baseAmount = 200;
    const multiplier = Math.min(1 + expectedReturn * 10, 2);
    return Math.round(baseAmount * multiplier);
  }
}
