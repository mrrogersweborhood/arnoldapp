// 🟢 main.js
// Arnold Admin SPA main.js (v2026-02-20u)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

const PROXY_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

const els = {
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  btnLogin: document.getElementById("btnLogin"),
  btnLogout: document.getElementById("btnLogout"),
  msg: document.getElementById("msg"),
  query: document.getElementById("query"),
  btnSearch: document.getElementById("btnSearch"),
  sessionPill: document.getElementById("sessionPill"),
  sessionDot: document.getElementById("sessionDot"),
  sessionText: document.getElementById("sessionText"),

  customerOut: document.getElementById("customerOut"),
  subsOut: document.getElementById("subsOut"),
  ordersOut: document.getElementById("ordersOut"),
  rawToggle: document.getElementById("rawToggle"),
  rawOut: document.getElementById("rawOut"),
  rawChevron: document.getElementById("rawChevron"),
};

function setMsg(text, kind) {
  els.msg.textContent = text || "";
  els.msg.className = "msg" + (kind ? " " + kind : "");
}

async function api(path, opts = {}) {
  const url = `${PROXY_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  let data = null;
  const txt = await res.text();
  try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
  return { res, data };
}

function fmtMoney(total, currency) {
  const n = Number(total);
  if (Number.isNaN(n)) return total ?? "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch (_) {
    return `$${n.toFixed(2)}`;
  }
}

function fmtDateTime(s) {
  if (!s) return "";
  try {
    // Woo sometimes returns "YYYY-MM-DD HH:MM:SS" (space, no timezone).
    // Make it ISO-like so Date parsing is consistent across browsers.
    const norm = String(s).trim().replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+([0-9]{2}:[0-9]{2}:[0-9]{2})$/, "$1T$2");
    const d = new Date(norm);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch (_) {
    return String(s);
  }
}

function safeText(v) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

function renderKVGrid(rows) {
  const wrap = document.createElement("div");
  wrap.className = "kvGrid";
  rows.forEach(([k, v]) => {
    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `<div class="k">${k}</div><div class="v">${safeText(v)}</div>`;
    wrap.appendChild(kv);
  });
  return wrap;
}

function addressOneLine(a) {
  if (!a) return "—";
  const parts = [
    [a.first_name, a.last_name].filter(Boolean).join(" ").trim(),
    a.address_1,
    a.address_2,
    a.city,
    a.state,
    a.postcode,
    a.country
  ].filter(Boolean).map(x => String(x).trim()).filter(Boolean);

  return parts.join(" • ") || "—";
}

function renderCustomer(customer) {
  if (!customer) {
    els.customerOut.textContent = "—";
    return;
  }

  const topRows = [
    ["customer id", customer.id],
    ["username", customer.username || customer.email],
    ["name", [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "—"],
    ["email", customer.email],
    ["phone", customer.billing?.phone || customer.shipping?.phone || "—"],
  ];

  const billing = customer.billing || {};
  const shipping = customer.shipping || {};

  const container = document.createElement("div");
  container.appendChild(renderKVGrid(topRows));

  const grid = document.createElement("div");
  grid.className = "grid2";

  const billCard = document.createElement("div");
  billCard.className = "card";
  billCard.style.padding = "14px 14px";
  billCard.innerHTML = `<h3 style="margin:0 0 10px;font-size:15px;font-weight:900;">Billing</h3>`;
  billCard.appendChild(renderKVGrid([
    ["name", [billing.first_name, billing.last_name].filter(Boolean).join(" ").trim() || "—"],
    ["address", addressOneLine(billing)],
    ["email", billing.email || customer.email],
    ["phone", billing.phone || "—"],
  ]));

  const shipCard = document.createElement("div");
  shipCard.className = "card";
  shipCard.style.padding = "14px 14px";
  shipCard.innerHTML = `<h3 style="margin:0 0 10px;font-size:15px;font-weight:900;">Shipping</h3>`;
  shipCard.appendChild(renderKVGrid([
    ["name", [shipping.first_name, shipping.last_name].filter(Boolean).join(" ").trim() || "—"],
    ["address", addressOneLine(shipping)],
    ["email", shipping.email || "—"],
    ["phone", shipping.phone || "—"],
  ]));

  grid.appendChild(billCard);
  grid.appendChild(shipCard);
  container.appendChild(grid);

  els.customerOut.innerHTML = "";
  els.customerOut.appendChild(container);
}

function renderSubscriptions(subs) {
  const arr = Array.isArray(subs) ? subs : [];
  if (!arr.length) {
    els.subsOut.textContent = "—";
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>SUBSCRIPTION</th>
        <th>TOTAL</th>
        <th>START</th>
        <th>NEXT PAY</th>
        <th>END</th>
        <th>PAYMENT METHOD</th>
        <th>NOTES</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tb = table.querySelector("tbody");

  for (const s of arr) {
    const tr = document.createElement("tr");

    const id = s?.id ?? "";
    const status = s?.status ?? "";
    const total = fmtMoney(s?.total, s?.currency);
    const start = fmtDateTime(s?.start_date);
    const nextPay = fmtDateTime(s?.next_payment_date);

    // If end date is never filled out, disregard it from this app:
    // Treat empty / null / "0000-00-00..." as blank.
    const endRaw = (s?.end_date == null) ? "" : String(s.end_date).trim();
    const end = (!endRaw || endRaw === "0000-00-00" || endRaw === "0000-00-00 00:00:00") ? "" : fmtDateTime(endRaw);

    const pm = s?.payment_method_title || s?.payment_method || "";

    // Notes as cards (OkObserver-ish)
    const notes = Array.isArray(s?.notes) ? s.notes : [];
    const notesHtml = notes.length
      ? notes.map(n => {
          const when = fmtDateTime(n?.date_created);
          const note = (n?.note == null) ? "" : String(n.note);
          return `
            <div class="noteCard">
              <div class="noteMeta">${when || "—"}</div>
              <div class="noteText">${escapeHtml(note)}</div>
            </div>
          `;
        }).join("")
      : "";

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-weight:900;">#${escapeHtml(String(id))}</div>
          <span class="tag">${escapeHtml(String(status))}</span>
        </div>
      </td>
      <td>${escapeHtml(total)}</td>
      <td>${escapeHtml(start)}</td>
      <td>${escapeHtml(nextPay)}</td>
      <td>${escapeHtml(end)}</td>
      <td>${escapeHtml(pm)}</td>
      <td>${notesHtml || ""}</td>
    `;
    tb.appendChild(tr);
  }

  els.subsOut.innerHTML = "";
  els.subsOut.appendChild(table);
}

function renderOrders(orders) {
  const arr = Array.isArray(orders) ? orders : [];
  if (!arr.length) {
    els.ordersOut.textContent = "—";
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>ORDER</th>
        <th>TOTAL</th>
        <th>PAYMENT</th>
        <th>ITEMS</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tb = table.querySelector("tbody");

  for (const o of arr) {
    const tr = document.createElement("tr");
    const id = o?.id ?? "";
    const status = o?.status ?? "";
    const total = fmtMoney(o?.total, o?.currency);
    const when = fmtDateTime(o?.date_created);
    const pm = o?.payment_method_title || o?.payment_method || "";

    const items = Array.isArray(o?.line_items) ? o.line_items : [];
    const itemsText = items.slice(0, 6).map(li => li?.name).filter(Boolean).join(" • ");

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-weight:900;">#${escapeHtml(String(id))}</div>
          <span class="tag">${escapeHtml(String(status))}</span>
        </div>
        <div style="margin-top:4px;color:var(--muted);font-size:12px;font-weight:750;">${escapeHtml(when)}</div>
      </td>
      <td>${escapeHtml(total)}</td>
      <td>${escapeHtml(pm)}</td>
      <td>${escapeHtml(itemsText)}</td>
    `;
    tb.appendChild(tr);
  }

  els.ordersOut.innerHTML = "";
  els.ordersOut.appendChild(table);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSessionPill(loggedIn) {
  if (loggedIn) {
    els.sessionDot.style.background = "#b7ffd0";
    els.sessionText.textContent = "Session: logged in";
  } else {
    els.sessionDot.style.background = "#fff2b7";
    els.sessionText.textContent = "Session: logged out";
  }
}

async function refreshStatus() {
  const { res, data } = await api("/admin/status", { method: "GET" });
  if (!res.ok) {
    setSessionPill(false);
    return { loggedIn: false };
  }
  const loggedIn = !!data?.loggedIn;
  setSessionPill(loggedIn);
  return data || { loggedIn };
}

async function doLogin() {
  setMsg("", "");
  const username = (els.loginUser.value || "").trim();
  const password = (els.loginPass.value || "").trim();
  if (!username || !password) {
    setMsg("Username and password required.", "bad");
    return;
  }

  const { res, data } = await api("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    setMsg(`Login failed (${res.status}).`, "bad");
    setSessionPill(false);
    return;
  }

  setMsg("Logged in.", "good");
  await refreshStatus();
}

async function doLogout() {
  setMsg("", "");
  await api("/admin/logout", { method: "POST", body: JSON.stringify({}) });
  setMsg("Logged out.", "good");
  await refreshStatus();
}

function inferIntent(query) {
  const q = String(query || "").trim();
  if (!q) return { kind: "unknown", query: "" };

  // If numeric, treat as order lookup (standing rule)
  if (/^\d+$/.test(q)) return { kind: "order", query: q };

  return { kind: "nl", query: q };
}

async function doSearch() {
  setMsg("", "");
  els.customerOut.textContent = "—";
  els.subsOut.textContent = "—";
  els.ordersOut.textContent = "—";
  els.rawOut.textContent = "";

  const q = (els.query.value || "").trim();
  if (!q) return;

  const intent = inferIntent(q);

  // For now, everything goes through nl-search; worker decides.
  const { res, data } = await api("/admin/nl-search", {
    method: "POST",
    body: JSON.stringify({ query: intent.query }),
  });

  if (!res.ok) {
    setMsg(`Search failed (${res.status}).`, "bad");
    els.rawOut.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return;
  }

  const ctx = data?.context || {};
  renderCustomer(ctx.customer || null);
  renderSubscriptions(ctx.subscriptions || []);
  renderOrders(ctx.orders || []);

  els.rawOut.textContent = JSON.stringify(data, null, 2);
}

function setupRawToggle() {
  let open = false;
  els.rawToggle.addEventListener("click", () => {
    open = !open;
    els.rawOut.style.display = open ? "block" : "none";
    els.rawChevron.textContent = open ? "⌄" : "›";
  });
}

function wire() {
  els.btnLogin.addEventListener("click", doLogin);
  els.btnLogout.addEventListener("click", doLogout);
  els.btnSearch.addEventListener("click", doSearch);

  els.loginPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  setupRawToggle();
}

(async function init() {
  wire();
  await refreshStatus();
})();

// 🔴 main.js