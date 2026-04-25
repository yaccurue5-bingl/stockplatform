"""
fetch_financial_bulk.py
========================
DART 재무제표 일괄 다운로드 → financials 테이블 upsert

【다운로드 방법】
  1. https://opendart.fss.or.kr/disclosureinfo/fnltt/dwld/main.do 접속
  2. 연도 탭 선택 (예: 2025)
  3. "사업보고서" 항목에서:
     - [연결 재무상태표] ZIP 다운로드 → --bs-zip 경로 지정
     - [연결 손익계산서] ZIP 다운로드 → --is-zip 경로 지정
     ※ 연결 없는 기업은 개별 재무제표 자동 사용

【사용법】
  python scripts/fetch_financial_bulk.py --bs-zip ~/dart_bs_2025.zip --is-zip ~/dart_is_2025.zip --year 2025
  python scripts/fetch_financial_bulk.py --bs-zip ./data/bs.zip --is-zip ./data/is.zip --year 2025 --dry-run

【파일 구조 (ZIP 내부 TXT, 탭 구분)】
  rcept_no | bsns_year | corp_code | sj_div | account_id | account_nm |
  thstrm_amount | thstrm_add_amount | frmtrm_amount | ...

【수집 항목】
  손익계산서: 매출액, 영업이익, 당기순이익
  재무상태표: 자산총계, 부채총계, 자본총계
"""

import os
import sys
import io
import zipfile
import argparse
import logging
import time
from pathlib import Path

import chardet
import pandas as pd
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── 환경변수 ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH_SIZE   = 100

# ── IFRS 표준 계정 코드 매핑 ──────────────────────────────────────────────────
# 키: account_id (IFRS), 값: financials 컬럼명
IFRS_IS_ACCOUNTS = {
    # 매출액
    "ifrs-full_Revenue":                              "revenue",
    "dart_Revenue":                                   "revenue",
    "ifrs-full_GrossProfit":                          None,  # 참고용, 저장 안함
    # 영업이익
    "dart_OperatingIncomeLoss":                       "op_profit",
    "ifrs-full_OperatingIncomeLoss":                  "op_profit",
    "ifrs-full_ProfitLossFromOperatingActivities":    "op_profit",
    # 당기순이익 (지배주주)
    "ifrs-full_ProfitLossAttributableToOwnersOfParent": "net_profit",
    "ifrs-full_ProfitForThePeriod":                   "net_profit",
    "ifrs-full_ProfitLoss":                           "net_profit",
}

IFRS_BS_ACCOUNTS = {
    # 자산총계
    "ifrs-full_Assets":                               "total_assets",
    # 부채총계
    "ifrs-full_Liabilities":                          "total_liabilities",
    # 자본총계
    "ifrs-full_Equity":                               "total_equity",
    "ifrs-full_EquityAttributableToOwnersOfParent":   "total_equity",
}

# K-GAAP (account_id 미표준) — account_nm 기반 매핑
KGAAP_IS_NM = {
    "매출액": "revenue",
    "수익(매출액)": "revenue",
    "영업수익": "revenue",
    "영업이익": "op_profit",
    "영업이익(손실)": "op_profit",
    "당기순이익": "net_profit",
    "당기순이익(손실)": "net_profit",
}
KGAAP_BS_NM = {
    "자산총계": "total_assets",
    "부채총계": "total_liabilities",
    "자본총계": "total_equity",
}

KGAAP_MARKER = "-표준계정코드 미사용-"

# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _detect_encoding(raw: bytes) -> str:
    result = chardet.detect(raw[:50000])
    enc = result.get("encoding") or "utf-8"
    return enc if enc.lower() not in ("ascii",) else "utf-8"


def _read_zip_txt(zip_path: str) -> pd.DataFrame | None:
    """ZIP 안의 TXT 파일을 DataFrame으로 읽기 (탭 구분)"""
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            txts = [n for n in z.namelist() if n.lower().endswith(".txt")]
            if not txts:
                logger.error(f"ZIP 안에 TXT 파일 없음: {zip_path}")
                return None
            logger.info(f"  TXT 파일: {txts}")
            frames = []
            for txt in txts:
                raw = z.read(txt)
                enc = _detect_encoding(raw)
                logger.info(f"  인코딩 감지: {txt} → {enc}")
                try:
                    df = pd.read_csv(io.BytesIO(raw), sep="\t", encoding=enc,
                                     dtype=str, on_bad_lines="skip", low_memory=False)
                    frames.append(df)
                except Exception as e:
                    logger.warning(f"  읽기 실패 ({txt}): {e}")
            return pd.concat(frames, ignore_index=True) if frames else None
    except Exception as e:
        logger.error(f"ZIP 열기 실패: {e}")
        return None


def _parse_amount(val) -> int | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return int(str(val).replace(",", "").replace(" ", ""))
    except (ValueError, TypeError):
        return None


def _extract_accounts(df: pd.DataFrame, account_map_id: dict, account_map_nm: dict) -> dict[str, dict]:
    """
    corp_code → {column_name: amount} 추출

    우선순위: IFRS account_id → K-GAAP account_nm
    당기(thstrm) 기준. 회사별 첫 번째 매칭만 저장.
    """
    result: dict[str, dict] = {}

    # 컬럼 정규화
    df.columns = [c.strip().lower() for c in df.columns]
    if "corp_code" not in df.columns:
        logger.error("corp_code 컬럼 없음 — 파일 구조 확인 필요")
        return result

    for _, row in df.iterrows():
        corp_code  = str(row.get("corp_code", "")).strip().zfill(8)
        account_id = str(row.get("account_id", "")).strip()
        account_nm = str(row.get("account_nm", "")).strip()
        amount_raw = row.get("thstrm_amount") or row.get("thstrm_add_amount")
        amount = _parse_amount(amount_raw)

        if not corp_code or amount is None:
            continue

        if corp_code not in result:
            result[corp_code] = {}

        # IFRS account_id 우선
        col = account_map_id.get(account_id)
        if col and col not in result[corp_code]:
            result[corp_code][col] = amount
            continue

        # K-GAAP account_nm fallback
        if account_id == KGAAP_MARKER or not account_id:
            col = account_map_nm.get(account_nm)
            if col and col not in result[corp_code]:
                result[corp_code][col] = amount

    return result


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DART 재무제표 일괄 다운로드 → Supabase financials upsert")
    parser.add_argument("--bs-zip",  required=True, help="재무상태표 ZIP 경로")
    parser.add_argument("--is-zip",  required=True, help="손익계산서 ZIP 경로")
    parser.add_argument("--year",    type=int, required=True, help="사업연도 (예: 2025)")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 파싱만 확인")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ SUPABASE 환경변수 누락")
        sys.exit(1)

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── corp_code → stock_code 매핑 로드 ─────────────────────────────────────
    logger.info("📋 dart_corp_codes 로드 중...")
    corp_map_raw = sb.table("dart_corp_codes").select("corp_code, stock_code").execute().data or []
    corp_to_stock: dict[str, str] = {}
    for r in corp_map_raw:
        cc = str(r.get("corp_code", "")).strip().zfill(8)
        sc = str(r.get("stock_code", "")).strip()
        if cc and sc:
            corp_to_stock[cc] = sc
    logger.info(f"  매핑 종목 수: {len(corp_to_stock)}")

    # ── ZIP 읽기 ──────────────────────────────────────────────────────────────
    logger.info(f"📥 BS ZIP 읽기: {args.bs_zip}")
    bs_df = _read_zip_txt(args.bs_zip)
    logger.info(f"📥 IS ZIP 읽기: {args.is_zip}")
    is_df = _read_zip_txt(args.is_zip)

    if bs_df is None and is_df is None:
        logger.error("❌ 파일 읽기 실패")
        sys.exit(1)

    # ── 계정 추출 ──────────────────────────────────────────────────────────────
    bs_data: dict[str, dict] = {}
    if bs_df is not None:
        logger.info("🔍 재무상태표 계정 추출 중...")
        bs_data = _extract_accounts(bs_df, IFRS_BS_ACCOUNTS, KGAAP_BS_NM)
        logger.info(f"  BS 추출 종목 수: {len(bs_data)}")

    is_data: dict[str, dict] = {}
    if is_df is not None:
        logger.info("🔍 손익계산서 계정 추출 중...")
        is_data = _extract_accounts(is_df, IFRS_IS_ACCOUNTS, KGAAP_IS_NM)
        logger.info(f"  IS 추출 종목 수: {len(is_data)}")

    # ── 병합 & 변환 ──────────────────────────────────────────────────────────
    all_corp_codes = set(bs_data) | set(is_data)
    rows_to_upsert = []
    skipped = 0

    for corp_code in all_corp_codes:
        stock_code = corp_to_stock.get(corp_code)
        if not stock_code:
            skipped += 1
            continue

        bs = bs_data.get(corp_code, {})
        is_ = is_data.get(corp_code, {})

        row = {
            "stock_code":          stock_code,
            "fiscal_year":         args.year,
            "revenue":             is_.get("revenue"),
            "op_profit":           is_.get("op_profit"),
            "net_profit":          is_.get("net_profit"),
            "total_assets":        bs.get("total_assets"),
            "total_liabilities":   bs.get("total_liabilities"),
            "total_equity":        bs.get("total_equity"),
            "is_financial_sector": False,  # compute_f_score.py가 별도 처리
        }

        # 최소한 하나라도 있어야 저장
        has_data = any(v is not None for k, v in row.items() if k not in ("stock_code", "fiscal_year", "is_financial_sector"))
        if not has_data:
            skipped += 1
            continue

        rows_to_upsert.append(row)

    logger.info(f"✅ upsert 대상: {len(rows_to_upsert)}건  (매핑 실패: {skipped}건)")

    if args.dry_run:
        logger.info("🔍 dry-run 모드 — DB 저장 생략")
        for r in rows_to_upsert[:5]:
            logger.info(f"  {r}")
        return

    # ── Supabase upsert ───────────────────────────────────────────────────────
    for i in range(0, len(rows_to_upsert), BATCH_SIZE):
        batch = rows_to_upsert[i: i + BATCH_SIZE]
        sb.table("financials").upsert(batch, on_conflict="stock_code,fiscal_year").execute()
        logger.info(f"  [{i + len(batch)}/{len(rows_to_upsert)}] 저장 완료")
        time.sleep(0.1)

    logger.info(f"\n[DONE] {len(rows_to_upsert)}개 종목 upsert 완료 → compute_f_score.py 실행 필요")


if __name__ == "__main__":
    main()
