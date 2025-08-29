const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config(); // Load env vars from backend/.env if present

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/products", require("./routes/products"));
app.use("/api/bills", require("./routes/bills"));

// Public runtime config for frontend feature flags
app.get('/api/config', (_req, res) => {
  res.json({
    twilioSmsEnabled: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    twilioWhatsappEnabled: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || ''
  });
});

// Public invoice HTML view (shareable link)
app.get("/invoice/:invoiceNo", async (req, res) => {
  try {
    const Bill = require("./models/Bill");
    const invoiceNo = Number(req.params.invoiceNo);
    const bill = await Bill.findOne({ invoiceNo });
    if (!bill) return res.status(404).send("Invoice not found");

    const firm = {
      name: process.env.FIRM_NAME || "Taheri Fireworks",
      addr1: process.env.FIRM_ADDR1 || "Shop 12, Main Market Road",
      addr2: process.env.FIRM_ADDR2 || "Your City - 400001",
      phone: process.env.FIRM_PHONE || "+91XXXXXXXXXX",
      email: process.env.FIRM_EMAIL || "info@taherifireworks.example",
      gstin: process.env.FIRM_GSTIN || "",
      logoUrl: process.env.FIRM_LOGO_URL || ""
    };

    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rows = (bill.items || []).map(it => `
      <tr>
        <td>${esc(it.code)}</td>
        <td>${esc(it.name)}</td>
        <td class="right">${esc(it.qty)}</td>
        <td class="right">₹${Number(it.price||0).toFixed(2)}</td>
        <td class="right">₹${Number(it.total||0).toFixed(2)}</td>
      </tr>
    `).join("");

    const subtotal = (bill.items || []).reduce((s,i)=> s+(i.total||0),0);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(bill.invoiceNo)} - ${esc(firm.name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f5f7fb; color: #1a1f36; margin: 0; }
    .container { max-width: 210mm; margin: 10mm auto; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 20px 24px; border-bottom: 1px solid #eee; }
    .title { margin: 0; font-size: 20px; }
    .muted { color: #667085; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 24px; }
    .section { padding: 16px 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    thead th { text-align: left; background: #fafbff; }
    .right { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .footer { padding: 14px 24px; font-size: 12px; color: #667085; border-top: 1px solid #eee; }
    @media print { body { background: #fff; } .container { box-shadow: none; max-width: 190mm; margin: 10mm auto; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${firm.logoUrl ? `<img src="${esc(firm.logoUrl)}" alt="logo" style="height:48px;vertical-align:middle;margin-right:10px" />` : ''}<h1 class="title" style="display:inline-block;vertical-align:middle;margin:0 0 0 6px">${esc(firm.name)}</h1>
      <div class="muted">${esc(firm.addr1)}${firm.addr2? ", "+esc(firm.addr2):""}</div>
      <div class="muted">${esc(firm.phone)} ${firm.email? " • "+esc(firm.email):""} ${firm.gstin? " • GSTIN: "+esc(firm.gstin):""}</div>
    </div>

    <div class="grid">
      <div>
        <div class="muted">Invoice</div>
        <div><strong>#${esc(bill.invoiceNo)}</strong></div>
        <div class="muted">Date: ${esc(new Date(bill.date||Date.now()).toLocaleDateString())}</div>
      </div>
      <div>
        <div class="muted">Billed To</div>
        <div><strong>${esc(bill.customerName || 'Walk-in')}</strong></div>
        <div class="muted">${esc(bill.customerPhone || '-')}</div>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="section">
      <table class="totals">
        <tr><td class="muted">Subtotal</td><td class="right">₹${subtotal.toFixed(2)}</td></tr>
        <tr><td class="muted">Discount</td><td class="right">₹${Number(bill.discount||0).toFixed(2)}</td></tr>
        <tr><td><strong>Total</strong></td><td class="right"><strong>₹${Number(bill.grandTotal||subtotal).toFixed(2)}</strong></td></tr>
      </table>
    </div>

    <div class="footer">Thanks for shopping with ${esc(firm.name)}. Visit again!</div>
  </div>
</body>
</html>`;

    res.set("Content-Type", "text/html; charset=utf-8").send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error rendering invoice");
  }
});

// Serve frontend static files
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// MongoDB connection
const MONGO_URI = "mongodb+srv://aliasgerdemo4:aliasger2002@cluster0.v8dps5x.mongodb.net/TaheriFireWorks?retryWrites=true&w=majority&appName=Cluster0";
if (!MONGO_URI) {
  console.error("Missing MONGO_URI env var. Please set it to your MongoDB connection string.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
