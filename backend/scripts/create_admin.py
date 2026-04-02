#!/usr/bin/env python3
"""
Create an SeSPHR admin user (not available via public signup).

Usage (from the backend directory):
    python scripts/create_admin.py --email admin@example.com --password yourSecurePassword
    python scripts/create_admin.py --email admin@example.com --password yourSecurePassword --name "Site Admin"

Then log in through the web app with that email and password to use the admin dashboard.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Resolve backend/ as import root (parent of scripts/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.crypto.keys import generate_user_keys  # noqa: E402
from app.services.storage.db import init_db  # noqa: E402
from app.services.storage.users import create_admin_user, get_user_by_email  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an admin account for SeSPHR (CLI provisioning only)."
    )
    parser.add_argument("--email", required=True, help="Email used to log in")
    parser.add_argument("--password", required=True, help="Password for this admin")
    parser.add_argument("--name", default=None, help="Optional display name")
    args = parser.parse_args()

    init_db()

    if get_user_by_email(args.email):
        print(f"Error: email already registered: {args.email}", file=sys.stderr)
        sys.exit(1)

    try:
        user_id = create_admin_user(args.email, args.password, args.name)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        generate_user_keys(user_id)
    except Exception as e:
        print(f"Warning: admin created but RSA key generation failed: {e}", file=sys.stderr)

    print(f"Admin created successfully.")
    print(f"  Email:    {args.email}")
    print(f"  user_id:  {user_id}")
    print("Log in at the web app with this email and password to open the admin dashboard.")


if __name__ == "__main__":
    main()
