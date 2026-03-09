// 🟢 formatters.js
// Arnold Admin — SAFE SPLIT PASS 1 (pure helpers only)
// (Markers are comments only: 🟢 formatters.js ... 🔴 formatters.js)

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

function stripHtml(html) {
    const s = String(html ?? "");
    if (!s) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    const text = tmp.textContent || tmp.innerText || "";
    return text.replace(/\s+/g, " ").trim();
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

// 🔴 formatters.js
