@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (
  echo Build basarisiz.
) else (
  echo Hazir: dist\index.html dosyasina cift tikla.
  echo Telefona kurulum / yayin icin dist klasorunun tamami gerekir (index.html + manifest + icons + sw.js); bkz. README.
)
pause
