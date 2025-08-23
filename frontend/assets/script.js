const API_BASE = `${window.location.origin}/api`;

// ---------- Helpers ----------
function qs(id) { return document.getElementById(id); }
function show(el, visible) { if (el) el.style.display = visible ? 'block' : 'none'; }

// ---------- Modal: Add Product (Home page) ----------
function openAddProductModal() { show(qs("productModal"), true); }
function closeAddProductModal() { show(qs("productModal"), false); }

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

// ---------- Create Bill page ----------
let billItems = [];

async function addToBill() {
  const code = qs("productCode")?.value?.trim();
  const qty = parseInt(qs("qty")?.value || 1, 10);
  if (!code) return alert("Enter product code");
  if (qty <= 0) return alert("Quantity must be at least 1");

  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`);
  if (!res.ok) {
    return alert("Product not found");
  }
  const product = await res.json();

  // Check if already added; update qty
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
  qs("productCode").value = "";
  qs("qty").value = 1;
}

function renderBillTable() {
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;
  tbody.innerHTML = billItems.map(item => `
    <tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>
        <input type="number" min="1" value="${item.qty}" style="width:60px" onchange="updateItemQty('${item.code}', this.value)" />
      </td>
      <td>${item.price}</td>
      <td>${item.total}</td>
    </tr>
  `).join("");

  const grandTotal = billItems.reduce((sum, i) => sum + i.total, 0);
  const gtEl = qs("grandTotal");
  if (gtEl) gtEl.textContent = grandTotal.toFixed(2);
}

function updateItemQty(code, newQty) {
  newQty = parseInt(newQty, 10);
  const item = billItems.find(i => i.code === code);
  if (!item) return;
  item.qty = Math.max(1, newQty || 1);
  item.total = item.qty * item.price;
  renderBillTable();
}

async function saveBill() {
  const customerName = qs("customerName")?.value?.trim() || "Walk-in";
  const customerPhone = qs("customerPhone")?.value?.trim() || "";
  if (!billItems.length) return alert("Add at least one product");

  const payload = {
    customerName,
    customerPhone,
    items: billItems,
    discount: 0,
    grandTotal: billItems.reduce((s, i) => s + i.total, 0)
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
  billItems = [];
  renderBillTable();
}

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
      <td><input type="number" value="${p.price || 0}" style="width:80px" id="price_${p.code}"></td>
      <td><input type="number" value="${p.stock || 0}" style="width:80px" id="stock_${p.code}"></td>
      <td>
        <button onclick="saveProductUpdate('${p.code}')">Save</button>
        <button onclick="deleteProduct('${p.code}')" style="background:#b00020;color:#fff;">Delete</button>
      </td>
    </tr>
  `).join("");
}

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
