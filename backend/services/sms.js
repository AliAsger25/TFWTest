// Lightweight SMS/WhatsApp stub service
// This intentionally avoids external dependencies and simply logs the action.
function fmtMoney(n){ return (Number(n || 0)).toFixed(2); }

async function sendThankYouSMS(to, bill){
  try {
    if (!to) return;
    const link = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/invoice/${bill.invoiceNo}` : '';
    console.log(`[sms] sendThankYouSMS -> to=${to} amount=₹${fmtMoney(bill.grandTotal)} invoice=${bill.invoiceNo} link=${link}`);
  } catch (e) { console.warn('[sms] sendThankYouSMS error', e); }
}

async function sendWhatsAppThankYou(to, bill){
  try {
    if (!to) return;
    const link = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/invoice/${bill.invoiceNo}` : '';
    console.log(`[sms] sendWhatsAppThankYou -> to=${to} amount=₹${fmtMoney(bill.grandTotal)} invoice=${bill.invoiceNo} link=${link}`);
  } catch (e) { console.warn('[sms] sendWhatsAppThankYou error', e); }
}

async function sendWhatsAppInvoice(to, bill, invoiceUrl){
  try {
    if (!to) return;
    console.log(`[sms] sendWhatsAppInvoice -> to=${to} invoice=${bill.invoiceNo} url=${invoiceUrl}`);
  } catch (e) { console.warn('[sms] sendWhatsAppInvoice error', e); }
}

async function sendWhatsAppInvoiceMedia(to, bill, mediaUrl){
  try {
    if (!to) return;
    console.log(`[sms] sendWhatsAppInvoiceMedia -> to=${to} invoice=${bill.invoiceNo} media=${mediaUrl}`);
  } catch (e) { console.warn('[sms] sendWhatsAppInvoiceMedia error', e); }
}

module.exports = { sendThankYouSMS, sendWhatsAppThankYou, sendWhatsAppInvoice, sendWhatsAppInvoiceMedia };

