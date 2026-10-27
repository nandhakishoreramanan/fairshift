'use strict';

/**
 * Demo seed data for two industries:
 *   1. Construction – BuildRight Infra (two sites)
 *   2. Education    – Sunrise College (one campus)
 *
 * All data is synthetic. Attendance is generated with a deterministic PRNG so
 * dashboards look realistic and tests are repeatable.
 */
const crypto = require('node:crypto');
const { anonToken, coarseTimestamp } = require('../lib/anon');
const { hashPin } = require('../lib/auth');
const { dayKey } = require('../lib/hours');

const DAY_MS = 24 * 3600 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Demo PINs – overridable via env so real deployments never rely on defaults. */
const DEMO_WORKER_PIN = process.env.DEMO_WORKER_PIN || '1234';
const DEMO_ADMIN_PIN = process.env.DEMO_ADMIN_PIN || '9999';

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO timestamp for an IST wall-clock time `daysAgo` days before `now`. */
function istTime(now, daysAgo, hour, minute) {
  const [y, m, d] = dayKey(new Date(now).toISOString()).split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d - daysAgo, hour, minute) - IST_OFFSET_MS;
  return new Date(utc).toISOString();
}

const ORGS = [
  { id: 'org-build', name: 'BuildRight Infra Pvt Ltd', industry: 'construction' },
  { id: 'org-college', name: 'Sunrise Arts & Science College', industry: 'education' },
];

const SITES = [
  { id: 'site-omr', orgId: 'org-build', name: 'Tower B, OMR Chennai', lat: 12.901, lng: 80.2279, radiusM: 400 },
  { id: 'site-whf', orgId: 'org-build', name: 'Metro Depot, Whitefield Bengaluru', lat: 12.9698, lng: 77.75, radiusM: 400 },
  { id: 'site-campus', orgId: 'org-college', name: 'Sunrise College Campus, Tambaram', lat: 12.9249, lng: 80.1, radiusM: 500 },
];

/** Featured, log-in-able demo workers. `profile` drives attendance generation. */
const FEATURED = [
  { id: 'W1001', name: 'Murugan S', role: 'Mason', siteId: 'site-omr', lang: 'ta', payType: 'daily', dailyWage: 900, joinedDaysAgo: 760, profile: 'overworked', pf: true, esi: true, allowances: [{ key: 'food', amount: 1200 }] },
  { id: 'W1002', name: 'Ramesh Yadav', role: 'Helper', siteId: 'site-omr', lang: 'hi', payType: 'daily', dailyWage: 650, joinedDaysAgo: 55, profile: 'declining', pf: true, esi: true, allowances: [{ key: 'travel', amount: 600 }] },
  { id: 'W1003', name: 'Shilpi Das', role: 'Bar Bender', siteId: 'site-omr', lang: 'bn', payType: 'daily', dailyWage: 750, joinedDaysAgo: 400, profile: 'normal', pf: true, esi: true, allowances: [] },
  { id: 'W1004', name: 'Venkat Rao', role: 'Electrician', siteId: 'site-whf', lang: 'te', payType: 'daily', dailyWage: 1000, joinedDaysAgo: 300, profile: 'normal', pf: true, esi: true, allowances: [{ key: 'tools', amount: 500 }] },
  { id: 'W2001', name: 'Lakshmi Priya', role: 'Guest Lecturer', siteId: 'site-campus', lang: 'ta', payType: 'monthly', monthlySalary: 28000, joinedDaysAgo: 420, profile: 'overworked', pf: true, esi: false, allowances: [{ key: 'invigilation', amount: 1500 }] },
  { id: 'W2002', name: 'Sunita Devi', role: 'Housekeeping', siteId: 'site-campus', lang: 'hi', payType: 'monthly', monthlySalary: 14000, joinedDaysAgo: 900, profile: 'normal', pf: true, esi: true, allowances: [] },
  { id: 'W2003', name: 'Anil Kumar', role: 'Lab Assistant', siteId: 'site-campus', lang: 'te', payType: 'monthly', monthlySalary: 18000, joinedDaysAgo: 70, profile: 'declining', pf: true, esi: true, allowances: [] },
];

const FILLER_NAMES = [
  'Arjun', 'Bhavani', 'Chandru', 'Deepa', 'Elango', 'Farida', 'Gopal', 'Hari', 'Indu', 'Jagan',
  'Kavitha', 'Lokesh', 'Manoj', 'Nirmala', 'Om Prakash', 'Pooja', 'Raju', 'Selvi', 'Tarun', 'Usha',
  'Vijay', 'Wasim', 'Yamuna', 'Zakir', 'Abdul', 'Bimla', 'Dinesh', 'Ganga', 'Iqbal', 'Kumar',
];
const FILLER_PLAN = [
  { siteId: 'site-omr', count: 18, roles: ['Mason', 'Helper', 'Carpenter', 'Welder'], payType: 'daily', wage: [600, 950] },
  { siteId: 'site-whf', count: 10, roles: ['Helper', 'Electrician', 'Plumber'], payType: 'daily', wage: [650, 1000] },
  { siteId: 'site-campus', count: 16, roles: ['Assistant Professor', 'Housekeeping', 'Security', 'Office Staff'], payType: 'monthly', wage: [13000, 45000] },
];
const FILLER_LANGS = ['ta', 'hi', 'te', 'bn', 'en'];

function buildWorkers(rand, now, pinHash) {
  const siteOrg = Object.fromEntries(SITES.map((s) => [s.id, s.orgId]));
  const workers = FEATURED.map((f) => ({
    ...f,
    orgId: siteOrg[f.siteId],
    joinedAt: new Date(now - f.joinedDaysAgo * DAY_MS).toISOString(),
    pinHash,
    passportCode: crypto.randomBytes(6).toString('hex'),
    featured: true,
  }));

  let n = 0;
  for (const plan of FILLER_PLAN) {
    for (let i = 0; i < plan.count; i += 1) {
      const name = `${FILLER_NAMES[n % FILLER_NAMES.length]} ${String.fromCharCode(65 + (n % 26))}.`;
      const wage = Math.round((plan.wage[0] + rand() * (plan.wage[1] - plan.wage[0])) / 50) * 50;
      const r = rand();
      workers.push({
        id: `W${3000 + n}`,
        name,
        role: plan.roles[i % plan.roles.length],
        siteId: plan.siteId,
        orgId: siteOrg[plan.siteId],
        lang: FILLER_LANGS[n % FILLER_LANGS.length],
        payType: plan.payType,
        ...(plan.payType === 'daily' ? { dailyWage: wage } : { monthlySalary: wage }),
        joinedAt: new Date(now - Math.floor(30 + rand() * 1200) * DAY_MS).toISOString(),
        profile: r < 0.15 ? 'overworked' : r < 0.27 ? 'declining' : 'normal',
        pf: true,
        esi: wage < 21000 || plan.payType === 'daily',
        allowances: [],
        pinHash,
        passportCode: crypto.randomBytes(6).toString('hex'),
        featured: false,
      });
      n += 1;
    }
  }
  return workers;
}

function buildAttendance(rand, now, workers) {
  const records = [];
  const DAYS = 35;
  for (const w of workers) {
    const isCollege = w.siteId === 'site-campus';
    for (let ago = DAYS; ago >= 1; ago -= 1) {
      const weekday = new Date(istTime(now, ago, 12, 0)).getUTCDay();
      let works = isCollege ? weekday !== 0 : weekday !== 0 || rand() < 0.15;
      let startH = isCollege ? 8 : 7;
      let length = isCollege ? 7.5 + rand() * 1.5 : 8 + rand() * 1.5;

      if (w.profile === 'overworked' && ago <= 14) {
        works = true;
        length = isCollege ? 10.5 + rand() * 2.5 : 11 + rand() * 2.5;
        if (!isCollege && ago % 3 === 0) startH = 5; // early start after late finish -> short rest
      }
      if (w.profile === 'declining' && ago <= 14 && rand() < 0.5) works = false;
      if (!works || rand() < 0.04) continue;

      const startM = Math.floor(rand() * 40);
      const checkIn = istTime(now, ago, startH, startM);
      const checkOut = new Date(new Date(checkIn).getTime() + length * 3600 * 1000).toISOString();
      records.push({ id: `A${records.length + 1}`, workerId: w.id, siteId: w.siteId, checkIn, checkOut, method: rand() < 0.7 ? 'qr' : 'gps' });
    }
    // Most non-featured workers are on shift right now so "present today" looks live.
    if (!w.featured && rand() < 0.8) {
      records.push({
        id: `A${records.length + 1}`,
        workerId: w.id,
        siteId: w.siteId,
        checkIn: istTime(now, 0, w.siteId === 'site-campus' ? 8 : 7, Math.floor(rand() * 40)),
        checkOut: null,
        method: 'qr',
      });
    }
  }
  return records;
}

const ISSUE_SEEDS = [
  {
    siteId: 'site-omr', category: 'water', status: 'open', supporters: 15, daysAgo: 2,
    text: {
      en: 'No drinking water at Block C since Monday',
      hi: 'सोमवार से ब्लॉक C में पीने का पानी नहीं है',
      ta: 'திங்கள் முதல் பிளாக் C-ல் குடிநீர் இல்லை',
      te: 'సోమవారం నుండి బ్లాక్ C లో తాగునీరు లేదు',
      bn: 'সোমবার থেকে ব্লক C-তে পানীয় জল নেই',
    },
    originalLang: 'ta',
  },
  {
    siteId: 'site-omr', category: 'safety', status: 'in_progress', supporters: 9, daysAgo: 4,
    text: {
      en: 'Scaffolding on 4th floor is loose, no safety net',
      hi: 'चौथी मंजिल पर मचान ढीला है, सुरक्षा जाल नहीं है',
      ta: '4வது மாடியில் சாரம் தளர்வாக உள்ளது, பாதுகாப்பு வலை இல்லை',
      te: '4వ అంతస్తులో పరంజా వదులుగా ఉంది, భద్రతా వల లేదు',
      bn: 'চারতলায় ভারা আলগা, কোনো সুরক্ষা জাল নেই',
    },
    originalLang: 'hi',
  },
  {
    siteId: 'site-omr', category: 'wages', status: 'open', supporters: 6, daysAgo: 6,
    text: {
      en: 'Overtime for Sunday work not paid last month',
      hi: 'पिछले महीने रविवार के काम का ओवरटाइम नहीं मिला',
      ta: 'கடந்த மாதம் ஞாயிறு வேலைக்கான கூடுதல் நேர ஊதியம் வழங்கப்படவில்லை',
      te: 'గత నెల ఆదివారం పనికి ఓవర్‌టైమ్ చెల్లించలేదు',
      bn: 'গত মাসে রবিবারের কাজের ওভারটাইম দেওয়া হয়নি',
    },
    originalLang: 'hi',
  },
  {
    siteId: 'site-omr', category: 'sanitation', status: 'resolved', supporters: 11, daysAgo: 12,
    text: {
      en: 'Toilets near labour camp are not cleaned',
      hi: 'लेबर कैंप के पास शौचालय साफ नहीं होते',
      ta: 'தொழிலாளர் முகாம் அருகே கழிப்பறைகள் சுத்தம் செய்யப்படுவதில்லை',
      te: 'లేబర్ క్యాంప్ దగ్గర మరుగుదొడ్లు శుభ్రం చేయడం లేదు',
      bn: 'শ্রমিক শিবিরের কাছে শৌচাগার পরিষ্কার করা হয় না',
    },
    originalLang: 'bn',
  },
  {
    siteId: 'site-whf', category: 'equipment', status: 'open', supporters: 4, daysAgo: 3,
    text: {
      en: 'Not enough helmets and gloves for new workers',
      hi: 'नए मजदूरों के लिए पर्याप्त हेलमेट और दस्ताने नहीं हैं',
      ta: 'புதிய தொழிலாளர்களுக்கு போதுமான தலைக்கவசங்களும் கையுறைகளும் இல்லை',
      te: 'కొత్త కార్మికులకు సరిపడా హెల్మెట్లు, చేతి తొడుగులు లేవు',
      bn: 'নতুন শ্রমিকদের জন্য যথেষ্ট হেলমেট ও দস্তানা নেই',
    },
    originalLang: 'te',
  },
  {
    siteId: 'site-campus', category: 'workload', status: 'open', supporters: 8, daysAgo: 5,
    text: {
      en: 'Guest lecturers asked to invigilate without extra pay',
      hi: 'अतिथि व्याख्याताओं से बिना अतिरिक्त वेतन के परीक्षा निरीक्षण कराया जा रहा है',
      ta: 'கௌரவ விரிவுரையாளர்கள் கூடுதல் ஊதியம் இல்லாமல் தேர்வு கண்காணிப்புக்கு அழைக்கப்படுகின்றனர்',
      te: 'అతిథి అధ్యాపకులను అదనపు జీతం లేకుండా పరీక్షల పర్యవేక్షణకు అడుగుతున్నారు',
      bn: 'অতিথি প্রভাষকদের অতিরিক্ত বেতন ছাড়াই পরীক্ষা পাহারা দিতে বলা হচ্ছে',
    },
    originalLang: 'en',
  },
  {
    siteId: 'site-campus', category: 'safety', status: 'in_progress', supporters: 5, daysAgo: 7,
    text: {
      en: 'Chemistry lab fire extinguisher has expired',
      hi: 'रसायन प्रयोगशाला का अग्निशामक यंत्र एक्सपायर हो गया है',
      ta: 'வேதியியல் ஆய்வகத்தின் தீயணைப்பான் காலாவதியாகிவிட்டது',
      te: 'కెమిస్ట్రీ ల్యాబ్ అగ్నిమాపక యంత్రం గడువు ముగిసింది',
      bn: 'রসায়ন ল্যাবের অগ্নিনির্বাপক যন্ত্রের মেয়াদ শেষ',
    },
    originalLang: 'en',
  },
  {
    siteId: 'site-campus', category: 'facilities', status: 'open', supporters: 12, daysAgo: 9,
    text: {
      en: 'Housekeeping staff have no rest room',
      hi: 'सफाई कर्मचारियों के लिए कोई विश्राम कक्ष नहीं है',
      ta: 'துப்புரவுப் பணியாளர்களுக்கு ஓய்வு அறை இல்லை',
      te: 'హౌస్‌కీపింగ్ సిబ్బందికి విశ్రాంతి గది లేదు',
      bn: 'পরিচ্ছন্নতা কর্মীদের জন্য কোনো বিশ্রাম কক্ষ নেই',
    },
    originalLang: 'hi',
  },
];

function buildIssues(now, workers, anonSecret) {
  return ISSUE_SEEDS.map((seed, i) => {
    const id = `I${100 + i}`;
    // Pick supporters among non-featured workers on the same site, so demo
    // logins can still tap "Me too" themselves.
    const pool = workers.filter((w) => w.siteId === seed.siteId && !w.featured);
    const tokens = pool.slice(0, seed.supporters).map((w) => anonToken(anonSecret, w.id, id));
    const created = coarseTimestamp(now - seed.daysAgo * DAY_MS);
    const history = [{ status: 'open', at: created }];
    if (seed.status !== 'open') history.push({ status: 'in_progress', at: coarseTimestamp(now - (seed.daysAgo - 1) * DAY_MS), note: 'Site engineer assigned' });
    if (seed.status === 'resolved') history.push({ status: 'resolved', at: coarseTimestamp(now - 2 * DAY_MS), note: 'Cleaning contractor now visits twice daily' });
    return {
      id,
      orgId: SITES.find((s) => s.id === seed.siteId).orgId,
      siteId: seed.siteId,
      category: seed.category,
      text: seed.text,
      originalLang: seed.originalLang,
      status: seed.status,
      createdAt: created,
      updatedAt: history[history.length - 1].at,
      supporterTokens: tokens,
      supportCount: tokens.length,
      history,
    };
  });
}

const CONTRACT_SEEDS = [
  {
    id: 'C1', orgId: 'org-build', siteId: null, daysAgo: 3,
    title: {
      en: 'Overtime & Rest Policy – November 2026',
      hi: 'ओवरटाइम और विश्राम नीति – नवंबर 2026',
      ta: 'கூடுதல் நேரம் மற்றும் ஓய்வுக் கொள்கை – நவம்பர் 2026',
      te: 'ఓవర్‌టైమ్ & విశ్రాంతి విధానం – నవంబర్ 2026',
      bn: 'ওভারটাইম ও বিশ্রাম নীতি – নভেম্বর ২০২৬',
    },
    body: {
      en: 'From 1 November, overtime will be paid at twice the normal hourly rate. No worker will be asked to work more than 12 hours in a day. Every worker gets at least one paid weekly holiday. Drinking water and shade will be provided on every floor.',
      hi: '1 नवंबर से ओवरटाइम सामान्य प्रति घंटा दर से दोगुना दिया जाएगा। किसी भी कर्मचारी से एक दिन में 12 घंटे से अधिक काम नहीं कराया जाएगा। हर कर्मचारी को हर हफ्ते कम से कम एक सवेतन छुट्टी मिलेगी। हर मंजिल पर पीने का पानी और छाया उपलब्ध कराई जाएगी।',
      ta: 'நவம்பர் 1 முதல், கூடுதல் நேர வேலைக்கு வழக்கமான மணிநேர ஊதியத்தின் இரண்டு மடங்கு வழங்கப்படும். எந்தத் தொழிலாளரும் ஒரு நாளில் 12 மணி நேரத்திற்கு மேல் வேலை செய்யக் கேட்கப்பட மாட்டார். ஒவ்வொரு தொழிலாளருக்கும் வாரத்திற்கு குறைந்தது ஒரு நாள் ஊதியத்துடன் கூடிய விடுமுறை உண்டு. ஒவ்வொரு தளத்திலும் குடிநீர் மற்றும் நிழல் வழங்கப்படும்.',
      te: 'నవంబర్ 1 నుండి, ఓవర్‌టైమ్‌కు సాధారణ గంట రేటుకు రెట్టింపు చెల్లిస్తారు. ఏ కార్మికుడినీ రోజుకు 12 గంటలకు మించి పని చేయమని అడగరు. ప్రతి కార్మికుడికి వారానికి కనీసం ఒక వేతనంతో కూడిన సెలవు ఉంటుంది. ప్రతి అంతస్తులో తాగునీరు మరియు నీడ అందించబడుతుంది.',
      bn: '১ নভেম্বর থেকে ওভারটাইম স্বাভাবিক ঘণ্টাপ্রতি হারের দ্বিগুণ দেওয়া হবে। কোনো শ্রমিককে দিনে ১২ ঘণ্টার বেশি কাজ করতে বলা হবে না। প্রত্যেক শ্রমিক সপ্তাহে অন্তত একদিন সবেতন ছুটি পাবেন। প্রতিটি তলায় পানীয় জল ও ছায়ার ব্যবস্থা থাকবে।',
    },
  },
  {
    id: 'C2', orgId: 'org-college', siteId: null, daysAgo: 6,
    title: {
      en: 'Contract Renewal – Academic Year 2026–27',
      hi: 'अनुबंध नवीनीकरण – शैक्षणिक वर्ष 2026–27',
      ta: 'ஒப்பந்தப் புதுப்பிப்பு – கல்வியாண்டு 2026–27',
      te: 'ఒప్పంద పునరుద్ధరణ – విద్యా సంవత్సరం 2026–27',
      bn: 'চুক্তি নবীকরণ – শিক্ষাবর্ষ ২০২৬–২৭',
    },
    body: {
      en: 'Your contract is renewed for the academic year 2026–27. Salary will be credited on the 5th of every month. Exam invigilation duty will be paid ₹500 per session. You are entitled to 12 days of casual leave per year.',
      hi: 'आपका अनुबंध शैक्षणिक वर्ष 2026–27 के लिए नवीनीकृत किया गया है। वेतन हर महीने की 5 तारीख को जमा किया जाएगा। परीक्षा निरीक्षण ड्यूटी के लिए प्रति सत्र ₹500 का भुगतान किया जाएगा। आपको प्रति वर्ष 12 दिन की आकस्मिक छुट्टी का अधिकार है।',
      ta: 'உங்கள் ஒப்பந்தம் 2026–27 கல்வியாண்டுக்கு புதுப்பிக்கப்பட்டுள்ளது. ஒவ்வொரு மாதமும் 5ஆம் தேதி சம்பளம் வரவு வைக்கப்படும். தேர்வு கண்காணிப்புப் பணிக்கு ஒரு அமர்வுக்கு ₹500 வழங்கப்படும். உங்களுக்கு ஆண்டுக்கு 12 நாட்கள் தற்செயல் விடுப்பு உரிமை உண்டு.',
      te: 'మీ ఒప్పందం 2026–27 విద్యా సంవత్సరానికి పునరుద్ధరించబడింది. ప్రతి నెల 5వ తేదీన జీతం జమ చేయబడుతుంది. పరీక్షల పర్యవేక్షణ విధికి ఒక్కో సెషన్‌కు ₹500 చెల్లిస్తారు. మీకు సంవత్సరానికి 12 రోజుల సాధారణ సెలవు హక్కు ఉంది.',
      bn: 'আপনার চুক্তি ২০২৬–২৭ শিক্ষাবর্ষের জন্য নবীকরণ করা হয়েছে। প্রতি মাসের ৫ তারিখে বেতন জমা হবে। পরীক্ষা পাহারার দায়িত্বের জন্য প্রতি সেশনে ₹৫০০ দেওয়া হবে। আপনি বছরে ১২ দিনের নৈমিত্তিক ছুটির অধিকারী।',
    },
  },
];

function buildContracts(now, workers) {
  const contracts = CONTRACT_SEEDS.map((c) => ({
    id: c.id,
    orgId: c.orgId,
    siteId: c.siteId,
    title: c.title,
    body: c.body,
    originalLang: 'en',
    createdAt: new Date(now - c.daysAgo * DAY_MS).toISOString(),
  }));
  // Some filler workers already acknowledged; featured workers have not (so the demo shows "new").
  const acks = [];
  workers
    .filter((w) => !w.featured)
    .forEach((w, i) => {
      const c = contracts.find((x) => x.orgId === w.orgId);
      if (i % 3 === 2) return;
      acks.push({ contractId: c.id, workerId: w.id, response: i % 7 === 0 ? 'doubt' : 'understood', at: new Date(now - DAY_MS).toISOString() });
    });
  return { contracts, acks };
}

const SKILL_SEEDS = {
  W1001: [
    { title: 'Brick & Block Masonry – Level 4', issuer: 'Construction Skill Development Council of India', type: 'certification', daysAgo: 500 },
    { title: 'Working at Height – Safety Training', issuer: 'BuildRight Infra (Safety Dept.)', type: 'training', daysAgo: 120 },
    { title: '6 years masonry experience, 3 high-rise projects', issuer: 'BuildRight Infra', type: 'experience', daysAgo: 30 },
  ],
  W1002: [{ title: 'Site Safety Induction', issuer: 'BuildRight Infra (Safety Dept.)', type: 'training', daysAgo: 50 }],
  W1003: [{ title: 'Bar Bending & Steel Fixing – Level 3', issuer: 'CSDCI / PMKVY', type: 'certification', daysAgo: 300 }],
  W1004: [{ title: 'Wireman Licence', issuer: 'Karnataka Electrical Licensing Board', type: 'certification', daysAgo: 900 }],
  W2001: [
    { title: 'UGC-NET – Commerce', issuer: 'National Testing Agency', type: 'certification', daysAgo: 1100 },
    { title: 'Faculty Development Programme – Outcome Based Education', issuer: 'Sunrise College', type: 'training', daysAgo: 60 },
  ],
  W2002: [{ title: 'Hygiene & Housekeeping Practices', issuer: 'Sunrise College', type: 'training', daysAgo: 200 }],
  W2003: [{ title: 'Lab Safety & Chemical Handling', issuer: 'Sunrise College', type: 'training', daysAgo: 40 }],
};

function buildSkills(now) {
  const skills = [];
  for (const [workerId, list] of Object.entries(SKILL_SEEDS)) {
    for (const s of list) {
      const issuedAt = new Date(now - s.daysAgo * DAY_MS).toISOString();
      skills.push({ id: `S${skills.length + 1}`, workerId, title: s.title, issuer: s.issuer, type: s.type, issuedAt, verified: true });
    }
  }
  return skills;
}

const FEEDBACK_TOPICS = ['manager', 'safety', 'pay', 'workload', 'facilities'];

function buildFeedback(rand, now) {
  const items = [];
  const bias = { 'site-omr': { safety: -1.2, facilities: -1 }, 'site-whf': { pay: -0.5 }, 'site-campus': { workload: -1.3, pay: -0.6 } };
  for (const site of SITES) {
    for (let week = 0; week < 4; week += 1) {
      for (const topic of FEEDBACK_TOPICS) {
        const n = 3 + Math.floor(rand() * 4);
        for (let k = 0; k < n; k += 1) {
          const base = 3.6 + (bias[site.id]?.[topic] || 0) + (rand() - 0.5) * 2;
          items.push({ orgId: site.orgId, siteId: site.id, topic, score: Math.max(1, Math.min(5, Math.round(base))), at: coarseTimestamp(now - week * 7 * DAY_MS) });
        }
      }
    }
  }
  return items;
}

function buildAdmins(pinHash) {
  return [
    { id: 'A-BUILD', orgId: 'org-build', name: 'Priya Menon (HR, BuildRight)', pinHash },
    { id: 'A-COLLEGE', orgId: 'org-college', name: 'Dr. K. Raman (Registrar, Sunrise)', pinHash },
  ];
}

/** Build a fresh, fully seeded data set. */
function seed({ now = Date.now(), anonSecret }) {
  const rand = mulberry32(8);
  const workerPinHash = hashPin(DEMO_WORKER_PIN);
  const adminPinHash = hashPin(DEMO_ADMIN_PIN);
  const workers = buildWorkers(rand, now, workerPinHash);
  const { contracts, acks } = buildContracts(now, workers);
  return {
    orgs: ORGS.map((o) => ({ ...o })),
    sites: SITES.map((s) => ({ ...s })),
    workers,
    admins: buildAdmins(adminPinHash),
    attendance: buildAttendance(rand, now, workers),
    issues: buildIssues(now, workers, anonSecret),
    contracts,
    acks,
    skills: buildSkills(now),
    feedback: buildFeedback(rand, now),
  };
}

module.exports = { seed, FEEDBACK_TOPICS, DEMO_WORKER_PIN, DEMO_ADMIN_PIN };
