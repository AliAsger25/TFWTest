const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  invoiceNo: Number,
  customerName: String,
  customerPhone: String,
  date: { type: Date, default: Date.now },
  items: [
    {
      code: String,
      name: String,
      qty: Number,
      price: Number,
      total: Number
    }
  ],
  discount: Number,
  grandTotal: Number
});

module.exports = mongoose.model("Bill", billSchema);
