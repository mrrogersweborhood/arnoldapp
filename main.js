// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-19b)
// - Cookie login (NO localStorage token)
// - Always renders: Customer → Subscriptions → Orders
// - Uses context.customer / context.subscriptions / context.orders from Worker

(() => {
  "use strict";

  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    q: document.getElementById("queryInput"),
    btn: document.getElementById("searchBtn"),
    results: document.getElementById("results"),

    sessionDot: document.getElementById("sessionDot"),
    sessionText: document.getElementById("sessionText"),

    loginPanel: document.getElementById("loginPanel"),
    searchPanel: document.getElementById("searchPanel"),
    user: document.getElementById("usernameInput"),
    pass: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    loginHint: document.getElementById("loginHint")
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function prettyJson(obj) {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  async function api(path, opts) {
    const resp = await fetch(`${ARNOLD_WORKER_BASE}${path}`, {
      ...opts,
      credentials: "include"
    });
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { ok: false, error: "Non-JSON response", raw: text }; }
    return { resp, data };
  }

  function setSessionUI(loggedIn) {
    if (loggedIn) {
      els.sessionDot.classList.remove("off");
      els.sessionText.textContent = "Session: logged in";
      els.logoutBtn.disabled = false;
      els.btn.disabled = false;
      els.searchPanel.style.display = "";
    } else {
      els.sessionDot.classList.add("off");
      els.sessionText.textContent = "Session: logged out";
      els.logoutBtn.disabled = true;
      els.btn.disabled = true;
      els.searchPanel.style.display = "none";
    }
  }

  async function refreshSession() {
    try {
      const { resp, data } = await api("/admin/status", { method: "GET" });
      const loggedIn = !!(resp.ok && data && data.loggedIn);
      setSessionUI(loggedIn);
      return loggedIn;
    } catch (_) {
      setSessionUI(false);
      return false;
    }
  }

  function renderCard(title, innerHtml, subtitle) {
    return `
      <div class="card">
        <h3>${esc(title)}${subtitle ? ` <span class="subtle">${esc(subtitle)}</span>` : ""}</h3>
        ${innerHtml}
      </div>
    `;
  }

  function dlRow(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
  }

  function renderAddressInline(addr) {
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
    return lines.join(" • ");
  }

  function renderCustomerBlock(customer) {
    if (!customer) {
      return renderCard("Customer", `<div class="subtle">No customer record found for this query.</div>`);
    }

    const name = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
    const billing = customer.billing || null;
    const shipping = customer.shipping || null;

    const html = `
      <dl class="kv">
        ${dlRow("Customer ID", customer.id)}
        ${dlRow("Username", customer.username)}
        ${dlRow("Name", name)}
        ${dlRow("Email", customer.email || billing?.email || "")}
        ${dlRow("Phone", billing?.phone || "")}
        ${dlRow("Billing Address", renderAddressInline(billing))}
        ${dlRow("Shipping Address", renderAddressInline(shipping))}
      </dl>
    `;
    return renderCard("Customer", html, customer.id ? "" : "(from order billing)");
  }

  function renderSubscriptionsBlock(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      return renderCard("Subscriptions", `<div class="subtle">No subscriptions found.</div>`);
    }

    const rows = arr.map(s => `
      <tr>
        <td><b>#${esc(s.id)}</b> <span class="badge">${esc(s.status || "")}</span><div class="subtle">${esc(s.start_date || "")}</div></td>
        <td>${esc(s.total || "")} ${esc((s.currency || "").toUpperCase())}</td>
        <td>${esc(s.next_payment_date || "")}</td>
        <td>${esc(s.payment_method_title || s.payment_method || "")}</td>
      </tr>
    `).join("");

    return renderCard(
      "Subscriptions",
      `
        <table>
          <thead><tr><th>Subscription</th><th>Total</th><th>Next Payment</th><th>Payment Method</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  }

  function renderOrdersBlock(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      return renderCard("Orders", `<div class="subtle">No orders found.</div>`);
    }

    const rows = arr.map(o => `
      <tr>
        <td><b>#${esc(o.id)}</b> <span class="badge">${esc(o.status || "")}</span><div class="subtle">${esc(o.date_created || "")}</div></td>
        <td>${esc(o.total || "")} ${esc((o.currency || "").toUpperCase())}</td>
        <td>${esc(o.payment_method_title || o.payment_method || "")}</td>
        <td>${esc((o.line_items || []).map(li => li?.name).filter(Boolean).slice(0,3).join(", "))}${(o.line_items || []).length > 3 ? "…" : ""}</td>
      </tr>
    `).join("");

    return renderCard(
      "Orders (most recent)",
      `
        <table>
          <thead><tr><th>Order</th><th>Total</th><th>Payment</th><th>Items</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  }

  function renderRaw(payload) {
    return renderCard("Raw JSON", `<pre>${esc(prettyJson(payload))}</pre>`);
  }

  function renderUnified(payload) {
    if (!payload || payload.ok === false) {
      return renderCard("Error", `<pre>${esc(prettyJson(payload))}</pre>`);
    }

    const ctx = payload.context || {};
    const customer = ctx.customer || null;
    const subs = ctx.subscriptions || [];
    const orders = ctx.orders || [];

    // REQUIRED ORDER:
    // 1) Customer 2) Subscriptions 3) Orders
    return [
      renderCustomerBlock(customer),
      renderSubscriptionsBlock(subs),
      renderOrdersBlock(orders),
      renderRaw(payload)
    ].join("");
  }

  async function doSearch() {
    const query = (els.q.value || "").trim();
    if (!query) return;

    const loggedIn = await refreshSession();
    if (!loggedIn) {
      els.results.innerHTML = renderCard("Not logged in", `<div class="subtle">Please log in with a WordPress admin account.</div>`);
      return;
    }

    els.results.innerHTML = renderCard("Working…", `<div class="subtle">Fetching WooCommerce data…</div>`);

    try {
      const { resp, data } = await api("/admin/nl-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!resp.ok) {
        els.results.innerHTML = renderCard(`HTTP ${resp.status}`, `<pre>${esc(prettyJson(data))}</pre>`);
        return;
      }

      els.results.innerHTML = renderUnified(data);
    } catch (err) {
      els.results.innerHTML = renderCard("Request failed", `<pre>${esc(String(err?.message || err || ""))}</pre>`);
    }
  }

  els.btn.addEventListener("click", doSearch);
  els.q.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  els.loginBtn.addEventListener("click", async () => {
    const username = (els.user.value || "").trim();
    const password = (els.pass.value || "").trim();
    if (!username || !password) {
      els.loginHint.textContent = "Username and password required.";
      return;
    }

    els.loginBtn.disabled = true;
    els.loginHint.textContent = "Logging in…";

    try {
      const { resp, data } = await api("/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!resp.ok || !data?.success) {
        els.loginHint.textContent = data?.message || `Login failed (HTTP ${resp.status})`;
        await refreshSession();
        return;
      }

      els.loginHint.textContent = "Logged in.";
      els.pass.value = "";
      await refreshSession();
    } catch (err) {
      els.loginHint.textContent = err?.message || "Login failed.";
      await refreshSession();
    } finally {
      els.loginBtn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    els.logoutBtn.disabled = true;
    try { await api("/admin/logout", { method: "POST" }); } catch (_) {}
    await refreshSession();
  });

  (async () => {
    setSessionUI(false);
    await refreshSession();
  })();
})();

// 🔴 main.js
