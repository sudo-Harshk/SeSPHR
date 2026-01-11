import argparse
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.services.storage.users import (
    create_user,
    add_attribute,
    remove_attribute,
    # load_users # Note: load_users wasn't in users.py I saw earlier using get_all_users_with_attributes?
    # Checking users.py in Step 214: it has get_all_users_with_attributes but NOT load_users.
    # So CLI is broken regardless of path if load_users is missing.
    get_all_users_with_attributes
)
from app.services.storage.phr import store_phr
from app.services.storage.access import access_phr


def main():
    parser = argparse.ArgumentParser(description="SeSPHR CLI (SQLite)")

    sub = parser.add_subparsers(dest="command")

    cu = sub.add_parser("create_user")
    cu.add_argument("--id", required=True)

    aa = sub.add_parser("add_attr")
    aa.add_argument("--id", required=True)
    aa.add_argument("--key", required=True)
    aa.add_argument("--value", required=True)

    ra = sub.add_parser("remove_attr")
    ra.add_argument("--id", required=True)
    ra.add_argument("--key", required=True)

    lu = sub.add_parser("list_users")

    up = sub.add_parser("upload_phr")
    up.add_argument("--owner", required=True)
    up.add_argument("--file", required=True)
    up.add_argument("--policy", required=True)

    ap = sub.add_parser("access_phr")
    ap.add_argument("--user", required=True)
    ap.add_argument("--file", required=True)
    ap.add_argument("--out", required=True)

    args = parser.parse_args()

    if args.command == "create_user":
        create_user(args.id)
        print("User created")

    elif args.command == "add_attr":
        add_attribute(args.id, args.key, args.value)
        print("Attribute added")

    elif args.command == "remove_attr":
        remove_attribute(args.id, args.key)
        print("Attribute removed")

    elif args.command == "list_users":
        users = get_all_users_with_attributes()
        for u in users.values():
            print(u)

    elif args.command == "upload_phr":
        enc = store_phr(args.owner, args.file, args.policy)
        print(f"Encrypted PHR stored as {enc}")

    elif args.command == "access_phr":
        access_phr(args.user, args.file, args.out)
        print("Access granted and file decrypted")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
