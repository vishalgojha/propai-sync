@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "TAURI_DIR=%%~fI"
set "INTERACTIVE=0"
set "EXTRA_ARGS="

if "%~1"=="" set "INTERACTIVE=1"

pushd "%TAURI_DIR%" >nul
if errorlevel 1 (
  echo [propai-desktop] Failed to enter "%TAURI_DIR%"
  if "%INTERACTIVE%"=="1" pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [propai-desktop] Node.js was not found on PATH.
  echo Install Node.js first, then rerun this script.
  set "EXIT_CODE=1"
  goto :finish
)

if "%INTERACTIVE%"=="1" (
  if not defined LICENSE_ADMIN_KEY if not defined ADMIN_KEY (
    set /p "LICENSE_ADMIN_KEY=Admin key: "
  )

  if not defined LICENSE_ADMIN_KEY if not defined ADMIN_KEY (
    echo [propai-desktop] Missing admin key.
    echo Set LICENSE_ADMIN_KEY or ADMIN_KEY, or enter it when prompted.
    set "EXIT_CODE=1"
    goto :finish
  )

  set /p "PLAN=Plan [pro]: "
  if not defined PLAN set "PLAN=pro"

  set /p "MAX_DEVICES=Max devices [2]: "
  if not defined MAX_DEVICES set "MAX_DEVICES=2"

  set "EXTRA_ARGS=--plan %PLAN% --max-devices %MAX_DEVICES%"
)

node "%SCRIPT_DIR%issue-activation-key.mjs" %EXTRA_ARGS% %*
set "EXIT_CODE=%ERRORLEVEL%"

:finish
popd >nul
if "%INTERACTIVE%"=="1" (
  if "%EXIT_CODE%"=="0" (
    echo.
    echo [propai-desktop] Activation key request finished.
  ) else (
    echo.
    echo [propai-desktop] Activation key request failed.
  )
  pause
)
exit /b %EXIT_CODE%
