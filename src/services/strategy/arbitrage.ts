export interface ArbitrageOpportunity {
  marketId: string;
  marketName: string;
  yesPrice: number;
  noPrice: number;
  totalPrice: number;
  deviation: number;
  deviationPercent: number;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'BUY_BOTH' | 'WAIT';
  confidence: number;
  expectedReturn: number;
}

export class ArbitrageStrategy {
  private minGap: number;

  constructor(minGap: number = 0.015) {
    this.minGap = minGap;
  }

  detectOpportunity(
    marketId: string,
    marketName: string,
    yesPrice: number,
    noPrice: number
  ): ArbitrageOpportunity | null {
    const totalPrice = yesPrice + noPrice;
    const deviation = 1 - totalPrice;
    const deviationPercent = deviation;

    if (deviation < this.minGap) {
      return null;
    }

    const confidence = Math.min(0.95, deviation * 5);
    const estimatedFee = 0.005;
    const expectedReturn = deviation - estimatedFee;

    let recommendation: ArbitrageOpportunity['recommendation'];
    if (deviation < 0.02) {
      recommendation = 'WAIT';
    } else if (yesPrice < noPrice) {
      recommendation = 'BUY_YES';
    } else {
      recommendation = 'BUY_NO';
    }

    return {
      marketId,
      marketName,
      yesPrice,
      noPrice,
      totalPrice,
      deviation,
      deviationPercent,
      recommendation,
      confidence,
      expectedReturn,
    };
  }
}
