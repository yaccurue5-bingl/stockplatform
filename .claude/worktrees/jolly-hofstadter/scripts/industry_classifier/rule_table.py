"""
KSIC → 상위 업종 매핑 룰 테이블
================================

KSIC 중분류(2자리)를 기준으로 k-marketinsight 서비스의 상위 업종을 정의합니다.

왜 KSIC 중분류를 사용하는가?
- 대분류(1자리): 너무 광범위함 (예: C=제조업 전체)
- 소분류(3자리): 너무 세분화되어 서비스 운영이 복잡함
- 중분류(2자리): 투자자가 이해하기 쉬운 적절한 수준의 업종 구분

예시:
- KSIC 26 = 전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업
  → 서비스 업종: "반도체와 반도체장비"
- KSIC 21 = 의료용 물질 및 의약품 제조업
  → 서비스 업종: "바이오·제약"
"""

# KSIC 소분류(4~5자리) → 상위 업종 매핑 (우선 적용)
# 중분류로는 정확히 분류하기 어려운 케이스를 위한 세부 규칙
KSIC_DETAIL_RULES = {
    # 지주회사 (KSIC 64999 기타금융 내 별도 분리)
    "64992": "지주회사",  # 5자리: 지주회사

    # 신탁업/집합투자 (펀드 등)
    "6420": "투자회사",   # 신탁업 및 집합 투자업
    "64201": "투자회사",  # 신탁업 및 집합 투자업
    "64209": "투자회사",  # 기타 금융 투자업

    # 기타 금융업 중 투자 관련
    "6492": "투자회사",   # 여신 금융업 일부
    "6499": "금융",       # 그 외 기타 금융업 (지주회사 제외)

    # 연구개발업 중 바이오 관련
    "7211": "바이오·제약",  # 자연과학 연구개발업 (바이오 R&D)
    "7212": "바이오·제약",  # 의학 및 약학 연구개발업
}

# KSIC 중분류 → 상위 업종 매핑
# 키: KSIC 중분류 코드(2자리 문자열)
# 값: k-marketinsight 서비스의 상위 업종명
KSIC_TOP_INDUSTRY_RULES = {
    # 제조업 - 전자/반도체
    "26": "반도체와 반도체장비",
    "27": "디스플레이·전자부품",
    "28": "전기장비",

    # 제조업 - 화학/소재
    "20": "화학",
    "21": "바이오·제약",
    "22": "고무·플라스틱",
    "23": "비금속광물",
    "24": "2차전지·소재",
    "25": "금속가공",

    # 제조업 - 기계/운송
    "29": "기계·설비",     # 기타 기계 및 장비 제조업
    "30": "자동차",        # 자동차 및 트레일러 제조업
    "31": "운송장비",      # 기타 운송장비 제조업 (선박, 철도, 항공기 등)
    "32": "가구",
    "33": "기타 제조",
    "34": "산업용 기계수리",

    # 제조업 - 생활소비재
    "10": "식품",
    "11": "음료",
    "12": "담배",
    "13": "섬유",
    "14": "의복·패션",
    "15": "가죽·신발",
    "16": "목재·종이",
    "17": "출판·인쇄",
    "18": "석유·화학제품",
    "19": "1차금속",

    # IT·서비스
    "58": "출판·미디어",
    "59": "영상·방송",
    "60": "통신·방송",
    "61": "통신",
    "62": "IT·소프트웨어",
    "63": "정보서비스",

    # 금융
    "64": "금융",
    "65": "보험·연금",
    "66": "금융지원서비스",

    # 유통·서비스
    "45": "건설",
    "46": "도매",
    "47": "소매",
    "49": "운송",
    "50": "창고·물류",
    "51": "항공",
    "52": "창고·운송",
    "55": "숙박",
    "56": "음식점",

    # 전문서비스
    "70": "부동산",
    "71": "전문·과학·기술서비스",
    "72": "연구개발",
    "73": "광고·시장조사",
    "74": "전문서비스",
    "75": "사업지원서비스",

    # 공공·교육·의료
    "84": "공공행정",
    "85": "교육",
    "86": "보건·의료",
    "87": "사회복지",
    "88": "예술·스포츠·여가",
    "90": "창작·예술",
    "91": "도서관·박물관",

    # 기타
    "01": "농업",
    "02": "임업",
    "03": "어업",
    "05": "석탄·광업",
    "06": "원유·가스",
    "07": "금속광업",
    "08": "비금속광물",
    "09": "광업지원서비스",
    "35": "전기·가스",
    "36": "수도",
    "37": "하수·폐기물",
    "38": "환경·복원",
    "39": "환경정화",
    "41": "건설",
    "42": "토목",
    "43": "전문건설",

    # 부동산/임대
    "68": "부동산",
    "76": "임대업",

    # 기타 서비스
    "92": "기타 오락",
    "94": "협회·단체",
    "95": "수리업",
    "96": "기타 개인서비스",
}


def get_top_industry(ksic_code: str) -> str:
    """
    KSIC 코드로부터 상위 업종을 조회

    Args:
        ksic_code: KSIC 산업분류코드 (예: "26110", "C26110")

    Returns:
        상위 업종명 (예: "반도체와 반도체장비")
        매핑이 없을 경우 "기타"

    Examples:
        >>> get_top_industry("26110")
        '반도체와 반도체장비'
        >>> get_top_industry("C2611")
        '반도체와 반도체장비'
        >>> get_top_industry("21")
        '바이오·제약'
        >>> get_top_industry("64201")
        '지주회사'
    """
    if not ksic_code:
        return "미분류"

    # KSIC 코드에서 숫자만 추출
    numeric_code = ''.join(filter(str.isdigit, str(ksic_code)))

    if len(numeric_code) < 2:
        return "미분류"

    # 1. 세세분류(5자리) 우선 확인 - 지주회사(64992) 등
    if len(numeric_code) >= 5:
        detail_class_5 = numeric_code[:5]
        if detail_class_5 in KSIC_DETAIL_RULES:
            return KSIC_DETAIL_RULES[detail_class_5]

    # 2. 소분류(4자리) 확인 - 투자회사 등
    if len(numeric_code) >= 4:
        detail_class_4 = numeric_code[:4]
        if detail_class_4 in KSIC_DETAIL_RULES:
            return KSIC_DETAIL_RULES[detail_class_4]

    # 3. 중분류(2자리) 확인
    middle_class = numeric_code[:2]

    # 룰 테이블에서 조회
    return KSIC_TOP_INDUSTRY_RULES.get(middle_class, "기타")


def get_all_top_industries() -> list[str]:
    """
    모든 상위 업종 목록 반환 (중복 제거)

    Returns:
        상위 업종명 리스트 (알파벳 순)
    """
    return sorted(set(KSIC_TOP_INDUSTRY_RULES.values()))


def get_ksic_codes_by_industry(industry: str) -> list[str]:
    """
    상위 업종에 해당하는 KSIC 중분류 코드 목록 반환

    Args:
        industry: 상위 업종명 (예: "반도체와 반도체장비")

    Returns:
        KSIC 중분류 코드 리스트 (예: ["26"])
    """
    return [code for code, ind in KSIC_TOP_INDUSTRY_RULES.items() if ind == industry]


def export_rule_table(output_path: str = None):
    """
    룰 테이블을 JSON 파일로 저장

    Args:
        output_path: 출력 파일 경로 (기본값: data/ksic/rule_table.json)
    """
    import json
    from pathlib import Path

    if output_path is None:
        from .config import KSIC_DATA_DIR
        output_path = KSIC_DATA_DIR / "rule_table.json"
    else:
        output_path = Path(output_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(KSIC_TOP_INDUSTRY_RULES, f, ensure_ascii=False, indent=2)

    print(f"✓ 룰 테이블 저장 완료: {output_path}")
    return output_path


if __name__ == "__main__":
    # 테스트 및 확인
    print("=" * 60)
    print("KSIC → 상위 업종 매핑 룰 테이블")
    print("=" * 60)
    print()

    # 통계
    print(f"총 KSIC 중분류 매핑: {len(KSIC_TOP_INDUSTRY_RULES)}개")
    print(f"총 상위 업종: {len(get_all_top_industries())}개")
    print()

    # 상위 업종 목록
    print("📊 상위 업종 목록:")
    for i, industry in enumerate(get_all_top_industries(), 1):
        ksic_codes = get_ksic_codes_by_industry(industry)
        print(f"  {i:2d}. {industry:20s} (KSIC: {', '.join(ksic_codes)})")
    print()

    # 테스트 케이스
    print("🧪 테스트 케이스:")
    test_cases = [
        ("26110", "삼성전자"),
        ("21", "제약회사"),
        ("64", "은행"),
        ("C2611", "반도체 제조사"),
    ]
    for ksic_code, description in test_cases:
        result = get_top_industry(ksic_code)
        print(f"  {ksic_code:10s} ({description:15s}) → {result}")
    print()

    # JSON 파일로 저장
    export_rule_table()
