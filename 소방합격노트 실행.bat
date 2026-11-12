@echo off
rem Fire exam study app launcher - double-click to run
set "APP=%~dp0index.html"
if not exist "%APP%" (
  echo index.html not found. Please unzip the whole folder first.
  pause
  exit /b 1
)
set "URL=file:///%APP:\=/%"
for %%B in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do (
  if exist %%B (
    start "" %%B --app="%URL%#/home"
    exit /b 0
  )
)
start "" "%APP%"
exit /b 0