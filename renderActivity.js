// 🟢 renderActivity.js
// Arnold Admin — renderActivity extraction (Build 2026-03-10R4-splitPass3Safe)
// (Markers are comments only: 🟢 renderActivity.js ... 🔴 renderActivity.js)

function __aaOpenSubNotes() {
  return window.openSubNotes || (window.openSubNotes = new Set());
}

function __aaOpenOrderNotes() {
  return window.openOrderNotes || (window.openOrderNotes = new Set());
}

function __aaWooAdmin() {
  return window.WOO_ADMIN || "https://okobserver.org/wp-admin/post.php";
}

function renderNotesToggle(kind, id, notes) {
  const set = kind === "sub" ? __aaOpenSubNotes() : __aaOpenOrderNotes();
  const isOpen = set.has(id);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const arrow = isOpen ? "▼" : "▾";

   return `
    <button class="aa-notes-toggle" data-kind="${esc(kind)}" data-id="${esc(String(id))}">
      <span class="aa-notes-label">Notes</span>
      <span class="aa-notes-count">${esc(String(safeNotes.length || 0))}</span>
      <span class="aa-notes-arrow" aria-hidden="true">${arrow}</span>
    </button>
  `;
}

function renderCustomerActivity(customer, subs, orders) {
    const subscriptions = Array.isArray(subs) ? subs : [];
    const orderArr = Array.isArray(orders) ? orders : [];
    const rows = [];

    function buildNotesHtml(notes) {
      const safeNotes = Array.isArray(notes) ? notes : [];
      if (!safeNotes.length) return `<div class="aa-muted">No notes.</div>`;
      return safeNotes.map((n) => {
        const when = fmtDate(n?.date_created);
        const who = n?.author || n?.added_by || "";
        const text = stripHtml(n?.note || "");
        return `<div class="aa-note">
          <div class="aa-note-meta">${esc(when)}${who ? ` • ${esc(String(who))}` : ""}</div>
          <div class="aa-note-text">${esc(text || "—")}</div>
        </div>`;
      }).join("");
    }

    if (customer?.date_created) {
       rows.push({
        kind: "customer",
        id: "",
        rowClass: "",
        idHtml: "—",
        date: customer.date_created,
        eventHtml: `<div class="aa-event-wrap"><div class="aa-event-main">${esc(customer?.event_label || "Customer created")}</div><div class="aa-event-sub">${esc(customer?.event_subtext || "Account created")}</div></div>`,
        statusHtml: '<span class="aa-muted">—</span>',
        total: customer?.impact_display || "—",
        detailsHtml: `<div class="aa-detail-wrap"><div class="aa-detail-primary">Account created</div><div class="aa-detail-secondary">Customer record opened in WooCommerce</div></div>`,
        notesHtml: '<span class="aa-muted">—</span>',
        expandedNotesRow: ""
      });
    }

    for (const s of subscriptions) {
      const id = String(s?.id ?? "").trim();
      const billing = s?.billing_interval && s?.billing_period
        ? `${s.billing_interval} ${s.billing_period}`
        : "—";
      const nextPayment = fmtDate(s?.next_payment_date);
      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const isOpen = id ? __aaOpenSubNotes().has(id) : false;
      const subStatus = String(s?.status ?? "—");
const rowClass = String(subStatus).toLowerCase() === 'failed'
  ? 'aa-row-problem aa-row-subscription'
  : 'aa-row-subscription';

      rows.push({
        kind: "sub",
        id,
        rowClass,
        idHtml: id
  ? `<a class="aa-sub-id" href="${__aaWooAdmin()}?post=${esc(id)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(id)}</a>`
  : "—",
        date: s?.start_date || s?.date_created || null,
        eventHtml: `<div class="aa-event-wrap">
  <div class="aa-event-main">
    <span class="aa-event-title">${esc(s?.event_label || "—")}</span>
    ${s?.event_priority ? `<span class="aa-priority aa-priority-${esc(String(s.event_priority))}">${esc(String(s.event_priority).toUpperCase())}</span>` : ""}
  </div>
  <div class="aa-event-sub">${esc(s?.event_subtext || "Subscription activity")}</div>
</div>`,
        statusHtml: renderStatusPill(subStatus),
        total: s?.impact_display || "—",
        detailsHtml: `<div class="aa-detail-wrap"><div class="aa-detail-primary">Next ${esc(nextPayment)}</div><div class="aa-detail-secondary">Billing ${esc(billing)}</div></div>`,
        notesHtml: renderNotesToggle("sub", id || "sub", notes),
        expandedNotesRow: isOpen
          ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${buildNotesHtml(notes)}</div></td></tr>`
          : ""
      });
    }

    for (const o of orderArr) {
      const id = String(o?.id ?? "").trim();
      const status = String(o?.status ?? "");
      let payment = String(o?.payment_method_title ?? "").trim() || "—";

if (String(o?.status || "").toLowerCase() === "failed") {
  const noteText = Array.isArray(o?.notes) && o.notes.length
    ? o.notes.map((n) => stripHtml(n?.note || "")).join(" \n ")
    : "";

  const match = noteText.match(/CARD_[A-Z_]+|INSUFFICIENT_FUNDS|DECLINED|EXPIRED/i);
  if (match) {
    payment = match[0];
  }
}

const items = getOrderItemsSummary(o).text;
      const notes = Array.isArray(o?.notes) ? o.notes : [];
const event = subscriptions.some((s) => String(s?.parent_id ?? "").trim() === id)
  ? "Parent order"
  : (isProblemOrderStatus(status) ? "🔴 Problem order" : "Renewal");
      const isOpen = id ? __aaOpenOrderNotes().has(id) : false;
      const rowClass = String(status).toLowerCase() === "failed"
        ? "aa-row-problem"
        : "";

       rows.push({
        kind: "order",
        id,
        rowClass,
idHtml: id
  ? `<a class="aa-order-id" href="${__aaWooAdmin()}?post=${esc(id)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(id)}</a>`
  : "—",
        date: o?.date_created || null,
        eventHtml: `<div class="aa-event-wrap">
  <div class="aa-event-main">
    <span class="aa-event-title">${esc(o?.event_label || "—")}</span>
    ${o?.event_priority ? `<span class="aa-priority aa-priority-${esc(String(o.event_priority))}">${esc(String(o.event_priority).toUpperCase())}</span>` : ""}
  </div>
  <div class="aa-event-sub">${esc(o?.event_subtext || "Order activity")}</div>
</div>`,
        statusHtml: renderStatusPill(status || "—"),
        total: o?.impact_display || "—",
        detailsHtml: `<div class="aa-detail-wrap"><div class="aa-detail-primary">${esc(payment)}</div><div class="aa-detail-secondary">${esc(items)}</div></div>`,
        notesHtml: renderNotesToggle("order", id || "order", notes),
        expandedNotesRow: isOpen
          ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${buildNotesHtml(notes)}</div></td></tr>`
          : ""
      });
    }

     rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const recentRows = rows.slice(0, 12);

    const bodyHtml = recentRows.length
      ? recentRows.map((r) => `
          <tr class="${r.rowClass || ''}">
            <td>${r.idHtml}</td>
            <td>${esc(fmtDateWithAge(r.date))}</td>
            <td>${r.eventHtml}</td>
            <td>${r.statusHtml}</td>
            <td class="aa-right">${esc(r.total)}</td>
            <td>${r.detailsHtml}</td>
            <td class="aa-notes-cell">${r.notesHtml}</td>
          </tr>
          ${r.expandedNotesRow || ""}
        `).join("")
      : `<tr><td colspan="7" class="aa-muted">No activity found.</td></tr>`;

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Activity Timeline</div>
          <div class="aa-section-subtitle">Newest first • support timeline</div>
        </div>
        <div class="aa-table-wrap aa-compact-wrap">
          <table class="aa-table aa-compact-table">
            <colgroup>
              <col class="aa-col-id"><col class="aa-col-date"><col class="aa-col-type">
              <col class="aa-col-status"><col class="aa-col-total"><col class="aa-col-details"><col class="aa-col-notes">
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Event</th>
                <th>Status</th>
                <th class="aa-right">Total</th>
                <th>Summary</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${bodyHtml}
            </tbody>
          </table>
        </div>
      </section>
    `;
}

// 🔴 renderActivity.js
