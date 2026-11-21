@echo off
title ALICE (servidor do jogo - deixe esta janela aberta)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo.
  echo.
  pause
  exit /b 1
)

echo.
echo  ALICE
echo  Iniciando o servidor do jogo...
echo  Deixe esta janela aberta enquanto joga. Feche-a para encerrar.
echo.

rem abre o navegador so depois que o servidor responder
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 40;$i++){ try { Invoke-WebRequest -UseBasicParsing http://localhost:5180 -TimeoutSec 1 | Out-Null; Start-Process 'http://localhost:5180'; break } catch { Start-Sleep -Milliseconds 250 } }"

node server.js
echo.
echo  O servidor parou. Veja a mensagem acima.
pause
