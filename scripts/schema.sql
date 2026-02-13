-- 市场信息表
CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    question TEXT NOT NULL,
    category TEXT,
    created_at DATETIME,
    resolution_time DATETIME,
    resolved BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 价格快照表
CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    yes_price REAL NOT NULL,
    no_price REAL NOT NULL,
    yes_liquidity REAL,
    no_liquidity REAL,
    volume_24h REAL,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- 套利机会表
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT NOT NULL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    yes_price REAL NOT NULL,
    no_price REAL NOT NULL,
    total_price REAL NOT NULL,
    deviation REAL NOT NULL,
    deviation_percent REAL NOT NULL,
    status TEXT DEFAULT 'open',
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- 交易信号表
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT NOT NULL,
    opportunity_id INTEGER,
    signal_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    reason TEXT,
    trigger_price REAL,
    suggested_amount REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    executed_at DATETIME,
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (opportunity_id) REFERENCES arbitrage_opportunities(id)
);

-- 交易执行记录表
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER,
    market_id TEXT NOT NULL,
    side TEXT NOT NULL,
    amount REAL NOT NULL,
    price REAL NOT NULL,
    quantity REAL NOT NULL,
    gas_fee REAL,
    tx_hash TEXT,
    pnl REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settled_at DATETIME,
    FOREIGN KEY (signal_id) REFERENCES signals(id),
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- 风控日志表
CREATE TABLE IF NOT EXISTS risk_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    current_exposure REAL,
    limit_value REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_price_snapshots_market_time ON price_snapshots(market_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON arbitrage_opportunities(status);
