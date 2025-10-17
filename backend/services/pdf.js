const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

// Generates a PDF for invoice page and returns the public file path (relative to public base)
async function generateInvoicePdf(invoiceNo, req) {
  // ensure uploads directory exists
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Use a browser to render the invoice page and save as PDF
  const base = process.env.PUBLIC_BASE_URL || (`${req.protocol}://${req.get('host')}`);
  const invoiceUrl = `${base.replace(/\/$/, '')}/invoice/${invoiceNo}`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(invoiceUrl, { waitUntil: 'networkidle0' });

    // filename
    const filename = `invoice_${invoiceNo}_${Date.now()}.pdf`;
    const outPath = path.join(uploadsDir, filename);

    await page.pdf({ path: outPath, format: 'A4', printBackground: true });

    // Return a path that can be served publicly
    const publicPath = `/uploads/${filename}`;
    return publicPath;
  } finally {
    try { await browser.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = { generateInvoicePdf };
