@echo off
chcp 65001 >nul
echo ========================================
echo Git Merge Conflict 자동 해결 스크립트
echo ========================================
echo.

cd /d C:\stockplatform

echo [1/6] 현재 상태 확인 중...
git status
echo.

echo [2/6] Merge 중단하고 초기화...
git merge --abort 2>nul
echo.

echo [3/6] 로컬 변경사항 임시 저장 (stash)...
git stash push -m "Local auth fixes backup"
echo.

echo [4/6] 원격 브랜치에서 최신 코드 가져오기...
git fetch origin claude/setup-project-build-ICsxg
git reset --hard origin/claude/setup-project-build-ICsxg
echo.

echo [5/6] 저장했던 로컬 변경사항 다시 적용...
git stash pop
echo.

echo [6/6] 충돌 파일 확인...
git status
echo.

echo ========================================
echo 완료!
echo.
echo 만약 충돌이 남아있다면:
echo 1. VS Code에서 충돌 파일 열기
echo 2. "Accept Current Change" (로컬 버전 유지) 선택
echo 3. git add . 실행
echo 4. git commit -m "Resolve conflicts"
echo ========================================
pause
