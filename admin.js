
const supabaseClient = window.supabase.createClient(
    window.AQUA_CONFIG.SUPABASE_URL,
    window.AQUA_CONFIG.SUPABASE_ANON_KEY
);

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");

const ordersContainer = document.getElementById("ordersContainer");
const productsContainer = document.getElementById("productsContainer");

const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const productMessage = document.getElementById("productMessage");

let currentProducts = [];

// -----------------------------
// AUTHENTICATION
// -----------------------------

async function checkSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        loginMessage.textContent = error.message;
        return;
    }

    if (data.session) {
        await showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginSection.hidden = false;
    dashboardSection.hidden = true;
}


// -----------------------------
// LIVE ORDER UPDATES
// -----------------------------

let ordersRealtimeChannel = null;

async function startOrdersRealtime() {

    // Prevent duplicate subscriptions
    if (ordersRealtimeChannel) {
        await supabaseClient.removeChannel(ordersRealtimeChannel);
    }

    ordersRealtimeChannel = supabaseClient
        .channel("aqua-admin-live-orders")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "orders"
            },
            () => {
                loadOrders();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "order_items"
            },
            () => {
                loadOrders();
            }
        )

        .subscribe();
}

async function showDashboard() {
    const { data, error } = await supabaseClient.rpc("is_admin");

    if (error || data !== true) {
        await supabaseClient.auth.signOut();
        showLogin();
        loginMessage.textContent =
            "Access denied. This account is not an AQUA administrator.";
        return;
    }

    loginSection.hidden = true;
    dashboardSection.hidden = false;

    await loadOrders();
    await loadProducts();

    startOrdersRealtime();
}


loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    const button = document.getElementById("loginButton");

    button.disabled = true;
    button.textContent = "LOGGING IN...";
    loginMessage.textContent = "";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    button.disabled = false;
    button.textContent = "LOGIN TO DASHBOARD";

    if (error) {
        loginMessage.textContent = error.message;
        return;
    }

    await showDashboard();
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
        showLogin();
    }
});

// -----------------------------
// LOAD ORDERS
// -----------------------------

async function loadOrders() {
    ordersContainer.innerHTML =
        '<p class="loading-message">Loading orders...</p>';

    const { data, error } = await supabaseClient
        .from("orders")
.select("id,token_number,customer_name,total,status,payment_status,created_at,order_items(id,product_name,quantity,unit_price,subtotal)")        .order("created_at", { ascending: false });

    if (error) {
        ordersContainer.innerHTML =
            `<p class="admin-message">${escapeHTML(error.message)}</p>`;
        return;
    }

    updateStatistics(data || []);
    renderOrders(data || []);
}

function updateStatistics(orders) {
    document.getElementById("totalOrders").textContent =
        orders.length;

    document.getElementById("pendingOrders").textContent =
        orders.filter(order => order.status === "Pending").length;

    document.getElementById("completedOrders").textContent =
        orders.filter(order => order.status === "Completed").length;

    const sales = orders
        .filter(order => order.payment_status === "Paid")
        .reduce((sum, order) => sum + Number(order.total), 0);

    document.getElementById("totalSales").textContent =
        `₹${sales.toFixed(2)}`;
}


function renderOrders(orders) {
    const filter = document.getElementById("orderFilter").value;

    const filteredOrders = filter === "All"
        ? orders
        : orders.filter(order => order.status === filter);

    if (!filteredOrders.length) {
        ordersContainer.innerHTML =
            '<p class="loading-message">No orders found.</p>';
        return;
    }

    ordersContainer.innerHTML = filteredOrders.map(order => {
        const items = (order.order_items || []).map(item => `
            <div class="order-item">
                <span>${escapeHTML(item.product_name)} × ${item.quantity}</span>
                <strong>₹${Number(item.subtotal).toFixed(2)}</strong>
            </div>
        `).join("");

        const date = new Date(order.created_at).toLocaleString();

        return `
            <article class="order-card">
                <div class="order-card-heading">
                    <div>
                        <h3>${escapeHTML(order.token_number)}</h3>
                        <p>${escapeHTML(order.customer_name || "Guest")}</p>
                        <small>${escapeHTML(date)}</small>
                    </div>
                    <strong>₹${Number(order.total).toFixed(2)}</strong>
                </div>

                <div class="order-items-list">${items}</div>

                <div class="order-controls">
                    <label>
                        Order status
                        <select
                            class="status-select"
                            data-order-id="${order.id}"
                            data-field="status"
                        >
                            ${["Pending", "Preparing", "Ready", "Completed"]
                                .map(status => `
                                    <option value="${status}"
                                        ${order.status === status ? "selected" : ""}>
                                        ${status}
                                    </option>
                                `).join("")}
                        </select>
                    </label>

                    <label>
                        Payment
                        <select
                            class="status-select"
                            data-order-id="${order.id}"
                            data-field="payment_status"
                        >
                            ${["Unpaid", "Paid"].map(status => `
                                <option value="${status}"
                                    ${order.payment_status === status ? "selected" : ""}>
                                    ${status}
                                </option>
                            `).join("")}
                        </select>
                    </label>
                </div>
            </article>
        `;
    }).join("");
}


ordersContainer.addEventListener("change", async (event) => {
    const select = event.target.closest("select[data-order-id]");

    if (!select) return;

    const orderId = select.dataset.orderId;
    const field = select.dataset.field;

    const { error } = await supabaseClient
        .from("orders")
        .update({ [field]: select.value })
        .eq("id", orderId);

    if (error) {
        alert("Could not update order: " + error.message);
    }

    await loadOrders();
});

document.getElementById("orderFilter").addEventListener("change", loadOrders);

document.getElementById("refreshOrders").addEventListener("click", loadOrders);

// -----------------------------
// LOAD MENU PRODUCTS
// -----------------------------

async function loadProducts() {
    productsContainer.innerHTML =
        '<p class="loading-message">Loading menu...</p>';

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("category")
        .order("name");

    if (error) {
        productsContainer.innerHTML =
            `<p class="admin-message">${escapeHTML(error.message)}</p>`;
        return;
    }

    currentProducts = data || [];
    renderProducts();
}

function renderProducts() {
    if (!currentProducts.length) {
        productsContainer.innerHTML =
            '<p class="loading-message">No menu items found.</p>';
        return;
    }

    productsContainer.innerHTML = currentProducts.map(product => `
        <article class="product-admin-card">
            <div class="product-admin-info">
                <span class="product-admin-emoji">${escapeHTML(product.emoji || "🍽️")}</span>
                <div>
                    <h3>${escapeHTML(product.name)}</h3>
                    <p>${escapeHTML(product.category)}</p>
                    <strong>
                        ${product.price === null
                            ? "Price not set"
                            : `₹${Number(product.price).toFixed(2)}`}
                    </strong>
                    <small>${product.active ? "Visible on menu" : "Hidden from menu"}</small>
                </div>
            </div>

            <div class="product-admin-actions">
                <button class="secondary-button"
                    data-edit-product="${product.id}">
                    EDIT
                </button>
                <button class="danger-button"
                    data-toggle-product="${product.id}">
                    ${product.active ? "HIDE" : "SHOW"}
                </button>
            </div>
        </article>
    `).join("");
}

productsContainer.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-product]");
    const toggleButton = event.target.closest("[data-toggle-product]");

    if (editButton) {
        editProduct(editButton.dataset.editProduct);
    }

    if (toggleButton) {
        await toggleProduct(toggleButton.dataset.toggleProduct);
    }
});

// -----------------------------
// ADD / EDIT PRODUCTS
// -----------------------------

document.getElementById("addProductButton").addEventListener("click", () => {
    productForm.reset();

    document.getElementById("productId").value = "";
    document.getElementById("productActive").checked = true;
    document.getElementById("productModalTitle").innerHTML =
        'ADD <span>ITEM</span>';

    productMessage.textContent = "";
    productModal.classList.add("active");
});

function editProduct(productId) {
    const product = currentProducts.find(item => item.id === productId);

    if (!product) return;

    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price ?? "";
    document.getElementById("productEmoji").value = product.emoji || "";
    document.getElementById("productDescription").value =
        product.description || "";
    document.getElementById("productImage").value = "";
    document.getElementById("productActive").checked = product.active;

    document.getElementById("productModalTitle").innerHTML =
        'EDIT <span>ITEM</span>';

    productMessage.textContent = "";
    productModal.classList.add("active");
}

productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const productId = document.getElementById("productId").value;
    const priceValue = document.getElementById("productPrice").value;

    const productData = {
        name: document.getElementById("productName").value.trim(),
        category: document.getElementById("productCategory").value,
        price: priceValue === "" ? null : Number(priceValue),
        emoji: document.getElementById("productEmoji").value.trim() || "🍽️",
        description: document.getElementById("productDescription").value.trim(),
        active: document.getElementById("productActive").checked
    };

    if (!productData.name) {
        productMessage.textContent = "Please enter a food name.";
        return;
    }

    if (productData.price !== null &&
        (!Number.isFinite(productData.price) || productData.price < 0)) {
        productMessage.textContent = "Enter a valid price.";
        return;
    }

    const button = document.getElementById("saveProductButton");
    button.disabled = true;
    button.textContent = "SAVING...";

const imageFile = document.getElementById("productImage").files[0];

if (imageFile) {
    const safeFileName = imageFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
    );

    const imagePath = `${Date.now()}-${safeFileName}`;

    const { data: uploadData, error: uploadError } =
        await supabaseClient.storage
            .from("food-images")
            .upload(imagePath, imageFile, {
                contentType: imageFile.type,
                upsert: false
            });

    if (uploadError) {
        button.disabled = false;
        button.textContent = "SAVE ITEM";
        productMessage.textContent =
            "Image upload failed: " + uploadError.message;
        return;
    }

    const { data: publicUrlData } =
        supabaseClient.storage
            .from("food-images")
            .getPublicUrl(uploadData.path);

    productData.image_url = publicUrlData.publicUrl;
}

    let result;

    if (productId) {
        result = await supabaseClient
            .from("products")
            .update(productData)
            .eq("id", productId);
    } else {
        result = await supabaseClient
            .from("products")
            .insert(productData);
    }

    button.disabled = false;
    button.textContent = "SAVE ITEM";

    if (result.error) {
        productMessage.textContent = result.error.message;
        return;
    }

    productModal.classList.remove("active");
    await loadProducts();
});

document.getElementById("closeProductModal").addEventListener("click", () => {
    productModal.classList.remove("active");
});

async function toggleProduct(productId) {
    const product = currentProducts.find(item => item.id === productId);

    if (!product) return;

    const { error } = await supabaseClient
        .from("products")
        .update({ active: !product.active })
        .eq("id", productId);

    if (error) {
        alert("Could not update item: " + error.message);
        return;
    }

    await loadProducts();
}

// -----------------------------
// SAFETY: HTML ESCAPING
// -----------------------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// -----------------------------
// CLEAR ALL SALES DATA
// -----------------------------

document.getElementById("clearSales").addEventListener("click", async () => {

    const confirmed = confirm(
        "WARNING!\n\nThis will permanently delete ALL orders and sales records.\n\nYour menu and admin account will remain untouched.\n\nAre you absolutely sure?"
    );

    if (!confirmed) return;

    const button = document.getElementById("clearSales");

    button.disabled = true;
    button.textContent = "CLEARING...";

    const { data, error } = await supabaseClient.rpc(
        "clear_all_sales_data"
    );

    button.disabled = false;
    button.textContent = "✕ CLEAR SALES DATA";

    if (error) {
        alert("Could not clear sales data: " + error.message);
        return;
    }

    await loadOrders();

    alert(`Sales data cleared successfully! ${data} orders deleted.`);
});

// Start
checkSession();
