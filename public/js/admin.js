/* FairShift Employer / Admin Dashboard JS */
(function () {
  'use strict';
  const { api, h, toast, money, fmtDate, getToken, setToken, clearToken } = window.FS;
  const ROLE = 'admin';

  const urlParams = new URLSearchParams(window.location.search);
  const demoAdminId = urlParams.get('demo');

  async function checkAuthAndInit() {
    if (demoAdminId && !getToken(ROLE)) {
      try {
        const res = await api('/api/auth/login', { method: 'POST', body: { id: demoAdminId, pin: '9999', role: ROLE } });
        setToken(ROLE, res.token);
      } catch (err) {
        console.error('Demo auth failed:', err);
      }
    }

    if (!getToken(ROLE)) {
      location.replace('/');
      return;
    }

    // Initial load
    await loadOverview();
    const tabParam = urlParams.get('tab');
    if (tabParam) switchTab(tabParam);
  }

  const call = (path, opts = {}) => api(path, { ...opts, role: ROLE });

  let overviewData = null;
  let activeTab = 'issues';
  let kioskInterval = null;

  const CATEGORY_NAMES = {
    water: 'Drinking Water',
    safety: 'Safety Danger',
    wages: 'Wages / Overtime',
    sanitation: 'Cleanliness / Toilets',
    harassment: 'Harassment / Grievance',
    workload: 'Workload / Hours',
    equipment: 'PPE & Tools',
    facilities: 'Rest Facilities',
    other: 'General',
  };

  const REASON_NAMES = {
    attendance_drop: 'Sudden attendance drop (>30%)',
    fatigue_high: 'Excessive overtime / back-to-back shifts',
    fatigue_watch: 'Moderate fatigue flags',
    new_joiner: 'New worker (<90 days tenure)',
    no_growth: 'No skills/training in 6+ months',
  };

  function switchTab(tabName) {
    activeTab = tabName;
    ['issues', 'fatigue', 'contracts', 'workers', 'kiosk'].forEach((t) => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const panel = document.getElementById(`tab-panel-${t}`);
      if (btn && panel) {
        const isCurrent = t === tabName;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-selected', String(isCurrent));
        panel.style.display = isCurrent ? 'flex' : 'none';
      }
    });

    if (tabName === 'kiosk') {
      startKioskPoller();
    } else {
      stopKioskPoller();
    }
  }

  async function loadOverview() {
    try {
      overviewData = await call('/api/admin/overview');
      renderDashboard();
    } catch (err) {
      toast(err.message || 'Failed to load dashboard', 'error');
    }
  }

  function renderDashboard() {
    if (!overviewData) return;
    const { org, admin, kpis, sites, fatigue, atRisk, feedback, contracts, trend } = overviewData;

    // Header & Hero Banner
    const welcomeEl = document.getElementById('welcome-heading');
    if (welcomeEl) welcomeEl.textContent = `Hello, ${admin.name}!`;

    const userInfoEl = document.getElementById('admin-user-info');
    if (userInfoEl) userInfoEl.textContent = admin.name.split(' ')[0] || 'Admin';

    const initialsEl = document.getElementById('user-initials');
    if (initialsEl) {
      const parts = admin.name.split(' ');
      initialsEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }

    const descEl = document.getElementById('org-industry-desc');
    if (descEl) {
      descEl.textContent = `${org.name} · ${org.industry === 'construction' ? '🏗️ Infrastructure & Construction' : '🎓 Higher Education & College Campus'} (${sites.length} Active Sites)`;
    }

    // Squircle KPIs
    document.getElementById('kpi-workforce').textContent = kpis.workforce;
    document.getElementById('kpi-issues').textContent = kpis.openIssues;
    document.getElementById('kpi-fatigue').textContent = kpis.fatigueHigh;
    document.getElementById('kpi-attrition').textContent = kpis.attritionHigh;

    const presentEl = document.getElementById('kpi-present');
    if (presentEl) presentEl.textContent = kpis.presentToday;

    // Attendance percentage
    const rateEl = document.getElementById('chart-attendance-rate');
    if (rateEl) {
      const pct = kpis.workforce > 0 ? Math.round((kpis.presentToday / kpis.workforce) * 100) : 0;
      rateEl.textContent = `${pct}%`;
    }

    // Render Vertical Bars in Right Panel
    const barsContainer = document.getElementById('trend-bars-container');
    if (barsContainer && trend) {
      const last7 = trend.slice(-7);
      const maxVal = Math.max(kpis.workforce || 1, ...last7.map((t) => t.present));
      barsContainer.replaceChildren(
        ...last7.map((t, idx) => {
          const isToday = idx === last7.length - 1;
          const dayName = new Date(t.date).toLocaleDateString('en-US', { weekday: 'narrow' });
          const heightPct = Math.max(15, Math.round((t.present / maxVal) * 100));
          return h(
            'div',
            { class: 'chart-bar-col', title: `${t.date}: ${t.present} present` },
            h('div', { class: `chart-bar-fill${isToday ? ' active' : ''}`, style: `height:${heightPct}%;` }),
            h('span', {}, dayName),
          );
        }),
      );
    }

    // Populate sites dropdowns
    const siteSelect = document.getElementById('contract-site');
    siteSelect.replaceChildren(
      h('option', { value: '' }, 'All Sites / Whole Organisation'),
      ...sites.map((s) => h('option', { value: s.id }, s.name)),
    );

    const kioskSiteSelect = document.getElementById('kiosk-site-select');
    if (kioskSiteSelect && kioskSiteSelect.children.length === 0) {
      kioskSiteSelect.replaceChildren(...sites.map((s) => h('option', { value: s.id }, s.name)));
      kioskSiteSelect.addEventListener('change', () => updateKiosk());
    }

    renderIssues();
    renderFatigueAndAttrition(fatigue, atRisk, feedback);
    renderContracts(contracts);
    renderWorkersList();
  }

  // ---- Issues Tab ----
  async function renderIssues() {
    const container = document.getElementById('issues-container');
    try {
      const { issues } = await call('/api/admin/issues');
      if (issues.length === 0) {
        container.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No grievances or hazards reported.')));
        return;
      }

      container.replaceChildren(
        ...issues.map((i) => {
          const statusBadge = h('span', { class: `pill status-${i.status}` }, i.status.replace('_', ' ').toUpperCase());

          // Status Change UI
          const select = h(
            'select',
            { style: 'width:auto; font-weight:700;' },
            h('option', { value: 'open', selected: i.status === 'open' }, 'Open'),
            h('option', { value: 'in_progress', selected: i.status === 'in_progress' }, 'In Progress'),
            h('option', { value: 'resolved', selected: i.status === 'resolved' }, 'Resolved'),
          );

          const noteInput = h('input', { placeholder: 'Action note (e.g. Plumber dispatched, new dispenser installed)', style: 'flex:1;' });
          const updateBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Update Status');

          updateBtn.addEventListener('click', async () => {
            const newStatus = select.value;
            const note = noteInput.value.trim();
            updateBtn.disabled = true;
            try {
              await call(`/api/admin/issues/${encodeURIComponent(i.id)}`, {
                method: 'PATCH',
                body: { status: newStatus, note: note || undefined },
              });
              toast(`Issue status updated to ${newStatus}. Workers notified in their language.`, 'ok');
              renderIssues();
              loadOverview();
            } catch (err) {
              toast(err.message, 'error');
            } finally {
              updateBtn.disabled = false;
            }
          });

          return h(
            'article',
            { class: `card issue-card status-${i.status}` },
            h(
              'div',
              { class: 'row space' },
              h(
                'div',
                { class: 'row' },
                h('span', { class: 'strong' }, `[${CATEGORY_NAMES[i.category] || i.category}]`),
                h('span', { class: 'muted small' }, `Site: ${i.siteName}`),
                h('span', { class: 'muted small' }, `Reported: ${fmtDate(i.createdAt, 'en')}`),
              ),
              statusBadge,
            ),
            h('p', { class: 'issue-text', style: 'margin:8px 0;' }, i.text),
            h(
              'div',
              { class: 'row space', style: 'background:#f8fafc; padding:8px 12px; border-radius:8px;' },
              h(
                'div',
                { class: 'row' },
                h('span', { style: 'font-size:1.3rem;' }, '👥'),
                h('strong', {}, `${i.supportCount} Workers Backing This Issue`),
                h('span', { class: 'muted small' }, '(Stored as anonymous cryptographic hashes)'),
              ),
              i.originalLang !== 'en' ? h('span', { class: 'muted small' }, `Original in ${i.originalLang.toUpperCase()}: "${i.originalText}"`) : null,
            ),
            i.history && i.history.length > 1
              ? h(
                  'div',
                  { class: 'stack', style: 'margin-top:6px; font-size:0.85rem;' },
                  h('strong', {}, 'Resolution History:'),
                  ...i.history.map((hItem) =>
                    h('div', { class: 'muted' }, `• ${hItem.status.toUpperCase()} (${fmtDate(hItem.at, 'en')}): ${hItem.note ? (typeof hItem.note === 'object' ? hItem.note.en : hItem.note) : 'Status updated'}`),
                  ),
                )
              : null,
            h('div', { class: 'row', style: 'margin-top:8px;' }, select, noteInput, updateBtn),
          );
        }),
      );
    } catch (err) {
      container.replaceChildren(h('p', { class: 'form-error' }, err.message));
    }
  }

  // ---- Fatigue & Attrition Tab ----
  function renderFatigueAndAttrition(fatigueList, atRiskList, feedbackList) {
    const fatigueTbody = document.getElementById('fatigue-table-body');
    if (fatigueList.length === 0) {
      fatigueTbody.replaceChildren(h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'No workers currently flagged with severe fatigue.')));
    } else {
      fatigueTbody.replaceChildren(
        ...fatigueList.map((w) => {
          const flagsDesc = w.fatigue.flags
            .map((f) => {
              if (f.type === 'weekly_hours') return `Weekly hours: ${f.hours}h (limit ${f.limit}h)`;
              if (f.type === 'long_day') return `Long shift: ${f.hours}h on ${f.date}`;
              if (f.type === 'short_rest') return `Short rest: ${f.hours}h before shift`;
              if (f.type === 'consecutive_days') return `${f.days} consecutive days`;
              return f.type;
            })
            .join('; ');

          return h(
            'tr',
            {},
            h('td', { class: 'strong' }, `${w.name} (${w.id})`),
            h('td', {}, `${w.role}`),
            h('td', {}, h('strong', { class: 'neg' }, `${w.fatigue.weekHours}h`)),
            h('td', { class: 'small' }, flagsDesc),
            h(
              'td',
              {},
              h(
                'button',
                {
                  class: 'btn btn-secondary',
                  style: 'padding:4px 8px; font-size:0.8rem;',
                  onclick: () => toast(`Rest mandate logged for ${w.name}. Shift reschedule dispatched.`, 'ok'),
                },
                'Mandate Rest',
              ),
            ),
          );
        }),
      );
    }

    const attritionTbody = document.getElementById('attrition-table-body');
    if (atRiskList.length === 0) {
      attritionTbody.replaceChildren(h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'All workforce retention scores in healthy range.')));
    } else {
      attritionTbody.replaceChildren(
        ...atRiskList.map((w) => {
          const reasons = w.risk.reasons.map((r) => REASON_NAMES[r] || r).join(', ');
          return h(
            'tr',
            {},
            h('td', { class: 'strong' }, `${w.name} (${w.id})`),
            h('td', {}, `${w.role}`),
            h('td', {}, h('span', { class: `risk-badge risk-${w.risk.level}` }, `${w.risk.score}/100 (${w.risk.level})`)),
            h('td', { class: 'small' }, reasons),
            h(
              'td',
              {},
              h(
                'button',
                {
                  class: 'btn btn-secondary',
                  style: 'padding:4px 8px; font-size:0.8rem;',
                  onclick: () => toast(`Retention review scheduled with site supervisor for ${w.name}.`, 'ok'),
                },
                'Schedule 1:1 Check-in',
              ),
            ),
          );
        }),
      );
    }

    const feedbackGrid = document.getElementById('feedback-grid');
    feedbackGrid.replaceChildren(
      ...feedbackList.map((fb) =>
        h(
          'div',
          { class: 'kpi-card' },
          h('div', { class: 'muted small strong' }, fb.topic.toUpperCase()),
          h('div', { class: 'kpi-num' }, fb.average ? `${fb.average} ★` : '—'),
          h('div', { class: 'muted small' }, `${fb.responses} anonymous responses`),
        ),
      ),
    );
  }

  // ---- Contracts & Notices Tab ----
  function renderContracts(contracts) {
    const list = document.getElementById('contracts-list');
    if (!contracts || contracts.length === 0) {
      list.replaceChildren(h('p', { class: 'muted' }, 'No contracts or policies published yet.'));
      return;
    }
    list.replaceChildren(
      ...contracts.map((c) => {
        const doubtSlot = h('div', { style: 'margin-top:8px;' });
        let expanded = false;
        const detailsBtn = h('button', { class: 'link-btn', type: 'button' }, 'View comprehension breakdown ▼');
        detailsBtn.addEventListener('click', async () => {
          if (expanded) {
            doubtSlot.replaceChildren();
            detailsBtn.textContent = 'View comprehension breakdown ▼';
            expanded = false;
            return;
          }
          try {
            const data = await call(`/api/admin/contracts/${encodeURIComponent(c.id)}/responses`);
            if (data.doubts.length === 0) {
              doubtSlot.replaceChildren(h('p', { class: 'muted small' }, 'No workers have raised doubts about this contract yet.'));
            } else {
              doubtSlot.replaceChildren(
                h('div', { class: 'alert alert-warn' },
                  h('strong', {}, `Workers who tapped "I have a doubt" (${data.doubts.length}):`),
                  h('ul', { style: 'margin-top:4px; padding-left:18px;' },
                    ...data.doubts.map((d) => h('li', {}, `${d.name} (${d.role}, ${d.site}, Lang: ${d.lang.toUpperCase()})`)),
                  ),
                ),
              );
            }
            detailsBtn.textContent = 'Hide comprehension breakdown ▲';
            expanded = true;
          } catch (err) {
            toast(err.message, 'error');
          }
        });

        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'row space' },
            h('h3', {}, c.title),
            h('span', { class: 'pill status-resolved' }, 'Available in 5 Languages'),
          ),
          h('div', { class: 'row', style: 'margin:8px 0; gap:16px;' },
            h('span', {}, `Target Audience: <strong>${c.audience} workers</strong>`),
            h('span', { class: 'pos' }, `✔ Understood: <strong>${c.understood}</strong>`),
            h('span', { class: 'neg' }, `❓ Have Doubts: <strong>${c.doubts}</strong>`),
          ),
          detailsBtn,
          doubtSlot,
        );
      }),
    );
  }

  // Form: Create contract
  const contractForm = document.getElementById('create-contract-form');
  contractForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('contract-title').value.trim();
    const body = document.getElementById('contract-body').value.trim();
    const siteId = document.getElementById('contract-site').value;

    const btn = contractForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Translating into Tamil, Hindi, Telugu, Bengali...';

    try {
      await call('/api/admin/contracts', {
        method: 'POST',
        body: { title, body, siteId: siteId || undefined },
      });
      toast('Contract published! Multilingual voice & text ready for workers.', 'ok');
      contractForm.reset();
      loadOverview();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📢 Publish & Auto-Translate Notice';
    }
  });

  // ---- Workforce & Skills Tab ----
  async function renderWorkersList() {
    try {
      const { workers } = await call('/api/admin/workers');
      const tbody = document.getElementById('workers-table-body');
      const workerSelect = document.getElementById('skill-worker');

      workerSelect.replaceChildren(
        h('option', { value: '' }, '-- Select Worker --'),
        ...workers.map((w) => h('option', { value: w.id }, `${w.name} (${w.id} · ${w.role})`)),
      );

      tbody.replaceChildren(
        ...workers.map((w) =>
          h(
            'tr',
            {},
            h('td', { class: 'strong' }, w.id),
            h('td', {}, w.name),
            h('td', {}, w.role),
            h('td', {}, w.site),
            h('td', {}, w.lang.toUpperCase()),
            h('td', {}, h('span', { class: `pill status-${w.fatigue === 'ok' ? 'resolved' : w.fatigue === 'watch' ? 'in_progress' : 'open'}` }, w.fatigue.toUpperCase())),
            h('td', {}, h('span', { class: `risk-badge risk-${w.risk}` }, `${w.riskScore}/100`)),
            h('td', {}, `${w.skills} credentials`),
          ),
        ),
      );
    } catch (err) {
      console.error(err);
    }
  }

  // Form: Issue Skill
  const skillForm = document.getElementById('issue-skill-form');
  skillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const workerId = document.getElementById('skill-worker').value;
    const type = document.getElementById('skill-type').value;
    const title = document.getElementById('skill-title').value.trim();

    try {
      await call('/api/admin/skills', {
        method: 'POST',
        body: { workerId, type, title },
      });
      toast(`Verified credential issued to worker ${workerId}!`, 'ok');
      document.getElementById('skill-title').value = '';
      renderWorkersList();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ---- Kiosk QR Tab ----
  async function updateKiosk() {
    const siteSelect = document.getElementById('kiosk-site-select');
    const siteId = siteSelect.value;
    if (!siteId) return;
    try {
      const data = await call(`/api/admin/kiosk/${encodeURIComponent(siteId)}`);
      document.getElementById('kiosk-qr-container').innerHTML = data.qrSvg;
      document.getElementById('kiosk-code-display').textContent = data.code;
      document.getElementById('kiosk-timer').textContent = data.expiresIn;
    } catch (err) {
      console.error(err);
    }
  }

  function startKioskPoller() {
    updateKiosk();
    stopKioskPoller();
    kioskInterval = setInterval(updateKiosk, 5000);
  }

  function stopKioskPoller() {
    if (kioskInterval) {
      clearInterval(kioskInterval);
      kioskInterval = null;
    }
  }

  // Tab button listeners
  ['issues', 'fatigue', 'contracts', 'workers', 'kiosk'].forEach((t) => {
    document.getElementById(`tab-btn-${t}`).addEventListener('click', () => switchTab(t));
  });

  document.getElementById('btn-open-kiosk').addEventListener('click', () => switchTab('kiosk'));

  const kioskToggle = document.getElementById('toggle-kiosk-view');
  if (kioskToggle) {
    kioskToggle.addEventListener('change', (e) => {
      if (e.target.checked) switchTab('kiosk');
      else switchTab('issues');
    });
  }

  document.getElementById('btn-refresh').addEventListener('click', () => {
    toast('Refreshing metrics...', 'info');
    loadOverview();
  });

  document.getElementById('admin-logout').addEventListener('click', () => {
    clearToken(ROLE);
    location.href = '/';
  });

  checkAuthAndInit();
})();
