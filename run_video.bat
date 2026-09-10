@echo off
setlocal enabledelayedexpansion
echo ========================================================
echo Running Integrated Perception + Prediction Pipeline
echo ========================================================

REM Check if user passed a video file argument
if not "%~1"=="" (
    echo [INPUT] Processing specified video: %1
    py core/prediction/run_prediction.py --video "%~1" --save-video "test_videos/outputs/annotated_output.mp4"
    goto finish
)

REM Check if test_videos has any videos
set "FOUND="
for %%f in ("test_videos\*.mp4" "test_videos\*.avi" "test_videos\*.mov" "test_videos\*.mkv") do (
    set "FOUND=%%f"
    goto run_found
)

REM If no video found in test_videos, check Downloads sample
if exist "C:\Users\lapto\Downloads\Driving_in_Chaos.mp4" (
    echo [INFO] No custom video found in test_videos/.
    echo [INFO] Using default sample: Driving_in_Chaos.mp4
    py core/prediction/run_prediction.py --video "C:\Users\lapto\Downloads\Driving_in_Chaos.mp4" --max-frames 60 --save-video "test_videos/outputs/annotated_output.mp4"
    goto finish
)

echo [WARNING] No video found in test_videos/ and sample video not found.
echo Please copy your video (.mp4, .avi, etc.) into the 'test_videos' folder and try again!
goto finish

:run_found
echo [INPUT] Processing video from test_videos/: %FOUND%
py core/prediction/run_prediction.py --video "%FOUND%" --save-video "test_videos/outputs/annotated_output.mp4"

:finish
echo.
echo ========================================================
echo Results:
echo - Predictions JSON:  core/prediction/sample_output.json
echo - Annotated Video:   test_videos/outputs/annotated_output.mp4
echo ========================================================
pause
