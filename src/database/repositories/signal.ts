import Database from 'better-sqlite3';
import { db } from '../connection';
import { ArbitrageOpportunity, Signal, Trade } from '../../types';

export class SignalRepository {
  private database = db.getConnection();

  create(signal: Signal): number {
    const stmt = this.database.prepare(`
      INSERT INTO signals (market_id, opportunity_id, signal_type, confidence, reason, trigger_price, suggested_amount, status, level, expiry_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      signal.market_id,
      signal.opportunity_id,
      signal.signal_type,
      signal.confidence,
      signal.reason,
      signal.trigger_price,
      signal.suggested_amount,
      signal.status,
      signal.level,
      signal.expiry_minutes
    );
    return result.lastInsertRowid as number;
  }

  findById(id: number): Signal | null {
    const stmt = this.database.prepare('SELECT * FROM signals WHERE id = ?');
    const result = stmt.get(id);
    return result ? (result as Signal) : null;
  }

  findPending(): Signal[] {
    const stmt = this.database.prepare(`
      SELECT * FROM signals 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `);
    return stmt.all() as Signal[];
  }

  updateStatus(id: number, status: Signal['status']): void {
    const stmt = this.database.prepare(`
      UPDATE signals 
      SET status = ?, ${status === 'confirmed' ? 'confirmed_at' : status === 'executed' ? 'executed_at' : ''} = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, id);
  }

  expireOldSignals(): number {
    const stmt = this.database.prepare(`
      UPDATE signals 
      SET status = 'expired'
      WHERE status = 'pending' 
      AND datetime(created_at, '+' || expiry_minutes || ' minutes') < datetime('now')
    `);
    const result = stmt.run();
    return result.changes;
  }
}

export class TradeRepository {
  private database = db.getConnection();

  create(trade: Trade): number {
    const stmt = this.database.prepare(`
      INSERT INTO trades (signal_id, market_id, side, amount, price, quantity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      trade.signal_id,
      trade.market_id,
      trade.side,
      trade.amount,
      trade.price,
      trade.quantity,
      trade.status
    );
    return result.lastInsertRowid as number;
  }

  findBySignalId(signalId: number): Trade | null {
    const stmt = this.database.prepare('SELECT * FROM trades WHERE signal_id = ?');
    const result = stmt.get(signalId);
    return result ? (result as Trade) : null;
  }

  updatePnl(id: number, pnl: number): void {
    const stmt = this.database.prepare(`
      UPDATE trades SET pnl = ?, status = 'settled', settled_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(pnl, id);
  }
}

export class OpportunityRepository {
  private database = db.getConnection();

  create(opportunity: ArbitrageOpportunity): number {
    const stmt = this.database.prepare(`
      INSERT INTO arbitrage_opportunities 
      (market_id, yes_price, no_price, total_price, deviation, deviation_percent, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `);
    const result = stmt.run(
      opportunity.marketId,
      opportunity.yesPrice,
      opportunity.noPrice,
      opportunity.totalPrice,
      opportunity.deviation,
      opportunity.deviationPercent
    );
    return result.lastInsertRowid as number;
  }

  findById(id: number): any {
    const stmt = this.database.prepare('SELECT * FROM arbitrage_opportunities WHERE id = ?');
    return stmt.get(id);
  }
}
