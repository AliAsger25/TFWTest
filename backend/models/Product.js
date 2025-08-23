const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: String,
  price: Number,
  stock: Number
});

module.exports = mongoose.model("Product", productSchema);
