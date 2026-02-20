// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — admin cookie-session + NL search UI (v2026-02-20h)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ---------------- CONFIG ---------------- */

  // Canonical Worker base
  const PROXY_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ---------------- DOM ---------------- */

  const el = {
    loginEmail: document.getElementById("loginEmail"), // actually username OR email (WP accepts either depending on config)
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    msg: document.getElementById("msg"),
    outCustomer: document.getElementById("outCustomer"),
    outSubs: document.getElementById("outSubs"),
    outOrders: document.getElementById("outOrders"),
    outJson: document.getElementById("outJson"),
    sessionBadge: document.getElementById("sessionBadge"),
    sessionText: document.getElementById("sessionText"),
  };

  /* ---------------- UTIL ---------------- */

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\'/g, "&#39;");
  }

  // --- strip redacted fields from JSON display ---
  // Worker uses "[redacted]" (lowercase), and may also emit "REDACTED" variants.
  function stripRedacted(value) {
    const isRedacted = (v) => {
      if (v == null) return false;
      const s = String(v).trim().toLowerCase();
      return s === "redacted" || s === "[redacted]" || s.startsWith("redacted");
    };

    if (Array.isArray(value)) {
      return value
        .map(stripRedacted)
        .filter((v) => v !== undefined);
    }

    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (isRedacted(v)) continue; // remove field entirely
        const cleaned = stripRedacted(v);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    }

    return value;
  }

  function setMsg(text, kind = "info") {
    if (!el.msg) return;
    el.msg.textContent = text || "";
    el.msg.className = `msg msg-${kind}`;
    el.msg.style.display = text ? "block" : "none";
  }

  function setSessionUI(isLoggedIn) {
    if (!el.sessionBadge || !el.sessionText) return;
    if (isLoggedIn) {
      el.sessionBadge.classList.add("on");
      el.sessionText.textContent = "Session: logged in";
    } else {
      el.sessionBadge.classList.remove("on");
      el.sessionText.textContent = "Session: logged out";
    }
  }

  async function api(path, { method = "GET", body = null } = {}) {
    const url = PROXY_BASE + path;
    const init = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    };
    if (body) init.body = JSON.stringify(body);

    const res = await fetch(url, init);
    const txt = await res.text();
    let json = null;
    try {
      json = txt ? JSON.parse(txt) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      const msg = (json && (json.message || json.error)) || txt || `${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  /* ---------------- RENDER ---------------- */

  function renderCustomer(customer) {
    if (!el.outCustomer) return;
    if (!customer) {
      el.outCustomer.innerHTML = `<div class="empty">—</div>`;
      return;
    }

    const lines = [];
    lines.push(`<div class="cardInner">`);
    const add = (k, v) =>
      lines.push(
        `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v ?? "")}</div></div>`
      );

    add("id", customer.id);
    add("email", customer.email);
    add("first_name", customer.first_name);
    add("last_name", customer.last_name);
    add("username", customer.username);
    add("role", customer.role);
    add("created_at", customer.date_created);
    add("orders_count", customer.orders_count);
    add("total_spent", customer.total_spent);
    add("is_pseudo", customer.is_pseudo);
    add("source", customer.source);

    lines.push(`</div>`);
    el.outCustomer.innerHTML = lines.join("");
  }

  function renderSubs(subs) {
    if (!el.outSubs) return;
    if (!subs || !subs.length) {
      el.outSubs.innerHTML = `<div class="empty">—</div>`;
      return;
    }

    const rows = subs
      .map((s) => {
        const id = s.id ?? "";
        const status = s.status ?? "";
        const total = s.total ?? s.total_amount ?? "";
        const start = s.date_created ?? s.start_date ?? "";
        const nextPay = s.next_payment_date ?? s.next_payment ?? "";
        const end = s.end_date ?? "";
        const email = s.billing?.email ?? s.billing_email ?? "";

        return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span>
            <div class="muted">${esc(email)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(start)}</td>
          <td>${esc(nextPay)}</td>
          <td>${esc(end)}</td>
        </tr>`;
      })
      .join("");

    el.outSubs.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Start</th>
            <th>Next Pay</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderOrders(orders) {
    if (!el.outOrders) return;
    if (!orders || !orders.length) {
      el.outOrders.innerHTML = `<div class="empty">—</div>`;
      return;
    }

    const rows = orders
      .slice(0, 20)
      .map((o) => {
        const id = o.id ?? "";
        const status = o.status ?? "";
        const total = o.total ?? "";
        const date = o.date_created ?? o.date_paid ?? "";
        const email = o.billing?.email ?? "";
        const name = `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim();

        return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span>
            <div class="muted">${esc(name)}${name && email ? " • " : ""}${esc(email)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(date)}</td>
        </tr>`;
      })
      .join("");

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderAll(payload) {
    const context = payload?.context || payload || {};

    // Worker sometimes nests results under context (Arnold pipeline)
    const customer = context?.customer ?? payload?.customer ?? null;
    const subs = context?.subscriptions ?? payload?.subscriptions ?? payload?.subs ?? [];
    const orders = context?.orders ?? payload?.orders ?? [];

    renderCustomer(customer);
    renderSubs(subs);
    renderOrders(orders);

    // Raw JSON (strip redacted fields)
    if (el.outJson) {
      const cleaned = stripRedacted(payload ?? {});
      el.outJson.textContent = JSON.stringify(cleaned, null, 2);
    }
  }

  /* ---------------- SEARCH ---------------- */

  async function doSearch() {
    const q = (el.query?.value || "").trim();
    if (!q) {
      setMsg("Enter a query.", "warn");
      return;
    }

    setMsg("Searching…", "info");
    if (el.outCustomer) el.outCustomer.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outSubs) el.outSubs.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outOrders) el.outOrders.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outJson) el.outJson.textContent = "";

    const r = await api("/admin/nl-search", { method: "POST", body: { query: q } });

    if (r && r.ok === true) setMsg("Done.", "ok");
    else setMsg("Search completed. Check results and Raw JSON.", "info");

    renderAll(r);
  }

  /* ---------------- AUTH ---------------- */

  async function refreshStatus() {
    try {
      const s = await api("/admin/status");
      // Worker returns { loggedIn: true/false, user, roles }
      const loggedIn = !!(s && s.loggedIn);
      setSessionUI(loggedIn);
      return loggedIn;
    } catch (_) {
      setSessionUI(false);
      return false;
    }
  }

  async function doLogin() {
    const username = (el.loginEmail?.value || "").trim();
    const password = (el.loginPass?.value || "").trim();

    if (!username || !password) {
      setMsg("Login failed: Username and password required.", "error");
      return;
    }

    setMsg("Logging in…", "info");
    try {
      // ✅ FIX: Worker expects { username, password }
      const r = await api("/admin/login", {
        method: "POST",
        body: { username, password },
      });

      // Worker returns { success: true, user, roles }
      if (r && r.success) setMsg("Logged in.", "ok");
      else setMsg("Login returned an unexpected response.", "warn");
    } catch (e) {
      setMsg(`Login failed: ${e.message}`, "error");
    } finally {
      await refreshStatus();
    }
  }

  async function doLogout() {
    setMsg("Logging out…", "info");
    try {
      await api("/admin/logout", { method: "POST" });
      setMsg("Logged out.", "ok");
    } catch (_) {
      // If logout endpoint is temporarily unavailable, still reset UI
      setMsg("Logged out (or session cleared).", "ok");
    } finally {
      await refreshStatus();
    }
  }

  /* ---------------- WIRES ---------------- */

  function wire() {
    el.btnLogin?.addEventListener("click", () => doLogin());
    el.btnLogout?.addEventListener("click", () => doLogout());
    el.btnSearch?.addEventListener("click", () => doSearch());

    el.query?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
    el.loginPass?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

  /* ---------------- BOOT ---------------- */

  async function boot() {
    wire();
    await refreshStatus();
    setMsg("", "info");
  }

  boot().catch((err) => {
    console.error(err);
    setMsg("App failed to start. Check console.", "error");
  });
})();

// 🔴 main.js