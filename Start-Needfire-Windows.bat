@echo off
setlocal
title Needfire
cd /d "%~dp0"
set "PYTHONUTF8=1"
if not defined NEEDFIRE_PORT set "NEEDFIRE_PORT=8848"
set "PY="

rem --- 1. Prefer the official "py" launcher (installed by python.org by default)
py -3 -c "import sys" >NUL 2>&1
if not errorlevel 1 set "PY=py -3"
if defined PY goto :checkver

rem --- 2. Fall back to "python", but do not be fooled by the Microsoft Store
rem stub: the stub fails when given real work, so only trust exit code 0.
python -c "import sys" >NUL 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY goto :nopython

:checkver
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)" >NUL 2>&1
if errorlevel 1 goto :oldpython

rem --- Already running? Just open the browser and leave. ---
%PY% -c "import urllib.request as u; u.urlopen('http://127.0.0.1:%NEEDFIRE_PORT%/api/health', timeout=1)" >NUL 2>&1
if not errorlevel 1 (
    echo Needfire is already running. Opening your browser...
    start "" "http://localhost:%NEEDFIRE_PORT%/"
    goto :done
)

rem --- Port taken by something else? ---
%PY% -c "import socket; s=socket.socket(); s.bind(('0.0.0.0', %NEEDFIRE_PORT%)); s.close()" >NUL 2>&1
if errorlevel 1 goto :portbusy

echo.
echo  ==========================================================
echo   Starting Needfire. The FIRST start builds its library
echo   index - give it a minute. Your browser will open by
echo   itself when it is ready:  http://localhost:%NEEDFIRE_PORT%
echo.
echo   KEEP THIS WINDOW OPEN - closing it stops Needfire.
echo   If Windows Firewall asks, click "Allow access".
echo  ==========================================================
echo.
start "" /b %PY% scripts\open-when-ready.py %NEEDFIRE_PORT%
%PY% -m needfire serve
goto :done

:nopython
echo.
echo  ==========================================================
echo   Python is not installed on this computer. It is free:
echo.
echo   1. A download page will now open (python.org/downloads).
echo   2. Click the big yellow "Download Python 3.x" button.
echo   3. Run the installer and click "Install Now".
echo      (No checkboxes needed - the standard install is fine.)
echo   4. When it finishes, double-click this file again:
echo      Start-Needfire-Windows.bat
echo  ==========================================================
echo.
start "" "https://www.python.org/downloads/"
goto :done

:oldpython
echo.
echo  Your Python is older than 3.8. Please install the current
echo  version from the page that just opened, then run this again.
start "" "https://www.python.org/downloads/"
goto :done

:portbusy
echo.
echo  Another program is already using port %NEEDFIRE_PORT%.
echo  Close that program and double-click this file again, or use a
echo  different port: open a Command Prompt in this folder and run
echo      set NEEDFIRE_PORT=8899
echo      Start-Needfire-Windows.bat
echo  See QUICKSTART.md, section "Troubleshooting", for details.
goto :done

:done
echo.
pause
