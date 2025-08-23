const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
// require("dotenv").config(); // Optional: enable if you want to use a .env file

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/products", require("./routes/products"));
app.use("/api/bills", require("./routes/bills"));

// Serve frontend static files
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://aliasgerdemo4:aliasger2002@cluster0.v8dps5x.mongodb.net/TaheriFireWorks";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5050;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
