#!/usr/bin/env python3
"""
Sector Field Validator
======================

업종(sector) 필드의 유효성을 검증하는 유틸리티 함수들
URL이나 잘못된 값이 들어오면 '기타'로 처리
"""

import re
from typing import Optional


def is_url(value: str) -> bool:
    """
    문자열이 URL인지 확인

    Args:
        value: 검사할 문자열

    Returns:
        URL이면 True, 아니면 False

    Examples:
        >>> is_url("http://example.com")
        True
        >>> is_url("https://www.example.com")
        True
        >>> is_url("www.example.com")
        True
        >>> is_url("반도체")
        False
    """
    if not value or not isinstance(value, str):
        return False

    value = value.strip().lower()

    # URL 패턴 체크
    url_patterns = [
        r'^https?://',           # http:// or https://
        r'^www\.',               # www.
        r'\.[a-z]{2,}/',         # .com/ .kr/ etc
        r'://[^\s]+',            # ://domain
    ]

    for pattern in url_patterns:
        if re.search(pattern, value):
            return True

    return False


def sanitize_sector(sector: Optional[str], default: str = '기타') -> str:
    """
    업종 필드를 정제 (URL이면 기본값으로 대체)

    Args:
        sector: 원본 업종 값
        default: URL일 경우 사용할 기본값 (기본: '기타')

    Returns:
        정제된 업종 값

    Examples:
        >>> sanitize_sector("반도체")
        '반도체'
        >>> sanitize_sector("http://example.com")
        '기타'
        >>> sanitize_sector(None)
        '기타'
        >>> sanitize_sector("")
        '기타'
    """
    if not sector or not isinstance(sector, str):
        return default

    sector = sector.strip()

    # 빈 문자열
    if not sector:
        return default

    # URL 체크
    if is_url(sector):
        return default

    # 유효한 업종명
    return sector


def validate_sector_batch(sectors: list[dict]) -> list[dict]:
    """
    여러 업종 데이터를 일괄 검증 및 정제

    Args:
        sectors: 업종 정보가 포함된 딕셔너리 리스트
                 각 딕셔너리는 'sector' 키를 가져야 함

    Returns:
        정제된 업종 정보 리스트

    Examples:
        >>> data = [
        ...     {'code': '005930', 'sector': '반도체'},
        ...     {'code': '000660', 'sector': 'http://example.com'},
        ... ]
        >>> validate_sector_batch(data)
        [
            {'code': '005930', 'sector': '반도체'},
            {'code': '000660', 'sector': '기타'}
        ]
    """
    validated = []

    for item in sectors:
        if 'sector' in item:
            item['sector'] = sanitize_sector(item['sector'])
        validated.append(item)

    return validated


if __name__ == "__main__":
    # 테스트
    print("=" * 60)
    print("Sector Validator 테스트")
    print("=" * 60)

    test_cases = [
        "반도체",
        "바이오·제약",
        "http://example.com",
        "https://www.naver.com",
        "www.google.com",
        "",
        None,
        "IT·소프트웨어",
    ]

    print("\n단일 검증 테스트:")
    for test in test_cases:
        result = sanitize_sector(test)
        is_url_result = is_url(str(test)) if test else False
        print(f"  입력: {test!r:30s} → 출력: {result!r:20s} (URL: {is_url_result})")

    print("\n배치 검증 테스트:")
    batch_data = [
        {'code': '005930', 'name': '삼성전자', 'sector': '반도체'},
        {'code': '000660', 'name': 'SK하이닉스', 'sector': 'http://example.com'},
        {'code': '035420', 'name': 'NAVER', 'sector': 'IT·소프트웨어'},
        {'code': '123456', 'name': '테스트', 'sector': 'www.invalid.com'},
    ]

    validated = validate_sector_batch(batch_data)
    for item in validated:
        print(f"  {item['code']} {item['name']:15s} → {item['sector']}")

    print("\n" + "=" * 60)
