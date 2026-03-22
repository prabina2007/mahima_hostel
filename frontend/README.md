# Frontend Hosting Guide

This project frontend is self-contained inside the `frontend` folder.

## Folder contents
- HTML pages
- CSS files
- JavaScript files
- media in `assets/`

## Static hosting
You can host the `frontend` folder on any static hosting platform.
Examples:
- Netlify
- Vercel static deployment
- GitHub Pages
- Any Apache/Nginx static site setup

## Important API note
The frontend currently calls the backend at:
- `http://localhost:5000/api`

Before production hosting, update the API base URL in:
- `auth.js`
- `script.js`
- `dashboard.js`
- `admin-dashboard.js`
- `representative-dashboard.js`

Change it from localhost to your deployed backend URL.

## Suggested deployment structure
- `frontend` -> static hosting
- `backend` -> Node.js hosting with MongoDB

## Assets
All website images and media used by the frontend are stored in:
- `frontend/assets`
