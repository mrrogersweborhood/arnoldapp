// 🟢 renderActivity.js
// Arnold Admin — renderActivity extraction (Build 2026-03-10R4-splitPass3Safe)
// (Markers are comments only: 🟢 renderActivity.js ... 🔴 renderActivity.js)

function renderNotesToggle(kind, id, notes) {
  const set = kind === "sub" ? openSubNotes : openOrderNotes;
  const isOpen = set.has(id);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const arrow = isOpen ? "▼" : "▾";

  return `
    <button class="aa-notes-toggle" data-kind="${esc(kind)}" data-id="${esc(String(id))}">
      <span class="aa-notes-label">Notes</span>
      <span class="aa-notes-count">${esc(String(safeNotes.length || 0))}</span>
      <span class="aa-notes-arrow">${arrow}</span>
    </button>
  `;
}

function renderCustomerActivity(customer, subs, orders) {
  const rows = [];
  const subscriptions = Array.isArray(subs) ? subs : [];
  const orderArr = Array.isArray(orders) ? orders : [];

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
      date: customer.date_created,
      idHtml: '—',
      event: 'Customer created',
      statusHtml: '<span class="aa-muted">—</span>',
      itemsHtml: '<span class="aa-muted">—</span>',
      total: '—',
      notesHtml: '<span class="aa-muted">—</span>',
      notesRow: ''
    });
  }

  subscriptions.forEach((s) => {
    const sid = String(s?.id ?? '').trim();
    const notes = Array.isArray(s?.notes) ? s.notes : [];
    const isOpen = sid ? openSubNotes.has(sid) : false;
    rows.push({
      date: s?.start_date || s?.date_created || null,
      idHtml: sid
        ? `<div class="aa-id-wrap"><a class="aa-sub-id" href="${WOO_ADMIN}?post=${esc(sid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(sid)}</a><span class="aa-id-kind aa-id-kind-sub">SUB</span></div>`
        : '—',
      event: 'Subscription started',
      statusHtml: renderStatusPill(String(s?.status ?? '—')),
      itemsHtml: '<span class="aa-muted">—</span>',
      total: '—',
      notesHtml: renderNotesToggle('sub', sid || 'sub', notes),
      notesRow: isOpen
        ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${buildNotesHtml(notes)}</div></td></tr>`
        : ''
    });
  });

  orderArr.forEach((o) => {
    const oid = String(o?.id ?? '').trim();
    const status = String(o?.status ?? '');
    let event = 'Order';
    if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'processing') event = 'Renewal';
    if (isProblemOrderStatus(status)) event = 'Problem order';
    const maybeParent = subscriptions.find((s) => String(s?.parent_id ?? '').trim() === oid);
    if (maybeParent) event = 'Parent order';
    const orderItems = getOrderItemsSummary(o).text;
    const notes = Array.isArray(o?.notes) ? o.notes : [];
    const isOpen = oid ? openOrderNotes.has(oid) : false;
    rows.push({
      date: o?.date_created || null,
      idHtml: oid
        ? `<div class="aa-id-wrap"><a class="aa-order-id" href="${WOO_ADMIN}?post=${esc(oid)}&action=edit" target="_blank" rel="noopener noreferrer">#${esc(oid)}</a><span class="aa-id-kind aa-id-kind-order">ORDER</span></div>`
        : '—',
      event,
      statusHtml: status ? renderStatusPill(status) : '<span class="aa-muted">—</span>',
      itemsHtml: esc(orderItems || '—'),
      total: fmtMoney(o?.total, o?.currency),
      notesHtml: renderNotesToggle('order', oid || 'order', notes),
      notesRow: isOpen
        ? `<tr class="aa-notes-row"><td colspan="7"><div class="aa-notes-box">${buildNotesHtml(notes)}</div></td></tr>`
        : ''
    });
  });

  rows.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

  const body = rows.length ? rows.map((r) => `
    <tr>
      <td>${r.idHtml}</td>
      <td>${esc(fmtDateWithAge(r.date))}</td>
      <td>${esc(r.event || '—')}</td>
      <td>${r.statusHtml}</td>
      <td>${r.itemsHtml}</td>
      <td class="aa-right">${esc(r.total || '—')}</td>
      <td class="aa-notes-cell">${r.notesHtml}</td>
    </tr>
    ${r.notesRow || ''}
  `).join('') : `<tr><td colspan="7" class="aa-muted">No activity found.</td></tr>`;

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Customer Activity</div>
        <div class="aa-section-subtitle">Newest first</div>
      </div>
      <div class="aa-table-wrap">
        <table class="aa-table" style="min-width:1120px; table-layout:fixed;">
          <colgroup>
            <col style="width:220px;">
            <col style="width:210px;">
            <col style="width:180px;">
            <col style="width:160px;">
            <col style="width:auto;">
            <col style="width:120px;">
            <col style="width:150px;">
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Event</th>
              <th>Status</th>
              <th>Items</th>
              <th class="aa-right">Total</th>
              <th class="aa-notes-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// 🔴 renderActivity.js
