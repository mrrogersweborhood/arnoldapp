// 🟢 renderRadar.js
// Arnold Admin — Radar renderer (clickable ID -> lookup)

window.renderRadar = function (data) {

  const items = Array.isArray(data?.items) ? data.items : [];

  if (!items.length) {
    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Radar</div>
          <div class="aa-section-subtitle">No current actionable problems</div>
        </div>
      </section>
    `;
  }

  const rows = items.map((r) => {

    const id = r.display_id || "";
    const name = r.customer_name || "—";
    const email = r.email || "—";
    const issue = r.issue || "—";
    const date = r.date ? new Date(r.date).toLocaleDateString() : "—";
    const reason = r.reason || "—";

    // Determine lookup query
let query = "";

if (id.toLowerCase().startsWith("order")) {
  query = id.toLowerCase();
}
else if (id.toLowerCase().startsWith("sub")) {
  query = id.toLowerCase();
}

    return `
      <tr>
        <td>
          <button
            type="button"
            class="aa-order-id aa-candidate-open-btn"
            data-open-query="${query}"
            style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
          >
            ${id}
          </button>
        </td>
        <td>${name}</td>
        <td>${email}</td>
        <td>${issue}</td>
        <td>${date}</td>
        <td>${reason}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Support Radar</div>
        <div class="aa-section-subtitle">Current actionable problems</div>
      </div>

      <div class="aa-table-wrap">
        <table class="aa-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Issue</th>
              <th>Date</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

// 🔴 renderRadar.js