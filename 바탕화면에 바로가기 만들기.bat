@echo off
rem Creates a desktop shortcut for the study app
set "BAT=%~dp0Start-app.bat"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $bat=Get-ChildItem -LiteralPath '%~dp0' -Filter *.bat | Where-Object { $_.Name -like '*실행*' } | Select-Object -First 1; $l=$w.CreateShortcut((Join-Path $d 'Sobang.lnk')); $l.TargetPath=$bat.FullName; $l.WorkingDirectory='%~dp0'; $l.IconLocation='%~dp0img\app.ico'; $l.WindowStyle=7; $l.Save(); Rename-Item -LiteralPath (Join-Path $d 'Sobang.lnk') -NewName ([string]::Join('',[char[]](0xC18C,0xBC29,0xD569,0xACA9,0xB178,0xD2B8))+'.lnk') -Force"
echo Shortcut created on your Desktop.
pause