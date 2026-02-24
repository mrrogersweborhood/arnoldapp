// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-24b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  /* ================== CONFIG ================== */

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const API = {
    login: `${WORKER_BASE}/admin/login`,
    logout: `${WORKER_BASE}/admin/logout`,
    status: `${WORKER_BASE}/admin/status`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  /* ================== DOM ================== */

  // Support both historical id sets (wpUser/wpPass) and newer (loginUser/loginPass)
  function byId(id) { return document.getElementById(id); }
  function firstId(...ids) { return ids.map(byId).find(Boolean) || null; }

  const els = {
    user: firstId("loginUser", "wpUser"),
    pass: firstId("loginPass", "wpPass"),
    btnLogin: firstId("btnLogin"),
    btnLogout: firstId("btnLogout"),
    query: firstId("query"),
    btnSearch: firstId("btnSearch"),
    results: firstId("results"),
    statusLine: firstId("statusLine"),

    sessionText: firstId("sessionText"),
    sessionDot: firstId("sessionDot"),

    btnRaw: firstId("btnRaw"),
    rawWrap: firstId("rawWrap"),
    rawJson: firstId("rawJson")
  };

  function must(el, name) {
    if (!el) {
      console.error(`[ArnoldAdmin] Missing DOM element: ${name}`);
      return false;
    }
    return true;
  }

  /* ================== STATE ================== */

  const state = {
    lastResponse: null,
    openSubNotes: new Set(),   // subscription id strings
    openOrderNotes: new Set()  // order id strings
  };

  /* ================== HELPERS ================== */

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Strip tags + decode entities safely (for notes that contain HTML like <span>...)
  function htmlToText(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html ?? "");
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  function fmtMoney(total, currency) {
    const t = total == null ? "" : String(total);
    if (!t) return "—";
    if (!currency || String(currency).toUpperCase() === "USD") return `$${t}`;
    return `${t} ${String(currency).toUpperCase()}`;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setStatusLine(msg, tone) {
    if (!els.statusLine) return;
    els.statusLine.textContent = msg || "";
    els.statusLine.classList.remove("ok", "warn", "err");
    if (tone) els.statusLine.classList.add(tone);
  }

  function setSessionPill({ loggedIn, user }) {
    if (els.sessionDot) {
      els.sessionDot.classList.toggle("on", !!loggedIn);
      els.sessionDot.classList.toggle("off", !loggedIn);
    }
    if (els.sessionText) {
      if (!loggedIn) {
        els.sessionText.textContent = "Session: logged out";
      } else if (user?.slug || user?.name) {
        els.sessionText.textContent = `Session: logged in as ${user.slug || user.name}`;
      } else {
        els.sessionText.textContent = "Session: logged in";
      }
    }
  }

  async function apiFetch(url, opts) {
    const init = {
      method: opts?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts?.headers || {})
      },
      credentials: "include"
    };
    if (opts?.body !== undefined) init.body = JSON.stringify(opts.body);

    const resp = await fetch(url, init);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { resp, data };
  }

  // Remove meta_data before showing Raw JSON (but keep it in the actual response payload).
  function stripMetaDataDeep(x) {
    if (Array.isArray(x)) return x.map(stripMetaDataDeep);
    if (x && typeof x === "object") {
      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === "meta_data") continue;
        out[k] = stripMetaDataDeep(v);
      }
      return out;
    }
    return x;
  }

  function renderPill(text) {
    return `<span class="pill">${esc(text || "—")}</span>`;
  }

  function renderNotesToggle(label, count, isOpen, targetKind, id) {
    const caretClass = isOpen ? "aa-caret open" : "aa-caret";
    const safeLabel = label || "Notes";
    const safeCount = Number.isFinite(count) ? count : 0;
    return `
      <span class="aa-notes-toggle" data-kind="${esc(targetKind)}" data-id="${esc(id)}" role="button" tabindex="0" aria-expanded="${isOpen ? "true" : "false"}">
        <span>${esc(safeLabel)}${safeCount ? ` (${safeCount})` : ""}</span>
        <span class="${caretClass}">▼</span>
      </span>
    `;
  }

  function renderNotesList(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return `<div class="aa-notes empty">No notes.</div>`;

    const items = arr
      .slice(0, 200)
      .map(n => {
        const when = fmtDate(n?.date_created);
        const who = (n?.author || n?.added_by) ? String(n.author || n.added_by) : "";
        const raw = n?.note ?? "";
        const clean = htmlToText(raw);
        return `
          <div class="aa-note">
            <div class="aa-note-meta">
              <span class="aa-note-date">${esc(when)}</span>
              ${who ? `<span class="aa-note-author">${esc(who)}</span>` : ""}
            </div>
            <div class="aa-note-body">${esc(clean)}</div>
          </div>
        `;
      })
      .join("");

    return `<div class="aa-notes">${items}</div>`;
  }

  function renderAddressCard(title, addr) {
    const a = addr || {};
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();

    // IMPORTANT: Per spec, email should NOT repeat on Subscriber header,
    // BUT email stays inside Billing/Shipping cards.
    return `
      <div class="card mini">
        <div class="mini-title">${esc(title)}</div>

        ${name ? `<div class="aa-name-line">${esc(name)}</div>` : ""}

        <div class="aa-kv">
          <div class="aa-k">Address</div>
          <div class="aa-v">
            ${esc([a.address_1, a.address_2].filter(Boolean).join(" ").trim())}
            ${a.city || a.state || a.postcode ? `<div>${esc([a.city, a.state, a.postcode].filter(Boolean).join(", "))}</div>` : ""}
            ${a.country ? `<div>${esc(a.country)}</div>` : ""}
          </div>

          <div class="aa-k">Email</div>
          <div class="aa-v">${a.email ? esc(a.email) : "—"}</div>

          <div class="aa-k">Phone</div>
          <div class="aa-v">${a.phone ? esc(a.phone) : "—"}</div>
        </div>
      </div>
    `;
  }

  function renderSubscriber(contextCustomer) {
    const c = contextCustomer || {};
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
          <div class="aa-section-subtitle">${esc(fullName || "")}</div>
        </div>

        <div class="aa-kv aa-subscriber-kv">
  <div class="aa-k">Customer ID</div>
  <div class="aa-v">${c.id != null ? esc(c.id) : "—"}</div>

  <div class="aa-k">Username</div>
  <div class="aa-v">${c.username ? esc(c.username) : "—"}</div>
</div>

        <div class="aa-two">
          ${renderAddressCard("Billing", c.billing)}
          ${renderAddressCard("Shipping", c.shipping)}
        </div>
      </section>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    const rows = arr.map(s => {
      const id = String(s?.id ?? "");
      const status = s?.status || "—";
      const total = fmtMoney(s?.total, s?.currency);
      const nextPay = s?.next_payment_date ? fmtDate(s.next_payment_date) : "—";

      // Spec: end_date null => Auto-renews
      const end = s?.end_date ? fmtDate(s.end_date) : "Auto-renews";

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const isOpen = state.openSubNotes.has(id);

      return `
        <tr class="aa-sub-row" data-sub="${esc(id)}">
          <td class="mono">#${esc(id)}</td>
          <td>${renderPill(status)}</td>
          <td>${esc(total)}</td>
          <td>${esc(nextPay)}</td>
          <td>${esc(end)}</td>
          <td class="aa-notes-col">
            ${renderNotesToggle("Notes", notes.length, isOpen, "sub", id)}
          </td>
        </tr>
        ${isOpen ? `
          <tr class="aa-sub-notes">
            <td colspan="6">
              ${renderNotesList(notes)}
            </td>
          </tr>
        ` : ""}
      `;
    }).join("");

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriptions</div>
          <div class="aa-section-subtitle">Schedule &amp; Notes</div>
        </div>

        ${arr.length ? `
          <div class="aa-table-wrap">
            <table class="aa-table">
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Next Payment</th>
                  <th>End</th>
                  <th class="aa-notes-col">Notes</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        ` : `<div class="aa-empty">No subscriptions found.</div>`}
      </section>
    `;
  }

  function renderItems(lineItems) {
    const arr = Array.isArray(lineItems) ? lineItems : [];
    if (!arr.length) return "—";
    return arr.slice(0, 4).map(li => {
      const qty = li?.quantity ?? 0;
      const name = li?.name ?? "";
      return `${qty} × ${name}`;
    }).join(", ");
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];

    const rows = arr.map(o => {
      const id = String(o?.id ?? "");
      const date = fmtDate(o?.date_created);
      const status = o?.status || "—";
      const total = fmtMoney(o?.total, o?.currency);
      const pay = o?.payment_method_title || o?.payment_method || "—";
      const items = renderItems(o?.line_items);
      const notes = Array.isArray(o?.notes) ? o.notes : [];
      const isOpen = state.openOrderNotes.has(id);

      return `
        <tr class="aa-order-row" data-order="${esc(id)}">
          <td class="mono">#${esc(id)}</td>
          <td>${esc(date)}</td>
          <td>${renderPill(status)}</td>
          <td>${esc(total)}</td>
          <td>${esc(pay)}</td>
          <td>${esc(items)}</td>
          <td class="aa-notes-col">
            ${renderNotesToggle("Notes", notes.length, isOpen, "order", id)}
          </td>
        </tr>
        ${isOpen ? `
          <tr class="aa-order-notes">
            <td colspan="7">
              ${renderNotesList(notes)}
            </td>
          </tr>
        ` : ""}
      `;
    }).join("");

    return `
      <section class="card aa-section aa-orders">
        <div class="aa-section-head">
          <div class="aa-section-title">Orders</div>
          <div class="aa-section-subtitle">Most recent first</div>
        </div>

        ${arr.length ? `
          <div class="aa-table-wrap">
            <table class="aa-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Items</th>
                  <th class="aa-notes-col">Notes</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        ` : `<div class="aa-empty">No orders found.</div>`}
      </section>
    `;
  }

  function renderAll(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = ctx.subscriptions || [];
    const orders = ctx.orders || [];

    const parts = [];
    if (customer) parts.push(renderSubscriber(customer));
    parts.push(renderSubscriptions(subs));
    parts.push(renderOrders(orders));

    if (els.results) els.results.innerHTML = parts.join("");

    state.lastResponse = payload || null;
    if (els.rawJson) {
      const safe = stripMetaDataDeep(payload || {});
      els.rawJson.textContent = JSON.stringify(safe, null, 2);
    }
  }

  /* ================== EVENTS ================== */

  function onToggleNotesClick(e) {
    const t = e.target.closest(".aa-notes-toggle");
    if (!t) return;

    const kind = t.getAttribute("data-kind");
    const id = t.getAttribute("data-id");
    if (!kind || !id) return;

    if (kind === "sub") {
      if (state.openSubNotes.has(id)) state.openSubNotes.delete(id);
      else state.openSubNotes.add(id);
    } else if (kind === "order") {
      if (state.openOrderNotes.has(id)) state.openOrderNotes.delete(id);
      else state.openOrderNotes.add(id);
    }

    if (state.lastResponse) renderAll(state.lastResponse);
  }

  async function refreshSession() {
    try {
      const { resp, data } = await apiFetch(API.status, { method: "GET" });
      if (!resp.ok) {
        setSessionPill({ loggedIn: false, user: null });
        return;
      }
      const loggedIn = !!data?.loggedIn;
      setSessionPill({ loggedIn, user: data?.user || null });
    } catch (err) {
      console.warn("[ArnoldAdmin] status failed:", err?.message || err);
      setSessionPill({ loggedIn: false, user: null });
    }
  }

  async function doLogin() {
    if (!els.user || !els.pass) {
      setStatusLine("Login inputs not found (DOM id mismatch).", "err");
      return;
    }

    const username = String(els.user.value || "").trim();
    const password = String(els.pass.value || "").trim();

    if (!username || !password) {
      setStatusLine("Username and password required.", "warn");
      return;
    }

    setStatusLine("Logging in…", "warn");

    const { resp, data } = await apiFetch(API.login, {
      method: "POST",
      body: { username, password }
    });

    if (!resp.ok || !data?.success) {
      const msg = data?.message || data?.error || `Login failed (${resp.status})`;
      setStatusLine(msg, "err");
      await refreshSession();
      return;
    }

    setStatusLine("Logged in.", "ok");
    await refreshSession();
  }

  async function doLogout() {
    setStatusLine("Logging out…", "warn");
    await apiFetch(API.logout, { method: "POST" }).catch(() => {});
    setStatusLine("Logged out.", "ok");
    await refreshSession();
  }

  async function doSearch() {
    if (!els.query) {
      setStatusLine("Search input not found.", "err");
      return;
    }

    const q = String(els.query.value || "").trim();
    if (!q) {
      setStatusLine("Enter a search query.", "warn");
      return;
    }

    setStatusLine("Searching…", "warn");

    const { resp, data } = await apiFetch(API.search, {
      method: "POST",
      body: { query: q }
    });

    if (!resp.ok || !data?.ok) {
      setStatusLine(data?.error || `Search failed (${resp.status}).`, "err");
      state.lastResponse = data || null;
      if (els.rawJson) {
        const safe = stripMetaDataDeep(data || {});
        els.rawJson.textContent = JSON.stringify(safe, null, 2);
      }
      return;
    }

    setStatusLine("Search complete.", "ok");
    renderAll(data);
  }

  function toggleRaw() {
    if (!els.rawWrap) return;
    const isShown = els.rawWrap.style.display !== "none";
    els.rawWrap.style.display = isShown ? "none" : "block";
  }

  function bind() {
    if (els.results) {
      els.results.addEventListener("click", onToggleNotesClick);
      els.results.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target.closest(".aa-notes-toggle");
        if (!t) return;
        e.preventDefault();
        onToggleNotesClick(e);
      });
    }

    if (els.btnLogin) els.btnLogin.addEventListener("click", doLogin);
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);
    if (els.btnSearch) els.btnSearch.addEventListener("click", doSearch);

    if (els.query) {
      els.query.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }

    if (els.btnRaw) els.btnRaw.addEventListener("click", toggleRaw);
  }

  function init() {
    must(els.query, "query");
    must(els.btnSearch, "btnSearch");
    must(els.results, "results");

    bind();
    refreshSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
// 🔴 main.js