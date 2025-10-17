// Use relative path for API when deployed (works on Render)
const API_BASE = `/api`;

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
    retailPrice: parseFloat(qs("prodRetailPrice")?.value || 0),
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







// ---------- Retail Bill State ----------
let billRetailItems = [];        // All retail bill items live here
let retailBillDiscount = 0;      // Discount entered by user


// ====================================================================
// 1️⃣ addToRetailBill()
// Called when user enters a product code + quantity and clicks "Add"
// ====================================================================
async function addToRetailBill() {
  // Grab product code & quantity from inputs
  let code = qs("productCode")?.value?.trim();
  const qty = parseInt(qs("qty")?.value || 1, 10);

  if (!code) return alert("Enter product code or name");
  if (qty <= 0) return alert("Quantity must be at least 1");

  // 🔹 Try to fetch exact product by code
  let product = null;
  let res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`);
  if (res.ok) {
    product = await res.json();
  } else {
    // 🔹 Fallback: search by query if code not found
    const s = await fetch(`${API_BASE}/products/search/q?q=${encodeURIComponent(code)}`);
    if (s.ok) {
      const options = await s.json();
      if (options.length) product = options[0];
    }
  }

  if (!product) return alert("Product not found");

  // 🔹 Add or update existing item
  //    We ALWAYS store the price we want to use (retail price) in `price`
  const existing = billRetailItems.find(i => i.code === product.code);
  if (existing) {
    // If already in list, just update quantity & total
    existing.qty += qty;
    existing.total = existing.qty * existing.price;    // ✅ use existing.price
  } else {
    // New entry in bill
    billRetailItems.push({
      code: product.code,
      name: product.name,
      qty,
      // ✅ Use the product's RETAIL price, store it as `price`
      price: product.retailPrice,
      total: product.retailPrice * qty
    });
  }

  // Re-render table
  renderRetailBillTable();

  // Clear input fields for next entry
  if (qs("productCode")) qs("productCode").value = "";
  if (qs("qty")) qs("qty").value = 1;
}
expose('addToRetailBill', addToRetailBill);



// ====================================================================
// 2️⃣ renderRetailBillTable()
// Rebuilds the <tbody> of the retail bill table every time
// ====================================================================
function renderRetailBillTable() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;

  // Sort items by code for display
  billRetailItems.sort((a, b) => a.code.localeCompare(b.code));

  // Render rows with serial numbers
  tbody.innerHTML = billRetailItems.map((item, i) => `
    <tr>
      <td>${i + 1}</td> <!-- Serial number -->
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>
        <input class="input" type="number" min="1" value="${item.qty}" style="width:80px"
          onchange="updateRetailItemQty('${item.code}', this.value)" />
      </td>
      <td class="text-right">₹${fmtMoney(item.price)}</td>       <!-- ✅ Retail price -->
      <td class="text-right">₹${fmtMoney(item.total)}</td>
      <td>
        <button class="btn danger" onclick="removeRetailItem('${item.code}')">
          Remove
        </button>
      </td>
    </tr>
  `).join("");

  // Compute subtotal
  const subtotal = billRetailItems.reduce((sum, i) => sum + i.total, 0);
  const subtotalEl = qs("subtotal");
  const discountInput = qs("discount");

  // Capture discount if input exists
  if (discountInput) retailBillDiscount = parseFloat(discountInput.value || 0);
  if (subtotalEl) subtotalEl.textContent = `₹${fmtMoney(subtotal)}`;

  // Compute grand total
  const grand = Math.max(0, subtotal - (retailBillDiscount || 0));
  const gtEl = qs("grandTotal");
  if (gtEl) gtEl.textContent = fmtMoney(grand);
}




// ====================================================================
// 3️⃣ saveRetailBill()
// Called when user clicks "Save Bill" button on the retail bill page
// ====================================================================
async function saveRetailBill() {
  // Grab discount input if present
  const discountInput = qs("discount");
  retailBillDiscount = parseFloat(discountInput?.value || 0);

  if (!billRetailItems.length) return alert("Add at least one product");

  // 🔹 Compute grand total from our items
  const grandTotal = billRetailItems.reduce((s, i) => s + i.total, 0) - (retailBillDiscount || 0);

  // Build payload to send to server
  // We’re explicitly sending item.price (retail) and item.total
  const payload = {
    customerName: qs('customerName')?.value?.trim() || 'Walk-in',
    customerPhone: qs('customerPhone')?.value?.trim() || '',
    items: billRetailItems
      .slice()
      .sort((a, b) =>
        String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' })
      ),
    discount: retailBillDiscount,
    grandTotal: Math.max(0, grandTotal)
  };

  // 🔹 POST the bill to API
  const res = await fetch(`${API_BASE}/bills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return alert("❌ Failed to save bill" + (data.error ? `: ${data.error}` : ""));
  }

  // Show success
  alert(`✅ Bill saved! Invoice No: ${data.invoiceNo}`);

  // 🔹 Optionally auto-generate and download invoice PDF
  try {
    await generateBillPDF(data);
  } catch (e) {
    console.warn('PDF generation failed:', e);
  }

  // 🔹 Optional: open WhatsApp link if phone present (here blank)
  try {
    const cfgRes = await fetch(`${API_BASE}/config`);
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      if (!cfg.twilioWhatsappEnabled && data.customerPhone) {
        const phone = String(data.customerPhone).replace(/\D/g, '');
        const link = `${window.location.origin}/invoice/${data.invoiceNo}`;
        const msg = encodeURIComponent(
          `Thanks for shopping at ${window.FIRM?.name || 'Taheri Fireworks'}! Invoice #${data.invoiceNo}. Amount: ₹${fmtMoney(data.grandTotal)}. View: ${link}`
        );
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      }
    }
  } catch (e) { /* ignore */ }

  // 🔹 Reset state for new bill
  billRetailItems = [];
  renderRetailBillTable();
}
expose('saveRetailBill', saveRetailBill);
















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

function sortBillItems(){
  billItems.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' }));
}

function renderBillTable() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;

  sortBillItems();

  // 🔹 Add index as i, then +1 for serial number
  tbody.innerHTML = billItems.map((item, i) => `
    <tr>
      <td>${i + 1}</td> <!-- Serial number -->
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>
        <input class="input" type="number" min="1" value="${item.qty}" style="width:80px" onchange="updateItemQty('${item.code}', this.value)" />
      </td>
      <td class="text-right">₹${fmtMoney(item.price)}</td>
      <td class="text-right">₹${fmtMoney(item.total)}</td>
      <td><button class="btn danger" onclick="removeItem('${item.code}')">Remove</button></td>
    </tr>
  `).join("");

  // 🧮 subtotal & grand total calculation stays same
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
    items: billItems.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' })),
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












// ---------- PDF Generation (Create Bill page) ----------

async function generateBillPDF(bill) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('jsPDF not loaded');
  const doc = new jsPDF();

  async function loadImageDataURL(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const marginLeft = margin;
  const marginRight = pageWidth - margin;
  const tableWidth = marginRight - marginLeft;

  // Column widths
  const colWidths = [12, 25, 55, 20, 35, 33]; // S.No, Code, Item, Qty, Price, Amount
  let xPositions = [];
  let x = marginLeft;
  for (let w of colWidths) {
    xPositions.push(x);
    x += w;
  }

  const [X_SN, X_CODE, X_NAME, X_QTY, X_PRICE, X_AMT] = xPositions;

  const rightText = (text, y) =>
    doc.text(text, marginRight, y, { align: 'right' });

  // Outer border
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin);

  // Logo
  const firm = window.FIRM || {};
  const logoDataUrl = await loadImageDataURL(firm.logoSrc);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginLeft, margin, 24, 24);
    } catch {}
  }

  // Firm name and info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(firm.name || 'Taheri Fireworks', pageWidth / 2, margin + 14, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const addr = (firm.addressLines || []).join(', ');
  if (addr)
    doc.text(addr, pageWidth / 2, margin + 20, { align: 'center' });

  const contactLine = [firm.phone, firm.email].filter(Boolean).join(' • ');
  if (contactLine)
    doc.text(contactLine, pageWidth / 2, margin + 26, { align: 'center' });

  if (firm.gstin)
    doc.text(`GSTIN: ${firm.gstin}`, pageWidth / 2, margin + 32, {
      align: 'center',
    });

  doc.line(marginLeft, margin + 38, marginRight, margin + 38);

  // Invoice meta info
  doc.setFontSize(11);
  const metaY = margin + 50;
  doc.text(`Invoice #: ${bill.invoiceNo}`, marginLeft, metaY);
  rightText(`Date: ${new Date(bill.date || Date.now()).toLocaleDateString()}`, metaY);

  doc.text(`Customer: ${bill.customerName || 'Walk-in'}`, marginLeft, metaY + 8);
  doc.text(`Phone: ${bill.customerPhone || '-'}`, marginLeft, metaY + 16);

  // Table header
  const headerHeight = 10;
  let y = metaY + 35;

  function drawHeader() {
    // Grey background covering full table width
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, y, tableWidth, headerHeight, 'F');

    // Column borders
    doc.setDrawColor(0);
    let curX = marginLeft;
    for (let w of colWidths) {
      doc.rect(curX, y, w, headerHeight);
      curX += w;
    }

    // Center headings
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    doc.text('S.No', X_SN + colWidths[0] / 2, y + 7, { align: 'center' });
    doc.text('Code', X_CODE + colWidths[1] / 2, y + 7, { align: 'center' });
    doc.text('Item', X_NAME + colWidths[2] / 2, y + 7, { align: 'center' });
    doc.text('Qty', X_QTY + colWidths[3] / 2, y + 7, { align: 'center' });
    doc.text('Price', X_PRICE + colWidths[4] / 2, y + 7, { align: 'center' });
    doc.text('Amount', X_AMT + colWidths[5] / 2, y + 7, { align: 'center' });

    y += headerHeight;
  }

  drawHeader();

  // Table rows
  const items = bill.items || [];
  const lineHeight = 7;

  items.forEach((item, idx) => {
    const nameLines = doc.splitTextToSize(
      String(item.name || ''),
      colWidths[2] - 4
    );
    const rowHeight = nameLines.length * lineHeight;

    // Page break
    if (y + rowHeight + margin > pageHeight) {
      doc.addPage();
      doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin);
      y = margin + 20;
      drawHeader();
    }

    let curX = marginLeft;
    for (let w of colWidths) {
      doc.rect(curX, y, w, rowHeight);
      curX += w;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Center each cell’s content
    doc.text(String(idx + 1), X_SN + colWidths[0] / 2, y + 5, { align: 'center' });
    doc.text(String(item.code || ''), X_CODE + colWidths[1] / 2, y + 5, { align: 'center' });
    doc.text(nameLines, X_NAME + colWidths[2] / 2, y + 5, { align: 'center' });
    doc.text(String(item.qty || 0), X_QTY + colWidths[3] / 2, y + 5, { align: 'center' });

    doc.setFont('courier', 'normal'); // for numbers
    doc.setFontSize(9);
    doc.text(fmtMoney(item.price), X_PRICE + colWidths[4] / 2, y + 5, { align: 'center' });
    doc.text(fmtMoney(item.total), X_AMT + colWidths[5] / 2, y + 5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    y += rowHeight;
  });

  y += 10;

  // Totals
  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const grandTotal = bill.grandTotal != null ? bill.grandTotal : subtotal - discount;

  // Totals box
  const boxWidth = 110;
  const boxHeight = 24;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = y;
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.setFillColor(250, 250, 250);
  doc.rect(boxX, boxY, boxWidth, boxHeight, 'FD');

  // Totals text inside box
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const linePad = 7;
  const textX = boxX + 8;
  let textY = boxY + linePad;

  doc.text(`Subtotal`, textX, textY);
  doc.text(fmtMoney(subtotal), boxX + boxWidth - 8, textY, { align: 'right' });

  textY += linePad;
  doc.text(`Discount`, textX, textY);
  doc.text(fmtMoney(discount), boxX + boxWidth - 8, textY, { align: 'right' });

  textY += linePad;
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total`, textX, textY);
  doc.text(fmtMoney(grandTotal), boxX + boxWidth - 8, textY, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  y += boxHeight + 8;

  // Footer
  doc.text(
    'Thank you for shopping with Taheri Fireworks! Visit again.',
    marginLeft,
    y
  );

  doc.save(`Invoice_${bill.invoiceNo}.pdf`);
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
      <td class="text-right">₹${fmtMoney(b.grandTotal)}</td>
      <td class="actions-cell">
        <button class="btn" onclick='editBill(${JSON.stringify(b.invoiceNo)})'>Edit</button>
        <button class="btn danger" onclick='deleteBill(${JSON.stringify(b.invoiceNo)})'>Delete</button>
        <button class="btn" onclick='downloadBill(${JSON.stringify(b.invoiceNo)})'>Download</button>
        <button class="btn" onclick='serverSendWhatsapp(${JSON.stringify(b.invoiceNo)})'>Send on whatsapp</button>
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
async function serverSendWhatsapp(invoiceNo){
  if (!confirm(`Send invoice #${invoiceNo} on WhatsApp (PDF) to the stored customer number?`)) return;
  // Disable matching buttons to avoid double-click
  const btns = Array.from(document.querySelectorAll("button")).filter(b => b.textContent && b.textContent.trim().toLowerCase().includes('send on whatsapp') && b.onclick == null);
  // show a quick spinner state on the clicked button
  const clicked = event?.target || null;
  const targetBtn = clicked && clicked.tagName === 'BUTTON' ? clicked : null;
  if (targetBtn) {
    targetBtn.disabled = true;
    const orig = targetBtn.textContent;
    targetBtn.textContent = 'Sending...';
  }
  try {
    const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(invoiceNo)}/send-whatsapp-pdf`, { method: 'POST' });
    if (res.ok) {
      toast('WhatsApp PDF sent (server requested)');
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast('Failed to send WhatsApp: ' + (error || 'Server error'), true);
    }
  } catch (e) {
    toast('Failed to send WhatsApp: ' + (e.message || e), true);
  } finally {
    if (targetBtn) { targetBtn.disabled = false; targetBtn.textContent = 'Send on whatsapp'; }
  }
}
expose('serverSendWhatsapp', serverSendWhatsapp);

// Tiny toast notification helper
function toast(msg, isError){
  let container = document.getElementById('tfw-toast-container');
  if (!container){
    container = document.createElement('div');
    container.id = 'tfw-toast-container';
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.top = '20px';
    container.style.zIndex = 9999;
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.background = isError ? '#ff5252' : '#22c55e';
  el.style.color = '#fff';
  el.style.padding = '10px 14px';
  el.style.marginTop = '8px';
  el.style.borderRadius = '8px';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

// Edit bill: navigate to create-bill with invoice param
function editBill(invoiceNo){
  window.location.href = `create-bill.html?invoice=${encodeURIComponent(invoiceNo)}`;
}
// Edit bill: classify and route to retail or wholesale create page
async function editBill(invoiceNo){
  try {
    const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(invoiceNo)}/classify`);
    if (res.ok){
      const { type } = await res.json();
      if (type === 'retail') {
        window.location.href = `create-bill-retail.html?invoice=${encodeURIComponent(invoiceNo)}`;
        return;
      }
    }
  } catch (e) { /* ignore and fallback */ }
  // default to wholesale editor
  window.location.href = `create-bill.html?invoice=${encodeURIComponent(invoiceNo)}`;
}
expose('editBill', editBill);

// Delete bill
async function deleteBill(invoiceNo){
  if (!confirm(`Delete bill #${invoiceNo}? This will restore stock.`)) return;
  const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(invoiceNo)}`, { method: 'DELETE' });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return alert('❌ Delete failed' + (error ? `: ${error}` : ''));
  }
  alert('🗑️ Bill deleted');
  if (typeof loadBills === 'function') loadBills();
}
expose('deleteBill', deleteBill);

// ---------- Stock page ----------
async function loadStock() {
  const tableBody = document.querySelector('#stockTable tbody');
  if (!tableBody) return;
  const res = await fetch(`${API_BASE}/products`);
  const products = await res.json();
products.sort((a, b) => Number(a.code) - Number(b.code));

  tableBody.innerHTML = products.map(p => `
    <tr>
      <td>${p.code}</td>
      <td>${p.name || ''}</td>
      <td><input class="input" type="number" value="${p.price || 0}" style="width:100px" id="price_${p.code}"></td>
     <td><input class="input" type="number" value="${p.retailPrice || 0}" style="width:100px" id="retailPrice_${p.code}"></td>
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
  // const name = qs(`name_${code}`).value.trim();
  const price = parseFloat(qs(`price_${code}`).value || 0);
  const retailPrice = parseFloat(qs(`retailPrice_${code}`).value || 0);
  const stock = parseInt(qs(`stock_${code}`).value || 0, 10);
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({  price, retailPrice, stock })
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
// Landing page: 3-up carousel
function initLandingPage(){
  const left = document.getElementById('hero-img-left');
  const center = document.getElementById('hero-img-center');
  const right = document.getElementById('hero-img-right');
  if (!left || !center || !right) return; // not on landing
  const IMAGES = [
    'https://images.unsplash.com/photo-1430417934865-589b63ad5c00?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1430931071372-38127bd472b8?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540151812223-c30b3fab58e2?q=80&w=1400&auto=format&fit=crop'
  ];
  let idx = 1;
  function render(){
    const L = (idx - 1 + IMAGES.length) % IMAGES.length;
    const C = idx % IMAGES.length;
    const R = (idx + 1) % IMAGES.length;
    left.src = IMAGES[L];
    center.src = IMAGES[C];
    right.src = IMAGES[R];
  }
  render();
  setInterval(() => { idx = (idx + 1) % IMAGES.length; render(); }, 3500);
}

// Create-bill page: edit mode support
async function initCreateBillPage(){
  const url = new URL(window.location.href);
  const inv = url.searchParams.get('invoice');
  if (!inv) return; // new bill mode
  window.__EDIT_INVOICE_NO__ = inv;
  // Load bill and populate UI
  const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(inv)}`);
  if (!res.ok) return alert('Failed to load bill for editing');
  const bill = await res.json();
  // Determine whether we are on retail or wholesale page by pathname
  const isRetailPage = window.location.pathname.endsWith('create-bill-retail.html');
  if (isRetailPage) {
    qs('customerName').value = bill.customerName || 'Walk-in';
    qs('customerPhone').value = bill.customerPhone || '';
    billRetailItems = (bill.items || []).map(i => ({ code: i.code, name: i.name, qty: i.qty, price: i.price, total: i.total }));
    const discountEl = qs('discount');
    if (discountEl) discountEl.value = bill.discount || 0;
    renderRetailBillTable();
    // Update the save button to "Update Bill"
    const saveBtn = document.querySelector('button.btn.primary[onclick="saveRetailBill()"]');
    if (saveBtn) { saveBtn.textContent = 'Update Bill'; saveBtn.setAttribute('onclick', 'updateRetailBill()'); }
  } else {
    qs('customerName').value = bill.customerName || 'Walk-in';
    qs('customerPhone').value = bill.customerPhone || '';
    billItems = (bill.items || []).map(i => ({ code: i.code, name: i.name, qty: i.qty, price: i.price, total: i.total }));
    const discountEl = qs('discount');
    if (discountEl) discountEl.value = bill.discount || 0;
    renderBillTable();
    // Update the save button to "Update Bill"
    const saveBtn = document.querySelector('button.btn.primary[onclick="saveBill()"]');
    if (saveBtn) { saveBtn.textContent = 'Update Bill'; saveBtn.setAttribute('onclick', 'updateBill()'); }
  }
}
expose('initCreateBillPage', initCreateBillPage);

async function updateRetailBill(){
  const inv = window.__EDIT_INVOICE_NO__;
  if (!inv) return;
  const customerName = qs("customerName")?.value?.trim() || "Walk-in";
  const customerPhone = qs("customerPhone")?.value?.trim() || "";
  const discountInput = qs("discount");
  retailBillDiscount = parseFloat(discountInput?.value || 0);
  if (!billRetailItems.length) return alert('Add at least one product');
  const grandTotal = billRetailItems.reduce((s, i) => s + i.total, 0) - (retailBillDiscount || 0);
  const payload = {
    customerName,
    customerPhone,
    items: billRetailItems.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' })),
    discount: retailBillDiscount,
    grandTotal: Math.max(0, grandTotal)
  };
  const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(inv)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert('❌ Update failed' + (data.error ? `: ${data.error}` : ''));
  alert('✅ Bill updated');
  window.location.href = 'bills.html';
}
expose('updateRetailBill', updateRetailBill);

async function updateBill(){
  const inv = window.__EDIT_INVOICE_NO__;
  if (!inv) return;
  const customerName = qs("customerName")?.value?.trim() || "Walk-in";
  const customerPhone = qs("customerPhone")?.value?.trim() || "";
  const discountInput = qs("discount");
  billDiscount = parseFloat(discountInput?.value || 0);
  if (!billItems.length) return alert('Add at least one product');
  const grandTotal = billItems.reduce((s, i) => s + i.total, 0) - (billDiscount || 0);
  const payload = {
    customerName,
    customerPhone,
    items: billItems.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' })),
    discount: billDiscount,
    grandTotal: Math.max(0, grandTotal)
  };
  const res = await fetch(`${API_BASE}/bills/${encodeURIComponent(inv)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert('❌ Update failed' + (data.error ? `: ${data.error}` : ''));
  alert('✅ Bill updated');
  window.location.href = 'bills.html';
}
expose('updateBill', updateBill);

window.addEventListener('DOMContentLoaded', () => {
  const discountEl = qs('discount');
  if (discountEl) discountEl.addEventListener('input', () => renderBillTable());
  initLandingPage();
  initCreateBillPage();
});
