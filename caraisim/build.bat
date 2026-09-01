@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Building Maze AI Simulation (C++ / Raylib)...
echo =======================================================

set "VS_PATH=C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvars64.bat"

if not exist "!VS_PATH!" (
    for /f "usebackq tokens=*" %%i in (`powershell -Command "Get-ChildItem 'C:\Program Files\Microsoft Visual Studio' -Recurse -Filter 'vcvars64.bat' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName"`) do (
        set "VS_PATH=%%i"
    )
)

if not exist "!VS_PATH!" (
    echo [ERROR] Could not find vcvars64.bat. Please ensure Visual Studio MSVC is installed.
    exit /b 1
)

call "!VS_PATH!" >nul 2>&1

echo Compiling source files...
cl /O2 /MD /EHsc /std:c++17 /I include /I raylib\raylib-5.0_win64_msvc16\include main.cpp src\file_dialog.cpp /Fe:maze_ai_sim.exe /link /LIBPATH:raylib\raylib-5.0_win64_msvc16\lib raylib.lib gdi32.lib winmm.lib user32.lib shell32.lib comdlg32.lib

if %ERRORLEVEL% equ 0 (
    echo.
    echo =======================================================
    echo Build SUCCESSFUL! Output: maze_ai_sim.exe
    echo =======================================================
    copy raylib\raylib-5.0_win64_msvc16\lib\raylib.dll . >nul 2>&1
) else (
    echo.
    echo [ERROR] Build failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)
