---
name: terminal-runner
description: Execute terminal commands, run Python scripts, build executables with PyInstaller, install packages, and manage workspace processes.
---

# Terminal Runner Skill

This skill provides terminal execution capabilities for building, compiling, and running software in the workspace.

## Capabilities

1. **Python Script Execution**:
   - Run Python scripts directly: `python <path/to/script.py>`
   - Run modules: `python -m <module_name> <args>`

2. **PyInstaller Compilation**:
   - Package standalone Windows executables (`.exe`):
     ```powershell
     python -m PyInstaller --onefile <path/to/main.py>
     ```
   - On Windows, if `pyinstaller` is not found directly on PATH, always invoke via `python -m PyInstaller`.
   - Ensure the path is relative to the current working directory. For example, if inside `bouncy_3d_creator`, run `pyinstaller --onefile main.py`. If in the workspace root, run `python -m PyInstaller --onefile bouncy_3d_creator/main.py`.

3. **Package Installation**:
   - Install packages with pip: `pip install <package_name>`
   - Install Node packages: `npm install` or `npm run <script>`

4. **Execution Guidelines**:
   - Always verify the current working directory before executing relative paths.
   - Capture and display both stdout and stderr.
