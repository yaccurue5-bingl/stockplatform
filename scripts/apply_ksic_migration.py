#!/usr/bin/env python3
"""
KSIC Column Rename Migration 적용 스크립트
==========================================

ksic_codes 테이블의 한글 컬럼명을 영문으로 변경하는 마이그레이션을 적용합니다.

사용법:
    python scripts/apply_ksic_migration.py
    python scripts/apply_ksic_migration.py --dry-run  # 테스트만 (실제 적용 안함)
"""

import os
import sys
import logging
import argparse
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 환경변수 로드
try:
    from utils.env_loader import load_env
    load_env()
except ImportError:
    print("Warning: utils.env_loader not found")
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

# Supabase 접근을 위해 프록시 비활성화
for proxy_var in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'GLOBAL_AGENT_HTTP_PROXY']:
    os.environ.pop(proxy_var, None)

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed")
    print("Install: pip install supabase")
    sys.exit(1)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_current_schema(supabase: Client) -> dict:
    """현재 테이블 스키마 확인"""
    logger.info("현재 테이블 스키마 확인 중...")

    try:
        # 테이블에서 데이터 1개만 조회하여 컬럼명 확인
        response = supabase.table('ksic_codes').select('*').limit(1).execute()

        if response.data and len(response.data) > 0:
            columns = list(response.data[0].keys())
            logger.info(f"현재 컬럼: {columns}")

            # 한글 컬럼명 확인
            has_korean_cols = any(col in ['산업코드', '산업내용', '상위업종'] for col in columns)
            has_english_cols = any(col in ['ksic_code', 'ksic_name', 'top_industry'] for col in columns)

            return {
                'columns': columns,
                'has_korean': has_korean_cols,
                'has_english': has_english_cols
            }
        else:
            logger.warning("테이블이 비어있습니다.")
            return {
                'columns': [],
                'has_korean': False,
                'has_english': False
            }

    except Exception as e:
        logger.error(f"스키마 확인 중 오류: {e}")
        return None


def apply_migration(supabase: Client, dry_run: bool = False) -> bool:
    """마이그레이션 적용"""

    # 마이그레이션 파일 읽기
    migration_file = PROJECT_ROOT / 'supabase' / 'migrations' / '004_rename_ksic_columns_to_english.sql'

    if not migration_file.exists():
        logger.error(f"마이그레이션 파일을 찾을 수 없습니다: {migration_file}")
        return False

    logger.info(f"마이그레이션 파일 읽기: {migration_file}")

    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
    except Exception as e:
        logger.error(f"마이그레이션 파일 읽기 실패: {e}")
        return False

    if dry_run:
        logger.info("=" * 70)
        logger.info("DRY-RUN 모드: 실제 적용하지 않습니다")
        logger.info("=" * 70)
        logger.info("\n실행할 SQL 미리보기:")
        logger.info("-" * 70)
        print(migration_sql[:1000] + "\n... (생략)")
        logger.info("-" * 70)
        return True

    # 실제 마이그레이션 적용
    logger.info("=" * 70)
    logger.info("마이그레이션 적용 중...")
    logger.info("=" * 70)

    try:
        # PostgreSQL에서는 여러 문장을 한 번에 실행할 수 없으므로
        # 각 DO 블록을 분리하여 실행

        # SQL을 세미콜론으로 분리 (DO $$ ... END $$; 블록 고려)
        statements = []
        current_statement = []
        in_do_block = False

        for line in migration_sql.split('\n'):
            line_stripped = line.strip()

            # 주석 제거
            if line_stripped.startswith('--'):
                continue

            # DO 블록 시작
            if 'DO $$' in line:
                in_do_block = True

            # DO 블록 종료
            if 'END $$;' in line:
                current_statement.append(line)
                statements.append('\n'.join(current_statement))
                current_statement = []
                in_do_block = False
                continue

            # 일반 문장
            if line_stripped:
                current_statement.append(line)

            # 세미콜론으로 문장 종료 (DO 블록이 아닐 때만)
            if not in_do_block and line_stripped.endswith(';'):
                statements.append('\n'.join(current_statement))
                current_statement = []

        # 남은 문장 추가
        if current_statement:
            statements.append('\n'.join(current_statement))

        # 각 문장 실행
        logger.info(f"총 {len(statements)}개 SQL 문장 실행...")

        executed_count = 0
        for i, stmt in enumerate(statements, 1):
            stmt_clean = stmt.strip()
            if not stmt_clean or stmt_clean.startswith('--'):
                continue

            try:
                logger.debug(f"[{i}/{len(statements)}] 실행 중...")
                # Supabase Python 클라이언트로는 직접 SQL 실행이 제한적이므로
                # 사용자에게 Supabase Dashboard에서 실행하도록 안내
                executed_count += 1
            except Exception as e:
                logger.warning(f"문장 실행 경고 (계속 진행): {e}")

        logger.info(f"✓ {executed_count}개 문장 처리 완료")

        # 참고: Supabase Python SDK는 일반 SQL 실행을 지원하지 않으므로
        # 마이그레이션은 Supabase Dashboard에서 수동으로 실행해야 합니다
        logger.warning("")
        logger.warning("=" * 70)
        logger.warning("⚠️  중요: Supabase Python SDK로는 DDL 문을 직접 실행할 수 없습니다.")
        logger.warning("=" * 70)
        logger.warning("다음 방법 중 하나를 사용하여 마이그레이션을 적용하세요:")
        logger.warning("")
        logger.warning("1. Supabase Dashboard에서 적용 (권장):")
        logger.warning("   - https://app.supabase.com 접속")
        logger.warning("   - 프로젝트 선택")
        logger.warning("   - SQL Editor 메뉴 클릭")
        logger.warning(f"   - {migration_file} 파일 내용 복사")
        logger.warning("   - SQL Editor에 붙여넣고 Run 클릭")
        logger.warning("")
        logger.warning("2. Supabase CLI 사용:")
        logger.warning("   supabase db push")
        logger.warning("")
        logger.warning("=" * 70)

        return False  # SDK로는 실행 불가능하므로 False 반환

    except Exception as e:
        logger.error(f"마이그레이션 적용 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return False


def verify_migration(supabase: Client) -> bool:
    """마이그레이션 적용 확인"""
    logger.info("마이그레이션 적용 확인 중...")

    schema = check_current_schema(supabase)

    if not schema:
        logger.error("스키마 확인 실패")
        return False

    if schema['has_english'] and not schema['has_korean']:
        logger.info("✓ 마이그레이션이 성공적으로 적용되었습니다!")
        logger.info("  - 영문 컬럼명 사용 확인")
        return True
    elif schema['has_korean']:
        logger.warning("⚠️  한글 컬럼명이 여전히 존재합니다.")
        logger.warning("  마이그레이션을 수동으로 적용해야 합니다.")
        return False
    else:
        logger.warning("⚠️  테이블이 비어있거나 확인할 수 없습니다.")
        return False


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description='KSIC Column Rename Migration 적용',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='테스트만 실행 (실제 적용 안함)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='상세 로깅'
    )

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    print("\n" + "=" * 70)
    print("KSIC Column Rename Migration")
    print("=" * 70)
    print()

    # 환경변수 확인
    try:
        from utils.env_loader import get_supabase_config, validate_supabase_config
        validate_supabase_config()
        supabase_url, supabase_key = get_supabase_config(use_service_role=True)
    except Exception as e:
        logger.error(f"환경변수 확인 실패: {e}")
        logger.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 .env.local에 설정하세요.")
        sys.exit(1)

    # Supabase 클라이언트 생성
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Supabase 클라이언트 초기화 완료")
    except Exception as e:
        logger.error(f"Supabase 연결 실패: {e}")
        sys.exit(1)

    # 1. 현재 스키마 확인
    schema = check_current_schema(supabase)
    if not schema:
        logger.error("스키마 확인 실패")
        sys.exit(1)

    print()
    logger.info("현재 상태:")
    logger.info(f"  - 한글 컬럼명 존재: {'예' if schema['has_korean'] else '아니오'}")
    logger.info(f"  - 영문 컬럼명 존재: {'예' if schema['has_english'] else '아니오'}")
    print()

    # 2. 마이그레이션 필요 여부 확인
    if schema['has_english'] and not schema['has_korean']:
        logger.info("✓ 이미 영문 컬럼명을 사용하고 있습니다. 마이그레이션 불필요.")
        sys.exit(0)

    if not schema['has_korean']:
        logger.warning("⚠️  한글 컬럼명이 없습니다. 테이블 구조를 확인하세요.")
        logger.info(f"현재 컬럼: {schema['columns']}")
        sys.exit(0)

    # 3. 마이그레이션 적용 (dry-run 또는 실제)
    logger.info("마이그레이션이 필요합니다.")

    if args.dry_run:
        apply_migration(supabase, dry_run=True)
        sys.exit(0)

    # 사용자 확인
    print()
    response = input("⚠️  마이그레이션을 적용하시겠습니까? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        logger.info("사용자에 의해 취소되었습니다.")
        sys.exit(0)

    print()
    success = apply_migration(supabase, dry_run=False)

    if success:
        # 4. 검증
        print()
        verify_migration(supabase)
        sys.exit(0)
    else:
        logger.error("마이그레이션 적용에 실패했습니다.")
        logger.info("수동으로 마이그레이션을 적용하세요. 자세한 내용은 docs/KSIC_COLUMN_RENAME_GUIDE.md 참조")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자에 의해 중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
