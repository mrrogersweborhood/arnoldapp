// 🟢 main.js
// 🟢 main.js — full file replacement (copy/paste). Marker must remain inside comment.

(() => {
  "use strict";

  // =========================
  // Config
  // =========================
  const CFG = {
    API_BASE: "https://arnold-proxy.bob-b5c.workers.dev",
    ADMIN_PATH: "/admin",
    LOGIN_PATH: "/login",
    LOGOUT_PATH: "/logout",
    STATUS_PATH: "/status",
    NL_SEARCH_PATH: "/nl-search",
  };

  // =========================
  // State
  // =========================
  const state = {
    session: {
      loggedIn: false,
      email: null,
      username: null,
    },
    busy: false,
    lastQuery: "",
    lastRaw: null,
  };

  // =========================
  // DOM (must match index.html)
  // =========================
  const el = {
    loginEmail: document.getElementById("loginEmail"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    statusMsg: document.getElementById("statusMsg"),

    sessionPill: document.getElementById("sessionPill"),
    outCustomer: document.getElementById("outCustomer"),
    outSubs: document.getElementById("outSubs"),
    outOrders: document.getElementById("outOrders"),
    outJson: document.getElementById("outJson"),
  };

  // =========================
  // Helpers
  // =========================
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(msg, kind = "info") {
    if (!el.statusMsg) return;
    el.statusMsg.className = `status ${kind}`;
    el.statusMsg.textContent = msg || "";
  }

  function setBusy(isBusy) {
    state.busy = !!isBusy;
    const disabled = !!isBusy;
    if (el.btnLogin) el.btnLogin.disabled = disabled;
    if (el.btnLogout) el.btnLogout.disabled = disabled;
    if (el.btnSearch) el.btnSearch.disabled = disabled;
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return amount == null ? "—" : String(amount);
    const cur = currency || "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
      }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  }

  function fmtDateTime(s) {
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  function addressLine(a) {
    if (!a) return "";
    const parts = [];
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
    if (name) parts.push(name);
    const street = [a.address_1, a.address_2].filter(Boolean).join(" ").trim();
    if (street) parts.push(street);
    const city = [a.city, a.state, a.postcode].filter(Boolean).join(", ").trim();
    if (city) parts.push(city);
    if (a.country) parts.push(a.country);
    return parts.join(" • ");
  }

  function apiUrl(path) {
    return `${CFG.API_BASE}${CFG.ADMIN_PATH}${path}`;
  }

  async function apiFetch(path, opts = {}) {
    const url = apiUrl(path);
    const res = await fetch(url, {
      credentials: "include",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });

    let json = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    } else {
      try {
        const text = await res.text();
        json = text ? { text } : null;
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json;
      throw err;
    }

    return json;
  }

  function dlRow(label, value) {
    if (value == null || value === "") return "";
    return `
      <div class="row">
        <div class="k" style="color:var(--blue); font-weight:600;">${esc(label)}</div>
        <div class="v">${esc(String(value))}</div>
      </div>
    `;
  }

  function isMeaningfulDate(val) {
    const s = String(val || "").trim();
    if (!s) return false;
    if (s === "0" || s === "0000-00-00" || s.startsWith("0000-00-00")) return false;
    return true;
  }

  function pruneRedacted(obj) {
    const RED = "[redacted]";
    function walk(x) {
      if (x === RED) return undefined;
      if (x == null) return x;
      if (Array.isArray(x)) {
        const out = [];
        for (const it of x) {
          const v = walk(it);
          if (v === undefined) continue;
          out.push(v);
        }
        return out;
      }
      if (typeof x === "object") {
        const out = {};
        for (const [k, v0] of Object.entries(x)) {
          const v = walk(v0);
          if (v === undefined) continue;
          out[k] = v;
        }
        return out;
      }
      return x;
    }
    return walk(obj);
  }

  function renderNotesCards(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return `<div class="muted">—</div>`;
    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${arr
          .map((n) => {
            const when = fmtDateTime(n?.date_created || n?.date || "");
            const text = n?.note || n?.content || n?.text || "";
            return `
            <div style="background:#fff; border:1px solid var(--line); border-radius:14px; padding:10px 12px; box-shadow:var(--shadow);">
              <div class="muted" style="margin-bottom:6px;">${esc(when)}</div>
              <div>${esc(String(text || ""))}</div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  // =========================
  // Renderers
  // =========================
  function renderCustomer(c) {
    if (!el.outCustomer) return;

    if (!c) {
      el.outCustomer.innerHTML = `<div class="empty">—</div>`;
      return;
    }

    const billing = c.billing || null;
    const shipping = c.shipping || null;

    function addrBlock(title, a) {
      if (!a)
        return `
        <div style="background:#fff; border:1px solid var(--line); border-radius:16px; padding:14px 16px; box-shadow:var(--shadow);">
          <div style="font-weight:800; margin-bottom:10px;">${esc(title)}</div>
          <div class="muted">—</div>
        </div>
      `;

      const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || null;
      const address = addressLine(a) || null;

      return `
        <div style="background:#fff; border:1px solid var(--line); border-radius:16px; padding:14px 16px; box-shadow:var(--shadow);">
          <div style="font-weight:800; margin-bottom:10px;">${esc(title)}</div>
          ${dlRow("name", name)}
          ${dlRow("address", address)}
          ${dlRow("email", a.email || null)}
          ${dlRow("phone", a.phone || null)}
        </div>
      `;
    }

    const topRows = [
      dlRow("customer id", c.id ?? c.customer_id ?? null),
      dlRow("username", c.username ?? null),
      dlRow(
        "name",
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.name || null
      ),
      dlRow("email", c.email ?? null),
      dlRow("phone", c.phone ?? billing?.phone ?? null),
    ].join("");

    el.outCustomer.innerHTML = `
      ${topRows || ""}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:14px;"
           class="addr-grid">
        ${addrBlock("Billing", billing)}
        ${addrBlock("Shipping", shipping)}
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

    const hasAnyEnd = arr.some((s) => isMeaningfulDate(s?.end_date));
    const headers = `
      <tr>
        <th>Subscription</th>
        <th>Total</th>
        <th>Start</th>
        <th>Next Pay</th>
        ${hasAnyEnd ? "<th>End</th>" : ""}
        <th>Payment Method</th>
        <th>Notes</th>
      </tr>
    `;

    const rows = arr
      .map((s) => {
        const id = s.id != null ? `#${s.id}` : "";
        const status = s.status ? String(s.status) : "";
        const total = fmtMoney(s.total, s.currency);
        const start = fmtDateTime(s.start_date || s.date_created || "");
        const nextPay = isMeaningfulDate(s.next_payment_date)
          ? fmtDateTime(s.next_payment_date)
          : "—";
        const end = isMeaningfulDate(s.end_date) ? fmtDateTime(s.end_date) : "";
        const pm = s.payment_method_title || s.payment_method || "";
        const notesHtml = renderNotesCards(s.notes || s.subscription_notes || []);

        return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span></td>
          <td>${esc(total)}</td>
          <td>${esc(start)}</td>
          <td>${esc(nextPay)}</td>
          ${hasAnyEnd ? `<td>${end ? esc(end) : '<span class="muted">—</span>'}</td>` : ""}
          <td>${esc(pm)}</td>
          <td>${notesHtml}</td>
        </tr>
      `;
      })
      .join("");

    el.outSubs.innerHTML = `
      <table class="tbl">
        <thead>${headers}</thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function orderItemsSummary(o) {
    const items = o?.line_items || o?.items || [];
    if (!Array.isArray(items) || !items.length) return "—";
    return items
      .map((it) => it?.name || it?.product_name || it?.title)
      .filter(Boolean)
      .join(", ");
  }

  function renderOrders(orders) {
    if (!el.outOrders) return;

    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      el.outOrders.innerHTML = `<div class="empty">No orders found.</div>`;
      return;
    }

    const rows = arr
      .map((o) => {
        const id = o.id != null ? `#${o.id}` : "";
        const status = o.status ? String(o.status) : "";
        const total = fmtMoney(o.total, o.currency);
        const dt = fmtDateTime(o.date_created || o.date_paid || "");
        const pm = o.payment_method_title || o.payment_method || "—";
        const items = orderItemsSummary(o);

        return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span><div class="muted">${esc(dt)}</div></td>
          <td>${esc(total)}</td>
          <td>${esc(pm)}</td>
          <td>${esc(items)}</td>
        </tr>
      `;
      })
      .join("");

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
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderBundle(context, rawJson) {
    // Always render: Customer -> Subscriptions -> Orders
    renderCustomer(context?.customer || null);
    renderSubs(context?.subscriptions || []);
    renderOrders(context?.orders || []);

    if (el.outJson) {
      const pruned = pruneRedacted(rawJson ?? {});
      el.outJson.textContent = JSON.stringify(pruned ?? {}, null, 2);
    }
  }

  // =========================
  // Actions
  // =========================
  async function refreshStatus() {
    try {
      const st = await apiFetch(CFG.STATUS_PATH, { method: "GET" });
      state.session.loggedIn = !!st?.loggedIn;
      state.session.email = st?.email || null;
      state.session.username = st?.username || null;

      if (el.sessionPill) {
        el.sessionPill.textContent = state.session.loggedIn ? "Session: logged in" : "Session: logged out";
        el.sessionPill.classList.toggle("on", state.session.loggedIn);
      }
    } catch (e) {
      // If status fails, show logged out but keep UI usable
      state.session.loggedIn = false;
      if (el.sessionPill) {
        el.sessionPill.textContent = "Session: logged out";
        el.sessionPill.classList.remove("on");
      }
    }
  }

  async function doLogin() {
    const username = (el.loginEmail?.value || "").trim(); // this field is "email" in UI, but worker expects username
    const password = (el.loginPass?.value || "").trim();
    if (!username || !password) {
      setStatus("Enter username/email and password.", "warn");
      return;
    }

    setBusy(true);
    setStatus("Logging in…", "info");

    try {
      await apiFetch(CFG.LOGIN_PATH, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setStatus("Done.", "ok");
      await refreshStatus();
    } catch (e) {
      setStatus(`Login failed (${e.status || "?"}).`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    setBusy(true);
    setStatus("Logging out…", "info");
    try {
      await apiFetch(CFG.LOGOUT_PATH, { method: "POST" });
      setStatus("Logged out.", "ok");
      await refreshStatus();
    } catch (e) {
      setStatus(`Logout failed (${e.status || "?"}).`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function doSearch() {
    let q = (el.query?.value || "").trim();
    if (/^\d+$/.test(q)) q = `order #${q}`;
    state.lastQuery = q;

    if (!q) {
      setStatus("Enter a search.", "warn");
      return;
    }

    setBusy(true);
    setStatus("Searching…", "info");

    // Clear output placeholders
    if (el.outCustomer) el.outCustomer.innerHTML = `<div class="empty">—</div>`;
    if (el.outSubs) el.outSubs.innerHTML = `<div class="empty">—</div>`;
    if (el.outOrders) el.outOrders.innerHTML = `<div class="empty">—</div>`;
    if (el.outJson) el.outJson.textContent = "";

    try {
      const payload = await apiFetch(CFG.NL_SEARCH_PATH, {
        method: "POST",
        body: JSON.stringify({ query: q }),
      });

      state.lastRaw = payload;
      renderBundle(payload?.context || {}, payload);

      setStatus("Done.", "ok");
    } catch (e) {
      setStatus(`Search failed (${e.status || "?"}).`, "err");
      if (el.outJson) {
        const pruned = pruneRedacted(e.body || { error: e.message || "error" });
        el.outJson.textContent = JSON.stringify(pruned, null, 2);
      }
    } finally {
      setBusy(false);
    }
  }

  // =========================
  // Init
  // =========================
  function wire() {
    if (el.btnLogin) el.btnLogin.addEventListener("click", (ev) => { ev.preventDefault(); doLogin(); });
    if (el.btnLogout) el.btnLogout.addEventListener("click", (ev) => { ev.preventDefault(); doLogout(); });
    if (el.btnSearch) el.btnSearch.addEventListener("click", (ev) => { ev.preventDefault(); doSearch(); });

    if (el.loginPass) {
      el.loginPass.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }
    if (el.query) {
      el.query.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }
  }

  async function boot() {
    wire();
    await refreshStatus();
  }

  boot();
})();

// 🔴 main.js
// 🔴 main.js — end full file replacement