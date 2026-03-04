# Claude Code 작업 지침

## 브랜치 정책 (필수)

**새 세션을 시작할 때마다 새 브랜치를 생성하지 말 것.**

모든 작업은 단일 브랜치 `claude/dev`에서만 수행한다:

```bash
git checkout claude/dev
git pull origin claude/dev
# 작업 후:
git add .
git commit -m "..."
git push origin claude/dev
```

- `main` 브랜치에는 직접 커밋하지 않는다.
- `claude/dev` 외에 새로운 `claude/*` 브랜치를 생성하지 않는다.
- 세션이 달라도 항상 `claude/dev` 브랜치를 사용한다.
