import TelegramBot from 'node-telegram-bot-api';
import { Signal, ArbitrageOpportunity } from '../types';

export class TelegramBotService {
  private bot: TelegramBot;
  private allowedChatId: number;
  private onConfirmCallback?: (signalId: number) => void;
  private onRejectCallback?: (signalId: number) => void;

  constructor(token: string, allowedChatId: number) {
    this.bot = new TelegramBot(token, { polling: true });
    this.allowedChatId = allowedChatId;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      if (chatId !== this.allowedChatId) return;

      const data = query.data || '';
      const [action, signalIdStr] = data.split(':');
      const signalId = parseInt(signalIdStr);

      if (action === 'confirm') {
        await this.handleConfirm(chatId, signalId, query.id);
      } else if (action === 'reject') {
        await this.handleReject(chatId, signalId, query.id);
      }
    });

    this.bot.onText(/\/start/, (msg) => {
      if (msg.chat.id !== this.allowedChatId) return;
      this.bot.sendMessage(msg.chat.id, '👋 Polymarket 交易机器人已启动！\n\n可用命令：\n/status - 查看当前状态\n/positions - 查看持仓\n/signals - 查看最近信号');
    });
  }

  async sendArbitrageSignal(signal: Signal, opportunity: ArbitrageOpportunity): Promise<void> {
    const message = `
🎯 *发现套利机会！*

*事件：* ${opportunity.marketName}
*Yes价格：* $${opportunity.yesPrice.toFixed(3)}
*No价格：* $${opportunity.noPrice.toFixed(3)}
*价格总和：* $${opportunity.totalPrice.toFixed(3)}
*偏离度：* ${(opportunity.deviationPercent * 100).toFixed(2)}%

*建议操作：* ${this.formatRecommendation(opportunity.recommendation)}
*预期收益：* ${(opportunity.expectedReturn * 100).toFixed(2)}%
*建议金额：* $${signal.suggested_amount}
*置信度：* ${(opportunity.confidence * 100).toFixed(0)}%

⏰ 请在 5 分钟内确认，超时将自动放弃
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ 确认执行', callback_data: `confirm:${signal.id}` },
          { text: '❌ 忽略', callback_data: `reject:${signal.id}` },
        ],
        [
          { text: '📊 查看详情', url: `https://polymarket.com/event/${opportunity.marketId}` },
        ],
      ],
    };

    await this.bot.sendMessage(this.allowedChatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async sendRiskAlert(message: string): Promise<void> {
    await this.bot.sendMessage(this.allowedChatId, `⚠️ *风控提醒*\n\n${message}`, {
      parse_mode: 'Markdown',
    });
  }

  async sendDailyReport(pnl: number, trades: number): Promise<void> {
    const emoji = pnl >= 0 ? '📈' : '📉';
    const sign = pnl >= 0 ? '+' : '';
    await this.bot.sendMessage(
      this.allowedChatId,
      `${emoji} *今日交易报告*\n\n盈亏：${sign}$${pnl.toFixed(2)}\n交易数：${trades}笔`,
      { parse_mode: 'Markdown' }
    );
  }

  setConfirmCallback(callback: (signalId: number) => void): void {
    this.onConfirmCallback = callback;
  }

  setRejectCallback(callback: (signalId: number) => void): void {
    this.onRejectCallback = callback;
  }

  private async handleConfirm(chatId: number, signalId: number, queryId: string): Promise<void> {
    await this.bot.answerCallbackQuery(queryId, { text: '已确认' });
    await this.bot.sendMessage(
      chatId,
      `✅ 信号 #${signalId} 已确认！\n\n请在 MetaMask 中执行交易，完成后回复 /done ${signalId}`
    );
    if (this.onConfirmCallback) {
      this.onConfirmCallback(signalId);
    }
  }

  private async handleReject(chatId: number, signalId: number, queryId: string): Promise<void> {
    await this.bot.answerCallbackQuery(queryId, { text: '已忽略' });
    await this.bot.sendMessage(chatId, `❌ 信号 #${signalId} 已忽略`);
    if (this.onRejectCallback) {
      this.onRejectCallback(signalId);
    }
  }

  private formatRecommendation(rec: string): string {
    const map: Record<string, string> = {
      'BUY_YES': '买入 Yes',
      'BUY_NO': '买入 No',
      'BUY_BOTH': '双边套利',
      'WAIT': '继续观望',
    };
    return map[rec] || rec;
  }
}
