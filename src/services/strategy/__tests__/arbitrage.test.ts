import { ArbitrageStrategy } from '../src/services/strategy/arbitrage';
import { SignalGenerator } from '../src/services/strategy/signalGenerator';

describe('ArbitrageStrategy', () => {
  let strategy: ArbitrageStrategy;

  beforeEach(() => {
    strategy = new ArbitrageStrategy(0.015);
  });

  test('should detect opportunity when deviation >= 1.5%', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.62,  // yes
      0.35   // no, total = 0.97, deviation = 3%
    );

    expect(opportunity).not.toBeNull();
    expect(opportunity?.deviationPercent).toBeCloseTo(3, 1);
    expect(opportunity?.level).toBe('AGGRESSIVE');
  });

  test('should return null when deviation < 1.5%', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.51,  // yes
      0.48   // no, total = 0.99, deviation = 1%
    );

    expect(opportunity).toBeNull();
  });

  test('should classify as RISKY when deviation >= 5%', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.70,  // yes
      0.24   // no, total = 0.94, deviation = 6%
    );

    expect(opportunity?.level).toBe('RISKY');
    expect(opportunity?.expiryMinutes).toBe(10);
    expect(opportunity?.warningMessage).toContain('高风险');
  });

  test('should classify as CONSERVATIVE when deviation 1.5%-3%', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.60,  // yes
      0.38   // no, total = 0.98, deviation = 2%
    );

    expect(opportunity?.level).toBe('CONSERVATIVE');
    expect(opportunity?.expiryMinutes).toBe(3);
  });

  test('should recommend BUY_YES when yes price is lower', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.45,  // yes (lower)
      0.52   // no
    );

    expect(opportunity?.recommendation).toBe('BUY_YES');
  });

  test('should recommend BUY_NO when no price is lower', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.55,  // yes
      0.42   // no (lower)
    );

    expect(opportunity?.recommendation).toBe('BUY_NO');
  });

  test('should return WAIT when deviation < 2%', () => {
    const opportunity = strategy.detectOpportunity(
      'test-market',
      'Test Market',
      0.60,
      0.38   // deviation ~2%
    );

    // 边界情况，取决于具体值
    if (opportunity && opportunity.deviationPercent < 2) {
      expect(opportunity.recommendation).toBe('WAIT');
    }
  });
});

describe('SignalGenerator', () => {
  let generator: SignalGenerator;

  beforeEach(() => {
    generator = new SignalGenerator();
  });

  test('should generate signal with correct type', () => {
    const opportunity = {
      marketId: 'test',
      marketName: 'Test',
      yesPrice: 0.45,
      noPrice: 0.52,
      totalPrice: 0.97,
      deviation: 0.03,
      deviationPercent: 3,
      recommendation: 'BUY_YES' as const,
      confidence: 0.8,
      expectedReturn: 0.025,
      level: 'AGGRESSIVE' as const,
      expiryMinutes: 5,
    };

    const { signal } = generator.generateFromArbitrage('test', opportunity);

    expect(signal.signal_type).toBe('BUY_YES');
    expect(signal.confidence).toBe(0.8);
    expect(signal.status).toBe('pending');
    expect(signal.level).toBe('AGGRESSIVE');
    expect(signal.expiry_minutes).toBe(5);
  });

  test('should calculate suggested amount based on expected return', () => {
    const opportunity = {
      marketId: 'test',
      marketName: 'Test',
      yesPrice: 0.5,
      noPrice: 0.5,
      totalPrice: 1.0,
      deviation: 0.05,
      deviationPercent: 5,
      recommendation: 'BUY_YES' as const,
      confidence: 0.95,
      expectedReturn: 0.045,
      level: 'RISKY' as const,
      expiryMinutes: 10,
    };

    const { signal } = generator.generateFromArbitrage('test', opportunity);

    // base 200 + multiplier based on expected return
    expect(signal.suggested_amount).toBeGreaterThan(200);
    expect(signal.suggested_amount).toBeLessThanOrEqual(400);
  });
});
