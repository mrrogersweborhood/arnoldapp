// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-03-09R1-timelineHealthClipboard)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  // -----------------------------
  // CONFIG stuff
  // -----------------------------
  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const WOO_ADMIN = "https://okobserver.org/wp-admin/post.php";

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

  function statusClass(val) {
    return String(val ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderStatusPill(val) {
    const raw = String(val ?? "—").trim() || "—";
    const cls = statusClass(raw);
    return `<span class="aa-pill${cls ? ` ${esc(cls)}` : ""}">${esc(raw)}</span>`;
  }

  function formatAgeFromDate(val) {
    if (!val) return "";
    const d = new Date(val);
    if (!Number.isFinite(d.getTime())) return "";

    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    let months = now.getMonth() - d.getMonth();
    if (months < 0 || (months === 0 && now.getDate() < d.getDate())) {
      years -= 1;
      months += 12;
    }
    if (now.getDate() < d.getDate()) months -= 1;
    if (months < 0) months += 12;

    if (years >= 1) return ` (${years}y ago)`;
    if (months >= 1) return ` (${months}mo ago)`;

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.max(0, Math.floor((now - d) / msPerDay));
    if (days >= 7) return ` (${Math.floor(days / 7)}w ago)`;
    return ` (${days}d ago)`;
  }

  function fmtDateWithAge(val) {
  return fmtDate(val);
}
  async function copyText(text) {
    const value = String(text ?? "").trim();
    if (!value || value === "—") return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      } catch (_) {
        return false;
      }
    }
  }

  function renderCopyButton(label, value) {
    const safe = String(value ?? "").trim();
    if (!safe || safe === "—") return "";
    return `<button class="aa-copy-icon" type="button" data-copy="${esc(safe)}" title="Copy ${esc(String(label || "value"))}" aria-label="Copy ${esc(String(label || "value"))}">📋</button>`;
  }

  function renderValueWithCopy(value, copyValue) {
    const rawValue = String(value ?? "").trim();
    const safeValue = rawValue || "—";
    const copyBtn = renderCopyButton("Copy", copyValue ?? value);

    return `
      <div class="aa-value-inline">
        <span class="aa-value-text">${esc(safeValue)}</span>
        ${copyBtn}
      </div>
    `;
  }

  function renderPaymentWithWarning(order) {
    const payment = String(order?.payment_method_title ?? "").trim() || "—";
    const status = String(order?.status ?? "").trim().toLowerCase();
    if (status === "failed") {
      return `${esc(payment)} <span class="aa-muted">⚠ Failed payment</span>`;
    }
    return esc(payment);
  }

  function getOrderItemsSummary(order) {
    const li = Array.isArray(order?.line_items)
      ? order.line_items
      : (Array.isArray(order?.items) ? order.items : []);

    if (!li.length) {
      return { text: "—", countText: "—" };
    }

    const parts = [];
    let totalQty = 0;

    for (const it of li) {
      const nm = String(it?.name ?? "").trim();
      const qtyRaw = it?.quantity ?? it?.qty ?? 0;
      const qtyNum = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 0;

      if (qtyNum > 0) totalQty += qtyNum;

      if (!nm) continue;
      if (qtyNum > 1) parts.push(`${nm} (qty ${qtyNum})`);
      else parts.push(nm);
    }

    const countText = totalQty > 0 ? `${totalQty}` : `${li.length}`;
    return {
      text: parts.length ? parts.join("; ") : "—",
      countText
    };
  }

  function renderOrderBadges(order, opts = {}) {
    const status = String(order?.status ?? "").trim().toLowerCase();
    const isLatest = !!opts.isLatest;

    const badges = [];
    if (isLatest) {
      badges.push('<span class="aa-order-flag aa-order-flag-latest">★ Latest</span>');
    }

    if (status === "failed") {
      badges.push('<span class="aa-order-flag aa-order-flag-problem">⚠ Failed</span>');
    } else if (status === "refunded") {
      badges.push('<span class="aa-order-flag aa-order-flag-problem">⚠ Refunded</span>');
    } else if (status === "cancelled") {
      badges.push('<span class="aa-order-flag aa-order-flag-problem">⚠ Cancelled</span>');
    } else if (status === "on-hold") {
      badges.push('<span class="aa-order-flag aa-order-flag-problem">⚠ On hold</span>');
    } else if (status.includes("chargeback")) {
      badges.push('<span class="aa-order-flag aa-order-flag-problem">⚠ Chargeback</span>');
    }

    return badges.join("");
  }


  // -----------------------------
  // STATUS LINE
function friendlyText(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;

  // Common error shapes from APIs
  if (typeof x === "object") {
    if (typeof x.message === "string") return x.message;
    if (typeof x.error === "string") return x.error;
    if (typeof x.detail === "string") return x.detail;
    if (typeof x.reason === "string") return x.reason;

    // Try JSON as a last resort (but keep it short)
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
  // -----------------------------
  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = friendlyText(text ?? "");
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
    const age = Date.now() - d.getTime();
const days = Math.floor(age / 86400000);

let ageText = "";
if (days >= 365) {
  ageText = ` (${Math.floor(days / 365)}y ago)`;
} else if (days >= 30) {
  ageText = ` (${Math.floor(days / 30)}mo ago)`;
} else if (days >= 1) {
  ageText = ` (${days}d ago)`;
}

return `${mm}/${dd}/${yyyy}${ageText}`;
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
    const digitsRaw = s.replace(/\D/g, "");

// Handle US country code (11 digits starting with 1)
const digits = (digitsRaw.length === 11 && digitsRaw.startsWith("1"))
  ? digitsRaw.slice(1)
  : digitsRaw;

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
  function applyLoginUserMask(isLoggedIn) {
    const u = $("loginUser");
    if (!u) return;

    const hasValue = !!String(u.value || "").trim();

    // If logged in AND the field has a value, mask it.
    if (isLoggedIn && hasValue) {
      if (u.type !== "password") u.type = "password";
      return;
    }

    // Otherwise show it normally.
    if (u.type !== "text") u.type = "text";
  }  
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

    // Hide/reveal username field based on logged-in state
    applyLoginUserMask(!!isLoggedIn);
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
    const email = String(customer?.email ?? customer?.billing?.email ?? "").trim() || "—";
    const username = customer?.username ?? customer?.email ?? "—";
    const fn = (customer?.first_name ?? "").trim();
    const ln = (customer?.last_name ?? "").trim();
    const name = [fn, ln].filter(Boolean).join(" ").trim() || "—";

    return `
      <div class="aa-card">
        <div class="aa-card-title">Customer</div>

        <div class="aa-tiles customer">
          <div class="aa-tile">
            <div class="aa-label">Name</div>
            <div class="aa-value">${esc(String(name))}</div>
          </div>

          <div class="aa-tile">
            <div class="aa-label">Email</div>
            ${renderValueWithCopy(String(email), String(email))}
          </div>

          <div class="aa-tile">
            <div class="aa-label">Customer ID</div>
            ${renderValueWithCopy(String(id), String(id))}
          </div>

          <div class="aa-tile">
            <div class="aa-label">Username</div>
            ${renderValueWithCopy(String(username), String(username))}
          </div>
        </div>

        <div class="aa-copy-row" style="margin-top:12px;">
          <a
            class="aa-copy-btn"
            href="https://okobserver.org/wp-admin/user-edit.php?user_id=${esc(String(id))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WP
          </a>

          <a
            class="aa-copy-btn"
            href="https://okobserver.org/wp-admin/edit.php?post_type=shop_subscription&_customer_user=${esc(String(id))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Subscriptions
          </a>

          <a
            class="aa-copy-btn"
            href="https://okobserver.org/wp-admin/edit.php?post_type=shop_order&_customer_user=${esc(String(id))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Orders
          </a>

          <a
            class="aa-copy-btn"
            href="https://okobserver.org/wp-admin/post-new.php?post_type=shop_order&customer_id=${esc(String(id))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            New Order
          </a>
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
            ${renderValueWithCopy(showEmail, showEmail)}
          </div>

          <div class="aa-tile">
            <div class="aa-label">Phone</div>
            ${renderValueWithCopy(showPhone, showPhone)}
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
          bindCopyButtons($("results"));
        }
      });
    });
  }


  function bindCopyButtons(container) {
    if (!container) return;
    container.querySelectorAll(".aa-copy-btn[data-copy], .aa-copy-icon[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy") || "";
        const oldHtml = btn.innerHTML;
        const oldTitle = btn.getAttribute("title") || "";
        const isIcon = btn.classList.contains("aa-copy-icon");
        const ok = await copyText(text);

        if (isIcon) {
          btn.innerHTML = ok ? "✓" : "!";
          btn.setAttribute("title", ok ? "Copied" : "Copy failed");
        } else {
          btn.innerHTML = ok ? 'Copied <span aria-hidden="true">✓</span>' : 'Copy failed';
        }

        btn.classList.toggle("copied", !!ok);
        window.setTimeout(() => {
          btn.innerHTML = oldHtml;
          if (oldTitle) btn.setAttribute("title", oldTitle);
          else btn.removeAttribute("title");
          btn.classList.remove("copied");
        }, 1200);
      });
    });
  }

  function renderSubscriptionActions(sub) {
    const sid = String(sub?.id ?? "").trim();
    if (!sid) return "";
    return `
      <div class="aa-sub-actions">
        <a class="aa-copy-btn" href="${WOO_ADMIN}?post=${esc(sid)}&action=edit" target="_blank" rel="noopener noreferrer">Open Subscription</a>
      </div>
    `;
  }

  
  function bindOpenCandidateButtons(container) {
    if (!container) return;
    container.querySelectorAll('.aa-candidate-open-btn[data-open-query]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const query = String(btn.getAttribute('data-open-query') || '').trim();
        if (!query) return;
        const qEl = $("q");
        if (qEl) qEl.value = query;
        await doSearch();
      });
    });
  }

  function renderCandidateMatches(payload) {
    const matches = Array.isArray(payload?.possible_matches) ? payload.possible_matches : [];
    if (!matches.length) {
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Possible Matches</div>
            <div class="aa-section-subtitle">No candidate matches returned</div>
          </div>
          <div class="aa-muted">No matches found.</div>
        </section>
      `;
    }

    const rows = matches.map((m) => {
      const c = m?.customer || {};
      const name = [c?.first_name, c?.last_name]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .join(' ') || '—';
      const email = String(c?.email ?? '').trim() || '—';
      const idRaw = c?.id != null && String(c.id).trim() ? String(c.id).trim() : '';
      const id = idRaw ? `#${idRaw}` : '—';
      const openValue = email !== '—' ? email : (idRaw ? `customer #${idRaw}` : '');
      const openCell = openValue
        ? `<button type="button" class="aa-copy-btn aa-candidate-open-btn" data-open-query="${esc(openValue)}">Open</button>`
        : `<span class="aa-muted">—</span>`;

      return `
        <tr>
          <td>${openCell}</td>
          <td>${esc(name)}</td>
          <td>${esc(email)}</td>
          <td>${esc(id)}</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Possible Matches</div>
          <div class="aa-section-subtitle">Select the correct customer</div>
        </div>

        <div class="aa-table-wrap">
          <table class="aa-table" style="min-width:760px; table-layout:fixed;">
            <colgroup>
              <col style="width:120px;">
              <col style="width:220px;">
              <col style="width:280px;">
              <col style="width:140px;">
            </colgroup>
            <thead>
              <tr>
                <th>Open</th>
                <th>Name</th>
                <th>Email</th>
                <th>Customer ID</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
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
          <a class="aa-sub-id" href="${WOO_ADMIN}?post=${esc(id)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(id)}</a>
          ${renderCopyButton("Sub ID", `#${id}`)}
          ${renderStatusPill(status)}
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
    const created = fmtDateWithAge(o?.date_created);

    const paymentHtml = renderPaymentWithWarning(o);

    // Items purchased (WooCommerce orders use `line_items`)
    const orderItems = getOrderItemsSummary(o);
    const itemsText = orderItems.text;

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
        <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(id)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(id)}</a>${renderCopyButton("Order ID", `#${id}`)}</td>
        <td>${esc(created)}</td>
        <td>${renderStatusPill(status)}</td>
        <td>${esc(total)}</td>
        <td>${paymentHtml}</td>
        <td title="${esc(itemsText)}">${esc(itemsText)}</td>
        <td class="aa-notes-cell">${btn}</td>
      </tr>
      ${isOpen ? `<tr class="aa-notes-row"><td colspan="8"><div class="aa-notes-box">${notesHtml}</div></td></tr>` : ``}
    `;
  }


  function isProblemOrderStatus(status) {
    const raw = String(status ?? "").trim().toLowerCase();
    return raw === "failed" || raw === "refunded" || raw === "cancelled" || raw === "on-hold" || raw.includes("chargeback");
  }

  function toTimestamp(val) {
    if (!val) return null;
    const ts = new Date(val).getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  function firstUsableDate(...vals) {
    for (const val of vals) {
      if (toTimestamp(val) != null) return val;
    }
    return null;
  }

  function getSubscriptionStartDate(sub) {
    return firstUsableDate(
      sub?.start_date,
      sub?.date_created,
      sub?.date_created_gmt,
      sub?.created_at,
      sub?.date_created_local
    );
  }

  function getSortedOrdersNewestFirst(orders) {
    const arr = Array.isArray(orders) ? [...orders] : [];
    arr.sort((a, b) => {
      const da = toTimestamp(a?.date_created) ?? 0;
      const db = toTimestamp(b?.date_created) ?? 0;
      return db - da;
    });
    return arr;
  }

  function getPrimarySubscription(subs, ordersBySub) {
    const arr = Array.isArray(subs) ? [...subs] : [];
    if (!arr.length) return null;

    const rankStatus = (status) => {
      const raw = String(status ?? "").trim().toLowerCase();
      if (raw === "active") return 0;
      if (raw === "on-hold") return 1;
      if (raw === "pending-cancel") return 2;
      if (raw === "pending") return 3;
      return 4;
    };

    arr.sort((a, b) => {
      const ra = rankStatus(a?.status);
      const rb = rankStatus(b?.status);
      if (ra !== rb) return ra - rb;

      const aNext = toTimestamp(a?.next_payment_date);
      const bNext = toTimestamp(b?.next_payment_date);
      if (aNext != null && bNext != null && aNext !== bNext) return aNext - bNext;
      if (aNext != null && bNext == null) return -1;
      if (aNext == null && bNext != null) return 1;

      const aOrders = getSortedOrdersNewestFirst(ordersBySub?.get(String(a?.id ?? "")) || []);
      const bOrders = getSortedOrdersNewestFirst(ordersBySub?.get(String(b?.id ?? "")) || []);
      const aLatest = toTimestamp(aOrders[0]?.date_created) ?? 0;
      const bLatest = toTimestamp(bOrders[0]?.date_created) ?? 0;
      if (aLatest !== bLatest) return bLatest - aLatest;

      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { numeric: true });
    });

    return arr[0] || null;
  }

  function renderSupportClipboardPack(customer, subs, orders, ordersBySub) {
    const email = String(customer?.email ?? customer?.billing?.email ?? "").trim();
    const primarySub = getPrimarySubscription(subs, ordersBySub);
    const primarySubId = primarySub ? String(primarySub?.id ?? "").trim() : "";
    const primarySubOrders = primarySub ? getSortedOrdersNewestFirst(ordersBySub.get(primarySubId) || []) : [];
    const latestOrder = primarySubOrders[0] || getSortedOrdersNewestFirst(orders)[0] || null;
    const latestOrderId = latestOrder ? String(latestOrder?.id ?? "").trim() : "";

    const pieces = [];
    if (email) pieces.push(`Email: ${email}`);
    if (primarySubId) pieces.push(`Subscription ID: #${primarySubId}`);
    if (latestOrderId) pieces.push(`Latest Order ID: #${latestOrderId}`);

    const name = [customer?.first_name, customer?.last_name].map((v) => String(v ?? "").trim()).filter(Boolean).join(" ");
    const nextPayment = primarySub?.next_payment_date ? fmtDate(primarySub.next_payment_date) : "—";
    const packText = [
      name ? `Customer: ${name}` : "",
      email ? `Email: ${email}` : "",
      primarySubId ? `Subscription ID: #${primarySubId}` : "",
      latestOrderId ? `Latest Order ID: #${latestOrderId}` : "",
      primarySub ? `Subscription Status: ${String(primarySub?.status ?? "—")}` : "",
      primarySub ? `Next Payment: ${nextPayment}` : ""
    ].filter(Boolean).join("\n");

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Clipboard Pack</div>
          <div class="aa-section-subtitle">One-click copy for common support fields</div>
        </div>

        <div class="aa-card aa-clipboard-pack">
          <div class="aa-copy-row aa-copy-row-pack">
            ${email ? `<button class="aa-copy-btn" type="button" data-copy="${esc(email)}">Copy Email</button>` : ""}
            ${primarySubId ? `<button class="aa-copy-btn" type="button" data-copy="${esc(`#${primarySubId}`)}">Copy Subscription ID</button>` : ""}
            ${latestOrderId ? `<button class="aa-copy-btn" type="button" data-copy="${esc(`#${latestOrderId}`)}">Copy Latest Order ID</button>` : ""}
            ${packText ? `<button class="aa-copy-btn" type="button" data-copy="${esc(packText)}">Copy Support Pack</button>` : ""}
          </div>

          <div class="aa-clipboard-summary">
            ${pieces.length ? pieces.map((piece) => `<div class="aa-clipboard-item">${esc(piece)}</div>`).join("") : `<div class="aa-muted">No clipboard values available for this result.</div>`}
          </div>
        </div>
      </section>
    `;
  }

  function renderActivityTimeline(customer, subs, orders, ordersBySub) {
    const events = [];
    const customerCreated = firstUsableDate(customer?.date_created, customer?.date_created_gmt, customer?.registered_date, customer?.user_registered);
    if (customerCreated) {
      events.push({
        ts: toTimestamp(customerCreated),
        label: 'Customer created',
        meta: customer?.id ? `Customer #${String(customer.id)}` : '',
        dateText: fmtDate(customerCreated),
        badge: ''
      });
    }

    const sArr = Array.isArray(subs) ? subs : [];
    for (const sub of sArr) {
      const sid = String(sub?.id ?? '').trim();
      const started = getSubscriptionStartDate(sub);
      if (started) {
        events.push({
          ts: toTimestamp(started),
          label: 'Subscription started',
          meta: sid ? `Subscription #${sid}` : '',
          dateText: fmtDate(started),
          badge: renderStatusPill(String(sub?.status ?? '—'))
        });
      }

      const parentId = String(sub?.parent_id ?? '').trim();
      const linked = getSortedOrdersNewestFirst(ordersBySub.get(sid) || []);
      const newestRenewalId = linked
        .filter((o) => String(o?.id ?? '').trim() !== parentId)
        .map((o) => String(o?.id ?? '').trim())
        .find(Boolean) || '';

      for (const order of linked) {
        const oid = String(order?.id ?? '').trim();
        const created = firstUsableDate(order?.date_created, order?.date_created_gmt, order?.date_paid);
        if (!oid || !created) continue;
        const isParent = parentId && oid === parentId;
        const isLatest = !isParent && newestRenewalId && oid === newestRenewalId;
        const status = String(order?.status ?? '—').trim() || '—';
        const label = isParent ? 'Parent order' : (isProblemOrderStatus(status) ? 'Problem renewal' : 'Renewal');
        const metaParts = [`Order #${oid}`];
        if (!isParent && isLatest) metaParts.push('Latest');
        metaParts.push(status);
        events.push({
          ts: toTimestamp(created),
          label,
          meta: metaParts.join(' • '),
          dateText: fmtDate(created),
          badge: renderStatusPill(status)
        });
      }
    }

    if (!events.length) return '';

    events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber Activity Timeline</div>
          <div class="aa-section-subtitle">Chronological history across customer, subscription, and order events</div>
        </div>
        <div class="aa-timeline">
          ${events.map((evt) => `
            <div class="aa-timeline-item">
              <div class="aa-timeline-rail"><span class="aa-timeline-dot"></span></div>
              <div class="aa-timeline-body">
                <div class="aa-timeline-top">
                  <div class="aa-timeline-label">${esc(evt.label)}</div>
                  <div class="aa-timeline-date">${esc(evt.dateText || '—')}</div>
                </div>
                <div class="aa-timeline-meta">${esc(evt.meta || '—')}</div>
                ${evt.badge ? `<div class="aa-timeline-badge">${evt.badge}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  
  function isProblemOrderStatus(status) {
    const raw = String(status ?? "").trim().toLowerCase();
    return raw === "failed" || raw === "refunded" || raw === "cancelled" || raw === "on-hold" || raw.includes("chargeback");
  }

  function renderSubscriptionHealthSummary(customer, subs, orders) {
    const orderArr = Array.isArray(orders) ? [...orders] : [];
    orderArr.sort((a, b) => new Date(b?.date_created || 0) - new Date(a?.date_created || 0));

    const latestOrder = orderArr[0] || null;
    const failedCount = orderArr.filter((o) => isProblemOrderStatus(o?.status)).length;
    const latestOrderId = latestOrder ? `#${String(latestOrder?.id ?? "").trim()}` : "—";
    const latestOrderStatus = latestOrder ? String(latestOrder?.status ?? "—") : "—";
    const latestOrderTotal = latestOrder ? fmtMoney(latestOrder?.total, latestOrder?.currency) : "—";
    const latestOrderDate = latestOrder?.date_created ? fmtDate(latestOrder.date_created) : "—";

    const primarySub = Array.isArray(subs) && subs.length ? subs[0] : null;
    const subStatus = String(primarySub?.status ?? "—");
    const nextPayment = primarySub?.next_payment_date ? fmtDate(primarySub.next_payment_date) : "—";

    let tone = "healthy";
    let headline = "Subscription looks healthy";
    if (latestOrder && isProblemOrderStatus(latestOrder?.status)) {
      tone = "problem";
      headline = "Latest payment has a problem";
    } else if (failedCount > 0) {
      tone = "problem";
      headline = "Customer has failed/problem payments";
    } else if (!primarySub) {
      tone = "watch";
      headline = "No subscription found";
    }

    const alertHtml = tone === "problem" ? `
      <div class="aa-health-alert aa-health-alert-problem">
        <span class="aa-health-alert-icon">🔴</span>
        <span class="aa-health-alert-text">${esc(headline)}${latestOrderId !== "—" ? ` • ${latestOrderId}` : ""}</span>
      </div>
    ` : "";

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscription Health</div>
          <div class="aa-section-subtitle">Quick support summary</div>
        </div>
        ${alertHtml}
        <div class="aa-health-grid">
          <div class="aa-health-card aa-health-card-${esc(tone)}">
            <div class="aa-health-kicker">Health</div>
            <div class="aa-health-value">${esc(headline)}</div>
            <div class="aa-health-meta">${primarySub ? renderStatusPill(subStatus) : '<span class="aa-muted">No subscription</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Latest payment</div>
            <div class="aa-health-value">${esc(latestOrderId)}</div>
            <div class="aa-health-meta">${latestOrder ? `${renderStatusPill(latestOrderStatus)} <span class="aa-muted">${esc(latestOrderDate)}</span>` : '<span class="aa-muted">No orders</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Latest total</div>
            <div class="aa-health-value">${esc(latestOrderTotal)}</div>
            <div class="aa-health-meta">${latestOrderDate !== "—" ? esc(latestOrderDate) : '<span class="aa-muted">—</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Failed/problem payments</div>
            <div class="aa-health-value">${esc(String(failedCount))}</div>
            <div class="aa-health-meta">${nextPayment !== "—" ? `Next payment ${esc(nextPayment)}` : '<span class="aa-muted">No next payment</span>'}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCustomerActivity(customer, subs, orders) {
    const events = [];
    const subscriptions = Array.isArray(subs) ? subs : [];
    const orderArr = Array.isArray(orders) ? orders : [];

    if (customer?.date_created) {
      events.push({
        date: customer.date_created,
        event: "Customer created",
        recordId: "",
        recordKind: "",
        status: "",
        total: ""
      });
    }

    subscriptions.forEach((s) => {
      const sid = String(s?.id ?? "").trim();
      const started = s?.start_date || s?.date_created || null;
      if (started) {
        events.push({
          date: started,
          event: "Subscription started",
          recordId: sid ? `#${sid}` : "",
          recordKind: sid ? "subscription" : "",
          status: String(s?.status ?? ""),
          total: ""
        });
      }
    });

    orderArr.forEach((o) => {
      const oid = String(o?.id ?? "").trim();
      const status = String(o?.status ?? "");
      let event = "Order";
      if (status.toLowerCase() === "completed" || status.toLowerCase() === "processing") event = "Renewal";
      if (isProblemOrderStatus(status)) event = "Problem order";
      const maybeParent = subscriptions.find((s) => String(s?.parent_id ?? "").trim() === oid);
      if (maybeParent) event = "Parent order";

      events.push({
        date: o?.date_created,
        event,
        recordId: oid ? `#${oid}` : "",
        recordKind: oid ? "order" : "",
        status,
        total: fmtMoney(o?.total, o?.currency)
      });
    });

    events.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

    const rows = events.map((e) => {
      const idValue = String(e?.recordId ?? "").trim();
      const postId = idValue.replace(/^#/, "");
      const idHtml = idValue
        ? `<a class="${e.recordKind === "subscription" ? "aa-sub-id" : "aa-order-id"}" href="${WOO_ADMIN}?post=${esc(postId)}&action=edit" target="_blank" rel="noopener noreferrer">${esc(idValue)}</a>${renderCopyButton(e.recordKind === "subscription" ? "Subscription ID" : "Order ID", idValue)}`
        : "—";

      return `
      <tr>
        <td>${idHtml}</td>
        <td>${esc(fmtDateWithAge(e.date))}</td>
        <td>${esc(e.event || "—")}</td>
        <td>${e.status ? renderStatusPill(e.status) : '<span class="aa-muted">—</span>'}</td>
        <td class="aa-right">${e.total ? esc(e.total) : "—"}</td>
      </tr>
    `;
    }).join("");

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Customer Activity</div>
          <div class="aa-section-subtitle">Newest first</div>
        </div>
        <div class="aa-table-wrap">
          <table class="aa-table" style="min-width:860px; table-layout:fixed;">
            <colgroup>
              <col style="width:180px;">
              <col style="width:180px;">
              <col style="width:260px;">
              <col style="width:140px;">
              <col style="width:120px;">
            </colgroup>
            <thead>
              <tr>
                <th>Subscription / Order ID</th>
                <th>Date</th>
                <th>Event</th>
                <th>Status</th>
                <th class="aa-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="5" class="aa-muted">No activity found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }


function renderResults(payload) {
    if (payload?.intent === "customer_candidates_by_name") return renderCandidateMatches(payload);

    if (payload?.intent === "unknown") {
      const note = String(payload?.note || "Try an email address, customer #123, or order #12345.").trim();
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">No supported match yet</div>
            <div class="aa-section-subtitle">${esc(note)}</div>
          </div>
          <div class="aa-muted">Try an email address, a customer lookup like customer #123, or an order lookup like order #12345.</div>
        </section>
      `;
    }

    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer ? renderCustomerCard(customer) : "";
    const billingCard = renderAddressBlock("Billing", billing, null);
    const shippingCard = renderAddressBlock("Shipping", shipping, billing);
    const healthSummary = renderSubscriptionHealthSummary(customer, subs, orders);
    const activity = renderCustomerActivity(customer, subs, orders);
    const ledger = renderSubscriptionLedger(subs, orders);

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

      ${activity || ""}
      ${ledger || ""}
      ${healthSummary || ""}
    `;
  }

// -----------------------------
// SUBSCRIPTION HIERARCHY (Option A: separate section)
// -----------------------------
function getOrderLinkedSubscriptionIds(order) {
  const ids = new Set();

  const add = (v) => {
    if (v == null) return;
    const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
    if (Number.isFinite(n) && n > 0) ids.add(String(n));
  };

  // direct shapes (if present)
  add(order?.subscription_id);
  add(order?._subscription_id);

  const subsArr = order?.subscriptions || order?.subscription_ids || order?.related_subscriptions;
  if (Array.isArray(subsArr)) subsArr.forEach(add);

  // metadata heuristic (only if present; raw JSON toggle already scrubs this in viewer)
  const md = order?.meta_data;

if (Array.isArray(md)) {
  for (const entry of md) {
    const k = String(entry?.key ?? "").toLowerCase();
    const v = entry?.value;

    // Woo Subscriptions renewal link (this is what your DevTools showed)
    if (k === "_subscription_renewal" && v != null) add(v);

    // Other common subscription link keys (safe to support)
    if (k === "_subscription_id" && v != null) add(v);
    if (k === "_parent_subscription_id" && v != null) add(v);

    // Some installs store arrays/objects
    if (k === "_subscriptions" || k === "subscriptions") {
      if (Array.isArray(v)) v.forEach(add);
      else if (v && typeof v === "object") {
        add(v.id);
        add(v.subscription_id);
      } else if (v != null) {
        add(v);
      }
    }
  }
}


  

  return ids;
}

function buildOrdersBySubscriptionId(subs, orders) {
  const map = new Map(); // subId -> orders[]
  (Array.isArray(subs) ? subs : []).forEach((s) => map.set(String(s?.id ?? ""), []));
  if (!Array.isArray(orders)) return map;

for (const o of orders) {

  // cache the linked subscription IDs once
  const linkedIds = getOrderLinkedSubscriptionIds(o);

  if (!linkedIds || linkedIds.size === 0) continue;

  for (const sid of linkedIds) {

    let bucket = map.get(sid);

    if (!bucket) {
      bucket = [];
      map.set(sid, bucket);
    }

    bucket.push(o);
  }
}

  // newest-first by date_created (if parseable)
  for (const [sid, arr] of map.entries()) {
    arr.sort((a, b) => {
      const da = new Date(a?.date_created || 0).getTime();
      const db = new Date(b?.date_created || 0).getTime();
      return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
    });
  }

  return map;
}

function renderHierarchySection(subs, orders) {
  const sArr = Array.isArray(subs) ? subs : [];
  const oArr = Array.isArray(orders) ? orders : [];
  if (!sArr.length) return "";

  const bySub = buildOrdersBySubscriptionId(sArr, oArr);

  const blocks = sArr
    .map((s) => {
      const sid = String(s?.id ?? "—");
      const status = String(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);
      const nextPay = fmtDate(s?.next_payment_date);

      const linked = bySub.get(sid) || [];

      const rows = linked.length
        ? linked
            .map((o) => {
              const oid = String(o?.id ?? "—");
              const oStatus = String(o?.status ?? "—");
              const created = fmtDateWithAge(o?.date_created);
              const oTotal = fmtMoney(o?.total, o?.currency);
              const paymentHtml = renderPaymentWithWarning(o);

              return `
                <tr>
                  <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(oid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(oid)}</a></td>
                  <td>${esc(created)}</td>
                  <td>${renderStatusPill(oStatus)}</td>
                  <td>${esc(oTotal)}</td>
                  <td>${paymentHtml}</td>
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="5" class="aa-muted">No linked orders found in payload for this subscription.</td></tr>`;

      return `
        <div class="aa-card">
          <div class="aa-card-title">Subscription #${esc(sid)} • ${renderStatusPill(status)}</div>

          <div class="aa-tiles customer" style="grid-template-columns:repeat(3, minmax(0, 1fr));">
            <div class="aa-tile">
              <div class="aa-label">Total</div>
              <div class="aa-value">${esc(total)}</div>
            </div>
            <div class="aa-tile">
              <div class="aa-label">Next Payment</div>
              <div class="aa-value">${esc(nextPay)}</div>
            </div>
            <div class="aa-tile">
              <div class="aa-label">Linked Orders</div>
              <div class="aa-value">${esc(String(linked.length))}</div>
            </div>
          </div>

          <details style="margin-top:10px;">
            <summary style="cursor:pointer; font-weight:950; color:var(--brand);">Show linked orders</summary>
            <div class="aa-table-wrap" style="margin-top:10px;">
              <table class="aa-table" style="min-width:720px;">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </details>
        </div>
      `;
    })
    .join("");

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Hierarchy</div>
        <div class="aa-section-subtitle">Subscriptions with linked orders when detectable</div>
      </div>
      ${blocks}
    </section>
  `;
}

  function renderSubscriptionLedger(subs, orders) {
  const sArr = Array.isArray(subs) ? subs : [];
  const oArr = Array.isArray(orders) ? orders : [];

  if (!sArr.length && !oArr.length) return "";

  const bySub = buildOrdersBySubscriptionId(sArr, oArr);

  const orderById = new Map();
  for (const o of oArr) {
    const oid = String(o?.id ?? "").trim();
    if (oid) orderById.set(oid, o);
  }

  const linkedOrderIds = new Set();

  const ledgerColGroup = `
    <colgroup>
      <col style="width:110px;">
      <col style="width:150px;">
      <col style="width:150px;">
      <col style="width:150px;">
      <col style="width:130px;">
      <col style="width:220px;">
      <col style="width:120px;">
      <col style="width:280px;">
    </colgroup>
  `;

  function renderSubNotesRow(sub) {
    const sid = String(sub?.id ?? "");
    const notes = Array.isArray(sub?.notes) ? sub.notes : [];
    const isOpen = openSubNotes.has(sid);
    if (!isOpen) return "";

    const notesHtml = notes.length
      ? notes.map((n) => {
          const when = fmtDate(n?.date_created);
          const who = n?.author || n?.added_by || "";
          const text = stripHtml(n?.note || "");
          return `
            <div class="aa-note">
              <div class="aa-note-meta">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
              <div class="aa-note-text">${esc(text || "—")}</div>
            </div>
          `;
        }).join("")
      : `<div class="aa-muted">No notes.</div>`;

    return `
      <div class="aa-notes-box" style="margin-top:10px;">
        ${notesHtml}
      </div>
    `;
  }

  function renderOrderNotesRow(order) {
    const oid = String(order?.id ?? "");
    const notes = Array.isArray(order?.notes) ? order.notes : [];
    const isOpen = openOrderNotes.has(oid);
    if (!isOpen) return "";

    const notesHtml = notes.length
      ? notes.map((n) => {
          const when = fmtDate(n?.date_created);
          const who = n?.author || n?.added_by || "";
          const text = stripHtml(n?.note || "");
          return `
            <div class="aa-note">
              <div class="aa-note-meta">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
              <div class="aa-note-text">${esc(text || "—")}</div>
            </div>
          `;
        }).join("")
      : `<div class="aa-muted">No notes.</div>`;

    return `
      <tr class="aa-notes-row">
        <td colspan="8">
          <div class="aa-notes-box">${notesHtml}</div>
        </td>
      </tr>
    `;
  }

  const subscriptionBlocks = sArr.map((s) => {
    const sid = String(s?.id ?? "—");
    const subStatus = String(s?.status ?? "—");
    const subTotal = fmtMoney(s?.total, s?.currency);
    const subDate = fmtDate(s?.next_payment_date);

    const billingInterval = String(s?.billing_interval ?? "").trim();
    const billingPeriod = String(s?.billing_period ?? "").trim();
    const billingLabel = (billingInterval && billingPeriod)
      ? `${billingInterval} ${billingPeriod}`
      : "—";

    const subNotes = Array.isArray(s?.notes) ? s.notes : [];
    const subNotesBtn = renderNotesToggle("sub", sid, subNotes);

    const parentId = String(s?.parent_id ?? "").trim();
    const parentOrder = parentId ? orderById.get(parentId) : null;
    if (parentId) linkedOrderIds.add(parentId);

    const linked = bySub.get(sid) || [];
    const renewals = linked.filter((o) => String(o?.id ?? "").trim() !== parentId);

    renewals.sort((a, b) => {
      const da = new Date(a?.date_created || 0).getTime();
      const db = new Date(b?.date_created || 0).getTime();
      return db - da;
    });

    const newestRenewalId = renewals.length
      ? String(renewals[0]?.id ?? "")
      : null;

    const orderRows = [];

    if (parentOrder) {
      const oid = String(parentOrder?.id ?? "—");
      linkedOrderIds.add(oid);

      const paymentHtml = renderPaymentWithWarning(parentOrder);
      const parentItems = getOrderItemsSummary(parentOrder);
      const notes = Array.isArray(parentOrder?.notes) ? parentOrder.notes : [];

      orderRows.push(`
        <tr>
          <td>
            <div class="aa-type-cell">
              <span class="aa-type-dot"></span>
              <span class="aa-muted">Parent</span>
              ${renderOrderBadges(parentOrder)}
            </div>
          </td>
          <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(oid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(oid)}</a></td>
          <td>${esc(fmtDate(parentOrder?.date_created))}</td>
          <td>${renderStatusPill(String(parentOrder?.status ?? "—"))}</td>
          <td class="aa-right">${esc(fmtMoney(parentOrder?.total, parentOrder?.currency))}</td>
          <td>${paymentHtml}</td>
          <td title="${esc(parentItems.text)}">${esc(parentItems.text)}</td>
          <td class="aa-notes-cell">${renderNotesToggle("order", oid, notes)}</td>
        </tr>
      `);
      orderRows.push(renderOrderNotesRow(parentOrder));
    }

    for (const o of renewals) {
      const oid = String(o?.id ?? "—");
      const isLatest = !!newestRenewalId && oid === newestRenewalId;
      linkedOrderIds.add(oid);

      const paymentHtml = renderPaymentWithWarning(o);
      const orderItems = getOrderItemsSummary(o);
      const notes = Array.isArray(o?.notes) ? o.notes : [];

      orderRows.push(`
        <tr>
          <td>
            <div class="aa-type-cell">
              <span class="aa-type-dot"></span>
              <span class="aa-muted">Renewal</span>
              ${renderOrderBadges(o, { isLatest })}
            </div>
          </td>
          <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(oid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(oid)}</a></td>
          <td>${esc(fmtDate(o?.date_created))}</td>
          <td>${renderStatusPill(String(o?.status ?? "—"))}</td>
          <td class="aa-right">${esc(fmtMoney(o?.total, o?.currency))}</td>
          <td>${paymentHtml}</td>
          <td title="${esc(orderItems.text)}">${esc(orderItems.text)}</td>
          <td class="aa-notes-cell">${renderNotesToggle("order", oid, notes)}</td>
        </tr>
      `);
      orderRows.push(renderOrderNotesRow(o));
    }

    const ordersTable = `
      <div class="aa-card" style="margin-top:12px;">
        <div class="aa-card-title">Orders</div>
        <div class="aa-table-wrap" style="margin-top:10px;">
          <table class="aa-table" style="min-width:1310px; table-layout:fixed;">
            ${ledgerColGroup}
            <thead>
              <tr>
                <th>Type</th>
                <th>ID</th>
                <th>Date</th>
                <th>Status</th>
                <th class="aa-right">Total</th>
                <th>Payment</th>
                <th>Items</th>
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows.filter(Boolean).join("") || `
                <tr>
                  <td colspan="8" class="aa-muted">No orders found for this subscription in the current payload.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return `
      <div class="aa-card">
        <div class="aa-card-title">Subscription</div>

        <div class="aa-table-wrap" style="margin-top:10px;">
          <table class="aa-table" style="min-width:1310px; table-layout:fixed;">
            ${ledgerColGroup}
            <thead>
              <tr>
                <th>Type</th>
                <th>ID</th>
                <th>Date</th>
                <th>Status</th>
                <th class="aa-right">Total</th>
                <th>Billing</th>
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="aa-type-cell"><span class="aa-type-dot"></span><span class="aa-muted">Sub</span></div></td>
                <td><a class="aa-sub-id" href="${WOO_ADMIN}?post=${esc(sid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(sid)}</a></td>
                <td>${esc(subDate)}</td>
                <td>${renderStatusPill(subStatus)}</td>
                <td class="aa-right">${esc(subTotal)}</td>
                <td>${esc(billingLabel)}</td>
                <td class="aa-notes-cell">${subNotesBtn}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${renderSubscriptionActions(s)}

        ${renderSubNotesRow(s)}

        ${ordersTable}
      </div>
    `;
  }).join("");

  const unlinked = oArr
    .filter((o) => {
      const oid = String(o?.id ?? "").trim();
      return oid && !linkedOrderIds.has(oid);
    })
    .sort((a, b) => {
      const da = new Date(a?.date_created || 0).getTime();
      const db = new Date(b?.date_created || 0).getTime();
      return db - da;
    });

  const unlinkedTable = unlinked.length
    ? `
      <div class="aa-card" style="margin-top:14px;">
        <div class="aa-card-title">Other Orders (not linked to a subscription)</div>
        <div class="aa-table-wrap" style="margin-top:10px;">
          <table class="aa-table" style="min-width:1030px; table-layout:fixed;">
            ${ledgerColGroup}
            <thead>
              <tr>
                <th>Type</th>
                <th>ID</th>
                <th>Date</th>
                <th>Status</th>
                <th class="aa-right">Total</th>
                <th>Payment</th>
                <th>Items</th>
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${unlinked.map((o) => {
                const oid = String(o?.id ?? "—");
                const notes = Array.isArray(o?.notes) ? o.notes : [];
                const paymentHtml = renderPaymentWithWarning(o);
                const orderItems = getOrderItemsSummary(o);

                return `
                  <tr>
                    <td>
                      <div class="aa-type-cell">
                        <span class="aa-type-dot"></span>
                        <span class="aa-muted">Order</span>
                        ${renderOrderBadges(o)}
                      </div>
                    </td>
                    <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(oid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(oid)}</a></td>
                    <td>${esc(fmtDate(o?.date_created))}</td>
                    <td>${renderStatusPill(String(o?.status ?? "—"))}</td>
                    <td class="aa-right">${esc(fmtMoney(o?.total, o?.currency))}</td>
                    <td>${paymentHtml}</td>
                    <td title="${esc(orderItems.text)}">${esc(orderItems.text)}</td>
                    <td class="aa-notes-cell">${renderNotesToggle("order", oid, notes)}</td>
                  </tr>
                  ${renderOrderNotesRow(o)}
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
    : "";

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Subscription Ledger</div>
        <div class="aa-section-subtitle">Subscription card above orders table • no nested tables</div>
      </div>

      ${subscriptionBlocks || `<div class="aa-muted">No subscriptions found.</div>`}

      ${unlinkedTable}
    </section>
  `;
}


function renderTotals(data) {
  const d = data || {};

  // Always return a string (prevents "undefined" leaking into the UI)
  // Worker shape (current): { subscriptions_by_status: { "Trash": 12, ... }, orders_last_30d: { window:"all_time", by_status:{...}, total } }
  const subsByLabel = (d.subscriptions_by_status && typeof d.subscriptions_by_status === "object")
    ? d.subscriptions_by_status
    : {};

  const ordersBlock = (d.orders_last_30d && typeof d.orders_last_30d === "object")
    ? d.orders_last_30d
    : (d.orders_by_status && typeof d.orders_by_status === "object")
      ? { by_status: d.orders_by_status, total: d.orders_total || null }
      : {};

  const ordersByStatus = (ordersBlock.by_status && typeof ordersBlock.by_status === "object")
    ? ordersBlock.by_status
    : {};

  // Subscription labels (must match Worker labels exactly)
  const SUB_STATUS_ORDER = [
    "Trash",
    "Active",
    "Expired",
    "On hold",
    "Pending payment",
    "Pending cancellation",
    "Cancelled"
  ];

  // Order labels (map from Woo slugs)
  const ORDER_STATUS_ORDER = [
    ["Pending", "pending"],
    ["Processing", "processing"],
    ["On hold", "on-hold"],
    ["Completed", "completed"],
    ["Cancelled", "cancelled"],
    ["Refunded", "refunded"],
    ["Failed", "failed"]
  ];

  const subRows = SUB_STATUS_ORDER
    .map((label) => {
      const countRaw = subsByLabel[label];
      const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0;
      return `
        <tr>
          <td>${esc(label)}</td>
          <td class="aa-num">${esc(String(count))}</td>
        </tr>
      `;
    })
    .join("");

  const subTotal = SUB_STATUS_ORDER.reduce((acc, label) => {
    const v = Number(subsByLabel[label] ?? 0);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  const orderRows = ORDER_STATUS_ORDER
    .map(([label, slug]) => {
      const countRaw = ordersByStatus[slug];
      const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0;
      return `
        <tr>
          <td>${esc(label)}</td>
          <td class="aa-num">${esc(String(count))}</td>
        </tr>
      `;
    })
    .join("");

  let orderTotal = Number(ordersBlock.total);
  if (!Number.isFinite(orderTotal)) {
    orderTotal = ORDER_STATUS_ORDER.reduce((acc, [, slug]) => {
      const v = Number(ordersByStatus[slug] ?? 0);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
  }

  return `
    <div class="aa-totals-grid">
      <div class="aa-card aa-totals-card">
        <div class="aa-card-title">Subscriptions (all time)</div>
        <table class="aa-totals-table" role="table" aria-label="Subscriptions totals">
          <tbody>
            ${subRows}
            <tr class="aa-totals-divider"><td colspan="2"></td></tr>
            <tr class="aa-totals-total">
              <td>Total</td>
              <td class="aa-num">${esc(String(subTotal))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="aa-card aa-totals-card">
        <div class="aa-card-title">Orders (all time)</div>
        <table class="aa-totals-table" role="table" aria-label="Orders totals">
          <tbody>
            ${orderRows}
            <tr class="aa-totals-divider"><td colspan="2"></td></tr>
            <tr class="aa-totals-total">
              <td>Total</td>
              <td class="aa-num">${esc(String(orderTotal))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

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

  
  function isLikelyEmailLookupQuery(q) {
    const s = String(q ?? "").trim();
    if (!s) return false;
    if (/(?:\border\s*#?\s*)(\d{3,})\b/i.test(s) || /^#?(\d{3,})$/.test(s)) return false;
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s);
  }

  function renderProgressiveShell(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer ? renderCustomerCard(customer) : "";
    const billingCard = renderAddressBlock("Billing", billing, null);
    const shippingCard = renderAddressBlock("Shipping", shipping, billing);

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
          <div class="aa-section-subtitle">Customer loaded first</div>
        </div>

        ${customerCard}

        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading subscription(s) / order(s)</div>
          <div class="aa-section-subtitle">Fetching subscriptions, orders, and notes…</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>
    `;
  }

async function doSearch() {
    const q = $("q")?.value?.trim() || "";
    if (!q) {
      setStatus("warn", "Enter a query (email or order #).");
      return;
    }

    setStatus("busy", "Searching…");
    if (rawVisible) {
      rawVisible = false;
      renderRawJson();
    }
    $("results").innerHTML = "";

    const shouldProgressiveLoad = isLikelyEmailLookupQuery(q);

    if (shouldProgressiveLoad) {
      const partialResp = await fetch(`${WORKER_BASE}/admin/nl-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, mode: "customer_only" })
      });

      const partialJson = await partialResp.json().catch(() => null);
      if (!partialResp.ok || !partialJson?.ok) {
        const qTxt = $("q")?.value?.trim() || "";
        if (isNotFoundish(partialResp.status, partialJson)) {
          setStatus("warn", `No results found for "${qTxt}". Try an email address or an order # (example: #385309).`);
        } else {
          setStatus("warn", friendlyText(partialJson?.error || partialJson?.message) || `Search failed (${partialResp.status})`);
        }
        lastRaw = partialJson;
        lastMode = "search";
        lastPayload = partialJson;
        renderRawJson();
        return;
      }

      lastRaw = partialJson;
      lastMode = "search";
      lastPayload = partialJson;
      $("results").innerHTML = renderProgressiveShell(partialJson);
      bindCopyButtons($("results"));
      setStatus("busy", "Customer found. Loading subscriptions, orders, and notes…");

      const fullResp = await fetch(`${WORKER_BASE}/admin/nl-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, mode: "full" })
      });

      const fullJson = await fullResp.json().catch(() => null);
      lastRaw = fullJson;
      lastMode = "search";
      lastPayload = fullJson;

      if (!fullResp.ok || !fullJson?.ok) {
        const qTxt = $("q")?.value?.trim() || "";
        if (isNotFoundish(fullResp.status, fullJson)) {
          setStatus("warn", `No results found for "${qTxt}". Try an email address or an order # (example: #385309).`);
        } else {
          setStatus("warn", friendlyText(fullJson?.error || fullJson?.message) || `Search failed (${fullResp.status})`);
        }
        renderRawJson();
        return;
      }

      setStatus("", "Search complete.");
      $("results").innerHTML = renderResults(fullJson);
      bindNotesToggles($("results"));
      bindCopyButtons($("results"));
      bindOpenCandidateButtons($("results"));
      renderRawJson();
      return;
    }

    const r = await fetch(`${WORKER_BASE}/admin/nl-search`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, mode: "full" })
    });

    const j = await r.json().catch(() => null);
    lastRaw = j;
    lastMode = "search";
    lastPayload = j;

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

    setStatus("", "Search complete.");
    $("results").innerHTML = renderResults(j);

    bindNotesToggles($("results"));
    bindCopyButtons($("results"));
    bindOpenCandidateButtons($("results"));
    renderRawJson();
    return;
  }

  async function doTotals() {
    setStatus("busy", "Loading totals…");
  // Always collapse Raw JSON at the start of totals load
  if (rawVisible) {
    rawVisible = false;
    renderRawJson();
  }
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
    // Username field behavior:
    // - when logged in, it will be masked (password type)
    // - click/focus reveals it
    // - blur re-masks it if still logged in
    const u = $("loginUser");
    u?.addEventListener("focus", () => {
      if (u.type !== "text") u.type = "text";
    });
    u?.addEventListener("blur", () => {
      const loggedInNow = $("sessionPill")?.classList?.contains("ok");
      applyLoginUserMask(!!loggedInNow);
    });
    refreshSession().catch(() => setSessionPill(false, null));
  }

  init();
})();
// 🔴 main.js