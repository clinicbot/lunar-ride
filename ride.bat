@echo off
rem Lunar Ride local launcher
cd /d "%~dp0"
start "" "http://localhost:8123"
python -m http.server 8123
