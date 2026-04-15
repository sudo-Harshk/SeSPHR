"""
Demo reset script — clears all uploaded files and audit log.
User accounts and RSA keys are preserved.

Run from the backend/ directory:
  python reset_demo.py
"""

import sys
import os
import shutil
sys.path.insert(0, os.path.dirname(__file__))

from config import Config

def reset():
    cleared = 0

    # Clear encrypted files
    for path in [Config.CLOUD_DATA, Config.CLOUD_META]:
        if path.exists():
            for f in path.iterdir():
                f.unlink()
                cleared += 1
            print(f"  Cleared  {path}")

    # Clear audit log
    if Config.AUDIT_LOG_PATH.exists():
        Config.AUDIT_LOG_PATH.unlink()
        print(f"  Cleared  {Config.AUDIT_LOG_PATH}")

    print(f"\nDone. Removed {cleared} files. User accounts and keys are untouched.")
    print("You can now log in as patient1 and patient2 and upload fresh demo files.")

if __name__ == "__main__":
    confirm = input("This will delete all uploaded PHR files and audit logs. Continue? [y/N] ").strip().lower()
    if confirm == "y":
        reset()
    else:
        print("Aborted.")
