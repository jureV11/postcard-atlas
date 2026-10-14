@echo off
title Postcard Atlas (Docker)
cd /d "%~dp0"
where docker >nul 2>nul || (
  echo Docker isn't installed. Get Docker Desktop from https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)
echo Building and starting Postcard Atlas in Docker...
echo (The first build takes a few minutes; later starts are quick.)
echo.
docker compose --env-file .env.local up --build -d || (pause & exit /b 1)
echo.
echo Running at http://localhost:3000  - it keeps running in the background,
echo even after you close this window, and restarts when Docker starts.
echo To stop it:  docker compose down
timeout /t 5 >nul
start http://localhost:3000
pause
