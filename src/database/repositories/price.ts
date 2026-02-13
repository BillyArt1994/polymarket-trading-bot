import { db } from '../connection';
import { PriceSnapshot } from '../../types';

export class PriceRepository {
  private database = db.getConnection();

  create(snapshot: PriceSnapshot): void {
    const stmt = this.database.prepare(`
      INSERT INTO price_snapshots (market_id, timestamp, yes_price, no_price, yes_liquidity, no_liquidity, volume_24h)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.market_id,
      snapshot.yes_price,
      snapshot.no_price,
      snapshot.yes_liquidity,
      snapshot.no_liquidity,
      snapshot.volume_24h
    );
  }

  findLatestByMarket(marketId: string, limit: number = 100): PriceSnapshot[] {
    const stmt = this.database.prepare(`
      SELECT * FROM price_snapshots 
      WHERE market_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(marketId, limit) as PriceSnapshot[];
  }

  findByTimeRange(marketId: string, startTime: Date, endTime: Date): PriceSnapshot[] {
    const stmt = this.database.prepare(`
      SELECT * FROM price_snapshots 
      WHERE market_id = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(marketId, startTime.toISOString(), endTime.toISOString()) as PriceSnapshot[];
  }
}
