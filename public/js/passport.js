/* Public Verified Skill Passport Reader */
(function () {
  'use strict';
  const { api, h, fmtDate } = window.FS;

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('c') || urlParams.get('w');

  const loadingEl = document.getElementById('passport-loading');
  const contentEl = document.getElementById('passport-content');
  const errorEl = document.getElementById('passport-error');

  const TYPE_ICONS = {
    certification: '📜',
    training: '🧑‍🏫',
    experience: '🏗️',
  };

  async function loadPassport() {
    if (!code) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const data = await api(`/api/passport/${encodeURIComponent(code)}`);
      loadingEl.style.display = 'none';
      contentEl.style.display = 'flex';

      document.getElementById('worker-name').textContent = data.name;
      document.getElementById('worker-role').textContent = data.role;
      document.getElementById('worker-employer').textContent = `Current Organization: ${data.employer} (Since ${fmtDate(data.since, 'en')})`;

      const skillsList = document.getElementById('skills-list');
      skillsList.replaceChildren(
        ...data.skills.map((s) =>
          h(
            'li',
            { class: 'card skill', style: 'margin-bottom:8px;' },
            h('span', { class: 'skill-icon' }, TYPE_ICONS[s.type] || '🎓'),
            h(
              'div',
              { style: 'flex:1;' },
              h('div', { class: 'row space' },
                h('strong', {}, s.title),
                s.verified ? h('span', { class: 'pill status-resolved' }, '✔ Verified') : null,
              ),
              h('p', { class: 'muted small' }, `Issuer: ${s.issuer} · Awarded: ${fmtDate(s.issuedAt, 'en')}`),
              h('span', { class: 'small muted', style: 'text-transform:capitalize;' }, `Type: ${s.type}`),
            ),
          ),
        ),
      );
    } catch {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  }

  loadPassport();
})();
