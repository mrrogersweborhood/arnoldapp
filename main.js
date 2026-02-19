// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-19c)
// - Cookie admin session: /admin/login, /admin/status, /admin/logout (credentials: "include")
// - Search: /admin/nl-search (requires admin cookie)
// - Renders: Customer → Subscriptions → Orders
// - Pretty dates/times + phone formatting (America/Chicago)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const TIMEZONE = "America/Chicago";

  const el = {
    sessionDot: document.getElementById("sessionDot"),
    sessionText: document.getElementById("sessionText"),

    loginPanel: document.getElementById("loginPanel"),
    username: document.getElementById("usernameInput"),
    password: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    loginHint: document.getElementById("loginHint"),

    searchPanel: document.getElementById("searchPanel"),
    query: document.getElementById("queryInput"),
    searchBtn: document.getElementById("searchBtn"),

    results: document.getElementById("results")
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setStatus(loggedIn) {
    if (!el.sessionDot || !el.sessionText) return;
    if (loggedIn) {
      el.sessionDot.classList.remove("off");
      el.sessionText.textContent = "Session: logged in";
    } else {
      el.sessionDot.classList.add("off");
      el.sessionText.textContent = "Session: logged out";
    }

    if (el.searchPanel) el.searchPanel.style.display = loggedIn ? "" : "none";
    if (el.searchBtn) el.searchBtn.disabled = !loggedIn;
    if (el.logoutBtn) el.logoutBtn.disabled = !loggedIn;
  }

  function setHint(msg, isError) {
    if (!el.loginHint) return;
    el.loginHint.textContent = msg || "Admin-only. Uses an HttpOnly cookie session (no localStorage token).";
    el.loginHint.style.color = isError ? "#b91c1c" : "";
  }

  function prettyPhone(v) {
    const raw = String(v ?? "").trim();
    const d = raw.replace(/\D+/g, "");
    if (!d) return "";
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    return raw;
  }

  function prettyDateTime(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const isoLike = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return s;

    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: TIMEZONE,
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

  function money(total, currency) {
    const t = (total === null || total === undefined) ? "" : String(total);
    const c = String(currency || "").toUpperCase();
    return c ? `${t} ${c}` : t;
  }

  async function api(path, { method = "GET", body } = {}) {
    const url = ARNOLD_WORKER_BASE + path;

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined
    });

    const txt = await resp.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }

    return { ok: resp.ok, status: resp.status, data };
  }

  function card(title, innerHtml) {
    return `
      <section class="card">
        <h3>${esc(title)}</h3>
        ${innerHtml || ""}
      </section>
    `;
  }

  function kv(rows) {
    const parts = rows
      .filter(r => r && r.v !== null && r.v !== undefined && String(r.v).trim() !== "")
      .map(r => `<dt>${esc(r.k)}</dt><dd>${r.v}</dd>`)
      .join("");
    return `<dl class="kv">${parts || `<dt>Status</dt><dd class="subtle">No data.</dd>`}</dl>`;
  }

  function badge(text) {
    return `<span class="badge">${esc(text || "")}</span>`;
  }

  function addressLine(a) {
    if (!a) return "";
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
    const bits = [
      name || "",
      a.company || "",
      a.address_1 || "",
      a.address_2 || "",
      [a.city, a.state, a.postcode].filter(Boolean).join(", "),
      a.country || ""
    ].filter(Boolean);
    return bits.join(" • ");
  }

  function renderCustomer(c) {
    if (!c) {
      return card("Customer", `<div class="subtle">No customer record found for this query.</div>`);
    }

    const rows = [
      { k: "Customer ID", v: esc(c.id ?? "") },
      { k: "Username", v: esc(c.username ?? "") },
      { k: "Name", v: esc([c.first_name, c.last_name].filter(Boolean).join(" ").trim()) },
      { k: "Email", v: esc(c.email ?? "") },
      { k: "Phone", v: esc(prettyPhone(c?.billing?.phone || c?.shipping?.phone || "")) },
      { k: "Billing Address", v: esc(addressLine(c.billing)) },
      { k: "Shipping Address", v: esc(addressLine(c.shipping)) }
    ];

    return card("Customer", kv(rows));
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) return card("Subscriptions", `<div class="subtle">No subscriptions found.</div>`);

    const rows = arr.map((s) => {
      const title = `#${s.id || ""} ${s.status ? "• " + s.status : ""}`.trim();
      return `
        <tr>
          <td><b>${esc(title)}</b><div class="subtle">${esc(prettyDateTime(s.start_date))}</div></td>
          <td>${esc(money(s.total, s.currency))}</td>
          <td>${esc(prettyDateTime(s.next_payment_date))}</td>
          <td>${esc(s.payment_method_title || s.payment_method || "")}</td>
        </tr>
      `;
    }).join("");

    return card(
      "Subscriptions",
      `
        <table>
          <thead>
            <tr>
              <th>Subscription</th>
              <th>Total</th>
              <th>Next payment</th>
              <th>Payment method</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) return card("Orders", `<div class="subtle">No orders found.</div>`);

    const rows = arr.map((o) => {
      const items = Array.isArray(o.line_items) ? o.line_items : [];
      const itemsText = items.slice(0, 3).map(li => li?.name).filter(Boolean).join(" • ");
      const status = o.status ? badge(o.status) : "";
      return `
        <tr>
          <td><b>#${esc(o.id ?? "")}</b> ${status}<div class="subtle">${esc(prettyDateTime(o.date_created))}</div></td>
          <td>${esc(money(o.total, o.currency))}</td>
          <td>${esc(o.payment_method_title || o.payment_method || "")}</td>
          <td>${esc(itemsText || "")}</td>
        </tr>
      `;
    }).join("");

    return card(
      "Orders (most recent)",
      `
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  }

  function renderRaw(payload) {
    return card("Raw JSON", `<pre>${esc(JSON.stringify(payload, null, 2))}</pre>`);
  }

  function renderAll(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    el.results.innerHTML = [
      renderCustomer(customer),
      renderSubscriptions(subs),
      renderOrders(orders),
      renderRaw(payload)
    ].join("");
  }

  async function refreshStatus() {
    const r = await api("/admin/status", { method: "GET" });
    const loggedIn = !!r?.data?.loggedIn;
    setStatus(loggedIn);
    return loggedIn;
  }

  async function onLogin() {
    const username = String(el.username?.value || "").trim();
    const password = String(el.password?.value || "").trim();

    setHint("Logging in…", false);
    el.loginBtn.disabled = true;

    try {
      const r = await api("/admin/login", { method: "POST", body: { username, password } });

      if (!r.ok || !r?.data?.success) {
        const msg = (r?.data?.message) ? String(r.data.message) : `Login failed (HTTP ${r.status})`;
        setHint(msg, true);
        setStatus(false);
        return;
      }

      setHint("Logged in.", false);
      await refreshStatus();
      setTimeout(() => el.query?.focus?.(), 0);
    } catch (e) {
      setHint("Login failed (network error). Check DevTools → Network.", true);
      setStatus(false);
    } finally {
      el.loginBtn.disabled = false;
    }
  }

  async function onLogout() {
    setHint("Logging out…", false);
    el.logoutBtn.disabled = true;

    try {
      await api("/admin/logout", { method: "POST" });
    } catch (_) {
      // ignore
    } finally {
      el.password.value = "";
      setStatus(false);
      el.results.innerHTML = "";
      setHint("Admin-only. Uses an HttpOnly cookie session (no localStorage token).", false);
      await refreshStatus();
    }
  }

  async function onSearch() {
    const query = String(el.query?.value || "").trim();
    if (!query) return;

    el.searchBtn.disabled = true;
    el.results.innerHTML = card("Searching…", `<div class="subtle">Please wait.</div>`);

    try {
      const r = await api("/admin/nl-search", { method: "POST", body: { query } });

      if (!r.ok) {
        const errMsg = (typeof r.data === "string") ? r.data : (r.data?.error || r.data?.message || "");
        el.results.innerHTML = card(
          "Error",
          `<div class="subtle">Request failed (HTTP ${esc(r.status)}). ${esc(errMsg)}</div>` + renderRaw(r.data)
        );
        await refreshStatus();
        return;
      }

      renderAll(r.data);
    } catch (e) {
      el.results.innerHTML = card("Error", `<div class="subtle">Network error. Check DevTools → Network.</div>`);
    } finally {
      el.searchBtn.disabled = false;
    }
  }

  function bind() {
    if (!el.loginBtn || !el.logoutBtn || !el.searchBtn) return;

    el.loginBtn.addEventListener("click", onLogin);
    el.logoutBtn.addEventListener("click", onLogout);

    el.searchBtn.addEventListener("click", onSearch);
    el.query?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onSearch();
    });

    el.password?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onLogin();
    });
  }

  async function boot() {
    bind();
    await refreshStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

// 🔴 main.js
