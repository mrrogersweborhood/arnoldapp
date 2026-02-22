// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — cookie-session auth + pretty formatting (v2026-02-21b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
/* eslint-disable no-console */
(() => {
  "use strict";

  // === CONFIG ===
  const BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  // === DOM (must match index.html) ===
  const REQUIRED_IDS = [
    "sessionBadge",
    "sessionText",
    "loginEmail",
    "loginPass",
    "btnLogin",
    "btnLogout",
    "msg",
    "query",
    "btnSearch",
    "outCustomer",
    "outSubs",
    "outOrders",
    "outJson"
  ];

  function qs(id) { return document.getElementById(id); }

  const el = {};
  function bindDom() {
    let missing = [];
    for (const id of REQUIRED_IDS) {
      const node = qs(id);
      if (!node) missing.push(id);
      else el[id] = node;
    }
    if (missing.length) {
      // Hard stop to prevent silent churn/regressions when index.html + main.js drift.
      const box = document.querySelector(".wrap") || document.body;
      const msg = document.createElement("div");
      msg.className = "card";
      msg.style.border = "2px solid #B91C1C";
      msg.style.padding = "14px";
      msg.style.margin = "14px auto";
      msg.style.maxWidth = "980px";
      msg.innerHTML = `
        <div style="color:#B91C1C;font-weight:900;">
          DOM mismatch: missing element(s): ${missing.map(m => `<code>${m}</code>`).join(", ")}.
          index.html and main.js must be updated together.
        </div>
      `;
      box.prepend(msg);
      return false;
    }
    return true;
  }

  // === UTIL ===
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(val, currency) {
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val ?? "");
    const cur = (currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);
    } catch (_) {
      return `$${n.toFixed(2)}`;
    }
  }

  function fmtPhone(raw) {
    const s = String(raw ?? "").replace(/[^\d]/g, "");
    if (s.length === 10) return `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}`;
    if (s.length === 11 && s.startsWith("1")) return `(${s.slice(1, 4)}) ${s.slice(4, 7)}-${s.slice(7)}`;
    return String(raw ?? "");
  }

  function fmtDateTime(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    // Accept ISO-ish strings from Woo/WP
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function setMsg(text, kind) {
    el.msg.textContent = text || "";
    el.msg.className = `msg ${kind || ""}`.trim();
  }

  function setSessionBadge(state, text) {
    // state: "checking" | "in" | "out"
    el.sessionBadge.classList.remove("in", "out", "checking");
    el.sessionBadge.classList.add(state);
    el.sessionText.textContent = text;
  }

  async function api(path, opts = {}) {
    const url = `${BASE}${path}`;
    const init = {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      credentials: "include"
    };
    if (opts.body != null) init.body = JSON.stringify(opts.body);
    const r = await fetch(url, init);
    const t = await r.text();
    let j = null;
    try { j = t ? JSON.parse(t) : null; } catch (_) { j = null; }
    return { ok: r.ok, status: r.status, json: j, text: t };
  }

  // === AUTH ===
  async function refreshStatus() {
    setSessionBadge("checking", "Session: checking…");
    const res = await api("/admin/status", { method: "GET" });
    if (res.ok && res.json && res.json.loggedIn) {
      setSessionBadge("in", "Session: logged in");
      el.btnLogin.disabled = true;
      el.btnLogout.disabled = false;
      return true;
    }
    setSessionBadge("out", "Session: logged out");
    el.btnLogin.disabled = false;
    el.btnLogout.disabled = true;
    return false;
  }

  async function doLogin() {
    setMsg("", "");
    const username = el.loginEmail.value.trim();
    const password = el.loginPass.value;
    if (!username || !password) {
      setMsg("Username and password required.", "bad");
      return;
    }
    el.btnLogin.disabled = true;
    const res = await api("/admin/login", { method: "POST", body: { username, password } });
    if (!res.ok || !res.json?.success) {
      el.btnLogin.disabled = false;
      setMsg("Login failed.", "bad");
      await refreshStatus();
      return;
    }
    setMsg("Logged in.", "ok");
    await refreshStatus();
  }

  async function doLogout() {
    setMsg("", "");
    el.btnLogout.disabled = true;
    await api("/admin/logout", { method: "POST" });
    setMsg("Logged out.", "ok");
    await refreshStatus();
  }

  // === RENDERERS ===
  function renderCustomer(customer) {
    if (!el.outCustomer) return;
    if (!customer) {
      el.outCustomer.innerHTML = `<div class="empty">No customer found.</div>`;
      return;
    }

    const c = customer || {};
    const b = c.billing || {};
    const s = c.shipping || {};

    const kv = (k, v, fmt) => `
      <div class="kv">
        <div class="k">${esc(k)}</div>
        <div class="v">${esc(fmt ? fmt(v) : (v ?? "—"))}</div>
      </div>
    `;

    const addressLine = (a) => {
      const parts = [
        a?.address_1,
        a?.address_2,
        a?.city,
        a?.state,
        a?.postcode,
        a?.country
      ].filter(Boolean);
      return parts.join(" • ");
    };

    el.outCustomer.innerHTML = `
      <div class="grid2">
        <div class="cardInset">
          <div class="sectTitle">Customer</div>
          ${kv("customer id", c.id ?? "—")}
          ${kv("username", c.username ?? "—")}
          ${kv("name", [c.first_name, c.last_name].filter(Boolean).join(" ") || "—")}
          ${kv("email", c.email ?? "—")}
          ${kv("phone", b.phone ?? "—", fmtPhone)}
        </div>

        <div class="cardInset">
          <div class="sectTitle">Billing</div>
          ${kv("name", [b.first_name, b.last_name].filter(Boolean).join(" ") || "—")}
          ${kv("address", addressLine(b) || "—")}
          ${kv("email", b.email ?? "—")}
          ${kv("phone", b.phone ?? "—", fmtPhone)}
        </div>

        <div class="cardInset">
          <div class="sectTitle">Shipping</div>
          ${kv("name", [s.first_name, s.last_name].filter(Boolean).join(" ") || "—")}
          ${kv("address", addressLine(s) || "—")}
          ${kv("email", s.email ?? "—")}
          ${kv("phone", s.phone ?? "—", fmtPhone)}
        </div>
      </div>
    `;
  }

  function renderSubs(subs) {
    if (!el.outSubs) return;
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      el.outSubs.innerHTML = `<div class="empty">No subscriptions found.</div>`;
      return;
    }

    // Compact subscription rows (one-liner) + notes rendered as cards inside the subscription area.
    el.outSubs.innerHTML = arr.map((s) => {
      const id = s.id != null ? `#${s.id}` : "";
      const status = s.status ? String(s.status) : "";
      const total = fmtMoney(s.total, s.currency);
      const start = fmtDateTime(s.start_date || "");
      const next = fmtDateTime(s.next_payment_date || "");
      const pm = s.payment_method_title || s.payment_method || "";

      const notesArr = Array.isArray(s.notes) ? s.notes : [];
      const notesHtml = notesArr.length
        ? `<div class="subNotes">
            ${notesArr.map((n) => {
              const when = fmtDateTime(n?.date_created || "");
              const txt = String(n?.note || "").trim();
              if (!txt) return "";
              return `<div class="noteCard">
                <div class="noteMeta">${esc(when || "—")}</div>
                <div class="noteBody">${esc(txt)}</div>
              </div>`;
            }).join("")}
          </div>`
        : "";

      return `
        <div class="subCard">
          <div class="subRow">
            <div class="subCell subMain"><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span></div>
            <div class="subCell">${esc(total)}</div>
            <div class="subCell">${esc(start || "—")}</div>
            <div class="subCell">${esc(next || "—")}</div>
            <div class="subCell">${esc(pm || "—")}</div>
          </div>
          ${notesHtml}
        </div>
      `;
    }).join("");
  }

  function renderOrders(orders) {
    if (!el.outOrders) return;
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      el.outOrders.innerHTML = `<div class="empty">No orders found.</div>`;
      return;
    }

    const rows = arr.map((o) => {
      const id = o.id != null ? `#${o.id}` : "";
      const status = o.status ? String(o.status) : "";
      const total = fmtMoney(o.total, o.currency);
      const when = fmtDateTime(o.date_created || "");
      const pm = o.payment_method_title || o.payment_method || "";
      const items = Array.isArray(o.line_items) ? o.line_items.map(li => li?.name).filter(Boolean).join(", ") : "";

      return `
        <tr>
          <td><strong>${esc(id)}</strong></td>
          <td><span class="pill">${esc(status)}</span></td>
          <td>${esc(total)}</td>
          <td>${esc(when || "—")}</td>
          <td>${esc(pm || "—")}</td>
          <td>${esc(items || "—")}</td>
        </tr>
      `;
    }).join("");

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr><th>Order</th><th>Status</th><th>Total</th><th>Date</th><th>Payment</th><th>Items</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderRaw(payload) {
    if (!el.outJson) return;
    el.outJson.textContent = payload ? JSON.stringify(payload, null, 2) : "";
  }

  // === SEARCH ===
  async function doSearch() {
    setMsg("", "");
    const q = el.query.value.trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

    el.btnSearch.disabled = true;
    try {
      const res = await api("/admin/nl-search", { method: "POST", body: { query: q } });
      if (!res.ok || !res.json?.ok) {
        setMsg(`Search failed (${res.status}).`, "bad");
        renderCustomer(null);
        renderSubs([]);
        renderOrders([]);
        renderRaw(res.json || res.text);
        return;
      }

      const ctx = res.json.context || {};
      renderCustomer(ctx.customer || null);
      renderSubs(ctx.subscriptions || []);
      renderOrders(ctx.orders || []);
      renderRaw(res.json);
      setMsg("Search complete.", "ok");
    } catch (e) {
      setMsg("Search failed (network).", "bad");
    } finally {
      el.btnSearch.disabled = false;
    }
  }

  // === INIT ===
  async function init() {
    if (!bindDom()) return;

    el.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
    el.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
    el.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

    el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSearch();
      }
    });

    await refreshStatus();
  }

  window.addEventListener("DOMContentLoaded", init);

})();

// 🔴 main.js