const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER; // e.g. "+1XXXXXXXXXX"

let client = null;
if (accountSid && authToken) {
  try {
    client = require('twilio')(accountSid, authToken);
  } catch (e) {
    console.warn('Twilio SDK not available. SMS disabled until dependencies are installed.');
  }
} else {
  console.warn('Twilio env vars missing. SMS disabled. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.');
}

const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
function fmtMoney(n){ return (Number(n || 0)).toFixed(2); }

function normalizePhone(phone){
  if (!phone) return null;
  const s = String(phone).trim();
  return s; // Expect E.164 from UI; adjust here if you need automatic country codes
}

async function sendThankYouSMS(to, bill){
  if (!client || !fromNumber) return;
  const dest = normalizePhone(to);
  if (!dest) return;
  const link = baseUrl ? `${baseUrl}/invoice/${bill.invoiceNo}` : '';
  const msg = `Thanks for shopping at Taheri Fireworks! Invoice #${bill.invoiceNo}. Amount: ₹${fmtMoney(bill.grandTotal)}.${link? ' View invoice: '+link : ''} We appreciate your business.`;
  await client.messages.create({ from: fromNumber, to: dest, body: msg });
}

async function sendWhatsAppThankYou(to, bill){
  if (!client) return;
  const dest = to?.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const from = process.env.TWILIO_WHATSAPP_FROM || null; // e.g., 'whatsapp:+14155238886'
  if (!from) return; // not configured
  const link = baseUrl ? `${baseUrl}/invoice/${bill.invoiceNo}` : '';
  const msg = `Thanks for shopping at Taheri Fireworks! Invoice #${bill.invoiceNo}. Amount: ₹${fmtMoney(bill.grandTotal)}.${link? ' View invoice: '+link : ''}`;
  await client.messages.create({ from, to: dest, body: msg });
}

module.exports = { sendThankYouSMS, sendWhatsAppThankYou };

// Server-side helper to send an invoice link or media over WhatsApp
async function sendWhatsAppInvoice(to, bill, invoiceUrl){
  if (!client) throw new Error('Twilio client not configured');
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g., 'whatsapp:+14155238886'
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM not configured');
  const dest = to?.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const body = `Thanks for shopping at Taheri Fireworks! Invoice #${bill.invoiceNo}. Total: ₹${fmtMoney(bill.grandTotal)}. View invoice: ${invoiceUrl}`;
  // Twilio allows media messages; here we send plain text with link
  await client.messages.create({ from, to: dest, body });
}

// Send WhatsApp message with media (PDF link)
async function sendWhatsAppInvoiceMedia(to, bill, mediaUrl){
  if (!client) throw new Error('Twilio client not configured');
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM not configured');
  const dest = to?.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const body = `Thanks for shopping at Taheri Fireworks! Invoice #${bill.invoiceNo}. Total: ₹${fmtMoney(bill.grandTotal)}.`;
  await client.messages.create({ from, to: dest, body, mediaUrl: [mediaUrl] });
}

module.exports = { sendThankYouSMS, sendWhatsAppThankYou, sendWhatsAppInvoice, sendWhatsAppInvoiceMedia };

