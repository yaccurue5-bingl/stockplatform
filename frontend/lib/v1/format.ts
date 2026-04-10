/**
 * lib/v1/format.ts
 * ================
 * JSON / XML 응답 포맷 유틸리티.
 *
 * 사용 방법 (클라이언트):
 *   - Accept: application/xml  헤더 또는
 *   - ?format=xml  쿼리 파라미터
 * 둘 다 없으면 JSON(기본값) 반환.
 *
 * XML 예시:
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <response>
 *     <total>2</total>
 *     <date_from>2026-04-07</date_from>
 *     <date_to>2026-04-10</date_to>
 *     <data>
 *       <item>
 *         <corp_name>삼성전자</corp_name>
 *         <signal_tag>Bullish</signal_tag>
 *       </item>
 *     </data>
 *   </response>
 */

import { NextRequest, NextResponse } from 'next/server'

/** 요청에서 원하는 포맷(json|xml)을 판별 */
export function getFormat(req: NextRequest): 'json' | 'xml' {
  const param = req.nextUrl.searchParams.get('format')
  if (param === 'xml') return 'xml'

  const accept = req.headers.get('accept') || ''
  if (accept.includes('application/xml') || accept.includes('text/xml')) return 'xml'

  return 'json'
}

/** 임의의 값을 XML 노드 문자열로 직렬화 */
function valueToXml(value: unknown, tag: string): string {
  if (value === null || value === undefined) {
    return `<${tag}/>`
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => valueToXml(item, 'item')).join('')
    return `<${tag}>${items}</${tag}>`
  }

  if (typeof value === 'object') {
    const children = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => valueToXml(v, sanitizeTag(k)))
      .join('')
    return `<${tag}>${children}</${tag}>`
  }

  // primitive — HTML 특수문자 이스케이프
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  return `<${tag}>${escaped}</${tag}>`
}

/** XML 태그 이름에 허용되지 않는 문자 제거 (숫자 시작 → 'f_' 접두어) */
function sanitizeTag(key: string): string {
  const clean = key.replace(/[^a-zA-Z0-9_\-.:]/g, '_')
  return /^[0-9]/.test(clean) ? `f_${clean}` : clean || 'field'
}

/** 데이터 객체를 XML 문자열로 변환 */
export function toXml(data: Record<string, unknown>): string {
  const body = Object.entries(data)
    .map(([k, v]) => valueToXml(v, sanitizeTag(k)))
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<response>${body}</response>`
}

/** 포맷에 맞게 NextResponse 생성 */
export function formatResponse(
  req: NextRequest,
  data: Record<string, unknown>,
  status = 200,
): NextResponse {
  const fmt = getFormat(req)

  if (fmt === 'xml') {
    const xml = toXml(data)
    return new NextResponse(xml, {
      status,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Response-Format': 'xml',
      },
    })
  }

  // 기본: JSON
  return NextResponse.json(data, { status })
}
