// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-18a)
// - Pretty OkObserver-style cards (no CRT)
// - Renders wp-admin-ish sections (General/Billing/Shipping/Items/Related)
// - Still provides Raw JSON toggle for debugging
// NOTE: This is for the ArnoldApp site (mrrogersweborhood.github.io/arnoldapp/).

(() => {
  "use strict";

  // IMPORTANT: must point to your Arnold admin worker service base
  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    app: document.getElementById("app"),
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pretty(obj) {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  function money(total, currency) {
    const t = (total === null || total === undefined) ? "" : String(total);
    const c = (currency || "").toUpperCase();
    return c ? `${t} ${c}` : t;
  }

  function statusBadge(status) {
    const s = String(status || "unknown");
    return `<span class="badge">${esc(s)}</span>`;
  }

  function prettyDateTime(value) {
    const s = (value === null || value === undefined) ? "" : String(value).trim();
    if (!s) return "";
    // Common Woo strings: "2025-12-16T12:38:35" or "2025-12-16 12:38:35"
    const isoLike = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return s;
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
      }).format(d);
    } catch (_) {
      return d.toLocaleString();
    }
  }

  function prettyPhone(value) {
    const raw = (value === null || value === undefined) ? "" : String(value);
    const digits = raw.replace(/\D+/g, "");
    if (!digits) return "";
    // US numbers: 10 digits or 11 digits starting with 1
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return raw.trim();
  }

  function dlRow(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
  }

  function renderAddressBlock(title, addr) {
    if (!addr) return "";
    const lines = [];
    const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim();
    if (name) lines.push(name);
    if (addr.company) lines.push(addr.company);
    if (addr.address_1) lines.push(addr.address_1);
    if (addr.address_2) lines.push(addr.address_2);
    const cityLine = [addr.city, addr.state, addr.postcode].filter(Boolean).join(", ").replace(", ,", ",").trim();
    if (cityLine) lines.push(cityLine);
    if (addr.country) lines.push(addr.country);

    return `
      <div class="kv">
        <h4>${esc(title)}</h4>
        <dl>
          ${dlRow("Address", lines.join(" • "))}
          ${dlRow("Phone", prettyPhone(addr.phone))}
          ${dlRow("Email", addr.email)}
        </dl>
      </div>
    `;
  }

  function renderItemsTable(title, items) {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) return "";
    const rows = arr.slice(0, 25).map((li) => `
      <tr>
        <td>${esc(li.name || "")}</td>
        <td class="mono">${esc(li.sku || "")}</td>
        <td class="mono">${esc(li.quantity ?? "")}</td>
        <td class="mono">${esc(li.total ?? "")}</td>
      </tr>
    `).join("");

    return `
      <div class="kv">
        <h4>${esc(title)}</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th><th>SKU</th><th>Qty</th><th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderMetaBlock(meta) {
    const arr = Array.isArray(meta) ? meta : [];
    if (!arr.length) return "";
    const rows = arr.slice(0, 40).map((m) => `
      <tr><td class="mono">${esc(m.key)}</td><td class="mono">${esc(m.value)}</td></tr>
    `).join("");
    return `
      <div class="kv">
        <h4>Meta (safe)</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderActions(obj) {
    const id = obj?.id ?? null;
    const type = obj?.status !== undefined && obj?.payment_method !== undefined ? "order" : null;

    const links = [];
    if (type === "order" && id) {
      links.push(`<a class="btn-mini" target="_blank" rel="noreferrer" href="https://okobserver.org/wp-admin/post.php?post=${encodeURIComponent(String(id))}&action=edit">Open in wp-admin</a>`);
    }
    return links.length
      ? `<div class="actions">${links.join(" ")}</div>`
      : "";
  }

  function card(title, subtitle, badgeHtml, bodyHtml, rawObj) {
    const raw = rawObj ? `
      <details class="raw">
        <summary>Raw JSON</summary>
        <pre>${esc(pretty(rawObj))}</pre>
      </details>
    ` : "";

    return `
      <section class="card">
        <div class="card-head">
          <div>
            <h3>${esc(title)}</h3>
            <div class="sub">${esc(subtitle || "")}</div>
          </div>
          <div class="badges">${badgeHtml || ""}</div>
        </div>
        <div class="card-body">
          ${bodyHtml || ""}
          ${raw}
        </div>
      </section>
    `;
  }

  function renderOrder(o, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Order ID", o.id)}
          ${dlRow("Status", o.status)}
          ${dlRow("Total", money(o.total, o.currency))}
          ${dlRow("Discount", o.discount_total)}
          ${dlRow("Shipping", o.shipping_total)}
          ${dlRow("Created", prettyDateTime(o.date_created))}
          ${dlRow("Paid", prettyDateTime(o.date_paid))}
          ${dlRow("Payment", o.payment_method_title || o.payment_method)}
          ${dlRow("Customer ID", o.customer_id)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", o.billing)}
        ${renderAddressBlock("Shipping", o.shipping)}
      </div>
      ${renderItemsTable("Items", o.line_items)}
      ${renderMetaBlock(o.meta_data)}
      ${renderActions(o)}
    `;

    return card(
      `Order ${o.number ? "#" + o.number : (o.id ? "#" + o.id : "")}`.trim(),
      "WooCommerce Order",
      statusBadge(o.status),
      blocks,
      raw
    );
  }

  function renderCustomer(c, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Customer ID", c.id)}
          ${dlRow("Name", [c.first_name, c.last_name].filter(Boolean).join(" "))}
          ${dlRow("Username", c.username)}
          ${dlRow("Email", c.email)}
          ${dlRow("Role", c.role)}
          ${dlRow("Created", prettyDateTime(c.date_created))}
          ${dlRow("Paying customer", c.is_paying_customer)}
          ${dlRow("Orders", c.orders_count)}
          ${dlRow("Total spent", c.total_spent)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", c.billing)}
        ${renderAddressBlock("Shipping", c.shipping)}
      </div>
      ${renderMetaBlock(c.meta_data)}
      ${renderActions(c)}
    `;

    return card(
      `Customer ${c.id ? "#" + c.id : ""}`.trim(),
      "WooCommerce Customer",
      `<span class="badge">customer</span>`,
      blocks,
      raw
    );
  }

  function renderSubscription(s, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Subscription ID", s.id)}
          ${dlRow("Status", s.status)}
          ${dlRow("Total", money(s.total, s.currency))}
          ${dlRow("Customer ID", s.customer_id)}
          ${dlRow("Parent order", s.parent_id)}
          ${dlRow("Start", prettyDateTime(s.start_date))}
          ${dlRow("Next payment", prettyDateTime(s.next_payment_date))}
          ${dlRow("End", prettyDateTime(s.end_date))}
          ${dlRow("Payment", s.payment_method_title || s.payment_method)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", s.billing)}
        ${renderAddressBlock("Shipping", s.shipping)}
      </div>
      ${renderItemsTable("Items", s.line_items)}
      ${renderMetaBlock(s.meta_data)}
      ${renderActions(s)}
    `;

    return card(
      `Subscription #${s.id || ""}`.trim(),
      "WooCommerce Subscription",
      statusBadge(s.status),
      blocks,
      raw
    );
  }

  function renderMembership(m, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Membership ID", m.id)}
          ${dlRow("Status", m.status)}
          ${dlRow("Plan", m.plan)}
          ${dlRow("Plan ID", m.plan_id)}
          ${dlRow("Customer ID", m.customer_id)}
          ${dlRow("Start", prettyDateTime(m.start_date))}
          ${dlRow("End", prettyDateTime(m.end_date))}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
      </div>
      ${renderMetaBlock(m.meta_data)}
      ${renderActions(m)}
    `;

    return card(
      `Membership #${m.id || ""}`.trim(),
      "WooCommerce Membership",
      statusBadge(m.status),
      blocks,
      raw
    );
  }

  function renderCoupon(c, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Coupon ID", c.id)}
          ${dlRow("Code", c.code)}
          ${dlRow("Amount", c.amount)}
          ${dlRow("Type", c.discount_type)}
          ${dlRow("Expires", prettyDateTime(c.date_expires))}
          ${dlRow("Usage", c.usage_count)}
          ${dlRow("Limit", c.usage_limit)}
          ${dlRow("Free shipping", c.free_shipping)}
          ${dlRow("Min", c.minimum_amount)}
          ${dlRow("Max", c.maximum_amount)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
      </div>
      ${renderMetaBlock(c.meta_data)}
    `;

    return card(
      `Coupon ${c.code ? `"${c.code}"` : ""}`.trim(),
      "WooCommerce Coupon",
      `<span class="badge">coupon</span>`,
      blocks,
      raw
    );
  }

  function appShell() {
    return `
      <header class="topbar">
        <div class="brand">
          <div class="title">Arnold Admin</div>
          <div class="tag">WooCommerce admin read console (cookie session)</div>
        </div>
        <div class="session" id="sessionPill">
          <span class="dot" aria-hidden="true"></span>
          <span class="txt">Session: unknown</span>
        </div>
      </header>

      <main class="wrap">
        <section class="card search-card">
          <div class="search-row">
            <input id="q" class="search" placeholder='Try: "orders for email jane@x.com" or "order #1234" or "coupon SAVE10"' />
            <button id="btn" class="btn">Search</button>
          </div>
          <div class="hint">Output always renders in this order: <b>Customer → Subscriptions → Orders</b>.</div>
        </section>

        <div id="out"></div>
      </main>
    `;
  }

  function injectStyles() {
    const css = `
      :root{
        --blue:#1E90FF;
        --bg:#eef5ff;
        --card:#fff;
        --text:#0b1220;
        --muted:#5a6a85;
        --border:rgba(0,0,0,.08);
        --shadow:0 12px 30px rgba(0,0,0,.10);
        --radius:18px;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      *{box-sizing:border-box}
      body{
        margin:0;
        font-family:var(--sans);
        color:var(--text);
        background:linear-gradient(180deg, rgba(30,144,255,.14), rgba(255,255,255,.0) 260px), var(--bg);
      }
      .topbar{
        position:sticky; top:0; z-index:10;
        background:var(--blue);
        color:#fff;
        padding:14px 18px;
        display:flex; align-items:center; justify-content:space-between;
        box-shadow:0 10px 25px rgba(0,0,0,.18);
      }
      .brand .title{font-weight:800; letter-spacing:.2px; font-size:18px; line-height:1.1}
      .brand .tag{opacity:.9; font-size:12px}
      .session{
        display:flex; align-items:center; gap:8px;
        background:rgba(255,255,255,.14);
        border:1px solid rgba(255,255,255,.22);
        padding:8px 10px;
        border-radius:999px;
        font-size:12px;
        white-space:nowrap;
      }
      .dot{width:10px;height:10px;border-radius:50%; background:#ffd54a; box-shadow:0 0 0 4px rgba(255,213,74,.25)}
      .dot.on{background:#36d399; box-shadow:0 0 0 4px rgba(54,211,153,.25)}
      .dot.off{background:#ff5b5b; box-shadow:0 0 0 4px rgba(255,91,91,.22)}
      .wrap{max-width:1100px; margin:18px auto; padding:0 14px 40px}
      .card{
        background:var(--card);
        border:1px solid var(--border);
        border-radius:var(--radius);
        box-shadow:var(--shadow);
        margin:16px 0;
        overflow:hidden;
      }
      .card-head{
        display:flex; align-items:flex-start; justify-content:space-between; gap:10px;
        padding:16px 18px 10px;
        border-bottom:1px solid var(--border);
      }
      .card-head h3{margin:0; font-size:16px; font-weight:800}
      .sub{font-size:12px; color:var(--muted); margin-top:4px}
      .badges{display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end}
      .badge{
        display:inline-flex; align-items:center; gap:6px;
        border:1px solid var(--border);
        padding:6px 10px;
        border-radius:999px;
        font-size:12px;
        background:#f7fbff;
      }
      .card-body{padding:14px 18px 18px}
      .search-card{padding:0}
      .search-row{
        display:flex; gap:10px; padding:16px 18px 10px; align-items:center;
      }
      .search{
        flex:1;
        padding:14px 14px;
        border-radius:14px;
        border:1px solid var(--border);
        outline:none;
        font-size:14px;
        background:#fff;
      }
      .btn{
        background:var(--blue);
        color:#fff;
        border:none;
        border-radius:14px;
        padding:12px 16px;
        font-weight:800;
        cursor:pointer;
        box-shadow:0 10px 25px rgba(30,144,255,.30);
      }
      .btn:active{transform:translateY(1px)}
      .hint{padding:0 18px 16px; color:var(--muted); font-size:12px}
      .grid-3{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:14px;
        margin-top:6px;
      }
      @media (max-width: 980px){
        .grid-3{grid-template-columns: 1fr}
      }
      .kv h4{margin:0 0 8px; font-size:13px; color:var(--muted); letter-spacing:.2px}
      dl{margin:0}
      dt{font-size:11px; color:var(--muted); margin-top:10px}
      dd{margin:2px 0 0; font-size:13px}
      .mono{font-family:var(--mono)}
      .table-wrap{overflow:auto; border:1px solid var(--border); border-radius:14px}
      table{width:100%; border-collapse:collapse; font-size:13px}
      th, td{padding:10px 12px; border-bottom:1px solid var(--border); text-align:left}
      thead th{background:#f7fbff; color:var(--muted); font-size:12px; font-weight:800}
      tr:last-child td{border-bottom:none}
      .actions{margin-top:12px}
      .btn-mini{
        display:inline-flex;
        border:1px solid var(--border);
        padding:8px 10px;
        border-radius:12px;
        color:var(--blue);
        text-decoration:none;
        font-weight:800;
        font-size:12px;
        background:#fff;
      }
      details.raw{margin-top:14px}
      details.raw summary{cursor:pointer; color:var(--muted); font-weight:800}
      pre{margin:10px 0 0; padding:12px; background:#0b1220; color:#eaf2ff; border-radius:14px; overflow:auto; font-size:12px}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function api(path, opts) {
    const url = ARNOLD_WORKER_BASE + path;
    const init = {
      method: opts?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts?.headers || {})
      },
      credentials: "include",
      body: opts?.body ? JSON.stringify(opts.body) : undefined
    };

    const resp = await fetch(url, init);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: resp.ok, status: resp.status, data };
  }

  function setSessionPill(isOn) {
    const pill = document.getElementById("sessionPill");
    if (!pill) return;
    const dot = pill.querySelector(".dot");
    const txt = pill.querySelector(".txt");
    if (isOn === true) {
      dot?.classList.add("on");
      dot?.classList.remove("off");
      if (txt) txt.textContent = "Session: logged in";
    } else if (isOn === false) {
      dot?.classList.add("off");
      dot?.classList.remove("on");
      if (txt) txt.textContent = "Session: logged out";
    } else {
      dot?.classList.remove("on");
      dot?.classList.remove("off");
      if (txt) txt.textContent = "Session: unknown";
    }
  }

  async function refreshTokenStatus() {
    const r = await api("/admin/status", { method: "GET" });
    setSessionPill(!!r?.data?.loggedIn);
  }

  function renderOutput(payload) {
    const out = document.getElementById("out");
    if (!out) return;

    if (!payload || typeof payload !== "object") {
      out.innerHTML = card("Error", "Invalid response", `<span class="badge">error</span>`, `<div class="kv"><dl>${dlRow("Message", String(payload))}</dl></div>`, payload);
      return;
    }

    const ctx = payload.context || {};
    const cust = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    const blocks = [];

    blocks.push(
      cust
        ? renderCustomer(cust, payload)
        : card("Customer", "Customer record", `<span class="badge">customer</span>`, `<div class="kv"><dl>${dlRow("Status", "No customer record found for this query.")}</dl></div>`, payload)
    );

    blocks.push(
      subs.length
        ? subs.map((s) => renderSubscription(s, s)).join("")
        : card("Subscriptions", "No subscriptions", `<span class="badge">subscriptions</span>`, `<div class="kv"><dl>${dlRow("Status", "No subscriptions found.")}</dl></div>`, payload)
    );

    blocks.push(
      orders.length
        ? orders.map((o) => renderOrder(o, o)).join("")
        : card("Orders", "No orders", `<span class="badge">orders</span>`, `<div class="kv"><dl>${dlRow("Status", "No orders found.")}</dl></div>`, payload)
    );

    out.innerHTML = blocks.join("");
  }

  async function doSearch() {
    const q = document.getElementById("q");
    const btn = document.getElementById("btn");
    const query = String(q?.value || "").trim();
    if (!query) return;

    if (btn) btn.disabled = true;
    try {
      const r = await api("/admin/nl-search", { method: "POST", body: { query } });
      if (!r.ok) {
        renderOutput({ error: true, status: r.status, detail: r.data, context: { customer: null, subscriptions: [], orders: [] } });
        return;
      }
      renderOutput(r.data);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function boot() {
    injectStyles();
    els.app.innerHTML = appShell();
    els.q = document.getElementById("q");
    els.btn = document.getElementById("btn");

    els.btn.addEventListener("click", doSearch);
    els.q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    refreshTokenStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

// 🔴 main.js
