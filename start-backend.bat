@echo off
echo ============================================
echo  Starting Dashboard Aset SV IPB Backend
echo ============================================

SET NODE_EXE=C:\Users\Hp14\AppData\Roaming\fnm\node-versions\v20.20.2\installation\node.exe
SET NPM_CLI=C:\Users\Hp14\AppData\Roaming\fnm\node-versions\v20.20.2\installation\node_modules\npm\bin\npm-cli.js

cd backend

echo Using Node:
"%NODE_EXE%" --version

echo.
echo Starting NestJS backend at http://localhost:3001
echo Tekan Ctrl+C untuk menghentikan server.
echo.

"%NODE_EXE%" "%NPM_CLI%" run start:dev

pause
