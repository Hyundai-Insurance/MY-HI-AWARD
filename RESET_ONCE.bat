@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [MY HI-AWARD] 기존 자동생성 데이터 정리 중...
if exist "data\planners" rmdir /s /q "data\planners"
if exist "data\meta.json" del /q "data\meta.json"
echo.
echo 완료되었습니다.
echo GitHub Desktop으로 돌아가 변경사항을 Commit 후 Push 하세요.
echo 이후에는 이 파일을 다시 실행할 필요가 없습니다.
pause
