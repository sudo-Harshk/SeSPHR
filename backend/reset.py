import shutil
import os
import sys
from config import Config
from app.services.storage.db import init_db

def reset_system():
    print("⚠️  WARNING: This will WIPE ALL DATA (Files, Keys, Database, Logs).")
    confirmation = input("Are you sure you want to proceed? (yes/no): ")
    
    if confirmation.lower() != "yes":
        print("Operation cancelled.")
        return

    print("\n[1/5] Clearing Cloud Data...")
    if Config.CLOUD_DATA.exists():
        shutil.rmtree(Config.CLOUD_DATA)
        Config.CLOUD_DATA.mkdir(parents=True, exist_ok=True)

    print("[2/5] Clearing Cloud Metadata...")
    if Config.CLOUD_META.exists():
        shutil.rmtree(Config.CLOUD_META)
        Config.CLOUD_META.mkdir(parents=True, exist_ok=True)

    print("[3/5] Clearing Keys...")
    if Config.CLOUD_KEYS_SRS.exists():
        shutil.rmtree(Config.CLOUD_KEYS_SRS)
        Config.CLOUD_KEYS_SRS.mkdir(parents=True, exist_ok=True)
        
    if Config.CLOUD_KEYS_USERS.exists():
        shutil.rmtree(Config.CLOUD_KEYS_USERS)
        Config.CLOUD_KEYS_USERS.mkdir(parents=True, exist_ok=True)

    print("[4/5] Clearing Audit Logs...")
    if Config.AUDIT_LOG_PATH.exists():
        os.remove(Config.AUDIT_LOG_PATH)

    print("[5/5] Re-initializing Database...")
    if Config.DB_PATH.exists():
        os.remove(Config.DB_PATH)
    
    # Initialize fresh DB
    init_db()

    print("\n✅ System Reset Complete.")

if __name__ == "__main__":
    reset_system()
