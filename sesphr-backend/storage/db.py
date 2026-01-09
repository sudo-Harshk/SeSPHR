import sqlite3
import os

DB_PATH = "storage/sesphr.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


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
