@echo off
title LiveCanvas - Multiplayer Cursor & Drawing Board
echo ============================================================
echo Starting LiveCanvas Server...
echo ============================================================
cd /d "%~dp0"
python server.py
pause
