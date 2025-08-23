# Taheri Fireworks Billing

A simple billing and inventory web app for a local shop.

- Backend: Node.js, Express, Mongoose (MongoDB)
- Frontend: Static HTML/CSS/JS served by the backend

## Prerequisites
- Node.js 18+ and npm
- A MongoDB instance (Atlas or local)

## Quick Start

1) Clone the repository
```
git clone https://github.com/TaheriFireWorks/TaheriFireWorks.git
cd TaheriFireWorks
```

2) Install backend dependencies
```
npm install --prefix backend
```

3) Configure MongoDB connection (recommended)
- Create a .env file at `backend/.env` with your connection string:
```
MONGO_URI=mongodb://127.0.0.1:27017/TaheriFireWorks
```
- Or export it in your shell before starting:
```
export MONGO_URI="mongodb://127.0.0.1:27017/TaheriFireWorks"
```
(If not set, the server uses the default Atlas URI currently in code.)

4) Run the server (serves frontend and APIs)
```
node backend/server.js
```
The server runs on http://localhost:5050 (default). The frontend is served from the `frontend/` folder.

## Project Structure
```
backend/
  models/         # Mongoose schemas
  routes/         # Express API routes
  server.js       # Express app entry
frontend/
  index.html      # Home
  create-bill.html
  stock.html
  assets/
    style.css
    script.js
```

## APIs
Base URL: `http://localhost:5050/api`

- Products
  - `POST /products`  → create { code, name, price, stock }
  - `GET  /products`  → list all
  - `GET  /products/:code` → get by code
  - `PUT  /products/:code` → update fields
  - `DELETE /products/:code` → delete by code

- Bills
  - `POST /bills` → create bill { customerName, customerPhone, items[], discount, grandTotal }
  - `GET  /bills` → list bills (desc by invoiceNo)
  - `GET  /bills/:invoiceNo` → get single bill by invoice number

## Common Commands
- Install deps: `npm install --prefix backend`
- Start server: `node backend/server.js`

## Notes
- The server serves the frontend and provides APIs on the same origin. The frontend JS auto-detects the current origin for API calls.
- Bills creation validates stock and decrements it per item.
- For production, set MONGO_URI via environment or .env and consider using a process manager (PM2) and a reverse proxy.

