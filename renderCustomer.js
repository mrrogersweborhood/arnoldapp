// 🟢 renderCustomer.js
// Arnold Admin — SAFE SPLIT (Build 2026-03-10R2-renderCustomer)
// (Markers are comments only: 🟢 renderCustomer.js ... 🔴 renderCustomer.js)

/* Customer and address renderers. Plain script; no modules. */

// -----------------------------
// ADDRESS / CUSTOMER CARDS
// -----------------------------
function renderCustomerCard(customer) {
  const id = customer?.id ?? "—";
  const email = String(customer?.email ?? customer?.billing?.email ?? "").trim() || "—";
  const username = customer?.username ?? customer?.email ?? "—";
  const fn = (customer?.first_name ?? "").trim();
  const ln = (customer?.last_name ?? "").trim();
  const name = [fn, ln].filter(Boolean).join(" ").trim() || "—";

  return `
    <div class="aa-card">
      <div class="aa-card-title">Customer</div>

      <div class="aa-tiles customer">
        <div class="aa-tile">
          <div class="aa-label">Name</div>
          <div class="aa-value">${esc(String(name))}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Email</div>
          ${renderValueWithCopy(String(email), String(email))}
        </div>

        <div class="aa-tile">
          <div class="aa-label">Customer ID</div>
          <div class="aa-value">${esc(String(id))}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Username</div>
          <div class="aa-value">${esc(String(username))}</div>
        </div>
      </div>

      <div class="aa-copy-row" style="margin-top:12px;">
        <a
          class="aa-copy-btn"
          href="https://okobserver.org/wp-admin/user-edit.php?user_id=${esc(String(id))}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open WP
        </a>

        <a
          class="aa-copy-btn"
          href="https://okobserver.org/wp-admin/edit.php?post_type=shop_subscription&_customer_user=${esc(String(id))}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Subscriptions
        </a>

        <a
          class="aa-copy-btn"
          href="https://okobserver.org/wp-admin/edit.php?post_type=shop_order&_customer_user=${esc(String(id))}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Orders
        </a>

        <a
          class="aa-copy-btn"
          href="https://okobserver.org/wp-admin/post-new.php?post_type=shop_order&customer_id=${esc(String(id))}"
          target="_blank"
          rel="noopener noreferrer"
        >
          New Order
        </a>
      </div>
    </div>
  `;
}

function renderAddressBlock(title, addr, fallbackAddr) {
  const a = addr || null;
  const f = fallbackAddr || null;

  const first = (a?.first_name ?? "").trim();
  const last = (a?.last_name ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ").trim();

  const addr1 = (a?.address_1 ?? "").trim();
  const addr2 = (a?.address_2 ?? "").trim();
  const city = (a?.city ?? "").trim();
  const state = (a?.state ?? "").trim();
  const zip = (a?.postcode ?? "").trim();
  const country = (a?.country ?? "").trim();

  const email = (a?.email ?? "").trim();
  const phone = fmtPhone((a?.phone ?? "").trim());

  const hasAny =
    name || addr1 || addr2 || city || state || zip || country || email || phone;

  // Shipping fallback: if missing, show "Same as billing" and use billing fields
  const sameAsBilling = title.toLowerCase() === "shipping" && !hasAny && f;

  const pick = (key) => {
    if (!sameAsBilling) return (a?.[key] ?? "");
    return (f?.[key] ?? "");
  };

  const showName = (() => {
    const fn = String(pick("first_name") ?? "").trim();
    const ln = String(pick("last_name") ?? "").trim();
    const nm = [fn, ln].filter(Boolean).join(" ").trim();
    if (nm) return nm;
    if (sameAsBilling) return "Same as billing";
    return "—";
  })();

  const showAddrLines = (() => {
    const b1 = String(pick("address_1") ?? "").trim();
    const b2 = String(pick("address_2") ?? "").trim();
    const c = String(pick("city") ?? "").trim();
    const s = String(pick("state") ?? "").trim();
    const z = String(pick("postcode") ?? "").trim();
    const co = String(pick("country") ?? "").trim();

    const lines = [];
    if (b1) lines.push(b1);
    if (b2) lines.push(b2);
    const cs = [c, s].filter(Boolean).join(", ");
    const csz = [cs, z].filter(Boolean).join(" ");
    if (csz) lines.push(csz);
    if (co) lines.push(co);
    return lines.length ? lines.join("<br>") : "—";
  })();

  const showEmail = (() => {
    const e = String(pick("email") ?? "").trim();
    return e || "—";
  })();

  const showPhone = (() => {
    const p = fmtPhone(String(pick("phone") ?? "").trim());
    return p || "—";
  })();

  return `
    <div class="aa-card">
      <div class="aa-card-title">${esc(title)}</div>

      <div class="aa-tiles onecol">
        <div class="aa-tile">
          <div class="aa-label">Name</div>
          <div class="aa-value">${esc(showName)}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Address</div>
          <div class="aa-value">${showAddrLines}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Email</div>
          <div class="aa-value">${esc(showEmail)}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Phone</div>
          <div class="aa-value">${esc(showPhone)}</div>
        </div>
      </div>
    </div>
  `;
}

// 🔴 renderCustomer.js
