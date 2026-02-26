// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-02-25c — Totals screen + pretty formatting + shipping fallback)
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

  function renderRawJson() {
    const box = $("rawJsonBox");
    if (!box) return;
    if (!rawVisible) {
      box.innerHTML = "";
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

        <div class="aa-fields">
          <div class="aa-field">
            <div class="aa-label">Customer ID</div>
            <div class="aa-value">${esc(String(id))}</div>
          </div>

          <div class="aa-field">
            <div class="aa-label">Username</div>
            <div class="aa-value">${esc(String(username))}</div>
          </div>

          <div class="aa-field">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(String(name))}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAddressBlock(title, a, fallbackBilling) {
    const f = fallbackBilling;

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
    const phone = (a?.phone ?? "").trim();

    const hasAny =
      name || addr1 || addr2 || city || state || zip || country || email || phone;

    // Shipping fallback: if missing, show "Same as billing" + render billing details
    const sameAsBilling = title.toLowerCase() === "shipping" && !hasAny && f;

    const showName = sameAsBilling ? (() => {
      const bf = (f?.first_name ?? "").trim();
      const bl = (f?.last_name ?? "").trim();
      return [bf, bl].filter(Boolean).join(" ").trim() || "Same as billing";
    })() : (name || (title.toLowerCase() === "shipping" && !hasAny ? "Same as billing" : "—"));

    const showAddrLines = sameAsBilling ? (() => {
      const b1 = (f?.address_1 ?? "").trim();
      const b2 = (f?.address_2 ?? "").trim();
      const c = (f?.city ?? "").trim();
      const s = (f?.state ?? "").trim();
      const z = (f?.postcode ?? "").trim();
      const co = (f?.country ?? "").trim();
      const lines = [];
      if (b1) lines.push(b1);
      if (b2) lines.push(b2);
      const cs = [c, s].filter(Boolean).join(", ");
      const csz = [cs, z].filter(Boolean).join(" ");
      if (csz) lines.push(csz);
      if (co) lines.push(co);
      return lines.length ? lines.join("<br>") : "—";
    })() : (() => {
      const lines = [];
      if (addr1) lines.push(addr1);
      if (addr2) lines.push(addr2);
      const cs = [city, state].filter(Boolean).join(", ");
      const csz = [cs, zip].filter(Boolean).join(" ");
      if (csz) lines.push(csz);
      if (country) lines.push(country);
      return lines.length ? lines.join("<br>") : "—";
    })();

    const showEmail = sameAsBilling ? ((f?.email ?? "").trim() || "—") : (email || "—");
    const showPhone = sameAsBilling ? (fmtPhone(f?.phone) || "—") : fmtPhone(phone);

    return `
      <div class="aa-card">
        <div class="aa-card-title">${esc(title)}</div>

        <div class="aa-fields">
          <div class="aa-field">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(showName)}</div>
          </div>

          <div class="aa-field">
            <div class="aa-label">Address</div>
            <div class="aa-value">${showAddrLines}</div>
          </div>

          <div class="aa-field">
            <div class="aa-label">Email</div>
            <div class="aa-value">${esc(showEmail || "—")}</div>
          </div>

          <div class="aa-field">
            <div class="aa-label">Phone</div>
            <div class="aa-value">${esc(showPhone || "—")}</div>
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
    if (!safeNotes.length) return `<div class="aa-notes-empty">—</div>`;

    const arrow = isOpen ? "▾" : "▸";
    const rows = safeNotes
      .map((n) => {
        const when = fmtDate(n?.date_created);
        const who = n?.author || n?.added_by || "";
        const text = stripHtml(n?.note || "");
        return `<div class="aa-note" style="padding:10px 10px;border-radius:12px;border:1px solid var(--border);background:#fff;margin-bottom:10px;">
          <div class="aa-note-meta" style="font-size:12px;font-weight:950;color:#334155;margin-bottom:6px;">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
          <div class="aa-note-text" style="font-size:13px;font-weight:750;color:#0b1220;line-height:1.35;white-space:pre-wrap;">${esc(text || "—")}</div>
        </div>`;
      })
      .join("");

    return `
      <button class="aa-notes-toggle" data-kind="${esc(kind)}" data-id="${esc(String(id))}">
        <span class="aa-notes-arrow">${arrow}</span>
        <span class="aa-notes-label">Notes</span>
        <span class="aa-notes-count">${esc(String(safeNotes.length))}</span>
      </button>
      <div class="aa-notes-body" style="${isOpen ? "" : "display:none;"}">${rows}</div>
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

        const body = btn.nextElementSibling;
        const arrow = btn.querySelector(".aa-notes-arrow");
        if (body) {
          const open = set.has(id);
          body.style.display = open ? "" : "none";
          if (arrow) arrow.textContent = open ? "▾" : "▸";
        }
      });
    });
  }

  function renderSubscriptionRow(s) {
    const id = s?.id ?? "—";
    const status = s?.status ?? "—";
    const total = fmtMoney(s?.total, s?.currency);
    const start = fmtDate(s?.start_date);
    const nextPay = fmtDate(s?.next_payment_date);
    const end = s?.end_date ? fmtDate(s?.end_date) : "Auto-renews";

    const notesHtml = renderNotesToggle("sub", String(id), s?.notes || []);

    return `
      <div class="aa-row">
        <div class="aa-row-main">
          <div class="aa-row-title">#${esc(String(id))}</div>
          <div class="aa-row-sub">
            <span class="aa-pill aa-pill-blue">${esc(String(status))}</span>
            <span class="aa-muted">Start</span> ${esc(start)}
            <span class="aa-muted">Next</span> ${esc(nextPay)}
            <span class="aa-muted">End</span> ${esc(end)}
            <span class="aa-muted">Total</span> ${esc(total)}
          </div>
        </div>
        <div class="aa-row-notes">${notesHtml}</div>
      </div>
    `;
  }

  function renderOrderRow(o) {
    const id = o?.id ?? "—";
    const status = o?.status ?? "—";
    const total = fmtMoney(o?.total, o?.currency);
    const created = fmtDate(o?.date_created);

    const notesHtml = renderNotesToggle("order", String(id), o?.notes || []);

    return `
      <div class="aa-row">
        <div class="aa-row-main">
          <div class="aa-row-title">#${esc(String(id))}</div>
          <div class="aa-row-sub">
            <span class="aa-pill aa-pill-blue">${esc(String(status))}</span>
            <span class="aa-muted">Date</span> ${esc(created)}
            <span class="aa-muted">Total</span> ${esc(total)}
          </div>
        </div>
        <div class="aa-row-notes">${notesHtml}</div>
      </div>
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

    const subList = subs.length
      ? subs.map(renderSubscriptionRow).join("")
      : `<div class="aa-empty">No subscriptions found.</div>`;

    const orderList = orders.length
      ? orders.map(renderOrderRow).join("")
      : `<div class="aa-empty">No orders found.</div>`;

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
        ${subList}
      </section>

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Orders</div>
          <div class="aa-section-subtitle">Payment & Notes</div>
        </div>
        ${orderList}
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
          <table>
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