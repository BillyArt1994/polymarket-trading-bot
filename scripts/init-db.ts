import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'trading_bot.db');
const db = new Database(dbPath);

console.log(`Initializing database at: ${dbPath}`);

// 读取并执行 schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

// 分割多个 SQL 语句并执行
const statements = schema.split(';').filter(s => s.trim());
for (const statement of statements) {
  if (statement.trim()) {
    db.exec(statement + ';');
  }
}

console.log('Database initialized successfully!');
console.log('Tables created:');

// 列出创建的表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach((table: any) => {
  console.log(`  - ${table.name}`);
});

db.close();
