---
name: terminal-runner
description: Execute terminal commands, run Python scripts, build executables with PyInstaller, install packages, and manage workspace processes.
---

# Terminal Runner Skill for Ollama Agent

This skill equips Ollama Agent with full terminal execution capabilities.

## Execution Rules for Ollama Agent

1. When the user asks to run, execute, test, build, or compile code, you MUST use the `run_terminal_command` tool.
2. NEVER claim you cannot run terminal commands. You have full system permission.
3. For PyInstaller builds:
   - If running from workspace root: `python -m PyInstaller --onefile bouncy_3d_creator/main.py`
   - If running from inside `bouncy_3d_creator`: `python -m PyInstaller --onefile main.py`
