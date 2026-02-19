// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-19e)
// Uses existing DOM in index.html (loginPanel/searchPanel/results), cookie session auth,
// pretty phone/date formatting, and renders in order: Customer → Subscriptions → Orders.

(() => {
  "use strict";

  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const $ = (id) => document.getElementById(id);

  const els = {
    sessionDot: $("sessionDot"),
    sessionText: $("sessionText"),
    loginPanel: $("loginPanel"),
    usernameInput: $("usernameInput"),
    passwordInput: $("passwordInput"),
    loginBtn: $("loginBtn"),
    logoutBtn: $("logoutBtn"),
    loginHint: $("loginHint"),
    searchPanel: $("searchPanel"),
    queryInput: $("queryInput"),
    searchBtn: $("searchBtn"),
    results: $("results"),
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toTitle(s) {
    const x = String(s ?? "").trim();
    if (!x) return "";
    return x.charAt(0).toUpperCase() + x.slice(1);
  }

  function isDigitsOnly(s) {
    return /^[0-9]+$/.test(String(s ?? ""));
  }

  function formatPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const digits = s.replace(/\D+/g, "");
    // US 10-digit
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // US 11-digit starting with 1
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    // fallback: return original
    return s;
  }

  function formatDateTime(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;

    try {
      // Local time, nice “Feb 18, 2026, 4:27 PM”
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  function money(total, currency) {
    const n = Number(total);
    const cur = String(currency || "USD");
    if (!Number.isFinite(n)) return String(total ?? "");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur}`;
    }
  }

  async function api(path, init) {
    const url = `${ARNOLD_WORKER_BASE}${path}`;
    const resp = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(init && init.headers ? init.headers : {}),
      },
    });
    const txt = await resp.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = txt;
    }
    return { resp, data };
  }

  function setSessionPill(loggedIn) {
    if (!els.sessionDot || !els.sessionText) return;
    if (loggedIn) {
      els.sessionDot.classList.remove("off");
      els.sessionDot.classList.add("on");
      els.sessionText.textContent = "Session: logged in";
    } else {
      els.sessionDot.classList.remove("on");
      els.sessionDot.classList.add("off");
      els.sessionText.textContent = "Session: logged out";
    }
  }

  function setLoggedInUI(loggedIn) {
    // login
    if (els.loginBtn) els.loginBtn.disabled = loggedIn;
    if (els.logoutBtn) els.logoutBtn.disabled = !loggedIn;

    // search panel visible only if logged in
    if (els.searchPanel) els.searchPanel.style.display = loggedIn ? "" : "none";
    if (els.searchBtn) els.searchBtn.disabled = !loggedIn;

    // hint
    if (els.loginHint) {
      els.loginHint.textContent = loggedIn
        ? "Admin-only. Uses an HttpOnly cookie session (no localStorage token)."
        : "Admin-only. Uses an HttpOnly cookie session (no localStorage token).";
    }
  }

  async function refreshStatus() {
    const { resp, data } = await api("/admin/status", { method: "GET" });
    const loggedIn = !!(resp.ok && data && data.loggedIn);
    setSessionPill(loggedIn);
    setLoggedInUI(loggedIn);
    return loggedIn;
  }

  function renderKeyValRows(rows) {
    return rows
      .map(
        ({ k, v }) => `
        <div class="kv-row">
          <div class="kv-k">${esc(k)}</div>
          <div class="kv-v">${v}</div>
        </div>`
      )
      .join("");
  }

  function fmtAddressLine(a) {
    if (!a) return "";
    const parts = [];
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
    if (name) parts.push(name);
    const addr = [a.address_1, a.address_2].filter(Boolean).join(" ").trim();
    if (addr) parts.push(addr);
    const cityLine = [a.city, a.state, a.postcode].filter(Boolean).join(", ").replace(", ,", ",").trim();
    if (cityLine) parts.push(cityLine);
    if (a.country) parts.push(a.country);
    return parts.join(" • ");
  }

  function ensureContextShape(context) {
    const c = context && typeof context === "object" ? context : {};
    return {
      customer: c.customer || null,
      subscriptions: Array.isArray(c.subscriptions) ? c.subscriptions : [],
      orders: Array.isArray(c.orders) ? c.orders : [],
    };
  }

  function renderCustomerCard(customer) {
    if (!customer) {
      return `
        <section class="card">
          <h3>Customer</h3>
          <div class="muted">No customer record found for this query.</div>
        </section>`;
    }

    const name =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      customer.name ||
      "";

    const email = customer.email || customer?.billing?.email || "";
    const phone = customer?.billing?.phone || customer.phone || "";

    const billing = fmtAddressLine(customer.billing);
    const shipping = fmtAddressLine(customer.shipping);

    const rows = [
      customer.id != null ? { k: "Customer ID", v: esc(customer.id) } : null,
      customer.username ? { k: "Username", v: esc(customer.username) } : null,
      name ? { k: "Name", v: esc(name) } : null,
      email ? { k: "Email", v: `<span class="mono">${esc(email)}</span>` } : null,
      phone ? { k: "Phone", v: `<span class="mono">${esc(formatPhone(phone))}</span>` } : null,
      billing ? { k: "Billing Address", v: esc(billing) } : null,
      shipping ? { k: "Shipping Address", v: esc(shipping) } : null,
    ].filter(Boolean);

    return `
      <section class="card">
        <h3>Customer</h3>
        <div class="kv">
          ${renderKeyValRows(rows)}
        </div>
      </section>`;
  }

  function renderSubscriptionsCard(subs) {
    if (!subs.length) {
      return `
        <section class="card">
          <h3>Subscriptions</h3>
          <div class="muted">No subscriptions found.</div>
        </section>`;
    }

    const rows = subs
      .slice(0, 25)
      .map((s) => {
        const id = s.id != null ? `#${s.id}` : "";
        const status = s.status ? toTitle(s.status) : "";
        const total = money(s.total, s.currency);
        const nextPay = s.next_payment_date ? formatDateTime(s.next_payment_date) : "";
        const pm = s.payment_method_title ? s.payment_method_title : (s.payment_method || "");
        const created = s.start_date ? formatDateTime(s.start_date) : "";

        return `
          <div class="rowline">
            <div class="col a">
              <div class="strong">${esc(id)}</div>
              <div class="muted small">${esc(created)}</div>
            </div>
            <div class="col b">${esc(status)}</div>
            <div class="col c">${esc(total)}</div>
            <div class="col d">${esc(nextPay)}</div>
            <div class="col e">${esc(pm)}</div>
          </div>`;
      })
      .join("");

    return `
      <section class="card">
        <h3>Subscriptions</h3>
        <div class="table">
          <div class="head rowline">
            <div class="col a muted small">SUBSCRIPTION</div>
            <div class="col b muted small">STATUS</div>
            <div class="col c muted small">TOTAL</div>
            <div class="col d muted small">NEXT PAYMENT</div>
            <div class="col e muted small">PAYMENT METHOD</div>
          </div>
          ${rows}
        </div>
      </section>`;
  }

  function renderOrdersCard(orders) {
    if (!orders.length) {
      return `
        <section class="card">
          <h3>Orders</h3>
          <div class="muted">No orders found.</div>
        </section>`;
    }

    const rows = orders
      .slice(0, 25)
      .map((o) => {
        const id = o.id != null ? `#${o.id}` : "";
        const status = o.status ? toTitle(o.status) : "";
        const total = money(o.total, o.currency);
        const created = o.date_created ? formatDateTime(o.date_created) : "";
        const pm = o.payment_method_title ? o.payment_method_title : (o.payment_method || "");
        const items = Array.isArray(o.line_items)
          ? o.line_items.slice(0, 3).map((li) => li?.name).filter(Boolean).join(" • ")
          : "";

        return `
          <div class="rowline">
            <div class="col a">
              <div class="strong">${esc(id)}</div>
              <div class="muted small">${esc(created)}</div>
            </div>
            <div class="col b">
              <span class="pill">${esc(status)}</span>
            </div>
            <div class="col c">${esc(total)}</div>
            <div class="col d">${esc(pm)}</div>
            <div class="col e">${esc(items)}</div>
          </div>`;
      })
      .join("");

    return `
      <section class="card">
        <h3>Orders (most recent)</h3>
        <div class="table">
          <div class="head rowline">
            <div class="col a muted small">ORDER</div>
            <div class="col b muted small">STATUS</div>
            <div class="col c muted small">TOTAL</div>
            <div class="col d muted small">PAYMENT</div>
            <div class="col e muted small">ITEMS</div>
          </div>
          ${rows}
        </div>
      </section>`;
  }

  function renderRawJsonCard(raw) {
    const jsonStr =
      typeof raw === "string" ? raw : JSON.stringify(raw ?? {}, null, 2);

    return `
      <section class="card">
        <h3>Raw JSON</h3>
        <pre class="code">${esc(jsonStr)}</pre>
      </section>`;
  }

  function renderAll(context, rawResponse) {
    const ctx = ensureContextShape(context);

    const html = [
      renderCustomerCard(ctx.customer),
      renderSubscriptionsCard(ctx.subscriptions),
      renderOrdersCard(ctx.orders),
      renderRawJsonCard(rawResponse),
    ].join("\n");

    els.results.innerHTML = html;
  }

  async function doLogin() {
    const username = String(els.usernameInput?.value || "").trim();
    const password = String(els.passwordInput?.value || "").trim();

    if (!username || !password) {
      if (els.loginHint) els.loginHint.textContent = "Username + password required.";
      return;
    }

    if (els.loginBtn) els.loginBtn.disabled = true;
    if (els.loginHint) els.loginHint.textContent = "Logging in…";

    try {
      const { resp, data } = await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok || !data?.success) {
        const msg =
          (data && (data.message || data.error)) ||
          `Login failed (${resp.status})`;
        if (els.loginHint) els.loginHint.textContent = msg;
        await refreshStatus();
        return;
      }

      // Clear password box after successful login
      if (els.passwordInput) els.passwordInput.value = "";

      if (els.loginHint) els.loginHint.textContent = "Logged in.";
      await refreshStatus();
    } finally {
      if (els.loginBtn) els.loginBtn.disabled = false;
    }
  }

  async function doLogout() {
    if (els.logoutBtn) els.logoutBtn.disabled = true;
    try {
      await api("/admin/logout", { method: "POST", body: JSON.stringify({}) });
      els.results.innerHTML = "";
      await refreshStatus();
    } finally {
      if (els.logoutBtn) els.logoutBtn.disabled = false;
    }
  }

  async function doSearch() {
    const q = String(els.queryInput?.value || "").trim();
    if (!q) return;

    if (els.searchBtn) els.searchBtn.disabled = true;

    try {
      const { resp, data } = await api("/admin/nl-search", {
        method: "POST",
        body: JSON.stringify({ query: q }),
      });

      if (resp.status === 401 || resp.status === 403) {
        // Session expired / not admin
        els.results.innerHTML = "";
        if (els.loginHint) els.loginHint.textContent = "Admin access required.";
        await refreshStatus();
        return;
      }

      if (!resp.ok) {
        renderAll({ customer: null, subscriptions: [], orders: [] }, data);
        return;
      }

      // Your worker returns {context:{customer,subscriptions,orders}, ...}
      const context = data?.context || { customer: null, subscriptions: [], orders: [] };
      renderAll(context, data);
    } finally {
      if (els.searchBtn) els.searchBtn.disabled = false;
    }
  }

  function bindUI() {
    if (els.loginBtn) els.loginBtn.addEventListener("click", doLogin);
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", doLogout);

    if (els.passwordInput) {
      els.passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }

    if (els.searchBtn) els.searchBtn.addEventListener("click", doSearch);
    if (els.queryInput) {
      els.queryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }
  }

  async function boot() {
    bindUI();
    await refreshStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

// 🔴 main.js