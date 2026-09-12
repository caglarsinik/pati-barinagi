@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Bagimliliklar kuruluyor, ilk seferde 1-2 dakika surer...
  call npm install
)
echo Oyun baslatiliyor; tarayici otomatik acilir. Kapatmak icin bu pencereyi kapat.
call npx vite --open
