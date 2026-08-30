@echo off
rem Lunar Ride local launcher
cd /d "%~dp0"
start "" "http://localhost:8123"

rem Prefer the regular python command when it is a real interpreter.
python --version >nul 2>nul
if not errorlevel 1 (
  python -m http.server 8123
  goto :eof
)

rem Windows commonly provides Python through the py launcher instead.
py --version >nul 2>nul
if not errorlevel 1 (
  py -m http.server 8123
  goto :eof
)

echo.
echo Python was not found. Install Python for Windows, then run this file again.
pause
exit /b 1
