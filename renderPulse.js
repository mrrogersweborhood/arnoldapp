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
        <div id="pulse-slot-automation-state"></div>
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

  function renderPulseIncidentMetricCell(label, valueHtml) {
    return `
      <div class="pulse-incident-strip-metric">
        <span>${esc(label)}</span>
        <strong>${valueHtml}</strong>
      </div>
    `;
  }

  function renderPulseIncidentStatusCard({
    automationLabel,
    automationToken,
    automationMeta,
    automationReason
  }) {
    return `
      <div class="pulse-incident-strip-status-card">
        <div class="pulse-incident-strip-status-head">
          <div class="pulse-incident-strip-status-label">Automation status</div>
          <div class="pulse-priority-pill pulse-priority-${esc(automationToken)}">
            ${automationLabel}
          </div>
        </div>

        <div class="pulse-incident-strip-status-meta">
          ${automationMeta}
        </div>

        <div class="pulse-incident-strip-status-reason">
          ${automationReason}
        </div>
      </div>
    `;
  }
  function renderPulseAutomationStateCard({
    isLoading,
    analysis,
    summary,
    activeIncident,
    activeDecision
  }) {
    if (isLoading) {
      return `
        <section class="card aa-section" aria-busy="true">
          <div class="aa-section-head">
            <div class="aa-section-title">Automation State</div>
            <div class="aa-section-subtitle">Evaluating gateway automation posture…</div>
          </div>

          <div class="pulse-incident-strip-status-row">
            <div class="pulse-incident-strip-status-card">
              <div class="pulse-incident-strip-status-head">
                <div class="pulse-incident-strip-status-label">Current state</div>
                <div class="pulse-priority-pill pulse-priority-medium">Updating…</div>
              </div>

              <div class="pulse-incident-strip-status-meta">
                <div class="aa-loading-row" style="width:220px"></div>
              </div>

              <div class="pulse-incident-strip-status-reason">
                <div class="aa-loading-row" style="width:300px"></div>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    const gatewayName = formatPulseGatewayName(
      activeDecision?.gateway ||
      activeIncident?.gateway ||
      analysis?.top_gateway?.gateway ||
      "unknown"
    );

    const pausedTotal = Number(analysis?.paused_total || 0) || 0;
    const retryingTotal = Number(analysis?.retrying_total || 0) || 0;
    const executionMode = String(summary?.execution_mode || "test").toUpperCase();

    const shouldAutoPause = activeDecision?.should_auto_pause === true;
    const shouldAutoResume = activeDecision?.should_auto_resume === true;

    let stateLabel = "Monitoring";
    let stateToken = "medium";

    if (pausedTotal > 0 && !shouldAutoResume) {
      stateLabel = "Paused";
      stateToken = "high";
    } else if (shouldAutoPause) {
      stateLabel = "Pause Ready";
      stateToken = "high";
    } else if (shouldAutoResume) {
      stateLabel = "Resume Ready";
      stateToken = "low";
    } else if (retryingTotal > 0) {
      stateLabel = "Retrying";
      stateToken = "medium";
    }

    const stateMeta =
      `${esc(gatewayName)} · ${esc(formatPulseInteger(pausedTotal))} paused · ${esc(formatPulseInteger(retryingTotal))} retrying · ${esc(executionMode)} MODE`;

    const stateReason =
      esc(
        String(
          activeDecision?.decision_reason ||
          activeIncident?.recovery_reason ||
          activeIncident?.recommended_message ||
          "No automation reason available."
        )
      );

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Automation State</div>
          <div class="aa-section-subtitle">Persistent state from decision engine + live incident posture</div>
        </div>

        <div class="pulse-incident-strip-status-row">
          <div class="pulse-incident-strip-status-card">
            <div class="pulse-incident-strip-status-head">
              <div class="pulse-incident-strip-status-label">Current state</div>
              <div class="pulse-priority-pill pulse-priority-${esc(stateToken)}">
                ${esc(stateLabel)}
              </div>
            </div>

            <div class="pulse-incident-strip-status-meta">
              ${stateMeta}
            </div>

            <div class="pulse-incident-strip-status-reason">
              ${stateReason}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderPulseIncidentStrip({
    isLoading,
    activeIncident,
    analysis,
    summary
  }) {
    if (isLoading) {
      return `
        <section class="card pulse-incident-strip pulse-medium pulse-incident-strip-loading" aria-busy="true">
          <div class="pulse-incident-strip-head">
            <div class="pulse-incident-strip-left">
              <div class="pulse-incident-strip-kicker">Gateway incident</div>
              <div class="pulse-incident-strip-title">
                <div class="aa-loading-row" style="width:180px"></div>
              </div>
              <div class="pulse-incident-strip-subtitle">
                <div class="aa-loading-row" style="width:420px"></div>
              </div>
            </div>
          </div>

          <div class="pulse-incident-strip-metrics">
            ${renderPulseIncidentMetricCell("Confidence", `<div class="aa-loading-row" style="width:70px"></div>`)}
            ${renderPulseIncidentMetricCell("Customers", `<div class="aa-loading-row" style="width:60px"></div>`)}
            ${renderPulseIncidentMetricCell("Revenue", `<div class="aa-loading-row" style="width:90px"></div>`)}
          </div>

          <div class="pulse-incident-strip-status-row">
            ${renderPulseIncidentStatusCard({
              automationLabel: "Updating…",
              automationToken: "medium",
              automationMeta: `<div class="aa-loading-row" style="width:180px"></div>`,
              automationReason: `<div class="aa-loading-row" style="width:260px"></div>`
            })}
          </div>

          <div class="pulse-incident-strip-actions">
            <button class="pulse-incident-strip-action" type="button" disabled aria-hidden="true">
              <div class="aa-loading-row" style="width:120px"></div>
            </button>
          </div>
        </section>
      `;
    }

    const severityToken = esc(String(activeIncident?.severity || "low").toLowerCase());

    const titleHtml =
      `${esc(formatPulseGatewayName(activeIncident?.gateway))} · ${esc(String(activeIncident?.status || "normal").toUpperCase())}`;

    const subtitleHtml =
      `${esc(activeIncident?.recommended_message || "No incident message available.")}`;

    const confidenceHtml =
      esc(formatPulsePercent((Number(activeIncident?.confidence || 0) || 0) * 100));

    const customersHtml =
      esc(formatPulseInteger(activeIncident?.customers_at_risk || 0));

    const revenueHtml =
      esc(formatPulseMoney(activeIncident?.recoverable_revenue || 0));

    const automationLabel = esc(
      activeIncident?.should_pause_retries
        ? "Auto-paused"
        : activeIncident?.should_resume_retries
          ? "Resume ready"
          : "Monitoring"
    );

    const automationToken =
      activeIncident?.should_pause_retries
        ? "high"
        : activeIncident?.should_resume_retries
          ? "low"
          : "medium";

    const automationMeta =
      `${esc(formatPulseInteger(analysis?.paused_total || 0))} paused · ${esc(formatPulseInteger(analysis?.retrying_total || 0))} retrying · ${esc(String(summary?.execution_mode || "test").toUpperCase())} MODE`;

    const automationReason =
      `${esc(String(activeIncident?.recovery_reason || "No recovery reason available."))}`;

    const actionHtml = `
        <button
          class="pulse-incident-strip-action"
          type="button"
          data-action="${esc(String(activeIncident?.recommended_action || ""))}"
          data-gateway="${esc(String(activeIncident?.gateway || ""))}"
        >
          ${esc(formatPulseActionLabel(activeIncident?.recommended_action))}
        </button>
      `;

    return `
      <section class="card pulse-incident-strip pulse-${severityToken}">
        <div class="pulse-incident-strip-head">
          <div class="pulse-incident-strip-left">
            <div class="pulse-incident-strip-kicker">Gateway incident</div>
            <div class="pulse-incident-strip-title">${titleHtml}</div>
            <div class="pulse-incident-strip-subtitle">${subtitleHtml}</div>
          </div>
        </div>

        <div class="pulse-incident-strip-metrics">
          ${renderPulseIncidentMetricCell("Confidence", confidenceHtml)}
          ${renderPulseIncidentMetricCell("Customers", customersHtml)}
          ${renderPulseIncidentMetricCell("Revenue", revenueHtml)}
        </div>

        <div class="pulse-incident-strip-status-row">
          ${renderPulseIncidentStatusCard({
            automationLabel,
            automationToken,
            automationMeta,
            automationReason
          })}
        </div>

        <div class="pulse-incident-strip-actions">
          ${actionHtml}
        </div>
      </section>
    `;
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

    // 🔥 NEW — APPLY ACTION FEEDBACK (UI INTERACTION LAYER)
    const actionFeedback = window.__pulseActionFeedback || null;

    let actionOutcomeBanner = "";

    if (actionFeedback && !isLoading) {
      const now = Date.now();
      const age = now - Number(actionFeedback.at || 0);

      if (age < 8000) {
        const secondsAgo = Math.floor(age / 1000);

        const label =
          actionFeedback.action === "pause"
            ? "paused"
            : actionFeedback.action === "retry"
              ? "moved to retry queue"
              : actionFeedback.action === "resume"
                ? "resumed"
                : "updated";

        actionOutcomeBanner = `
          <section class="card pulse-action-outcome">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
              <div>
                <div style="font-weight:800; font-size:16px;">
                  ✓ ${esc(formatPulseInteger(actionFeedback.count))} subscription${actionFeedback.count === 1 ? "" : "s"} ${label}
                </div>

                <div style="margin-top:4px; opacity:.8;">
                  💰 ${esc(formatPulseMoney(actionFeedback.revenue))} impacted
                </div>
              </div>

              <div style="font-size:12px; opacity:.6;">
                ${secondsAgo}s ago
              </div>
            </div>
          </section>
        `;
      } else {
        window.__pulseActionFeedback = null;
      }
    }

    if (actionFeedback && !isLoading) {
      const now = Date.now();
      const age = now - Number(actionFeedback.at || 0);

      if (age < 8000) {
        const gatewayKey = String(actionFeedback.gateway || "").toLowerCase();

        gateways.forEach((g) => {
          if (String(g?.gateway || "").toLowerCase() !== gatewayKey) return;

          if (actionFeedback.action === "pause") {
            g.__uiOverride = {
              label: "✓ Paused",
              token: "high"
            };
          }

          if (actionFeedback.action === "retry") {
            g.__uiOverride = {
              label: "↻ Retry Queue",
              token: "medium"
            };
          }

          if (actionFeedback.action === "resume") {
            g.__uiOverride = {
              label: "✓ Resumed",
              token: "low"
            };
          }
        });
      } else {
        window.__pulseActionFeedback = null;
      }
    }

    const reasons = isLoading ? [] : (Array.isArray(analysis?.reasons) ? analysis.reasons.slice() : []);
    const repeatOffenders = isLoading ? [] : getRepeatOffenders(analysis?.incidents);
    const gatewayIncidents = isLoading
      ? []
      : (Array.isArray(analysis?.gateway_incidents) ? analysis.gateway_incidents : []);
    const gatewayIncidentMap = new Map(
      gatewayIncidents.map((item) => [
        String(item?.gateway || "").trim().toLowerCase(),
        item
      ])
    );
    const gatewayDecisions = isLoading
      ? []
      : (Array.isArray(analysis?.gateway_decisions) ? analysis.gateway_decisions : []);
    const gatewayDecisionMap = new Map(
      gatewayDecisions.map((item) => [
        String(item?.gateway || "").trim().toLowerCase(),
        item
      ])
    );

    const optimistic = window.__pulseOptimisticAction || null;

    if (optimistic && !isLoading && summary) {
      try {
        if (optimistic.type === "pause" && optimistic.gateway) {
          const count = Number(optimistic.count || 0) || 0;

          summary.retrying_subscriptions = Math.max(0, (summary.retrying_subscriptions || 0) - count);
          summary.paused_subscriptions = (summary.paused_subscriptions || 0) + count;

          summary.retrying_revenue = Math.max(0, (summary.retrying_revenue || 0) - (optimistic.revenue || 0));
          summary.paused_revenue = (summary.paused_revenue || 0) + (optimistic.revenue || 0);
        }

        if (optimistic.type === "retry" && optimistic.gateway) {
          const count = Number(optimistic.count || 0) || 0;

          summary.paused_subscriptions = Math.max(0, (summary.paused_subscriptions || 0) - count);
          summary.retrying_subscriptions = (summary.retrying_subscriptions || 0) + count;

          summary.paused_revenue = Math.max(0, (summary.paused_revenue || 0) - (optimistic.revenue || 0));
          summary.retrying_revenue = (summary.retrying_revenue || 0) + (optimistic.revenue || 0);
        }
      } catch (e) {
        console.warn("Optimistic update failed:", e);
      }

      window.__pulseOptimisticAction = null;
    }

    const activeIncident = isLoading ? null : (gatewayIncidents[0] || null);
    const gatewayDecisions = isLoading
      ? []
      : (Array.isArray(analysis?.gateway_decisions) ? analysis.gateway_decisions : []);
    const activeDecision = isLoading ? null : (gatewayDecisions[0] || null);
    const lastScanInfo = isLoading ? null : getLastScanInfo();
    const scanDelta = isLoading ? null : getScanDelta(summary);

    const successSummary = isLoading ? null : (analysis?.success_summary || null);
    const lastSuccessAt = successSummary?.last_success_at || null;
    const recentSuccessCount = Number(successSummary?.recent_success_count || 0) || 0;

    gateways.sort((a, b) => {
      const incidentA = gatewayIncidentMap.get(String(a?.gateway || "").trim().toLowerCase()) || null;
      const incidentB = gatewayIncidentMap.get(String(b?.gateway || "").trim().toLowerCase()) || null;

      const statusRank = (incident) => {
        const token = String(incident?.status || "normal").trim().toLowerCase();
        if (token === "outage") return 4;
        if (token === "degraded") return 3;
        if (token === "spike") return 2;
        return 1;
      };

      const intelligenceDelta = statusRank(incidentB) - statusRank(incidentA);
      if (intelligenceDelta !== 0) return intelligenceDelta;

      const rank = (value) => {
        const token = String(value || "LOW").trim().toUpperCase();
        if (token === "HIGH") return 3;
        if (token === "MEDIUM") return 2;
        return 1;
      };

      const priorityDelta =
        rank(b?.recommended_priority) - rank(a?.recommended_priority);
      if (priorityDelta !== 0) return priorityDelta;

      const revenueDelta =
        Number(b?.recoverable_revenue || 0) - Number(a?.recoverable_revenue || 0);
      if (revenueDelta !== 0) return revenueDelta;

      return Number(b?.incident_count || 0) - Number(a?.incident_count || 0);
    });

    reasons.sort((a, b) => {
      const revDelta = Number(b?.recoverable_revenue || 0) - Number(a?.recoverable_revenue || 0);
      if (revDelta !== 0) return revDelta;
      return Number(b?.incident_count || 0) - Number(a?.incident_count || 0);
    });

    const executionMode = String(summary?.execution_mode || "test").toUpperCase();
    const totalRevenue = Number(summary?.recoverable_revenue || 0) || 0;
    const failedSubscriptions = Number(summary?.failed_subscriptions || 0) || 0;
    const retryingSubscriptions = Number(summary?.retrying_subscriptions || 0) || 0;
    const retryingRevenue = Number(summary?.retrying_revenue || 0) || 0;
    const pausedSubscriptions = Number(summary?.paused_subscriptions || 0) || 0;
    const pausedRevenue = Number(summary?.paused_revenue || 0) || 0;
    const pendingIncidents = isLoading ? 0 : (Number(analysis?.total_pending_incidents || 0) || 0);

const incidentStrip = isLoading
  ? renderPulseIncidentStrip({
      isLoading: true,
      activeIncident: null,
      analysis,
      summary
    })
  : (activeIncident
      ? renderPulseIncidentStrip({
          isLoading: false,
          activeIncident,
          analysis,
          summary
        })
      : "");

const automationStateSection = renderPulseAutomationStateCard({
  isLoading,
  analysis,
  summary,
  activeIncident,
  activeDecision
});
    const gatewayCards = isLoading
      ? `
        <article class="pulse-gateway-card">
          <div class="aa-loading-row" style="width:160px"></div>
          <div class="aa-loading-row" style="width:90px; margin-top:10px"></div>
          <div class="aa-loading-row" style="width:100%; margin-top:12px"></div>
          <div class="aa-loading-row" style="width:88%; margin-top:8px"></div>
          <div class="aa-loading-row" style="width:76%; margin-top:14px"></div>
        </article>
        <article class="pulse-gateway-card">
          <div class="aa-loading-row" style="width:160px"></div>
          <div class="aa-loading-row" style="width:90px; margin-top:10px"></div>
          <div class="aa-loading-row" style="width:100%; margin-top:12px"></div>
          <div class="aa-loading-row" style="width:88%; margin-top:8px"></div>
          <div class="aa-loading-row" style="width:76%; margin-top:14px"></div>
        </article>
      `
      : gateways.length
        ? gateways.map((gateway) => {
            const priority = String(gateway?.recommended_priority || "LOW").toUpperCase();

            const uiOverride = gateway.__uiOverride || null;
            const priorityToken = getPulsePriorityToken(priority);
            const incident = gatewayIncidentMap.get(String(gateway?.gateway || "").trim().toLowerCase()) || null;
            const decision = gatewayDecisionMap.get(String(gateway?.gateway || "").trim().toLowerCase()) || null;

            const intelligenceStatus = String(incident?.status || "normal").trim().toUpperCase();
            const failureRate = Number(incident?.failure_rate || 0);
            const recentSuccessCountForGateway = Number(incident?.recent_success_count || 0);
            const hasRecentSuccessForGateway = !!incident?.has_recent_success;
            const minutesSinceSuccess = Number(incident?.minutes_since_success);

            const recoveryState = String(incident?.recommended_recovery_state || "monitor").toLowerCase();
            const recoveryReason = String(incident?.recovery_reason || "").trim();

            let recoveryToken = "neutral";
            if (recoveryState === "pause") recoveryToken = "high";
            else if (recoveryState === "resume") recoveryToken = "low";
            else recoveryToken = "medium";

            let recoveryLabel = "Monitor";
            if (recoveryState === "pause") recoveryLabel = "Pause Recommended";
            if (recoveryState === "resume") recoveryLabel = "Resume Recommended";

            let intelligenceToken = "low";
            if (intelligenceStatus === "OUTAGE") intelligenceToken = "high";
            else if (intelligenceStatus === "DEGRADED" || intelligenceStatus === "SPIKE") intelligenceToken = "medium";

            const successMeta = hasRecentSuccessForGateway
              ? `Recent successes ${formatPulseInteger(recentSuccessCountForGateway)}`
              : (
                  Number.isFinite(minutesSinceSuccess) && minutesSinceSuccess >= 0
                    ? `No recent success · last success ${formatPulseElapsedMinutes(minutesSinceSuccess)} ago`
                    : "No recent success observed"
                );

            return `
            <article class="pulse-gateway-card pulse-priority-${priorityToken}-card ${window.__pulseExpandedGateways?.[String(gateway?.gateway || "").toLowerCase()] ? "pulse-gateway-card-expanded" : ""}">
              <div class="pulse-gateway-top">
                <div>
                  <div class="pulse-gateway-name">
                    ${esc(formatPulseGatewayName(gateway?.gateway))}
                    <span
                      class="pulse-priority-pill pulse-priority-${intelligenceToken}"
                      style="margin-left:8px; vertical-align:middle;"
                    >
                      ${esc(intelligenceStatus)}
                    </span>
                  </div>
                  <div class="pulse-gateway-share">${esc(formatPulsePercent(gateway?.share_of_failures_pct || 0))} of active failures</div>
                </div>
                <div class="pulse-priority-pill pulse-priority-${uiOverride?.token || priorityToken}">
                  ${esc(uiOverride?.label || priority)}
                </div>
              </div>

              <div class="pulse-gateway-metrics">
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Failures</div>
                  <div class="pulse-metric-value">${esc(formatPulseInteger(gateway?.incident_count || 0))}</div>
                </div>
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Customers</div>
                  <div class="pulse-metric-value">${esc(formatPulseInteger(gateway?.customers_at_risk || 0))}</div>
                </div>
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Recoverable revenue</div>
                  <div class="pulse-metric-value">${esc(formatPulseMoney(gateway?.recoverable_revenue || 0))}</div>
                </div>
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Failure rate</div>
                  <div class="pulse-metric-value">${esc(formatPulsePercent(failureRate * 100))}</div>
                </div>
              </div>

              <div class="pulse-gateway-message">
                ${esc(
                  decision?.decision_reason ||
                  gateway?.recommended_message ||
                  "No recommendation available."
                )}
              </div>

              <div
                class="pulse-gateway-recovery pulse-priority-${recoveryToken}"
                style="margin-top:10px; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03);"
              >
                <div
                  class="pulse-gateway-recovery-label"
                  style="font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; opacity:.75;"
                >
                  Recovery recommendation
                </div>

                <div
                  class="pulse-gateway-recovery-value"
                  style="font-size:14px; font-weight:700; margin-top:4px;"
                >
                  ${esc(recoveryLabel)}
                </div>

                ${
                  recoveryReason
                    ? `
                      <div
                        class="pulse-gateway-recovery-reason"
                        style="font-size:12px; margin-top:6px; opacity:.85;"
                      >
                        ${esc(recoveryReason)}
                      </div>
                    `
                    : ""
                }
              </div>

              <div class="pulse-gateway-playbook" style="margin-top:10px;">
                ${esc(gateway?.playbook || "Monitor gateway performance.")}
              </div>

              <div class="pulse-gateway-playbook" style="margin-top:8px; opacity:.86;">
                ${esc(successMeta)}
              </div>

              <div class="pulse-gateway-actions" style="margin-top:14px;">
                <button
                  class="pulse-action-pill pulse-action-pill-secondary"
                  type="button"
                  data-action="pulse-toggle-customers"
                  data-gateway="${esc(String(gateway?.gateway || ""))}"
                >
                  ${window.__pulseExpandedGateways?.[String(gateway?.gateway || "").toLowerCase()]
                    ? "Hide customers"
                    : "View customers"}
                </button>
              </div>
              ${
                window.__pulseExpandedGateways?.[String(gateway?.gateway || "").toLowerCase()] &&
                window.__pulseAffectedGateway === String(gateway?.gateway || "").toLowerCase() &&
                Array.isArray(window.__pulseAffectedCustomers) &&
                window.__pulseAffectedCustomers.length
                  ? `
                    <div class="pulse-inline-customers">
                                            <div class="pulse-inline-customers-head">
                        <div class="pulse-inline-customers-title">Affected customers</div>
                        <div class="pulse-inline-customers-subtitle">
                          ${esc(formatPulseInteger(window.__pulseAffectedCustomers.length))} currently visible
                        </div>
                      </div>

                      <div class="pulse-inline-customers-table-wrap">
                        <table class="pulse-inline-customers-table">
                          <thead>
                            <tr class="pulse-inline-customers-head-row">
                              <th style="text-align:left; padding:10px 12px;">Email</th>
                              <th style="text-align:left; padding:10px 12px;">Amount</th>
                              <th style="text-align:left; padding:10px 12px;">Reason</th>
                              <th style="text-align:left; padding:10px 12px;">Status</th>
                              <th style="text-align:left; padding:10px 12px;">Order</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${window.__pulseAffectedCustomers.map((row) => `
                              <tr class="pulse-inline-customers-row" data-email="${esc(row?.email || "")}" style="cursor:pointer;">
                                <td style="padding:10px 12px;" class="pulse-linkish">${esc(row?.email || "—")}</td>
                                <td style="padding:10px 12px;">${esc(formatPulseMoney(row?.amount || 0))}</td>
                                <td style="padding:10px 12px;">${renderPulseReasonPill(row?.reason || "FAILED_GENERIC")}</td>
                                <td style="padding:10px 12px;">${esc(String(row?.status || "—").toUpperCase())}</td>
                                <td
                                  style="padding:10px 12px;"
                                  class="pulse-order-link"
                                  data-order-id="${esc(String(row?.order_id || ""))}"
                                >${esc(String(row?.order_id || "—"))}</td>
                              </tr>
                            `).join("")}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  `
                  : ""
              }
            </article>
          `;
          }).join("")
        : `
        <article class="pulse-gateway-card">
          <div class="pulse-gateway-name">No gateway activity</div>
          <div class="pulse-gateway-message">No gateway intelligence was returned by the Pulse worker.</div>
        </article>
      `;

    const reasonRows = reasons.length
      ? reasons.map((reason) => `
          <div class="pulse-reason-row">
            <div>${renderPulseReasonPill(reason?.reason || "FAILED_GENERIC")}</div>
            <div class="pulse-right">${esc(formatPulseInteger(reason?.incident_count || 0))}</div>
            <div class="pulse-right">${esc(formatPulseMoney(reason?.recoverable_revenue || 0))}</div>
          </div>
        `).join("")
      : `
        <div class="pulse-reason-row">
          <div>No reasons available</div>
          <div class="pulse-right">0</div>
          <div class="pulse-right">${esc(formatPulseMoney(0))}</div>
        </div>
      `;

    const repeatOffendersSection = repeatOffenders.length
      ? `
        <section class="card pulse-section">
          <div class="pulse-section-head">
            <div>
              <div class="pulse-section-title">Repeat offenders</div>
              <div class="pulse-section-subtitle">Customers with repeated failures across tracked incidents.</div>
            </div>
          </div>

          <div class="pulse-grid">
            ${repeatOffenders.map((offender) => {
              const priority = getOffenderPriority(offender);
              const priorityToken = getPulsePriorityToken(priority);
              return `
                <article class="pulse-gateway-card pulse-priority-${priorityToken}-card">
                  <div class="pulse-gateway-top">
                    <div>
                      <div class="pulse-gateway-name">${esc(offender.email)}</div>
                      <div class="pulse-gateway-share">${esc(String(offender.count))} failures</div>
                    </div>
                    <div class="pulse-priority-pill pulse-priority-${priorityToken}">${esc(priority)}</div>
                  </div>

                  <div class="pulse-gateway-metrics">
                    <div class="pulse-metric">
                      <div class="pulse-metric-label">Failures</div>
                      <div class="pulse-metric-value">${esc(formatPulseInteger(offender.count))}</div>
                    </div>
                    <div class="pulse-metric">
                      <div class="pulse-metric-label">Revenue at risk</div>
                      <div class="pulse-metric-value">${esc(formatPulseMoney(offender.total))}</div>
                    </div>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `
      : "";

    const lastScanSection = isLoading
      ? `
        <section class="card pulse-section pulse-last-scan-card">
          <div class="pulse-section-head">
            <div>
              <div class="pulse-section-title">Last scanner run</div>
              <div class="pulse-section-subtitle">
                <div class="aa-loading-row" style="width:220px"></div>
              </div>
            </div>
          </div>

          <div class="pulse-last-scan-grid">
            <div class="pulse-last-scan-item">
              <div class="pulse-last-scan-label">Processed</div>
              <div class="pulse-last-scan-value"><div class="aa-loading-row" style="width:60px"></div></div>
            </div>
            <div class="pulse-last-scan-item">
              <div class="pulse-last-scan-label">Created</div>
              <div class="pulse-last-scan-value"><div class="aa-loading-row" style="width:60px"></div></div>
            </div>
            <div class="pulse-last-scan-item">
              <div class="pulse-last-scan-label">Skipped</div>
              <div class="pulse-last-scan-value"><div class="aa-loading-row" style="width:60px"></div></div>
            </div>
            <div class="pulse-last-scan-item">
              <div class="pulse-last-scan-label">Recent successes</div>
              <div class="pulse-last-scan-value"><div class="aa-loading-row" style="width:60px"></div></div>
            </div>
            <div class="pulse-last-scan-item pulse-last-scan-item-wide">
              <div class="pulse-last-scan-label">Last successful payment seen</div>
              <div class="pulse-last-scan-value pulse-last-scan-value-small"><div class="aa-loading-row" style="width:220px"></div></div>
            </div>
          </div>
        </section>
      `
      : lastScanInfo
        ? `
          <section class="card pulse-section pulse-last-scan-card">
            <div class="pulse-section-head">
              <div>
                <div class="pulse-section-title">Last scanner run</div>
                <div class="pulse-section-subtitle">${esc(new Date(lastScanInfo.time).toLocaleString())}</div>
              </div>
            </div>

            <div class="pulse-last-scan-grid">
              <div class="pulse-last-scan-item">
                <div class="pulse-last-scan-label">Processed</div>
                <div class="pulse-last-scan-value">${esc(formatPulseInteger(lastScanInfo.processed || 0))}</div>
              </div>
              <div class="pulse-last-scan-item">
                <div class="pulse-last-scan-label">Created</div>
                <div class="pulse-last-scan-value">${esc(formatPulseInteger(lastScanInfo.incidents_created || 0))}</div>
              </div>
              <div class="pulse-last-scan-item">
                <div class="pulse-last-scan-label">Skipped</div>
                <div class="pulse-last-scan-value">${esc(formatPulseInteger(lastScanInfo.incidents_skipped || 0))}</div>
              </div>
              <div class="pulse-last-scan-item">
                <div class="pulse-last-scan-label">Recent successes</div>
                <div class="pulse-last-scan-value">${esc(formatPulseInteger(recentSuccessCount))}</div>
              </div>
              <div class="pulse-last-scan-item pulse-last-scan-item-wide">
                <div class="pulse-last-scan-label">Last successful payment seen</div>
                <div class="pulse-last-scan-value pulse-last-scan-value-small">${esc(lastSuccessAt ? new Date(lastSuccessAt).toLocaleString() : "No recent success observed")}</div>
              </div>
            </div>
          </section>
        `
        : `
          <section class="card pulse-section pulse-last-scan-card">
            <div class="pulse-section-head">
              <div>
                <div class="pulse-section-title">Last scanner run</div>
                <div class="pulse-section-subtitle">No scan history available yet.</div>
              </div>
            </div>
            <div class="pulse-last-scan-footer">Run the scanner to populate the last scan panel.</div>
          </section>
        `;

    return {
      actionOutcomeBanner,
      incidentStrip,
      heroSection: `
        <section class="card pulse-hero">
          <div class="pulse-hero-top">
            <div>
              <div class="pulse-kicker">Pulse Revenue Intelligence</div>
              <div class="pulse-title">Revenue recovery dashboard</div>
              <div class="pulse-subtitle">Real-time revenue recovery insights and failure intelligence.</div>
            </div>
            <div class="pulse-priority-pill ${isLoading ? "pulse-priority-medium" : (executionMode === "LIVE" ? "pulse-priority-high" : "pulse-priority-medium")}">
              ${isLoading ? "Updating…" : esc(executionMode + " MODE")}
            </div>
          </div>
          <div class="pulse-stat-grid">
            <div class="pulse-stat-card pulse-stat-accent-danger">
              <div class="pulse-stat-label">Recoverable revenue</div>
              <div class="pulse-stat-value">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:120px"></div>`
                  : esc(formatPulseMoney(totalRevenue))
                }
              </div>
              <div class="pulse-stat-meta">Current total across tracked failed subscriptions.</div>
            </div>

            <div class="pulse-stat-card pulse-stat-accent-warning">
              <div class="pulse-stat-label">Failed subscriptions</div>
              <div class="pulse-stat-value">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:60px"></div>`
                  : esc(formatPulseInteger(failedSubscriptions))
                }
              </div>
              <div class="pulse-stat-meta">Live count from the Pulse summary endpoint.</div>
            </div>

            <div class="pulse-stat-card pulse-stat-accent-neutral">
              <div class="pulse-stat-label">Active incidents</div>
              <div class="pulse-stat-value">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:60px"></div>`
                  : esc(formatPulseInteger(pendingIncidents))
                }
              </div>
              <div class="pulse-stat-meta">Incidents currently in retry or paused state.</div>
            </div>

            <div class="pulse-stat-card pulse-stat-accent-neutral">
              <div class="pulse-stat-label">Retry queue</div>
              <div class="pulse-stat-value">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:60px"></div>`
                  : esc(formatPulseInteger(retryingSubscriptions))
                }
              </div>
              <div class="pulse-stat-meta">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:100px"></div>`
                  : esc(`Revenue ${formatPulseMoney(retryingRevenue)}`)
                }
              </div>
            </div>

            <div class="pulse-stat-card pulse-stat-accent-neutral">
              <div class="pulse-stat-label">Paused incidents</div>
              <div class="pulse-stat-value">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:60px"></div>`
                  : esc(formatPulseInteger(pausedSubscriptions))
                }
              </div>
              <div class="pulse-stat-meta">
                ${isLoading
                  ? `<div class="aa-loading-row" style="width:100px"></div>`
                  : esc(`Revenue ${formatPulseMoney(pausedRevenue)}`)
                }
              </div>
            </div>
          </div>
        </section>
      `,
      gatewaySection: `
        <section class="card pulse-section">
          <div class="pulse-section-head">
            <div>
              <div class="pulse-section-title">Gateway intelligence</div>
              <div class="pulse-section-subtitle">Recommended recovery actions, priorities, and next steps.</div>
            </div>
          </div>
          <div class="pulse-grid">
            ${gatewayCards}
          </div>
        </section>
      `,
      reasonsSection: `
        <section class="card pulse-section pulse-reasons-card">
          <div class="pulse-section-head" style="padding:16px 16px 0;">
            <div>
              <div class="pulse-section-title">Reasons breakdown</div>
              <div class="pulse-section-subtitle">Sorted by revenue impact.</div>
            </div>
          </div>
          <div class="pulse-reason-list">
            <div class="pulse-reason-row pulse-reason-head">
              <div>Reason</div>
              <div class="pulse-right">Incident count</div>
              <div class="pulse-right">Recoverable revenue</div>
            </div>
            ${reasonRows}
          </div>
        </section>
      `,
      repeatOffendersSection: repeatOffendersSection,
      lastScanSection: lastScanSection,
      automationStateSection: automationStateSection
    };
  }
    function hydratePulseView(viewModel) {
    try {
      const shell = document.getElementById("pulse-shell");
      if (!shell) return;

      const {
        actionOutcomeBanner,
        incidentStrip,
        automationStateSection,
        heroSection,
        gatewaySection,
        reasonsSection,
        repeatOffendersSection,
        lastScanSection
      } = viewModel;

      const slotOutcome = document.getElementById("pulse-slot-action-outcome");
      const slotIncident = document.getElementById("pulse-slot-incident-strip");
      const slotAutomationState = document.getElementById("pulse-slot-automation-state");
      const slotHero = document.getElementById("pulse-slot-hero");
      const slotGateways = document.getElementById("pulse-slot-gateway-intelligence");
      const slotReasons = document.getElementById("pulse-slot-reasons");
      const slotRepeat = document.getElementById("pulse-slot-repeat-offenders");
      const slotScan = document.getElementById("pulse-slot-last-scan");

      if (slotOutcome) slotOutcome.innerHTML = actionOutcomeBanner || "";
      if (slotIncident) slotIncident.innerHTML = incidentStrip || "";
      if (slotAutomationState) slotAutomationState.innerHTML = automationStateSection || "";
      if (slotHero) slotHero.innerHTML = heroSection || "";
      if (slotGateways) slotGateways.innerHTML = gatewaySection || "";
      if (slotReasons) slotReasons.innerHTML = reasonsSection || "";
      if (slotRepeat) slotRepeat.innerHTML = repeatOffendersSection || "";
      if (slotScan) slotScan.innerHTML = lastScanSection || "";

      // 🔥 Rebind interactions AFTER hydration
      bindPulseInteractions();

    } catch (err) {
      console.error("hydratePulseView error", err);
    }
  }

  function bindPulseInteractions() {
        // Incident strip primary action is owned by pulseActions.js.
    // Do not bind a direct fetch/action path here.

    // Inline customer email click → search
    document.querySelectorAll(".pulse-inline-customers-row[data-email]").forEach((row) => {
      row.onclick = (e) => {
        const orderCell = e.target.closest("[data-order-id]");
        if (orderCell) {
          const orderId = orderCell.getAttribute("data-order-id");
          if (orderId && orderId !== "—" && typeof window.doSearch === "function") {
            window.doSearch(orderId);
          }
          return;
        }

        const email = row.getAttribute("data-email");
        if (!email) return;

        if (typeof window.doSearch === "function") {
          window.doSearch(email);
        }
      };
    });

    // Repeat offender email click → search
    document.querySelectorAll(".pulse-offender-email").forEach((el) => {
      el.onclick = () => {
        const email = el.getAttribute("data-email");
        if (!email) return;

        if (typeof window.doSearch === "function") {
          window.doSearch(email);
        }
      };
    });

    // Toggle customers
    document.querySelectorAll('.pulse-action-pill[data-action="pulse-toggle-customers"][data-gateway]').forEach((toggle) => {
      toggle.onclick = async () => {
        const gateway = String(toggle.getAttribute("data-gateway") || "").toLowerCase();
        if (!gateway) return;

        const originalText = toggle.textContent;
        toggle.textContent = "Loading…";
        toggle.disabled = true;

        window.__pulseExpandedGateways = window.__pulseExpandedGateways || {};
        const isExpanding = !window.__pulseExpandedGateways[gateway];
        window.__pulseExpandedGateways[gateway] = isExpanding;

        if (isExpanding) {
          try {
            const data = typeof window.fetchPulseAffectedCustomers === "function"
              ? await window.fetchPulseAffectedCustomers(gateway)
              : { ok: false, customers: [] };

            if (data?.ok && Array.isArray(data.customers)) {
              window.__pulseAffectedCustomers = data.customers;
              window.__pulseAffectedGateway = gateway;
            } else {
              window.__pulseAffectedCustomers = [];
              window.__pulseAffectedGateway = gateway;
              showPulseBanner("No customers found", "warning");
            }
          } catch (err) {
            console.error("Failed to load affected customers:", err);
            window.__pulseAffectedCustomers = [];
            window.__pulseAffectedGateway = gateway;
            showPulseBanner("Failed to load customers", "error");
          }
        }

        if (typeof window.buildPulseViewModel === "function" &&
            typeof window.updatePulseView === "function") {
          window.updatePulseView(
            window.buildPulseViewModel(
              window.__pulseLastAnalysis,
              window.__pulseLastSummary || null
            )
          );
        }

        toggle.textContent = originalText;
        toggle.disabled = false;
      };
    });
  }
  // -----------------------------------
  // EXPORTS
  // -----------------------------------
  window.showPulseBanner = showPulseBanner;
  window.renderPulseShell = renderPulseShell;
  window.renderPulseLoadingShell = renderPulseLoadingShell;
  window.buildPulseViewModel = buildPulseViewModel;
  window.hydratePulseView = hydratePulseView;
})();
// 🔴 renderPulse.js