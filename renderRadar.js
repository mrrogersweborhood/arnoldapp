// 🟢 renderRadar.js
// Arnold Admin — Radar renderer (clickable ID -> lookup)

window.renderRadar = function (data) {

  const items = Array.isArray(data?.items) ? data.items : [];
  const visible = items.length;
  const total = data?.total_actionable_items ?? visible;

  const summary = data?.summary || {};
  const failedRenewals = Number(summary.failedRenewals || 0);
  const onHold = Number(summary.onHold || 0);
  const pendingCancel = Number(summary.pendingCancel || 0);
  const recentExpired = Number(summary.recentExpired || 0);
  const activeIssue = String(data?.active_issue_filter || "").trim();

  let radarAlert = "";

  if (failedRenewals > 0) {
    radarAlert = `
      <div class="aa-health-alert aa-health-alert-problem">
        ⚠ ${failedRenewals} failed renewal${failedRenewals === 1 ? "" : "s"} require attention
      </div>
    `;
  } else if (onHold > 0) {
    radarAlert = `
      <div class="aa-health-alert aa-health-alert-watch">
        ${onHold} subscription${onHold === 1 ? "" : "s"} currently on hold
      </div>
    `;
  }

  const summaryTiles = `
    <div class="aa-radar-summary">
      <button
        type="button"
        class="aa-radar-tile aa-radar-tile-problem aa-radar-summary-filter${activeIssue === "failed-renewal" ? " is-active" : ""}"
        data-issue="failed-renewal"
      >
        <div class="aa-radar-tile-label">Failed renewals</div>
        <div class="aa-radar-tile-value">${failedRenewals}</div>
      </button>

      <button
        type="button"
        class="aa-radar-tile aa-radar-tile-watch aa-radar-summary-filter${activeIssue === "on-hold" ? " is-active" : ""}"
        data-issue="on-hold"
      >
        <div class="aa-radar-tile-label">On hold</div>
        <div class="aa-radar-tile-value">${onHold}</div>
      </button>

      <button
        type="button"
        class="aa-radar-tile aa-radar-tile-watch aa-radar-summary-filter${activeIssue === "pending-cancel" ? " is-active" : ""}"
        data-issue="pending-cancel"
      >
        <div class="aa-radar-tile-label">Pending cancel</div>
        <div class="aa-radar-tile-value">${pendingCancel}</div>
      </button>

      <button
        type="button"
        class="aa-radar-tile aa-radar-tile-muted"
      >
        <div class="aa-radar-tile-label">Total Problems</div>
        <div class="aa-radar-tile-value">${total}</div>
      </button>
    </div>
  `;

  if (!items.length) {
    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Radar</div>
          <div class="aa-section-subtitle">${activeIssue ? `Filtered: ${activeIssue}` : "Current actionable problems"}</div>
        </div>

        ${radarAlert}
        ${summaryTiles}

        <div class="aa-muted">No current actionable problems.</div>

        <div class="aa-radar-footer">
          <div class="aa-radar-count">
            Showing 0 of ${total} actionable problems
          </div>

          <div class="aa-radar-paging">
            <button class="aa-btn aa-radar-prev" disabled>Previous</button>
            <span class="aa-radar-page">Page 1</span>
            <button class="aa-btn aa-radar-next" disabled>Next</button>
          </div>
        </div>
      </section>
    `;
  }

  const rows = [...items]
  .sort((a, b) => {
    const aTs = a?.date ? new Date(a.date).getTime() : 0;
    const bTs = b?.date ? new Date(b.date).getTime() : 0;
    return bTs - aTs;
  })
  .map((r) => {
    const id = r.display_id || "";
    const name = r.customer_name || "—";
    const email = r.email || "—";
    const rawIssue = r.issue || "";
    const reason = r.reason || "—";
let date = "—";
let recentClass = "";

if (r.date) {
  const d = new Date(r.date);
  date = d.toLocaleDateString();

  const ageHours = (Date.now() - d.getTime()) / 3600000;

  if (ageHours < 24) {
    recentClass = " aa-radar-recent-urgent";
  } else if (ageHours < 72) {
    recentClass = " aa-radar-recent";
  } else if (ageHours < 168) {
    recentClass = " aa-radar-recent-soft";
  }
}
    let issueLabel = "—";
    let issueClass = "aa-pill-neutral";

    if (rawIssue === "failed-renewal") {
      issueLabel = "Failed renewal";
      issueClass = "aa-pill-danger";
    } else if (rawIssue === "on-hold") {
      issueLabel = "On hold";
      issueClass = "aa-pill-warning";
    } else if (rawIssue === "pending-cancel") {
      issueLabel = "Pending cancel";
      issueClass = "aa-pill-warning";
    } else if (rawIssue === "expired") {
      issueLabel = "Recent expired";
      issueClass = "aa-pill-muted";
    } else if (rawIssue) {
      issueLabel = rawIssue;
    }

    const issue = `
      <button
        type="button"
        class="aa-pill ${issueClass} aa-radar-issue-filter${activeIssue === rawIssue ? " is-active" : ""}"
        data-issue="${rawIssue}"
        style="border:none;cursor:pointer"
      >
        ${issueLabel}
      </button>
    `;

    let query = "";
    const idLower = String(id).toLowerCase().trim();

    if (idLower.startsWith("order")) {
      query = idLower;
    } else if (idLower.startsWith("sub")) {
      query = idLower;
    } else if (/^\d+$/.test(String(id).trim())) {
      query = `order ${String(id).trim()}`;
    }

    return `
      <tr class="${recentClass}">
        <td class="aa-radar-col-id">
          <button
            type="button"
            class="aa-order-id aa-candidate-open-btn"
            data-open-query="${query}"
            style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
          >
            ${id}
          </button>
        </td>
        <td class="aa-radar-col-issue">${issue}</td>
        <td class="aa-radar-col-reason">${reason}</td>
        <td class="aa-radar-col-date">${date}</td>
        <td class="aa-radar-col-customer">${name}</td>
        <td class="aa-radar-col-email">${email}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Support Radar</div>
        <div class="aa-section-subtitle">${activeIssue ? `Filtered: ${activeIssue}` : "Current actionable problems"}</div>
      </div>

      ${radarAlert}
      ${summaryTiles}

      <div class="aa-table-wrap">
        <table class="aa-table">
          <thead>
            <tr>
              <th class="aa-radar-th-id">Order</th>
              <th class="aa-radar-th-issue">Issue</th>
              <th class="aa-radar-th-reason">Reason</th>
              <th class="aa-radar-th-date">Dates</th>
              <th class="aa-radar-th-customer">Customer</th>
              <th class="aa-radar-th-email">Email</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="aa-radar-footer">
        <div class="aa-radar-count">
          Showing ${visible} of ${total} actionable problems
        </div>

        <div class="aa-radar-paging">
          <button class="aa-btn aa-radar-prev">Previous</button>
          <span class="aa-radar-page">Page 1</span>
          <button class="aa-btn aa-radar-next">Next</button>
        </div>
      </div>
    </section>
  `;
};

// 🔴 renderRadar.js