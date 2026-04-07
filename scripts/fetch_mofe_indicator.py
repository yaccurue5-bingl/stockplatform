"""
재정경제부 일일경제지표 HWP 자동 수집 → CloudConvert HWP→PDF 변환 → 지표 추출

실행: python scripts/fetch_mofe_indicator.py
      python scripts/fetch_mofe_indicator.py --hwp path/to/file.hwp  (로컬 HWP 직접 처리)
      python scripts/fetch_mofe_indicator.py --dry-run

출처: 기획재정부 (mofe.go.kr)
사용 방침: 원문 재배포 ❌  /  수치 추출 후 지표화 ⭕
"""

import os
import re
import json
import time
import logging
import tempfile
from datetime import datetime, date
from pathlib import Path

import requests
import pdfplumber
from groq import Groq
from dotenv import load_dotenv
from supabase import create_client

# ── 환경변수 ─────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / '.env.local', override=True)
load_dotenv(Path(__file__).parent.parent / 'frontend' / '.env.local', override=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

CLOUDCONVERT_API_KEY = os.environ['CLOUDCONVERT_API_KEY'].strip()
supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY'],
)
groq_client = Groq(api_key=os.environ['GROQ_API_KEY'].strip())

CC_HEADERS = {
    'Authorization': f'Bearer {CLOUDCONVERT_API_KEY}',
    'Content-Type': 'application/json',
}

# 재정경제부 게시판 설정
BASE_URL       = 'https://www.mofe.go.kr'
BOARD_URL      = (
    f'{BASE_URL}/st/ecnmyidx/listTbEconomyIndicatorView.do'
    '?bbsId=MOSFBBS_000000000045&menuNo=6010200'
)
DETAIL_BASE    = f'{BASE_URL}/st/ecnmyidx/detailTbEconomyIndicatorView.do'
BBS_ID         = 'MOSFBBS_000000000045'
LAST_NTT_FILE  = Path(__file__).parent / '.mofe_last_ntt_id'  # 마지막 성공 NttId 저장
INITIAL_NTT_ID = 77362  # 2026-04-03 기준 (업데이트 시 초기값)
SITE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL,
}


# ── CloudConvert: HWP → PDF ───────────────────────────────────────────────────
def cloudconvert_hwp_to_pdf(hwp_path: str) -> str | None:
    """
    CloudConvert API로 HWP 파일을 PDF로 변환.
    반환: 변환된 PDF 임시 파일 경로 (None = 실패)
    소비: 1 크레딧/건
    """
    logger.info(f'CloudConvert 변환 시작: {Path(hwp_path).name}')

    try:
        # Step 1: Job 생성 (upload → convert → export)
        job_payload = {
            'tasks': {
                'upload-hwp': {
                    'operation': 'import/upload',
                },
                'convert-to-pdf': {
                    'operation': 'convert',
                    'input': 'upload-hwp',
                    'input_format': 'hwp',
                    'output_format': 'pdf',
                },
                'export-pdf': {
                    'operation': 'export/url',
                    'input': 'convert-to-pdf',
                },
            }
        }

        r = requests.post(
            'https://api.cloudconvert.com/v2/jobs',
            headers=CC_HEADERS,
            json=job_payload,
            timeout=30,
        )
        r.raise_for_status()
        job = r.json()['data']
        job_id = job['id']

        # upload task URL 추출
        upload_task = next(t for t in job['tasks'] if t['name'] == 'upload-hwp')
        upload_url  = upload_task['result']['form']['url']
        upload_params = upload_task['result']['form']['parameters']

        # Step 2: HWP 파일 업로드
        with open(hwp_path, 'rb') as f:
            files = {**{k: (None, v) for k, v in upload_params.items()}, 'file': f}
            upload_r = requests.post(upload_url, files=files, timeout=60)
            upload_r.raise_for_status()
        logger.info('HWP 업로드 완료')

        # Step 3: 변환 완료 대기 (최대 120초)
        for attempt in range(24):
            time.sleep(5)
            status_r = requests.get(
                f'https://api.cloudconvert.com/v2/jobs/{job_id}',
                headers=CC_HEADERS, timeout=15,
            )
            status_r.raise_for_status()
            status = status_r.json()['data']['status']
            logger.info(f'  변환 상태: {status} ({(attempt+1)*5}s)')

            if status == 'finished':
                break
            elif status == 'error':
                logger.error('CloudConvert 변환 실패')
                return None

        # Step 4: PDF 다운로드 URL 추출
        tasks = status_r.json()['data']['tasks']
        export_task = next((t for t in tasks if t['name'] == 'export-pdf'), None)
        if not export_task or not export_task.get('result', {}).get('files'):
            logger.error('export task 결과 없음')
            return None

        pdf_url = export_task['result']['files'][0]['url']

        # Step 5: PDF 다운로드
        pdf_r = requests.get(pdf_url, timeout=60, stream=True)
        pdf_r.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        for chunk in pdf_r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()

        size_kb = Path(tmp.name).stat().st_size // 1024
        logger.info(f'PDF 변환 완료: {size_kb} KB → {tmp.name}')
        return tmp.name

    except Exception as e:
        logger.error(f'CloudConvert 오류: {e}')
        return None


# ── 재정경제부 사이트에서 최신 HWP 다운로드 ──────────────────────────────────
def _load_last_ntt_id() -> int:
    if LAST_NTT_FILE.exists():
        return int(LAST_NTT_FILE.read_text().strip())
    return INITIAL_NTT_ID


def _save_ntt_id(ntt_num: int):
    LAST_NTT_FILE.write_text(str(ntt_num))


def find_and_download_hwp() -> tuple[str, str] | None:
    """
    재정경제부 일일경제지표 → 최신 HWP 다운로드.
    - 마지막 성공 NttId 기준으로 최대 10개 앞까지 probe
    - 성공한 NttId를 로컬 파일에 저장 (다음 실행 시 이어서)
    - 첨부파일 경로: /com/cmm/fms/FileDown.do?atchFileId=...&fileSn=1
    """
    try:
        session = requests.Session()
        session.headers.update(SITE_HEADERS)
        session.get(BASE_URL, timeout=10)  # 기본 쿠키 획득

        last_ntt = _load_last_ntt_id()
        logger.info(f'마지막 NttId: {last_ntt}, 최신 탐색 시작...')

        found_ntt = None
        atch_id = None
        detail_url = None

        # 마지막 성공 ID부터 최대 +10 probe (최신 찾기)
        for offset in range(11):
            candidate = last_ntt + offset
            ntt_id_str = f'MOSF_{candidate:015d}'
            url = (
                f'{DETAIL_BASE}?bbsId={BBS_ID}'
                f'&searchNttId1={ntt_id_str}&menuNo=6010200'
            )
            r = session.get(url, timeout=10)
            if len(r.text) < 5000:
                continue  # 빈 페이지 = 해당 ID 없음

            atch_match = re.search(r'atchFileId=(ATCH_\w+)', r.text)
            if atch_match:
                found_ntt = candidate
                atch_id = atch_match.group(1)
                detail_url = url
                logger.info(f'게시물 발견: MOSF_{candidate:015d} | {atch_id}')
                # 더 최신이 있는지 계속 탐색
            else:
                break  # ID가 없으면 더 이상 없음

        if not found_ntt:
            # 주말/공휴일/미게시 = 정상 케이스. 에러 아님
            logger.info('신규 게시물 없음 (주말·공휴일·미게시 정상) — 마지막 저장 데이터 유지')
            return None

        # 최신 NttId 저장 (초회 실행 포함: 상태파일 없으면 무조건 저장)
        if not LAST_NTT_FILE.exists() or found_ntt > last_ntt:
            _save_ntt_id(found_ntt)
            logger.info(f'NttId 저장: {found_ntt}')

        # 상세 페이지 Referer 설정 후 HWP 다운로드
        session.headers.update({'Referer': detail_url})
        hwp_url = f'{BASE_URL}/com/cmm/fms/FileDown.do?atchFileId={atch_id}&fileSn=1'
        logger.info(f'HWP 다운로드: {hwp_url}')

        r = session.get(hwp_url, timeout=30, stream=True)
        r.raise_for_status()

        content_disp = r.headers.get('Content-Disposition', '')
        fname_match = re.search(r'filename=(.+)', content_disp)
        filename = fname_match.group(1).strip() if fname_match else 'indicator.hwp'

        tmp = tempfile.NamedTemporaryFile(suffix='.hwp', delete=False)
        for chunk in r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()

        size_kb = Path(tmp.name).stat().st_size // 1024
        if size_kb < 10:
            logger.error(f'다운로드 파일이 너무 작음 ({size_kb} KB) → 인증 실패 가능성')
            Path(tmp.name).unlink(missing_ok=True)
            return None

        logger.info(f'HWP 다운로드 완료: {size_kb} KB ({filename})')
        return tmp.name, filename

    except Exception as e:
        logger.error(f'HWP 탐색/다운로드 실패: {e}')
        return None


# ── Groq: PDF에서 지표 추출 ───────────────────────────────────────────────────
INDICATOR_SYSTEM_PROMPT = """You are a STRICT financial data extraction engine for Korean government documents.

CRITICAL RULES:
1. DO NOT infer or estimate — only extract values explicitly printed in the text
2. DO NOT create numbers that are not present
3. If data is not explicitly present, return null
4. 전일비 = day-over-day change — extract ONLY the explicitly printed value (positive or negative)
5. 날짜(date): extract the reference date shown in the document in YYYY-MM-DD format

UNIT RULES for 외국인 순매수 (foreign net buying):
- Values in 억원: return as-is (e.g., "8,419억" → 8419)
- Values in 조원: convert to 억원 by multiplying by 10000 (e.g., "1.2조" → 12000)
- Expected range after conversion: 100 ~ 30000. If your value is below 100, recheck the unit.
- Positive = 순매수 (net buy), Negative = 순매도 (net sell)

Return JSON with EXACTLY this structure (no extra fields):
{
  "date": "YYYY-MM-DD",
  "kospi_close": <exact closing index value>,
  "kospi_change_pct": <exact 전일비 % — positive or negative float>,
  "kosdaq_close": <exact closing index value>,
  "kosdaq_change_pct": <exact 전일비 % — positive or negative float>,
  "foreign_net_buy_kospi": <억원 value after unit conversion — see rules above>,
  "foreign_net_buy_kosdaq": <억원 value after unit conversion>,
  "usd_krw": <exact USD/KRW exchange rate>,
  "treasury_yield_3y": <exact 3-year treasury yield %>,
  "wti_oil": <exact WTI crude oil price in USD>
}"""


# ── 숫자 검증 ─────────────────────────────────────────────────────────────────
def validate_indicators(data: dict) -> dict | None:
    """비정상 값 검증 및 단위 보정. 통과하면 data 반환, 실패하면 None."""
    errors = []

    kospi_pct = data.get('kospi_change_pct')
    if kospi_pct is not None and abs(kospi_pct) > 15:
        errors.append(f'kospi_change_pct 비정상: {kospi_pct}% (±15% 초과)')

    kosdaq_pct = data.get('kosdaq_change_pct')
    if kosdaq_pct is not None and abs(kosdaq_pct) > 20:
        errors.append(f'kosdaq_change_pct 비정상: {kosdaq_pct}% (±20% 초과)')

    kospi_close = data.get('kospi_close')
    if kospi_close is not None and not (1000 < kospi_close < 20000):
        errors.append(f'kospi_close 범위 이상: {kospi_close}')

    usd_krw = data.get('usd_krw')
    if usd_krw is not None and not (900 < usd_krw < 2500):
        errors.append(f'usd_krw 범위 이상: {usd_krw}')

    # 외국인 순매수 단위 보정
    # - abs(val) < 1      → 조원 단위 (0.84조 등) → ×10000
    # - 1 ≤ abs(val) < 100 → 조원 단위 가능성 높음 (8.3조 등) → ×10000 + 경고
    # - abs(val) >= 100   → 억원 단위로 간주 (정상)
    for key in ('foreign_net_buy_kospi', 'foreign_net_buy_kosdaq'):
        val = data.get(key)
        if val is None:
            continue
        if abs(val) < 100:
            original = val
            data[key] = round(val * 10000, 0)
            logger.warning(
                f'{key} 단위 보정: {original} → {data[key]} 억원 '
                f'(원값이 100 미만 → 조원 단위로 추정, ×10000 적용)'
            )

    if errors:
        logger.warning(f'검증 실패: {errors}')
        return None

    return data


def extract_indicators(pdf_path: str) -> dict | None:
    """PDF에서 경제지표 추출 (Groq)"""
    try:
        full_text = ''
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ''
                full_text += text + '\n'

        if not full_text.strip():
            logger.error('PDF 텍스트 추출 실패')
            return None

        logger.info(f'PDF 텍스트 추출: {len(full_text)}자')

        response = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[
                {'role': 'system', 'content': INDICATOR_SYSTEM_PROMPT},
                {'role': 'user', 'content': f'TEXT:\n{full_text[:4000]}'},
            ],
            temperature=0.1,
            max_completion_tokens=400,
            response_format={'type': 'json_object'},
        )
        result = json.loads(response.choices[0].message.content)

        validated = validate_indicators(result)
        if validated is None:
            logger.error('지표 검증 실패 → 저장 안 함')
            return None

        return validated

    except Exception as e:
        logger.error(f'지표 추출 실패: {e}')
        return None


def save_indicators(data: dict) -> bool:
    """추출된 지표 → Supabase daily_indicators 저장"""
    try:
        report_date = data.get('date') or date.today().isoformat()
        supabase.table('daily_indicators').upsert({
            'date':                    report_date,
            'kospi_close':             data.get('kospi_close'),
            'kospi_change_pct':        data.get('kospi_change_pct'),
            'kosdaq_close':            data.get('kosdaq_close'),
            'kosdaq_change_pct':       data.get('kosdaq_change_pct'),
            'foreign_net_buy_kospi':   data.get('foreign_net_buy_kospi'),
            'foreign_net_buy_kosdaq':  data.get('foreign_net_buy_kosdaq'),
            'usd_krw':                 data.get('usd_krw'),
            'treasury_yield_3y':       data.get('treasury_yield_3y'),
            # treasury_yield_10y: 기재부 일일경제지표에 포함되지 않으므로 수집 제외
            'wti_oil':                 data.get('wti_oil'),
            'source':                  '기획재정부_일일경제지표',
            'updated_at':              datetime.now().isoformat(),
        }, on_conflict='date').execute()
        logger.info(f'지표 저장 완료: {report_date}')
        return True
    except Exception as e:
        logger.error(f'지표 저장 실패: {e}')
        return False


# ── 메인 실행 ─────────────────────────────────────────────────────────────────
def run(local_hwp: str | None = None, dry_run: bool = False):
    logger.info('=== 재정경제부 일일경제지표 파이프라인 시작 ===')

    # 크레딧 확인
    credit_r = requests.get('https://api.cloudconvert.com/v2/users/me', headers=CC_HEADERS, timeout=10)
    credits = credit_r.json().get('data', {}).get('credits', 0)
    logger.info(f'CloudConvert 잔여 크레딧: {credits}')
    if credits < 1:
        logger.error('크레딧 부족. 충전 필요.')
        return

    hwp_path = None
    cleanup_files = []

    try:
        if local_hwp:
            hwp_path = local_hwp
            logger.info(f'로컬 HWP 사용: {hwp_path}')
        else:
            result = find_and_download_hwp()
            if result:
                hwp_path, _ = result
                cleanup_files.append(hwp_path)
            else:
                # 신규 데이터 없음 = 주말·공휴일·미게시 정상 케이스
                # DB에는 이미 마지막 수집 데이터가 유지되므로 별도 처리 불필요
                logger.info('신규 HWP 없음 — DB의 마지막 데이터 유지. 파이프라인 정상 종료.')
                return

        if not hwp_path:
            logger.error('HWP 파일 없음')
            return

        # HWP → PDF 변환 (CloudConvert, 1 크레딧 소비)
        pdf_path = cloudconvert_hwp_to_pdf(hwp_path)
        if not pdf_path:
            return
        cleanup_files.append(pdf_path)

        # 지표 추출
        indicators = extract_indicators(pdf_path)
        if not indicators:
            return

        logger.info('추출된 지표:')
        logger.info(f"  KOSPI:            {indicators.get('kospi_close')} ({indicators.get('kospi_change_pct')}%)")
        logger.info(f"  KOSDAQ:           {indicators.get('kosdaq_close')} ({indicators.get('kosdaq_change_pct')}%)")
        logger.info(f"  외국인 순매수 KOSPI:  {indicators.get('foreign_net_buy_kospi')} 억원")
        logger.info(f"  외국인 순매수 KOSDAQ: {indicators.get('foreign_net_buy_kosdaq')} 억원")
        logger.info(f"  USD/KRW:          {indicators.get('usd_krw')}")
        logger.info(f"  WTI 유가:          {indicators.get('wti_oil')}")

        if dry_run:
            logger.info('[DRY-RUN] DB 저장 건너뜀')
            return

        save_indicators(indicators)
        logger.info('=== 완료 ===')

    finally:
        for f in cleanup_files:
            try:
                Path(f).unlink()
            except Exception:
                pass


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='재정경제부 일일경제지표 수집')
    parser.add_argument('--hwp',     type=str, default=None, help='로컬 HWP 파일 경로')
    parser.add_argument('--dry-run', action='store_true',    help='DB 저장 없이 결과만 출력')
    args = parser.parse_args()
    run(local_hwp=args.hwp, dry_run=args.dry_run)
