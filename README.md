# Taheri Fireworks Billing

A billing and inventory web app for a local shop with a modern UI, automatic PDF invoices, and customer SMS notifications.

- Backend: Node.js, Express, Mongoose (MongoDB)
- Frontend: Static HTML/CSS/JS served by the backend

## Prerequisites
- Node.js 18+ and npm
- A MongoDB instance (Atlas or local)
- (Optional) Twilio account for SMS

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

3) Configure environment
- Create `backend/.env` with at least your MongoDB connection string:
```
MONGO_URI=mongodb://127.0.0.1:27017/TaheriFireWorks
```
- To enable SMS after saving a bill (optional), add your Twilio credentials:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
# Optional: WhatsApp sending (Twilio WhatsApp sandbox or approved sender)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# Optional: public URL base to include share links in SMS/WhatsApp (e.g., https://mydomain.com)
PUBLIC_BASE_URL=http://localhost:5050

# Optional: firm details for server-rendered invoice page
FIRM_NAME="Taheri Fireworks"
FIRM_ADDR1="Shop 12, Main Market Road"
FIRM_ADDR2="Your City - 400001"
FIRM_PHONE="+91XXXXXXXXXX"
FIRM_EMAIL="info@taherifireworks.example"
FIRM_GSTIN="GSTIN-XXXXXXXXXXXXXX"
```

4) Run the server (serves frontend and APIs)
```
node backend/server.js
```
The server runs on http://localhost:5050. The frontend is served from the `frontend/` folder.

## Project Structure
```
backend/
  models/
  routes/
  services/
    sms.js         # Twilio SMS helper (thank-you message after bill)
  server.js
frontend/
  index.html       # Home
  create-bill.html # Create bill (auto-downloads PDF on save)
  bills.html       # List & search all bills, download PDFs
  stock.html       # Manage stock and prices
  assets/
    style.css
    script.js
```

## Key Features
- Modern, responsive UI with consistent styling
- Create bill with discount support and item editing/removal
- Automatic PDF invoice download after saving a bill
- Automatic SMS thank-you message to customer (when Twilio is configured)
- Bills page to list, search, and download invoices

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
- Frontend JS auto-detects the current origin for API calls.
- Bills creation validates stock and decrements it per item.
- For production, set MONGO_URI via environment or .env and consider using a process manager (PM2) and a reverse proxy.
- SMS requires E.164-formatted phone numbers (e.g., +91XXXXXXXXXX). If SMS env vars are not set, saving a bill will still work but no SMS will be sent.
