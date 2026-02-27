// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-02-26d — Restore table layout + billing/shipping email/phone + order items)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

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
  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = String(text ?? "");
  }

  // -----------------------------
  // PRETTY FORMATTERS
  // -----------------------------
  function fmtDate(val) {
    if (!val) return "—";
    const d = new Date(val);
    if (!Number.isFinite(d.getTime())) return String(val);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  function fmtMoney(total, currency) {
    if (total == null) return "—";
    const raw = String(total).trim();
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return "—";

    const usd = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

    const cur = currency ? String(currency).trim().toUpperCase() : "";
    if (cur && cur !== "USD") return `${usd} ${cur}`;
    return usd;
  }

  function fmtPhone(val) {
    const s = String(val ?? "").trim();
    if (!s) return "";
    const digits = s.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return s;
  }

  // -----------------------------
  // SAFE HTML STRIP FOR NOTES
  // -----------------------------
  function stripHtml(html) {
    const s = String(html ?? "");
    if (!s) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    const text = tmp.textContent || tmp.innerText || "";
    return text.replace(/\s+/g, " ").trim();
  }

  // -----------------------------
  // SESSION UI
  // -----------------------------
  function setSessionPill(isLoggedIn, name) {
    const pill = $("sessionPill");
    const txt = $("sessionText");
    if (!pill || !txt) return;

    if (isLoggedIn) {
      pill.classList.add("ok");
      txt.textContent = `Session: logged in as ${name || "admin"}`;
    } else {
      pill.classList.remove("ok");
      txt.textContent = "Session: unknown";
    }
  }

  async function refreshSession() {
    const r = await fetch(`${WORKER_BASE}/admin/status`, {
      method: "GET",
      credentials: "include"
    });
    const j = await r.json().catch(() => null);
    if (j && j.loggedIn) {
      setSessionPill(true, j?.user?.name || j?.user?.slug || "admin");
      return true;
    }
    setSessionPill(false, null);
    return false;
  }

  // -----------------------------
  // RAW JSON TOGGLE (hide meta_data in viewer)
  // -----------------------------
  // Re-render state (so Notes toggles can expand table rows)
  let lastMode = null; // 'search' | 'totals'
  let lastPayload = null;

  let rawVisible = false;
  let lastRaw = null;

  function scrubMetaData(obj) {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(scrubMetaData);

    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "meta_data") continue;
      out[k] = scrubMetaData(v);
    }
    return out;
  }

  function ensureRawBox() {
    let box = $("rawJsonBox");
    if (box) return box;

    const wrap = document.querySelector(".wrap");
    const btn = $("btnRawJson");
    if (!wrap || !btn) return null;

    box = document.createElement("pre");
    box.id = "rawJsonBox";
    box.style.display = "none";
    wrap.insertBefore(box, btn);
    return box;
  }

  function renderRawJson() {
    const box = ensureRawBox();
    if (!box) return;
    if (!rawVisible) {
      box.textContent = "";
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    const cleaned = scrubMetaData(lastRaw);
    box.textContent = JSON.stringify(cleaned, null, 2);
  }

  function toggleRawJson() {
    rawVisible = !rawVisible;
    renderRawJson();
  }

  // -----------------------------
  // ADDRESS / CUSTOMER CARDS
  // -----------------------------
  function renderCustomerCard(customer) {
    const id = customer?.id ?? "—";
    const username = customer?.username ?? customer?.email ?? "—";
    const fn = (customer?.first_name ?? "").trim();
    const ln = (customer?.last_name ?? "").trim();
    const name = [fn, ln].filter(Boolean).join(" ").trim() || "—";

    return `
      <div class="aa-card">
        <div class="aa-card-title">Customer</div>

        <div class="aa-tiles customer">
          <div class="aa-tile">
            <div class="aa-label">Customer ID</div>
            <div class="aa-value">${esc(String(id))}</div>
          </div>

          <div class="aa-tile">
            <div class="aa-label">Username</div>
            <div class="aa-value">${esc(String(username))}</div>
          </div>

          <div class="aa-tile">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(String(name))}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAddressBlock(title, addr, fallbackAddr) {
    const a = addr || null;
    const f = fallbackAddr || null;

    const first = (a?.first_name ?? "").trim();
    const last = (a?.last_name ?? "").trim();
    const name = [first, last].filter(Boolean).join(" ").trim();

    const addr1 = (a?.address_1 ?? "").trim();
    const addr2 = (a?.address_2 ?? "").trim();
    const city = (a?.city ?? "").trim();
    const state = (a?.state ?? "").trim();
    const zip = (a?.postcode ?? "").trim();
    const country = (a?.country ?? "").trim();

    const email = (a?.email ?? "").trim();
    const phone = fmtPhone((a?.phone ?? "").trim());

    const hasAny =
      name || addr1 || addr2 || city || state || zip || country || email || phone;

    // Shipping fallback: if missing, show "Same as billing" and use billing fields
    const sameAsBilling = title.toLowerCase() === "shipping" && !hasAny && f;

    const pick = (key) => {
      if (!sameAsBilling) return (a?.[key] ?? "");
      return (f?.[key] ?? "");
    };

    const showName = (() => {
      const fn = String(pick("first_name") ?? "").trim();
      const ln = String(pick("last_name") ?? "").trim();
      const nm = [fn, ln].filter(Boolean).join(" ").trim();
      if (nm) return nm;
      if (sameAsBilling) return "Same as billing";
      return "—";
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

    const showEmail = (() => {
      const e = String(pick("email") ?? "").trim();
      return e || "—";
    })();

    const showPhone = (() => {
      const p = fmtPhone(String(pick("phone") ?? "").trim());
      return p || "—";
    })();

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

  // -----------------------------
  // NOTES (COLLAPSIBLE)
  // -----------------------------
  const openSubNotes = new Set();
  const openOrderNotes = new Set();

  function renderNotesToggle(kind, id, notes) {
    const set = kind === "sub" ? openSubNotes : openOrderNotes;
    const isOpen = set.has(id);

    const safeNotes = Array.isArray(notes) ? notes : [];
    const arrow = isOpen ? "▾" : "▸";

    return `
      <button class="aa-notes-toggle" data-kind="${esc(kind)}" data-id="${esc(String(id))}">
        <span class="aa-notes-label">Notes</span>
        <span class="aa-notes-count">${esc(String(safeNotes.length || 0))}</span>
        <span class="aa-notes-arrow">${arrow}</span>
      </button>
    `;
  }

  function bindNotesToggles(container) {
    if (!container) return;
    container.querySelectorAll(".aa-notes-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-kind");
        const id = btn.getAttribute("data-id");
        if (!kind || !id) return;

        const set = kind === "sub" ? openSubNotes : openOrderNotes;
        if (set.has(id)) set.delete(id);
        else set.add(id);

        // Re-render current view so the table can insert/remove expanded rows
        if (lastMode === "search" && lastPayload) {
          $("results").innerHTML = renderResults(lastPayload);
          bindNotesToggles($("results"));
        }
      });
    });
  }

  function renderSubscriptionRow(s) {
    const id = String(s?.id ?? "—");
    const status = String(s?.status ?? "—");
    const total = fmtMoney(s?.total, s?.currency);
    const nextPay = fmtDate(s?.next_payment_date);
    const end = s?.end_date ? fmtDate(s?.end_date) : "Auto-renews";

    const notes = Array.isArray(s?.notes) ? s.notes : [];
    const isOpen = openSubNotes.has(id);

    const btn = renderNotesToggle("sub", id, notes);

    const notesHtml = notes.length
      ? notes
          .map((n) => {
            const when = fmtDate(n?.date_created);
            const who = n?.author || n?.added_by || "";
            const text = stripHtml(n?.note || "");
            return `<div class="aa-note">
              <div class="aa-note-meta">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
              <div class="aa-note-text">${esc(text || "—")}</div>
            </div>`;
          })
          .join("")
      : `<div class="aa-muted">No notes.</div>`;

    return `
      <tr>
        <td>
          <span class="aa-sub-id">#${esc(id)}</span>
          <span class="aa-pill">${esc(status)}</span>
        </td>
        <td>${esc(total)}</td>
        <td>${esc(nextPay)}</td>
        <td>${esc(end)}</td>
        <td class="aa-notes-cell">${btn}</td>
      </tr>
      ${isOpen ? `<tr class="aa-notes-row"><td colspan="5"><div class="aa-notes-box">${notesHtml}</div></td></tr>` : ``}
    `;
  }

  function renderOrderRow(o) {
    const id = String(o?.id ?? "—");
    const status = String(o?.status ?? "—");
    const total = fmtMoney(o?.total, o?.currency);
    const created = fmtDate(o?.date_created);

    const payment = (() => {
      const pm = (o?.payment_method_title ?? "").trim();
      return pm || "—";
    })();

    // Items purchased (WooCommerce orders use `line_items`)
    const li = Array.isArray(o?.line_items)
      ? o.line_items
      : (Array.isArray(o?.items) ? o.items : []);
    const itemsText = li.length
      ? li
          .map((it) => {
            const nm = (it?.name ?? "").trim();
            const qty = it?.quantity ?? it?.qty ?? "";
            if (!nm) return "";
            if (qty === "" || qty == null) return nm;
            return `${nm} ×${qty}`;
          })
          .filter(Boolean)
          .join("; ")
      : "—";

    const notes = Array.isArray(o?.notes) ? o.notes : [];
    const isOpen = openOrderNotes.has(id);
    const btn = renderNotesToggle("order", id, notes);

    const notesHtml = notes.length
      ? notes
          .map((n) => {
            const when = fmtDate(n?.date_created);
            const who = n?.author || n?.added_by || "";
            const text = stripHtml(n?.note || "");
            return `<div class="aa-note">
              <div class="aa-note-meta">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
              <div class="aa-note-text">${esc(text || "—")}</div>
            </div>`;
          })
          .join("")
      : `<div class="aa-muted">No notes.</div>`;

    return `
      <tr>
        <td><span class="aa-order-id">#${esc(id)}</span></td>
        <td>${esc(created)}</td>
        <td><span class="aa-pill">${esc(status)}</span></td>
        <td>${esc(total)}</td>
        <td>${esc(payment)}</td>
        <td title="${esc(itemsText)}">${esc(itemsText)}</td>
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

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer ? renderCustomerCard(customer) : "";
    const billingCard = renderAddressBlock("Billing", billing, null);
    const shippingCard = renderAddressBlock("Shipping", shipping, billing);

    const subsBody = subs.length ? subs.map(renderSubscriptionRow).join("") : `
      <tr><td colspan="5" class="aa-muted">No subscriptions found.</td></tr>
    `;

    const ordersBody = orders.length ? orders.map(renderOrderRow).join("") : `
      <tr><td colspan="7" class="aa-muted">No orders found.</td></tr>
    `;

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
        </div>

        ${customerCard}

        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriptions</div>
          <div class="aa-section-subtitle">Schedule & Notes</div>
        </div>

        <div class="aa-table-wrap">
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
            <tbody>
              ${subsBody}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Orders</div>
          <div class="aa-section-subtitle">Most recent first</div>
        </div>

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
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${ordersBody}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // -----------------------------
  // TOTALS
  // -----------------------------
  function renderTotals(data) {
    const d = data || {};
    const subs = d.subscriptions_by_status || {};
    const gen = d.generated_at ? fmtDate(d.generated_at) : "";

    const SUB_STATUS_ORDER = [
      "Trash","Active","Expired","On hold","Pending payment","Pending cancellation","Cancelled"
    ];

    const subRows = SUB_STATUS_ORDER
      .map((label) => {
        const count = (subs[label] != null) ? subs[label] : 0;
        return `<tr><td><b>${esc(label)}</b></td><td style="text-align:right;"><b>${esc(String(count))}</b></td></tr>`;
      })
      .join("") || `<tr><td colspan="2">—</td></tr>`;

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Totals</div>
          <div class="aa-section-subtitle">${esc(gen ? `Generated ${gen}` : "")}</div>
        </div>

        <div class="aa-table-wrap">
          <table class="aa-table" style="min-width:420px;">
            <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
            <tbody>${subRows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  // -----------------------------
  // API ACTIONS
  // -----------------------------
  async function doLogin() {
    const u = $("loginUser")?.value?.trim() || "";
    const p = $("loginPass")?.value?.trim() || "";

    if (!u || !p) {
      setStatus("warn", "Username and password required.");
      return;
    }

    setStatus("busy", "Logging in…");

    const r = await fetch(`${WORKER_BASE}/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) {
      setStatus("warn", j?.message || `Login failed (${r.status})`);
      setSessionPill(false, null);
      return;
    }

    setStatus("", "Logged in.");
    await refreshSession();
  }

  async function doLogout() {
    setStatus("busy", "Logging out…");

    await fetch(`${WORKER_BASE}/admin/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => null);

    setStatus("", "Logged out.");
    setSessionPill(false, null);
  }

  async function doSearch() {
    const q = $("q")?.value?.trim() || "";
    if (!q) {
      setStatus("warn", "Enter a query (email or order #).");
      return;
    }

    setStatus("busy", "Searching…");
    $("results").innerHTML = "";

    const r = await fetch(`${WORKER_BASE}/admin/nl-search`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q })
    });

    const j = await r.json().catch(() => null);
    lastRaw = j;
    lastMode = "search";
    lastPayload = j;

    if (!r.ok || !j?.ok) {
      setStatus("warn", j?.error || `Search failed (${r.status})`);
      renderRawJson();
      return;
    }

    setStatus("", "Search complete.");
    $("results").innerHTML = renderResults(j);

    bindNotesToggles($("results"));
    renderRawJson();
  }

  async function doTotals() {
    setStatus("busy", "Loading totals…");
    $("results").innerHTML = "";

    const r = await fetch(`${WORKER_BASE}/admin/stats`, {
      method: "GET",
      credentials: "include"
    });

    const j = await r.json().catch(() => null);
    lastRaw = j;
    lastMode = "totals";
    lastPayload = j;

    if (!r.ok || !j?.ok) {
      setStatus("warn", j?.error || `Totals failed (${r.status})`);
      renderRawJson();
      return;
    }

    setStatus("", "Totals loaded.");
    $("results").innerHTML = renderTotals(j);
    renderRawJson();
  }

  function init() {
    $("btnLogin")?.addEventListener("click", (e) => { e.preventDefault(); doLogin().catch(console.error); });
    $("btnLogout")?.addEventListener("click", (e) => { e.preventDefault(); doLogout().catch(console.error); });
    $("btnSearch")?.addEventListener("click", (e) => { e.preventDefault(); doSearch().catch(console.error); });
    $("btnTotals")?.addEventListener("click", (e) => { e.preventDefault(); doTotals().catch(console.error); });
    $("btnRawJson")?.addEventListener("click", (e) => { e.preventDefault(); toggleRawJson(); });

    refreshSession().catch(() => setSessionPill(false, null));
  }

  init();
})();
// 🔴 main.js