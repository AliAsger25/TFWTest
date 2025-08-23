const API_BASE = `${window.location.origin}/api`;

// ---------- Helpers ----------
function qs(id) { return document.getElementById(id); }
function show(el, visible) { if (el) el.style.display = visible ? 'block' : 'none'; }
function fmtMoney(n) { return (Number(n || 0)).toFixed(2); }

// Make functions available for inline onclick handlers
function expose(name, fn){ window[name] = fn; }

// ---------- Modal: Add Product (Home page) ----------
function openAddProductModal() { show(qs("productModal"), true); }
function closeAddProductModal() { show(qs("productModal"), false); }
expose('openAddProductModal', openAddProductModal);
expose('closeAddProductModal', closeAddProductModal);

async function saveProduct() {
  const product = {
    code: qs("prodCode")?.value?.trim(),
    name: qs("prodName")?.value?.trim(),
    price: parseFloat(qs("prodPrice")?.value || 0),
    stock: parseInt(qs("prodStock")?.value || 0, 10)
  };

  if (!product.code) return alert("Enter product code");

  const res = await fetch(`${API_BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product)
  });

  if (res.ok) {
    alert("✅ Product added!");
    closeAddProductModal();
    if (typeof loadStock === 'function') loadStock();
  } else {
    const { error } = await res.json().catch(() => ({}));
    alert("❌ Error adding product" + (error ? `: ${error}` : ""));
  }
}
expose('saveProduct', saveProduct);

// ---------- Create Bill page ----------
let billItems = [];
let billDiscount = 0;

async function addToBill() {
  let code = qs("productCode")?.value?.trim();
  const qty = parseInt(qs("qty")?.value || 1, 10);
  if (!code) return alert("Enter product code or name");
  if (qty <= 0) return alert("Quantity must be at least 1");

  // If the input doesn't match a code directly, try search and pick first match
  let product = null;
  let res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`);
  if (res.ok) {
    product = await res.json();
  } else {
    const s = await fetch(`${API_BASE}/products/search/q?q=${encodeURIComponent(code)}`);
    if (s.ok){
      const options = await s.json();
      if (options.length){
        product = options[0];
      }
    }
  }
  if (!product) {
    return alert("Product not found");
  }

  const existing = billItems.find(i => i.code === product.code);
  if (existing) {
    existing.qty += qty;
    existing.total = existing.qty * existing.price;
  } else {
    billItems.push({
      code: product.code,
      name: product.name,
      qty,
      price: product.price,
      total: product.price * qty
    });
  }

  renderBillTable();
  if (qs("productCode")) qs("productCode").value = "";
  if (qs("qty")) qs("qty").value = 1;
}
expose('addToBill', addToBill);

// Autocomplete search handler
let __PRODUCT_SUGGEST_TIMER = null;
let __PRODUCT_CACHE = [];
async function onProductSearchInput(){
  const el = qs('productCode');
  const list = document.getElementById('productSuggest');
  if (!el || !list) return;
  const q = el.value.trim();
  if (!q){ list.style.display='none'; list.innerHTML=''; return; }
  clearTimeout(__PRODUCT_SUGGEST_TIMER);
  __PRODUCT_SUGGEST_TIMER = setTimeout(async () => {
    const res = await fetch(`${API_BASE}/products/search/q?q=${encodeURIComponent(q)}`);
    const items = res.ok ? await res.json() : [];
    __PRODUCT_CACHE = items;
    if (!items.length){
      list.innerHTML = `<div class="autocomplete-empty">No matches</div>`;
      list.style.display = 'block';
      return;
    }
    list.innerHTML = items.map(p => (
      `<div class="autocomplete-item" onclick="selectProductSuggestion('${encodeURIComponent(p.code)}')">
        <span>${p.code} — ${p.name || ''}</span>
        <span>₹${fmtMoney(p.price)}</span>
      </div>`
    )).join('');
    list.style.display = 'block';
  }, 200);
}
expose('onProductSearchInput', onProductSearchInput);

function selectProductSuggestion(encodedCode){
  const code = decodeURIComponent(encodedCode);
  const el = qs('productCode');
  if (el) el.value = code;
  const list = document.getElementById('productSuggest');
  if (list){ list.style.display='none'; list.innerHTML=''; }
}
expose('selectProductSuggestion', selectProductSuggestion);

function renderBillTable() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;
  tbody.innerHTML = billItems.map(item => `
    <tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>
        <input class="input" type="number" min="1" value="${item.qty}" style="width:80px" onchange="updateItemQty('${item.code}', this.value)" />
      </td>
      <td>₹${fmtMoney(item.price)}</td>
      <td>₹${fmtMoney(item.total)}</td>
      <td><button class="btn danger" onclick="removeItem('${item.code}')">Remove</button></td>
    </tr>
  `).join("");

  const subtotal = billItems.reduce((sum, i) => sum + i.total, 0);
  const subtotalEl = qs("subtotal");
  const discountInput = qs("discount");
  if (discountInput) billDiscount = parseFloat(discountInput.value || 0);
  if (subtotalEl) subtotalEl.textContent = `₹${fmtMoney(subtotal)}`;

  const grand = Math.max(0, subtotal - (billDiscount || 0));
  const gtEl = qs("grandTotal");
  if (gtEl) gtEl.textContent = fmtMoney(grand);
}

function updateItemQty(code, newQty) {
  newQty = parseInt(newQty, 10);
  const item = billItems.find(i => i.code === code);
  if (!item) return;
  item.qty = Math.max(1, newQty || 1);
  item.total = item.qty * item.price;
  renderBillTable();
}
expose('updateItemQty', updateItemQty);

function removeItem(code){
  billItems = billItems.filter(i => i.code !== code);
  renderBillTable();
}
expose('removeItem', removeItem);

async function saveBill() {
  const customerName = qs("customerName")?.value?.trim() || "Walk-in";
  const customerPhone = qs("customerPhone")?.value?.trim() || "";
  const discountInput = qs("discount");
  billDiscount = parseFloat(discountInput?.value || 0);

  if (!billItems.length) return alert("Add at least one product");

  const grandTotal = billItems.reduce((s, i) => s + i.total, 0) - (billDiscount || 0);

  const payload = {
    customerName,
    customerPhone,
    items: billItems,
    discount: billDiscount,
    grandTotal: Math.max(0, grandTotal)
  };

  const res = await fetch(`${API_BASE}/bills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return alert("❌ Failed to save bill" + (data.error ? `: ${data.error}` : ""));
  }

  alert(`✅ Bill saved! Invoice No: ${data.invoiceNo}`);
  try {
    // Auto-generate and download invoice
    await generateBillPDF(data);
  } catch (e) {
    console.warn('PDF generation failed:', e);
  }

  // If Twilio WhatsApp is not configured, open WhatsApp share automatically
  try {
    const cfgRes = await fetch(`${API_BASE}/config`);
    if (cfgRes.ok){
      const cfg = await cfgRes.json();
      if (!cfg.twilioWhatsappEnabled && data.customerPhone){
        const phone = String(data.customerPhone).replace(/\D/g,'');
        const link = `${window.location.origin}/invoice/${data.invoiceNo}`;
        const msg = encodeURIComponent(`Thanks for shopping at ${window.FIRM?.name || 'Taheri Fireworks'}! Invoice #${data.invoiceNo}. Amount: ₹${fmtMoney(data.grandTotal)}. View: ${link}`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      }
    }
  } catch (e) { /* ignore */ }

  billItems = [];
  renderBillTable();
}
expose('saveBill', saveBill);

// Invoice PDF generation (jsPDF)
async function generateBillPDF(bill){
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('jsPDF not loaded');
  const doc = new jsPDF();

  // Helper to load logo as data URL
  async function loadImageDataURL(src){
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  const lineY = (y) => doc.line(14, y, 196, y);
  const rightEdge = 196; // right page margin
  const rightText = (txt, y) => doc.text(String(txt), rightEdge, y, { align: 'right' });
  const col = (x, txt, y, right=false) => doc.text(String(txt), x, y, right ? { align: 'right' } : undefined);

  // Column positions
  const X_CODE = 14;
  const X_NAME = 40;   // wider name column for better alignment
  const X_QTY = 140;
  const X_PRICE = 170;
  const X_AMT = rightEdge;

  // Header with firm details
  const firm = window.FIRM || {};
  const logoDataUrl = await loadImageDataURL(firm.logoSrc);
  if (logoDataUrl){
    try { doc.addImage(logoDataUrl, 'PNG', 14, 10, 24, 24); } catch(e){}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(firm.name || 'Taheri Fireworks', 105, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const addr = (firm.addressLines || []).join(', ');
  if (addr) doc.text(addr, 105, 20, { align: 'center' });
  const contactLine = [firm.phone, firm.email].filter(Boolean).join(' • ');
  if (contactLine) doc.text(contactLine, 105, 26, { align: 'center' });
  if (firm.gstin) doc.text(`GSTIN: ${firm.gstin}`, 105, 32, { align: 'center' });
  lineY(36);

  // Invoice meta
  doc.setFontSize(11);
  doc.text(`Invoice #: ${bill.invoiceNo}`, 14, 44);
  rightText(`Date: ${new Date(bill.date || Date.now()).toLocaleDateString()}`, 44);
  doc.text(`Customer: ${bill.customerName || 'Walk-in'}`, 14, 50);
  doc.text(`Phone: ${bill.customerPhone || '-'}`, 14, 56);

  // Table header
  lineY(60);
  doc.setFont('helvetica', 'bold');
  doc.text('Code', X_CODE, 66);
  doc.text('Item', X_NAME, 66);
  col(X_QTY, 'Qty', 66, true);
  col(X_PRICE, 'Price', 66, true);
  col(X_AMT, 'Amount', 66, true);
  doc.setFont('helvetica', 'normal');
  lineY(68);

  let y = 76;
  const rowH = 8;
  const items = bill.items || [];
  items.forEach(it => {
    const nameText = String(it.name || '');
    const nameLines = doc.splitTextToSize(nameText, 92); // wrap name within ~92px width
    const lines = Math.max(1, nameLines.length);
    // New page if not enough space for wrapped row
    if (y + (lines - 1) * rowH > 270) {
      doc.addPage();
      y = 20;
    }
    // First line
    doc.text(String(it.code || ''), X_CODE, y);
    doc.text(nameLines, X_NAME, y); // jsPDF prints multi-lines starting at y
    col(X_QTY, String(it.qty || 0), y, true);
    col(X_PRICE, `₹${fmtMoney(it.price)}`, y, true);
    col(X_AMT, `₹${fmtMoney(it.total)}`, y, true);
    y += rowH * lines;
  });

  lineY(y + 2);
  y += 10;
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const grand = (bill.grandTotal != null ? bill.grandTotal : (subtotal - discount));
  rightText(`Subtotal: ₹${fmtMoney(subtotal)}`, y); y += 6;
  rightText(`Discount: ₹${fmtMoney(discount)}`, y); y += 6;
  doc.setFont('helvetica', 'bold');
  rightText(`Grand Total: ₹${fmtMoney(grand)}`, y);
  doc.setFont('helvetica', 'normal');
  y += 14;
  doc.text('Thanks for shopping with Taheri Fireworks! Visit again.', 14, y);

  const filename = `Invoice_${bill.invoiceNo}.pdf`;
  doc.save(filename);
}
expose('generateBillPDF', generateBillPDF);

// ---------- Bills list page ----------
async function loadBills(){
  const tableBody = document.querySelector('#billsTable tbody');
  if (!tableBody) return;
  const res = await fetch(`${API_BASE}/bills`);
  const bills = await res.json();

  // Attach to window for search
  window.__ALL_BILLS__ = bills;
  renderBillsTable(bills);
}
expose('loadBills', loadBills);

function renderBillsTable(bills){
  const tableBody = document.querySelector('#billsTable tbody');
  if (!tableBody) return;
  const page = window.__BILLS_PAGE__ || 1;
  const pageSize = window.__BILLS_PAGE_SIZE__ || 10;
  const start = (page - 1) * pageSize;
  const slice = bills.slice(start, start + pageSize);
  tableBody.innerHTML = slice.map(b => `
    <tr>
      <td>${b.invoiceNo}</td>
      <td>${new Date(b.date).toLocaleDateString()}</td>
      <td>${b.customerName || 'Walk-in'}</td>
      <td>${b.customerPhone || '-'}</td>
      <td>₹${fmtMoney(b.grandTotal)}</td>
      <td class="actions">
        <button class="btn" onclick='downloadBill(${JSON.stringify(b.invoiceNo)})'>Download</button>
        <button class="btn" onclick='shareBillWhatsApp(${JSON.stringify(b.invoiceNo)})'>WhatsApp</button>
      </td>
    </tr>
  `).join('');
  renderBillsPagination(bills.length, page, pageSize);
}

function renderBillsPagination(total, page, pageSize){
  let pager = document.getElementById('billsPager');
  if (!pager){
    pager = document.createElement('div');
    pager.id = 'billsPager';
    pager.className = 'mt-3 flex items-center justify-between';
    const tableCard = document.querySelector('#billsTable').parentElement;
    tableCard.appendChild(pager);
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btn = (p, label) => `<button class="btn" ${p<1||p>pages? 'disabled':''} onclick="gotoBillsPage(${p})">${label}</button>`;
  pager.innerHTML = `
    <div>
      ${btn(page-1, 'Prev')}
      <span class="small" style="margin:0 8px;">Page ${page} of ${pages}</span>
      ${btn(page+1, 'Next')}
    </div>
    <div>
      <button class="btn" onclick="exportBillsCSV()">Export CSV</button>
    </div>
  `;
}

function gotoBillsPage(p){
  window.__BILLS_PAGE__ = p;
  const bills = window.__FILTERED_BILLS__ || window.__ALL_BILLS__ || [];
  renderBillsTable(bills);
}
expose('gotoBillsPage', gotoBillsPage);

function filterBills(){
  const q = (qs('billsSearch')?.value || '').toLowerCase();
  const bills = (window.__ALL_BILLS__ || []).filter(b => {
    return String(b.invoiceNo).includes(q) ||
           (b.customerName || '').toLowerCase().includes(q) ||
           (b.customerPhone || '').toLowerCase().includes(q);
  });
  window.__FILTERED_BILLS__ = bills;
  window.__BILLS_PAGE__ = 1;
  renderBillsTable(bills);
}
expose('filterBills', filterBills);

function exportBillsCSV(){
  const bills = window.__FILTERED_BILLS__ || window.__ALL_BILLS__ || [];
  const header = ['Invoice','Date','Customer','Phone','Total'];
  const rows = bills.map(b => [b.invoiceNo, new Date(b.date).toLocaleDateString(), b.customerName||'Walk-in', b.customerPhone||'-', b.grandTotal]);
  const csv = [header, ...rows].map(r => r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bills.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
expose('exportBillsCSV', exportBillsCSV);

async function downloadBill(invoiceNo){
  const res = await fetch(`${API_BASE}/bills/${invoiceNo}`);
  if (!res.ok) return alert('Failed to load bill');
  const bill = await res.json();
  await generateBillPDF(bill);
}
expose('downloadBill', downloadBill);

async function shareBillWhatsApp(invoiceNo){
  const res = await fetch(`${API_BASE}/bills/${invoiceNo}`);
  if (!res.ok) return alert('Failed to load bill');
  const bill = await res.json();
  const phone = (bill.customerPhone || '').replace(/\D/g, '');
  if (!phone) return alert('No customer phone number on this bill');
  const link = `${window.location.origin}/invoice/${invoiceNo}`;
  const text = encodeURIComponent(`Thanks for shopping at ${window.FIRM?.name || 'Taheri Fireworks'}! Invoice #${invoiceNo}. Amount: ₹${fmtMoney(bill.grandTotal)}. View: ${link}`);
  const url = `https://wa.me/${phone}?text=${text}`;
  window.open(url, '_blank');
}
expose('shareBillWhatsApp', shareBillWhatsApp);

// ---------- Stock page ----------
async function loadStock() {
  const tableBody = document.querySelector('#stockTable tbody');
  if (!tableBody) return;
  const res = await fetch(`${API_BASE}/products`);
  const products = await res.json();
  tableBody.innerHTML = products.map(p => `
    <tr>
      <td>${p.code}</td>
      <td>${p.name || ''}</td>
      <td><input class="input" type="number" value="${p.price || 0}" style="width:100px" id="price_${p.code}"></td>
      <td><input class="input" type="number" value="${p.stock || 0}" style="width:100px" id="stock_${p.code}"></td>
      <td class="actions">
        <button class="btn" onclick="saveProductUpdate('${p.code}')">Save</button>
        <button class="btn danger" onclick="deleteProduct('${p.code}')">Delete</button>
      </td>
    </tr>
  `).join("");
}
expose('loadStock', loadStock);

async function saveProductUpdate(code) {
  const price = parseFloat(qs(`price_${code}`).value || 0);
  const stock = parseInt(qs(`stock_${code}`).value || 0, 10);
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price, stock })
  });
  if (res.ok) {
    alert('✅ Updated');
  } else {
    const { error } = await res.json().catch(() => ({}));
    alert('❌ Update failed' + (error ? `: ${error}` : ''));
  }
}
expose('saveProductUpdate', saveProductUpdate);

async function deleteProduct(code) {
  if (!confirm(`Delete product ${code}?`)) return;
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`, { method: 'DELETE' });
  if (res.ok) {
    alert('🗑️ Deleted');
    loadStock();
  } else {
    alert('❌ Delete failed');
  }
}
expose('deleteProduct', deleteProduct);

// ---------- Global listeners ----------
window.addEventListener('DOMContentLoaded', () => {
  const discountEl = qs('discount');
  if (discountEl) discountEl.addEventListener('input', () => renderBillTable());
});
