#!/usr/bin/env python3
"""
KSIC Database Diagnostic Script
================================

Diagnoses issues with the ksic_codes table and provides solutions.

Usage:
    python scripts/diagnose_ksic_issue.py
"""

import os
import sys
from pathlib import Path
from typing import Dict, List
import logging

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment
try:
    from utils.env_loader import load_env, get_supabase_config
    load_env()
except ImportError:
    print("Warning: utils.env_loader not found, using dotenv")
    from dotenv import load_dotenv
    load_dotenv()

# Disable proxies for Supabase access
for proxy_var in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'GLOBAL_AGENT_HTTP_PROXY']:
    os.environ.pop(proxy_var, None)

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed")
    print("Install: pip install supabase")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KSICDiagnostic:
    """KSIC database diagnostic tool"""

    def __init__(self):
        """Initialize with Supabase client"""
        try:
            from utils.env_loader import get_supabase_config, validate_supabase_config
            validate_supabase_config()
            supabase_url, supabase_key = get_supabase_config(use_service_role=True)
        except:
            supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

        if not supabase_url or not supabase_key:
            print("❌ Supabase environment variables not set")
            print("\nRequired variables:")
            print("  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL")
            print("  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY")
            sys.exit(1)

        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.issues = []
        self.solutions = []

    def check_table_exists(self) -> bool:
        """Check if ksic_codes table exists"""
        logger.info("Checking if ksic_codes table exists...")

        try:
            response = self.supabase.table('ksic_codes').select('*').limit(1).execute()
            logger.info("✓ ksic_codes table exists")
            return True
        except Exception as e:
            error_msg = str(e)
            if 'does not exist' in error_msg.lower() or 'relation' in error_msg.lower():
                logger.error("✗ ksic_codes table does NOT exist")
                self.issues.append("Table 'ksic_codes' does not exist")
                self.solutions.append(
                    "SOLUTION 1: Apply the migration using Supabase SQL Editor:\n"
                    "  1. Go to https://app.supabase.com\n"
                    "  2. Select your project\n"
                    "  3. Click 'SQL Editor' in the sidebar\n"
                    "  4. Copy the contents of supabase/migrations/003_add_ksic_support.sql\n"
                    "  5. Paste and click 'Run'\n"
                    "\nSee KSIC_MIGRATION_GUIDE.md for detailed instructions."
                )
                return False
            else:
                logger.error(f"✗ Error checking table: {e}")
                self.issues.append(f"Error accessing database: {error_msg}")
                return False

    def check_table_schema(self) -> bool:
        """Check if table has required columns"""
        logger.info("Checking table schema...")

        required_columns = {
            'ksic_code': 'TEXT',
            'ksic_name': 'TEXT',
            'description': 'TEXT',
            'top_industry': 'TEXT',
            'major_code': 'TEXT',
            'created_at': 'TIMESTAMP',
            'updated_at': 'TIMESTAMP'
        }

        try:
            response = self.supabase.table('ksic_codes').select('*').limit(1).execute()

            if not response.data:
                logger.warning("⚠ Table is empty (no data to check schema)")
                return True  # Can't verify schema without data, but table exists

            existing_columns = set(response.data[0].keys())

            missing_columns = []
            for col in required_columns.keys():
                if col not in existing_columns:
                    missing_columns.append(col)

            if missing_columns:
                logger.error(f"✗ Missing columns: {', '.join(missing_columns)}")
                self.issues.append(f"Missing required columns: {', '.join(missing_columns)}")
                self.solutions.append(
                    f"SOLUTION 2: Add missing columns:\n"
                    "  Run this SQL in Supabase SQL Editor:\n\n"
                    "  ALTER TABLE public.ksic_codes\n" +
                    "".join([f"    ADD COLUMN IF NOT EXISTS {col} {required_columns[col]},\n"
                            for col in missing_columns]).rstrip(',\n') + ";"
                )
                return False
            else:
                logger.info("✓ All required columns exist")
                return True

        except Exception as e:
            logger.error(f"✗ Error checking schema: {e}")
            self.issues.append(f"Error checking schema: {str(e)}")
            return False

    def check_data_exists(self) -> bool:
        """Check if table has data"""
        logger.info("Checking if table has data...")

        try:
            response = self.supabase.table('ksic_codes').select('ksic_code', count='exact').limit(1).execute()
            count = response.count if hasattr(response, 'count') else len(response.data or [])

            if count == 0:
                logger.warning("⚠ ksic_codes table is empty")
                self.issues.append("ksic_codes table has no data")
                self.solutions.append(
                    "SOLUTION 3: Import KSIC data:\n"
                    "  python scripts/import_ksic_data.py\n"
                    "\nOr use the API:\n"
                    "  curl -X POST http://localhost:8000/api/ksic/import"
                )
                return False
            else:
                logger.info(f"✓ Table has {count} records")
                return True

        except Exception as e:
            logger.error(f"✗ Error checking data: {e}")
            return False

    def check_permissions(self) -> bool:
        """Check if RLS policies are configured correctly"""
        logger.info("Checking permissions...")

        try:
            # Try to read data
            response = self.supabase.table('ksic_codes').select('*').limit(1).execute()

            # Try to write data (upsert with same data)
            if response.data:
                test_data = response.data[0]
                try:
                    self.supabase.table('ksic_codes').upsert(test_data).execute()
                    logger.info("✓ Read and write permissions OK")
                    return True
                except Exception as e:
                    logger.warning(f"⚠ Write permission may be limited: {e}")
                    return True  # Read works, which is what we need
            else:
                logger.info("✓ Read permission OK (table empty)")
                return True

        except Exception as e:
            logger.error(f"✗ Permission error: {e}")
            self.issues.append(f"Permission issue: {str(e)}")
            self.solutions.append(
                "SOLUTION 4: Check RLS policies:\n"
                "  The migration should have created RLS policies.\n"
                "  If not, run the migration again or contact your Supabase admin."
            )
            return False

    def run_diagnostics(self) -> bool:
        """Run all diagnostic checks"""
        print("\n" + "=" * 70)
        print("KSIC Database Diagnostic")
        print("=" * 70)
        print()

        all_passed = True

        # Check 1: Table exists
        if not self.check_table_exists():
            all_passed = False
            # If table doesn't exist, no point checking further
            self.print_results()
            return False

        # Check 2: Schema is correct
        if not self.check_table_schema():
            all_passed = False

        # Check 3: Table has data
        if not self.check_data_exists():
            all_passed = False

        # Check 4: Permissions
        if not self.check_permissions():
            all_passed = False

        self.print_results()
        return all_passed

    def print_results(self):
        """Print diagnostic results and solutions"""
        print()
        print("=" * 70)
        print("Diagnostic Results")
        print("=" * 70)
        print()

        if not self.issues:
            print("✅ All checks passed! Your database is ready.")
            print()
            print("You can now run:")
            print("  python scripts/import_ksic_data.py")
            return

        print(f"Found {len(self.issues)} issue(s):\n")
        for i, issue in enumerate(self.issues, 1):
            print(f"{i}. ❌ {issue}")

        print()
        print("=" * 70)
        print("Recommended Solutions")
        print("=" * 70)
        print()

        for solution in self.solutions:
            print(solution)
            print()

        print("=" * 70)
        print("📖 For detailed instructions, see: KSIC_MIGRATION_GUIDE.md")
        print("=" * 70)


def main():
    """Main function"""
    try:
        diagnostic = KSICDiagnostic()
        success = diagnostic.run_diagnostics()

        if success:
            sys.exit(0)
        else:
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
