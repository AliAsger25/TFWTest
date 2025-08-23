const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Add product
router.post("/", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all products
router.get("/", async (_req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Get by code
router.get("/:code", async (req, res) => {
  const product = await Product.findOne({ code: req.params.code });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// Update product (price/stock/name)
router.put("/:code", async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { code: req.params.code },
    { $set: req.body },
    { new: true }
  );
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// Delete product
router.delete("/:code", async (req, res) => {
  const deleted = await Product.findOneAndDelete({ code: req.params.code });
  if (!deleted) return res.status(404).json({ error: "Product not found" });
  res.json({ success: true });
});

module.exports = router;
