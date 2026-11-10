const products = [];
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("urbanthread_cart") || "[]");

const productsGrid = document.getElementById("productsGrid");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const productModal = document.getElementById("productModal");
const modalBody = document.getElementById("modalBody");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutModal = document.getElementById("checkoutModal");
const closeCheckoutModal = document.getElementById("closeCheckoutModal");
const checkoutForm = document.getElementById("checkoutForm");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.querySelector(".theme-icon");

function formatPrice(value) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function getProductImage(product) {
  if (!product.image) {
    return "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80";
  }

  if (product.image.startsWith("/uploads/")) {
    return product.image;
  }

  return product.image;
}

function saveCart() {
  localStorage.setItem("urbanthread_cart", JSON.stringify(cart));
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("urbanthread-theme", theme);

  if (theme === "light") {
    themeIcon.textContent = "🌙";
  } else {
    themeIcon.textContent = "☀️";
  }
}

const savedTheme = localStorage.getItem("urbanthread-theme") || "dark";
applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(currentTheme);
  });
}

function renderProducts() {
  productsGrid.innerHTML = "";

  filteredProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const priceText = formatPrice(product.price);
    const oldPriceText =
      product.old_price && Number(product.old_price) > Number(product.price)
        ? formatPrice(product.old_price)
        : "";

    const offerText = product.offer_text
      ? `<div class="offer-pill">${product.offer_text}</div>`
      : "";

    card.innerHTML = `
      <div class="product-image" style="background-image:url('${getProductImage(product)}')">
        <span class="product-badge">${product.badge || "New"}</span>
        <button class="favorite-btn" aria-label="Favorite">♡</button>
      </div>

      <div class="product-body">
        <div class="product-topline">
          <div>
            <div class="product-category">${product.category}</div>
            <h3 class="product-name">${product.name}</h3>
          </div>
          <div class="price-block">
            <div class="product-price">${priceText}</div>
            ${oldPriceText ? `<div class="old-price">${oldPriceText}</div>` : ""}
          </div>
        </div>

        <div class="product-meta">
          <span class="rating">★ ${product.rating || 4.8}</span>
          <span>${product.status || "In stock"}</span>
        </div>

        ${offerText}

        <p class="product-desc">${product.description}</p>

        <div class="product-sku">
          <span>Public SKU</span>
          <span class="sku-value">${product.public_sku}</span>
        </div>

        <div class="product-sku">
          <span>Internal SKU</span>
          <span class="sku-value">${product.internal_sku}</span>
        </div>

        <div class="product-actions">
          <button class="btn btn-secondary view-btn" data-id="${product.id}">View</button>
          <button class="btn btn-primary add-to-cart" data-id="${product.id}">Add to cart</button>
        </div>
      </div>
    `;

    productsGrid.appendChild(card);
  });
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    const data = await response.json();

    products.splice(0, products.length, ...data);
    filteredProducts = [...products];
    renderProducts();
  } catch (error) {
    console.error("Failed to load products:", error);
  }
}

function renderCart() {
  cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);

  if (cart.length === 0) {
    cartItems.innerHTML = `<div class="small-muted" style="padding: 18px 0;">Your cart is empty.</div>`;
    subtotalEl.textContent = "₹0";
    totalEl.textContent = "₹0";
    return;
  }

  cartItems.innerHTML = "";

  cart.forEach((item) => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";

    cartItem.innerHTML = `
      <div class="cart-thumb" style="background-image:url('${getProductImage(item)}')"></div>
      <div>
        <h4>${item.name}</h4>
        <div class="small-muted">${item.public_sku}</div>
        <div class="price-row">
          <div class="qty">
            <button class="qty-minus" data-id="${item.id}">−</button>
            <span>${item.qty}</span>
            <button class="qty-plus" data-id="${item.id}">+</button>
          </div>
          <strong>${formatPrice(item.price * item.qty)}</strong>
        </div>
      </div>
    `;

    cartItems.appendChild(cartItem);
  });

  document.querySelectorAll(".qty-minus").forEach((btn) => {
    btn.addEventListener("click", () => updateCartItem(Number(btn.dataset.id), -1));
  });

  document.querySelectorAll(".qty-plus").forEach((btn) => {
    btn.addEventListener("click", () => updateCartItem(Number(btn.dataset.id), 1));
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  subtotalEl.textContent = formatPrice(subtotal);
  totalEl.textContent = formatPrice(subtotal);
}

function saveAndRenderCart() {
  saveCart();
  renderCart();
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const existingItem = cart.find((item) => item.id === productId);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  saveAndRenderCart();
}

function updateCartItem(productId, delta) {
  const existingItem = cart.find((item) => item.id === productId);
  if (!existingItem) return;

  existingItem.qty += delta;

  if (existingItem.qty <= 0) {
    cart = cart.filter((item) => item.id !== productId);
  }

  saveAndRenderCart();
}

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
}

function openProductModal(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  modalBody.innerHTML = `
    <div class="modal-image" style="background-image:url('${getProductImage(product)}')"></div>
    <div class="modal-details">
      <div class="modal-category">${product.category}</div>
      <h3>${product.name}</h3>
      <div class="modal-price">${formatPrice(product.price)}</div>
      ${
        product.old_price && Number(product.old_price) > Number(product.price)
          ? `
        <div class="small-muted" style="text-decoration: line-through; font-size:1.2rem; margin-top:8px;">
          ${formatPrice(product.old_price)}
        </div>
      `
          : ""
      }
      ${
        product.offer_text
          ? `<div class="offer-pill" style="margin-top:12px;">${product.offer_text}</div>`
          : ""
      }

      <p class="modal-desc">${product.description}</p>

      <div class="modal-sku-group">
        <div class="modal-sku-row">
          <span>Public SKU</span>
          <strong>${product.public_sku}</strong>
        </div>
        <div class="modal-sku-row">
          <span>Internal SKU</span>
          <strong>${product.internal_sku}</strong>
        </div>
        <div class="modal-sku-row">
          <span>Availability</span>
          <strong>${product.status || "In stock"}</strong>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary add-to-cart" data-id="${product.id}">Add to Cart</button>
        <button class="btn btn-secondary" onclick="closeModal()">Continue Shopping</button>
      </div>
    </div>
  `;

  productModal.classList.add("show");
}

function closeModal() {
  productModal.classList.remove("show");
}

function initStoreFilters() {
  const filters = document.querySelectorAll(".chip");
  filters.forEach((chip) => {
    chip.addEventListener("click", () => {
      filters.forEach((item) => item.classList.remove("active"));
      chip.classList.add("active");

      const value = chip.dataset.filter;

      if (value === "all") {
        filteredProducts = [...products];
      } else {
        filteredProducts = products.filter((product) => product.category === value);
      }

      renderProducts();
    });
  });
}

async function openCheckoutModal() {
  if (cart.length === 0) { alert("Your cart is empty."); return; }
  checkoutModal.classList.add("show");
}
function closeCheckout() { checkoutModal.classList.remove("show"); }
checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = checkoutForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const form = new FormData(checkoutForm);
    const customer = {
      name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
      address: [form.get("house"),form.get("area"),form.get("landmark")?`Landmark: ${form.get("landmark")}`:"",`${form.get("city")}, ${form.get("state")}`,`Pincode: ${form.get("pincode")}`].filter(Boolean).join(", ")
    };
    const response = await fetch("/api/orders", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer,items:cart.map(i=>({id:i.id,qty:i.qty}))})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to place order.");
    alert(`Order placed! Order number: ${data.orderNumber}\nTotal: ${formatPrice(data.total)}\nOur team will contact you to confirm payment and delivery.`);
    cart=[];saveCart();renderCart();closeCart();closeCheckout();checkoutForm.reset();
  } catch (error) { alert(error.message || "Order could not be placed."); }
  finally { submit.disabled = false; }
});

document.addEventListener("click", (event) => {
  const addButton = event.target.closest(".add-to-cart");
  const viewButton = event.target.closest(".view-btn");

  if (addButton) {
    const productId = Number(addButton.dataset.id);
    addToCart(productId);
  }

  if (viewButton) {
    const productId = Number(viewButton.dataset.id);
    openProductModal(productId);
  }

  if (event.target.closest("#cartButton")) {
    openCart();
  }

  if (event.target.closest("#closeCart") || event.target.closest("#overlay")) {
    closeCart();
  }

  if (event.target.closest("#closeModal")) {
    closeModal();
  }

  if (event.target.closest("#closeCheckoutModal")) {
    closeCheckout();
  }

  if (event.target.closest(".favorite-btn")) {
    event.target.textContent = event.target.textContent === "♡" ? "♥" : "♡";
  }

  if (event.target.closest("#checkoutBtn")) {
    openCheckoutModal();
  }
});

document.getElementById("shopNowBtn").addEventListener("click", () => {
  document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
});

initStoreFilters();
loadProducts();
renderCart();