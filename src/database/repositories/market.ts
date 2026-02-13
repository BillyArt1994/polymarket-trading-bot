import { db } from '../connection';
import { Market } from '../../types';

export class MarketRepository {
  private database = db.getConnection();

  create(market: Market): void {
    const stmt = this.database.prepare(`
      INSERT OR REPLACE INTO markets (id, slug, question, category, created_at, resolution_time, resolved, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      market.id,
      market.slug,
      market.question,
      market.category,
      market.created_at?.toISOString(),
      market.resolution_time?.toISOString(),
      market.resolved ? 1 : 0,
      market.active ? 1 : 0
    );
  }

  findActive(): Market[] {
    const stmt = this.database.prepare('SELECT * FROM markets WHERE active = 1 AND resolved = 0');
    return stmt.all() as Market[];
  }

  findById(id: string): Market | null {
    const stmt = this.database.prepare('SELECT * FROM markets WHERE id = ?');
    const result = stmt.get(id);
    return result ? (result as Market) : null;
  }
}
