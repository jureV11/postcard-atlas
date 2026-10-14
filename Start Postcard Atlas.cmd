@echo off
title Postcard Atlas
cd /d "%~dp0"
echo Starting Postcard Atlas... keep this window open while you use the site.
echo It will be at http://localhost:3000
echo.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
npm.cmd run dev
pause
