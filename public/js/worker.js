/* FairShift worker app – icon-first, voice-first, works on low-end phones. */
(function () {
  'use strict';
  const { api, h, toast, speak, dictate, canDictate, deviceTranslate, money, fmtTime, fmtDate, getToken, setToken, clearToken } = window.FS;
  const I18N = window.I18N;
  const t = I18N.t;
  const ROLE = 'worker';

  const CATEGORY_ICON = { water: '💧', safety: '⚠️', wages: '💰', sanitation: '🚻', harassment: '🛑', workload: '⏱️', equipment: '⛑️', facilities: '🏠', other: '💬' };
  const STATUS_ICON = { open: '🔴', in_progress: '🟡', resolved: '🟢' };
  const TOPICS = ['manager', 'safety', 'pay', 'workload', 'facilities'];
  const FACES = ['😠', '🙁', '😐', '🙂', '😀'];

  const state = { me: null, attendance: null };
  const view = document.getElementById('view');

  const urlParams = new URLSearchParams(window.location.search);
  const demoWorkerId = urlParams.get('demo');

  async function checkAuthAndInit() {
    if (demoWorkerId && !getToken(ROLE)) {
      try {
        const res = await api('/api/auth/login', { method: 'POST', body: { id: demoWorkerId, pin: '1234', role: ROLE } });
        setToken(ROLE, res.token);
      } catch (err) {
        console.error('Demo auth failed:', err);
      }
    }

    if (!getToken(ROLE)) {
      location.replace(`/${location.hash}`);
      return;
    }

    init();
  }

  const call = (path, opts = {}) => api(path, { ...opts, role: ROLE });

  function showError(err) {
    toast(err && err.offline ? t('offline') : (err && err.message) || t('error_generic'), 'error');
  }

  /** A large "🔊 Listen" button that reads `getText()` in the worker's language. */
  function listenBtn(getText, label = t('listen'), lang) {
    return h('button', { class: 'btn btn-listen', type: 'button', onclick: () => speak(getText(), lang || I18N.lang) }, h('span', { 'aria-hidden': 'true' }, '🔊 '), label);
  }

  function section(title, ...children) {
    return h('section', { class: 'card' }, title ? h('h2', {}, title) : null, ...children);
  }

  // ---- Fatigue -------------------------------------------------------------
  function fatigueMessages(fatigue) {
    const seen = new Set();
    return fatigue.flags
      .filter((f) => (seen.has(f.type) ? false : seen.add(f.type)))
      .map((f) => t(`fatigue_${f.type}`, { ...f, date: f.date ? fmtDate(f.date, I18N.lang) : '' }));
  }

  function fatigueBanner(fatigue) {
    if (!fatigue || fatigue.level === 'ok') return null;
    const msgs = fatigueMessages(fatigue);
    const text = [t('fatigue_title'), ...msgs, t('fatigue_advice')].join('. ');
    return h(
      'section',
      { class: `alert ${fatigue.level === 'high' ? 'alert-danger' : 'alert-warn'}`, role: 'alert' },
      h('h2', {}, h('span', { 'aria-hidden': 'true' }, '😴 '), t('fatigue_title')),
      h('ul', {}, msgs.map((m) => h('li', {}, m))),
      h('p', { class: 'muted' }, t('fatigue_advice')),
      listenBtn(() => text),
    );
  }

  // ---- Home ----------------------------------------------------------------
  async function renderHome() {
    const [att, contracts] = await Promise.all([call('/api/worker/attendance'), call('/api/worker/contracts')]);
    state.attendance = att;
    const unread = contracts.contracts.filter((c) => !c.myResponse).length;
    const status = att.openShift ? t('working_since', { time: fmtTime(att.openShift.checkIn, I18N.lang) }) : t('not_checked_in');

    const tile = (hash, icon, label, badge) =>
      h('a', { class: 'tile', href: `#${hash}` }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'tile-label' }, label), badge ? h('span', { class: 'badge', 'aria-label': `${badge} ${t('new_badge')}` }, String(badge)) : null);

    view.replaceChildren(
      h('section', { class: 'hello' },
        h('h1', {}, t('hello', { name: state.me.name })),
        h('p', { class: 'muted' }, `${state.me.role} · ${state.me.site.name}`),
      ),
      fatigueBanner(att.fatigue),
      h('section', { class: `status-card ${att.openShift ? 'on' : 'off'}` },
        h('p', { class: 'status-text' }, h('span', { 'aria-hidden': 'true' }, att.openShift ? '🟢 ' : '⚪ '), status),
        h('a', { class: `btn btn-xl ${att.openShift ? 'btn-danger' : 'btn-primary'}`, href: '#attendance' }, att.openShift ? t('check_out') : t('check_in')),
      ),
      h('nav', { class: 'tile-grid', 'aria-label': t('nav_home') },
        tile('attendance', '⏱️', t('nav_attendance')),
        tile('pay', '💰', t('nav_pay')),
        tile('issues', '📢', t('nav_issues')),
        tile('notices', '📜', t('nav_notices'), unread),
        tile('skills', '🎓', t('nav_skills')),
        tile('feedback', '🙂', t('nav_feedback')),
      ),
      listenBtn(() => [t('hello', { name: state.me.name }), status, ...(att.fatigue.level !== 'ok' ? fatigueMessages(att.fatigue) : [])].join('. ')),
    );
  }

  // ---- Attendance ------------------------------------------------------------
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  }

  async function checkIn(payload) {
    await call('/api/worker/checkin', { method: 'POST', body: payload });
    toast(t('checkin_ok'), 'ok');
    speak(t('checkin_ok'), I18N.lang);
    await renderAttendance();
  }

  async function renderAttendance(autoCode) {
    const att = await call('/api/worker/attendance');
    state.attendance = att;
    const s = att.summary;

    const codeInput = h('input', { id: 'site-code', class: 'input-xl code-input', inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: '6', autocomplete: 'one-time-code', 'aria-describedby': 'code-help' });

    const scanCameraBtn = h('button', {
      type: 'button',
      class: 'btn btn-camera btn-xl',
      style: 'margin-bottom:8px;',
      onclick: () => {
        if (!window.FS_Scanner) {
          toast('Camera scanner loading...', 'warn');
          return;
        }
        window.FS_Scanner.openScanner({
          title: 'Scan Gate QR Poster',
          onScan: async (scanned) => {
            let code = scanned;
            if (scanned.includes('checkin=')) {
              code = scanned.split('checkin=')[1].slice(0, 6);
            } else if (scanned.match(/\d{6}/)) {
              code = scanned.match(/\d{6}/)[0];
            }
            code = String(code).replace(/\D/g, '').slice(0, 6);
            codeInput.value = code;
            toast(`Scanned Code: ${code}. Checking in...`, 'ok');
            try {
              await checkIn({ code });
            } catch (err) {
              showError(err);
            }
          },
        });
      },
    }, h('span', { 'aria-hidden': 'true' }, '📷 '), t('scan_qr_camera'));

    const codeForm = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      try { await checkIn({ code: codeInput.value.trim() }); } catch (err) { showError(err); }
    } },
      scanCameraBtn,
      h('div', { style: 'text-align:center; font-weight:700; color:var(--text-muted); font-size:0.85rem;' }, '— OR ENTER 6-DIGIT CODE MANUALLY —'),
      h('label', { for: 'site-code', id: 'code-help' }, t('enter_code')),
      codeInput,
      h('button', { class: 'btn btn-secondary', type: 'submit' }, t('submit')),
    );

    const mainBtn = att.openShift
      ? h('button', { class: 'btn btn-xl btn-danger', type: 'button', onclick: async () => {
          try {
            await call('/api/worker/checkout', { method: 'POST' });
            toast(t('checkout_ok'), 'ok');
            speak(t('checkout_ok'), I18N.lang);
            await renderAttendance();
          } catch (err) { showError(err); }
        } }, h('span', { 'aria-hidden': 'true' }, '🏁 '), t('check_out'))
      : h('button', { class: 'btn btn-xl btn-primary', type: 'button', onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          toast(t('checking_location'));
          try {
            const pos = await getPosition();
            await checkIn(pos);
          } catch (err) {
            if (err && err.status && err.status !== 422) showError(err);
            else toast(t('enter_code'), 'warn');
            codeInput.focus();
          } finally { btn.disabled = false; }
        } }, h('span', { 'aria-hidden': 'true' }, '📍 '), t('check_in'));

    const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));

    view.replaceChildren(
      h('h1', {}, t('nav_attendance')),
      h('section', { class: `status-card ${att.openShift ? 'on' : 'off'}` },
        h('p', { class: 'status-text' }, att.openShift ? t('working_since', { time: fmtTime(att.openShift.checkIn, I18N.lang) }) : t('not_checked_in')),
        mainBtn,
        att.openShift ? null : codeForm,
      ),
      fatigueBanner(att.fatigue),
      section(t('last_14'),
        h('div', { class: 'stats' },
          stat(t('days_worked'), String(s.daysWorked)),
          stat(t('total_hours'), String(s.totalHours)),
          stat(t('overtime_hours'), String(s.overtimeHours)),
        ),
        listenBtn(() => `${t('last_14')}. ${t('days_worked')}: ${s.daysWorked}. ${t('total_hours')}: ${s.totalHours}. ${t('overtime_hours')}: ${s.overtimeHours}.`),
      ),
      section(t('recent_shifts'),
        h('ul', { class: 'list' }, att.recent.map((r) =>
          h('li', { class: 'list-row' },
            h('span', {}, fmtDate(r.checkIn, I18N.lang)),
            h('span', { class: 'muted' }, `${fmtTime(r.checkIn, I18N.lang)} – ${fmtTime(r.checkOut, I18N.lang)}`),
            h('strong', {}, t('hours_n', { n: r.hours })),
          ))),
      ),
    );

    if (autoCode && !att.openShift) {
      codeInput.value = autoCode;
      try { await checkIn({ code: autoCode }); } catch (err) { showError(err); }
    }
  }

  // ---- Pay -----------------------------------------------------------------
  let payMonth = 'current';
  function lineText(line) {
    return t(`pay_${line.code}`, line.params);
  }

  async function renderPay() {
    const p = await call(`/api/worker/payslip?month=${payMonth}`);
    const monthBtn = (key, label) => h('button', { class: `seg-btn${payMonth === key ? ' active' : ''}`, type: 'button', 'aria-pressed': String(payMonth === key), onclick: () => { payMonth = key; route(); } }, label);

    const rows = (lines, sign) => h('ul', { class: 'pay-lines' }, lines.map((l) =>
      h('li', {}, h('span', { class: 'pay-desc' }, lineText(l)), h('strong', { class: sign === '-' ? 'neg' : 'pos' }, `${sign}${money(l.amount)}`))));

    const explanation = () => [
      `${t('net_pay')} ${money(p.net)}.`,
      `${t('earnings')}:`, ...p.earnings.map((l) => `${lineText(l)} = ${money(l.amount)}.`),
      `${t('deductions')}:`, ...p.deductions.map((l) => `${lineText(l)} = ${money(l.amount)}.`),
    ].join(' ');

    const maxH = Math.max(12, ...p.hours.perDay.map((d) => d.hours));
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': `${t('daily_hours')}: ${p.hours.totalHours} ${t('total_hours')}, ${p.hours.overtimeHours} ${t('overtime_hours')}` },
      p.hours.perDay.map((d) => h('div', { class: 'bar', title: `${d.date}: ${d.hours}h` },
        h('span', { class: 'bar-ot', style: `height:${(d.overtime / maxH) * 100}%` }),
        h('span', { class: 'bar-reg', style: `height:${(d.regular / maxH) * 100}%` }),
      )));

    view.replaceChildren(
      h('h1', {}, t('nav_pay')),
      h('div', { class: 'segmented', role: 'group' }, monthBtn('current', t('pay_this_month')), monthBtn('previous', t('pay_last_month'))),
      h('section', { class: 'net-card' },
        h('p', {}, t('net_pay')),
        h('p', { class: 'net-amount' }, money(p.net)),
        h('p', { class: 'muted' }, `${p.period} · ${t('days_worked')}: ${p.hours.daysWorked} · ${t('overtime_hours')}: ${p.hours.overtimeHours}`),
        listenBtn(explanation, t('explain_pay')),
      ),
      section(`${t('earnings')} · ${money(p.gross)}`, rows(p.earnings, '+')),
      section(`${t('deductions')} · ${money(p.totalDeductions)}`, rows(p.deductions, '-')),
      section(t('daily_hours'), bars, h('p', { class: 'legend' }, h('span', { class: 'key reg' }), t('regular'), ' ', h('span', { class: 'key ot' }), t('overtime'))),
    );
  }

  // ---- Problems ("Me too") ---------------------------------------------------
  function statusPill(status) {
    return h('span', { class: `pill status-${status}` }, h('span', { 'aria-hidden': 'true' }, `${STATUS_ICON[status]} `), t(`status_${status}`));
  }

  function noteText(note) {
    if (!note) return '';
    return typeof note === 'string' ? note : note[I18N.lang] || note.en || '';
  }

  function issueCard(issue) {
    const textEl = h('p', { class: 'issue-text', lang: issue.translated ? I18N.lang : issue.originalLang }, issue.text);
    if (!issue.translated) {
      deviceTranslate(issue.text, issue.originalLang, I18N.lang).then((tx) => {
        if (tx) { textEl.textContent = tx; textEl.lang = I18N.lang; }
      });
    }
    const supportBtn = issue.supportedByMe
      ? h('p', { class: 'supported' }, h('span', { 'aria-hidden': 'true' }, '✅ '), t('you_supported'))
      : issue.status === 'resolved'
        ? null
        : h('button', { class: 'btn btn-metoo', type: 'button', 'aria-label': `${t('me_too')}: ${issue.text}`, onclick: async (e) => {
            e.currentTarget.disabled = true;
            try {
              await call(`/api/worker/issues/${encodeURIComponent(issue.id)}/support`, { method: 'POST' });
              toast(t('support_added'), 'ok');
              speak(t('support_added'), I18N.lang);
              renderIssues();
            } catch (err) { showError(err); }
          } }, h('span', { 'aria-hidden': 'true' }, '✋ '), t('me_too'));

    const read = () => `${t(`cat_${issue.category}`)}. ${textEl.textContent}. ${t('workers_count', { n: issue.supportCount })}. ${t(`status_${issue.status}`)}.`;

    return h('article', { class: `issue-card status-${issue.status}` },
      h('div', { class: 'issue-head' },
        h('span', { class: 'issue-icon', 'aria-hidden': 'true' }, CATEGORY_ICON[issue.category] || '💬'),
        h('span', { class: 'issue-cat' }, t(`cat_${issue.category}`)),
        statusPill(issue.status),
      ),
      textEl,
      issue.translated ? null : h('p', { class: 'muted small' }, t('not_translated')),
      h('div', { class: 'issue-foot' },
        h('span', { class: 'count', 'aria-label': t('workers_count', { n: issue.supportCount }) }, h('span', { 'aria-hidden': 'true' }, '👥 '), t('workers_count', { n: issue.supportCount })),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('listen'), onclick: () => speak(read(), I18N.lang) }, '🔊'),
      ),
      supportBtn,
      issue.supportedByMe && issue.history.length > 1
        ? h('ol', { class: 'timeline' }, issue.history.map((x) => h('li', {}, statusPill(x.status), ' ', h('span', { class: 'muted small' }, fmtDate(x.at, I18N.lang)), noteText(x.note) ? h('p', {}, noteText(x.note)) : null)))
        : null,
    );
  }

  function reportForm(categories, onDone) {
    let chosen = null;
    const text = h('textarea', { id: 'issue-text', rows: '3', maxlength: '400', class: 'input-xl', 'aria-describedby': 'anon-note' });
    const grid = h('div', { class: 'cat-grid', role: 'radiogroup', 'aria-label': t('pick_category') },
      categories.map((c) => h('button', { type: 'button', class: 'cat-btn', role: 'radio', 'aria-checked': 'false', 'data-cat': c, onclick: (e) => {
        chosen = c;
        grid.querySelectorAll('.cat-btn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cat === c)));
        speak(t(`cat_${c}`), I18N.lang);
        e.currentTarget.blur();
        text.focus();
      } }, h('span', { class: 'cat-icon', 'aria-hidden': 'true' }, CATEGORY_ICON[c]), h('span', {}, t(`cat_${c}`)))));

    let stop = null;
    const micBtn = canDictate
      ? h('button', { type: 'button', class: 'btn btn-secondary', onclick: (e) => {
          const btn = e.currentTarget;
          if (stop) { stop(); return; }
          btn.textContent = `🎙️ ${t('stop')}`;
          toast(t('listening'));
          stop = dictate(I18N.lang, (txt) => { text.value = txt; }, () => { stop = null; btn.textContent = `🎤 ${t('speak')}`; });
        } }, `🎤 ${t('speak')}`)
      : null;

    return h('form', { class: 'card stack report-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!chosen) { toast(t('pick_category'), 'warn'); return; }
      const value = text.value.trim() || t(`cat_${chosen}`);
      try {
        await call('/api/worker/issues', { method: 'POST', body: { category: chosen, text: value, lang: I18N.lang } });
        toast(t('report_sent'), 'ok');
        speak(t('report_sent'), I18N.lang);
        onDone();
      } catch (err) { showError(err); }
    } },
      h('h2', {}, t('pick_category')),
      grid,
      h('label', { for: 'issue-text' }, t('describe')),
      text,
      h('div', { class: 'row' }, micBtn, h('button', { type: 'submit', class: 'btn btn-primary' }, `📤 ${t('send')}`), h('button', { type: 'button', class: 'btn btn-ghost', onclick: onDone }, t('cancel'))),
      h('p', { id: 'anon-note', class: 'anon-note' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), t('anon_note')),
    );
  }

  async function renderIssues(showForm = false) {
    const data = await call('/api/worker/issues');
    const mine = data.issues.filter((i) => i.supportedByMe);
    const others = data.issues.filter((i) => !i.supportedByMe);
    const formSlot = h('div', {});
    const openForm = () => {
      formSlot.replaceChildren(reportForm(data.categories, () => renderIssues()));
      formSlot.querySelector('.cat-btn').focus();
    };

    view.replaceChildren(
      h('h1', {}, t('nav_issues')),
      h('button', { class: 'btn btn-xl btn-primary', type: 'button', onclick: openForm }, h('span', { 'aria-hidden': 'true' }, '📢 '), t('report_problem')),
      h('p', { class: 'anon-note' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), t('anon_note')),
      formSlot,
      h('h2', {}, t('site_problems')),
      others.length ? h('div', { class: 'issue-list' }, others.map(issueCard)) : h('p', { class: 'muted' }, t('no_issues')),
      mine.length ? h('h2', {}, t('your_issues')) : null,
      mine.length ? h('div', { class: 'issue-list' }, mine.map(issueCard)) : null,
    );
    if (showForm) openForm();
  }

  // ---- Contracts read aloud --------------------------------------------------
  function contractCard(c) {
    let shownLang = c.translated ? I18N.lang : c.originalLang;
    const title = h('h2', { lang: shownLang }, c.title);
    const body = h('p', { class: 'contract-body', lang: shownLang }, c.body);
    const note = c.translated ? null : h('p', { class: 'muted small' }, t('not_translated'));

    if (!c.translated) {
      deviceTranslate(c.body, c.originalLang, I18N.lang).then((tx) => {
        if (tx) { body.textContent = tx; body.lang = I18N.lang; shownLang = I18N.lang; if (note) note.remove(); }
      });
    }

    const show = (lang) => {
      const v = c.versions[lang];
      title.textContent = v.title;
      body.textContent = v.body;
      title.lang = body.lang = lang;
      shownLang = lang;
      chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
      speak(`${v.title}. ${v.body}`, lang);
    };
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('listen_in') },
      Object.keys(c.versions).map((l) => h('button', { type: 'button', class: 'chip', 'data-lang': l, lang: l, 'aria-pressed': String(l === shownLang), onclick: () => show(l) }, `🔊 ${I18N.NATIVE[l]}`)));

    const respond = async (response) => {
      try {
        await call(`/api/worker/contracts/${encodeURIComponent(c.id)}/ack`, { method: 'POST', body: { response } });
        toast(t('response_saved'), 'ok');
        renderNotices();
      } catch (err) { showError(err); }
    };

    return h('article', { class: 'card contract' },
      h('div', { class: 'row space' }, c.myResponse ? null : h('span', { class: 'badge-new' }, t('new_badge')), h('span', { class: 'muted small' }, fmtDate(c.createdAt, I18N.lang))),
      title,
      h('button', { class: 'btn btn-listen btn-xl', type: 'button', onclick: () => speak(`${title.textContent}. ${body.textContent}`, shownLang) }, h('span', { 'aria-hidden': 'true' }, '🔊 '), t('listen')),
      body,
      note,
      h('p', { class: 'small strong' }, t('listen_in')),
      chips,
      c.myResponse
        ? h('p', { class: `ack ack-${c.myResponse}` }, t(c.myResponse === 'understood' ? 'you_said_understood' : 'you_said_doubt'))
        : h('div', { class: 'row' },
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => respond('understood') }, `👍 ${t('understood')}`),
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => respond('doubt') }, `❓ ${t('have_doubt')}`)),
    );
  }

  async function renderNotices() {
    const data = await call('/api/worker/contracts');
    view.replaceChildren(h('h1', {}, t('notices_title')), ...data.contracts.map(contractCard));
  }

  // ---- Skill passport --------------------------------------------------------
  async function renderSkills() {
    const data = await call('/api/worker/skills');
    const url = `${location.origin}/passport.html?c=${data.passportCode}`;
    const icon = { certification: '📜', training: '🧑‍🏫', experience: '🏗️' };
    view.replaceChildren(
      h('h1', {}, t('skills_title')),
      h('p', { class: 'lead' }, t('skills_note')),
      h('ul', { class: 'skill-list' }, data.skills.map((s) => h('li', { class: 'card skill' },
        h('span', { class: 'skill-icon', 'aria-hidden': 'true' }, icon[s.type] || '🎓'),
        h('div', {},
          h('p', { class: 'strong' }, s.title),
          h('p', { class: 'muted small' }, `${t(`type_${s.type}`)} · ${s.issuer} · ${fmtDate(s.issuedAt, I18N.lang)}`),
          s.verified ? h('span', { class: 'pill status-resolved' }, `✔ ${t('verified')}`) : null,
        )))),
      h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: async () => {
        try {
          if (navigator.share) await navigator.share({ title: t('skills_title'), url });
          else { await navigator.clipboard.writeText(url); toast(t('link_copied'), 'ok'); }
        } catch { /* user cancelled */ }
      } }, `🔗 ${t('share_passport')}`),
      h('p', { class: 'muted small break' }, url),
    );
  }

  // ---- Anonymous pulse feedback ---------------------------------------------
  function renderFeedback() {
    view.replaceChildren(
      h('h1', {}, t('feedback_title')),
      h('p', { class: 'anon-note' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), t('feedback_note')),
      ...TOPICS.map((topic) => {
        const row = h('div', { class: 'faces', role: 'group', 'aria-label': t(`topic_${topic}`) },
          FACES.map((face, i) => h('button', { type: 'button', class: 'face', 'aria-label': `${t(`topic_${topic}`)}: ${i + 1} / 5`, onclick: async () => {
            try {
              await call('/api/worker/feedback', { method: 'POST', body: { topic, score: i + 1 } });
              row.replaceChildren(h('p', { class: 'ack ack-understood' }, `${face} ${t('thanks_feedback')}`));
            } catch (err) { showError(err); }
          } }, face)));
        return h('section', { class: 'card' },
          h('div', { class: 'row space' }, h('h2', {}, t(`topic_${topic}`)), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('listen'), onclick: () => speak(`${t('feedback_title')} ${t(`topic_${topic}`)}`, I18N.lang) }, '🔊')),
          row);
      }),
    );
  }

  // ---- Router ----------------------------------------------------------------
  const ROUTES = { home: renderHome, attendance: renderAttendance, pay: renderPay, issues: renderIssues, notices: renderNotices, skills: renderSkills, feedback: renderFeedback };

  async function route() {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    const hash = location.hash.slice(1);
    let name = viewParam || hash.split('=')[0] || 'home';
    let autoCode = null;
    if (name === 'checkin') {
      autoCode = (hash.split('=')[1] || '').replace(/\D/g, '').slice(0, 6);
      history.replaceState(null, '', '#attendance');
      name = 'attendance';
    }
    if (!ROUTES[name]) name = 'home';
    document.querySelectorAll('.bottom-nav a').forEach((a) => {
      if (a.dataset.view === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.FS.stopSpeaking();
    try {
      await ROUTES[name](autoCode);
      view.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch (err) {
      showError(err);
    }
  }

  function setupChrome() {
    const select = document.getElementById('lang-select');
    select.replaceChildren(...I18N.LANGS.map((l) => h('option', { value: l, lang: l, selected: l === I18N.lang }, I18N.NATIVE[l])));
    select.addEventListener('change', async () => {
      try {
        await call('/api/worker/me/lang', { method: 'PUT', body: { lang: select.value } });
        I18N.setLang(select.value);
        state.me.lang = select.value;
        I18N.apply();
        route();
      } catch (err) { showError(err); }
    });
    document.getElementById('logout').addEventListener('click', () => {
      clearToken(ROLE);
      location.href = '/';
    });
  }

  async function init() {
    try {
      state.me = await call('/api/worker/me');
    } catch (err) {
      showError(err);
      return;
    }
    I18N.setLang(state.me.lang);
    I18N.apply();
    setupChrome();
    window.addEventListener('hashchange', route);
    route();
  }

  checkAuthAndInit();
})();
