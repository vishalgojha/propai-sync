@echo off
setlocal

set "STUDIO_DIR=%~dp0propai-studio"

if not exist "%STUDIO_DIR%\package.json" (
  echo Could not find PropAI Studio at "%STUDIO_DIR%".
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS and run this again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm is not available on PATH. Reinstall Node.js LTS and run this again.
  pause
  exit /b 1
)

pushd "%STUDIO_DIR%"

if not exist "node_modules" (
  echo Installing Studio dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    popd
    pause
    exit /b 1
  )
)

if not exist ".env.local" (
  if exist ".env.example" (
    copy /y ".env.example" ".env.local" >nul
    echo Created .env.local from .env.example.
  )
)

echo Starting PropAI Studio on http://localhost:3000
start "" "http://localhost:3000"
call npm run dev
set "EXIT_CODE=%errorlevel%"

popd
if not "%EXIT_CODE%"=="0" (
  echo.
  echo PropAI Studio exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
