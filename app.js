
/* =========================================
   AQUA - CUSTOMER WEBSITE
   Cosmic Food Ordering System
========================================= */

// SUPABASE CONNECTION
const supabaseClient = window.supabase.createClient(
    window.AQUA_CONFIG.SUPABASE_URL,
    window.AQUA_CONFIG.SUPABASE_ANON_KEY
);

// APPLICATION DATA
let menuItems = [];
let cart = [];
let selectedCategory = "All";

// HTML SAFETY
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// =========================================
// LOAD MENU
// =========================================

async function loadMenu() {
    const container = document.getElementById("menuContainer");

    try {
        const { data, error } = await supabaseClient
            .from("products")
            .select("id, name, category, price, description, emoji, image_url")
            .eq("active", true)
            .order("category")
            .order("name");

        if (error) throw error;

        menuItems = data || [];

        displayCategories();
        displayMenu();

    } catch (error) {
        console.error("Menu loading error:", error);

        container.innerHTML = `
            <p class="loading-message">
                Unable to load the menu. Please refresh the page.
            </p>
        `;
    }
}

// =========================================
// CATEGORY TABS
// =========================================

function displayCategories() {
    const tabs = document.getElementById("categoryTabs");

    const categories = [
        "All",
        ...new Set(menuItems.map(item => item.category).filter(Boolean))
    ];

    tabs.innerHTML = categories.map(category => `
        <button
            type="button"
            class="category-tab ${category === selectedCategory ? "active" : ""}"
            data-category="${escapeHTML(category)}"
        >
            ${category === "All" ? "All Menu" : escapeHTML(category)}
        </button>
    `).join("");
}

// =========================================
// DISPLAY MENU
// =========================================

function displayMenu() {
    const container = document.getElementById("menuContainer");
    const search = document.getElementById("menuSearch").value
        .trim()
        .toLowerCase();

    let filteredItems = menuItems.filter(item => {
        const matchesCategory =
            selectedCategory === "All" ||
            item.category === selectedCategory;

        const matchesSearch =
            item.name.toLowerCase().includes(search) ||
            (item.description || "").toLowerCase().includes(search);

        return matchesCategory && matchesSearch;
    });

    document.getElementById("selectedCategoryTitle").innerHTML =
        selectedCategory === "All"
            ? 'All <span>Menu</span>'
            : escapeHTML(selectedCategory);

    document.getElementById("menuItemCount").textContent =
        `${filteredItems.length} ITEMS`;

    if (!filteredItems.length) {
        container.innerHTML = `
            <p class="loading-message">
                No food items found. Try another search!
            </p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="menu-grid">
            ${filteredItems.map(item => `
                <article class="menu-card">

                    <div class="food-image-container">
                        ${item.image_url
                            ? `
                                <img
                                    src="${escapeHTML(item.image_url)}"
                                    class="food-image"
                                    alt="${escapeHTML(item.name)}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="food-emoji">
                                    ${escapeHTML(item.emoji || "🍽️")}
                                </div>
                            `
                        }
                    </div>

                    <div class="food-card-content">

                        <p class="food-category">
                            ${escapeHTML(item.category)}
                        </p>

                        <h3 class="food-name">
                            ${escapeHTML(item.name)}
                        </h3>

                        <p class="food-description">
                            ${escapeHTML(
                                item.description || "A delicious AQUA special."
                            )}
                        </p>

                        <div class="food-bottom">

                            <span class="food-price">
                                ${item.price == null
                                    ? "Price pending"
                                    : `₹${Number(item.price).toFixed(2)}`
                                }
                            </span>

                            <button
                                class="add-button"
                                data-add="${escapeHTML(item.id)}"
                                type="button"
                                ${item.price == null ? "disabled" : ""}
                            >
                                + ADD
                            </button>

                        </div>
                    </div>
                </article>
            `).join("")}
        </div>
    `;
}

// =========================================
// ADD TO CART
// =========================================

function addToCart(productId) {
    const product = menuItems.find(
        item => item.id === productId
    );

    if (!product || product.price == null) return;

    const existing = cart.find(
        item => item.id === productId
    );

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            emoji: product.emoji,
            image_url: product.image_url,
            quantity: 1
        });
    }

    updateCart();
}

// =========================================
// CHANGE QUANTITY
// =========================================

function changeQuantity(productId, amount) {
    const item = cart.find(
        product => product.id === productId
    );

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(
            product => product.id !== productId
        );
    }

    updateCart();
}

// =========================================
// UPDATE CART
// =========================================

function updateCart() {
    const cartCount = document.getElementById("cartCount");
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");

    const totalQuantity = cart.reduce(
        (sum, item) => sum + item.quantity, 0
    );

    const total = cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity, 0
    );

    cartCount.textContent = totalQuantity;

    // BOTTOM CART BAR
    document.getElementById("bottomCartCount").textContent =
        `${totalQuantity} ${totalQuantity === 1 ? "Item" : "Items"}`;

    document.getElementById("bottomCartTotal").textContent =
        `₹${total.toFixed(2)}`;

    document.getElementById("bottomCartBar").classList.toggle(
        "visible",
        totalQuantity > 0
    );

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <p class="empty-cart-message">
                Your cart is empty. Explore our menu!
            </p>
        `;

        cartTotal.textContent = "₹0.00";
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">

            <div class="cart-item-info">

                <div class="cart-item-name">
                    ${escapeHTML(item.emoji || "🍽️")}
                    ${escapeHTML(item.name)}
                </div>

                <div class="cart-item-price">
                    ₹${(
                        Number(item.price) * item.quantity
                    ).toFixed(2)}
                </div>

            </div>

            <div class="quantity-controls">

                <button
                    type="button"
                    data-minus="${escapeHTML(item.id)}"
                >−</button>

                <span>${item.quantity}</span>

                <button
                    type="button"
                    data-plus="${escapeHTML(item.id)}"
                >+</button>

            </div>

        </div>
    `).join("");

    cartTotal.textContent = `₹${total.toFixed(2)}`;
}

// =========================================
// CART MODAL
// =========================================

function openCart() {
    updateCart();

    document.getElementById("cartModal")
        .classList.add("active");

    document.getElementById("orderMessage")
        .textContent = "";
}

function closeCart() {
    document.getElementById("cartModal")
        .classList.remove("active");
}

// =========================================
// PLACE ORDER
// =========================================

async function placeOrder(event) {
    event.preventDefault();

    const button = document.getElementById("placeOrderButton");
    const message = document.getElementById("orderMessage");

    const customerName = document
        .getElementById("customerName")
        .value.trim();

    if (cart.length === 0) {
        message.textContent = "Your cart is empty.";
        return;
    }

    const pricesAvailable = cart.every(
        item => item.price != null &&
                Number.isFinite(Number(item.price)) &&
                Number(item.price) >= 0
    );

    if (!pricesAvailable) {
        message.textContent =
            "Prices are not available yet. Please try again later.";
        return;
    }

    button.disabled = true;
    button.textContent = "PLACING ORDER...";
    message.textContent = "";

    try {
        const orderItems = cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        }));

        const { data, error } = await supabaseClient.rpc(
            "create_order",
            {
                p_customer_name: customerName || null,
                p_customer_phone: null,
                p_items: orderItems
            }
        );

        if (error) throw error;

        if (!data) {
            throw new Error("No token was returned.");
        }

        // Display token in confirmation popup
        document.getElementById("tokenDisplay").textContent = data;

        // Display token permanently until page refresh
        document.getElementById("persistentTokenNumber").textContent = data;
        document.getElementById("persistentToken").hidden = false;

        cart = [];
        updateCart();

        document.getElementById("customerName").value = "";

        closeCart();

        document.getElementById("confirmationModal")
            .classList.add("active");

    } catch (error) {
        console.error("Order error:", error);

        message.textContent =
            error.message || "Unable to place order. Please try again.";

    } finally {
        button.disabled = false;
        button.textContent = "PLACE ORDER";
    }
}

// =========================================
// EVENT LISTENERS
// =========================================

// ADD FOOD BUTTONS
document.getElementById("menuContainer")
    .addEventListener("click", event => {

        const button = event.target.closest("[data-add]");

        if (button) {
            addToCart(button.dataset.add);
        }
    });

// CATEGORY BUTTONS
document.getElementById("categoryTabs")
    .addEventListener("click", event => {

        const button = event.target.closest("[data-category]");

        if (!button) return;

        selectedCategory = button.dataset.category;

        displayCategories();
        displayMenu();
    });

// SEARCH
document.getElementById("menuSearch")
    .addEventListener("input", displayMenu);

// CART QUANTITY BUTTONS
document.getElementById("cartItems")
    .addEventListener("click", event => {

        const minus = event.target.closest("[data-minus]");
        const plus = event.target.closest("[data-plus]");

        if (minus) {
            changeQuantity(minus.dataset.minus, -1);
        }

        if (plus) {
            changeQuantity(plus.dataset.plus, 1);
        }
    });

// OPEN AND CLOSE CART
document.getElementById("cartButton")
    .addEventListener("click", openCart);

document.getElementById("bottomCartButton")
    .addEventListener("click", openCart);

document.getElementById("closeCart")
    .addEventListener("click", closeCart);

// CHECKOUT
document.getElementById("checkoutForm")
    .addEventListener("submit", placeOrder);

// CONFIRMATION
document.getElementById("doneButton")
    .addEventListener("click", () => {
        document.getElementById("confirmationModal")
            .classList.remove("active");
    });

// =========================================
// START WEBSITE
// =========================================

loadMenu();
updateCart();
