import 'dotenv/config';
import { BacktestEngine, BacktestConfig } from './services/execution/backtestEngine';
import { MockDataGenerator } from './services/execution/mockDataGenerator';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * 虚拟盘测试 - 运行策略回测
 * 
 * 使用方式:
 * npm run backtest           # 默认7天数据
 * npm run backtest -- --days=14 --scenario=QUICK_RETURN
 * npm run backtest -- --help
 */

interface BacktestOptions {
  days: number;
  scenario?: 'QUICK_RETURN' | 'SLOW_RETURN' | 'NO_RETURN' | 'WORSEN' | 'RANDOM';
  markets: number;
  output: string;
}

function parseArgs(): BacktestOptions {
  const args = process.argv.slice(2);
  const options: BacktestOptions = {
    days: 7,
    scenario: 'RANDOM',
    markets: 3,
    output: './backtest-report.json',
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
🤖 Polymarket 虚拟盘回测工具

用法: npm run backtest [选项]

选项:
  --days=N          回测天数 (默认: 7)
  --scenario=TYPE   测试场景: QUICK_RETURN, SLOW_RETURN, NO_RETURN, WORSEN, RANDOM (默认: RANDOM)
  --markets=N       模拟市场数量 (默认: 3)
  --output=PATH     报告输出路径 (默认: ./backtest-report.json)
  --help, -h        显示帮助

示例:
  npm run backtest -- --days=14 --scenario=QUICK_RETURN
  npm run backtest -- --markets=5 --days=30
`);
      process.exit(0);
    }

    if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--scenario=')) {
      options.scenario = arg.split('=')[1] as BacktestOptions['scenario'];
    } else if (arg.startsWith('--markets=')) {
      options.markets = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    }
  }

  return options;
}

async function runBacktest() {
  const options = parseArgs();

  console.log('🔄 Polymarket 虚拟盘回测');
  console.log('========================================');
  console.log(`回测天数: ${options.days}`);
  console.log(`测试场景: ${options.scenario}`);
  console.log(`市场数量: ${options.markets}`);
  console.log('========================================\n');

  // 生成模拟数据
  let priceData;
  
  if (options.scenario === 'RANDOM') {
    // 生成多个随机市场
    const markets = Array.from({ length: options.markets }, (_, i) => ({
      id: `market-${i + 1}`,
      name: `Test Market ${i + 1}`,
    }));
    priceData = MockDataGenerator.generateMultiMarketData(markets, options.days);
  } else {
    // 特定场景测试
    priceData = MockDataGenerator.generateArbitrageScenario(
      options.scenario!,
      'scenario-test',
      `${options.scenario} Test`
    );
  }

  console.log(`📊 生成价格数据: ${priceData.length} 个点\n`);

  // 配置回测
  const config: BacktestConfig = {
    initialCapital: 1000,
    startDate: new Date(Date.now() - options.days * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    minArbitrageGap: 0.015,
  };

  // 运行回测
  const engine = new BacktestEngine(config);
  const result = await engine.runBacktest(priceData);

  // 保存报告
  const reportPath = join(process.cwd(), options.output);
  writeFileSync(reportPath, JSON.stringify({
    config: {
      ...config,
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString(),
    },
    options,
    result: {
      ...result,
      trades: result.trades.map(t => ({
        ...t,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime?.toISOString(),
      })),
    },
  }, null, 2));

  console.log(`\n✅ 回测报告已保存: ${reportPath}`);

  // 简单评估
  console.log('\n📈 策略评估:');
  if (result.winRate >= 60 && result.totalPnL > 0) {
    console.log('🟢 策略表现良好，可考虑实盘测试');
  } else if (result.winRate >= 50 && result.totalPnL >= -10) {
    console.log('🟡 策略表现一般，建议优化参数');
  } else {
    console.log('🔴 策略表现不佳，需要调整策略逻辑');
  }

  // 关键指标检查
  console.log('\n⚠️ 风险提示:');
  if (result.maxDrawdown > 10) {
    console.log(`  - 最大回撤较高 (${result.maxDrawdown.toFixed(1)}%)，建议加强风控`);
  }
  if (result.sharpeRatio < 1) {
    console.log(`  - 夏普比率较低 (${result.sharpeRatio.toFixed(2)})，收益风险比不佳`);
  }
  if (result.totalTrades < 10) {
    console.log(`  - 交易次数较少 (${result.totalTrades})，数据可能不具代表性`);
  }
}

runBacktest().catch((error) => {
  console.error('❌ 回测失败:', error);
  process.exit(1);
});
