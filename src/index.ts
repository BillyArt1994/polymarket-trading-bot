import 'dotenv/config';
import cron from 'node-cron';
import { PolymarketAPI } from './services/data/polymarket';
import { ArbitrageStrategy } from './services/strategy/arbitrage';
import { SignalGenerator } from './services/strategy/signalGenerator';
import { RiskManager } from './services/risk/riskManager';
import { TelegramBotService } from './bot';
import { MarketRepository } from './database/repositories/market';
import { PriceRepository } from './database/repositories/price';
import { SignalRepository, OpportunityRepository } from './database/repositories/signal';
import { defaultConfig } from './config';

async function main() {
  console.log('🚀 启动 Polymarket 交易机器人...');
  console.log(`📊 运行模式: ${defaultConfig.mode === 'SIMULATION' ? '模拟交易' : '实盘交易'}`);

  // 初始化服务
  const polymarket = new PolymarketAPI();
  const arbitrageStrategy = new ArbitrageStrategy();
  const signalGenerator = new SignalGenerator();
  const riskManager = new RiskManager();
  const marketRepo = new MarketRepository();
  const priceRepo = new PriceRepository();
  const signalRepo = new SignalRepository();
  const opportunityRepo = new OpportunityRepository();

  // 初始化 Telegram Bot
  let bot: TelegramBotService | null = null;
  if (defaultConfig.telegram.botToken && defaultConfig.telegram.allowedChatId) {
    bot = new TelegramBotService(
      defaultConfig.telegram.botToken,
      defaultConfig.telegram.allowedChatId
    );
    
    // 设置确认回调
    bot.setConfirmCallback(async (signalId) => {
      signalRepo.updateStatus(signalId, 'confirmed');
      console.log(`✅ 信号 #${signalId} 已确认`);
    });
    
    bot.setRejectCallback(async (signalId) => {
      signalRepo.updateStatus(signalId, 'rejected');
      console.log(`❌ 信号 #${signalId} 已拒绝`);
    });
    
    console.log('✅ Telegram Bot 已启动');
  } else {
    console.warn('⚠️ Telegram Bot 未配置，将只记录信号不推送');
  }

  console.log('✅ 服务初始化完成');

  // 信号过期检查任务（每分钟）
  cron.schedule('* * * * *', () => {
    const expired = signalRepo.expireOldSignals();
    if (expired > 0) {
      console.log(`⏰ ${expired} 个信号已过期`);
    }
  });

  // 主检查循环（每5分钟）
  const checkMarkets = async () => {
    const now = new Date().toISOString();
    console.log(`\n[${now}] 开始市场检查...`);

    // 风控检查
    const riskSummary = riskManager.getRiskSummary();
    
    if (!riskSummary.dailyLoss.allowed) {
      console.warn(`⚠️ 日亏损限额已达 ${riskSummary.dailyLoss.current.toFixed(2)} 元，暂停交易`);
      bot?.sendRiskAlert(`日亏损已达 ${riskSummary.dailyLoss.current.toFixed(2)} 元，今日暂停新交易`);
      return;
    }

    if (!riskSummary.tradeCount.allowed) {
      console.warn(`⚠️ 日交易次数已达 ${riskSummary.tradeCount.current} 次，暂停交易`);
      return;
    }

    console.log(`💰 风控状态: 日亏损 ${riskSummary.dailyLoss.current.toFixed(2)}/${riskSummary.dailyLoss.limit.toFixed(2)}; 交易次数 ${riskSummary.tradeCount.current}/${riskSummary.tradeCount.limit}`);

    // 获取活跃市场
    const markets = await polymarket.getActiveMarkets();
    console.log(`📊 获取到 ${markets.length} 个活跃市场`);

    // 保存市场信息
    for (const market of markets) {
      marketRepo.create(market);
    }

    // 检查每个市场的套利机会
    let opportunityCount = 0;
    for (const market of markets.slice(0, 20)) {
      const prices = await polymarket.getMarketPrices(market.id);
      if (!prices) continue;

      // 保存价格快照
      priceRepo.create(prices);

      // 检测套利机会
      const opportunity = arbitrageStrategy.detectOpportunity(
        market.id,
        market.question,
        prices.yes_price,
        prices.no_price
      );

      if (opportunity && opportunity.recommendation !== 'WAIT') {
        opportunityCount++;
        console.log(`🎯 [${opportunity.level}] ${market.question}`);
        console.log(`   偏离度: ${opportunity.deviationPercent.toFixed(2)}% | 建议: ${opportunity.recommendation} | 有效期: ${opportunity.expiryMinutes}分钟`);

        // 检查单笔限额
        const amountCheck = riskManager.checkSingleTradeLimit(
          opportunity.expectedReturn * 1000  // 估算金额
        );
        if (!amountCheck.allowed) {
          console.warn(`   ⚠️ 超过单笔限额`);
          continue;
        }

        // 保存机会记录
        const opportunityId = opportunityRepo.create(opportunity);

        // 生成信号
        const { signal } = signalGenerator.generateFromArbitrage(market.id, opportunity);
        signal.opportunity_id = opportunityId;
        
        // 保存信号
        const signalId = signalRepo.create(signal);
        
        // 推送 Telegram
        if (bot) {
          const signalWithId = { ...signal, id: signalId };
          await bot.sendArbitrageSignal(signalWithId, opportunity);
        }

        // 模拟模式：记录但不执行
        if (defaultConfig.mode === 'SIMULATION') {
          console.log(`   [模拟] 信号 #${signalId} 已记录，等待确认`);
        }
      }
    }

    console.log(`[${new Date().toISOString()}] 市场检查完成，发现 ${opportunityCount} 个机会\n`);
  };

  // 立即执行一次
  await checkMarkets();

  // 定时执行（每5分钟）
  cron.schedule('*/5 * * * *', checkMarkets);

  console.log('🤖 机器人正在运行，每5分钟检查一次市场...');
  console.log('💡 按 Ctrl+C 停止\n');
}

main().catch((error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});
