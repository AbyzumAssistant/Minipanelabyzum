@echo off
setlocal
cd /d "%~dp0"
python -m pip install -r requirements.txt
pyinstaller --noconfirm MCABYZUM.spec
if errorlevel 1 exit /b 1
robocopy dist\MCABYZUM ..\backend\src\assets\launcher\MCABYZUM-win /MIR /NFL /NDL /NJH /NJS
echo.
echo Listo: backend\src\assets\launcher\MCABYZUM-win\MCABYZUM.exe
