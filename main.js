// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-02-26e — Restore table layout + billing/shipping email/phone + order items)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  // -----------------------------
  // CONFIG
  // -----------------------------
  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  // -----------------------------
  // DOM HELPERS
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // -----------------------------
  // STATUS LINE
  // -----------------------------
  function friendlyText(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;

    if (typeof x === "object") {
      if (typeof x.message === "string") return x.message;
      if (typeof x.error === "string") return x.error;
      if (typeof x.detail === "string") return x.detail;
      if (typeof x.reason === "string") return x.reason;
      try {
        const s = JSON.stringify(x);
        return s.length > 220 ? s.slice(0, 220) + "…" : s;
      } catch {
        return "An unexpected error occurred.";
      }
    }

    return String(x);
  }

  function isNotFoundish(status, payload) {
    const msg = (friendlyText(payload?.error || payload?.message || payload?.detail)).toLowerCase();
    return status === 404 || msg.includes("not found") || msg.includes("no results") || msg.includes("no matching");
  }

  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = friendlyText(text ?? "");
  }

  // -----------------------------
  // SESSION PILL
  // -----------------------------
  function setSessionPill(ok, who) {
    const dot = $("sessionDot");
    const txt = $("sessionText");
    if (!dot || !txt) return;

    dot.classList.toggle("ok", !!ok);
    if (ok) txt.textContent = `Session: logged in as ${who || "user"}`;
    else txt.textContent = "Session: not logged in";
  }

  async function checkSession() {
    try {
      const r = await fetch(`${WORKER_BASE}/admin/status`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setSessionPill(true, j?.user?.user_login || j?.user?.display_name || null);
      else setSessionPill(false, null);
    } catch {
      setSessionPill(false, null);
    }
  }

  // -----------------------------
  // RAW JSON TOGGLE
  // -----------------------------
  let rawVisible = false;
  function renderRawJson(obj) {
    const el = $("rawJson");
    if (!el) return;

    if (!obj) {
      el.textContent = "";
      el.classList.toggle("show", rawVisible && !!el.textContent);
      return;
    }
    el.textContent = JSON.stringify(obj, null, 2);
    el.classList.toggle("show", rawVisible);
  }

  // -----------------------------
  // FORMATTERS
  // -----------------------------
  function fmtMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtPhone(p) {
    const digits = String(p || "").replace(/\D+/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return p || "";
  }

  function normalizeStatus(s) {
    return String(s || "").replace(/_/g, " ").toLowerCase().trim();
  }

  function titleCase(s) {
    return String(s || "")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // -----------------------------
  // ADDRESS / CUSTOMER CARDS
  // -----------------------------
  function renderCustomerCard(customer) {
    const id = customer?.id ?? "—";
    const username = customer?.username ?? customer?.email ?? "—";

    return `
      <div class="aa-tiles customer">
        <div class="aa-tile">
          <div class="aa-label">Customer ID</div>
          <div class="aa-value">${esc(String(id))}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Username</div>
          <div class="aa-value">${esc(String(username))}</div>
        </div>
      </div>
    `;
  }

  function renderAddressBlock(title, addr, fallbackAddr) {
    const a = addr || null;
    const f = fallbackAddr || null;

    const pick = (key) => {
      const v = (a?.[key] ?? "");
      if (String(v).trim()) return v;
      return (f?.[key] ?? "");
    };

    const showName = (() => {
      const fn = String(pick("first_name") ?? "").trim();
      const ln = String(pick("last_name") ?? "").trim();
      const nm = [fn, ln].filter(Boolean).join(" ").trim();
      return nm || "—";
    })();

    const showAddrLines = (() => {
      const b1 = String(pick("address_1") ?? "").trim();
      const b2 = String(pick("address_2") ?? "").trim();
      const c = String(pick("city") ?? "").trim();
      const s = String(pick("state") ?? "").trim();
      const z = String(pick("postcode") ?? "").trim();
      const co = String(pick("country") ?? "").trim();

      const lines = [];
      if (b1) lines.push(b1);
      if (b2) lines.push(b2);
      const cs = [c, s].filter(Boolean).join(", ");
      const csz = [cs, z].filter(Boolean).join(" ");
      if (csz) lines.push(csz);
      if (co) lines.push(co);
      return lines.length ? lines.join("<br>") : "—";
    })();

    const showEmail = String(pick("email") ?? "").trim() || "—";
    const showPhone = fmtPhone(String(pick("phone") ?? "").trim()) || "—";

    return `
      <div class="aa-card">
        <div class="aa-card-title">${esc(title)}</div>
        <div class="aa-tiles onecol">
          <div class="aa-tile">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(showName)}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Address</div>
            <div class="aa-value">${showAddrLines}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Email</div>
            <div class="aa-value">${esc(showEmail)}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Phone</div>
            <div class="aa-value">${esc(showPhone)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAddressColumn(title, addr, fallbackAddr) {
    const a = addr || null;
    const f = fallbackAddr || null;

    const pick = (key) => {
      const v = (a?.[key] ?? "");
      if (String(v).trim()) return v;
      return (f?.[key] ?? "");
    };

    const showName = (() => {
      const fn = String(pick("first_name") ?? "").trim();
      const ln = String(pick("last_name") ?? "").trim();
      const nm = [fn, ln].filter(Boolean).join(" ").trim();
      return nm || "—";
    })();

    const showAddrLines = (() => {
      const b1 = String(pick("address_1") ?? "").trim();
      const b2 = String(pick("address_2") ?? "").trim();
      const c  = String(pick("city") ?? "").trim();
      const s  = String(pick("state") ?? "").trim();
      const z  = String(pick("postcode") ?? "").trim();
      const co = String(pick("country") ?? "").trim();

      const lines = [];
      if (b1) lines.push(b1);
      if (b2) lines.push(b2);
      const cs = [c, s].filter(Boolean).join(", ");
      const csz = [cs, z].filter(Boolean).join(" ");
      if (csz) lines.push(csz);
      if (co) lines.push(co);
      return lines.length ? lines.join("<br>") : "—";
    })();

    const showEmail = String(pick("email") ?? "").trim() || "—";
    const showPhone = fmtPhone(String(pick("phone") ?? "").trim()) || "—";

    return `
      <div>
        <div class="aa-subhead">${esc(title)}</div>
        <div class="aa-tiles onecol">
          <div class="aa-tile">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(showName)}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Address</div>
            <div class="aa-value">${showAddrLines}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Email</div>
            <div class="aa-value">${esc(showEmail)}</div>
          </div>
          <div class="aa-tile">
            <div class="aa-label">Phone</div>
            <div class="aa-value">${esc(showPhone)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // -----------------------------
  // NOTES
  // -----------------------------
  const notesOpen = new Set(); // keys like "sub:123" or "ord:456"

  function toggleNotes(key) {
    if (notesOpen.has(key)) notesOpen.delete(key);
    else notesOpen.add(key);
    // re-render last payload if we have it
    if (lastPayload) renderResults(lastPayload);
  }

  function renderNotesBox(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return `<div class="aa-muted">No notes.</div>`;

    return arr
      .map((n) => {
        const who = n?.author || n?.author_name || n?.added_by || "—";
        const when = fmtDate(n?.date_created || n?.date || n?.created_at);
        const txt = n?.note || n?.content || n?.text || "";
        return `
          <div class="aa-notes-item">
            <div class="aa-note-meta">${esc(who)} • ${esc(when)}</div>
            <div class="aa-note-text">${esc(txt)}</div>
          </div>
        `;
      })
      .join("");
  }

  // -----------------------------
  // SUBSCRIPTIONS TABLE
  // -----------------------------
  function renderSubRow(sub) {
    const id = sub?.id ?? sub?.subscription_id ?? "—";
    const status = titleCase(normalizeStatus(sub?.status));
    const total = fmtMoney(sub?.total ?? sub?.total_amount ?? sub?.order_total);
    const nextPay = fmtDate(sub?.next_payment_date || sub?.next_payment);
    const end = sub?.end_date ? fmtDate(sub.end_date) : (sub?.auto_renew ? "Auto-renews" : "—");
    const notes = sub?.notes || [];
    const noteCount = Array.isArray(notes) ? notes.length : 0;

    const key = `sub:${id}`;
    const isOpen = notesOpen.has(key);
    const btn = `
      <span class="aa-notes-btn" data-notes="${esc(key)}">
        Notes <span class="aa-notes-count">${noteCount}</span> ${isOpen ? "▴" : "▾"}
      </span>
    `;

    const notesHtml = renderNotesBox(notes);

    return `
      <tr>
        <td><strong>#${esc(id)}</strong> &nbsp; <span class="aa-pill">${esc(status || "—")}</span></td>
        <td>${esc(total)}</td>
        <td>${esc(nextPay)}</td>
        <td>${esc(end)}</td>
        <td class="aa-notes-cell">${btn}</td>
      </tr>
      ${isOpen ? `<tr class="aa-notes-row"><td colspan="5"><div class="aa-notes-box">${notesHtml}</div></td></tr>` : ``}
    `;
  }

  // -----------------------------
  // ORDERS TABLE
  // -----------------------------
  function renderOrderItems(order) {
    const items = Array.isArray(order?.line_items) ? order.line_items : (Array.isArray(order?.items) ? order.items : []);
    if (!items.length) return `<span class="aa-muted">—</span>`;
    return items
      .map((it) => {
        const qty = it?.quantity ?? it?.qty ?? 1;
        const name = it?.name ?? it?.product_name ?? "Item";
        return `${esc(String(qty))} × ${esc(String(name))}`;
      })
      .join("<br>");
  }

  function renderOrderRow(order) {
    const id = order?.id ?? order?.order_id ?? "—";
    const status = titleCase(normalizeStatus(order?.status));
    const total = fmtMoney(order?.total ?? order?.total_amount ?? order?.order_total);
    const date = fmtDate(order?.date_created || order?.date || order?.created_at);
    const payment = order?.payment_method_title || order?.payment_method || "—";

    const notes = order?.notes || [];
    const noteCount = Array.isArray(notes) ? notes.length : 0;

    const key = `ord:${id}`;
    const isOpen = notesOpen.has(key);
    const btn = `
      <span class="aa-notes-btn" data-notes="${esc(key)}">
        Notes <span class="aa-notes-count">${noteCount}</span> ${isOpen ? "▴" : "▾"}
      </span>
    `;

    const notesHtml = renderNotesBox(notes);

    return `
      <tr>
        <td><strong>#${esc(id)}</strong></td>
        <td>${esc(date)}</td>
        <td><span class="aa-pill">${esc(status || "—")}</span></td>
        <td>${esc(total)}</td>
        <td>${esc(String(payment))}</td>
        <td>${renderOrderItems(order)}</td>
        <td class="aa-notes-cell">${btn}</td>
      </tr>
      ${isOpen ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${notesHtml}</div></td></tr>` : ``}
    `;
  }

  function renderResults(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    const billing = customer?.billing || ctx.billing || null;
    const shipping = customer?.shipping || ctx.shipping || null;

    const customerTiles = customer ? renderCustomerCard(customer) : "";
    const billingCol = renderAddressColumn("Billing", billing, null);
    const shippingCol = renderAddressColumn("Shipping", shipping, billing);

    const subsRows = subs.length
      ? subs.map(renderSubRow).join("")
      : `<tr><td colspan="5" class="aa-muted">No subscriptions found.</td></tr>`;

    const orderRows = orders.length
      ? orders.map(renderOrderRow).join("")
      : `<tr><td colspan="7" class="aa-muted">No orders found.</td></tr>`;

    const app = $("app");
    if (!app) return;

    app.innerHTML = `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
        </div>

        <div class="aa-card">
          <div class="aa-card-title">Subscriber</div>

          <div class="aa-subblock">
            <div class="aa-subtitle">Customer</div>
            ${customerTiles}
          </div>

          <div class="aa-subblock">
            <div class="aa-subtitle">Billing & Shipping</div>
            <div class="aa-grid-2">
              ${billingCol}
              ${shippingCol}
            </div>
          </div>
        </div>
      </section>

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriptions</div>
          <div class="aa-section-meta">Schedule & Notes</div>
        </div>

        <div class="aa-card" style="padding:0;">
          <table class="aa-table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Total</th>
                <th>Next Payment</th>
                <th>End</th>
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>${subsRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Orders</div>
          <div class="aa-section-meta">Most recent first</div>
        </div>

        <div class="aa-card" style="padding:0;">
          <table class="aa-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Items</th>
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>${orderRows}</tbody>
          </table>
        </div>
      </section>
    `;

    // bind notes toggles
    app.querySelectorAll("[data-notes]").forEach((el) => {
      el.addEventListener("click", () => toggleNotes(el.getAttribute("data-notes")));
    });
  }

  // -----------------------------
  // TOTALS
  // -----------------------------
  function renderTotals(payload) {
    const stats = payload?.stats || payload?.context || payload || {};
    const byStatus = stats?.subscriptions_by_status || {};

    const rows = Object.entries(byStatus).map(([k, v]) => {
      return `<tr><td>${esc(String(k))}</td><td style="text-align:right;font-weight:900;">${esc(String(v))}</td></tr>`;
    });

    const app = $("app");
    if (!app) return;

    app.innerHTML = `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Totals</div>
          <div class="aa-section-meta">Subscriptions by status</div>
        </div>

        <div class="aa-card" style="padding:0;">
          <table class="aa-table">
            <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
            <tbody>${rows.length ? rows.join("") : `<tr><td colspan="2" class="aa-muted">No totals.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  // -----------------------------
  // ACTIONS
  // -----------------------------
  let lastPayload = null;

  async function doLogin() {
    const user = $("loginUser")?.value?.trim() || "";
    const pass = $("loginPass")?.value || "";
    if (!user || !pass) {
      setStatus("warn", "Enter username + password.");
      return;
    }

    setStatus("", "Logging in…");
    renderRawJson(null);

    try {
      const r = await fetch(`${WORKER_BASE}/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const j = await r.json().catch(() => null);
      renderRawJson(j);

      if (r.ok && j?.ok) {
        setStatus("ok", "Login successful.");
        await checkSession();
      } else {
        setStatus("err", friendlyText(j?.error || j?.message) || `Login failed (${r.status})`);
        await checkSession();
      }
    } catch (e) {
      setStatus("err", friendlyText(e) || "Login error.");
      await checkSession();
    }
  }

  async function doLogout() {
    setStatus("", "Logging out…");
    renderRawJson(null);

    try {
      const r = await fetch(`${WORKER_BASE}/admin/logout`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      renderRawJson(j);

      if (r.ok && j?.ok) setStatus("ok", "Logged out.");
      else setStatus("warn", friendlyText(j?.error || j?.message) || "Logout complete.");

      await checkSession();
    } catch {
      setStatus("warn", "Logout complete.");
      await checkSession();
    }
  }

  async function doSearch() {
    const q = $("q")?.value?.trim() || "";
    if (!q) {
      setStatus("warn", "Enter a query.");
      return;
    }

    setStatus("", "Searching…");
    renderRawJson(null);

    try {
      const r = await fetch(`${WORKER_BASE}/admin/nl-search?q=${encodeURIComponent(q)}`, {
        credentials: "include",
      });

      const j = await r.json().catch(() => null);
      renderRawJson(j);

      if (!r.ok || !j?.ok) {
        const qTxt = $("q")?.value?.trim() || "";
        if (isNotFoundish(r.status, j)) {
          setStatus("warn", `No results found for "${qTxt}". Try an email address or an order # (example: #385309).`);
        } else {
          setStatus("warn", friendlyText(j?.error || j?.message) || `Search failed (${r.status})`);
        }
        renderRawJson();
        return;
      }

      lastPayload = j;
      setStatus("ok", "Search complete.");
      renderResults(j);
    } catch (e) {
      setStatus("err", friendlyText(e) || "Search error.");
    }
  }

  async function doTotals() {
    setStatus("", "Loading totals…");
    renderRawJson(null);

    try {
      const r = await fetch(`${WORKER_BASE}/admin/stats`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      renderRawJson(j);

      if (!r.ok || !j?.ok) {
        setStatus("warn", friendlyText(j?.error || j?.message) || `Totals failed (${r.status})`);
        return;
      }

      setStatus("ok", "Totals loaded.");
      renderTotals(j);
    } catch (e) {
      setStatus("err", friendlyText(e) || "Totals error.");
    }
  }

  // -----------------------------
  // INIT
  // -----------------------------
  function bind() {
    $("btnLogin")?.addEventListener("click", doLogin);
    $("btnLogout")?.addEventListener("click", doLogout);
    $("btnSearch")?.addEventListener("click", doSearch);
    $("btnTotals")?.addEventListener("click", doTotals);

    $("q")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    $("toggleRaw")?.addEventListener("click", () => {
      rawVisible = !rawVisible;
      $("rawJson")?.classList.toggle("show", rawVisible);
    });
  }

  async function init() {
    bind();
    await checkSession().catch(() => setSessionPill(false, null));
  }

  init();
})();
// 🔴 main.js