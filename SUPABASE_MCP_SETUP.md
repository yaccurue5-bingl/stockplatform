# Supabase MCP 연결 설정 가이드

## 개요

이 프로젝트는 Model Context Protocol(MCP)을 통해 Claude Code와 Supabase를 연결합니다. 이를 통해 Claude가 Supabase 프로젝트에 직접 접근하여 테이블 관리, 스키마 수정, 데이터 쿼리 등의 작업을 수행할 수 있습니다.

## 설정 완료 내역

### 1. MCP 설정 파일 생성

프로젝트 루트에 `.mcp.json` 파일이 생성되었습니다:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_URL": "https://rxcwqsolfrjhomeusyza.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "[서비스 롤 키]"
      }
    }
  }
}
```

### 2. 환경 변수 설정

Supabase 연결 정보는 `.env.local` 파일에서 관리됩니다:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: 서비스 롤 키 (관리자 권한)

## MCP 활성화 방법

### Claude Code 재시작

MCP 서버를 활성화하려면 Claude Code 세션을 재시작해야 합니다:

1. 현재 Claude Code 세션 종료
2. 새로운 세션 시작
3. Claude가 자동으로 `.mcp.json` 설정을 로드합니다

### 연결 확인

Claude Code가 재시작되면 다음과 같이 요청하여 연결을 확인할 수 있습니다:

```
Supabase에 연결되었나요? 사용 가능한 도구를 보여주세요.
```

## Supabase MCP로 할 수 있는 작업

MCP를 통해 Claude가 수행할 수 있는 작업:

### 1. 테이블 관리
- 테이블 생성, 수정, 삭제
- 컬럼 추가, 삭제, 타입 변경
- 인덱스 생성 및 관리

### 2. 데이터 쿼리
- SELECT 쿼리 실행
- 복잡한 JOIN 연산
- 집계 함수 사용

### 3. 데이터 조작
- INSERT, UPDATE, DELETE 작업
- 대량 데이터 처리
- 트랜잭션 관리

### 4. 스키마 관리
- 스키마 검색 및 확인
- 관계(Foreign Key) 설정
- RLS(Row Level Security) 정책 관리

### 5. 마이그레이션
- 스키마 변경 추적
- 마이그레이션 파일 생성
- 롤백 지원

## 사용 예시

### 테이블 조회
```
companies 테이블의 스키마를 보여주세요.
```

### 데이터 조회
```
KOSPI 시장의 종목 중 시가총액 상위 10개 종목을 조회해주세요.
```

### 테이블 생성
```
분석 결과를 저장할 analysis_results 테이블을 생성해주세요.
필요한 컬럼: id, stock_code, analysis_date, result_data (jsonb)
```

### 스키마 수정
```
companies 테이블에 last_updated timestamp 컬럼을 추가해주세요.
```

## 보안 고려사항

### 서비스 롤 키 사용
- MCP 연결은 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다
- 이 키는 RLS를 우회하는 관리자 권한을 가집니다
- **절대 Git에 커밋하지 마세요** (`.env.local`은 `.gitignore`에 포함됨)

### 권한 관리
- 프로덕션 환경에서는 제한된 권한의 키 사용을 권장합니다
- 필요한 작업에 대해서만 최소 권한을 부여하세요

## 대안: Postgres MCP 직접 연결

데이터베이스 제어에 집중하고 싶다면 Postgres MCP를 사용할 수도 있습니다:

```bash
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
```

## 트러블슈팅

### MCP 서버가 로드되지 않음
1. `.mcp.json` 파일이 프로젝트 루트에 있는지 확인
2. Claude Code를 완전히 재시작
3. `claude mcp list` 명령어로 등록된 서버 확인

### 연결 오류
1. `.env.local`의 Supabase 연결 정보 확인
2. 서비스 롤 키가 올바른지 확인
3. Supabase 프로젝트가 활성 상태인지 확인

### 권한 오류
1. 서비스 롤 키를 사용하고 있는지 확인
2. Supabase 대시보드에서 API 키 재확인

## 참고 자료

- [Supabase MCP Server](https://github.com/supabase/mcp-server-supabase)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.claude.ai/claude-code)

## 다음 단계

MCP가 활성화되면:
1. 기존 데이터베이스 스키마 확인
2. 필요한 테이블 및 인덱스 최적화
3. RLS 정책 검토 및 개선
4. 데이터 마이그레이션 계획 수립
