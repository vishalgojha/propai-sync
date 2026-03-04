@echo off
setlocal

cd /d "%~dp0"

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

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist ".env.local" (
  copy /y ".env.example" ".env.local" >nul
  echo Created .env.local from .env.example.
  echo Edit .env.local if you need custom keys or gateway URL.
)

echo Starting PropAI Studio on http://localhost:3000
start "" "http://localhost:3000"
call npm run dev

endlocal
