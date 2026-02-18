// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-18a)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

/*
  ArnoldApp main.js (v2026-02-18a)
  - Uses ARNOLD_WORKER_BASE for /admin/nl-search
  - Sends x-arnold-token from localStorage key ARNOLD_ADMIN_TOKEN
  - Handles non-JSON error responses (e.g., 401 "Unauthorized") cleanly
*/

const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

async function runSearch() {
  const queryEl = document.getElementById("queryInput");
  const output = document.getElementById("output");

  const query = (queryEl?.value || "").trim();

  if (!query) {
    output.textContent = "Enter a search query.";
    return;
  }

  const token = (localStorage.getItem("ARNOLD_ADMIN_TOKEN") || "").trim();
  if (!token) {
    output.textContent =
      "Missing ARNOLD_ADMIN_TOKEN in this browser. Open DevTools Console and run:\n\n" +
      'localStorage.setItem("ARNOLD_ADMIN_TOKEN", "<YOUR_REAL_TOKEN>")\n\n' +
      "Then hard refresh the page and try again.";
    return;
  }

  output.textContent = "Searching…";

  try {
    const url = `${ARNOLD_WORKER_BASE}/admin/nl-search`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-arnold-token": token
      },
      body: JSON.stringify({ query })
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let payload;

    if (ct.includes("application/json")) {
      payload = await res.json().catch(() => null);
    } else {
      payload = await res.text().catch(() => "");
    }

    if (!res.ok) {
      const msg =
        typeof payload === "string"
          ? payload
          : JSON.stringify(payload, null, 2);

      output.textContent = `Error ${res.status}: ${msg}`;
      return;
    }

    output.textContent =
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  } catch (err) {
    output.textContent = "Error: " + (err?.message || String(err));
  }
}

// 🔴 main.js
// 🔴 main.js
