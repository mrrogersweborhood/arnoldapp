
function renderSubscriberTimeline(customer, subs, orders){
  const events = [];

  if (customer && customer.date_created) {
    events.push({date:customer.date_created,type:"Customer created",detail:"",cls:"info",icon:"🔵"});
  }

  (Array.isArray(subs)?subs:[]).forEach(s=>{
    const started = s?.date_created || s?.start_date || null;
    if(started){
      events.push({date:started,type:"Subscription started",detail:`#${s.id}`,cls:"info",icon:"🔵"});
    }
  });

  (Array.isArray(orders)?orders:[]).forEach(o=>{
    const status = String(o?.status||"").toLowerCase();
    let type="Order", cls="info", icon="🔵";

    if(status==="failed"||status==="cancelled"||status==="refunded"||status.includes("chargeback")){
      type="Problem order"; cls="problem"; icon="🔴";
    }
    else if(status==="on-hold"||status==="pending"){
      type="Needs attention"; cls="warn"; icon="🟠";
    }
    else if(status==="completed"||status==="processing"){
      type="Renewal"; cls="success"; icon="🟢";
    }

    events.push({date:o?.date_created,type,detail:`#${o?.id||""}`,cls,icon});
  });

  events.sort((a,b)=>new Date(a.date)-new Date(b.date));

  const rows = events.map(e=>`
    <div class="aa-timeline-row aa-timeline-row-${esc(e.cls)}">
      <div class="aa-timeline-date">${fmtDate(e.date)}</div>
      <div class="aa-timeline-type"><span class="aa-timeline-icon">${e.icon}</span>${esc(e.type)}</div>
      <div class="aa-timeline-detail">${esc(e.detail)}</div>
    </div>
  `).join("");

  return `
    <section class="card aa-section aa-timeline-section">
      <details class="aa-timeline-details">
        <summary class="aa-timeline-summary">
          <span class="aa-section-title">Subscriber Activity</span>
          <span class="aa-timeline-summary-meta">${events.length} event${events.length===1?"":"s"}</span>
        </summary>
        <div class="aa-timeline">${rows||'<div class="aa-muted">No activity found.</div>'}</div>
      </details>
    </section>
  `;
}

// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-03-08R1-inlineClipboardIcons)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  // -----------------------------
  // CONFIG
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
    const base = fmtDate(val);
    if (base === "—") return base;
    const age = formatAgeFromDate(val);
    return `${base}${age}`;
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
function renderSubscriberTimeline(customer, subs, orders){
  const events = [];

  if (customer && customer.date_created) {
    events.push({date:customer.date_created,type:"Customer created",detail:"",cls:"info",icon:"🔵"});
  }

  (Array.isArray(subs)?subs:[]).forEach(s=>{
    const started = s?.date_created || s?.start_date || null;
    if(started){
      events.push({date:started,type:"Subscription started",detail:`#${s.id}`,cls:"info",icon:"🔵"});
    }
  });

  (Array.isArray(orders)?orders:[]).forEach(o=>{
    const status = String(o?.status||"").toLowerCase();
    let type="Order", cls="info", icon="🔵";

    if(status==="failed"||status==="cancelled"||status==="refunded"||status.includes("chargeback")){
      type="Problem order"; cls="problem"; icon="🔴";
    }
    else if(status==="on-hold"||status==="pending"){
      type="Needs attention"; cls="warn"; icon="🟠";
    }
    else if(status==="completed"||status==="processing"){
      type="Renewal"; cls="success"; icon="🟢";
    }

    events.push({date:o?.date_created,type,detail:`#${o?.id||""}`,cls,icon});
  });

  events.sort((a,b)=>new Date(a.date)-new Date(b.date));

  const rows = events.map(e=>`
    <div class="aa-timeline-row aa-timeline-row-${esc(e.cls)}">
      <div class="aa-timeline-date">${fmtDate(e.date)}</div>
      <div class="aa-timeline-type"><span class="aa-timeline-icon">${e.icon}</span>${esc(e.type)}</div>
      <div class="aa-timeline-detail">${esc(e.detail)}</div>
    </div>
  `).join("");

  return `
    <section class="card aa-section aa-timeline-section">
      <details class="aa-timeline-details">
        <summary class="aa-timeline-summary">
          <span class="aa-section-title">Subscriber Activity</span>
          <span class="aa-timeline-summary-meta">${events.length} event${events.length===1?"":"s"}</span>
        </summary>
        <div class="aa-timeline">${rows||'<div class="aa-muted">No activity found.</div>'}</div>
      </details>
    </section>
  `;
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
            ${renderValueWithCopy(String(id), String(id))}
            <div class="aa-copy-row">
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

          <div class="aa-tile">
            <div class="aa-label">Username</div>
            ${renderValueWithCopy(String(username), String(username))}
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
          bindOpenCandidateButtons($("results"));
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

  function bindOpenCandidateButtons(container) {
    if (!container) return;
    container.querySelectorAll('.aa-candidate-open-btn[data-open-query]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const query = String(btn.getAttribute('data-open-query') || '').trim();
        if (!query) return;
        const qEl = $('q');
        if (qEl) qEl.value = query;
        await doSearch();
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
        <td><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(id)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(id)}</a>${renderCopyButton("Order ID", `#${id}`)}</td>
        <td>${esc(created)}</td>
        <td>${renderStatusPill(status)}</td>
        <td>${esc(total)}</td>
        <td>${paymentHtml}</td>
        <td title="${esc(itemsText)}">${esc(itemsText)}</td>
        <td class="aa-notes-cell">${btn}</td>
      </tr>
      ${isOpen ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${notesHtml}</div></td></tr>` : ``}
    `;
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
      const name = [c?.first_name, c?.last_name].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') || '—';
      const email = String(c?.email ?? '').trim() || '—';
      const id = c?.id != null && String(c.id).trim() ? `#${String(c.id).trim()}` : '—';
      const openValue = email !== '—' ? email : (id !== '—' ? id : '');

      return `
        <div class="aa-candidate-row">
          <div class="aa-candidate-open">
            ${openValue ? `<button type="button" class="aa-copy-btn aa-candidate-open-btn" data-open-query="${esc(openValue)}">Open</button>` : `<span class="aa-muted">—</span>`}
          </div>
          <div class="aa-candidate-name">${esc(name)}</div>
          <div class="aa-candidate-email">${esc(email)}</div>
          <div class="aa-candidate-id">${esc(id)}</div>
        </div>
      `;
    }).join('');

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Possible Matches</div>
          <div class="aa-section-subtitle">Select the correct customer</div>
        </div>

        <div class="aa-candidate-table-wrap">
          <div class="aa-candidate-header">
            <div>Open</div>
            <div>Name</div>
            <div>Email</div>
            <div>Customer ID</div>
          </div>
          <div class="aa-candidate-list">
            ${rows}
          </div>
        </div>
      </section>
    `;
  }

  function renderResults(payload) {
    if (payload?.intent === "customer_candidates_by_name") return renderCandidateMatches(payload);
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer ? renderCustomerCard(customer) : "";

    const billingCard = renderAddressBlock("Billing", billing, null);
    const shippingCard = renderAddressBlock("Shipping", shipping, billing);

    const timeline = renderSubscriberTimeline(customer, subs, orders);
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

      ${timeline || ""}

      ${ledger || ""}
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
        <td colspan="7">
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
          <td class="aa-notes-cell">${renderNotesToggle("order", oid, notes)}</td>
        </tr>
      `);
      orderRows.push(renderOrderNotesRow(o));
    }

    const ordersTable = `
      <div class="aa-card" style="margin-top:12px;">
        <div class="aa-card-title">Orders</div>
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
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows.filter(Boolean).join("") || `
                <tr>
                  <td colspan="7" class="aa-muted">No orders found for this subscription in the current payload.</td>
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
          <table class="aa-table" style="min-width:1030px; table-layout:fixed;">
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
                <th style="text-align:right;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${unlinked.map((o) => {
                const oid = String(o?.id ?? "—");
                const notes = Array.isArray(o?.notes) ? o.notes : [];
                const paymentHtml = renderPaymentWithWarning(o);

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
}  async function doLogin() {
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
    // Always collapse Raw JSON at the start of a new search
    if (rawVisible) {
      rawVisible = false;
      renderRawJson();
    }
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