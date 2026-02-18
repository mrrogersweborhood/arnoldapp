// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-18b)
// Markers are comments only: 🟢 main.js ... 🔴 main.js

/* 
  ArnoldApp main.js (v2026-02-18b)
  - Calls Arnold Admin Worker: /admin/nl-search
  - Sends x-arnold-token from localStorage key ARNOLD_ADMIN_TOKEN
  - Renders user-friendly cards (with optional Raw JSON)
*/

(() => {
  'use strict';

  // IMPORTANT: keep this as the real Worker base (no placeholders)
  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const TOKEN_KEY = "ARNOLD_ADMIN_TOKEN";

  const elQ = document.getElementById('q');
  const elBtn = document.getElementById('btn');
  const elOut = document.getElementById('output');

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function prettyMoney(total, currency) {
    const t = (total === null || total === undefined) ? '' : String(total);
    const c = (currency || '').toUpperCase();
    if (!t) return '';
    return c ? `${t} ${c}` : t;
  }

  function banner(title, bodyHtml) {
    return `
      <div class="banner">
        <div class="bTitle">${escapeHtml(title)}</div>
        <div class="bBody">${bodyHtml}</div>
      </div>
    `;
  }

  function card(title, pill, rowsHtml, extraHtml) {
    return `
      <div class="resultCard">
        <div class="rcTop">
          <div class="rcTitle">${escapeHtml(title)}</div>
          ${pill ? `<div class="pill">${escapeHtml(pill)}</div>` : ``}
        </div>
        <div class="kv">${rowsHtml || ''}</div>
        ${extraHtml || ''}
      </div>
    `;
  }

  function kvRow(k, v) {
    const vv = (v === null || v === undefined || v === '') ? '—' : String(v);
    return `
      <div class="k">${escapeHtml(k)}</div>
      <div class="v">${escapeHtml(vv)}</div>
    `;
  }

  function rawDetails(payload) {
    const txt = JSON.stringify(payload, null, 2);
    return `
      <details>
        <summary>Raw JSON</summary>
        <pre>${escapeHtml(txt)}</pre>
      </details>
    `;
  }

  function getToken() {
    try { return (localStorage.getItem(TOKEN_KEY) || '').trim(); }
    catch (_) { return ''; }
  }

  function setBusy(isBusy) {
    elBtn.disabled = !!isBusy;
    elBtn.textContent = isBusy ? 'Searching…' : 'Search';
  }

  function renderPayload(payload) {
    // Always include raw details at bottom
    const raw = rawDetails(payload);

    if (!payload || typeof payload !== 'object') {
      elOut.innerHTML = card('Unexpected response', 'error', kvRow('Message', 'Response was not JSON.'), raw);
      return;
    }

    if (payload.ok !== true) {
      const rows = [
        kvRow('ok', payload.ok),
        kvRow('error', payload.error || payload.message || 'Unknown error'),
        kvRow('intent', payload.intent || '')
      ].join('');
      elOut.innerHTML = card('Request failed', 'error', rows, raw);
      return;
    }

    const intent = payload.intent || 'unknown';

    // Customer by email
    if (intent === 'customer_by_email') {
      const matches = Number(payload.matches || 0);
      const results = Array.isArray(payload.results) ? payload.results : [];
      let html = card(
        'Customer lookup',
        `${matches} match${matches === 1 ? '' : 'es'}`,
        [
          kvRow('Intent', intent),
          kvRow('Matches', matches)
        ].join('')
      );

      results.slice(0, 10).forEach((c) => {
        const displayName = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || (c?.username || 'Customer');
        html += card(
          displayName,
          `Customer #${c?.id ?? '—'}`,
          [
            kvRow('Email', c?.email || '—'),
            kvRow('Username', c?.username || '—'),
            kvRow('Role', c?.role || '—')
          ].join('')
        );
      });

      elOut.innerHTML = html + raw;
      return;
    }

    // Order by ID
    if (intent === 'order_by_id') {
      const r = payload.result || {};
      const items = Array.isArray(r.line_items) ? r.line_items : [];
      const itemsHtml = items.length
        ? `<ul class="list">${items.map(li => `<li>${escapeHtml(li?.name || '')} × ${escapeHtml(li?.quantity ?? 0)}</li>`).join('')}</ul>`
        : `<div class="hint">No line items returned.</div>`;

      elOut.innerHTML =
        card(
          `Order #${r?.id ?? '—'}`,
          r?.status || '',
          [
            kvRow('Status', r?.status || ''),
            kvRow('Total', prettyMoney(r?.total, r?.currency) || '—'),
            kvRow('Created', r?.date_created || '—'),
            kvRow('Billing email', r?.billing_email || '—')
          ].join(''),
          itemsHtml
        ) + raw;
      return;
    }

    // Subscription by email
    if (intent === 'subscription_by_email') {
      const matches = Number(payload.matches || 0);
      const results = Array.isArray(payload.results) ? payload.results : [];
      let html = card(
        'Subscriptions',
        `${matches} found`,
        [
          kvRow('Email', payload.email || '—'),
          kvRow('Customer ID', payload.customer_id || '—'),
          kvRow('Matches', matches)
        ].join('')
      );

      results.slice(0, 20).forEach((s) => {
        html += card(
          `Subscription #${s?.id ?? '—'}`,
          s?.status || '',
          [
            kvRow('Status', s?.status || '—'),
            kvRow('Total', prettyMoney(s?.total, s?.currency) || '—'),
            kvRow('Start date', s?.start_date || '—'),
            kvRow('Next payment', s?.next_payment_date || '—'),
            kvRow('End date', s?.end_date || '—'),
            kvRow('Billing email', s?.billing_email || '—')
          ].join('')
        );
      });

      elOut.innerHTML = html + raw;
      return;
    }

    // Membership by email
    if (intent === 'membership_by_email') {
      const matches = Number(payload.matches || 0);
      const results = Array.isArray(payload.results) ? payload.results : [];
      let html = card(
        'Memberships',
        `${matches} found`,
        [
          kvRow('Email', payload.email || '—'),
          kvRow('Customer ID', payload.customer_id || '—'),
          kvRow('Matches', matches)
        ].join('')
      );

      results.slice(0, 20).forEach((m) => {
        html += card(
          `Membership #${m?.id ?? '—'}`,
          m?.status || '',
          [
            kvRow('Status', m?.status || '—'),
            kvRow('Plan ID', m?.plan_id || '—'),
            kvRow('Start date', m?.start_date || '—'),
            kvRow('End date', m?.end_date || '—'),
            kvRow('Customer ID', m?.customer_id || '—')
          ].join('')
        );
      });

      elOut.innerHTML = html + raw;
      return;
    }

    // Coupon by code
    if (intent === 'coupon_by_code') {
      const r = payload.result || null;
      if (!r) {
        elOut.innerHTML = card(
          'Coupon lookup',
          'not found',
          [
            kvRow('Code', payload.code || '—'),
            kvRow('Matches returned', payload.matches ?? '0'),
            kvRow('Result', 'No exact coupon match found.')
          ].join('')
        ) + raw;
        return;
      }

      elOut.innerHTML = card(
        `Coupon “${r?.code ?? payload.code ?? ''}”`,
        r?.discount_type || '',
        [
          kvRow('Amount', r?.amount ?? '—'),
          kvRow('Discount type', r?.discount_type ?? '—'),
          kvRow('Expires', r?.date_expires ?? '—'),
          kvRow('Usage count', r?.usage_count ?? '—'),
          kvRow('Usage limit', r?.usage_limit ?? '—'),
          kvRow('Coupon ID', r?.id ?? '—')
        ].join('')
      ) + raw;
      return;
    }

    // Unknown / fallback
    elOut.innerHTML = card(
      'Result',
      intent,
      [
        kvRow('Intent', intent),
        kvRow('Note', payload.note || '—')
      ].join('')
    ) + raw;
  }

  async function runSearch() {
    const q = (elQ.value || '').trim();
    if (!q) {
      elOut.innerHTML = banner('Type a search first', 'Examples: <code>order #12997</code>, <code>subscription for joe@abc.com</code>, <code>membership for bob@abc.com</code>, <code>coupon SAVE20</code>.');
      return;
    }

    const token = getToken();
    if (!token) {
      elOut.innerHTML = banner(
        'Admin token not set for this site',
        `Open DevTools Console and run:<br><code>localStorage.setItem("${escapeHtml(TOKEN_KEY)}","YOUR_REAL_TOKEN")</code><br>Then refresh this page and try again.`
      );
      return;
    }

    setBusy(true);
    elOut.innerHTML = banner('Searching…', 'Contacting the admin worker and WooCommerce…');

    const url = `${ARNOLD_WORKER_BASE}/admin/nl-search`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arnold-token': token
        },
        body: JSON.stringify({ query: q })
      });

      // Handle non-JSON errors cleanly (e.g., "Unauthorized")
      const text = await resp.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = null; }

      if (!resp.ok) {
        if (payload) {
          renderPayload(payload);
        } else {
          elOut.innerHTML = card(
            'Request failed',
            `${resp.status}`,
            [
              kvRow('Status', resp.status),
              kvRow('Message', text || 'Request failed')
            ].join(''),
            `<details><summary>Raw response</summary><pre>${escapeHtml(text || '')}</pre></details>`
          );
        }
        return;
      }

      renderPayload(payload || { ok: false, error: 'Empty response' });
    } catch (err) {
      elOut.innerHTML = card(
        'Network error',
        'failed',
        kvRow('Message', err?.message || String(err || 'Failed to fetch')),
        ''
      );
    } finally {
      setBusy(false);
    }
  }

  // Wire up UI
  elBtn.addEventListener('click', runSearch);
  elQ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  // First paint
  elOut.innerHTML = banner(
    'Ready',
    'Search results will appear here. If you get “Admin token not set”, add it once in DevTools and refresh.'
  );
})();

// 🔴 main.js
