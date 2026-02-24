// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (UI stabilization pass 2026-02-24h)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ========= CONFIG ========= */

  const API_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ========= DOM ========= */

  const els = {
    msg: document.getElementById("msg"),

    loginUser: document.getElementById("loginUser"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    sessionPill: document.getElementById("sessionPill"),
    sessionText: document.getElementById("sessionText"),
    sessionState: document.getElementById("sessionState"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),

    customerOut: document.getElementById("customerOut"),
    subsOut: document.getElementById("subsOut"),
    ordersOut: document.getElementById("ordersOut"),

    rawWrap: document.getElementById("rawWrap"),
    rawJson: document.getElementById("rawJson")
  };

  /* ========= HELPERS ========= */

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Convert Woo HTML notes -> plain text (so we don't display <span> etc.)
  function toPlainText(html) {
    const s = String(html ?? "");
    if (!s) return "";
    try {
      const doc = new DOMParser().parseFromString(s, "text/html");
      const txt =
        (doc && doc.body && typeof doc.body.textContent === "string")
          ? doc.body.textContent
          : "";
      return txt.replace(/\s+/g, " ").trim();
    } catch (_) {
      // Fallback: strip tags (best-effort)
      return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function setMsg(text, kind) {
    if (!els.msg) return;
    if (!text) {
      els.msg.style.display = "none";
      els.msg.className = "msg";
      els.msg.textContent = "";
      return;
    }
    els.msg.style.display = "block";
    els.msg.className = `msg ${kind || ""}`.trim();
    els.msg.textContent = text;
  }

  function setBadge(text, ok) {
    if (!els.sessionState) return;
    els.sessionState.textContent = text;
    if (els.sessionPill) {
      els.sessionPill.style.opacity = "1";
      els.sessionPill.style.borderColor = ok
        ? "rgba(16,185,129,0.45)"
        : "rgba(255,255,255,0.22)";
    }
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const s = String(iso);
    // Keep date-only
    return s.split("T")[0].split(" ")[0] || "—";
  }

  function fmtMoney(total, currency) {
    const n = Number(total);
    const c = String(currency || "USD");
    if (!isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: c,
        minimumFractionDigits: 2
      }).format(n);
    } catch (_) {
      return `$${n.toFixed(2)}`;
    }
  }

  function okobserverCard(title, subtitle, bodyHtml) {
    return `
      <section class="card">
        <div class="card-hd">
          <div>
            <div class="card-title">${esc(title)}</div>
            <div class="card-sub">${subtitle ? esc(subtitle) : ""}</div>
          </div>
        </div>
        <div class="card-bd">${bodyHtml || ""}</div>
      </section>
    `;
  }

  // Render collapsible notes (Subscription Notes / Order Notes) as a right-justified details panel.
  // Notes are shown only when user expands the chevron.
  function renderNotesDetails(notes, labelText) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return "";

    const label = labelText || "Notes";
    return `
      <details class="aa-notes">
        <summary class="aa-notes-summary">
          <span class="aa-notes-label">${esc(label)}</span>
          <span class="aa-notes-arrow" aria-hidden="true">▾</span>
        </summary>
        <div class="aa-notes-wrap">
          <div class="aa-notes-col">
            ${arr.slice(0, 50).map(n => `
              <div class="aa-note-card">
                <div class="aa-note-meta">${esc(fmtDate(n?.date_created))}${n?.author ? ` • ${esc(n.author)}` : ""}</div>
                <div class="aa-note-text">${esc(toPlainText(n?.note || ""))}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </details>
    `;
  }

  /* ========= RENDERERS ========= */

  function renderSubscriber(customer) {
    const c = customer || null;
    if (!c) {
      return okobserverCard("Subscriber", "None", "No subscriber found.");
    }

    const id = c?.id ?? "—";
    const username = c?.username ? String(c.username) : "—";
    const fullName =
      [c?.first_name, c?.last_name].filter(Boolean).map(String).join(" ").trim() ||
      "—";

    const billing = c?.billing || null;
    const shipping = c?.shipping || null;

    const renderAddressCard = (label, a) => {
      const first = String(a?.first_name || "").trim();
      const last = String(a?.last_name || "").trim();
      const nameLine = [first, last].filter(Boolean).join(" ").trim();

      const addrParts = [
        a?.company,
        a?.address_1,
        a?.address_2,
        [a?.city, a?.state, a?.postcode].filter(Boolean).join(", "),
        a?.country
      ]
        .filter(Boolean)
        .map(String);

      const addr = addrParts.join(", ") || "—";

      // Keep email/phone inside billing/shipping blocks (per your instruction)
      const email = a?.email ? String(a.email) : "—";
      const phone = a?.phone ? String(a.phone) : "—";

      return `
        <div class="aa-addr">
          <div class="aa-addr-title">${esc(label)}</div>
          ${nameLine ? `<div class="aa-addr-name">${esc(nameLine)}</div>` : ""}
          <div class="aa-addr-grid">
            <div class="aa-addr-row">
              <div class="aa-lbl">Address</div>
              <div class="aa-val">${esc(addr)}</div>
            </div>
            <div class="aa-addr-row">
              <div class="aa-lbl">Email</div>
              <div class="aa-val">${esc(email)}</div>
            </div>
            <div class="aa-addr-row">
              <div class="aa-lbl">Phone</div>
              <div class="aa-val">${esc(phone)}</div>
            </div>
          </div>
        </div>
      `;
    };

    // Do NOT repeat customer email in subscriber card (spec)
    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Subscriber</div>
          <div class="card-sub">${esc(fullName)}</div>
        </div>
        <div class="card-bd">

          <div class="identity-grid">
            <div class="identity-item">
              <label>Customer ID</label>
              <div class="val-mono">${esc(id)}</div>
            </div>
            <div class="identity-item">
              <label>Username</label>
              <div class="val-mono">${esc(username)}</div>
            </div>
          </div>

          <div class="aa-split">
            ${renderAddressCard("Billing", billing)}
            ${renderAddressCard("Shipping", shipping)}
          </div>
        </div>
      </section>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      return `
        <section class="card">
          <div class="card-hd">
            <div class="card-title">Subscriptions</div>
            <div class="card-sub">None</div>
          </div>
          <div class="card-bd">No subscriptions found.</div>
        </section>
      `;
    }

    const rowHtml = (s) => {
      const id = s?.id ?? "—";
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);
      const nextPay = s?.next_payment_date ? esc(fmtDate(s.next_payment_date)) : "—";

      // If end_date is empty, show Auto-renews (spec)
      const end = s?.end_date ? esc(fmtDate(s.end_date)) : "Auto-renews";

      const notesHtml = renderNotesDetails(s?.notes, "Notes");

      return `
        <tr>
          <td><span class="aa-mono">#${id}</span> <span class="aa-badge">${status}</span></td>
          <td>${total}</td>
          <td>${nextPay}</td>
          <td>${end}</td>
          <td class="aa-notes-cell">${notesHtml || ""}</td>
        </tr>
      `;
    };

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Subscriptions</div>
          <div class="card-sub">Schedule &amp; Notes</div>
        </div>
        <div class="card-bd">
          <div class="aa-table-wrap">
            <table class="aa-table">
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Total</th>
                  <th>Next Payment</th>
                  <th>End</th>
                  <th class="aa-notes-th">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${arr.map(rowHtml).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      return `
        <section class="card">
          <div class="card-hd">
            <div class="card-title">Orders</div>
            <div class="card-sub">None</div>
          </div>
          <div class="card-bd">No orders found.</div>
        </section>
      `;
    }

    const itemsSummary = (o) => {
      const items = Array.isArray(o?.line_items) ? o.line_items : [];
      if (!items.length) return "—";
      const parts = items.slice(0, 6).map(li => {
        const q = Number(li?.quantity || 0) || 0;
        const nm = String(li?.name || "").trim();
        if (!nm) return null;
        return `${q ? `${q} × ` : ""}${nm}`;
      }).filter(Boolean);
      return parts.length ? esc(parts.join(" • ")) : "—";
    };

    const rowHtml = (o) => {
      const id = o?.id ?? "—";
      const date = o?.date_created ? esc(fmtDate(o.date_created)) : "—";
      const status = esc(o?.status ?? "—");
      const total = fmtMoney(o?.total, o?.currency);
      const pay = esc(o?.payment_method_title || o?.payment_method || "—");
      const items = itemsSummary(o);

      const notesHtml = renderNotesDetails(o?.notes, "Notes");

      return `
        <tr>
          <td><span class="aa-mono">#${id}</span></td>
          <td>${date}</td>
          <td><span class="aa-badge">${status}</span></td>
          <td>${total}</td>
          <td>${pay}</td>
          <td>${items}</td>
          <td class="aa-notes-cell">${notesHtml || ""}</td>
        </tr>
      `;
    };

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Orders</div>
          <div class="card-sub">Most recent first</div>
        </div>
        <div class="card-bd">
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
                  <th class="aa-notes-th">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${arr.map(rowHtml).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  /* ========= ACTIONS ========= */

  async function api(path, init) {
    const url = `${API_BASE}${path}`;
    const opts = {
      ...init,
      credentials: "include",
      headers: {
        ...(init && init.headers ? init.headers : {})
      }
    };
    const resp = await fetch(url, opts);
    return resp;
  }

  function clearOutputs() {
    if (els.customerOut) els.customerOut.innerHTML = "";
    if (els.subsOut) els.subsOut.innerHTML = "";
    if (els.ordersOut) els.ordersOut.innerHTML = "";
    toggleRaw(false);
  }

  function toggleRaw(show, obj) {
    if (!els.rawWrap || !els.rawJson) return;
    if (!show) {
      els.rawWrap.style.display = "none";
      els.rawJson.textContent = "";
      return;
    }
    els.rawWrap.style.display = "block";
    els.rawJson.textContent = JSON.stringify(obj || {}, null, 2);
  }

  async function refreshStatus() {
    const r = await api("/admin/status", { method: "GET" });
    const data = await r.json().catch(() => null);

    const loggedIn = !!data?.loggedIn;
    if (loggedIn) {
      const name = data?.user?.name || data?.user?.slug || "admin";
      setBadge(`logged in as ${name}`, true);
      setMsg("", "");
    } else {
      setBadge("logged out", false);
    }

    // Enable/disable buttons based on session state
    if (els.btnLogin) els.btnLogin.disabled = loggedIn;
    if (els.btnLogout) els.btnLogout.disabled = !loggedIn;
    if (els.btnSearch) els.btnSearch.disabled = !loggedIn;

    return loggedIn;
  }

  async function doLogin() {
    const u = String(els.loginUser?.value || "").trim();
    const p = String(els.loginPass?.value || "").trim();

    if (!u || !p) {
      setMsg("Username and password required.", "err");
      return;
    }

    setMsg("Logging in…", "");

    const r = await api("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data?.success) {
      console.log("[Login] status", r.status, data);
      setMsg(data?.message || `Login failed (${r.status}).`, "err");
      await refreshStatus().catch(() => {});
      return;
    }

    setMsg("Logged in.", "ok");
    await refreshStatus().catch(() => {});
  }

  async function doLogout() {
    setMsg("Logging out…", "");
    const r = await api("/admin/logout", { method: "POST" });
    const data = await r.json().catch(() => null);

    if (!r.ok || !data?.success) {
      console.log("[Logout] status", r.status, data);
      setMsg(`Logout failed (${r.status}).`, "err");
    } else {
      setMsg("Logged out.", "ok");
    }

    clearOutputs();
    await refreshStatus().catch(() => {});
  }

  async function doSearch() {
    const q = String(els.query?.value || "").trim();
    if (!q) {
      setMsg("Enter a search query (email, order #, etc.).", "err");
      return;
    }

    clearOutputs();
    setMsg("Searching…", "");

    const r = await api("/admin/nl-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q })
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data?.ok) {
      console.log("[Search] status", r.status, data);
      const msg = data?.error || data?.message || `Search failed (${r.status}).`;
      setMsg(msg, "err");
      toggleRaw(true, data || { status: r.status });
      return;
    }

    const ctx = data?.context || {};
    const customer = ctx?.customer || null;
    const subs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    if (els.customerOut) els.customerOut.innerHTML = renderSubscriber(customer);
    if (els.subsOut) els.subsOut.innerHTML = renderSubscriptions(subs);
    if (els.ordersOut) els.ordersOut.innerHTML = renderOrders(orders);

    setMsg(`Found ${subs.length} subscription(s) and ${orders.length} order(s).`, "ok");
    toggleRaw(true, data);
  }

  /* ========= WIRE UP ========= */

  els.btnLogin?.addEventListener("click", () => doLogin().catch(err => {
    console.log("[Login] error", err);
    setMsg("Login failed (see console).", "err");
  }));

  els.btnLogout?.addEventListener("click", () => doLogout().catch(err => {
    console.log("[Logout] error", err);
    setMsg("Logout failed (see console).", "err");
  }));

  els.btnSearch?.addEventListener("click", () => doSearch().catch(err => {
    console.log("[Search] error", err);
    setMsg("Search failed (see console).", "err");
  }));

  // Enter key behavior
  els.loginPass?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.btnLogin?.click();
  });
  els.query?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.btnSearch?.click();
  });

  /* ========= INIT ========= */

  toggleRaw(false);
  refreshStatus().catch(() => {
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js