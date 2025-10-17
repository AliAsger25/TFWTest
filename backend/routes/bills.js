const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const Product = require("../models/Product");
const { sendThankYouSMS, sendWhatsAppThankYou, sendWhatsAppInvoice, sendWhatsAppInvoiceMedia } = require("../services/sms");
const { generateInvoicePdf } = require('../services/pdf');

// Get next invoice number
async function getNextInvoiceNumber() {
  const lastBill = await Bill.findOne().sort({ invoiceNo: -1 });
  return lastBill ? lastBill.invoiceNo + 1 : 100;
}

// Create bill
router.post("/", async (req, res) => {
  try {
    const { items = [] } = req.body;

    // Validate stock availability before creating bill
    for (const item of items) {
      const prod = await Product.findOne({ code: item.code });
      if (!prod) {
        return res.status(400).json({ error: `Product ${item.code} not found` });
      }
      if (typeof item.qty !== "number" || item.qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for ${item.code}` });
      }
      if (prod.stock < item.qty) {
        return res.status(400).json({ error: `Insufficient stock for ${prod.name} (${prod.code}). Available: ${prod.stock}` });
      }
    }

    const invoiceNo = await getNextInvoiceNumber();

    const bill = new Bill({
      ...req.body,
      invoiceNo,
    });

    // Decrease stock
    for (let item of items) {
      await Product.findOneAndUpdate(
        { code: item.code },
        { $inc: { stock: -item.qty } }
      );
    }

    await bill.save();

    // Fire-and-forget SMS; do not block the response
    try {
      if (bill.customerPhone) {
        sendThankYouSMS(bill.customerPhone, bill).catch((e) => {
          console.warn("SMS send failed:", e?.message || e);
        });
        // WhatsApp (optional)
        sendWhatsAppThankYou(bill.customerPhone, bill).catch((e) => {
          console.warn("WhatsApp send failed:", e?.message || e);
        });
      }
    } catch (e) {
      console.warn("SMS/WhatsApp scheduling error:", e?.message || e);
    }

    res.json(bill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all bills
router.get("/", async (_req, res) => {
  const bills = await Bill.find().sort({ invoiceNo: -1 });
  res.json(bills);
});

// Get a bill by invoice number
router.get("/:invoiceNo", async (req, res) => {
  const bill = await Bill.findOne({ invoiceNo: Number(req.params.invoiceNo) });
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  // Normalize item order for clients
  try {
    bill.items = (bill.items || []).sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' }));
  } catch (e) { /* ignore */ }
  res.json(bill);
});

// Classify bill type (retail vs wholesale) by comparing stored prices to product prices
router.get('/:invoiceNo/classify', async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const bill = await Bill.findOne({ invoiceNo });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Default to wholesale unless all items match retailPrice
    let allRetail = true;
    for (const it of (bill.items || [])) {
      const prod = await Product.findOne({ code: it.code });
      if (!prod) { allRetail = false; break; }
      if (Number(prod.retailPrice || 0) !== Number(it.price || 0)) { allRetail = false; break; }
    }
    res.json({ type: allRetail ? 'retail' : 'wholesale' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send invoice (or link) via WhatsApp using server-side Twilio integration (if configured)
router.post('/:invoiceNo/send-whatsapp', async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const bill = await Bill.findOne({ invoiceNo });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!bill.customerPhone) return res.status(400).json({ error: 'No customer phone stored on bill' });

    // Build public invoice URL
    const base = process.env.PUBLIC_BASE_URL || (`${req.protocol}://${req.get('host')}`);
    const invoiceUrl = `${base.replace(/\/$/, '')}/invoice/${invoiceNo}`;

    // Attempt to send via Twilio WhatsApp (media if available)
    await sendWhatsAppInvoice(bill.customerPhone, bill, invoiceUrl);
    res.json({ success: true });
  } catch (err) {
    console.error('send-whatsapp error', err);
    res.status(500).json({ error: err.message || 'Failed to send WhatsApp' });
  }
});

// Send invoice as PDF via WhatsApp (generates PDF with Puppeteer then sends as media)
router.post('/:invoiceNo/send-whatsapp-pdf', async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const bill = await Bill.findOne({ invoiceNo });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!bill.customerPhone) return res.status(400).json({ error: 'No customer phone stored on bill' });

    // Generate PDF and get public path
    const publicPath = await generateInvoicePdf(invoiceNo, req);
    const base = process.env.PUBLIC_BASE_URL || (`${req.protocol}://${req.get('host')}`);
    const mediaUrl = `${base.replace(/\/$/, '')}${publicPath}`;

    // Send via Twilio WhatsApp as media
    await sendWhatsAppInvoiceMedia(bill.customerPhone, bill, mediaUrl);
    res.json({ success: true, mediaUrl });
  } catch (err) {
    console.error('send-whatsapp-pdf error', err);
    res.status(500).json({ error: err.message || 'Failed to send WhatsApp PDF' });
  }
});

// Update an existing bill (edit items and fields); adjusts stock based on deltas
router.put("/:invoiceNo", async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const existing = await Bill.findOne({ invoiceNo });
    if (!existing) return res.status(404).json({ error: "Bill not found" });

    const newItems = Array.isArray(req.body.items) ? req.body.items : [];
    // Build qty maps
    const oldMap = new Map((existing.items || []).map(i => [String(i.code), Number(i.qty || 0)]));
    const newMap = new Map(newItems.map(i => [String(i.code), Number(i.qty || 0)]));

    // Validate quantities and stock availability for positive deltas
    const codes = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const code of codes) {
      const prev = oldMap.get(code) || 0;
      const next = newMap.get(code) || 0;
      if (next < 0 || !Number.isFinite(next)) return res.status(400).json({ error: `Invalid quantity for ${code}` });
      const delta = next - prev; // how many extra units we require from inventory
      if (delta > 0) {
        const prod = await Product.findOne({ code });
        if (!prod) return res.status(400).json({ error: `Product ${code} not found` });
        if (prod.stock < delta) return res.status(400).json({ error: `Insufficient stock for ${prod.name || code}. Available: ${prod.stock}` });
      }
    }

    // Apply stock deltas
    for (const code of codes) {
      const prev = oldMap.get(code) || 0;
      const next = newMap.get(code) || 0;
      const delta = next - prev; // positive means decrease stock
      if (delta !== 0) {
        await Product.findOneAndUpdate({ code }, { $inc: { stock: -delta } });
      }
    }

    // Normalize and persist bill fields
    existing.customerName = req.body.customerName ?? existing.customerName;
    existing.customerPhone = req.body.customerPhone ?? existing.customerPhone;
    existing.discount = Number(req.body.discount || 0);
    existing.grandTotal = Number(req.body.grandTotal || 0);
    existing.items = newItems
      .map(i => ({ code: i.code, name: i.name, qty: Number(i.qty || 0), price: Number(i.price || 0), total: Number(i.total || 0) }))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' }));

    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a bill; restores stock
router.delete("/:invoiceNo", async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const bill = await Bill.findOne({ invoiceNo });
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    for (const item of (bill.items || [])) {
      await Product.findOneAndUpdate({ code: item.code }, { $inc: { stock: Number(item.qty || 0) } });
    }

    await Bill.deleteOne({ invoiceNo });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
