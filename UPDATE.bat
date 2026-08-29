@echo off
setlocal
cd /d "%~dp0"

echo Updating Lunar Ride test branch...
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo Git is not installed or is not in PATH.
  echo Install Git for Windows, then run this file again.
  pause
  exit /b 1
)

git pull --ff-only origin fixes-build-90
if errorlevel 1 (
  echo.
  echo Update could not be completed automatically.
  echo Your local files may contain changes, or the branch may have moved.
  echo Nothing was overwritten.
  pause
  exit /b 1
)

echo.
echo Lunar Ride is up to date.
pause
