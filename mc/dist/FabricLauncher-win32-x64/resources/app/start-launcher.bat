@echo off
title Fabric 1.21.1 Minecraft Launcher
echo Starting Fabric 1.21.1 Isolated Launcher...

if not exist "node_modules" (
    echo Installing launcher dependencies...
    npm install
)

start "" "build\FabricLauncher-win32-x64\FabricLauncher.exe"
