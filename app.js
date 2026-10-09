(() => {
  "use strict";

  const CONFIG = window.CHINU_CONFIG || {};
  const API_BASE = String(CONFIG.apiBaseUrl || "").replace(/\/+$/, "");
  const ONLINE_PAYMENTS = Boolean(CONFIG.onlinePayments && API_BASE);
  const STATUS_STEPS = ["Pending", "Accepted", "Preparing", "Ready", "Served"];
  const params = new URLSearchParams(window.location.search);
  const tableId = (params.get("table") || params.get("tableId") || params.get("t") || "").trim().slice(0, 40);
  const storageScope = encodeURIComponent(tableId || "web");
  const CART_STORAGE_KEY = `chinu-cart:${storageScope}`;
  const ORDER_STORAGE_KEY = `chinu-order:${storageScope}`;
  // Approved dish names from the restaurant banners (same list as ai-assistant/data/restaurant-knowledge-base.json).
  // Veg Thali Rs 100 is printed on the banner; other prices are team estimates until the restaurant confirms.
  const MENU_SEED = [
    { id: "chicken-biryani", name: "Chicken Biryani", description: "Rice biryani cooked with chicken pieces.", price: 160, category: "Biryani", tag: "", imageUrl: "assets/menu/chicken-biryani.jpg", available: true },
    { id: "mutton-biryani", name: "Mutton Biryani", description: "Rice biryani cooked with mutton pieces.", price: 240, category: "Biryani", tag: "", imageUrl: "assets/menu/mutton-biryani.jpg", available: true },
    { id: "egg-biryani", name: "Egg Biryani", description: "Rice biryani served with boiled eggs.", price: 120, category: "Biryani", tag: "", imageUrl: "assets/menu/egg-biryani.jpg", available: true },
    { id: "special-biryani", name: "Special Biryani", description: "The house special biryani. Ask staff for today's details.", price: 200, category: "Biryani", tag: "House special", imageUrl: "assets/menu/special-biryani.jpg", available: true },
    { id: "chicken-roast", name: "Chicken Roast", description: "Roasted chicken pieces.", price: 200, category: "Chicken", tag: "", imageUrl: "assets/menu/chicken-roast.jpg", available: true },
    { id: "chicken-fry", name: "Chicken Fry", description: "Fried chicken, dhaba style.", price: 180, category: "Chicken", tag: "", imageUrl: "assets/menu/chicken-fry.jpg", available: true },
    { id: "chicken-handi", name: "Chicken Handi", description: "Chicken curry served in a handi (clay pot). Goes well with roti.", price: 240, category: "Chicken", tag: "", imageUrl: "assets/menu/chicken-handi.jpg", available: true },
    { id: "mutton-handi", name: "Mutton Handi", description: "Mutton curry served in a handi (clay pot). Goes well with roti.", price: 320, category: "Mutton", tag: "", imageUrl: "assets/menu/mutton-handi.jpg", available: true },
    { id: "mutton-korma", name: "Mutton Korma", description: "Mutton cooked in a thick korma gravy.", price: 300, category: "Mutton", tag: "", imageUrl: "assets/menu/mutton-korma.jpg", available: true },
    { id: "mutton-paya-korma", name: "Mutton Paya Korma", description: "Korma made with mutton paya (trotters).", price: 260, category: "Mutton", tag: "", imageUrl: "assets/menu/mutton-paya-korma.jpg", available: true },
    { id: "special-chicken-mutton-korma", name: "Special Chicken & Mutton Korma", description: "House special korma with both chicken and mutton.", price: 350, category: "Mutton", tag: "House special", imageUrl: "assets/menu/special-chicken-mutton-korma.jpg", available: true },
    { id: "fish-roast", name: "Fish Roast", description: "Roasted whole fish served with lemon.", price: 220, category: "Fish", tag: "", imageUrl: "assets/menu/fish-roast.jpg", available: true },
    { id: "special-thali", name: "Special Thali", description: "Full non-veg thali with curry, rice, roti and sides. Ask staff for today's thali items.", price: 200, category: "Thali", tag: "House special", imageUrl: "assets/menu/special-thali.jpg", available: true },
    { id: "veg-thali", name: "Veg Thali", description: "Vegetarian thali with sabzi, dal, rice and roti.", price: 100, category: "Thali", tag: "Vegetarian", imageUrl: "assets/menu/veg-thali.jpg", available: true },
    { id: "jowar-roti", name: "Jowar Roti", description: "Roti made from jowar (sorghum) flour.", price: 20, category: "Roti", tag: "Vegetarian", imageUrl: "assets/menu/jowar-roti.jpg", available: true },
    { id: "bajra-roti", name: "Bajra Roti", description: "Roti made from bajra (pearl millet) flour.", price: 20, category: "Roti", tag: "Vegetarian", imageUrl: "assets/menu/bajra-roti.jpg", available: true },
    { id: "makka-roti", name: "Makka Roti", description: "Roti made from makka (maize) flour.", price: 25, category: "Roti", tag: "Vegetarian", imageUrl: "assets/menu/makka-roti.jpg", available: true }
  ];
  const state = {
    menu: [],
    category: "All",
    cart: normalizeStoredCart(readStorage(CART_STORAGE_KEY, {})),
    order: normalizeStoredOrder(readStorage(ORDER_STORAGE_KEY, null)),
    demoOrders: normalizeDemoOrders(readStorage("chinu-demo-orders", [])),
    selectedItem: null,
    selectedQuantity: 0,
    originalSelectedQuantity: 0,
    pollTimer: null,
    toastTimer: null,
    // Live mode: "checking" | "ok" | "none" (no QR table) | "invalid" | "inactive" | "unchecked" (server unreachable)
    tableStatus: API_BASE ? "checking" : "ok"
  };

  // Orders are taken per table, so in live mode they need a valid table from the QR code.
  const ORDERING_BLOCKED = {
    none: "Please scan the QR code on your table to order. You can still browse the menu.",
    invalid: `Table ${tableId} isn’t recognised. Please scan the QR code on your table again or ask our staff.`,
    inactive: `Table ${tableId} isn’t taking orders right now. Please ask our staff.`
  };

  const $ = (selector) => document.querySelector(selector);
  const menuGrid = $("#menu-grid");
  const categoryTabs = $("#category-tabs");
  const menuNotice = $("#menu-notice");
  const drawer = $("#cart-drawer");
  const backdrop = $("#drawer-backdrop");
  const checkoutDialog = $("#checkout-dialog");
  const staffDialog = $("#staff-dialog");
  const themeToggle = $("#theme-toggle");
  const THEME_STORAGE_KEY = "chinu-theme";
  const THEME_COLORS = { dark: "#171311", light: "#fbf6f0" };

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const label = `Switch to ${next === "light" ? "dark" : "light"} mode`;
    themeToggle.setAttribute("aria-pressed", String(next === "light"));
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[next]);
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
      console.warn("Could not save your theme choice.", error);
    }
    showToast(next === "light" ? "Light mode on." : "Dark mode on.");
  }

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Could not read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function normalizeStoredCart(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([id, line]) => {
      const quantity = Number(line && line.quantity);
      const item = line && line.item;
      if (!item || String(item.id) !== id || !String(item.name || "").trim() ||
          !Number.isFinite(Number(item.price)) || Number(item.price) < 0 ||
          !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return [];
      return [[id, {
        item: {
          id,
          name: String(item.name),
          price: Number(item.price),
          imageUrl: String(item.imageUrl || ""),
          available: item.available !== false
        },
        quantity,
        unavailable: Boolean(line.unavailable)
      }]];
    }));
  }

  function normalizeStoredOrder(value) {
    if (!value || typeof value !== "object" || !value.orderId || !Array.isArray(value.items)) return null;
    const total = value.total == null ? null : Number(value.total);
    if (total !== null && (!Number.isFinite(total) || total < 0)) return null;
    const items = value.items.filter((item) =>
      item && String(item.name || "").trim() &&
      Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0
    ).map((item) => ({
      id: String(item.id || ""),
      name: String(item.name),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      quantity: Number(item.quantity)
    }));
    return {
      ...value,
      orderId: String(value.orderId),
      status: currentOrderStatus(value.status),
      total,
      items,
      paymentStatus: String(value.paymentStatus || "counter")
    };
  }

  function normalizeDemoOrders(value) {
    return Array.isArray(value)
      ? value.map(normalizeStoredOrder).filter(Boolean)
      : [];
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key} to local storage.`, error);
      return false;
    }
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3600);
  }

  function setNotice(message, isError) {
    menuNotice.textContent = message;
    menuNotice.classList.toggle("error", Boolean(isError));
    menuNotice.hidden = !message;
  }

  async function apiRequest(path, options) {
    if (!API_BASE) throw new Error("The restaurant API is not configured.");
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(options && options.body ? { "Content-Type": "application/json" } : {}),
          ...((options && options.headers) || {})
        }
      });
    } catch (error) {
      throw new Error("We couldn’t reach the restaurant server. Check your connection and try again.");
    }
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        throw new Error("The restaurant server returned an unreadable response.");
      }
    }
    if (!response.ok) {
      const message = data && (data.message || data.error);
      throw new Error(message || `The request could not be completed (HTTP ${response.status}).`);
    }
    return data;
  }

  function normalizeMenuResponse(data) {
    const rows = Array.isArray(data) ? data : data && data.items;
    if (!Array.isArray(rows)) throw new Error("The menu response did not contain an items list.");
    return rows.map((item, index) => {
      if (!item) throw new Error(`Menu item ${index + 1} is invalid.`);
      const price = item.price === null || item.price === "" ? NaN : Number(item.price);
      if (item.id == null || !String(item.name || "").trim() || !Number.isFinite(price) || price < 0) {
        throw new Error(`Menu item ${index + 1} is missing a valid id, name, or price.`);
      }
      return {
        id: String(item.id),
        name: String(item.name),
        description: String(item.description || ""),
        price,
        category: String(item.category || "Other"),
        tag: String(item.tag || ""),
        imageUrl: String(item.imageUrl || item.image || ""),
        available: item.available !== false
      };
    });
  }

  async function loadMenu() {
    menuGrid.innerHTML = '<div class="menu-state"><p>Bringing the good stuff to your table…</p></div>';
    $("#menu-note").textContent = API_BASE ? "Live menu" : "Sample menu · demo mode";
    try {
      state.menu = API_BASE
        ? normalizeMenuResponse(await apiRequest("/api/menu", { method: "GET" }))
        : MENU_SEED;
      reconcileCartToMenu();
      setNotice("", false);
      renderCategories();
      renderMenu();
      renderCart();
    } catch (error) {
      state.menu = [];
      categoryTabs.replaceChildren();
      menuGrid.innerHTML = "";
      const box = document.createElement("div");
      box.className = "menu-state";
      const heading = document.createElement("h3");
      heading.textContent = "The menu isn’t available right now.";
      const text = document.createElement("p");
      text.textContent = error.message;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Try again";
      retry.addEventListener("click", loadMenu);
      box.append(heading, text, retry);
      menuGrid.append(box);
      setNotice(API_BASE ? "The live menu could not be loaded. Please try again shortly." : "", true);
    }
  }

  function renderCategories() {
    const categories = ["All", ...new Set(state.menu.map((item) => item.category))];
    categoryTabs.replaceChildren();
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-tab${category === state.category ? " active" : ""}`;
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === state.category));
      button.addEventListener("click", () => {
        state.category = category;
        renderCategories();
        renderMenu();
      });
      categoryTabs.append(button);
    });
  }

  function createMenuCard(item) {
    const article = document.createElement("article");
    article.className = "menu-card";
    const imageWrap = document.createElement("button");
    imageWrap.type = "button";
    imageWrap.className = "menu-image-wrap";
    imageWrap.setAttribute("aria-label", `View ${item.name} details`);
    if (item.imageUrl) {
      const image = document.createElement("img");
      image.className = "menu-image";
      image.src = item.imageUrl;
      image.alt = item.name;
      image.loading = "lazy";
      imageWrap.append(image);
    }
    if (item.tag) {
      const tag = document.createElement("span");
      tag.className = "dish-tag";
      tag.textContent = item.tag;
      imageWrap.append(tag);
    }
    if (!item.available) {
      const unavailable = document.createElement("span");
      unavailable.className = "unavailable-cover";
      unavailable.textContent = "Currently unavailable";
      imageWrap.append(unavailable);
    }
    const body = document.createElement("div");
    body.className = "menu-card-body";
    const info = document.createElement("div");
    const name = document.createElement("h3");
    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "menu-item-open";
    nameButton.textContent = item.name;
    nameButton.setAttribute("aria-label", `View ${item.name} details`);
    nameButton.addEventListener("click", () => openItemSheet(item));
    name.append(nameButton);
    const description = document.createElement("p");
    description.textContent = item.description;
    const price = document.createElement("strong");
    price.className = "dish-price";
    price.textContent = money(item.price);
    info.append(name, description, price);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-button";
    add.textContent = "+";
    add.disabled = !item.available;
    add.setAttribute("aria-label", item.available ? `Add ${item.name} to order` : `${item.name} is unavailable`);
    add.addEventListener("click", () => changeQuantity(item.id, 1));
    imageWrap.addEventListener("click", () => openItemSheet(item));
    body.append(info, add);
    article.append(imageWrap, body);
    return article;
  }

  function renderMenu() {
    menuGrid.replaceChildren();
    const visibleItems = state.menu.filter((item) => state.category === "All" || item.category === state.category);
    if (!visibleItems.length) {
      const empty = document.createElement("div");
      empty.className = "menu-state";
      const heading = document.createElement("h3");
      heading.textContent = "Nothing on the menu just yet.";
      const text = document.createElement("p");
      text.textContent = "Please check back in a little while.";
      empty.append(heading, text);
      menuGrid.append(empty);
      return;
    }
    visibleItems.forEach((item) => menuGrid.append(createMenuCard(item)));
  }

  function changeQuantity(itemId, difference) {
    const item = state.menu.find((menuItem) => menuItem.id === itemId);
    const existing = state.cart[itemId];
    if (difference > 0 && (!item || !item.available)) {
      showToast("Sorry, that dish is no longer available.");
      return;
    }
    const current = Number(existing && existing.quantity) || 0;
    const next = Math.max(0, Math.min(99, current + difference));
    if (next === 0) delete state.cart[itemId];
    else state.cart[itemId] = { item: item || existing.item, quantity: next, unavailable: !item || !item.available };
    writeStorage(CART_STORAGE_KEY, state.cart);
    renderCart();
    if (difference > 0 && item) showToast(`${item.name} added to your order.`);
  }

  // "Add" on a dish suggested in the AI menu chat (ai-assistant/public/chat-widget.js).
  // detail.itemId is the backend id when the AI reads the live menu, else the menu-seed id; the name is a fallback.
  window.addEventListener("chinu:add-to-cart", (event) => {
    const detail = event.detail || {};
    const ids = [detail.itemId, detail.aiItemId].filter((id) => id != null).map(String);
    const name = String(detail.name || "").trim().toLowerCase();
    const item = state.menu.find((menuItem) => ids.includes(menuItem.id))
      || state.menu.find((menuItem) => menuItem.name.trim().toLowerCase() === name);
    if (!item) {
      showToast(`Sorry, ${detail.name || "that dish"} isn’t on the menu right now.`);
      return;
    }
    changeQuantity(item.id, 1);
  });

  function openItemSheet(item) {
    const line = state.cart[item.id];
    state.selectedItem = item;
    state.originalSelectedQuantity = Number(line && line.quantity) || 0;
    state.selectedQuantity = state.originalSelectedQuantity;
    renderItemSheet();
    $("#item-sheet").showModal();
    $("#item-sheet-close").focus();
  }

  function renderItemSheet() {
    const item = state.selectedItem;
    if (!item) return;
    const image = $("#item-sheet-image");
    image.hidden = !item.imageUrl;
    image.src = item.imageUrl;
    image.alt = item.name;
    $("#item-sheet-tag").textContent = item.tag;
    $("#item-sheet-tag").hidden = !item.tag;
    $("#item-sheet-title").textContent = item.name;
    $("#item-sheet-description").textContent = item.description || "Made fresh to order.";
    $("#item-sheet-price").textContent = `${money(item.price)} each`;
    $("#item-sheet-quantity").textContent = String(state.selectedQuantity);
    $("#item-sheet-decrease").disabled = state.selectedQuantity === 0;
    $("#item-sheet-increase").disabled = !item.available || state.selectedQuantity >= 99;

    const confirm = $("#item-sheet-confirm");
    const changed = state.selectedQuantity !== state.originalSelectedQuantity;
    if (state.selectedQuantity === 0 && state.originalSelectedQuantity > 0) {
      confirm.textContent = "Remove item";
    } else if (!changed && state.selectedQuantity > 0) {
      confirm.textContent = `In your order · ${money(item.price * state.selectedQuantity)}`;
    } else if (state.originalSelectedQuantity > 0) {
      confirm.textContent = `Update order · ${money(item.price * state.selectedQuantity)}`;
    } else {
      confirm.textContent = `Add to order · ${money(item.price * state.selectedQuantity)}`;
    }
    confirm.disabled = !changed || (state.selectedQuantity > state.originalSelectedQuantity && !item.available);
  }

  function updateSelectedQuantity(difference) {
    if (!state.selectedItem) return;
    state.selectedQuantity = Math.max(0, Math.min(99, state.selectedQuantity + difference));
    renderItemSheet();
  }

  function saveSelectedQuantity() {
    const item = state.selectedItem;
    if (!item || state.selectedQuantity === state.originalSelectedQuantity) return;
    if (state.selectedQuantity > 0 && !item.available) {
      showToast("Sorry, that dish is no longer available.");
      return;
    }
    if (state.selectedQuantity === 0) {
      delete state.cart[item.id];
    } else {
      state.cart[item.id] = { item, quantity: state.selectedQuantity, unavailable: false };
    }
    writeStorage(CART_STORAGE_KEY, state.cart);
    renderCart();
    $("#item-sheet").close();
    showToast(state.selectedQuantity === 0
      ? `${item.name} removed from your order.`
      : `${item.name} updated in your order.`);
  }

  function reconcileCartToMenu() {
    Object.entries(state.cart).forEach(([id, line]) => {
      const current = state.menu.find((item) => item.id === id);
      if (current && current.available) state.cart[id] = { ...line, item: current, unavailable: false };
      else state.cart[id] = { ...line, unavailable: true };
    });
    writeStorage(CART_STORAGE_KEY, state.cart);
  }

  function cartTotals() {
    const lines = Object.values(state.cart).filter((line) => line && line.item && line.quantity > 0);
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
      hasUnavailableItems: lines.some((line) => {
        const current = state.menu.find((item) => item.id === line.item.id);
        return !current || !current.available || line.unavailable;
      })
    };
  }

  function renderCart() {
    const { lines, count, subtotal } = cartTotals();
    $("#cart-count").textContent = String(count);
    $("#drawer-table").textContent = tableId ? `· Table ${tableId}` : "";
    const list = $("#cart-lines");
    list.replaceChildren();
    lines.forEach(({ item, quantity }) => {
      const line = document.createElement("div");
      line.className = "cart-line";
      const image = document.createElement("img");
      image.src = item.imageUrl;
      image.alt = "";
      const info = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = item.name;
      const price = document.createElement("p");
      const currentItem = state.menu.find((menuItem) => menuItem.id === item.id);
      const unavailable = !currentItem || !currentItem.available;
      const description = document.createElement("p");
      description.className = "cart-line-description";
      description.textContent = item.description || "";
      price.textContent = unavailable
        ? `Unavailable · ${money(item.price)} each`
        : `${quantity} × ${money(item.price)} · ${money(item.price * quantity)}`;
      info.append(name, description, price);
      const controls = document.createElement("div");
      controls.className = "quantity-control";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.textContent = "−";
      decrease.setAttribute("aria-label", `Remove one ${item.name}`);
      decrease.addEventListener("click", () => changeQuantity(item.id, -1));
      const amount = document.createElement("span");
      amount.textContent = String(quantity);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.textContent = "+";
      increase.disabled = unavailable;
      increase.setAttribute("aria-label", `Add one ${item.name}`);
      increase.addEventListener("click", () => changeQuantity(item.id, 1));
      controls.append(decrease, amount, increase);
      line.append(image, info, controls);
      list.append(line);
    });
    $("#cart-empty").hidden = lines.length > 0;
    $("#cart-footer").hidden = lines.length === 0;
    $("#cart-subtotal").textContent = money(subtotal);
    renderCheckoutSummary();
    renderOrderingAvailability();
  }

  function renderOrderingAvailability() {
    const blocked = ORDERING_BLOCKED[state.tableStatus] || "";
    const tableNotice = $("#table-notice");
    tableNotice.textContent = blocked;
    tableNotice.hidden = !blocked;
    const cartBlocked = $("#cart-blocked");
    cartBlocked.textContent = blocked;
    cartBlocked.hidden = !blocked;
    $("#checkout-open").disabled = Boolean(blocked) || state.tableStatus === "checking";
  }

  async function checkTable() {
    if (!API_BASE) return;
    if (!tableId) {
      state.tableStatus = "none";
    } else {
      try {
        await apiRequest(`/api/tables/validate/${encodeURIComponent(tableId)}`, { method: "GET" });
        state.tableStatus = "ok";
      } catch (error) {
        const message = String(error.message || "");
        // If the server can't be reached, let checkout try anyway: the backend still checks the table.
        state.tableStatus = /inactive/i.test(message) ? "inactive" : /unknown|invalid|not found/i.test(message) ? "invalid" : "unchecked";
      }
    }
    renderOrderingAvailability();
  }

  function renderCheckoutSummary() {
    const summary = $("#checkout-order-summary");
    if (!summary) return;
    const { lines, subtotal } = cartTotals();
    summary.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Your order";
    summary.append(heading);
    lines.forEach(({ item, quantity }) => {
      const row = document.createElement("div");
      row.className = "checkout-order-line";
      const label = document.createElement("span");
      label.textContent = `${quantity} × ${item.name}`;
      const amount = document.createElement("strong");
      amount.textContent = money(item.price * quantity);
      row.append(label, amount);
      summary.append(row);
    });
    const total = document.createElement("div");
    total.className = "checkout-order-total";
    const totalLabel = document.createElement("strong");
    totalLabel.textContent = "Subtotal";
    const totalAmount = document.createElement("strong");
    totalAmount.textContent = money(subtotal);
    total.append(totalLabel, totalAmount);
    summary.append(total);
  }

  if (tableId) {
    const chip = $("#table-chip");
    chip.textContent = `TABLE ${tableId}`;
    chip.hidden = false;
  }

  function openDrawer() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    document.body.classList.add("no-scroll");
    $("#cart-close").focus();
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.classList.remove("no-scroll");
    $("#cart-open").focus();
  }

  function showCheckoutError(message) {
    const error = $("#checkout-error");
    error.textContent = message;
    error.hidden = !message;
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = busy ? label : button.dataset.originalText;
  }

  function validateCustomer(formData) {
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const normalizedPhone = phone.replace(/[^\d]/g, "");
    if (name.length < 2) return { error: "Please enter your name so we know who to call." };
    if (normalizedPhone.length < 7 || normalizedPhone.length > 15) return { error: "Please enter a valid mobile number." };
    const totals = cartTotals();
    if (!totals.count) return { error: "Your order is empty. Add a dish before checking out." };
    if (totals.hasUnavailableItems) return { error: "Your order includes an unavailable dish. Remove it from your order and try again." };
    return { name, phone };
  }

  function currentOrderStatus(status) {
    const value = String(status || "Pending").toLowerCase();
    if (value === "served" || value === "completed") return "Served";
    return STATUS_STEPS.find((step) => step.toLowerCase() === value) || "Pending";
  }

  function renderTracking() {
    const section = $("#tracking");
    const content = $("#tracking-content");
    if (!state.order) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    content.replaceChildren();
    const card = document.createElement("article");
    card.className = "tracking-card";
    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `Order ${state.order.orderId}`;
    const detail = document.createElement("p");
    const tableLabel = state.order.tableId ? ` · Table ${state.order.tableId}` : "";
    const totalLabel = state.order.total == null ? "total pending confirmation" : money(state.order.total);
    detail.textContent = `${state.order.items.length} item${state.order.items.length === 1 ? "" : "s"}${tableLabel} · ${totalLabel}`;
    const orderItems = document.createElement("ul");
    orderItems.className = "tracking-items";
    state.order.items.forEach((item) => {
      const row = document.createElement("li");
      row.textContent = `${item.quantity} × ${item.name} · ${money(item.price * item.quantity)}`;
      orderItems.append(row);
    });
    const steps = document.createElement("div");
    steps.className = "status-steps";
    const statusIndex = STATUS_STEPS.indexOf(currentOrderStatus(state.order.status));
    STATUS_STEPS.forEach((status, index) => {
      const step = document.createElement("div");
      step.className = `status-step${index <= statusIndex ? " done" : ""}`;
      step.textContent = status;
      steps.append(step);
    });
    info.append(title, detail, orderItems, steps);
    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = state.order.paymentStatus === "failed"
      ? "Payment failed"
      : state.order.paymentStatus === "pending"
        ? "Payment verification pending"
        : currentOrderStatus(state.order.status);
    if (API_BASE && ONLINE_PAYMENTS && ["failed", "pending"].includes(state.order.paymentStatus)) {
      const actions = document.createElement("div");
      actions.className = "tracking-actions";
      const pay = document.createElement("button");
      pay.type = "button";
      pay.className = "button button-primary";
      pay.textContent = "Pay now";
      pay.addEventListener("click", () => retryPayment(pay));
      const check = document.createElement("button");
      check.type = "button";
      check.className = "text-link";
      check.textContent = "I’ve paid – check again";
      check.addEventListener("click", () => checkPaymentStatus(check));
      const note = document.createElement("p");
      note.textContent = "Or pay at the counter. Our staff will mark your order as paid.";
      actions.append(pay, check, note);
      info.append(actions);
    }
    card.append(info, pill);
    content.append(card);
  }

  async function syncOrder() {
    if (!API_BASE || !state.order || !state.order.orderId) return;
    try {
      const order = await apiRequest(`/api/orders/${encodeURIComponent(state.order.orderId)}`, { method: "GET" });
      if (order && order.status) {
        state.order.status = currentOrderStatus(order.status);
        if (order.total != null && Number.isFinite(Number(order.total))) state.order.total = Number(order.total);
        writeStorage(ORDER_STORAGE_KEY, state.order);
        renderTracking();
        if (state.order.status === "Served") {
          window.clearInterval(state.pollTimer);
          state.pollTimer = null;
        }
      }
    } catch (error) {
      console.warn(`Could not refresh order ${state.order.orderId}.`, error);
    }
  }

  function startOrderPolling() {
    window.clearInterval(state.pollTimer);
    if (API_BASE && state.order && state.order.status !== "Served") {
      state.pollTimer = window.setInterval(syncOrder, 20000);
    }
  }

  function setOrder(order) {
    state.order = order;
    writeStorage(ORDER_STORAGE_KEY, state.order);
    renderTracking();
    startOrderPolling();
  }

  async function placeDemoOrder(formData, paymentMethod) {
    if (paymentMethod === "online") throw new Error("Online payment is not configured. Please pay at the counter.");
    const validation = validateCustomer(formData);
    if (validation.error) throw new Error(validation.error);
    const { name, phone } = validation;
    const { lines, subtotal } = cartTotals();
    const order = {
      orderId: `CH${Date.now().toString().slice(-8)}`,
      status: "Pending",
      total: subtotal,
      paymentStatus: "counter",
      tableId,
      createdAt: new Date().toISOString(),
      customerName: name,
      customerPhone: phone,
      note: String(formData.get("note") || "").trim(),
      items: lines.map(({ item, quantity }) => ({ id: item.id, name: item.name, price: item.price, quantity }))
    };
    state.demoOrders.unshift(order);
    if (!writeStorage("chinu-demo-orders", state.demoOrders)) {
      throw new Error("This browser could not save the order. Please enable local storage and try again.");
    }
    setOrder(order);
    state.cart = {};
    writeStorage(CART_STORAGE_KEY, state.cart);
    renderCart();
    return order;
  }

  async function placeLiveOrder(formData, paymentMethod) {
    const validation = validateCustomer(formData);
    if (validation.error) throw new Error(validation.error);
    const { lines, subtotal } = cartTotals();
    const created = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        tableId: tableId || null,
        channel: tableId ? "qr" : "web",
        customer: {
          name: validation.name,
          phone: validation.phone,
          note: String(formData.get("note") || "").trim()
        },
        paymentMethod,
        items: lines.map(({ item, quantity }) => ({ menuItemId: item.id, quantity })),
        clientSubtotal: subtotal
      })
    });
    if (!created || created.id == null && created.orderId == null) {
      throw new Error("The server did not return an Order ID. Please contact the restaurant before retrying.");
    }
    const order = {
      orderId: String(created.orderId || created.id),
      status: currentOrderStatus(created.status),
      total: created.total == null || created.total === "" ? null : Number(created.total),
      paymentStatus: paymentMethod === "online" ? "pending" : "counter",
      tableId,
      createdAt: created.createdAt || new Date().toISOString(),
      items: lines.map(({ item, quantity }) => ({ id: item.id, name: item.name, price: item.price, quantity }))
    };
    const hasConfirmedTotal = order.total !== null && Number.isFinite(order.total) && order.total >= 0;
    setOrder(order);
    state.cart = {};
    writeStorage(CART_STORAGE_KEY, state.cart);
    renderCart();
    if (!hasConfirmedTotal) {
      await syncOrder();
    }
    if (state.order.total == null || !Number.isFinite(state.order.total) || state.order.total < 0) {
      throw new Error("The server created an order but did not return a valid confirmed total. Please contact the restaurant with Order ID " + order.orderId + ".");
    }
    if (paymentMethod === "online") {
      try {
        await startOnlinePayment(order);
        return order;
      } catch (error) {
        order.paymentStatus = "failed";
        setOrder(order);
        throw new Error(`Order ${order.orderId} was created, but payment could not be started: ${error.message}`);
      }
    }
    return order;
  }

  // Sends the customer to the payment gateway's checkout page. Also used by "Pay now" to retry a payment.
  async function startOnlinePayment(order) {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("payment_return", "1");
    returnUrl.searchParams.set("orderId", order.orderId);
    const payment = await apiRequest("/api/payments/initiate", {
      method: "POST",
      body: JSON.stringify({ orderId: order.orderId, returnUrl: returnUrl.toString() })
    });
    if (!payment || !payment.checkoutUrl) throw new Error("The payment service did not return a checkout URL.");
    const checkoutUrl = new URL(payment.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") throw new Error("The payment service returned an insecure checkout URL.");
    window.location.assign(checkoutUrl.toString());
  }

  async function retryPayment(button) {
    setBusy(button, true, "Opening payment…");
    try {
      await startOnlinePayment(state.order);
    } catch (error) {
      showToast(`Payment could not be started: ${error.message}`);
      setBusy(button, false, "");
    }
  }

  // Asks the backend (which asks the payment gateway) whether this order has been paid.
  async function checkPaymentStatus(button) {
    setBusy(button, true, "Checking…");
    try {
      const result = await apiRequest("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({ orderId: state.order.orderId, paymentReference: null })
      });
      const status = String(result && (result.paymentStatus || result.status) || "").toLowerCase();
      if (status === "paid") {
        state.order.paymentStatus = "paid";
        state.order.status = currentOrderStatus(result.orderStatus || state.order.status);
        showToast("Payment received — your order is confirmed.");
      } else {
        showToast(status === "failed" ? "The payment was not completed. You can try again." : "We haven’t received this payment yet.");
      }
      setOrder(state.order);
    } catch (error) {
      showToast(`Could not check the payment: ${error.message}`);
      setBusy(button, false, "");
    }
  }

  function revealOrder(order) {
    $("#checkout-dialog").close();
    closeDrawer();
    $("#tracking").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Order ${order.orderId} placed. The team will take it from here!`);
  }

  async function onCheckout(event) {
    event.preventDefault();
    showCheckoutError("");
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const method = String(formData.get("paymentMethod") || "counter");
    const button = $("#checkout-submit");
    setBusy(button, true, "Placing your order…");
    try {
      const order = API_BASE
        ? await placeLiveOrder(formData, method)
        : await placeDemoOrder(formData, method);
      revealOrder(order);
      form.reset();
    } catch (error) {
      showCheckoutError(error.message);
    } finally {
      setBusy(button, false, "");
    }
  }

  async function verifyPaymentReturn() {
    const orderId = params.get("orderId");
    if (!params.has("payment_return") || !orderId) return;
    if (!API_BASE) {
      showToast("Payment return received, but payment verification needs the restaurant API.");
      return;
    }
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete("payment_return");
    returnUrl.searchParams.delete("orderId");
    window.history.replaceState({}, "", returnUrl.toString());
    const order = state.order && state.order.orderId === orderId
      ? state.order
      : { orderId, status: "Pending", total: 0, items: [], tableId, paymentStatus: "pending" };
    setOrder(order);
    try {
      const result = await apiRequest("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          paymentReference: params.get("payment_reference") || params.get("paymentId") || null
        })
      });
      const verified = String(result && (result.paymentStatus || result.status) || "").toLowerCase();
      if (verified !== "paid" && verified !== "success" && verified !== "verified") {
        order.paymentStatus = "failed";
        setOrder(order);
        showToast(ONLINE_PAYMENTS ? "Payment not completed. Tap “Pay now” to try again, or pay at the counter." : "Payment could not be verified. Please contact the restaurant with your Order ID.");
      } else {
        order.paymentStatus = "paid";
        order.status = currentOrderStatus(result.orderStatus || order.status);
        setOrder(order);
        showToast("Payment verified — your order is confirmed.");
      }
    } catch (error) {
      order.paymentStatus = "pending";
      setOrder(order);
      showToast(`We couldn’t verify payment yet: ${error.message}`);
    }
  }

  function renderStaffOrders(orders) {
    const container = $("#staff-orders");
    container.replaceChildren();
    if (!orders.length) {
      const empty = document.createElement("p");
      empty.className = "staff-note";
      empty.textContent = "No orders to show yet.";
      container.append(empty);
      return;
    }
    orders.forEach((order) => {
      const row = document.createElement("article");
      row.className = "staff-order";
      const head = document.createElement("div");
      head.className = "staff-order-head";
      const title = document.createElement("h3");
      title.textContent = `Order ${order.orderId || order.id}`;
      const status = document.createElement("select");
      status.setAttribute("aria-label", `Update status for order ${order.orderId || order.id}`);
      STATUS_STEPS.forEach((step) => {
        const option = document.createElement("option");
        option.value = step;
        option.textContent = step;
        option.selected = currentOrderStatus(order.status) === step;
        status.append(option);
      });
      status.addEventListener("change", () => updateStaffOrder(order, status.value));
      head.append(title, status);
      const detail = document.createElement("p");
      const items = (order.items || []).map((item) => `${item.quantity} × ${item.name}`).join(", ");
      const orderTotal = order.total == null ? "Total pending confirmation" : money(Number(order.total) || 0);
      detail.textContent = `Table ${order.tableId || "—"} · ${items || "Items unavailable"} · ${orderTotal}`;
      row.append(head, detail);
      container.append(row);
    });
  }

  async function loadStaffOrders() {
    if (API_BASE) {
      $("#staff-orders").textContent = "Loading restaurant orders…";
      try {
        const data = await apiRequest("/api/staff/orders", { method: "GET" });
        const orders = Array.isArray(data) ? data : data && data.orders;
        if (!Array.isArray(orders)) throw new Error("The staff API did not return an orders list.");
        renderStaffOrders(orders);
      } catch (error) {
        const message = document.createElement("p");
        message.className = "staff-note";
        message.textContent = `Orders could not be loaded: ${error.message}`;
        $("#staff-orders").replaceChildren(message);
      }
      return;
    }
    renderStaffOrders(state.demoOrders);
  }

  async function updateStaffOrder(order, status) {
    const orderId = String(order.orderId || order.id);
    if (API_BASE) {
      try {
        await apiRequest(`/api/staff/orders/${encodeURIComponent(orderId)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        showToast(`Order ${orderId} updated to ${status}.`);
        if (state.order && state.order.orderId === orderId) {
          state.order.status = status;
          writeStorage(ORDER_STORAGE_KEY, state.order);
          renderTracking();
        }
        loadStaffOrders();
      } catch (error) {
        showToast(`Order status was not updated: ${error.message}`);
        loadStaffOrders();
      }
      return;
    }
    const target = state.demoOrders.find((candidate) => candidate.orderId === orderId);
    if (target) target.status = status;
    writeStorage("chinu-demo-orders", state.demoOrders);
    if (state.order && state.order.orderId === orderId) {
      state.order.status = status;
      writeStorage(ORDER_STORAGE_KEY, state.order);
      renderTracking();
    }
    renderStaffOrders(state.demoOrders);
    showToast(`Demo order ${orderId} updated to ${status}.`);
  }

  $("#cart-open").addEventListener("click", openDrawer);
  themeToggle.addEventListener("click", toggleTheme);
  $("#cart-close").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  $("#browse-menu").addEventListener("click", () => {
    closeDrawer();
    $("#menu").scrollIntoView({ behavior: "smooth" });
  });
  $("#checkout-open").addEventListener("click", () => {
    renderCheckoutSummary();
    $("#checkout-table").textContent = tableId ? `Ordering from Table ${tableId}` : "Ordering from Chinu Dhaba";
    showCheckoutError("");
    $("#online-payment-option").hidden = !ONLINE_PAYMENTS;
    if (!ONLINE_PAYMENTS) {
      const counterChoice = document.querySelector('input[name="paymentMethod"][value="counter"]');
      counterChoice.checked = true;
    }
    checkoutDialog.showModal();
    $("#customer-name").focus();
  });
  $("#checkout-close").addEventListener("click", () => checkoutDialog.close());
  $("#item-sheet-close").addEventListener("click", () => $("#item-sheet").close());
  $("#item-sheet-decrease").addEventListener("click", () => updateSelectedQuantity(-1));
  $("#item-sheet-increase").addEventListener("click", () => updateSelectedQuantity(1));
  $("#item-sheet-confirm").addEventListener("click", saveSelectedQuantity);
  $("#checkout-form").addEventListener("submit", onCheckout);
  $("#staff-open").addEventListener("click", () => {
    staffDialog.showModal();
    loadStaffOrders();
  });
  $("#staff-close").addEventListener("click", () => staffDialog.close());
  $("#mobile-menu-toggle").addEventListener("click", (event) => {
    const nav = $(".main-nav");
    const isOpen = nav.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(isOpen));
    event.currentTarget.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      $(".main-nav").classList.remove("open");
      $("#mobile-menu-toggle").setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
  });

  if (ONLINE_PAYMENTS) {
    const onlineOption = $("#online-payment-option");
    onlineOption.hidden = false;
  }
  applyTheme(document.documentElement.dataset.theme);
  renderCart();
  renderTracking();
  loadMenu();
  checkTable();
  verifyPaymentReturn();
  startOrderPolling();
  // The browser-only staff board is for demo mode. With a live backend, staff use the admin dashboard.
  $("#staff-open").hidden = Boolean(API_BASE);

  // Footer link to the restaurant's admin dashboard, shown only when config.js sets adminUrl.
  const ADMIN_URL = String(CONFIG.adminUrl || "");
  if (/^https?:\/\//.test(ADMIN_URL)) {
    $("#admin-link").href = ADMIN_URL;
    $("#admin-link").hidden = false;
  }

  // AI menu assistant chat button (ai-assistant/). Loads only when config.js sets aiAssistantUrl.
  const AI_ASSISTANT_URL = String(CONFIG.aiAssistantUrl || "").replace(/\/+$/, "");
  if (AI_ASSISTANT_URL) {
    const widget = document.createElement("script");
    widget.src = `${AI_ASSISTANT_URL}/widget/chat-widget.js`;
    widget.dataset.apiBase = AI_ASSISTANT_URL;
    widget.dataset.bottomOffset = "72";
    if (/^[A-Za-z0-9_-]{1,20}$/.test(tableId)) widget.dataset.tableId = tableId;
    widget.defer = true;
    document.body.append(widget);
  }
})();
