@echo off
setlocal

set "DEFAULT_API_URL=http://localhost:8787"
set "ADMIN_KEY_VALUE="
set "JWT_SECRET_VALUE="
set "API_URL_VALUE="

echo [propai-desktop] Configure licensing environment
echo.
echo This saves user-level environment variables for:
echo   ADMIN_KEY
echo   LICENSE_ADMIN_KEY
echo   LICENSE_JWT_SECRET
echo   LICENSE_API_URL
echo.

set /p "ADMIN_KEY_VALUE=Admin key: "
if not defined ADMIN_KEY_VALUE (
  echo [propai-desktop] Admin key is required.
  pause
  exit /b 1
)

set /p "JWT_SECRET_VALUE=JWT secret [leave blank to auto-generate]: "
if not defined JWT_SECRET_VALUE (
  for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -Command "[Convert]::ToBase64String((1..48 ^| ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"`) do (
    set "JWT_SECRET_VALUE=%%I"
  )
)

set /p "API_URL_VALUE=License API URL [%DEFAULT_API_URL%]: "
if not defined API_URL_VALUE (
  set "API_URL_VALUE=%DEFAULT_API_URL%"
)

setx ADMIN_KEY "%ADMIN_KEY_VALUE%" >nul
if errorlevel 1 goto :setx_failed

setx LICENSE_ADMIN_KEY "%ADMIN_KEY_VALUE%" >nul
if errorlevel 1 goto :setx_failed

setx LICENSE_JWT_SECRET "%JWT_SECRET_VALUE%" >nul
if errorlevel 1 goto :setx_failed

setx LICENSE_API_URL "%API_URL_VALUE%" >nul
if errorlevel 1 goto :setx_failed

echo.
echo [propai-desktop] Saved user environment variables successfully.
echo.
echo Open a new PowerShell or CMD window, then run:
echo   cd C:\Users\visha\propai-sync
echo   pnpm --dir services/licensing dev
echo.
echo To issue an activation key in that new terminal:
echo   cd C:\Users\visha\propai-sync
echo   apps\tauri\scripts\issue-activation-key.bat
echo.
pause
exit /b 0

:setx_failed
echo.
echo [propai-desktop] Failed to save one or more environment variables.
echo Try running this script from a normal Windows terminal instead of WSL.
echo.
pause
exit /b 1
