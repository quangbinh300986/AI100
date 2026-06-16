@echo off

:: 配置源路径和目标路径
set SRC="C:\APP\AI100\battle100\backend\backups"
set DST="C:\共享\共享\bak"

echo ===================================================
echo [%date% %time%] 开始执行备份同步...
echo 源目录: %SRC%
echo 目标目录: %DST%
echo ===================================================

:: 使用 Windows 自带的高速复制工具 robocopy 进行增量同步
robocopy %SRC% %DST% /E /XO /R:3 /W:5

:: Robocopy 的退出码 0-7 代表完成或成功增量
if %ERRORLEVEL% LEQ 7 (
    echo [] 备份增量同步成功！
) else (
    echo [] 备份同步发生异常，退出码: %ERRORLEVEL%
)
