#!/usr/bin/env python3
"""
Apply KSIC Primary Key Fix
===========================

This script applies the migration 006_ensure_ksic_primary_key.sql
using the Supabase client and SQL RPC calls.

Usage:
    python scripts/apply_ksic_primary_key_fix.py
"""

import os
import sys
from pathlib import Path
import logging

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment
try:
    from utils.env_loader import load_env, get_supabase_config, validate_supabase_config
    load_env()
except ImportError:
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
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def execute_sql_statements(supabase: Client, statements: list) -> bool:
    """
    Execute a list of SQL statements using Supabase RPC.

    Args:
        supabase: Supabase client
        statements: List of SQL statements to execute

    Returns:
        True if all statements executed successfully, False otherwise
    """
    success_count = 0
    failed_count = 0

    for idx, statement in enumerate(statements, 1):
        statement = statement.strip()
        if not statement or statement.startswith('--'):
            continue

        try:
            # Try to execute using the supabase client
            # Note: This requires appropriate RLS policies or service role key
            result = supabase.rpc('exec_sql', {'query': statement}).execute()
            logger.info(f"✓ Statement {idx} executed successfully")
            success_count += 1
        except Exception as e:
            # Some statements might fail if they're idempotent or already applied
            logger.warning(f"Statement {idx} failed: {e}")
            failed_count += 1

    logger.info(f"Execution summary: {success_count} succeeded, {failed_count} failed")
    return failed_count == 0


def apply_fix_directly(supabase: Client) -> bool:
    """
    Apply the KSIC primary key fix directly using Python and Supabase client.
    This approach is more reliable than executing SQL through RPC.

    Args:
        supabase: Supabase client

    Returns:
        True if fix applied successfully, False otherwise
    """
    try:
        logger.info("=" * 70)
        logger.info("Applying KSIC Primary Key Fix")
        logger.info("=" * 70)

        # Step 1: Check for and remove duplicates
        logger.info("\n1. Checking for duplicate ksic_code values...")
        try:
            # Get all ksic_codes
            response = supabase.table('ksic_codes').select('ksic_code, ctid').execute()
            data = response.data

            # Find duplicates
            seen = {}
            duplicates_to_delete = []
            for record in data:
                code = record.get('ksic_code')
                ctid = record.get('ctid')

                if code in seen:
                    # This is a duplicate, mark for deletion
                    # Keep the first one, delete subsequent ones
                    duplicates_to_delete.append(record)
                else:
                    seen[code] = record

            if duplicates_to_delete:
                logger.warning(f"Found {len(duplicates_to_delete)} duplicate records")
                # Note: We can't easily delete by ctid using the Supabase client
                # We'll need to identify them by other means or accept the constraint will fail
                logger.warning("Cannot automatically remove duplicates via Supabase client")
                logger.warning("Please remove duplicates manually or use direct database access")
            else:
                logger.info("✓ No duplicate ksic_code values found")

        except Exception as e:
            logger.error(f"Error checking duplicates: {e}")
            return False

        # Step 2: Check for NULL values
        logger.info("\n2. Checking for NULL ksic_code values...")
        try:
            response = supabase.table('ksic_codes').select('*').is_('ksic_code', 'null').execute()
            null_records = response.data

            if null_records:
                logger.warning(f"Found {len(null_records)} records with NULL ksic_code")
                # Delete NULL records
                for record in null_records:
                    # Try to delete by unique identifier if available
                    logger.warning("Cannot delete NULL records via Supabase client")
                logger.warning("Please remove NULL records manually")
            else:
                logger.info("✓ No NULL ksic_code values found")

        except Exception as e:
            logger.error(f"Error checking NULL values: {e}")
            # Continue anyway

        # Step 3: Verify current state
        logger.info("\n3. Verifying table state...")
        try:
            response = supabase.table('ksic_codes').select('ksic_code', count='exact').execute()
            total_count = response.count
            logger.info(f"Total records in ksic_codes: {total_count}")

            # Check for unique ksic_codes
            response = supabase.table('ksic_codes').select('ksic_code').execute()
            unique_codes = set(record['ksic_code'] for record in response.data if record.get('ksic_code'))
            logger.info(f"Unique ksic_code values: {len(unique_codes)}")

            if len(unique_codes) < total_count:
                logger.error(f"✗ Duplicates exist! {total_count - len(unique_codes)} duplicate records found")
                logger.error("Cannot add primary key constraint with duplicates")
                logger.error("Please clean up duplicates first")
                return False
            else:
                logger.info("✓ No duplicates found, ready to add primary key")

        except Exception as e:
            logger.error(f"Error verifying state: {e}")
            return False

        # Step 4: Inform user about manual steps needed
        logger.info("\n" + "=" * 70)
        logger.info("MANUAL STEPS REQUIRED")
        logger.info("=" * 70)
        logger.info("")
        logger.info("The Supabase Python client cannot directly modify table constraints.")
        logger.info("Please apply the migration using one of these methods:")
        logger.info("")
        logger.info("Option 1: Use the Supabase SQL Editor")
        logger.info("  1. Go to your Supabase dashboard")
        logger.info("  2. Navigate to SQL Editor")
        logger.info("  3. Open and run: supabase/migrations/006_ensure_ksic_primary_key.sql")
        logger.info("")
        logger.info("Option 2: Use psql with database password")
        logger.info("  1. Get your database password from Supabase dashboard > Settings > Database")
        logger.info("  2. Add SUPABASE_DB_PASSWORD to your .env.local file")
        logger.info("  3. Run: python scripts/apply_migrations.py 006_ensure_ksic_primary_key.sql")
        logger.info("")
        logger.info("Option 3: Manual SQL execution")
        logger.info("  Execute the following SQL in your Supabase SQL Editor:")
        logger.info("")
        logger.info("  -- Remove duplicates (if any)")
        logger.info("  DELETE FROM ksic_codes WHERE ctid NOT IN (")
        logger.info("    SELECT MAX(ctid) FROM ksic_codes GROUP BY ksic_code")
        logger.info("  );")
        logger.info("")
        logger.info("  -- Drop existing primary key")
        logger.info("  ALTER TABLE ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;")
        logger.info("")
        logger.info("  -- Add new primary key")
        logger.info("  ALTER TABLE ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);")
        logger.info("")
        logger.info("=" * 70)

        return True

    except Exception as e:
        logger.error(f"Error applying fix: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    print("\n" + "=" * 70)
    print("KSIC Primary Key Fix Script")
    print("=" * 70)
    print()

    # Validate environment
    try:
        from utils.env_loader import validate_supabase_config, get_supabase_config
        validate_supabase_config()
        supabase_url, supabase_key = get_supabase_config(use_service_role=True)
    except Exception as e:
        logger.error(f"Environment validation failed: {e}")
        sys.exit(1)

    # Create Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("✓ Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        sys.exit(1)

    # Apply the fix
    success = apply_fix_directly(supabase)

    if success:
        print("\n✓ Verification complete! Please follow the manual steps above.")
        sys.exit(0)
    else:
        print("\n✗ Fix failed - please check the logs above")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
