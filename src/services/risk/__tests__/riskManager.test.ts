import { RiskManager } from '../riskManager';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Mock database for testing
const testDbPath = './data/test_trading_bot.db';

describe('RiskManager', () => {
  let riskManager: RiskManager;
  let db: Database.Database;

  beforeAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    
    // Create tables
    db.exec(`
      CREATE TABLE trades (
        id INTEGER PRIMARY KEY,
        pnl REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT
      );
      CREATE TABLE signals (
        id INTEGER PRIMARY KEY,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE risk_logs (
        id INTEGER PRIMARY KEY,
        log_type TEXT,
        message TEXT,
        current_exposure REAL,
        limit_value REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    // Clear tables
    db.exec('DELETE FROM trades');
    db.exec('DELETE FROM signals');
    
    riskManager = new RiskManager(1000, 0.05, 0.20, 3);
  });

  test('should allow trading when within limits', () => {
    const lossCheck = riskManager.checkDailyLossLimit();
    const tradeCheck = riskManager.checkDailyTradeCount();

    expect(lossCheck.allowed).toBe(true);
    expect(tradeCheck.allowed).toBe(true);
  });

  test('should block trading when daily loss limit reached', () => {
    // Insert a large loss
    const stmt = db.prepare('INSERT INTO trades (pnl, created_at, status) VALUES (?, datetime("now"), ?)');
    stmt.run(-60, 'settled');  // 60 loss > 5% of 1000

    const lossCheck = riskManager.checkDailyLossLimit();

    expect(lossCheck.allowed).toBe(false);
    expect(lossCheck.currentLoss).toBeGreaterThanOrEqual(50);
  });

  test('should block trading when daily trade count reached', () => {
    // Insert 3 confirmed signals
    const stmt = db.prepare('INSERT INTO signals (status, created_at) VALUES (?, datetime("now"))');
    stmt.run('confirmed');
    stmt.run('confirmed');
    stmt.run('confirmed');

    const tradeCheck = riskManager.checkDailyTradeCount();

    expect(tradeCheck.allowed).toBe(false);
    expect(tradeCheck.count).toBe(3);
  });

  test('should check single trade limit correctly', () => {
    const check1 = riskManager.checkSingleTradeLimit(150);  // under 200
    const check2 = riskManager.checkSingleTradeLimit(250);  // over 200

    expect(check1.allowed).toBe(true);
    expect(check1.limit).toBe(200);
    expect(check2.allowed).toBe(false);
  });

  test('should provide complete risk summary', () => {
    const summary = riskManager.getRiskSummary();

    expect(summary.dailyLoss).toHaveProperty('current');
    expect(summary.dailyLoss).toHaveProperty('limit');
    expect(summary.dailyLoss).toHaveProperty('allowed');
    expect(summary.tradeCount).toHaveProperty('current');
    expect(summary.tradeCount).toHaveProperty('limit');
    expect(summary.tradeCount).toHaveProperty('allowed');
  });
});
