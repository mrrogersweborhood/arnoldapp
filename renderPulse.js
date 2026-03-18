// 🟢 renderPulse.js
// Pulse renderer extracted from verified main.js
// Exposes:
// - window.renderPulseLoadingShell
// - window.renderPulseDashboard

(() => {
  "use strict";

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

  function renderPulseLoadingShell() {
    return `
      <section class="card pulse-hero">
        <div class="pulse-hero-top">
          <div>
            <div class="pulse-kicker">Pulse Revenue Intelligence</div>
            <div class="pulse-title">Loading dashboard…</div>
            <div class="pulse-subtitle">Pulling live gateway and failure data from the Pulse worker.</div>
          </div>
        </div>
        <div class="pulse-stat-grid">
          <div class="pulse-stat-card pulse-stat-accent-danger"><div class="aa-loading-row" style="width:120px"></div><div class="aa-loading-row" style="width:88px; margin-top:10px"></div></div>
          <div class="pulse-stat-card pulse-stat-accent-warning"><div class="aa-loading-row" style="width:100px"></div><div class="aa-loading-row" style="width:88px; margin-top:10px"></div></div>
          <div class="pulse-stat-card pulse-stat-accent-neutral"><div class="aa-loading-row" style="width:130px"></div><div class="aa-loading-row" style="width:88px; margin-top:10px"></div></div>
          <div class="pulse-stat-card pulse-stat-accent-neutral"><div class="aa-loading-row" style="width:110px"></div><div class="aa-loading-row" style="width:88px; margin-top:10px"></div></div>
        </div>
      </section>

      <section class="card pulse-section">
        <div class="pulse-section-head">
          <div>
            <div class="pulse-section-title">Gateway intelligence</div>
            <div class="pulse-section-subtitle">Preparing live recovery recommendations…</div>
          </div>
        </div>
        <div class="pulse-grid">
          <div class="pulse-gateway-card"><div class="aa-loading-row" style="width:150px"></div><div class="aa-loading-row" style="width:90px; margin-top:10px"></div><div class="aa-loading-row" style="width:100%; margin-top:12px"></div><div class="aa-loading-row" style="width:85%; margin-top:8px"></div></div>
          <div class="pulse-gateway-card"><div class="aa-loading-row" style="width:150px"></div><div class="aa-loading-row" style="width:90px; margin-top:10px"></div><div class="aa-loading-row" style="width:100%; margin-top:12px"></div><div class="aa-loading-row" style="width:85%; margin-top:8px"></div></div>
        </div>
      </section>
    `;
  }

  function renderPulseDashboard(analysis, summary) {
    const gateways = Array.isArray(analysis?.gateways) ? analysis.gateways.slice() : [];
    const reasons = Array.isArray(analysis?.reasons) ? analysis.reasons.slice() : [];
    const repeatOffenders = getRepeatOffenders(analysis?.incidents);
const gatewayIncidents = Array.isArray(analysis?.gateway_incidents)
  ? analysis.gateway_incidents
  : [];

const activeIncident = gatewayIncidents.find(g => g.status === "outage" || g.status === "spike");
    const lastScanInfo = getLastScanInfo();
    const scanDelta = getScanDelta(summary);

    gateways.sort((a, b) => Number(b?.recoverable_revenue || 0) - Number(a?.recoverable_revenue || 0));
    reasons.sort((a, b) => {
      const revDelta = Number(b?.recoverable_revenue || 0) - Number(a?.recoverable_revenue || 0);
      if (revDelta !== 0) return revDelta;
      return Number(b?.incident_count || 0) - Number(a?.incident_count || 0);
    });

    const totalRevenue = Number(summary?.recoverable_revenue || 0) || 0;
    const failedSubscriptions = Number(summary?.failed_subscriptions || 0) || 0;
    const pendingIncidents = Number(analysis?.total_pending_incidents || 0) || 0;
    const highestPriorityCount = gateways.filter((item) => String(item?.recommended_priority || "").toUpperCase() === "HIGH").length;

    const lastScanCard = lastScanInfo
      ? `
          <section class="card pulse-section" style="margin-bottom:16px;">
            <div class="pulse-section-head">
              <div>
                <div class="pulse-section-title">Last scan</div>
                <div class="pulse-section-subtitle">Most recent scan execution</div>
              </div>
            </div>
            <div style="padding:16px; display:flex; gap:24px; flex-wrap:wrap;">
              <div>
                <div class="pulse-metric-label">Time</div>
                <div class="pulse-metric-value">${esc(new Date(lastScanInfo.time).toLocaleString())}</div>
              </div>
              <div>
                <div class="pulse-metric-label">Processed</div>
                <div class="pulse-metric-value">${esc(formatPulseInteger(lastScanInfo.processed))}</div>
              </div>
              <div>
                <div class="pulse-metric-label">Revenue</div>
                <div class="pulse-metric-value">${esc(formatPulseMoney(lastScanInfo.recoverable))}</div>
              </div>
              <div>
                <div class="pulse-metric-label">Failed</div>
                <div class="pulse-metric-value">${esc(formatPulseInteger(lastScanInfo.failed))}</div>
              </div>
            </div>
          </section>
        `
      : "";

    const gatewayCards = gateways.length
      ? gateways.map((gateway) => {
          const priorityLabel = String(gateway?.recommended_priority || "LOW").toUpperCase();
          const priorityToken = getPulsePriorityToken(priorityLabel);
          return `
            <article class="pulse-gateway-card pulse-priority-${priorityToken}-card">
              <div class="pulse-gateway-top">
                <div>
                  <div class="pulse-gateway-name">${esc(formatPulseGatewayName(gateway?.gateway))}</div>
                  <div class="pulse-gateway-share">${esc(formatPulsePercent(gateway?.share_of_failures_pct))} of tracked failures</div>
                </div>
                <div class="pulse-priority-pill pulse-priority-${priorityToken}">${esc(priorityLabel)}</div>
              </div>

              <div class="pulse-gateway-metrics">
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Incidents</div>
                  <div class="pulse-metric-value">${esc(formatPulseInteger(gateway?.incident_count))}</div>
                </div>
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Revenue</div>
                  <div class="pulse-metric-value">${esc(formatPulseMoney(gateway?.recoverable_revenue))}</div>
                </div>
                <div class="pulse-metric">
                  <div class="pulse-metric-label">Customers at risk</div>
                  <div class="pulse-metric-value">${esc(formatPulseInteger(gateway?.customers_at_risk))}</div>
                </div>
              </div>

              <div class="pulse-action-pill">${esc(String(gateway?.recommended_action || "MONITOR").toUpperCase())}</div>

              <div class="pulse-message-block">
                <div class="pulse-message-label">Recommended message</div>
                <div class="pulse-message-text">${esc(String(gateway?.recommended_message || "No message returned."))}</div>
              </div>

              <div class="pulse-message-block">
                <div class="pulse-message-label">Playbook</div>
                <div class="pulse-message-text">${esc(String(gateway?.playbook || "No playbook returned."))}</div>
              </div>
            </article>
          `;
        }).join("")
      : `<div class="pulse-empty">No gateway data was returned by the live Pulse endpoint.</div>`;

    const reasonRows = reasons.length
      ? reasons.map((reason) => `
          <div class="pulse-reason-row">
            <div class="pulse-reason-name">${renderPulseReasonPill(reason?.reason)}</div>
            <div class="pulse-reason-value pulse-right">${esc(formatPulseInteger(reason?.incident_count))}</div>
            <div class="pulse-reason-value pulse-right">${esc(formatPulseMoney(reason?.recoverable_revenue))}</div>
          </div>
        `).join("")
      : `<div class="pulse-empty" style="margin:16px;">No reasons data was returned by the live Pulse endpoint.</div>`;

    const repeatOffenderSection = repeatOffenders.length
      ? `
          <section class="card pulse-section">
            <div class="pulse-section-head">
              <div>
                <div class="pulse-section-title">Repeat offenders</div>
                <div class="pulse-section-subtitle">Subscribers with repeated payment failures.</div>
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

return `
  <div class="pulse-shell">

    ${activeIncident ? `
      <section class="card pulse-section" style="border:2px solid #dc2626; background:#fff5f5;">
        <div class="pulse-section-head">
          <div>
            <div class="pulse-section-title" style="color:#b91c1c;">
              ⚠️ Elevated Failure Activity
            </div>
            <div class="pulse-section-subtitle">
              ${esc(formatPulseGatewayName(activeIncident.gateway))} is showing an increase in failed transactions.
            </div>
          </div>
        </div>

        <div style="padding:16px;">
          <div><strong>Status:</strong> ${esc(activeIncident.status.toUpperCase())}</div>
          <div><strong>Severity:</strong> ${esc(activeIncident.severity.toUpperCase())}</div>
          <div><strong>Confidence:</strong> ${esc(formatPulsePercent(activeIncident.confidence * 100))}</div>
          <div><strong>Customers at risk:</strong> ${esc(formatPulseInteger(activeIncident.customers_at_risk))}</div>
          <div style="margin-top:10px;">
            <strong>Recommended Action:</strong> ${esc(activeIncident.recommended_action)}
          </div>
          <div style="margin-top:6px;">
            ${esc("Recent activity suggests a higher-than-normal number of payment failures. Verify gateway status before taking action.")}
          </div>
        </div>
      </section>
    ` : ""}
        ${lastScanCard}

        <section class="card pulse-hero">
          <div class="pulse-hero-top">
            <div>
              <div class="pulse-kicker">Pulse Revenue Intelligence</div>
              <div class="pulse-title">Revenue recovery dashboard</div>
              <div class="pulse-subtitle">Real-time revenue recovery insights and failure intelligence.</div>
            </div>
            <!-- removed endpoint debug row for production UI -->
          </div>

          <div class="pulse-stat-grid">
            <div class="pulse-stat-card pulse-stat-accent-danger">
              <div class="pulse-stat-label">Recoverable revenue</div>
              <div class="pulse-stat-value">${esc(formatPulseMoney(totalRevenue))}</div>
              <div class="pulse-stat-meta">Current total across tracked failed subscriptions.</div>
            </div>
            <div class="pulse-stat-card pulse-stat-accent-warning">
              <div class="pulse-stat-label">Failed subscriptions</div>
              <div class="pulse-stat-value">${esc(formatPulseInteger(failedSubscriptions))}</div>
              <div class="pulse-stat-meta">Live count from the Pulse summary endpoint.</div>
            </div>
            <div class="pulse-stat-card pulse-stat-accent-neutral">
              <div class="pulse-stat-label">Pending incidents</div>
              <div class="pulse-stat-value">${esc(formatPulseInteger(pendingIncidents))}</div>
              <div class="pulse-stat-meta">Open incidents returned by failure analysis.</div>
            </div>
            <div class="pulse-stat-card pulse-stat-accent-neutral">
              <div class="pulse-stat-label">High-priority gateways</div>
              <div class="pulse-stat-value">${esc(formatPulseInteger(highestPriorityCount))}</div>
              <div class="pulse-stat-meta">Gateways currently flagged with HIGH priority.</div>
            </div>

            ${scanDelta ? `
              <div class="pulse-stat-card pulse-stat-accent-neutral">
                <div class="pulse-stat-label">Since last scan</div>
                <div class="pulse-stat-value">
                  ${esc(`${scanDelta.failedDelta >= 0 ? "+" : ""}${formatPulseInteger(scanDelta.failedDelta)}`)}
                </div>
                <div class="pulse-stat-meta">
                  ${esc(`Revenue ${scanDelta.revenueDelta >= 0 ? "+" : ""}${formatPulseMoney(scanDelta.revenueDelta)}`)}
                </div>
              </div>
            ` : ""}
          </div>
        </section>

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

        ${repeatOffenderSection}

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
      </div>
    `;
  }

  window.renderPulseLoadingShell = renderPulseLoadingShell;
  window.renderPulseDashboard = renderPulseDashboard;
})();
// 🔴 renderPulse.js