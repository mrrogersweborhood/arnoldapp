// 🟢 main.js
// NOTE: Full file replacement begins here (main.js). End marker at bottom.
/* Arnold Admin main.js (no modules) */
(() => {
  "use strict";

  const CFG = {
    API_BASE: "https://okobserver-proxy.bob-b5c.workers.dev",
    ADMIN_PATH: "/admin",
    SEARCH_PATH: "/nl-search",
    STATUS_PATH: "/status",
    LOGIN_PATH: "/login",
    LOGOUT_PATH: "/logout",
    TIMEOUT_MS: 20000,
  };

  const state = {
    session: { ok: false, email: null },
    lastQuery: "",
    lastBundle: null,
  };

  const el = {
    sessionBadge: document.getElementById("sessionBadge"),
    sessionText: document.getElementById("sessionText"),
    loginEmail: document.getElementById("loginEmail"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    outCustomer: document.getElementById("outCustomer"),
    outSubs: document.getElementById("outSubs"),
    outOrders: document.getElementById("outOrders"),
    outJson: document.getElementById("outJson"),
    msg: document.getElementById("msg"),
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Remove fields that are explicitly "[redacted]" (or similar) from raw JSON output.
  function stripRedacted(obj) {
    const RED = new Set(["[redacted]", "[REDACTED]"]);
    const seen = new WeakSet();

    const walk = (v) => {
      if (v == null) return v;

      if (typeof v === "string") {
        return RED.has(v.trim()) ? undefined : v;
      }

      if (typeof v !== "object") return v;

      if (seen.has(v)) return undefined;
      seen.add(v);

      if (Array.isArray(v)) {
        const out = [];
        for (const item of v) {
          const w = walk(item);
          if (w !== undefined) out.push(w);
        }
        return out;
      }

      const out = {};
      for (const [k, val] of Object.entries(v)) {
        const w = walk(val);
        if (w === undefined) continue;
        out[k] = w;
      }
      return out;
    };

    return walk(obj) ?? {};
  }

  // "Raw JSON" should be collapsed by default; click the card header to toggle.
  let rawJsonToggleInitialized = false;
  function initRawJsonToggle() {
    if (rawJsonToggleInitialized) return;
    rawJsonToggleInitialized = true;

    const pre = el.outJson;
    if (!pre) return;

    const card = pre.closest(".card");
    const h3 = card ? card.querySelector("h3") : null;
    if (!card || !h3) return;

    pre.style.display = "none";
    h3.style.cursor = "pointer";
    h3.style.userSelect = "none";

    const labelBase = h3.textContent || "Raw JSON";
    const setLabel = (open) => {
      h3.textContent = open ? `${labelBase} ▾` : `${labelBase} ▸`;
    };
    setLabel(false);

    h3.addEventListener("click", () => {
      const open = pre.style.display === "none";
      pre.style.display = open ? "block" : "none";
      setLabel(open);
    });
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  }

  function fmtDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function fmtPhone(p) {
    if (!p) return "";
    const s = String(p).trim();
    // keep as-is if it already looks formatted
    if (/[()\-\s]/.test(s)) return s;
    const digits = s.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return s;
  }

  function setMsg(text, kind = "info") {
    if (!el.msg) return;
    el.msg.textContent = text || "";
    el.msg.className = `msg ${kind}`;
    el.msg.style.display = text ? "block" : "none";
  }

  async function apiFetch(path, opts = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CFG.TIMEOUT_MS);

    try {
      const res = await fetch(`${CFG.API_BASE}${CFG.ADMIN_PATH}${path}`, {
        method: opts.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
        credentials: "include",
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      const ct = res.headers.get("content-type") || "";
      const json = ct.includes("application/json") ? await res.json().catch(() => null) : null;
      const text = json ? null : await res.text().catch(() => "");

      return { ok: res.ok, status: res.status, json, text, headers: res.headers };
    } finally {
      clearTimeout(t);
    }
  }

  async function refreshStatus() {
    const r = await apiFetch(CFG.STATUS_PATH);
    const ok = !!(r.ok && r.json && r.json.ok);
    state.session.ok = ok;
    state.session.email = r.json?.email || null;
    renderSession();
  }

  function renderSession() {
    if (el.sessionBadge) {
      el.sessionBadge.classList.toggle("on", !!state.session.ok);
    }
    if (el.sessionText) {
      el.sessionText.textContent = state.session.ok ? "Session: logged in" : "Session: logged out";
    }
    if (el.btnLogin) el.btnLogin.disabled = false;
    if (el.btnLogout) el.btnLogout.disabled = false;
  }

  async function doLogin() {
    setMsg("");
    const email = (el.loginEmail?.value || "").trim();
    const pass = (el.loginPass?.value || "").trim();
    if (!email || !pass) {
      setMsg("Username and password required.", "err");
      return;
    }

    el.btnLogin.disabled = true;
    try {
      const r = await apiFetch(CFG.LOGIN_PATH, { method: "POST", body: { email, password: pass } });
      if (!r.ok) {
        setMsg(r.json?.error || `Login failed (${r.status}).`, "err");
        return;
      }
      setMsg("Done.", "ok");
      await refreshStatus();
    } catch (e) {
      setMsg(`Login error: ${e?.message || e}`, "err");
    } finally {
      el.btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    setMsg("");
    el.btnLogout.disabled = true;
    try {
      const r = await apiFetch(CFG.LOGOUT_PATH, { method: "POST" });
      if (!r.ok) {
        setMsg(r.json?.error || `Logout failed (${r.status}).`, "err");
        return;
      }
      setMsg("Logged out.", "ok");
      await refreshStatus();
    } catch (e) {
      setMsg(`Logout error: ${e?.message || e}`, "err");
    } finally {
      el.btnLogout.disabled = false;
    }
  }

  async function doSearch() {
    setMsg("");
    let q = (el.query?.value || "").trim();
    // If the query is purely numeric, treat it as an order lookup.
    if (/^\d+$/.test(q)) q = `order #${q}`;
    state.lastQuery = q;

    if (!q) {
      setMsg("Enter a customer email, subscription query, or an order id.", "err");
      return;
    }

    if (!state.session.ok) {
      setMsg("You must be logged in to search.", "err");
      return;
    }

    el.btnSearch.disabled = true;
    try {
      const r = await apiFetch(CFG.SEARCH_PATH, { method: "POST", body: { query: q } });
      if (!r.ok) {
        setMsg(r.json?.error || `Search failed (${r.status}).`, "err");
        renderBundle(null);
        return;
      }

      const bundle = r.json?.bundle || null;
      state.lastBundle = bundle;

      renderBundle(bundle, r.json?.raw || null);
      setMsg("Done.", "ok");
    } catch (e) {
      setMsg(`Search error: ${e?.message || e}`, "err");
      renderBundle(null);
    } finally {
      el.btnSearch.disabled = false;
    }
  }

  function renderBundle(bundle, rawJson) {
    if (!bundle) {
      renderCustomer(null);
      renderSubs([]);
      renderOrders([]);
      if (el.outJson) el.outJson.textContent = "";
      initRawJsonToggle();
      return;
    }

    renderCustomer(bundle.customer || null);
    renderSubs(bundle.subscriptions || []);
    renderOrders(bundle.orders || []);

    if (el.outJson) {
      el.outJson.textContent = JSON.stringify(stripRedacted(rawJson ?? {}), null, 2);
      initRawJsonToggle();
    }
  }

  function renderCustomer(c) {
    if (!el.outCustomer) return;

    if (!c) {
      el.outCustomer.innerHTML = `<div class="empty">No customer record found for this query.</div>`;
      return;
    }

    const billing = c.billing || {};
    const shipping = c.shipping || {};

    const name = (c.name || [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "").trim();
    const email = c.email || billing.email || shipping.email || null;

    const fmtAddr = (a, fallbackName) => {
      const parts = [];
      const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || (fallbackName || "");
      if (name) parts.push(name);
      if (a.address_1) parts.push(a.address_1);
      if (a.address_2) parts.push(a.address_2);
      const cityLine = [a.city, a.state, a.postcode].filter(Boolean).join(", ").trim();
      if (cityLine) parts.push(cityLine);
      if (a.country) parts.push(a.country);
      return parts.join(" • ");
    };

    const valueOrDash = (v) => (v == null || String(v).trim() === "" ? "—" : String(v));

    // Two-column (desktop) grid; stacks naturally on mobile.
    el.outCustomer.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
        <div>
          <div class="muted" style="font-weight:700;margin:0 0 8px;color:var(--blue);">Billing</div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">customer id</div><div>${valueOrDash(c.id)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">username</div><div>${valueOrDash(c.username)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">name</div><div>${valueOrDash(name)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">email</div><div>${valueOrDash(email)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">phone</div><div>${valueOrDash(fmtPhone(billing.phone || c.phone))}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">address</div><div>${valueOrDash(fmtAddr(billing, name))}</div></div>
        </div>

        <div>
          <div class="muted" style="font-weight:700;margin:0 0 8px;color:var(--blue);">Mailing</div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">name</div><div>${valueOrDash([shipping.first_name, shipping.last_name].filter(Boolean).join(" ").trim() || name)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">address</div><div>${valueOrDash(fmtAddr(shipping, name))}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">email</div><div>${valueOrDash(shipping.email || email)}</div></div>
          <div class="row"><div style="color:var(--blue);font-weight:700;">phone</div><div>${valueOrDash(fmtPhone(shipping.phone))}</div></div>
        </div>
      </div>
    `;
  }

  function renderSubs(subs) {
    if (!el.outSubs) return;
    const arr = Array.isArray(subs) ? subs : [];

    if (!arr.length) {
      el.outSubs.innerHTML = `<div class="empty">No subscriptions found.</div>`;
      return;
    }

    const nextPayValue = (s) =>
      s?.next_payment_date ||
      s?.next_payment_date_gmt ||
      s?.schedule_next_payment ||
      s?.schedule?.next_payment ||
      s?.next_payment ||
      null;

    const endValue = (s) => s?.end_date || s?.schedule_end || s?.schedule?.end || null;

    const hasAnyEnd = arr.some((s) => {
      const v = endValue(s);
      return v && String(v).trim() && String(v).trim().toLowerCase() !== "0";
    });

    const renderNotes = (s) => {
      const notes = Array.isArray(s?.notes) ? s.notes : [];
      if (!notes.length) return `<div class="muted">—</div>`;
      // newest first
      const sorted = notes.slice().sort((a, b) => {
        const da = Date.parse(a?.date_created || a?.date || "") || 0;
        const db = Date.parse(b?.date_created || b?.date || "") || 0;
        return db - da;
      });

      return `
        <div style="display:flex;flex-direction:column;gap:10px;min-width:240px;">
          ${sorted
            .map((n) => {
              const when = fmtDateTime(n?.date_created || n?.date);
              const body = esc(String(n?.note || n?.content || n?.text || "").trim());
              if (!body) return "";
              return `
              <div style="background:#fff;border:1px solid rgba(15,23,42,.10);border-radius:14px;padding:10px 12px;box-shadow:0 6px 18px rgba(15,23,42,.06);">
                <div class="muted" style="margin:0 0 6px 0;">${when || ""}</div>
                <div style="white-space:pre-wrap;line-height:1.35;">${body}</div>
              </div>
            `;
            })
            .join("")}
        </div>
      `;
    };

    el.outSubs.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Start</th>
            <th>Next Pay</th>
            ${hasAnyEnd ? "<th>End</th>" : ""}
            <th>Payment method</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map((s) => {
              const id = s.id ?? "";
              const status = s.status ?? "";
              const total = fmtMoney(s.total, s.currency);
              const start = fmtDateTime(s.start_date || s.date_created);
              const nextPay = fmtDateTime(nextPayValue(s));
              const end = hasAnyEnd ? fmtDateTime(endValue(s)) : "";
              const pm = s.payment_method_title || s.payment_method || "—";
              const notesHtml = renderNotes(s);

              return `
              <tr>
                <td>
                  <div><strong>#${id}</strong> ${status ? `<span class="pill">${esc(status)}</span>` : ""}</div>
                </td>
                <td>${total}</td>
                <td>${start || "—"}</td>
                <td>${nextPay || "—"}</td>
                ${hasAnyEnd ? `<td>${end || "—"}</td>` : ""}
                <td>${esc(String(pm))}</td>
                <td>${notesHtml}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    if (!el.outOrders) return;
    const arr = Array.isArray(orders) ? orders : [];

    if (!arr.length) {
      el.outOrders.innerHTML = `<div class="empty">No orders found.</div>`;
      return;
    }

    const itemsText = (o) => {
      const items = Array.isArray(o.line_items) ? o.line_items : [];
      if (!items.length) return "—";
      return items
        .map((li) => {
          const n = li?.name || "";
          const qty = Number(li?.quantity || 1);
          return qty > 1 ? `${n} × ${qty}` : n;
        })
        .filter(Boolean)
        .join("; ");
    };

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map((o) => {
              const id = o.id ?? "";
              const status = o.status ?? "";
              const total = fmtMoney(o.total, o.currency);
              const when = fmtDateTime(o.date_created);
              const pm = o.payment_method_title || o.payment_method || "—";
              const items = itemsText(o);

              return `
              <tr>
                <td>
                  <div><strong>#${id}</strong> ${status ? `<span class="pill">${esc(status)}</span>` : ""}</div>
                  <div class="muted">${when || ""}</div>
                </td>
                <td>${total}</td>
                <td>${esc(String(pm))}</td>
                <td>${esc(items)}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function wire() {
    if (el.btnLogin) el.btnLogin.addEventListener("click", (e) => (e.preventDefault(), doLogin()));
    if (el.btnLogout) el.btnLogout.addEventListener("click", (e) => (e.preventDefault(), doLogout()));
    if (el.btnSearch) el.btnSearch.addEventListener("click", (e) => (e.preventDefault(), doSearch()));
    if (el.query) {
      el.query.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSearch();
        }
      });
    }
  }

  async function boot() {
    wire();
    renderSession();
    await refreshStatus();
    initRawJsonToggle();
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
// 🔴 main.js
// NOTE: Full file replacement ends here (main.js).