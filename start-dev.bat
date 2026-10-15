@echo off
echo ============================================
echo  Starting Dashboard Aset SV IPB Dev Server
echo ============================================

SET NODE_EXE=C:\Users\Hp14\AppData\Roaming\fnm\node-versions\v20.20.2\installation\node.exe
SET VITE_JS=.\node_modules\vite\bin\vite.js

echo Using Node:
"%NODE_EXE%" --version

echo.
echo Starting Vite dev server at http://localhost:5173
echo Tekan Ctrl+C untuk menghentikan server.
echo.

"%NODE_EXE%" "%VITE_JS%" --port 5173

pause
