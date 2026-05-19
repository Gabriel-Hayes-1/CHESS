import Database from "better-sqlite3";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    email TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    player_w TEXT REFERENCES users(id),
    player_b TEXT REFERENCES users(id),
    result TEXT NOT NULL,
    winner TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id),
    move_number INTEGER NOT NULL,
    color TEXT NOT NULL,
    from_sq INTEGER NOT NULL,
    to_sq INTEGER NOT NULL,
    promotion TEXT,
    castle TEXT,
    en_passant INTEGER,
    clock_after REAL NOT NULL,
    played_at INTEGER NOT NULL
  );

`)

export default db;