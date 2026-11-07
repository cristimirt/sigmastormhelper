@echo off
rem Builds the dev bundle and serves it on http://127.0.0.1:8765/ (close this window or press Ctrl+C to stop).
rem The browser must have localStorage SSH_dev_base = http://127.0.0.1:8765/ (set once).
cd /d "%~dp0"
echo Building the dev bundle...
call node tools/build.mjs --dev
if errorlevel 1 (
  echo.
  echo The build failed.
  pause
  exit /b 1
)
echo.
echo Serving on http://127.0.0.1:8765/
node tools/serve.mjs
pause
