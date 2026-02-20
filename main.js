// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — cookie-session auth + pretty formatting (v2026-02-20u)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

/*
  FULL FILE REPLACEMENT NOTE:
  - This file is provided as a complete replacement.
  - Marker comments indicate file boundaries: 🟢 main.js ... 🔴 main.js
*/

(() => {
  "use strict";

  /* ---------------- CONFIG ---------------- */

  // ✅ Arnold Admin Worker (cookie session endpoints live here)
  // IMPORTANT: keep aligned with handover: arnold-admin-worker.bob-b5c.workers.dev
  const PROXY_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  // UI brand color used in inline label styles where needed
  const BRAND = "#1E90FF";

  // Safety: limit raw JSON preview size
  const RAW_JSON_MAX = 250_000;

  /* ---------------- DOM ---------------- */

  const $ = (sel) => document.querySelector(sel);

  const el = {
    email: $("#loginEmail"),
    pass: $("#loginPass"),
    btnLogin: $("#btnLogin"),
    btnLogout: $("#btnLogout"),
    msg: $("#msg"),
    query: $("#query"),
    btnSearch: $("#btnSearch"),
    outCustomer: $("#outCustomer"),
    outSubs: $("#outSubs"),
    outOrders: $("#outOrders"),
    outJson: $("#outJson"),
    rawDetails: $("#rawJsonDetails"),
    sessionText: $("#sessionText"),
    sessionBadge: $("#sessionBadge")
  };

  function assertDom() {
    const required = [
      ["#loginEmail", el.email],
      ["#loginPass", el.pass],
      ["#btnLogin", el.btnLogin],
      ["#btnLogout", el.btnLogout],
      ["#msg", el.msg],
      ["#query", el.query],
      ["#btnSearch", el.btnSearch],
      ["#outCustomer", el.outCustomer],
      ["#outSubs", el.outSubs],
      ["#outOrders", el.outOrders],
      ["#outJson", el.outJson],
      ["#sessionText", el.sessionText],
      ["#sessionBadge", el.sessionBadge]
    ];

    const missing = required.filter(([, node]) => !node).map(([id]) => id);
    if (missing.length) {
      console.error("[ArnoldAdmin] Missing DOM nodes:", missing);
      throw new Error("Missing required DOM nodes: " + missing.join(", "));
    }
  }

  /* ---------------- HELPERS ---------------- */

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMsg(msg, type = "") {
    el.msg.textContent = msg || "";
    el.msg.className = type ? `msg ${type}` : "msg";
  }

  const moneyFmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD"
  });

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount ?? "—");
    if (currency && String(currency).toUpperCase() !== "USD") {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: String(currency).toUpperCase()
        }).format(n);
      } catch (_) {
        return moneyFmt.format(n);
      }
    }
    return moneyFmt.format(n);
  }

  function fmtDateTime(dt) {
    if (!dt) return "—";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
  }

  function fmtPhone(p) {
    const s = String(p ?? "").trim();
    if (!s || s === "—") return "—";
    return s;
  }

  function addressLine(a) {
    if (!a) return "";
    const parts = [
      a.first_name || a.last_name ? `${a.first_name || ""} ${a.last_name || ""}`.trim() : "",
      a.company || "",
      a.address_1 || "",
      a.address_2 || "",
      [a.city, a.state, a.postcode].filter(Boolean).join(" "),
      a.country || ""
    ].filter(Boolean);

    // If the first element is the person name, we still want address on same line (WP-admin style)
    // but in the UI we’ll show it as one compact string.
    return parts.join(" • ");
  }

  /* ---------------- API ---------------- */

  async function api(path, opts = {}) {
    const url = `${PROXY_BASE}${path}`;
    const init = {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {})
      },
      credentials: "include" // ✅ required for HttpOnly cookie session
    };

    if (opts.body != null) init.body = JSON.stringify(opts.body);

    const r = await fetch(url, init);
    const txt = await r.text();

    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (_) {
      data = txt;
    }

    return { ok: r.ok, status: r.status, data, url };
  }

  /* ---------------- AUTH ---------------- */

  async function refreshStatus() {
    const r = await api("/admin/status", { method: "GET" });
    const loggedIn = !!(r.ok && r.data && r.data.loggedIn);

    el.sessionText.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
    el.sessionBadge.className = loggedIn ? "pill ok" : "pill";

    // Keep buttons consistent
    el.btnLogin.disabled = loggedIn;
    el.btnLogout.disabled = !loggedIn;

    return loggedIn;
  }

  async function doLogin() {
    setMsg("");
    const username = (el.email.value || "").trim();
    const password = el.pass.value || "";

    if (!username || !password) {
      setMsg("Username and password required.", "warn");
      return;
    }

    // ✅ This must hit arnold-admin-worker…/admin/login
    const r = await api("/admin/login", {
      method: "POST",
      body: { username, password }
    });

    if (!r.ok) {
      // 401/403 should show a clear message
      const msg = r.data?.message || r.data?.error || `Login failed (${r.status}).`;
      setMsg(msg, "error");
      await refreshStatus();
      return;
    }

    setMsg("Logged in.", "ok");
    await refreshStatus();
  }

  async function doLogout() {
    setMsg("");
    const r = await api("/admin/logout", { method: "POST", body: {} });
    if (!r.ok) {
      setMsg(`Logout failed (${r.status}).`, "error");
      await refreshStatus();
      return;
    }
    setMsg("Logged out.", "ok");
    await refreshStatus();
  }

  /* ---------------- RENDERERS ---------------- */

  function renderCustomer(c) {
    const elOut = $("#outCustomer");
    if (!c) {
      elOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const billing = c.billing || {};
    const shipping = c.shipping || {};

    const name = (c.first_name || c.last_name)
      ? `${c.first_name || ""} ${c.last_name || ""}`.trim()
      : (billing.first_name || billing.last_name)
        ? `${billing.first_name || ""} ${billing.last_name || ""}`.trim()
        : (c.username || c.email || "—");

    const email = c.email || billing.email || "—";
    const phone = fmtPhone(c.phone || billing.phone || "—");

    const billName = (billing.first_name || billing.last_name)
      ? `${billing.first_name || ""} ${billing.last_name || ""}`.trim()
      : (name || "—");

    const shipName = (shipping.first_name || shipping.last_name)
      ? `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim()
      : "—";

    const billAddr = addressLine(billing) || "—";
    const shipAddr = addressLine(shipping) || "—";

    const labelStyle = `style="color: var(--brand); font-weight: 700; text-transform: none;"`;
    const rowStyle = `style="display:flex; gap:10px; align-items:baseline; padding:8px 0; border-bottom: 1px dashed rgba(15,23,42,.10);"`;
    const valStyle = `style="color:#0f172a; font-weight: 500; margin-left:auto; text-align:right; max-width: 70%;"`;

    const block = (title, nm, addr, em, ph) => `
      <div class="card" style="background:#fff; border-radius:16px; padding:14px; box-shadow: 0 8px 26px rgba(2,6,23,.06);">
        <div style="font-weight:800; margin:0 0 8px 0;">${esc(title)}</div>
        <div ${rowStyle}>
          <div ${labelStyle}>name</div>
          <div ${valStyle}>${esc(nm || "—")}</div>
        </div>
        <div ${rowStyle}>
          <div ${labelStyle}>address</div>
          <div ${valStyle}>${esc(addr || "—")}</div>
        </div>
        <div ${rowStyle}>
          <div ${labelStyle}>email</div>
          <div ${valStyle}>${esc(em || "—")}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:baseline; padding:8px 0;">
          <div ${labelStyle}>phone</div>
          <div ${valStyle}>${esc(ph || "—")}</div>
        </div>
      </div>
    `;

    elOut.innerHTML = `
      <div class="row">
        <div class="k" ${labelStyle}>customer id</div>
        <div class="v">${esc(String(c.id ?? "—"))}</div>
      </div>
      <div class="row">
        <div class="k" ${labelStyle}>username</div>
        <div class="v">${esc(String(c.username ?? "—"))}</div>
      </div>
      <div class="row">
        <div class="k" ${labelStyle}>name</div>
        <div class="v">${esc(name)}</div>
      </div>
      <div class="row">
        <div class="k" ${labelStyle}>email</div>
        <div class="v">${esc(email)}</div>
      </div>
      <div class="row">
        <div class="k" ${labelStyle}>phone</div>
        <div class="v">${esc(phone)}</div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:14px;">
        ${block("Billing", billName, billAddr, billing.email || email, fmtPhone(billing.phone || phone))}
        ${block("Shipping", shipName, shipAddr, shipping.email || "—", fmtPhone(shipping.phone || "—"))}
      </div>
    `;
  }

  function renderSubs(subs) {
    const elOut = $("#outSubs");
    if (!subs || !subs.length) {
      elOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const noteCard = (n) => {
      const when = n?.date_created ? fmtDateTime(n.date_created) : "—";
      const txt = (n?.note ?? "").toString().trim();
      if (!txt) return "";
      return `
        <div style="background:#fff; border:1px solid rgba(15,23,42,.10); border-radius:12px; padding:10px 12px; box-shadow: 0 6px 18px rgba(2,6,23,.06); margin:8px 0;">
          <div style="color:#64748b; font-size:12px; margin-bottom:6px;">${esc(when)}</div>
          <div style="color:#0f172a; font-weight:500; line-height:1.25;">${esc(txt)}</div>
        </div>
      `;
    };

    const rows = subs.map(s => {
      const id = s.id ?? "";
      const status = s.status || "";
      const total = s.total ? fmtMoney(s.total, s.currency) : "—";
      const start = s.start_date ? fmtDateTime(s.start_date) : "—";

      // ✅ Next payment date (worker normalizes into next_payment_date)
      const nextPayRaw =
        s.next_payment_date ||
        s.next_payment_date_gmt ||
        s.schedule_next_payment ||
        (s.schedule && s.schedule.next_payment) ||
        null;

      const nextPay = nextPayRaw ? fmtDateTime(nextPayRaw) : "—";

      const pay = s.payment_method_title || s.payment_method || "—";

      const notesArr = Array.isArray(s.notes) ? s.notes : [];
      const notesHtml = notesArr.length
        ? notesArr.map(noteCard).join("")
        : `<div class="muted">—</div>`;

      return `
        <tr>
          <td>
            <div style="font-weight:800;">#${esc(String(id))}</div>
            <div class="pill" style="margin-top:6px;">${esc(status)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(start)}</td>
          <td>${esc(nextPay)}</td>
          <td>${esc(pay)}</td>
          <td style="min-width:280px;">${notesHtml}</td>
        </tr>
      `;
    }).join("");

    // ❌ End Date intentionally removed from this app (per your requirement)
    elOut.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Start</th>
            <th>Next Pay</th>
            <th>Payment Method</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    const elOut = $("#outOrders");
    if (!orders || !orders.length) {
      elOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const rows = orders.map(o => {
      const id = o.id ?? "";
      const status = o.status || "";
      const total = o.total ? fmtMoney(o.total, o.currency) : "—";
      const when = o.date_created ? fmtDateTime(o.date_created) : "—";
      const pay = o.payment_method_title || o.payment_method || "—";

      const items = Array.isArray(o.line_items) ? o.line_items : [];
      const itemText = items.length
        ? items.map(i => `${i.quantity || 0}× ${i.name || ""}`).join(" • ")
        : "—";

      return `
        <tr>
          <td>
            <div style="font-weight:800;">#${esc(String(id))}</div>
            <div class="pill" style="margin-top:6px;">${esc(status)}</div>
            <div class="muted" style="margin-top:6px;">${esc(when)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(pay)}</td>
          <td>${esc(itemText)}</td>
        </tr>
      `;
    }).join("");

    elOut.innerHTML = `
      <table class="tbl">
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
    `;
  }

  function renderRawJson(payload) {
    const elOut = $("#outJson");
    if (!payload) {
      elOut.innerHTML = "";
      el.rawDetails?.removeAttribute("open");
      return;
    }

    let str = "";
    try {
      str = JSON.stringify(payload, null, 2);
    } catch (_) {
      str = String(payload);
    }

    if (str.length > RAW_JSON_MAX) {
      str = str.slice(0, RAW_JSON_MAX) + "\n…(truncated)…";
    }

    elOut.textContent = str;
  }

  /* ---------------- SEARCH ---------------- */

  async function doSearch() {
    setMsg("");
    el.outCustomer.innerHTML = `<div class="muted">—</div>`;
    el.outSubs.innerHTML = `<div class="muted">—</div>`;
    el.outOrders.innerHTML = `<div class="muted">—</div>`;
    renderRawJson(null);

    let q = (el.query?.value || "").trim();
    // Numeric-only searches are treated as order lookups
    if (/^\d+$/.test(q)) q = `order #${q}`;

    if (!q) {
      setMsg("Enter a search (email or natural language).", "warn");
      return;
    }

    // Ensure session is valid before querying
    const loggedIn = await refreshStatus();
    if (!loggedIn) {
      setMsg("Please log in first.", "warn");
      return;
    }

    const r = await api("/admin/nl-search", {
      method: "POST",
      body: { query: q }
    });

    if (!r.ok) {
      const msg = r.data?.error || r.data?.message || `Search failed (${r.status}).`;
      setMsg(msg, "error");
      renderRawJson({ request: { q }, response: r.data, status: r.status, url: r.url });
      return;
    }

    const ctx = r.data?.context || {};
    renderCustomer(ctx.customer || null);
    renderSubs(ctx.subscriptions || []);
    renderOrders(ctx.orders || []);
    renderRawJson(r.data);
    setMsg("Done.", "ok");
  }

  /* ---------------- INIT ---------------- */

  function bind() {
    el.btnLogin.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin().catch((err) => {
        console.error("[ArnoldAdmin] login error:", err);
        setMsg("Login failed. Check console.", "error");
      });
    });

    el.btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout().catch((err) => {
        console.error("[ArnoldAdmin] logout error:", err);
        setMsg("Logout failed. Check console.", "error");
      });
    });

    el.btnSearch.addEventListener("click", (e) => {
      e.preventDefault();
      doSearch().catch((err) => {
        console.error("[ArnoldAdmin] search error:", err);
        setMsg("Search failed. Check console.", "error");
      });
    });

    // Enter key convenience
    el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.btnSearch.click();
      }
    });

    el.pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.btnLogin.click();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      assertDom();
      bind();
      await refreshStatus();
    } catch (err) {
      console.error("[ArnoldAdmin] init failed:", err);
      setMsg("App failed to start. Check console.", "error");
    }
  });
})();

// 🔴 main.js