@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\propai-launch.ps1"
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  echo.
  echo PropAI launcher failed with exit code %exit_code%.
  pause
)
exit /b %exit_code%
