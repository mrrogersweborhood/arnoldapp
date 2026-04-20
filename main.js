// 🟢 main.js
var openSubNotes = window.openSubNotes || new Set();
var openOrderNotes = window.openOrderNotes || new Set();
window.openSubNotes = openSubNotes;
window.openOrderNotes = openOrderNotes;
window.WOO_ADMIN = window.WOO_ADMIN || "https://okobserver.org/wp-admin/post.php";

// Arnold Admin — FULL REPLACEMENT (Build 2026-03-17R1 — Pulse Dashboard Entry + SaaS Render)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

    const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const PULSE_WORKER_BASE = "https://pulse-worker.bob-b5c.workers.dev";
  const SEARCH_WORKER_BASE = PULSE_WORKER_BASE;
  const RADAR_WORKER_BASE = WORKER_BASE;
  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------
  // Session / view state
  // --------------------------------------------------
    let lastMode = null; // 'search' | 'totals' | 'radar' | 'pulse' | 'stores'
  let lastPayload = null;
  let lastRaw = null;
  let rawVisible = false;

  let currentSearchController = null;
  let lastCustomerResult = null;
  let radarPage = 1;
  let radarIssueFilter = "";
  let radarLoadingTimer = null;
  let radarLoadingIndex = 0;

  const RADAR_LOADING_MESSAGES = [
    "Loading support radar…",
    "Scanning failed renewals…",
    "Checking on-hold subscriptions…",
    "Reviewing pending cancellations…",
    "Comparing active subscription recoveries…",
    "Prioritizing repeat problem subscribers…",
    "Preparing radar page…"
  ];
  // --------------------------------------------------
  // Status / UI helpers
  // --------------------------------------------------
  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = friendlyText(text ?? "");
  }
  function updateRadarStatus(data) {
    const banner = $("radarStatusBanner");
    const textEl = $("radarStatusText");
    const metaEl = $("radarStatusMeta");

    if (!banner || !textEl || !metaEl) return;

    banner.classList.remove(
      "aa-radar-status-healthy",
      "aa-radar-status-warning",
      "aa-radar-status-incident"
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const actionableCount = Number(data?.total_actionable_items || items.length || 0) || 0;

    const hasGatewaySignal = items.some((item) => {
      const reason = String(item?.reason || "").toUpperCase();
      const issue = String(item?.issue || "").toLowerCase();
      const action = String(item?.action || "").toLowerCase();

      return (
        reason.includes("SQUARE") ||
        reason.includes("AUTH") ||
        reason.includes("3D") ||
        action.includes("gateway") ||
        issue.includes("gateway")
      );
    });

    const recentFailures = items.filter((item) => {
      const issue = String(item?.issue || "").toLowerCase();
      return (
        issue.includes("failed") ||
        issue.includes("hold") ||
        issue.includes("cancel") ||
        issue.includes("expired")
      );
    }).length;

    if (hasGatewaySignal) {
      banner.classList.add("aa-radar-status-incident");
      textEl.textContent = "Gateway Incident Suspected";
      metaEl.textContent = "Gateway-related payment failures detected in recent Radar results.";
      return;
    }

    if (actionableCount >= 8 || recentFailures >= 5) {
      banner.classList.add("aa-radar-status-warning");
      textEl.textContent = "Elevated Failures";
      metaEl.textContent = "Recent payment failures are above the normal baseline.";
      return;
    }

    banner.classList.add("aa-radar-status-healthy");
    textEl.textContent = "Healthy";
    metaEl.textContent = "No unusual payment failure patterns detected.";
  }

  function stopRadarLoadingUI() {
    if (radarLoadingTimer) {
      window.clearInterval(radarLoadingTimer);
      radarLoadingTimer = null;
    }

    const sl = $("statusLine");
    if (!sl) return;
    sl.classList.remove("aa-status-center");
    sl.innerHTML = "";
  }

  function setRadarLoadingStatus(text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg busy aa-status-center";
    sl.innerHTML = `
      <span class="aa-inline-spinner" aria-hidden="true"></span>
      <span class="aa-status-center-text">${esc(friendlyText(text ?? ""))}</span>
    `;
  }

  function renderRadarLoadingShell() {
    return `
      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Radar</div>
          <div class="aa-section-subtitle">Preparing subscriber issues and paging…</div>
        </div>

        <div class="aa-radar-summary">
          <div class="aa-radar-tile aa-radar-tile-problem"><div class="aa-loading-row" style="width:120px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
          <div class="aa-radar-tile aa-radar-tile-watch"><div class="aa-loading-row" style="width:80px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
          <div class="aa-radar-tile aa-radar-tile-watch"><div class="aa-loading-row" style="width:110px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
        </div>

        <div class="aa-radar-repeat-subscribers" style="margin-top:12px; margin-bottom:12px">
          <div class="aa-loading-row" style="width:220px"></div>
        </div>

        <div class="aa-table-wrap">
          <table class="aa-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Issue</th>
                <th>Reason</th>
                <th>Dates</th>
                <th>Subscriber</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:110px"></div></td>
                <td><div class="aa-loading-row" style="width:130px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:150px"></div></td>
                <td><div class="aa-loading-row" style="width:180px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:100px"></div></td>
                <td><div class="aa-loading-row" style="width:120px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:140px"></div></td>
                <td><div class="aa-loading-row" style="width:170px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:95px"></div></td>
                <td><div class="aa-loading-row" style="width:140px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:145px"></div></td>
                <td><div class="aa-loading-row" style="width:175px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:105px"></div></td>
                <td><div class="aa-loading-row" style="width:125px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:150px"></div></td>
                <td><div class="aa-loading-row" style="width:180px"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function startRadarLoadingUI() {
    stopRadarLoadingUI();

    radarLoadingIndex = 0;

    const tick = () => {
      const msg = RADAR_LOADING_MESSAGES[radarLoadingIndex % RADAR_LOADING_MESSAGES.length];
      const pageSuffix = radarPage > 1 ? ` (page ${radarPage})` : "";
      setRadarLoadingStatus(msg + pageSuffix);
      radarLoadingIndex += 1;
    };

    tick();
    radarLoadingTimer = window.setInterval(tick, 900);

    const results = $("results");
    if (results) {
      results.innerHTML = renderRadarLoadingShell();
    }
  }
  function applyLoginUserMask(isLoggedIn) {
    const u = $("loginUser");
    if (!u) return;
    const hasValue = !!String(u.value || "").trim();

    if (isLoggedIn && hasValue) {
      if (u.type !== "password") u.type = "password";
      return;
    }

    if (u.type !== "text") u.type = "text";
  }

  function setSessionPill(isLoggedIn, name) {
    const pill = $("sessionPill");
    const txt = $("sessionText");
    if (!pill || !txt) return;

    if (isLoggedIn) {
      pill.classList.add("ok");
      txt.textContent = `Connected as ${name || "Admin"}`;
    } else {
      pill.classList.remove("ok");
      txt.textContent = "Session: unknown";
    }

    applyLoginUserMask(!!isLoggedIn);
  }

function toggleLoginSearchUI(isLoggedIn) {
    const login = $("loginFields");
    const search = $("searchFields");
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");
    const btnLogout2 = $("btnLogout2");
    const sessionActions = $("sessionActions");

    if (login) login.style.display = isLoggedIn ? "none" : "grid";
    if (search) search.style.display = isLoggedIn ? "grid" : "none";

    if (btnLogin) btnLogin.style.display = isLoggedIn ? "none" : "";

    // 🟢 FIX: ensure logout is NOT tied to loginFields visibility
    if (sessionActions) {
      sessionActions.style.display = isLoggedIn ? "flex" : "none";
    }

    if (btnLogout) btnLogout.style.display = isLoggedIn ? "" : "none";
    if (btnLogout2) btnLogout2.style.display = isLoggedIn ? "" : "none";
  }
  function setLoggedOutLanding(isLoggedIn) {
    const idsToToggle = [
      "radarStatusBanner",
      "radarHeroMetrics",
      "radarKpiBand",
      "radarRecoveryOpps",
      "results",
      "btnRawJson"
    ];

    idsToToggle.forEach((id) => {
      const el = $(id);
      if (!el) return;

      if (isLoggedIn) {
        el.classList.remove("is-hidden");
        el.style.display = "";
      } else {
        el.classList.add("is-hidden");
        el.style.display = "none";
      }
    });
  }
let sessionCache = null;

async function refreshSession(options = {}) {
  const force = options === true || options?.force === true;

  // ✅ prevent overlapping calls unless we are explicitly forcing a re-check
  if (!force && sessionCache) return sessionCache;

  const run = (async () => {
    try {
      const r = await fetch(`${PULSE_WORKER_BASE}/admin/status`, {
        method: "GET",
        credentials: "include"
      });

      if (!r.ok) throw new Error("status not ok");

      const j = await r.json().catch(() => null);
      const loggedIn = !!j?.loggedIn;

      if (loggedIn) {
        setSessionPill(true, j?.user?.name || j?.user?.display_name || "Admin");
        toggleLoginSearchUI(true);
        setLoggedOutLanding(true);
        return true;
      }

      setSessionPill(false, null);
      toggleLoginSearchUI(false);
      setLoggedOutLanding(false);
      setDashboardChrome("search");

      const results = $("results");
      if (results) results.innerHTML = "";

      return false;

    } catch (err) {
      console.warn("refreshSession failed", err);

      // ✅ on an explicit forced auth re-check, fail closed and reset the UI
      if (force) {
        setSessionPill(false, null);
        toggleLoginSearchUI(false);
        setLoggedOutLanding(false);
        setDashboardChrome("search");

        const results = $("results");
        if (results) results.innerHTML = "";
      }

      return false;

    } finally {
      if (!force) {
        setTimeout(() => { sessionCache = null; }, 2000);
      }
    }
  })();

  if (!force) {
    sessionCache = run;
  }

  return run;
}


    function setDashboardChrome(view) {
  const isPulse = view === "pulse";
  const isRadar = view === "radar";
  const isStores = view === "stores";

  const banner = $("radarStatusBanner");
  const hero = $("radarHeroMetrics");
  const kpi = $("radarKpiBand");
  const opps = $("radarRecoveryOpps");
  const results = $("results");
  const storeManagerView = $("storeManagerView");

  if (banner) banner.classList.toggle("is-hidden", !isRadar);
  if (hero) hero.classList.toggle("is-hidden", true);
  if (kpi) kpi.classList.toggle("is-hidden", true);
  if (opps) opps.classList.toggle("is-hidden", true);

  if (results) {
    results.classList.toggle("is-hidden", isStores);
    results.style.display = isStores ? "none" : "";
  }

  if (storeManagerView) {
    storeManagerView.classList.toggle("is-hidden", !isStores);
    storeManagerView.style.display = isStores ? "" : "none";
  }

  const navRadar = $("navRadar");
  const navPulse = $("navPulse");
  const navStores = $("navStores");

  navRadar?.classList.toggle("is-active", isRadar);
  navPulse?.classList.toggle("is-active", isPulse);
  navStores?.classList.toggle("is-active", isStores);

  const statusLine = $("statusLine");
  const rawBtn = $("btnRawJson");

  if (statusLine) {
    statusLine.style.display = (isPulse || isStores) ? "none" : "";
  }

  if (rawBtn) {
    rawBtn.style.display = (isPulse || isStores) ? "none" : "";
  }
}
    // --------------------------------------------------
  // Pulse renderer contract
  // --------------------------------------------------
  function renderPulseShellSafe() {
    if (typeof window.renderPulseShell === "function") {
      return window.renderPulseShell();
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Pulse Revenue Intelligence</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderPulseShell is not available.</div>
      </section>
    `;
  }

  function renderPulseLoadingShellSafe() {
    if (typeof window.renderPulseLoadingShell === "function") {
      return window.renderPulseLoadingShell();
    }

    return renderPulseShellSafe();
  }

  function buildPulseViewModelSafe(analysis, summary, options = {}) {
    if (typeof window.buildPulseViewModel === "function") {
      return window.buildPulseViewModel(analysis, summary, options);
    }

    return {
      actionOutcomeBanner: "",
      incidentStrip: "",
      heroSection: "",
      gatewaySection: "",
      reasonsSection: "",
      repeatOffendersSection: "",
      lastScanSection: ""
    };
  }

  function ensurePulseShellMounted() {
    const results = $("results");
    if (!results) return false;

    if (!results.querySelector("#pulse-shell")) {
      results.innerHTML = renderPulseShellSafe();
    }

    results.dataset.pulseShellMounted = "true";
    results.dataset.loaded = "true";
    return true;
  }

  // 🆕 Pulse inline affected customers state
  window.__pulseAffectedCustomers = null;
  window.__pulseAffectedGateway = null;

  window.setPulseAffectedCustomers = function (gateway, data) {
    const gatewayKey = String(gateway || "").trim().toLowerCase();

    window.__pulseExpandedGateways = window.__pulseExpandedGateways || {};
    window.__pulseExpandedGateways[gatewayKey] = true;
setTimeout(() => {
  const el = document.querySelector(`[data-gateway="${gatewayKey}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}, 50);
    window.__pulseAffectedGateway = gatewayKey;
    window.__pulseAffectedCustomers = Array.isArray(data?.customers) ? data.customers : [];

    if (window.__pulseLastAnalysis && typeof window.updatePulseView === "function") {
      window.updatePulseView(
        buildPulseViewModelSafe(window.__pulseLastAnalysis, window.__pulseLastSummary || null)
      );
      return;
    }

    if (typeof window.doPulseDashboard === "function") {
      window.doPulseDashboard();
    }
  };

  function renderPulseDashboardSafe(analysis, summary, options = {}) {
    return buildPulseViewModelSafe(analysis, summary, options);
  }

  function fadeReplaceResults(html) {
    const results = $("results");
    if (!results) return;

    // 🟢 LOCK HEIGHT BEFORE CHANGE (CRITICAL FIX)
    const prevHeight = results.offsetHeight;
    if (prevHeight > 0) {
      results.style.minHeight = prevHeight + "px";
    }

    results.style.opacity = "1";
    results.style.transform = "translateY(0)";
    results.style.transition = "";

    // 🔁 REPLACE CONTENT
    results.innerHTML = html;
    results.dataset.loaded = "true";

    // 🟢 RELEASE HEIGHT AFTER PAINT
    requestAnimationFrame(() => {
      results.style.minHeight = "";
    });
  }

  // 🔴 SINGLE RENDER PIPELINE (HYDRATION ONLY FOR PULSE)
  window.updatePulseView = function (viewModel) {
    if (typeof viewModel === "string") {
      console.warn("Ignoring legacy Pulse HTML payload");
      return;
    }

    if (!ensurePulseShellMounted()) return;

    if (typeof window.hydratePulseView === "function") {
      window.hydratePulseView(viewModel || {});
    }
  };
function renderStoresLoadingShellSafe() {
    if (typeof window.renderStoresLoadingShell === "function") {
      return window.renderStoresLoadingShell();
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Store Manager</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderStoresLoadingShell is not available.</div>
      </section>
    `;
  }

  function renderStoresDashboardSafe(payload) {
    if (typeof window.renderStoresDashboard === "function") {
      return window.renderStoresDashboard(payload);
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Store Manager</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderStoresDashboard is not available.</div>
      </section>
    `;
  }


  // --------------------------------------------------
  // Raw JSON viewer
  // --------------------------------------------------
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
    box.textContent = JSON.stringify(scrubMetaData(lastRaw), null, 2);
  }

  function toggleRawJson() {
    rawVisible = !rawVisible;
    renderRawJson();
  }

  // --------------------------------------------------
  // Search state helpers
  // --------------------------------------------------
  function abortActiveSearch() {
    if (currentSearchController) {
      try {
        currentSearchController.abort();
      } catch (_) {}
    }
    currentSearchController = null;
  }

  function cacheLastCustomerFromPayload(payload) {
    const customer = payload?.context?.customer || payload?.customer || null;
    if (customer) {
      lastCustomerResult = customer;
    }
  }

  function isLikelyEmailLookupQuery(q) {
    const s = String(q ?? "").trim();
    if (!s) return false;
    if (/(?:\border\s*#?\s*)(\d{3,})\b/i.test(s) || /^#?(\d{3,})$/.test(s)) return false;
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s);
  }
function parseDirectLookupQuery(q) {

  const s = String(q ?? "").trim().toLowerCase();

  // order lookup
  let m = s.match(/^order\s*#?\s*(\d+)$/);
  if (m) return { type: "order", id: m[1] };

  // #12345
  m = s.match(/^#(\d+)$/);
  if (m) return { type: "order", id: m[1] };

  // customer lookup
  m = s.match(/^customer\s*#?\s*(\d+)$/);
  if (m) return { type: "customer", id: m[1] };

  // subscription lookup
  m = s.match(/^sub\s*#?\s*(\d+)$/);
  if (m) return { type: "subscription", id: m[1] };

  return null;
}
function getCachedCustomerShellPayloadForQuery(q) {
  const s = String(q ?? "").trim().toLowerCase();
  if (!s || !lastCustomerResult) return null;

  const email = String(
    lastCustomerResult?.email ||
    lastCustomerResult?.billing?.email ||
    ""
  ).trim().toLowerCase();

  const id = String(lastCustomerResult?.id ?? "").trim().toLowerCase();
  const username = String(lastCustomerResult?.username ?? "").trim().toLowerCase();
  const fullName = [
    lastCustomerResult?.first_name,
    lastCustomerResult?.last_name
  ].map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean).join(" ");

  const matches =
    (email && s === email) ||
    (id && (s === id || s === `#${id}` || s === `customer #${id}`)) ||
    (username && s === username) ||
    (fullName && s === fullName);

  if (!matches) return null;

  return {
    ok: true,
    context: {
      customer: lastCustomerResult,
      subscriptions: [],
      orders: [],
      notes: []
    }
  };
}
  // --------------------------------------------------
  // Event binding helpers
  // --------------------------------------------------
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
          btn.innerHTML = ok ? 'Copied <span aria-hidden="true">✓</span>' : "Copy failed";
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

  function bindNotesToggles(container) {
    if (!container) return;

    container.querySelectorAll(".aa-notes-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const kind = btn.getAttribute("data-kind");
        const id = btn.getAttribute("data-id");
        if (!kind || !id) return;

        const set = kind === "sub" ? openSubNotes : openOrderNotes;
        if (set.has(id)) set.delete(id);
        else set.add(id);

        if (lastMode === "search" && lastPayload) {
          const results = $("results");
          if (!results) return;
          results.innerHTML = renderResults(lastPayload);
          bindNotesToggles(results);
          bindCopyButtons(results);
          bindOpenCandidateButtons(results);
        }
      });
    });
  }

  function bindOpenCandidateButtons(container) {
    if (!container) return;

    container.querySelectorAll(".aa-candidate-open-btn[data-open-query]").forEach((btn) => {
btn.addEventListener("click", async () => {
  const query = String(btn.getAttribute("data-open-query") || "").trim();
  if (!query) return;

  const qEl = $("query");
  if (qEl) qEl.value = query;

  // 🔒 prevent race conditions
  abortActiveSearch();

  // 🔥 run ONE controlled search
  setTimeout(() => {
    doSearch(query).catch(console.error);
  }, 0);
});
    });
  }

  // --------------------------------------------------
  // Render helpers
  // --------------------------------------------------
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
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .join(" ") || "—";
      const email = String(c?.email ?? "").trim() || "—";
      const idRaw = c?.id != null && String(c.id).trim() ? String(c.id).trim() : "";
      const id = idRaw ? `#${idRaw}` : "—";
      const openValue = email !== "—" ? email : (idRaw ? `customer #${idRaw}` : "");
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
    }).join("");

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

  function renderProgressiveShell(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer && typeof window.renderCustomerCard === "function"
      ? window.renderCustomerCard(customer)
      : "";

    const billingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Billing", billing)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", shipping)
      : "";

    return `
      ${customerCard}

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Addresses</div>
          <div class="aa-section-subtitle">Billing and shipping details</div>
        </div>
        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading subscriptions</div>
          <div class="aa-section-subtitle">Pulling subscription records for this customer</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading orders</div>
          <div class="aa-section-subtitle">Fetching recent order history</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>
    `;
  }

  function renderTotals(payload) {
    const totals = payload?.totals || {};
    const all = totals?.all || {};
    const wc = totals?.subscriptions || {};
    const sus = totals?.orders || {};

    const subRows = [
      ["Active", wc.active],
      ["On hold", wc.on_hold],
      ["Pending cancel", wc.pending_cancel],
      ["Expired", wc.expired],
      ["Cancelled", wc.cancelled],
      ["Pending", wc.pending]
    ];

    const orderRows = [
      ["Completed", sus.completed],
      ["Processing", sus.processing],
      ["Pending", sus.pending],
      ["On hold", sus.on_hold],
      ["Cancelled", sus.cancelled],
      ["Failed", sus.failed],
      ["Refunded", sus.refunded]
    ];

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Store Totals</div>
          <div class="aa-section-subtitle">Subscription and order counts for the store</div>
        </div>

        <div class="aa-totals-grid">
          <div class="card aa-card aa-totals-card">
            <div class="aa-card-title">Subscriptions</div>
            <table class="aa-totals-table">
              <tbody>
                ${subRows.map(([label, value]) => `
                  <tr>
                    <td>${esc(label)}</td>
                    <td class="aa-num">${esc(formatCount(value))}</td>
                  </tr>
                `).join("")}
                <tr class="aa-totals-divider"><td colspan="2"></td></tr>
                <tr class="aa-totals-total">
                  <td><strong>Total</strong></td>
                  <td class="aa-num"><strong>${esc(formatCount(all.subscriptions))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card aa-card aa-totals-card">
            <div class="aa-card-title">Orders</div>
            <table class="aa-totals-table">
              <tbody>
                ${orderRows.map(([label, value]) => `
                  <tr>
                    <td>${esc(label)}</td>
                    <td class="aa-num">${esc(formatCount(value))}</td>
                  </tr>
                `).join("")}
                <tr class="aa-totals-divider"><td colspan="2"></td></tr>
                <tr class="aa-totals-total">
                  <td><strong>Total</strong></td>
                  <td class="aa-num"><strong>${esc(formatCount(all.orders))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderResults(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subscriptions = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];
    const notes = Array.isArray(ctx.notes) ? ctx.notes : [];

    if (payload?.possible_matches?.length) {
      return renderCandidateMatches(payload);
    }

        if (!customer && orders.length) {
      const orderRows = orders.map((order) => {
        const orderId = order?.id != null ? `#${String(order.id)}` : "—";
        const status = String(order?.status ?? "—");
        const total = String(order?.total ?? "—");
        const currency = String(order?.currency ?? "");
        const dateCreated = String(order?.date_created ?? "—");
        const billingName = [
          order?.billing?.first_name,
          order?.billing?.last_name
        ].map((v) => String(v ?? "").trim()).filter(Boolean).join(" ") || "—";
        const billingEmail = String(order?.billing?.email ?? "").trim() || "—";
        const paymentMethod = String(order?.payment_method_title ?? order?.payment_method ?? "—");

        return `
          <tr>
            <td>${esc(orderId)}</td>
            <td>${esc(status)}</td>
            <td>${esc(currency ? `${total} ${currency}` : total)}</td>
            <td>${esc(dateCreated)}</td>
            <td>${esc(billingName)}</td>
            <td>${esc(billingEmail)}</td>
            <td>${esc(paymentMethod)}</td>
          </tr>
        `;
      }).join("");

      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Order Result</div>
            <div class="aa-section-subtitle">Order found without customer context</div>
          </div>

          <div class="aa-table-wrap">
            <table class="aa-table" style="min-width:960px;">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date Created</th>
                  <th>Billing Name</th>
                  <th>Billing Email</th>
                  <th>Payment Method</th>
                </tr>
              </thead>
              <tbody>
                ${orderRows}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

        

    if (!customer) {
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Search Result</div>
            <div class="aa-section-subtitle">No customer context was returned</div>
          </div>
          <div class="aa-muted">No customer found.</div>
        </section>
      `;
    }

    const healthCard = typeof window.renderSubscriptionHealthSummary === "function"
      ? window.renderSubscriptionHealthSummary(customer, subscriptions, orders)
      : "";

    const activityCard = typeof window.renderCustomerActivity === "function"
      ? window.renderCustomerActivity(customer, subscriptions, orders)
      : "";

    if (typeof window.renderCustomerPage === "function") {
      return window.renderCustomerPage({
        customer,
        subscriptions,
        orders,
        activityHTML: activityCard,
        healthHTML: healthCard
      });
    }

    const customerCard = typeof window.renderCustomerCard === "function"
      ? window.renderCustomerCard(customer)
      : "";

    const billingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Billing", customer?.billing)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", customer?.shipping)
      : "";

    return `
      ${customerCard}

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Addresses</div>
          <div class="aa-section-subtitle">Billing and shipping details</div>
        </div>
        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      ${healthCard}
      ${activityCard}
    `;
  }
// --------------------------------------------------
  // Radar render
  // --------------------------------------------------
  function renderRadar(payload) {
    if (typeof window.renderRadarResults === "function") {
      return window.renderRadarResults(payload, {
        radarPage,
        radarIssueFilter
      });
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Radar</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderRadarResults is not available.</div>
      </section>
    `;
  }

  // --------------------------------------------------
  // Fetch actions
  // --------------------------------------------------
  async function doLogin() {
    abortActiveSearch();

    const user = String($("loginUser")?.value || "").trim();
    const pass = String($("loginPass")?.value || "").trim();

    if (!user || !pass) {
      setStatus("warn", "Enter username and password.");
      return;
    }

    setStatus("busy aa-status-center", "");
    const sl = $("statusLine");
    if (sl) {
      sl.innerHTML = `
        <span class="aa-inline-spinner" aria-hidden="true"></span>
        <span class="aa-status-center-text">Logging in…</span>
      `;
    }

    const r = await fetch(`${PULSE_WORKER_BASE}/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass })
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.success) {
      setSessionPill(false, null);
      toggleLoginSearchUI(false);
      setStatus("warn", friendlyText(j?.message || j?.error || "Login failed."));
      return;
    }

    setSessionPill(true, j?.user?.name || j?.user?.display_name || "Admin");
    toggleLoginSearchUI(true);
    setLoggedOutLanding(true);
    setStatus("", "Logged in.");
    await doPulseDashboard();
  }

  async function doLogout() {
    abortActiveSearch();

    try {
      await fetch(`${PULSE_WORKER_BASE}/admin/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (_) {}

    setSessionPill(false, null);
    toggleLoginSearchUI(false);
    setLoggedOutLanding(false);
    setStatus("", "Logged out.");

    const results = $("results");
    if (results) results.innerHTML = "";
    lastPayload = null;
    lastRaw = null;
    renderRawJson();
  }

  async function doSearch(searchOverride) {
    abortActiveSearch();

    const q =
      typeof searchOverride === "string"
        ? String(searchOverride).trim()
        : String($("query")?.value || "").trim();

    if (!q) {
      setStatus("warn", "Enter a search query.");
      return;
    }

    currentSearchController = new AbortController();
    const signal = currentSearchController.signal;

    lastMode = "search";
    setDashboardChrome("search");
    setStatus("busy aa-status-center", "");
    const sl = $("statusLine");
    if (sl) {
      sl.innerHTML = `
        <span class="aa-inline-spinner" aria-hidden="true"></span>
        <span class="aa-status-center-text">Searching…</span>
      `;
    }

    const results = $("results");
    if (results) {
      results.innerHTML = "";
    }

    const cachedShell = isLikelyEmailLookupQuery(q) ? getCachedCustomerShellPayloadForQuery(q) : null;
    if (results && cachedShell) {
      results.innerHTML = renderProgressiveShell(cachedShell);
      bindNotesToggles(results);
      bindCopyButtons(results);
      bindOpenCandidateButtons(results);
    }

    try {
      const direct = parseDirectLookupQuery(q);

            const normalizedQuery =
        direct?.type === "order" ||
        direct?.type === "customer" ||
        direct?.type === "subscription"
          ? String(direct.id)
          : q;

           const r = await fetch(`https://pulse-worker.bob-b5c.workers.dev/admin/nl-search`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: normalizedQuery
        }),
        signal
      });

      const j = await r.json().catch(() => null);

      if (signal.aborted) return;

      if (!r.ok || !j?.ok) {
        const errorText =
          typeof j?.error === "string"
            ? j.error
            : typeof j?.message === "string"
              ? j.message
              : r.status === 404
                ? "Search target not found."
                : "Search failed.";

        const authFailure =
          r.status === 401 ||
          r.status === 403 ||
          errorText === "Not logged in" ||
          errorText === "Invalid session" ||
          errorText === "Admin required";

        if (authFailure) {
          await refreshSession({ force: true });
          setStatus("warn", "Session expired. Please log in again.");
          return;
        }

        setStatus("warn", friendlyText(errorText));
        if (results && !cachedShell) results.innerHTML = "";
        return;
      }

      lastPayload = j;
      lastRaw = j;
      cacheLastCustomerFromPayload(j);

if (results) {
  // ----------------------------
  // ORDER vs CUSTOMER ROUTING (UNIFIED)
  // ----------------------------
  if (j?.intent === "order_by_id" || j?.order_id) {
    const order = j?.order || j?.context?.order || null;

    results.innerHTML = renderResults({
      ...j,
      context: {
        ...(j?.context || {}),
        orders: order ? [order] : []
      }
    });
  } else {
    results.innerHTML = renderResults(j);
  }

  bindNotesToggles(results);
  bindCopyButtons(results);
  bindOpenCandidateButtons(results);
}

      setStatus("", "Search complete.");
      renderRawJson();
    } catch (err) {
      if (signal.aborted) return;
      setStatus("warn", friendlyText(err?.message || "Search failed."));
      if (results && !cachedShell) results.innerHTML = "";
    } finally {
      if (currentSearchController?.signal === signal) {
        currentSearchController = null;
      }
    }
  }



  async function doRadar(page = 1, issue = "") {
    abortActiveSearch();
    radarPage = page;
    radarIssueFilter = issue || "";
    lastMode = "radar";
    setDashboardChrome("radar");
    startRadarLoadingUI();

    try {
      const params = new URLSearchParams();
      params.set("page", String(radarPage));
      if (radarIssueFilter) params.set("issue", radarIssueFilter);

            const r = await fetch(`${RADAR_WORKER_BASE}/admin/radar?${params.toString()}`, {
        method: "GET",
        credentials: "include"
      });
      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        stopRadarLoadingUI();
        setStatus("warn", friendlyText(j?.error || "Radar failed."));
        return;
      }

      lastPayload = j;
      lastRaw = j;

      const results = $("results");
      if (results) {
        results.innerHTML = renderRadar(j);
        bindNotesToggles(results);
        bindCopyButtons(results);
        bindOpenCandidateButtons(results);

        results.querySelectorAll("[data-radar-page]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const next = Number(btn.getAttribute("data-radar-page") || "1") || 1;
            doRadar(next, radarIssueFilter).catch(console.error);
          });
        });

        results.querySelectorAll("[data-radar-issue]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const nextIssue = String(btn.getAttribute("data-radar-issue") || "");
            radarPage = 1;
            doRadar(1, nextIssue).catch(console.error);
          });
        });
      }

      updateRadarStatus(j);
      stopRadarLoadingUI();
      setStatus("", "Radar loaded.");
      renderRawJson();
    } catch (err) {
      stopRadarLoadingUI();
      setStatus("warn", friendlyText(err?.message || "Radar failed."));
    }
  }

    async function doStoreManager() {
    abortActiveSearch();
    lastMode = "stores";
    setDashboardChrome("stores");

    const storeManagerView = $("storeManagerView");
    if (storeManagerView) {
      storeManagerView.innerHTML = renderStoresLoadingShellSafe();
    }

try {
  const storesRes = await fetch(`${PULSE_WORKER_BASE}/stores`, { method: "GET", credentials: "include" });
  const storesJson = await storesRes.json().catch(() => null);

      if (!storesRes.ok || !storesJson?.ok) {
        const errorHtml = `
          <section class="card aa-section">
            <div class="aa-section-head">
              <div class="aa-section-title">Store Manager</div>
              <div class="aa-section-subtitle">Stores endpoint failed</div>
            </div>
            <div class="aa-muted">${esc(friendlyText(storesJson?.error || "Stores failed."))}</div>
          </section>
        `;
        if (storeManagerView) {
          storeManagerView.innerHTML = errorHtml;
        }
        return;
      }

           lastPayload = {
        ok: true,
        stores: storesJson
      };
      lastRaw = lastPayload;
      window.__storeManagerPayload = storesJson;
      populateActiveStoreSelect(storesJson?.stores || []);
// 🟢 set default active store if none selected
if (!window.__activeStoreId && Array.isArray(storesJson?.stores) && storesJson.stores.length) {
  const firstStore = storesJson.stores[0];
  if (firstStore?.store_id) {
    window.setActiveStore(firstStore.store_id);
  }
}
      if (storeManagerView) {
        if (window.__storeManagerMode === "edit" || window.__storeManagerMode === "create") {
          storeManagerView.innerHTML = (
            typeof window.renderStoreEditorView === "function"
              ? window.renderStoreEditorView(window.__storeManagerMode, window.__storeManagerEditingStore)
              : renderStoresDashboardSafe(storesJson)
          );
          bindStoreEditorControls();
        } else {
          storeManagerView.innerHTML = renderStoresDashboardSafe(storesJson);
        }
      }
    } catch (err) {
      const errorHtml = `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Store Manager</div>
            <div class="aa-section-subtitle">Request failed</div>
          </div>
          <div class="aa-muted">${esc(friendlyText(err?.message || "Store manager failed."))}</div>
        </section>
      `;
      if ($("storeManagerView")) {
        $("storeManagerView").innerHTML = errorHtml;
      }
    }
  }

        async function doPulseDashboard() {
      abortActiveSearch();
      lastMode = "pulse";
      setDashboardChrome("pulse");
      setStatus("busy aa-status-center", "");

      const sl = $("statusLine");
      if (sl) {
        sl.className = "msg";
        sl.textContent = "";
        sl.innerHTML = "";
      }

      const results = $("results");

      // 🟢 STEP 1 — MOUNT STABLE SHELL + HYDRATE LOADING STATE
      if (results && ensurePulseShellMounted()) {
        window.updatePulseView(
          renderPulseDashboardSafe(null, null, { isLoading: true })
        );
      }

try {
        const [analysisRes, summaryRes, automationRes, scanRes] = await Promise.all([
          fetch(`${PULSE_WORKER_BASE}/pulse/failure-analysis`, { method: "GET" }),
          fetch(`${PULSE_WORKER_BASE}/pulse/summary`, { method: "GET" }),
          fetch(`${PULSE_WORKER_BASE}/pulse/automation-history`, { method: "GET" }),
          fetch(`${PULSE_WORKER_BASE}/scanner/runs/latest`, { method: "GET" })
        ]);

        const analysisJson = await analysisRes.json().catch(() => null);
        const summaryJson = await summaryRes.json().catch(() => null);
        const automationJson = await automationRes.json().catch(() => null);
        const scanJson = await scanRes.json().catch(() => null);

        if (!analysisRes.ok || !analysisJson?.ok) {
          setStatus("warn", friendlyText(analysisJson?.error || "Pulse analysis failed."));
          return;
        }

        if (!summaryRes.ok || !summaryJson?.ok) {
          setStatus("warn", friendlyText(summaryJson?.error || "Pulse summary failed."));
          return;
        }

        window.__pulseLatestScan = scanJson?.ok ? scanJson.run : null;

        lastPayload = {
          ok: true,
          pulse: {
            analysis: analysisJson,
            summary: summaryJson,
            automation: automationJson,
            latest_scan: window.__pulseLatestScan
          }
        };
        lastRaw = lastPayload;

         if (results) {
          results.dataset.pulseInitialized = "true";

          // 🟢 STEP 2 — HYDRATE EXISTING PULSE SHELL IN PLACE
          window.updatePulseView(
            renderPulseDashboardSafe(analysisJson, summaryJson, {
              automation: {
                rows: Array.isArray(automationJson?.events)
                  ? automationJson.events
                  : []
              }
            })
          );
        }

// 🟢 HARD RESET STATUS LINE (fix favicon/spinner hang)
const sl = $("statusLine");
if (sl) {
  sl.className = "msg";
  sl.textContent = "";
  sl.innerHTML = "";
}

// 🟢 ALSO CLEAR ANY GLOBAL LOADING FLAGS (defensive)
document.body.classList.remove("loading");

renderRawJson();
} catch (err) {
  const sl = $("statusLine");
  if (sl) {
    sl.className = "msg warn";
    sl.textContent = friendlyText(err?.message || "Pulse dashboard failed.");
    sl.innerHTML = sl.textContent;
  }

  document.body.classList.remove("loading");
}
    }
window.loadPulseDashboard = doPulseDashboard;
window.doStoreManager = doStoreManager;
window.doPulseDashboard = doPulseDashboard;
window.doSearch = doSearch;

// 🟢 STORE MANAGER PAGE-EDITOR STATE
window.__storeManagerMode = "list";
window.__storeManagerEditingStore = null;

window.showStoreManagerList = function () {
  window.__storeManagerMode = "list";
  window.__storeManagerEditingStore = null;
  if (typeof window.doStoreManager === "function") {
    return window.doStoreManager();
  }
};

window.showStoreManagerEditor = function (mode, store) {
  const storeManagerView = $("storeManagerView");
  if (!storeManagerView) return;

  const safeMode = String(mode || "create").trim().toLowerCase() === "edit" ? "edit" : "create";
  const safeStore = store && typeof store === "object" ? store : null;

  window.__storeManagerMode = safeMode;
  window.__storeManagerEditingStore = safeStore;

  if (typeof window.renderStoreEditorView === "function") {
    storeManagerView.innerHTML = window.renderStoreEditorView(safeMode, safeStore);
    bindStoreEditorControls();
  }
};

// 🟢 ACTIVE STORE STATE (NEW)
window.__activeStoreId = null;

function loadActiveStoreFromStorage() {
  try {
    const saved = localStorage.getItem("pulse_active_store_id");
    if (saved) {
      window.__activeStoreId = saved;
    }
  } catch (_) {}
}

function saveActiveStoreToStorage(storeId) {
  try {
    localStorage.setItem("pulse_active_store_id", storeId);
  } catch (_) {}
}

window.setActiveStore = function (storeId) {
  if (!storeId) return;

  window.__activeStoreId = String(storeId);
  saveActiveStoreToStorage(window.__activeStoreId);
  syncActiveStoreSelect();

  console.log("Active store set:", window.__activeStoreId);

  // 🔁 refresh dashboard safely (no reload)
  if (typeof window.loadPulseDashboard === "function") {
    window.loadPulseDashboard();
  }
};
window.doCustomerSearch = doSearch;
window.doCustomerSearchByEmail = function (email) {
  return doSearch(email);
};
// 🟢 STORE SWITCHER UI

function populateActiveStoreSelect(stores) {
  const select = document.getElementById("activeStoreSelect");
  const pill = document.getElementById("activeStorePill");

  if (!select || !pill) return;

  const rows = Array.isArray(stores) ? stores : [];

  select.innerHTML = `
    <option value="">Select store</option>
    ${rows.map(s => `
      <option value="${s.store_id}">
        ${s.store_name || s.store_id}
      </option>
    `).join("")}
  `;

  pill.classList.toggle("is-hidden", rows.length === 0);

  syncActiveStoreSelect();
}

function syncActiveStoreSelect() {
  const select = document.getElementById("activeStoreSelect");
  if (!select) return;
  select.value = window.__activeStoreId || "";
}

function getStoreEditorPayload() {
  return {
    store_id: String(document.getElementById("storeEditorStoreId")?.value || "").trim(),
    store_name: String(document.getElementById("storeEditorStoreName")?.value || "").trim(),
    store_url: String(document.getElementById("storeEditorStoreUrl")?.value || "").trim(),
    gateway: String(document.getElementById("storeEditorGateway")?.value || "").trim().toLowerCase(),
    execution_mode: String(document.getElementById("storeEditorExecutionMode")?.value || "test").trim().toLowerCase(),
    timezone: String(document.getElementById("storeEditorTimezone")?.value || "UTC").trim() || "UTC",
    gateway_activity_window_hours: Number(document.getElementById("storeEditorGatewayWindow")?.value || 0) || 0,
    allow_order_note_writes: document.getElementById("storeEditorAllowOrderNoteWrites")?.checked ? 1 : 0,
    brand_color: String(
      document.getElementById("storeEditorBrandColorHex")?.value ||
      document.getElementById("storeEditorBrandColor")?.value ||
      "#A855F7"
    ).trim()
  };
}

function validateStoreEditorPayload(payload) {
  if (!payload.store_id) return "Store ID is required.";
  if (!payload.store_name) return "Store name is required.";
  if (!payload.store_url) return "Store URL is required.";
  if (!/^https?:\/\//i.test(payload.store_url)) return "Store URL must start with http:// or https://";
  if (!payload.gateway) return "Gateway is required.";
  if (!payload.execution_mode) return "Execution mode is required.";
  if (!payload.timezone) return "Timezone is required.";
  if (!payload.gateway_activity_window_hours) return "Gateway activity window hours is required.";
  if (!/^#([0-9A-Fa-f]{6})$/.test(String(payload.brand_color || "").trim())) {
    return "Brand color must be a valid 6-digit hex value like #A855F7.";
  }
  return "";
}

function bindStoreEditorControls() {
  const backBtn = document.getElementById("btnStoreEditorBack");
  const cancelBtn = document.getElementById("btnStoreEditorCancel");
  const saveBtn = document.getElementById("btnStoreEditorSave");
  const colorInput = document.getElementById("storeEditorBrandColor");
  const hexInput = document.getElementById("storeEditorBrandColorHex");
  const preview = document.getElementById("storeEditorBrandColorPreview");

  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = "true";
    backBtn.addEventListener("click", () => {
      window.showStoreManagerList();
    });
  }

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "true";
    cancelBtn.addEventListener("click", () => {
      window.showStoreManagerList();
    });
  }

  if (colorInput && hexInput && preview && !colorInput.dataset.bound) {
    const syncPreview = (value) => {
      preview.style.background = value;
    };

    colorInput.dataset.bound = "true";

    colorInput.addEventListener("input", function () {
      hexInput.value = colorInput.value;
      syncPreview(colorInput.value);
    });

    hexInput.addEventListener("input", function () {
      const value = String(hexInput.value || "").trim();
      if (/^#([0-9A-Fa-f]{6})$/.test(value)) {
        colorInput.value = value;
        syncPreview(value);
      }
    });

    hexInput.addEventListener("blur", function () {
      const value = String(hexInput.value || "").trim();
      if (!/^#([0-9A-Fa-f]{6})$/.test(value)) {
        hexInput.value = colorInput.value || "#A855F7";
      }
      syncPreview(hexInput.value);
    });

    syncPreview(colorInput.value || "#A855F7");
  }

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "true";
    saveBtn.addEventListener("click", async () => {
      const submitAction = String(saveBtn.getAttribute("data-store-editor-submit") || "").trim();
      const payload = getStoreEditorPayload();
      const validationError = validateStoreEditorPayload(payload);

      if (validationError) {
        setStatus("warn", validationError);
        return;
      }

      const endpoint =
        submitAction === "update"
          ? "https://pulse-worker.bob-b5c.workers.dev/stores/update"
          : "https://pulse-worker.bob-b5c.workers.dev/stores/create";

      const originalLabel = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Processing...";

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        if (!data?.ok) {
          throw new Error(data?.error || "Save store failed.");
        }

        setStatus("", submitAction === "update" ? "Store updated." : "Store created.");
        window.__storeManagerMode = "list";
        window.__storeManagerEditingStore = null;
        await window.doStoreManager();
      } catch (err) {
        setStatus("warn", err?.message || "Save store failed.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
    });
  }
}
  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function friendlyText(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0) || 0);
  }

  // --------------------------------------------------
  // Init / events
  // --------------------------------------------------
  $("btnLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogin().catch(console.error);
  });

  $("btnSearch")?.addEventListener("click", (e) => {
    e.preventDefault();
    doSearch().catch(console.error);
  });



$("btnRadar")?.addEventListener("click", (e) => {
  e.preventDefault();
  doRadar(1, "").catch(console.error);
});

  $("btnPulse")?.addEventListener("click", (e) => {
    e.preventDefault();
    doPulseDashboard().catch(console.error);
  });
$("btnRunScan")?.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    setStatus("busy", "Running scan…");

    const scanRes = await fetch(`${PULSE_WORKER_BASE}/scanner/run`, {
      method: "GET"
    });

    const scanData = await scanRes.json().catch(() => null);

    if (!scanRes.ok || !scanData?.ok) {
      setStatus("warn", friendlyText(scanData?.error || "Scan failed."));
      return;
    }

    const summaryRes = await fetch(`${PULSE_WORKER_BASE}/pulse/summary`, {
      method: "GET"
    });

    const summaryData = await summaryRes.json().catch(() => null);

    if (!summaryRes.ok || !summaryData?.ok) {
      setStatus("warn", friendlyText(summaryData?.error || "Pulse summary failed after scan."));
      return;
    }

    setStatus("", `Scan complete — ${scanData?.scanned || 0} scanned, ${scanData?.incidents_created || 0} incidents created.`);

    try {
      localStorage.setItem("pulse_last_scan", JSON.stringify({
        time: Date.now(),
        processed: Number(scanData?.scanned || 0),
        incidents_created: Number(scanData?.incidents_created || 0),
        incidents_skipped: Number(scanData?.incidents_skipped || 0),
        recoverable: Number(summaryData?.recoverable_revenue || 0),
        failed_total: Number(summaryData?.failed_subscriptions || 0)
      }));
    } catch (_) {}

    await doPulseDashboard();
  } catch (err) {
    console.error(err);
    setStatus("warn", "Scan failed");
  }
});

$("btnLogout")?.addEventListener("click", (e) => {    e.preventDefault();
    doLogout().catch(console.error);
  });

  $("btnLogout2")?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogout().catch(console.error);
  });

  $("btnRawJson")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleRawJson();
  });

  $("loginPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLogin().catch(console.error);
    }
  });

  $("loginUser")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLogin().catch(console.error);
    }
  });

  $("query")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch().catch(console.error);
    }
  });

  $("navRadar")?.addEventListener("click", (e) => {
    e.preventDefault();
    doRadar(1, "").catch(console.error);
  });

$("navPulse")?.addEventListener("click", (e) => {
  e.preventDefault();
  doPulseDashboard().catch(console.error);
});



$("navStores")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.__storeManagerMode = "list";
  window.__storeManagerEditingStore = null;
  doStoreManager().catch(console.error);
});

document.addEventListener("click", (e) => {
  const editBtn = e.target.closest('[data-store-action="edit"]');
  if (!editBtn) return;

  e.preventDefault();

  const storeId = String(editBtn.getAttribute("data-store-id") || "").trim();
  const stores = Array.isArray(window.__storeManagerPayload?.stores)
    ? window.__storeManagerPayload.stores
    : [];
  const store = stores.find((row) => String(row?.store_id || "") === storeId) || { store_id: storeId };

  window.showStoreManagerEditor("edit", store);
});

document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("#btnAddStore");
  if (!addBtn) return;

  e.preventDefault();
  window.showStoreManagerEditor("create", null);
});

document.getElementById("activeStoreSelect")?.addEventListener("change", (e) => {
  const id = String(e.target?.value || "").trim();
  if (!id || id === window.__activeStoreId) return;
  window.setActiveStore(id);
});
  window.addEventListener("DOMContentLoaded", async () => {
    // 🟢 load persisted active store
loadActiveStoreFromStorage();
    const loggedIn = await refreshSession().catch(() => false);

    if (loggedIn) {
      doPulseDashboard().catch(console.error);
    } else {
      setStatus("", "Enter WordPress credentials to begin.");
    }
  });
})();
// 🔴 main.js