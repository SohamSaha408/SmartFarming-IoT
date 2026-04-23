@echo off
echo Starting Smart Agriculture System (Local Dev Mode)...
echo.
echo Starting Backend...
start "Smart Agri Backend" cmd /k "cd server && npm run dev"
echo.
echo Starting Frontend...
start "Smart Agri Frontend" cmd /k "cd client && npm run dev"
echo.
echo All services started!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3000
echo.
pause
