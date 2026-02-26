// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-02-27-003)
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
    sl.style.display = "block";
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

  // -----------------------------
  // RENDER: TOTALS (unchanged)
  // -----------------------------
  function renderTotals(data) {
    const d = data || {};
    const subs = d.subscriptions_by_status || {};
    const orders = d.orders_last_30d || {};
    const gen = d.generated_at ? fmtDate(d.generated_at) : "";

    const SUB_STATUS_ORDER = [
      "Trash","Active","Expired","Pending Cancellation","Pending payment","On hold","Cancelled"
    ];
    const SUB_STATUS_LABELS = {
      "trash": "Trash","active": "Active","expired": "Expired","pending-cancel": "Pending Cancellation",
      "pending": "Pending payment","on-hold": "On hold","cancelled": "Cancelled"
    };

    const subRows = SUB_STATUS_ORDER
      .map((label) => {
        const slug = Object.keys(SUB_STATUS_LABELS).find((k) => SUB_STATUS_LABELS[k] === label) || null;
        const count = (subs[label] != null) ? subs[label] : (slug && subs[slug] != null) ? subs[slug] : 0;
        return `<tr><td><b>${esc(label)}</b></td><td style="text-align:right;"><b>${esc(String(count))}</b></td></tr>`;
      })
      .join("") || `<tr><td colspan="2">—</td></tr>`;

    const ORDER_STATUS_ORDER = ["pending","processing","on-hold","completed","cancelled","refunded","failed"];
    const ORDER_STATUS_LABELS = {
      "pending":"Pending","processing":"Processing","on-hold":"On hold","completed":"Completed",
      "cancelled":"Cancelled","refunded":"Refunded","failed":"Failed"
    };

    const orderRows = ORDER_STATUS_ORDER
      .map((slug) => {
        const label = ORDER_STATUS_LABELS[slug] || slug;
        const count = (orders.by_status && orders.by_status[slug] != null) ? orders.by_status[slug] : 0;
        return `<tr><td><b>${esc(label)}</b></td><td style="text-align:right;"><b>${esc(String(count))}</b></td></tr>`;
      })
      .join("") || `<tr><td colspan="2">—</td></tr>`;

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Totals</div>
          <div class="aa-section-subtitle">${esc(gen ? `Generated ${gen}` : "")}</div>
        </div>

        <div class="aa-grid-2">
          <div class="card mini" style="padding:12px; border-radius:14px; border:1px solid var(--border); background:rgba(15,23,42,.02); box-shadow:none;">
            <div style="font-weight:900; margin-bottom:10px; font-size:14px;">Subscriptions by status</div>
            <div class="aa-table-wrap" style="min-width:unset;">
              <table style="min-width:unset;">
                <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
                <tbody>${subRows}</tbody>
              </table>
            </div>
          </div>

          <div class="card mini" style="padding:12px; border-radius:14px; border:1px solid var(--border); background:rgba(15,23,42,.02); box-shadow:none;">
            <div style="font-weight:900; margin-bottom:10px; font-size:14px;">Orders (last 30 days)</div>
            <div class="aa-kv" style="margin-bottom:10px;">
              <div class="aa-k">Total</div>
              <div class="aa-v" style="font-size:22px;">${esc(String(orders.total ?? "—"))}</div>
              <div class="aa-k">Failed</div>
              <div class="aa-v">${esc(String(orders.failed ?? "—"))}</div>
              <div class="aa-k">Pending</div>
              <div class="aa-v">${esc(String(orders.pending ?? "—"))}</div>
            </div>

            <div class="aa-table-wrap" style="min-width:unset;">
              <table style="min-width:unset;">
                <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
                <tbody>${orderRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // -----------------------------
  // RENDER: SUBS (existing row style unchanged)
  // -----------------------------
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

  // -----------------------------
  // RENDER: ORDERS (single header row + value-only rows)
  // -----------------------------
  function renderOrderRow(o) {
    const id = o?.id ?? "—";
    const status = o?.status ?? "—";
    const total = fmtMoney(o?.total, o?.currency);
    const created = fmtDate(o?.date_created);

    const notesHtml = renderNotesToggle("order", String(id), o?.notes || []);

    // Orders list uses a single section header row (in renderResults) — do not repeat per-order headers.
    return `
      <div class="aa-row aa-order-row">
        <div class="aa-row-main aa-order-grid">
          <div class="aa-order-v aa-order-id">#${esc(String(id))}</div>
          <div class="aa-order-v"><span class="aa-pill aa-pill-blue">${esc(String(status))}</span></div>
          <div class="aa-order-v">${esc(created)}</div>
          <div class="aa-order-v">${esc(total)}</div>
        </div>
        <div class="aa-row-notes">${notesHtml}</div>
      </div>
    `;
  }

  // -----------------------------
  // RENDER: RESULTS
  // -----------------------------
  function renderResults(payload) {
    const ctx = payload?.context || {};
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    const subList = subs.length
      ? subs.map(renderSubscriptionRow).join("")
      : `<div class="aa-empty">No subscriptions found.</div>`;

    const orderList = orders.length
      ? orders.map(renderOrderRow).join("")
      : `<div class="aa-empty">No orders found.</div>`;

    return `
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

        ${orders.length ? `
        <div class="aa-list-head aa-order-list-head">
          <div class="aa-order-grid aa-order-grid-head">
            <div class="aa-order-h">ID</div>
            <div class="aa-order-h">Status</div>
            <div class="aa-order-h">Date</div>
            <div class="aa-order-h">Total</div>
          </div>
          <div class="aa-row-notes aa-row-notes-head">Notes</div>
        </div>
        ` : ``}

        ${orderList}
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