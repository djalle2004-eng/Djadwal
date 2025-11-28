@echo off
echo Stopping all node and electron processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2
echo Starting application...
cd /d "C:\Users\Ali\Documents\suivie29092025\suivie"
call npm run electron:dev
