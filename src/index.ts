import 'dotenv/config';
import cron from 'node-cron';
import { PolymarketAPI } from './services/data/polymarket';
import { ArbitrageStrategy } from './services/strategy/arbitrage';
import { SignalGenerator } from './services/strategy/signalGenerator';
import { RiskManager } from './services/risk/riskManager';
import { TelegramBotService } from './bot';
import { MarketRepository } from './database/repositories/market';
import { PriceRepository } from './database/repositories/price';
import { defaultConfig } from './config';

async function main() {
  console.log('🚀 启动 Polymarket 交易机器人...');

  // 初始化服务
  const polymarket = new PolymarketAPI();
  const arbitrageStrategy = new ArbitrageStrategy(defaultConfig.risk.minArbitrageGap);
  const signalGenerator = new SignalGenerator();
  const riskManager = new RiskManager(
    1000,
    defaultConfig.risk.maxDailyLoss,
    defaultConfig.risk.maxSingleTrade,
    defaultConfig.risk.maxDailyTrades
  );
  const marketRepo = new MarketRepository();
  const priceRepo = new PriceRepository();

  // 初始化 Telegram Bot
  const bot = new TelegramBotService(
    defaultConfig.telegram.botToken,
    defaultConfig.telegram.allowedChatId
  );

  console.log('✅ 服务初始化完成');

  // 主检查循环（每5分钟）
  const checkMarkets = async () => {
    console.log(`\n[${new Date().toISOString()}] 开始市场检查...`);

    // 风控检查
    const lossCheck = riskManager.checkDailyLossLimit();
    if (!lossCheck.allowed) {
      console.warn(`⚠️ 日亏损限额已达 ${lossCheck.currentLoss.toFixed(2)} 元，暂停交易`);
      await bot.sendRiskAlert(`日亏损已达 ${lossCheck.currentLoss.toFixed(2)} 元，今日暂停新交易`);
      return;
    }

    const tradeCountCheck = riskManager.checkDailyTradeCount();
    if (!tradeCountCheck.allowed) {
      console.warn(`⚠️ 日交易次数已达 ${tradeCountCheck.count} 次，暂停交易`);
      return;
    }

    // 获取活跃市场
    const markets = await polymarket.getActiveMarkets();
    console.log(`📊 获取到 ${markets.length} 个活跃市场`);

    // 保存市场信息
    for (const market of markets) {
      marketRepo.create(market);
    }

    // 检查每个市场的套利机会
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
        console.log(`🎯 发现套利机会: ${market.question}`);
        console.log(`   偏离度: ${(opportunity.deviationPercent * 100).toFixed(2)}%`);

        // 生成信号
        const { signal } = signalGenerator.generateFromArbitrage(market.id, opportunity);

        // 检查单笔限额
        const amountCheck = riskManager.checkSingleTradeLimit(signal.suggested_amount || 0);
        if (!amountCheck.allowed) {
          console.warn(`⚠️ 建议金额 ${signal.suggested_amount} 超过单笔限额 ${amountCheck.limit}`);
          continue;
        }

        // 发送 Telegram 通知
        await bot.sendArbitrageSignal(signal, opportunity);
      }
    }

    console.log(`[${new Date().toISOString()}] 市场检查完成\n`);
  };

  // 立即执行一次
  await checkMarkets();

  // 定时执行（每5分钟）
  cron.schedule('*/5 * * * *', checkMarkets);

  console.log('🤖 机器人正在运行，每5分钟检查一次市场...');
}

main().catch(console.error);
