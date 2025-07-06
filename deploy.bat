@echo off
echo Deploying Bufonaut to GitHub Pages...
echo.

echo Adding all changes...
git add .

echo.
echo Enter commit message:
set /p commit_msg=

echo.
echo Committing changes...
git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub...
git push

echo.
echo Deployment complete!
echo Your game should be available at: https://slitheen.github.io/Bufonaut/
echo.
pause 