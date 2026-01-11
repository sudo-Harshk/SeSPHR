import sqlite3
import os

from config import Config

DB_PATH = Config.DB_PATH


def get_connection():
    # Ensure directory exists just in case (e.g. fresh clone/restructure)
    if not DB_PATH.parent.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(DB_PATH))


def init_db():
    # Ensure storage directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = get_connection()
    cur = conn.cursor()

    # Enable foreign keys
    cur.execute("PRAGMA foreign_keys = ON")

    # Users Table (New Schema)
    # user_id: UUID string
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
    )
    """)

    # Attributes Table (Dynamic Attributes)
    # user_id: FK to users.user_id
    cur.execute("""
    CREATE TABLE IF NOT EXISTS attributes (
        user_id TEXT,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, key)
    )
    """)

    conn.commit()
    conn.close()
