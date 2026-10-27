/* Landing page: Sector Choice (Construction vs College/School) + Language + Login */
(function () {
  'use strict';
  const { h, api, setToken, speak } = window.FS;
  const I18N = window.I18N;

  let allDemoData = null;
  const urlParams = new URLSearchParams(window.location.search);
  let activeSector = urlParams.get('sector') || 'construction'; // 'construction' or 'college'

  function renderLanguages() {
    const grid = document.getElementById('lang-grid');
    if (!grid) return;
    grid.replaceChildren(
      ...I18N.LANGS.map((code) => {
        const selected = code === I18N.lang;
        return h(
          'div',
          { class: 'lang-option' },
          h('button', {
            class: `lang-btn${selected ? ' selected' : ''}`,
            role: 'radio',
            'aria-checked': String(selected),
            lang: code,
            text: I18N.NATIVE[code],
            onclick: () => {
              I18N.setLang(code);
              I18N.apply();
              renderLanguages();
            },
          }),
          h('button', {
            class: 'icon-btn',
            'aria-label': `${I18N.NATIVE[code]} – listen`,
            text: '🔊',
            onclick: () => {
              const prev = I18N.lang;
              I18N.setLang(code);
              speak(`${I18N.NATIVE[code]}. ${I18N.t('tagline')}`, code);
              I18N.setLang(prev);
            },
          }),
        );
      }),
    );
  }

  function setSector(sector) {
    activeSector = sector === 'college' ? 'college' : 'construction';
    
    // Update UI buttons
    const btnConstruction = document.getElementById('sector-btn-construction');
    const btnCollege = document.getElementById('sector-btn-college');
    const indicator = document.getElementById('active-sector-indicator');

    if (btnConstruction && btnCollege) {
      btnConstruction.classList.toggle('active', activeSector === 'construction');
      btnConstruction.setAttribute('aria-checked', String(activeSector === 'construction'));

      btnCollege.classList.toggle('active', activeSector === 'college');
      btnCollege.setAttribute('aria-checked', String(activeSector === 'college'));
    }

    if (indicator) {
      if (activeSector === 'construction') {
        indicator.textContent = '🏗️ Construction Active';
        indicator.className = 'pill status-resolved';
      } else {
        indicator.textContent = '🎓 College & School Active';
        indicator.className = 'pill status-open';
      }
    }

    // Pre-fill inputs with default credentials for that sector
    const wId = document.getElementById('w-id');
    const wPin = document.getElementById('w-pin');
    const aId = document.getElementById('a-id');
    const aPin = document.getElementById('a-pin');

    if (activeSector === 'construction') {
      if (wId) wId.value = 'W1001';
      if (wPin) wPin.value = '1234';
      if (aId) aId.value = 'A-BUILD';
      if (aPin) aPin.value = '9999';
    } else {
      if (wId) wId.value = 'W2001';
      if (wPin) wPin.value = '1234';
      if (aId) aId.value = 'A-COLLEGE';
      if (aPin) aPin.value = '9999';
    }

    // Filter demo lists
    renderDemoLists();
  }

  function bindLogin(formId, errorId, role, target) {
    const form = document.getElementById(formId);
    const err = document.getElementById(errorId);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const id = form.elements.id.value.trim();
      const pin = form.elements.pin.value.trim();
      if (!id || !pin) {
        err.textContent = role === 'worker' ? I18N.t('wrong_login') : 'Enter ID and PIN.';
        return;
      }
      try {
        const res = await api('/api/auth/login', { method: 'POST', body: { id, pin, role } });
        setToken(role, res.token);
        location.href = target + location.hash;
      } catch (ex) {
        err.textContent = ex.offline ? I18N.t('offline') : role === 'worker' ? I18N.t('wrong_login') : ex.message;
      }
    });
  }

  function renderDemoLists() {
    if (!allDemoData) return;
    const fill = (prefix, id, pin) => {
      document.getElementById(`${prefix}-id`).value = id;
      document.getElementById(`${prefix}-pin`).value = pin;
      document.getElementById(`${prefix}-pin`).focus();
    };

    // Filter workers by current sector
    const filteredWorkers = allDemoData.workers.filter((w) =>
      activeSector === 'construction' ? w.industry === 'construction' : w.industry === 'education',
    );

    const filteredAdmins = allDemoData.admins.filter((a) =>
      activeSector === 'construction' ? a.industry === 'construction' : a.industry === 'education',
    );

    const workerListEl = document.getElementById('demo-workers');
    if (workerListEl) {
      workerListEl.replaceChildren(
        ...filteredWorkers.map((w) =>
          h('li', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => fill('w', w.id, '1234') },
            `${w.id} · ${w.name} – ${w.role} (${w.industry === 'construction' ? '🏗️' : '🎓'} ${w.site}, ${I18N.NATIVE[w.lang]})`)),
        ),
      );
    }

    const adminListEl = document.getElementById('demo-admins');
    if (adminListEl) {
      adminListEl.replaceChildren(
        ...filteredAdmins.map((a) =>
          h('li', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => fill('a', a.id, '9999') },
            `${a.id} · ${a.name} (${a.industry === 'construction' ? '🏗️ Construction' : '🎓 College'})`)),
        ),
      );
    }
  }

  async function loadDemo() {
    try {
      allDemoData = await api('/api/auth/demo');
      setSector(activeSector);
    } catch {
      /* demo list is optional */
    }
  }

  // Setup sector buttons
  const btnConstruction = document.getElementById('sector-btn-construction');
  if (btnConstruction) {
    btnConstruction.addEventListener('click', () => setSector('construction'));
  }

  const btnCollege = document.getElementById('sector-btn-college');
  if (btnCollege) {
    btnCollege.addEventListener('click', () => setSector('college'));
  }

  I18N.apply();
  renderLanguages();
  bindLogin('worker-form', 'worker-error', 'worker', '/worker.html');
  bindLogin('admin-form', 'admin-error', 'admin', '/admin.html');
  loadDemo();

  // Camera QR Badge Login
  const cameraLoginBtn = document.getElementById('btn-camera-login');
  if (cameraLoginBtn) {
    cameraLoginBtn.addEventListener('click', () => {
      window.FS_Scanner.openScanner({
        title: 'Scan Worker Badge QR',
        onScan: (scanned) => {
          let id = '';
          let pin = '1234';

          try {
            const parsed = JSON.parse(scanned);
            if (parsed.id) id = parsed.id;
            if (parsed.pin) pin = parsed.pin;
          } catch {
            const text = String(scanned).trim();
            if (text.includes(':')) {
              const parts = text.split(':');
              id = parts[0];
              pin = parts[1];
            } else if (text.match(/W\d{4}/i)) {
              const match = text.match(/W\d{4}/i);
              id = match[0];
            } else {
              id = text;
            }
          }

          id = id.toUpperCase().trim();
          document.getElementById('w-id').value = id;
          document.getElementById('w-pin').value = pin;
          window.FS.toast(`Scanned Badge: ${id}. Logging in...`, 'ok');
          document.getElementById('worker-form').dispatchEvent(new Event('submit'));
        },
      });
    });
  }
})();
