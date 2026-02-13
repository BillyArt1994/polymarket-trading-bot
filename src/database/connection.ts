import Database from 'better-sqlite3';
import { defaultConfig } from '../config';

class DatabaseConnection {
  private db: Database.Database | null = null;

  getConnection(): Database.Database {
    if (!this.db) {
      this.db = new Database(defaultConfig.database.path);
      this.db.pragma('journal_mode = WAL');
    }
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new DatabaseConnection();
