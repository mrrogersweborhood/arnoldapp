// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-21b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  // Worker base URL (DO NOT FORGET):
  // https://arnold-admin-worker.bob-b5c.workers.dev
  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ---------------- DOM ---------------- */

  const $ = (sel) => document.querySelector(sel);

  // IMPORTANT: keep these IDs in sync with index.html
  const el = {
    sessionPill: $("#sessionPill"),
    sessionDot: $("#sessionDot"),
    statusText: $("#sessionText"),

    loginUser: $("#loginUser"),
    loginPass: $("#loginPass"),
    btnLogin: $("#btnLogin"),
    btnLogout: $("#btnLogout"),

    query: $("#query"),
    btnSearch: $("#btnSearch"),

    outCustomer: $("#customerOut"),
    outSubs: $("#subsOut"),
    outOrders: $("#ordersOut"),

    rawToggle: $("#rawToggle"),
    rawChevron: $("#rawChevron"),
    rawOut: $("#rawOut"),

    msg: $("#msg")
  };

  /* ---------------- UTIL: formatting ---------------- */

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    const c = (currency || "USD").toUpperCase();
    if (!Number.isFinite(n)) return String(amount ?? "");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  }

  function normalizeNullableDate(d) {
    const s = String(d ?? "").trim();
    if (!s) return "";
    if (s.startsWith("0000-00-00")) return "";
    return s;
  }

  function formatLocalDate(isoLike) {
    const s = String(isoLike ?? "").trim();
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function digitsOnly(s) {
    return String(s ?? "").replace(/\D+/g, "");
  }

  function fmtPhone(s) {
    const d = digitsOnly(s);
    if (!d) return "";
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    return String(s ?? "");
  }

  function setMsg(text) {
    el.msg.textContent = text ? String(text) : "";
  }

  function clearOutputs() {
    el.outCustomer.innerHTML = `<div class="muted">—</div>`;
    el.outSubs.innerHTML = `<div class="muted">—</div>`;
    el.outOrders.innerHTML = `<div class="muted">—</div>`;
    el.rawOut.textContent = "";
  }

  /* ---------------- Session UI ---------------- */

  function setSessionUi(isLoggedIn, detail) {
    el.sessionPill.classList.toggle("on", !!isLoggedIn);
    el.statusText.textContent = detail || (isLoggedIn ? "Session: logged in" : "Session: logged out");
  }

  /* ---------------- API ---------------- */

  async function apiFetch(path, opts = {}) {
    const url = `${WORKER_BASE}${path}`;
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers || (opts.body ? { "Content-Type": "application/json" } : undefined),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include"
    });

    const ct = res.headers.get("content-type") || "";
    let data = null;

    if (ct.includes("application/json")) data = await res.json().catch(() => null);
    else {
      const text = await res.text().catch(() => "");
      data = text ? { text } : null;
    }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // Worker returns: { loggedIn: true/false, user?, roles? }
  async function refreshStatus() {
    try {
      const data = await apiFetch("/admin/status");
      const loggedIn = !!data?.loggedIn;
      setSessionUi(loggedIn, loggedIn ? "Session: logged in" : "Session: logged out");
      return loggedIn;
    } catch {
      setSessionUi(false, "Session: logged out");
      return false;
    }
  }

  /* ---------------- Auth ---------------- */

  // Worker returns: { success: true/false, user?, roles?, message? }
  async function doLogin() {
    setMsg("");
    try {
      const user = String(el.loginUser.value ?? "").trim();
      const pass = String(el.loginPass.value ?? "");
      if (!user || !pass) {
        setMsg("Enter your WordPress username/email and password.");
        return;
      }

      el.btnLogin.disabled = true;

      const data = await apiFetch("/admin/login", {
        method: "POST",
        body: { username: user, password: pass }
      });

      const ok = (data?.success === true) || (data?.ok === true);

      if (ok) {
        setSessionUi(true, "Session: logged in");
        setMsg("");
        // Immediately verify session cookie is active
        await refreshStatus();
      } else {
        setSessionUi(false, "Session: logged out");
        setMsg(data?.message || data?.error || "Login failed.");
      }
    } catch (e) {
      setSessionUi(false, "Session: logged out");
      setMsg(e?.message || "Login failed.");
    } finally {
      el.btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    setMsg("");
    try {
      el.btnLogout.disabled = true;
      await apiFetch("/admin/logout", { method: "POST", body: {} });
      setSessionUi(false, "Session: logged out");
      clearOutputs();
    } catch (e) {
      setMsg(e?.message || "Logout failed.");
    } finally {
      el.btnLogout.disabled = false;
    }
  }

  /* ---------------- Rendering ---------------- */

  function renderCustomer(c) {
    if (!c) {
      el.outCustomer.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const billing = c.billing || {};
    const shipping = c.shipping || {};

    const baseKv = [
      ["customer id", c.id],
      ["username", c.username],
      ["name", `${c.first_name || ""} ${c.last_name || ""}`.trim()],
      ["email", c.email],
      ["phone", fmtPhone(c.billing?.phone || c.shipping?.phone || c.phone)]
    ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");

    const kvHtml = (pairs) => `
      <div class="kvGrid">
        ${pairs.map(([k, v]) => `
          <div class="kv">
            <div class="k">${escapeHtml(k)}</div>
            <div class="v">${escapeHtml(v)}</div>
          </div>
        `).join("")}
      </div>
    `;

    const addrHtml = (label, a) => {
      const name = `${a.first_name || ""} ${a.last_name || ""}`.trim();
      const line1 = [a.address_1, a.address_2].filter(Boolean).join(" ");
      const line2 = [a.city, a.state, a.postcode, a.country].filter(Boolean).join(" • ");
      const phone = fmtPhone(a.phone);
      const email = a.email || "";

      const pairs = [
        ["name", name],
        ["address", [line1, line2].filter(Boolean).join(" • ")],
        ["email", email],
        ["phone", phone]
      ].filter(([, v]) => String(v || "").trim() !== "");

      return `
        <div class="card" style="box-shadow:none">
          <div style="font-weight:900;margin:0 0 10px 0">${escapeHtml(label)}</div>
          ${pairs.length ? kvHtml(pairs) : `<div class="muted">—</div>`}
        </div>
      `;
    };

    el.outCustomer.innerHTML = `
      ${kvHtml(baseKv)}
      <div class="twoCol">
        ${addrHtml("Billing", billing)}
        ${addrHtml("Shipping", shipping)}
      </div>
    `;
  }

  function renderSubs(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      el.outSubs.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const rows = arr.map((s) => {
      const id = s?.id ?? "";
      const status = String(s?.status ?? "").trim();
      const total = s?.total ?? "";
      const currency = s?.currency ?? "";
      const start = s?.start_date ?? "";
      const nextPay = s?.next_payment_date ?? "";
      const interval = s?.billing_interval ?? "";
      const period = s?.billing_period ?? "";
      const pay = s?.payment_method_title ?? s?.payment_method ?? "";

      const end = normalizeNullableDate(s?.end_date);

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const notesHtml = notes.length
        ? notes.slice(0, 8).map((n) => {
            const when = n?.date_created ? formatLocalDate(n.date_created) : "";
            const text = (n?.note ?? "").toString().trim();
            if (!text) return "";
            return `<div class="noteLine">${when ? `<span class="muted">${escapeHtml(when)}:</span> ` : ``}${escapeHtml(text)}</div>`;
          }).filter(Boolean).join("")
        : `<div class="muted">—</div>`;

      return `
        <div class="subRow">
          <div class="subLeft">
            <div class="oneRowTitle">
              <span class="mono">#${escapeHtml(id)}</span>
              ${status ? `<span class="pill">${escapeHtml(status)}</span>` : ``}
            </div>
            <div class="oneRowMeta">
              ${total ? `${escapeHtml(fmtMoney(total, currency))}` : ``}
              ${start ? ` • start ${escapeHtml(formatLocalDate(start))}` : ``}
              ${nextPay ? ` • next ${escapeHtml(formatLocalDate(nextPay))}` : ``}
              ${(interval && period) ? ` • every ${escapeHtml(String(interval))} ${escapeHtml(String(period))}` : ``}
              ${pay ? ` • ${escapeHtml(pay)}` : ``}
              ${end ? ` • ends ${escapeHtml(formatLocalDate(end))}` : ``}
            </div>
          </div>

          <div class="subNotes">
            ${notesHtml}
          </div>
        </div>
      `;
    }).join("");

    el.outSubs.innerHTML = `<div class="oneList">${rows}</div>`;
  }

  // Orders: one-line rows, no redundant billing/shipping blocks (customer section owns addresses)
  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      el.outOrders.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const rows = arr.map((o) => {
      const id = o?.id ?? "";
      const status = String(o?.status ?? "").trim();
      const total = o?.total ?? "";
      const currency = o?.currency ?? "";
      const created = o?.date_created ?? "";
      const pay = o?.payment_method_title ?? o?.payment_method ?? "";
      const item0 = (Array.isArray(o?.line_items) && o.line_items[0]) ? (o.line_items[0].name || "") : "";

      return `
        <div class="oneRow">
          <div class="oneRowTitle">
            <span class="mono">#${escapeHtml(id)}</span>
            ${status ? `<span class="pill">${escapeHtml(status)}</span>` : ``}
          </div>
          <div class="oneRowMeta">
            ${total ? `${escapeHtml(fmtMoney(total, currency))}` : ``}
            ${created ? ` • ${escapeHtml(formatLocalDate(created))}` : ``}
            ${pay ? ` • ${escapeHtml(pay)}` : ``}
            ${item0 ? ` • ${escapeHtml(item0)}` : ``}
          </div>
        </div>
      `;
    }).join("");

    el.outOrders.innerHTML = `<div class="oneList">${rows}</div>`;
  }

  function renderRawJson(obj) {
    el.rawOut.textContent = obj ? JSON.stringify(obj, null, 2) : "";
  }

  /* ---------------- Search ---------------- */

  async function doSearch() {
    setMsg("");
    clearOutputs();

    const q = String(el.query.value ?? "").trim();
    if (!q) {
      setMsg("Enter a search query.");
      return;
    }

    const ok = await refreshStatus();
    if (!ok) {
      setMsg("You must be logged in.");
      return;
    }

    el.btnSearch.disabled = true;

    try {
      // Worker expects: { query: "..." }
      const data = await apiFetch("/admin/nl-search", { method: "POST", body: { query: q } });

      // Worker returns different shapes, but ALWAYS includes "context" on success for email paths.
      // Prefer context if present.
      const ctx = data?.context || null;

      const customer = ctx?.customer || null;
      const subscriptions = ctx?.subscriptions || [];
      const orders = ctx?.orders || [];

      renderCustomer(customer);
      renderSubs(subscriptions);
      renderOrders(orders);

      renderRawJson(data);
    } catch (e) {
      setMsg(e?.message || "Search failed.");
      renderRawJson(e?.data || { error: e?.message || "Search failed" });
    } finally {
      el.btnSearch.disabled = false;
    }
  }

  /* ---------------- Wire & Boot ---------------- */

  function wire() {
    // DOM mismatch guard: prevents silent regressions when only one file updates.
    const required = [
      "sessionPill", "sessionDot", "statusText",
      "loginUser", "loginPass", "btnLogin", "btnLogout",
      "query", "btnSearch",
      "outCustomer", "outSubs", "outOrders",
      "rawToggle", "rawChevron", "rawOut",
      "msg"
    ];

    const missing = required.filter((k) => !el[k]);
    if (missing.length) {
      const msg = `DOM mismatch: missing element(s): ${missing.join(", ")}. index.html and main.js must be updated together.`;
      if (el.msg) el.msg.textContent = msg;
      if (el.btnLogin) el.btnLogin.disabled = true;
      if (el.btnLogout) el.btnLogout.disabled = true;
      if (el.btnSearch) el.btnSearch.disabled = true;
      return;
    }

    el.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
    el.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });

    el.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

    el.loginPass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doLogin(); }
    });

    el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSearch(); }
    });

    // Raw JSON toggle
    let rawOpen = false;
    const setRawOpen = (open) => {
      rawOpen = !!open;
      const box = document.getElementById("rawBox");
      if (box) box.classList.toggle("rawOpen", rawOpen);
    };

    el.rawToggle.addEventListener("click", (e) => {
      e.preventDefault();
      setRawOpen(!rawOpen);
    });

    setRawOpen(false);
  }

  async function boot() {
    wire();
    await refreshStatus();
  }

  boot().catch(() => {
    setSessionUi(false, "Session: logged out");
  });
})();

// 🔴 main.js