@echo off
:: ====================================================================
:: SA BROTHERS VENDORS - AUTOMATIC LOCAL HARD DRIVE BACKUP TOOL
:: Copies all POS data, inventory, transactions, and expenses
:: into a safe timestamped folder on your computer's hard drive.
:: ====================================================================

title SA Brothers POS - Local Hard Drive Backup
color 0B

echo.
echo  ==============================================================
echo     SA BROTHERS VENDORS - LOCAL BACKUP UTILITY
echo  ==============================================================
echo.

set BACKUP_DIR=C:\SABrothers_POS_Backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%

set TARGET_FOLDER=%BACKUP_DIR%\Backup_%TIMESTAMP%
mkdir "%TARGET_FOLDER%"

echo Saving local database files to: %TARGET_FOLDER% ...

if exist "local_database\" (
    xcopy /E /I /Y "local_database\*" "%TARGET_FOLDER%\" >nul
)

if exist "sa_brothers_pos.sql" (
    copy /Y "sa_brothers_pos.sql" "%TARGET_FOLDER%\" >nul
)

echo.
echo [SUCCESS] Backup completed successfully!
echo Location: %TARGET_FOLDER%
echo.
pause
