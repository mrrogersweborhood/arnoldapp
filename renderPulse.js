// 🟢 renderPulse.js
// Pulse renderer extracted from verified main.js
// Exposes:
// - window.renderPulseShell
// - window.renderPulseLoadingShell
// - window.buildPulseViewModel
// - window.hydratePulseView

(() => {
  "use strict";

  function showPulseBanner(message, type = "success") {
    let banner = document.getElementById("pulse-banner");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pulse-banner";
      document.body.appendChild(banner);
    }

    banner.textContent = message;
    banner.className = `pulse-banner pulse-banner-${type}`;
    banner.style.display = "block";

    setTimeout(() => {
      banner.style.display = "none";
    }, 3000);
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatPulseMoney(value, currency = "USD") {
    const amount = Number(value || 0) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatPulseInteger(value) {
    const amount = Number(value || 0) || 0;
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
  }

  function formatPulsePercent(value) {
    const amount = Number(value || 0) || 0;
    return `${amount.toFixed(2)}%`;
  }

  function formatPulseElapsedMinutes(value) {
    const totalMinutes = Number(value);

    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
      return "0m";
    }

    const minutes = Math.floor(totalMinutes);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);

    return parts.join(" ");
  }

  function pulseTitleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function formatPulseGatewayName(value) {
    const raw = String(value || "unknown").trim();
    if (!raw) return "Unknown";
    if (raw.toLowerCase() === "unknown") return "Unknown";
    return pulseTitleCase(raw);
  }

  function formatPulseReasonName(value) {
    const raw = String(value || "unknown").trim();
    const token = raw.toUpperCase();
    if (!raw) return "Unknown";
    if (token === "FAILED_GENERIC") return "Payment Failed";
    if (token === "CARD_EXPIRED") return "Card Expired";
    if (token === "INSUFFICIENT_FUNDS") return "Insufficient Funds";
    if (token === "DO_NOT_HONOR") return "Do Not Honor";
    if (token === "CVV_DECLINE") return "CVV Decline";
    if (token === "AVS_DECLINE") return "AVS Decline";
    if (token === "AUTHENTICATION_REQUIRED") return "Authentication Required";
    if (token === "GATEWAY_ERROR") return "Gateway Error";
    if (token === "GATEWAY_TIMEOUT") return "Gateway Timeout";
    if (token === "NETWORK_ERROR") return "Network Error";
    if (token === "FRAUD_SUSPECTED") return "Fraud Suspected";
    if (token === "PROCESSOR_DECLINED") return "Processor Declined";
    return pulseTitleCase(raw);
  }

  function getPulseReasonToken(value) {
    const token = String(value || "").trim().toUpperCase();
    if (token === "CARD_EXPIRED") return "danger";
    if (token === "FAILED_GENERIC") return "warning";
    if (token === "INSUFFICIENT_FUNDS") return "warning";
    if (token === "DO_NOT_HONOR") return "warning";
    if (token === "CVV_DECLINE") return "warning";
    if (token === "AVS_DECLINE") return "warning";
    if (token === "AUTHENTICATION_REQUIRED") return "warning";
    if (token === "GATEWAY_ERROR" || token === "GATEWAY_TIMEOUT" || token === "NETWORK_ERROR") return "neutral";
    if (token === "FRAUD_SUSPECTED") return "danger";
    if (token === "PROCESSOR_DECLINED") return "warning";
    return "neutral";
  }

  function renderPulseReasonPill(value) {
    const label = formatPulseReasonName(value);
    const token = getPulseReasonToken(value);
    return `<span class="pulse-reason-pill pulse-reason-pill-${token}">${esc(label)}</span>`;
  }

  function getPulsePriorityToken(priority) {
    const token = String(priority || "LOW").trim().toUpperCase();
    if (token === "HIGH") return "high";
    if (token === "MEDIUM") return "medium";
    return "low";
  }

  function formatPulseActionLabel(action) {
    const token = String(action || "").trim().toUpperCase();

    if (token === "RETRY_LATER") return "Pause Retries";
    if (token === "RETRY_NOW") return "Move to Retry Queue";
    if (token === "REVIEW_GATEWAY_STATUS") return "Review Gateway";
    if (token === "RETRY_SOFT") return "Soft Retry";
    if (token === "MONITOR") return "Monitor";

    return pulseTitleCase(token || "Action");
  }

  function getLastScanInfo() {
    try {
      const raw = localStorage.getItem("pulse_last_scan");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getScanDelta(summary) {
    try {
      const prev = JSON.parse(localStorage.getItem("pulse_last_scan") || "null");
      if (!prev) return null;

      return {
        failedDelta: (summary?.failed_subscriptions || 0) - (prev.failed || 0),
        revenueDelta: (summary?.recoverable_revenue || 0) - (prev.recoverable || 0)
      };
    } catch (_) {
      return null;
    }
  }

  function getRepeatOffenders(incidents) {
    try {
      const map = {};

      for (const item of incidents || []) {
        const email = String(item?.customer_email || "").trim().toLowerCase();
        if (!email) continue;

        if (!map[email]) {
          map[email] = {
            email,
            count: 0,
            total: 0
          };
        }

        map[email].count += 1;
        map[email].total += Number(item?.amount || 0) || 0;
      }

      return Object.values(map)
        .filter((x) => x.count > 1)
        .sort((a, b) => {
          const countDelta = Number(b?.count || 0) - Number(a?.count || 0);
          if (countDelta !== 0) return countDelta;
          return Number(b?.total || 0) - Number(a?.total || 0);
        })
        .slice(0, 5);
    } catch (_) {
      return [];
    }
  }

  function getOffenderPriority(offender) {
    const count = Number(offender?.count || 0);
    const total = Number(offender?.total || 0);

    if (count >= 4 || total >= 300) return "HIGH";
    if (count >= 2 || total >= 100) return "MEDIUM";
    return "LOW";
  }

  function renderPulseShell() {
    return `
      <div id="pulse-shell" class="pulse-shell">
        <div id="pulse-slot-action-outcome"></div>
        <div id="pulse-slot-incident-strip"></div>
        <div id="pulse-slot-hero"></div>
        <div id="pulse-slot-gateway-intelligence"></div>
        <div id="pulse-slot-reasons"></div>
        <div id="pulse-slot-repeat-offenders"></div>
        <div id="pulse-slot-last-scan"></div>
      </div>
    `;
  }

  function renderPulseLoadingShell() {
    return renderPulseShell();
  }

  function buildPulseViewModel(analysis, summary, options = {}) {
    const isLoading = options.isLoading === true;

    // 🔥 HARD RESET OF RENDER-SCOPE UI STATE (CRITICAL)
    // Prevent stale optimistic state from leaking into a fresh render.
    window.__pulseLastAnalysis = analysis;
    if (summary) {
      window.__pulseLastSummary = summary;
    }
    if (options?.clearOptimistic) {
      window.__pulseOptimisticAction = null;
    }

    let gateways = isLoading
      ? []
      : (Array.isArray(analysis?.gateways) ? analysis.gateways.slice() : []);

    // 🟢 DEDUPE GATEWAYS BY KEY (CRITICAL FIX)
    if (!isLoading && gateways.length) {
      const map = new Map();

      gateways.forEach((g) => {
        const key = String(g?.gateway || "").trim().toLowerCase();
        if (!key) return;

        const existing = map.get(key);

        if (!existing) {
          map.set(key, g);
          return;
        }

        const existingRevenue = Number(existing?.recoverable_revenue || 0);
        const newRevenue = Number(g?.recoverable_revenue || 0);

        if (newRevenue > existingRevenue) {
          map.set(key, g);
        }
      });

      gateways = Array.from(map.values());
    }
    // -----------------------------------
    // PRIORITY SORT (HIGH → LOW)
    // -----------------------------------
    if (!isLoading && gateways.length) {
      gateways.sort((a, b) => {
        const pa = String(a?.priority || "LOW").toUpperCase();
        const pb = String(b?.priority || "LOW").toUpperCase();

        const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };

        const delta = (weight[pb] || 0) - (weight[pa] || 0);
        if (delta !== 0) return delta;

        return (Number(b?.recoverable_revenue || 0) - Number(a?.recoverable_revenue || 0));
      });
    }

    const highestPriorityCount = gateways.filter(
      (g) => String(g?.priority || "").toUpperCase() === "HIGH"
    ).length;

    const incidents = isLoading
      ? []
      : (Array.isArray(analysis?.incidents) ? analysis.incidents : []);

    const reasons = isLoading
      ? []
      : (Array.isArray(analysis?.reasons) ? analysis.reasons : []);

    const summaryData = summary || {};

    const repeatOffenders = isLoading ? [] : getRepeatOffenders(incidents);

    const lastScan = isLoading ? null : getLastScanInfo();
    const scanDelta = isLoading ? null : getScanDelta(summaryData);

    return {
      isLoading,
      gateways,
      incidents,
      reasons,
      summary: summaryData,
      highestPriorityCount,
      repeatOffenders,
      lastScan,
      scanDelta
    };
  }

  function hydratePulseView(viewModel) {
    if (!viewModel) return;

    const {
      isLoading,
      gateways,
      incidents,
      reasons,
      summary,
      highestPriorityCount,
      repeatOffenders,
      lastScan,
      scanDelta
    } = viewModel;

    const slotAction = document.getElementById("pulse-slot-action-outcome");
    const slotIncident = document.getElementById("pulse-slot-incident-strip");
    const slotHero = document.getElementById("pulse-slot-hero");
    const slotGateways = document.getElementById("pulse-slot-gateway-intelligence");
    const slotReasons = document.getElementById("pulse-slot-reasons");
    const slotRepeat = document.getElementById("pulse-slot-repeat-offenders");
    const slotLast = document.getElementById("pulse-slot-last-scan");

    if (!slotHero || !slotGateways) return;

    // -----------------------------------
    // HERO
    // -----------------------------------
    slotHero.innerHTML = isLoading
      ? `<div class="card pulse-loading">Loading summary…</div>`
      : `
        <div class="card pulse-hero">
          <div class="pulse-hero-row">
            <div class="pulse-hero-stat">
              <div class="pulse-hero-value">${formatPulseMoney(summary?.recoverable_revenue)}</div>
              <div class="pulse-hero-label">Recoverable Revenue</div>
            </div>

            <div class="pulse-hero-stat">
              <div class="pulse-hero-value">${formatPulseInteger(summary?.failed_subscriptions)}</div>
              <div class="pulse-hero-label">Failed</div>
            </div>

            <div class="pulse-hero-stat">
              <div class="pulse-hero-value">${formatPulseInteger(summary?.retrying_subscriptions)}</div>
              <div class="pulse-hero-label">Retry Queue</div>
            </div>

            <div class="pulse-hero-stat">
              <div class="pulse-hero-value">${formatPulseInteger(summary?.paused_subscriptions)}</div>
              <div class="pulse-hero-label">Paused</div>
            </div>
          </div>
        </div>
      `;
    // -----------------------------------
    // INCIDENT STRIP
    // -----------------------------------
    if (slotIncident) {
      if (isLoading) {
        slotIncident.innerHTML = "";
      } else {
        const top = incidents?.[0];

        slotIncident.innerHTML = top
          ? `
            <div class="card pulse-incident">
              <div class="pulse-incident-title">
                ${esc(formatPulseGatewayName(top.gateway))}
              </div>
              <div class="pulse-incident-message">
                ${esc(top?.recommended_message || "")}
              </div>
            </div>
          `
          : "";
      }
    }

    // -----------------------------------
    // GATEWAY CARDS
    // -----------------------------------
    if (isLoading) {
      slotGateways.innerHTML = `<div class="card pulse-loading">Loading gateways…</div>`;
    } else {
      slotGateways.innerHTML = `
        <div class="pulse-gateway-grid">
          ${(gateways || []).map((g) => {
            const gatewayName = formatPulseGatewayName(g?.gateway);
            const revenue = formatPulseMoney(g?.recoverable_revenue);
            const failures = formatPulseInteger(g?.incident_count);
            const priorityToken = getPulsePriorityToken(g?.priority);

            return `
              <div class="card pulse-gateway-card pulse-priority-${priorityToken}">
                <div class="pulse-gateway-header">
                  <div class="pulse-gateway-name">${esc(gatewayName)}</div>
                  <div class="pulse-gateway-priority">${esc(g?.priority || "LOW")}</div>
                </div>

                <div class="pulse-gateway-body">
                  <div class="pulse-gateway-revenue">${revenue}</div>
                  <div class="pulse-gateway-meta">${failures} failures</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // -----------------------------------
    // REASONS BREAKDOWN
    // -----------------------------------
    if (slotReasons) {
      if (isLoading) {
        slotReasons.innerHTML = "";
      } else {
        slotReasons.innerHTML = `
          <div class="card pulse-reasons">
            ${(reasons || []).map((r) => `
              <div class="pulse-reason-row">
                ${renderPulseReasonPill(r?.reason)}
                <span class="pulse-reason-value">
                  ${formatPulseMoney(r?.recoverable_revenue)}
                </span>
              </div>
            `).join("")}
          </div>
        `;
      }
    }
    // -----------------------------------
    // REPEAT OFFENDERS
    // -----------------------------------
    if (slotRepeat) {
      if (isLoading) {
        slotRepeat.innerHTML = "";
      } else {
        slotRepeat.innerHTML = `
          <div class="card pulse-repeat">
            ${(repeatOffenders || []).map((o) => {
              const priority = getOffenderPriority(o);
              const token = getPulsePriorityToken(priority);

              return `
                <div class="pulse-repeat-row pulse-priority-${token}">
                  <div class="pulse-repeat-email"
                       data-email="${esc(o.email)}"
                       style="cursor:pointer;text-decoration:underline;">
                    ${esc(o.email)}
                  </div>
                  <div class="pulse-repeat-meta">
                    ${formatPulseInteger(o.count)} failures
                  </div>
                  <div class="pulse-repeat-value">
                    ${formatPulseMoney(o.total)}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `;

        // click → search by email
        slotRepeat.querySelectorAll(".pulse-repeat-email").forEach((el) => {
          el.addEventListener("click", () => {
            if (typeof window.runSearch === "function") {
              window.runSearch(el.dataset.email);
            }
          });
        });
      }
    }

    // -----------------------------------
    // LAST SCAN
    // -----------------------------------
    if (slotLast) {
      if (isLoading) {
        slotLast.innerHTML = "";
      } else {
        slotLast.innerHTML = lastScan
          ? `
            <div class="card pulse-last-scan">
              <div>Last Scan: ${esc(new Date(lastScan.ts).toLocaleString())}</div>
              ${
                scanDelta
                  ? `
                    <div class="pulse-last-scan-delta">
                      Δ Failed: ${formatPulseInteger(scanDelta.failedDelta)} |
                      Δ Revenue: ${formatPulseMoney(scanDelta.revenueDelta)}
                    </div>
                  `
                  : ""
              }
            </div>
          `
          : "";
      }
    }

    // -----------------------------------
    // ACTION OUTCOME (BANNER SLOT)
    // -----------------------------------
    if (slotAction) {
      slotAction.innerHTML = ""; // handled globally via showPulseBanner
    }
  }

  // -----------------------------------
  // EXPORTS
  // -----------------------------------
  window.renderPulseShell = renderPulseShell;
  window.renderPulseLoadingShell = renderPulseLoadingShell;
  window.buildPulseViewModel = buildPulseViewModel;
  window.hydratePulseView = hydratePulseView;
})();
// 🔴 renderPulse.js