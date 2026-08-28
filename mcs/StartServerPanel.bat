@echo off
title Minecraft Server Control Panel
echo ==================================================
echo 🚀 Starting Minecraft Fabric Server Web UI...
echo 🌐 Open in browser: http://localhost:3000
echo ==================================================
cd /d "%~dp0web"
node server.js
pause
