# 🧑‍💻 User Registration System (NestJS + React)

A simple full-stack user registration and authentication app built with **NestJS (Backend)** and **React (Frontend)**.

---

## 🚀 Tech Stack

- **Frontend:** React + Vite + Tailwind CSS  
- **Backend:** NestJS + MongoDB + Mongoose  
- **Deployment:** Vercel (Frontend) & Render (Backend)

---

## 🧩 Project Structure

project-root/
│
├── user-registration-backend/ # NestJS API
│ ├── src/
│ ├── .env
│ └── package.json
│
└── user-registration-frontend/ # React (Vite)
├── src/
├── .env.development
├── .env.production
└── package.json

yaml
Sao chép mã

---

## 🧠 Environment Variables

### 🔹 Backend (`.env` in `user-registration-backend/`)
```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/user_db
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
🔹 Frontend (.env.development)
env

API_URL=http://localhost:4000
🔹 Frontend (.env.production)
env

API_URL=https://registration-login-109d.onrender.com
NODE_ENV=production
🖥️ Local Setup
1️⃣ Start the Backend
bash

cd user-registration-backend
npm install
npm run start:dev
Backend runs on:
👉 http://localhost:4000

2️⃣ Start the Frontend
bash

cd user-registration-frontend
npm install
npm run dev
Frontend runs on:
👉 http://localhost:5173

🌐 Live Deployment
Service	URL
Frontend (Vercel)	https://registration-login-iota.vercel.app
Backend (Render)	https://registration-login-109d.onrender.com

🧾 Notes
Ensure that MongoDB is running locally when testing in development.

In production, your backend .env must have the correct FRONTEND_URL (no trailing slash).

CORS is already configured for both local and deployed environments.