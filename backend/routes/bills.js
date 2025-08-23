const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const Product = require("../models/Product");

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
  res.json(bill);
});

module.exports = router;
