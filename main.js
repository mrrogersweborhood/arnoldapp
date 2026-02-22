// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-22d)
// Markers are comments only: 🟢 main.js ... 🔴 main.js

(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const API = {
    status: `${WORKER_BASE}/admin/status`,
    login: `${WORKER_BASE}/admin/login`,
    logout: `${WORKER_BASE}/admin/logout`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  const els = (() => {
    // Resilient DOM lookups: accept both current ids and legacy ids.
    const byId = (...ids) => {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
      }
      return null;
    };

    return {
      // Auth
      user: byId("loginUser", "inputUser", "user"),
      pass: byId("loginPass", "inputPass", "pass"),
      btnLogin: byId("btnLogin"),
      btnLogout: byId("btnLogout"),

      // Query
      query: byId("query", "queryInput", "inputQuery"),
      btnSearch: byId("searchBtn", "btnSearch"),

      // Session badge / pill
      sessionBadge: byId("sessionPill", "sessionBadge"),

      // Output
      statusMsg: byId("msg", "statusMsg"),
      outCustomer: byId("customerOut", "outCustomer"),
      outSubs: byId("subsOut", "outSubs"),
      outOrders: byId("ordersOut", "outOrders"),
      outJson: byId("rawOut", "outJson"),
      rawJsonDetails: byId("rawJsonDetails", "rawJson")
    };
  })();

  // ---- Utilities ----

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "—";
    }
  }

  function fmtMoney(amount, currency) {
    const a = Number(amount);
    if (!isFinite(a)) return amount == null ? "—" : String(amount);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD"
      }).format(a);
    } catch {
      return `$${a.toFixed(2)}`;
    }
  }

  function fmtPhone(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return "—";

    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return raw;
  }

  function setBadge(text, ok) {
    if (!els.sessionBadge) return;

    // Preserve the pill structure in index.html (dot + #sessionText).
    const t = document.getElementById("sessionText");
    if (t) t.textContent = text;

    // Drive the existing CSS via data-state.
    els.sessionBadge.setAttribute("data-state", ok ? "in" : "out");
  }

  function setMsg(text, kind) {
    if (!els.statusMsg) return;

    const msg = String(text || "");
    els.statusMsg.textContent = msg;
    els.statusMsg.style.display = msg ? "block" : "none";

    els.statusMsg.classList.remove("ok", "bad");
    if (kind === "ok") els.statusMsg.classList.add("ok");
    if (kind === "bad") els.statusMsg.classList.add("bad");
  }

  async function apiGet(url) {
    const r = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const txt = await r.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = { raw: txt };
    }
    return { r, data };
  }

  async function apiPost(url, body) {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {})
    });
    const txt = await r.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = { raw: txt };
    }
    return { r, data };
  }

  // ---- Render helpers ----

  function kv(k, v) {
    return `
      <div class="kvRow">
        <div class="kvK">${esc(k)}</div>
        <div class="kvV">${v ?? "—"}</div>
      </div>
    `;
  }

  function addressLine(a) {
    const addr = [a?.address_1, a?.address_2].filter(Boolean).join(" ").trim();
    const cityLine = [a?.city, a?.state, a?.postcode, a?.country].filter(Boolean).join(" • ").trim();
    return [addr, cityLine].filter(Boolean).join("<br>") || "—";
  }

  function renderAddressCard(title, a) {
    return `
      <div class="card">
        <div class="cardTitle">${esc(title)}</div>
        <div class="kv">
          ${kv("name", esc([a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—"))}
          ${kv("address", addressLine(a))}
          ${kv("email", esc(a?.email || "—"))}
          ${kv("phone", esc(fmtPhone(a?.phone)))}
        </div>
      </div>
    `;
  }

  function renderCustomer(cust) {
    if (!cust) return "<div class='muted'>—</div>";

    const id = esc(cust.id ?? "");
    const username = esc(cust.username ?? "");

    // Keep only customer id + username here (Billing/Shipping already carry the contact info).
    const header = `
      <div class="cardGrid2" style="margin-bottom:12px;">
        <div class="kvRow">
          <div class="kvK">customer id</div>
          <div class="kvV"><strong>${id || "—"}</strong></div>
        </div>
        <div class="kvRow">
          <div class="kvK">username</div>
          <div class="kvV"><strong>${username || "—"}</strong></div>
        </div>
      </div>
    `;

    const billing = renderAddressCard("Billing", cust.billing);
    const shipping = renderAddressCard("Shipping", cust.shipping);

    return header + `<div class="cardGrid2">${billing}${shipping}</div>`;
  }

  function renderNotes(notes) {
    if (!notes?.length) return `<div class="muted">—</div>`;

    const cards = notes.slice(0, 200).map((n) => {
      const when = fmtDateTime(n?.date_created);
      const by = esc(n?.author || n?.added_by || "WooCommerce");
      const text = esc(n?.note || "");
      return `
        <div class="noteCard">
          <div class="noteTop">
            <div class="noteWhen">${esc(when)}</div>
            <div class="noteBy">${by}</div>
          </div>
          <div class="noteBody">${text}</div>
        </div>
      `;
    });

    return `<div class="notesStack">${cards.join("")}</div>`;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "—";
    }
  }

  function renderSubscriptions(subs) {
    if (!subs?.length) return "<div class='muted'>—</div>";

    const rows = subs.slice(0, 50).map((s) => {
      const id = esc(s?.id ?? "");
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);
      const next = fmtDate(s?.next_payment_date);
      const end = fmtDate(s?.end_date);

      return `
        <tr>
          <td class="mono"><strong>#${id}</strong> <span class="pill">${status}</span></td>
          <td class="mono">${esc(total)}</td>
          <td class="mono">${esc(next)}</td>
          <td class="mono">${esc(end)}</td>
          <td>${renderNotes(s?.notes)}</td>
        </tr>
      `;
    });

    return `
      <div class="subTableWrap">
        <table class="subTable">
          <thead>
            <tr>
              <th>Subscription</th>
              <th>Total</th>
              <th>Next payment</th>
              <th>End</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  // ✅ Orders: true 1-line rows + headings WITHOUT requiring new CSS (uses inline grid styles)
  function renderOrders(orders) {
    if (!orders?.length) return "<div class='muted'>—</div>";

    const headStyle = [
      "display:grid",
      "grid-template-columns:110px 120px 110px 260px 1fr",
      "gap:12px",
      "padding:10px 12px",
      "margin:0 0 10px",
      "border-radius:14px",
      "background:rgba(30,144,255,.08)",
      "border:1px solid rgba(0,0,0,.06)",
      "font-size:12px",
      "font-weight:950",
      "letter-spacing:.04em",
      "text-transform:uppercase",
      "color:#0b1b2a"
    ].join(";");

    const rowStyle = [
      "display:grid",
      "grid-template-columns:110px 120px 110px 260px 1fr",
      "gap:12px",
      "align-items:center"
    ].join(";");

    const cellStyle = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:850;";
    const statusStyle = [
      "display:inline-flex",
      "align-items:center",
      "padding:4px 10px",
      "border-radius:999px",
      "background:rgba(30,144,255,.18)",
      "border:1px solid rgba(30,144,255,.40)",
      "font-weight:950",
      "font-size:12px",
      "text-transform:lowercase"
    ].join(";");

    const header = `
      <div style="${headStyle}">
        <div>Order</div>
        <div>Status</div>
        <div>Total</div>
        <div>Payment • Date</div>
        <div>Items</div>
      </div>
    `;

    const rows = orders.slice(0, 25).map((o) => {
      const id = o?.id ?? "";
      const status = esc(o?.status ?? "—");
      const total = fmtMoney(o?.total, o?.currency);
      const date = fmtDateTime(o?.date_created);
      const pm = esc(o?.payment_method_title || o?.payment_method || "—");

      const items = Array.isArray(o?.line_items)
        ? o.line_items
            .map((li) => `${li?.quantity ?? 0}× ${esc(li?.name ?? "")}`.trim())
            .filter(Boolean)
            .join(", ")
        : "";

      return `
        <div class="orderLine">
          <div style="${rowStyle}">
            <div style="${cellStyle}" class="mono"><strong>#${esc(id)}</strong></div>
            <div style="${cellStyle}"><span style="${statusStyle}">${status}</span></div>
            <div style="${cellStyle}" class="mono">${esc(total)}</div>
            <div style="${cellStyle}">${esc(`${pm} • ${date}`)}</div>
            <div style="${cellStyle}color:var(--muted);font-weight:800;">${items || "—"}</div>
          </div>
        </div>
      `;
    });

    return `<div class="orderLines">${header}${rows.join("")}</div>`;
  }

  function renderJson(obj) {
    const pretty = JSON.stringify(obj ?? null, null, 2);
    return `<pre class="json">${esc(pretty)}</pre>`;
  }

  // ---- Session ----

  async function refreshSession() {
    setBadge("Session: checking…", false);
    const { r, data } = await apiGet(API.status);

    if (!r.ok) {
      setBadge("Session: error", false);
      setMsg(`Status failed (${r.status})`, "bad");
      return false;
    }

    if (data?.loggedIn) {
      setBadge("Session: logged in", true);
      setMsg("", null);
      return true;
    }

    setBadge("Session: logged out", false);
    return false;
  }

  // ---- Actions ----

  async function doLogin() {
    const username = String(els.user?.value || "").trim();
    const password = String(els.pass?.value || "").trim();

    if (!username || !password) {
      setMsg("Username and password required.", "bad");
      return;
    }

    setMsg("Logging in…", null);

    const { r, data } = await apiPost(API.login, { username, password });

    if (!r.ok || !data?.success) {
      setMsg(data?.message || `Login failed (${r.status})`, "bad");
      await refreshSession();
      return;
    }

    setMsg("Logged in.", "ok");
    await refreshSession();
  }

  async function doLogout() {
    setMsg("Logging out…", null);
    await apiPost(API.logout, {});
    await refreshSession();
    setMsg("Logged out.", "ok");
  }

  async function doSearch() {
    const q = String(els.query?.value || "").trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

    setMsg("Searching…", null);

    const { r, data } = await apiPost(API.search, { query: q });

    if (!r.ok || !data?.ok) {
      setMsg(data?.error || `Search failed (${r.status})`, "bad");
      if (els.outCustomer) els.outCustomer.innerHTML = "<div class='muted'>—</div>";
      if (els.outSubs) els.outSubs.innerHTML = "<div class='muted'>—</div>";
      if (els.outOrders) els.outOrders.innerHTML = "<div class='muted'>—</div>";
      if (els.outJson) els.outJson.innerHTML = renderJson(data);
      return;
    }

    const ctx = data?.context || {};
    if (els.outCustomer) els.outCustomer.innerHTML = renderCustomer(ctx.customer);
    if (els.outSubs) els.outSubs.innerHTML = renderSubscriptions(ctx.subscriptions);
    if (els.outOrders) els.outOrders.innerHTML = renderOrders(ctx.orders);
    if (els.outJson) els.outJson.innerHTML = renderJson(data);

    setMsg("Done.", "ok");
  }

  // ---- Init ----

  function wire() {
    els.btnLogin?.addEventListener("click", doLogin);
    els.btnLogout?.addEventListener("click", doLogout);
    els.btnSearch?.addEventListener("click", doSearch);

    els.query?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    els.user?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    els.pass?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

  async function init() {
    wire();
    await refreshSession();
  }

  init().catch((err) => {
    console.error(err);
    setMsg("Fatal error in main.js (see Console).", "bad");
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js