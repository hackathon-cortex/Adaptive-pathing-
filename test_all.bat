@echo off
echo ========================================================
echo Running SIH Perception + Prediction Test Suite
echo ========================================================
py -m pytest -v
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Some tests failed.
    exit /b %ERRORLEVEL%
) else (
    echo [SUCCESS] All 31 tests passed!
)
