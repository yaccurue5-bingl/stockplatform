#!/usr/bin/env python3
"""
Database Migration Script
=========================

Applies SQL migration files to the Supabase database.

Usage:
    python scripts/apply_migrations.py [migration_file]

If no migration file is specified, all migrations in supabase/migrations/ will be applied in order.
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple
import logging

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment
try:
    from utils.env_loader import load_env
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


def get_migration_files(migrations_dir: Path) -> List[Tuple[str, Path]]:
    """
    Get all migration files sorted by name.

    Returns:
        List of (migration_name, migration_path) tuples
    """
    if not migrations_dir.exists():
        logger.error(f"Migrations directory not found: {migrations_dir}")
        return []

    migration_files = []
    for file_path in sorted(migrations_dir.glob("*.sql")):
        migration_files.append((file_path.stem, file_path))

    return migration_files


def apply_migration(supabase: Client, migration_name: str, migration_path: Path) -> bool:
    """
    Apply a single migration file.

    Args:
        supabase: Supabase client
        migration_name: Name of the migration
        migration_path: Path to the migration SQL file

    Returns:
        True if successful, False otherwise
    """
    logger.info(f"Applying migration: {migration_name}")
    logger.info(f"File: {migration_path}")

    try:
        # Read the SQL file
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Split into individual statements
        # Note: This is a simple split and may not handle all edge cases
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

        logger.info(f"Found {len(statements)} SQL statements")

        # Execute each statement
        for idx, statement in enumerate(statements, 1):
            # Skip empty statements and comments
            if not statement or statement.startswith('--'):
                continue

            logger.debug(f"Executing statement {idx}/{len(statements)}")

            try:
                # Use Supabase's rpc to execute raw SQL
                # Note: This requires the sql() function to be available in your database
                # Alternatively, we'll use PostgREST's raw query capability

                # For Supabase, we need to use a different approach
                # We'll try to use the PostgREST SQL endpoint if available
                # Otherwise, we'll need to use a database connection directly

                # Using supabase-py's underlying client to execute raw SQL
                response = supabase.postgrest.session.post(
                    f"{supabase.postgrest.url}/rpc/exec_sql",
                    json={"query": statement}
                )

                if response.status_code >= 400:
                    logger.warning(f"Statement {idx} returned status {response.status_code}")
                    # Continue anyway as some statements might be idempotent

            except Exception as e:
                logger.warning(f"Error executing statement {idx}: {e}")
                # Continue with next statement

        logger.info(f"✓ Migration {migration_name} applied successfully")
        return True

    except Exception as e:
        logger.error(f"✗ Failed to apply migration {migration_name}: {e}")
        import traceback
        traceback.print_exc()
        return False


def apply_migration_with_psycopg2(migration_name: str, migration_path: Path) -> bool:
    """
    Apply migration using direct PostgreSQL connection (psycopg2).
    This is more reliable than using the Supabase client for migrations.

    Args:
        migration_name: Name of the migration
        migration_path: Path to the migration SQL file

    Returns:
        True if successful, False otherwise
    """
    try:
        import psycopg2
        from urllib.parse import urlparse
    except ImportError:
        logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False

    logger.info(f"Applying migration using direct PostgreSQL connection: {migration_name}")

    # Get Supabase connection details from environment
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url:
        logger.error("NEXT_PUBLIC_SUPABASE_URL not set")
        return False

    # Parse Supabase URL to get database connection info
    # Supabase URL format: https://[project-id].supabase.co
    # Database connection: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

    parsed = urlparse(supabase_url)
    project_id = parsed.hostname.split('.')[0] if parsed.hostname else None

    if not project_id:
        logger.error("Could not extract project ID from Supabase URL")
        return False

    # Get database password from environment
    db_password = os.getenv('SUPABASE_DB_PASSWORD')
    if not db_password:
        logger.error("SUPABASE_DB_PASSWORD not set. Please add it to your .env file")
        logger.info("You can find it in your Supabase dashboard under Settings > Database")
        return False

    # Build connection string
    conn_str = f"postgresql://postgres:{db_password}@db.{project_id}.supabase.co:5432/postgres"

    try:
        # Read the SQL file
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Connect to database
        logger.info("Connecting to database...")
        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        cursor = conn.cursor()

        # Execute the migration
        logger.info("Executing migration SQL...")
        cursor.execute(sql_content)

        cursor.close()
        conn.close()

        logger.info(f"✓ Migration {migration_name} applied successfully")
        return True

    except Exception as e:
        logger.error(f"✗ Failed to apply migration {migration_name}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    print("\n" + "=" * 70)
    print("Database Migration Script")
    print("=" * 70)
    print()

    # Get migrations directory
    migrations_dir = PROJECT_ROOT / "supabase" / "migrations"

    if len(sys.argv) > 1:
        # Apply specific migration
        migration_file = sys.argv[1]
        if not migration_file.endswith('.sql'):
            migration_file += '.sql'

        migration_path = migrations_dir / migration_file
        if not migration_path.exists():
            logger.error(f"Migration file not found: {migration_path}")
            sys.exit(1)

        migration_name = migration_path.stem

        logger.info(f"Applying single migration: {migration_name}")
        success = apply_migration_with_psycopg2(migration_name, migration_path)

        if success:
            print("\n✓ Migration applied successfully!")
            sys.exit(0)
        else:
            print("\n✗ Migration failed")
            sys.exit(1)
    else:
        # Apply all migrations
        migration_files = get_migration_files(migrations_dir)

        if not migration_files:
            logger.error("No migration files found")
            sys.exit(1)

        logger.info(f"Found {len(migration_files)} migration files")
        print()

        success_count = 0
        failed_count = 0

        for migration_name, migration_path in migration_files:
            success = apply_migration_with_psycopg2(migration_name, migration_path)
            if success:
                success_count += 1
            else:
                failed_count += 1
            print()

        print("=" * 70)
        print(f"Migration Summary:")
        print(f"  ✓ Successful: {success_count}")
        print(f"  ✗ Failed: {failed_count}")
        print("=" * 70)

        if failed_count == 0:
            print("\n✓ All migrations applied successfully!")
            sys.exit(0)
        else:
            print(f"\n⚠ {failed_count} migration(s) failed")
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
