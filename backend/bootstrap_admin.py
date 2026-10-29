"""
ResourceX Initial Admin Bootstrap Utility
Run this script from the workspace to create the first an Administrator account.
Example:
    python -m backend.bootstrap_admin --email admin@pcu.edu.in --name "System Admin"
"""
import argparse
import getpass
import sys
from backend.app.config import settings
from backend.app.firebase import init_firebase, get_firestore_client
from backend.app.services.user_service import UserService


def main():
    parser = argparse.ArgumentParser(description="Bootstrap the first a ResourceX Admin account.")
    parser.add_argument("--email", default="admin@pcu.edu.in", help="Admin email address (@pcu.edu.in)")
    parser.add_argument("--name", default="System Administrator", help="Admin display name")
    args = parser.parse_args()

    init_firebase()
    print(f"[*] Bootstrapping Admin account for {args.email}...")

    try:
        user = UserService.bootstrap_admin(
            bootstrap_key=settings.ADMIN_BOOTSTRAP_KEY,
            email=args.email,
            name=args.name,
            password=getpass.getpass("Initial admin password: ")
        )
        print(f"[+] Success! Admin account provisioned: UID={user.uid}, Email={user.email}, Role={user.role.value}")
    except Exception as e:
        print(f"[-] Error bootstrapping admin: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
