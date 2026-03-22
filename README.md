# MAHIMA CHATRABAS - Meal Management System

Complete full-stack hostel meal management app with:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Storage: MongoDB (primary) with automatic JSON fallback
- Auth: JWT + bcrypt password hashing
- OTP: Email via nodemailer
- Admin: Student management + daily PDF reports

## Project Structure

```text
/frontend
  index.html
  style.css
  script.js

/backend
  server.js
  /.env.example
  /routes
  /models
  /controllers
  /middleware
  /utils
  /data
```

## Setup & Run

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env
```
Edit `.env` values, especially:
- `JWT_SECRET`
- `USE_MONGODB=true`
- `MONGODB_URI=mongodb://127.0.0.1:27017/mahima_chatrabas`

3. Start backend:
```bash
npm start
```
API runs at `http://localhost:5000`.
If MongoDB is not reachable, backend automatically falls back to JSON files in `backend/data`.

4. Run frontend:
- Open `frontend/index.html` using Live Server extension, or
- Serve frontend with any static server on another port.

## Default Admin Login

- Username: `admin`
- Password: `mahima@2007`

## Key Features Implemented

- Hero section with `hostel.mp4`, logo, title/subtitle/location
- About section with superintendent and assistant superintendent
- Facilities, Rules, Contact, Footer social links
- Student signup with OTP verification
- Duplicate prevention:
  - Email unique
  - Room + Bed unique
- Student login via room + bed + password
- Monthly meal calendar:
  - Lunch/Dinner ON by default
  - Per-day toggle and veg/non-veg edits
  - Time-lock rules:
    - Lunch updates before 8:00 AM
    - Dinner updates before 2:30 PM
- Dashboard stats:
  - Total meals
  - Veg meals
  - Non-veg meals
- Admin panel:
  - List/search/delete students
  - Download daily lunch/dinner PDF reports
- Responsive UI + dark/light mode + toasts + loader + animations
- MongoDB-backed storage with fallback mode

## API Overview

- `POST /api/auth/request-otp`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`
- `GET /api/auth/me`

- `GET /api/meals/month?year=YYYY&month=MM`
- `PATCH /api/meals/:date`
- `GET /api/meals/stats/summary`

- `GET /api/admin/students?search=...`
- `DELETE /api/admin/students/:id`
- `GET /api/admin/reports/daily?meal=lunch|dinner&date=YYYY-MM-DD`

## Schema

See [backend/models/SCHEMA.md](./backend/models/SCHEMA.md).
