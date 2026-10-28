'use strict';
/* =========================================================
   Ledgerline — core: utilities, data model, import parsing,
   categorization, analytics, demo data, persistence
   ========================================================= */
const IS_DOM = typeof document !== 'undefined';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(n, cents) { n = Number(n) || 0; const s = (cents ? USD2 : USD0).format(Math.abs(n)); return (n < -0.004 ? '−' : '') + s; }
function signedMoney(n) { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + USD2.format(Math.abs(n)); }
function compact(n) { const a = Math.abs(n), s = n < 0 ? '−' : ''; if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e4) return s + '$' + Math.round(a / 1e3) + 'k'; if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(1) + 'k'; return s + '$' + Math.round(a); }
const pad = n => String(n).padStart(2, '0');
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function toD(s) { return new Date(s + 'T12:00:00'); }
function addDays(s, n) { const d = toD(s); d.setDate(d.getDate() + n); return iso(d); }
function daysBetween(a, b) { return Math.round((toD(b) - toD(a)) / 86400000); }
const mKey = s => s.slice(0, 7);
function addMonths(m, n) { let y = +m.slice(0, 4), mo = +m.slice(5, 7) + n; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return y + '-' + pad(mo); }
function addMonthsDate(s, n) { const m = addMonths(mKey(s), n); const d = Math.min(+s.slice(8, 10), daysInMonth(m)); return m + '-' + pad(d); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function mLabel(m, long) { return (long ? MONL : MON)[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
function mShort(m) { return MON[+m.slice(5, 7) - 1]; }
function daysInMonth(m) { return new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); }
function dLabel(s) { return toD(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function dShort(s) { return toD(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
const TODAY = iso(new Date());
const THIS_MONTH = mKey(TODAY);
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
function sumBy(a, f) { let t = 0; for (const x of a) t += (typeof f === 'function' ? f(x) : x[f]) || 0; return t; }
function titleCase(s) { return String(s).toLowerCase().replace(/(^|[\s\-\/&(])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/* ---------- Categories ---------- */
const GROUPS = { income: 'Income', needs: 'Needs', wants: 'Wants', business: 'Business', savings: 'Savings & investing', transfer: 'Transfers' };
const DEFAULT_CATS = [
  ['income', 'Paycheck', 'income'], ['income2', 'Other income', 'income'], ['bizinc', 'Business income', 'income'],
  ['housing', 'Housing', 'needs'], ['utilities', 'Utilities & phone', 'needs'], ['groceries', 'Groceries', 'needs'],
  ['transport', 'Gas & transport', 'needs'], ['auto', 'Car payment', 'needs'], ['insurance', 'Insurance', 'needs'],
  ['health', 'Health & fitness', 'needs'], ['debt', 'Loan payments', 'needs'], ['childpet', 'Kids & pets', 'needs'],
  ['dining', 'Dining & delivery', 'wants'], ['coffee', 'Coffee & treats', 'wants'], ['shopping', 'Shopping', 'wants'],
  ['subs', 'Subscriptions', 'wants'], ['entertainment', 'Entertainment', 'wants'], ['travel', 'Travel', 'wants'],
  ['personal', 'Personal care', 'wants'], ['gifts', 'Gifts & giving', 'wants'], ['education', 'Education', 'wants'],
  ['fees', 'Fees & interest', 'wants'], ['business', 'Business expenses', 'business'],
  ['saving', 'Savings & investing', 'savings'], ['transfer', 'Transfers & card payments', 'transfer'], ['uncat', 'Uncategorized', 'wants']
].map(([id, name, group]) => ({ id, name, group }));

/* Built-in merchant knowledge: PATTERN | category | display name */
const KW_SRC = [
  'OVERDRAFT|NSF FEE|INSUFFICIENT FUND|ATM FEE|ATM SURCHARGE|LATE FEE|LATE PAYMENT FEE|MONTHLY SERVICE FEE|MAINTENANCE FEE|FOREIGN TRANSACTION FEE|INTEREST CHARGE|FINANCE CHARGE|ANNUAL FEE|RETURNED ITEM|SERVICE CHARGE|fees|',
  'PAYROLL|DIR ?DEP|DIRECT DEP|SALARY|PAYCHECK|\\bADP\\b|GUSTO|PAYCHEX|COMMISSION|income|',
  'INTEREST PAID|INTEREST EARNED|INTEREST PAYMENT|DIVIDEND|CASH ?BACK REWARD|REWARDS REDEMPTION|IRS TREAS|TAX REF|STRIPE PAYOUT|SQUARE PAYOUT|income2|',
  'TRANSFER TO SAV|TO SAVINGS|SAVINGS TRANSFER|AUTOSAVE|\\bROTH\\b|IRA CONTRIB|FIDELITY|VANGUARD|SCHWAB|ROBINHOOD|WEBULL|COINBASE|ACORNS|BETTERMENT|WEALTHFRONT|M1 FINANCE|TREASURYDIRECT|saving|',
  'PAYMENT THANK YOU|PAYMENT - THANK|PAYMENT TO CREDIT CARD|CREDIT CARD PAYMENT|CARD PAYMENT|CAPITAL ONE ONLINE PMT|CHASE CREDIT CRD|DISCOVER E-PAYMENT|AMEX EPAYMENT|CITI CARD ONLINE|ONLINE TRANSFER|TRANSFER FROM|TRANSFER TO|XFER|ZELLE|VENMO|CASH APP|APPLE CASH|PAYPAL TRANSFER|transfer|',
  'NETFLIX|subs|Netflix', 'SPOTIFY|subs|Spotify', 'HULU|subs|Hulu', 'DISNEY ?PLUS|DISNEYPLUS|subs|Disney+', '\\bHBO\\b|\\bMAX\\.COM|subs|Max',
  'YOUTUBE ?PREMIUM|YOUTUBE ?TV|GOOGLE \\*YOUTUBE|subs|YouTube', 'APPLE\\.COM/BILL|APPLE\\.COM BILL|ITUNES|subs|Apple', 'AMAZON PRIME|PRIME VIDEO|AMZN PRIME|subs|Amazon Prime',
  'AUDIBLE|subs|Audible', 'OPENAI|CHATGPT|subs|ChatGPT', 'ANTHROPIC|CLAUDE\\.AI|subs|Claude', 'ADOBE|subs|Adobe', 'XBOX|subs|Xbox', 'PLAYSTATION|SONY INTERACTIVE|subs|PlayStation',
  'PEACOCK|subs|Peacock', 'PARAMOUNT|subs|Paramount+', 'SIRIUS|subs|SiriusXM', 'PATREON|subs|Patreon', 'ONLYFANS|subs|Subscription', 'DROPBOX|subs|Dropbox', 'GOOGLE \\*GOOGLE ONE|GOOGLE ONE|GOOGLE STORAGE|subs|Google One',
  'MICROSOFT\\*|MICROSOFT 365|subs|Microsoft', 'NINTENDO|subs|Nintendo', 'TWITCH|subs|Twitch', 'CRUNCHYROLL|subs|Crunchyroll', 'NYTIMES|NEW YORK TIMES|subs|NYTimes', 'LINKEDIN|subs|LinkedIn',
  'PLANET FITNESS|PLANET FIT|health|Planet Fitness', 'VASA FITNESS|health|VASA Fitness', 'CRUNCH FITNESS|health|Crunch Fitness', 'LA FITNESS|health|LA Fitness', '24 HOUR FITNESS|health|24 Hour Fitness', 'ANYTIME FITNESS|health|Anytime Fitness', 'GOLD.?S GYM|health|Gold\'s Gym',
  'CVS|health|CVS', 'WALGREENS|health|Walgreens', 'PHARMACY|DENTAL|MEDICAL|CLINIC|HOSPITAL|URGENT CARE|DOCTOR|OPTOMETR|INTERMOUNTAIN|health|',
  'DOORDASH|DD \\*|health_skip|', 'DOORDASH|dining|DoorDash', 'UBER ?EATS|UBER \\*EATS|dining|Uber Eats', 'GRUBHUB|dining|Grubhub', 'POSTMATES|dining|Postmates', 'INSTACART|groceries|Instacart',
  'MCDONALD|dining|McDonald\'s', 'CHIPOTLE|dining|Chipotle', 'TACO BELL|dining|Taco Bell', 'CHICK-FIL-A|CHICKFILA|CHICK FIL A|dining|Chick-fil-A', 'IN-N-OUT|IN N OUT|dining|In-N-Out', 'WENDY|dining|Wendy\'s', 'BURGER KING|dining|Burger King',
  'CAFE RIO|dining|Cafe Rio', 'CHILI.?S|dining|Chili\'s', 'OLIVE GARDEN|dining|Olive Garden', 'PANDA EXPRESS|dining|Panda Express', 'SUBWAY|dining|Subway', 'DOMINO|dining|Domino\'s', 'PIZZA HUT|dining|Pizza Hut', 'LITTLE CAESAR|dining|Little Caesars', 'RAISING CANE|dining|Raising Cane\'s', 'FIVE GUYS|dining|Five Guys', 'WINGSTOP|dining|Wingstop', 'JERSEY MIKE|dining|Jersey Mike\'s', 'CULVER|dining|Culver\'s', 'SONIC DRIVE|dining|Sonic', 'ARBY|dining|Arby\'s', 'DEL TACO|dining|Del Taco',
  'RESTAURANT|GRILL|BISTRO|KITCHEN|TAQUERIA|SUSHI|RAMEN|PIZZA|BURGER|BBQ|DINER|EATERY|BREWING|BREWERY|TAVERN|\\bBAR\\b|PUB\\b|dining|',
  'STARBUCKS|coffee|Starbucks', 'DUTCH BROS|coffee|Dutch Bros', 'DUNKIN|coffee|Dunkin\'', 'SWIG|coffee|Swig', 'SODALICIOUS|coffee|Sodalicious', 'FIZZ|coffee|Fiiz', 'CRUMBL|coffee|Crumbl', 'NOTHING BUNDT|coffee|Nothing Bundt Cakes', 'KRISPY KREME|coffee|Krispy Kreme', 'COFFEE|ESPRESSO|DONUT|BAKERY|coffee|',
  'SMITH.?S FOOD|SMITHS FOOD|SMITH\'S #|groceries|Smith\'s', 'HARMONS|groceries|Harmons', 'WINCO|groceries|WinCo', 'KROGER|groceries|Kroger', 'SAFEWAY|groceries|Safeway', 'ALBERTSONS|groceries|Albertsons', 'TRADER JOE|groceries|Trader Joe\'s', 'WHOLE ?FOODS|WFM|groceries|Whole Foods', '\\bALDI\\b|groceries|Aldi', 'PUBLIX|groceries|Publix', '\\bHEB\\b|H-E-B|groceries|H-E-B', 'SPROUTS|groceries|Sprouts', 'FRED ?MEYER|groceries|Fred Meyer', 'KING SOOPERS|groceries|King Soopers', 'FOOD 4 LESS|groceries|Food 4 Less', 'MACEY|groceries|Macey\'s', 'COSTCO GAS|transport|Costco Gas', 'COSTCO|groceries|Costco', 'SAM.?S CLUB|groceries|Sam\'s Club', 'WAL-?MART|WM SUPERCENTER|WALMART|groceries|Walmart', 'GROCER|MARKET|FOODS|groceries|',
  'MAVERIK|transport|Maverik', 'CHEVRON|transport|Chevron', 'SHELL|transport|Shell', 'EXXON|transport|Exxon', 'SINCLAIR|transport|Sinclair', 'CONOCO|transport|Conoco', 'PHILLIPS 66|transport|Phillips 66', 'CIRCLE K|transport|Circle K', '7-ELEVEN|7 ELEVEN|transport|7-Eleven', 'TESORO|transport|Tesoro', '\\bARCO\\b|transport|ARCO', 'BP#|\\bBP\\b|transport|BP', 'QUIKTRIP|QT \\d|transport|QuikTrip', 'KUM ?& ?GO|transport|Kum & Go', 'SPEEDWAY|transport|Speedway',
  'UBER(?! ?EATS)|transport|Uber', 'LYFT|transport|Lyft', 'PARKING|PARKMOBILE|TOLL|EXPRESSTOLL|UTA |TRAX|FRONTRUNNER|DMV|JIFFY LUBE|DISCOUNT TIRE|AUTOZONE|O.?REILLY|CAR WASH|transport|',
  'ALLY AUTO|ALLY PAYMENT|TOYOTA FIN|HONDA FIN|FORD CREDIT|GM FINANCIAL|CARMAX AUTO|WESTLAKE|SANTANDER CONSUMER|CAPITAL ONE AUTO|AUTO LOAN|CAR PAYMENT|auto|',
  'GEICO|insurance|GEICO', 'PROGRESSIVE|insurance|Progressive', 'STATE FARM|insurance|State Farm', 'ALLSTATE|insurance|Allstate', 'LEMONADE|insurance|Lemonade', 'FARMERS INS|insurance|Farmers', 'USAA|insurance|USAA', 'LIBERTY MUTUAL|insurance|Liberty Mutual', 'INSURANCE|\\bINS\\b|insurance|',
  'NELNET|MOHELA|NAVIENT|AIDVANTAGE|EDFINANCIAL|SALLIE MAE|STUDENT LOAN|DEPT OF ED|SOFI LOAN|UPSTART|LENDINGCLUB|AFFIRM|KLARNA|AFTERPAY|debt|',
  '\\bRENT\\b|APARTMENT|APTS|PROPERTY MGMT|PROPERTY MANAGEMENT|MORTGAGE|ROCKET MORTGAGE|MR\\. ?COOPER|HOA\\b|HOMEOWNERS ASSOC|housing|',
  'ROCKY MOUNTAIN POWER|DOMINION ENERGY|XCEL|ENERGY|ELECTRIC|POWER CO|GAS CO|WATER|SEWER|WASTE MGMT|UTILITY|XFINITY|COMCAST|SPECTRUM|COX COMM|GOOGLE FIBER|CENTURYLINK|QUANTUM FIBER|VERIZON|T-MOBILE|TMOBILE|AT&T|ATT\\*|CRICKET|MINT MOBILE|VISIBLE|GOOGLE \\*FI|utilities|',
  'AMAZON|AMZN|shopping|Amazon', 'TARGET|shopping|Target', 'BEST BUY|shopping|Best Buy', 'EBAY|shopping|eBay', 'ETSY|shopping|Etsy', 'SHEIN|shopping|SHEIN', 'TEMU|shopping|Temu', 'NIKE|shopping|Nike', 'HOME DEPOT|shopping|Home Depot', 'LOWE.?S|shopping|Lowe\'s', 'IKEA|shopping|IKEA', 'TJ ?MAXX|TJMAXX|shopping|TJ Maxx', 'ROSS STORES|shopping|Ross', 'MARSHALLS|shopping|Marshalls', 'DOLLAR TREE|shopping|Dollar Tree', 'DOLLAR GENERAL|shopping|Dollar General', 'OLD NAVY|shopping|Old Navy', 'APPLE STORE|shopping|Apple Store', 'WAYFAIR|shopping|Wayfair', 'MACY|shopping|Macy\'s', 'NORDSTROM|shopping|Nordstrom', '\\bULTA\\b|personal|Ulta', 'SEPHORA|personal|Sephora',
  'PETSMART|PETCO|CHEWY|VETERINAR|\\bVET\\b|DAYCARE|CHILDCARE|childpet|',
  'GREAT CLIPS|SUPERCUTS|SPORT CLIPS|BARBER|SALON|NAIL|SPA\\b|personal|',
  'AMC |CINEMARK|MEGAPLEX|REGAL|FANDANGO|TICKETMASTER|STUBHUB|STEAM|EPIC GAMES|TOPGOLF|BOWL|DAVE ?& ?BUSTER|ESCAPE ROOM|CONCERT|entertainment|',
  'DELTA AIR|SOUTHWEST|UNITED AIR|AMERICAN AIR|FRONTIER|SPIRIT AIR|ALASKA AIR|JETBLUE|AIRBNB|VRBO|EXPEDIA|BOOKING\\.COM|HOTEL|MARRIOTT|HILTON|HYATT|HERTZ|ENTERPRISE RENT|AVIS|travel|',
  'UDEMY|COURSERA|SKILLSHARE|MASTERCLASS|TUITION|UNIVERSITY|COLLEGE|BOOKSTORE|education|',
  'CHURCH|TITHE|DONATION|GOFUNDME|CHARITY|RED CROSS|gifts|',
  'GODADDY|SQUARESPACE|WIX|SHOPIFY|QUICKBOOKS|INTUIT|CANVA|GOOGLE \\*GSUITE|GOOGLE WORKSPACE|FIVERR|UPWORK|VISTAPRINT|SAM\\.GOV|LLC FILING|business|'
];
const KW = KW_SRC.map(line => { const parts = line.split('|'); const name = parts.pop(); const cat = parts.pop(); return { re: new RegExp(parts.join('|')), cat, name: name || null }; }).filter(k => k.cat !== 'health_skip');

function cleanMerchant(desc) {
  let s = ' ' + String(desc || '').toUpperCase() + ' ';
  s = s.replace(/\b(SQ|TST|SP|PY|PP|PAYPAL|IC|PAR|SMK|BT|CKO|FS|GOOGLE|APL\*?)\s?\*/g, ' ');
  s = s.replace(/\b(POS|DEBIT|CREDIT|CARD|PURCHASE|PURCHASED|RECURRING|CHECKCARD|CHECK CARD|ACH|WEB|ONLINE|PMT|PREAUTHORIZED|VISA|MASTERCARD|TRANSACTION|WITHDRAWAL|DBT|PURCH|SALE|AUTHORIZED ON|AUTH|STORE|CONTACTLESS|TAP|DDA|ID)\b/g, ' ');
  s = s.replace(/[#*]\s?[\w-]*\d[\w-]*/g, ' ').replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ').replace(/\b[A-Z]*\d{3,}[A-Z\d]*\b/g, ' ');
  s = s.replace(/(HTTPS?:\/\/|WWW\.|\.COM\b|\.NET\b|\.CO\b)/g, ' ');
  s = s.replace(/\s(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s*$/, ' ');
  s = s.replace(/[^A-Z0-9&' .+-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(w => w && !/^[\d.-]+$/.test(w) && w.length > 1);
  let out = ''; for (const w of words) { if (out && (out.split(' ').length >= 3 || out.length >= 14)) break; out = out ? out + ' ' + w : w; }
  return out ? titleCase(out) : titleCase(String(desc || 'Unknown').trim().slice(0, 22));
}
function merchantName(desc) { const D = String(desc || '').toUpperCase(); for (const k of KW) if (k.name && k.re.test(D)) return k.name; return cleanMerchant(desc); }

/* ---------- State ---------- */
let state = null;
let CATMAP = {};
function rebuildCats() { CATMAP = {}; for (const c of state.categories) CATMAP[c.id] = c; if (!CATMAP.uncat) { const u = { id: 'uncat', name: 'Uncategorized', group: 'wants' }; state.categories.push(u); CATMAP.uncat = u; } }
function catOf(id) { return CATMAP[id] || CATMAP.uncat; }
function emptyState() {
  return {
    v: 1, demo: false,
    settings: { pay: { freq: 'biweekly', next: '', amount: 0 }, buffer: 200, taxRate: 25, age: '', returnRate: 7, fiMultiple: 25 },
    categories: DEFAULT_CATS.map(c => ({ ...c })), rules: [], accounts: [], budgets: {}, rollover: {}, goals: [],
    cancelPlan: {}, ignoreRecurring: {}, transactions: []
  };
}

function categorize(t) {
  const D = (t.desc || '').toUpperCase(), M = (t.merchant || '').toUpperCase();
  for (const r of state.rules) { const x = (r.text || '').toUpperCase().trim(); if (x && (D.includes(x) || M.includes(x))) return { cat: r.categoryId, rule: r }; }
  for (const k of KW) { if (k.re.test(D)) { if ((k.cat === 'income' || k.cat === 'income2') && t.amount <= 0) continue; return { cat: k.cat }; } }
  return { cat: t.amount > 0 ? 'income2' : 'uncat' };
}
function applyRuleExtras(t, r) { if (!r) return; if (r.rename) t.merchant = r.rename; if (r.business) t.business = true; }

/* ---------- Account types ---------- */
const ACCT_TYPES = {
  checking: { label: 'Checking', group: 'cash' }, savings: { label: 'Savings', group: 'cash' }, cash: { label: 'Cash', group: 'cash' },
  credit: { label: 'Credit card', group: 'debt', liability: true }, loan: { label: 'Loan', group: 'debt', liability: true }, mortgage: { label: 'Mortgage', group: 'debt', liability: true },
  k401: { label: '401(k) / 403(b)', group: 'retire', invest: true }, roth: { label: 'Roth IRA', group: 'retire', invest: true }, ira: { label: 'Traditional IRA', group: 'retire', invest: true },
  hsa: { label: 'HSA', group: 'retire', invest: true }, brokerage: { label: 'Brokerage', group: 'invest', invest: true }, crypto: { label: 'Crypto', group: 'invest', invest: true },
  property: { label: 'Home / property', group: 'assets' }, vehicle: { label: 'Vehicle', group: 'assets' }, other: { label: 'Other asset', group: 'assets' }
};
const ACCT_GROUPS = { cash: 'Cash', debt: 'Credit cards & loans', retire: 'Retirement', invest: 'Investments', assets: 'Property & other' };
const LIMITS_2026 = { k401: 24500, ira: 7500 }; // IRS 2026 limits (under age 50)
const isLiab = a => !!(ACCT_TYPES[a.type] || {}).liability;
const isInvest = a => !!(ACCT_TYPES[a.type] || {}).invest;
function holdingsValue(a) { return sumBy(a.holdings || [], h => (+h.shares || 0) * (+h.price || 0)); }
function acctBalance(a) { if (isInvest(a) && (a.holdings || []).length) return holdingsValue(a); return +a.balance || 0; }
function signedBal(a) { return isLiab(a) ? -Math.abs(acctBalance(a)) : acctBalance(a); }
function netWorth() { return sumBy(state.accounts, signedBal); }
function recordBalance(a) { const v = round2(acctBalance(a)); a.history = a.history || []; const last = a.history[a.history.length - 1]; if (last && last.d === TODAY) last.v = v; else a.history.push({ d: TODAY, v }); }
function balanceOn(a, date) { const h = a.history || []; let v = null; for (const p of h) { if (p.d <= date) v = p.v; else break; } return v; }
function netWorthSeries(months) {
  return months.map(m => { const end = m === THIS_MONTH ? TODAY : m + '-' + pad(daysInMonth(m)); let t = 0, any = false; for (const a of state.accounts) { let v = balanceOn(a, end); if (v == null) continue; any = true; t += isLiab(a) ? -Math.abs(v) : v; } return any ? round2(t) : null; });
}
const ASSET_CLASSES = ['US stocks', 'International stocks', 'Bonds', 'Target-date / blend', 'Cash', 'Crypto', 'Real estate', 'Other'];
function guessClass(sym, name) {
  const S = String(sym || '').toUpperCase(), N = String(name || '').toUpperCase();
  if (/^(BTC|ETH|SOL|DOGE|ADA|XRP|LTC)/.test(S) || /BITCOIN|ETHEREUM|CRYPTO/.test(N)) return 'Crypto';
  if (/^(SPAXX|FDRXX|VMFXX|SWVXX|FZFXX|CORE|CASH|SPRXX|VMMXX)/.test(S) || /MONEY MARKET|CASH|SWEEP/.test(N)) return 'Cash';
  if (/TARGET|FREEDOM 20|RETIREMENT 20|\b20[3-7]\d\b|BALANCED|LIFESTRATEGY/.test(N) || /^(VTTSX|VFIFX|VFFVX|VTHRX|FDEWX|FFFHX|TRRKX)/.test(S)) return 'Target-date / blend';
  if (/^(BND|AGG|FXNAX|VBTLX|SCHZ|BNDX|TLT|IEF|SHY|VGIT|VCIT|FBND|SGOV|BIL)$/.test(S) || /BOND|TREASURY|INCOME FUND|AGGREGATE/.test(N)) return 'Bonds';
  if (/^(VXUS|VEA|VWO|IXUS|IEFA|FTIHX|FSPSX|VTIAX|SCHF|EFA|EEM|FZILX|SWISX)$/.test(S) || /INTERNATIONAL|INTL|EMERGING|EX-US|DEVELOPED MKT|FOREIGN/.test(N)) return 'International stocks';
  if (/^(VNQ|SCHH|FREL|O)$/.test(S) || /REAL ESTATE|REIT/.test(N)) return 'Real estate';
  if (S) return 'US stocks';
  return 'Other';
}

/* ---------- Parsing: delimited text ---------- */
function parseDelimited(text) {
  text = String(text || '').replace(/^﻿/, '');
  const sample = text.split(/\r?\n/).slice(0, 12).join('\n');
  const cands = [',', '\t', ';', '|']; let delim = ',', best = -1;
  for (const c of cands) { const cnt = sample.split(c).length; if (cnt > best) { best = cnt; delim = c; } }
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => String(c).trim())).filter(r => r.some(c => c !== ''));
}
function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v == null ? '' : v).trim(); if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/\bDR\b|DEBIT$/i.test(s)) { neg = true; } s = s.replace(/\b(CR|DR|USD)\b/gi, '');
  s = s.replace(/[$€£\s,]/g, '').replace(/−/g, '-');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s); return neg ? -n : n;
}
function parseDateAny(v, yearHint) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12));
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)); }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/))) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, +m[1], +m[2]) || valid(y, +m[2], +m[1]); }
  if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})$/))) { const y = yearHint || +TODAY.slice(0, 4); return valid(y, +m[1], +m[2]); }
  if ((m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-,]*(\d{2,4})?/))) { const mo = MON.findIndex(x => m[2].toLowerCase().startsWith(x.toLowerCase())); let y = m[3] ? +m[3] : (yearHint || +TODAY.slice(0, 4)); if (y < 100) y += 2000; if (mo >= 0) return valid(y, mo + 1, +m[1]); }
  if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s*(\d{4})?/))) { const mo = MON.findIndex(x => m[1].toLowerCase().startsWith(x.toLowerCase())); const y = m[3] ? +m[3] : (yearHint || +TODAY.slice(0, 4)); if (mo >= 0) return valid(y, mo + 1, +m[2]); }
  return null;
  function valid(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null; return y + '-' + pad(mo) + '-' + pad(d); }
}

const COLS = {
  date: /^(transaction |trans\.? |posted |post(ing)? |effective )?date$|^date posted$|^trans(action)? date$|^posting date$|^date$|^run date$/i,
  desc: /description|payee|merchant|^name$|memo|details|narrative|^transaction$|^action$/i,
  amount: /^(transaction )?amount( \(usd\))?$|^amt$|^value$|^net amount$|amount \(\$\)/i,
  debit: /debit|withdrawal|money out|outflow|payments?$|charges?$|spent/i,
  credit: /credit|deposit|money in|inflow|receipts?/i,
  category: /^category$|^type of spend|^classification/i,
  type: /^(transaction )?type$|^dr\/cr$|credit\/debit|debit\/credit|credit debit indicator|debit credit indicator|^indicator$/i
};
function detectHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i].map(c => String(c).toLowerCase());
    const hasDate = r.some(c => /date/.test(c)); const hasAmt = r.some(c => /amount|debit|credit|withdraw|deposit|value/.test(c));
    if (hasDate && hasAmt) return i;
  }
  return -1;
}
function guessMapping(rows) {
  const hi = detectHeader(rows); const map = { headerIdx: hi, date: -1, desc: -1, amount: -1, debit: -1, credit: -1, category: -1, type: -1 };
  if (hi >= 0) {
    const H = rows[hi];
    const find = (re, exclude = []) => H.findIndex((h, i) => !exclude.includes(i) && re.test(String(h).trim()));
    map.date = find(COLS.date); if (map.date < 0) map.date = H.findIndex(h => /date/i.test(h));
    map.amount = find(COLS.amount);
    map.debit = find(COLS.debit, [map.amount]); map.credit = find(COLS.credit, [map.amount, map.debit]);
    map.desc = find(/description|payee|merchant|^name$|details|narrative|^transaction$/i);
    if (map.desc < 0) map.desc = find(COLS.desc);
    map.category = find(COLS.category); map.type = find(COLS.type, [map.category]);
    if (map.amount >= 0) { map.debit = map.debit === map.amount ? -1 : map.debit; }
    if (map.amount >= 0 && map.debit >= 0 && map.credit >= 0) map.amount = -1;
  } else {
    const body = rows.slice(0, 40); const n = Math.max(...body.map(r => r.length));
    const score = (f) => { const sc = []; for (let c = 0; c < n; c++) sc.push(body.filter(r => f(r[c])).length); return sc; };
    const ds = score(v => !!parseDateAny(v)); map.date = ds.indexOf(Math.max(...ds));
    const as = score(v => v != null && /\d\.\d{2}\b/.test(String(v)) && parseAmount(v) != null); as[map.date] = -1; map.amount = as.indexOf(Math.max(...as));
    const ts = []; for (let c = 0; c < n; c++) ts.push(c === map.date || c === map.amount ? -1 : sumBy(body, r => (String(r[c] || '').match(/[A-Za-z]/g) || []).length));
    map.desc = ts.indexOf(Math.max(...ts));
  }
  return map;
}
function rowsToRecords(rows, map, flip) {
  const out = []; const start = map.headerIdx >= 0 ? map.headerIdx + 1 : 0; let skipped = 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]; const date = parseDateAny(r[map.date]);
    let amt = null;
    if (map.amount >= 0) amt = parseAmount(r[map.amount]);
    if (amt == null && (map.debit >= 0 || map.credit >= 0)) {
      const d = map.debit >= 0 ? parseAmount(r[map.debit]) : null; const c = map.credit >= 0 ? parseAmount(r[map.credit]) : null;
      if (d != null || c != null) amt = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0);
    }
    if (amt != null && map.type >= 0 && map.amount >= 0) { const t = String(r[map.type] || '').toLowerCase(); if (/debit|withdraw|purchase|sale|^dr$|payment out/.test(t) && amt > 0) amt = -amt; else if (/credit|deposit|^cr$|refund|return/.test(t) && amt < 0) amt = -amt; }
    const desc = map.desc >= 0 ? String(r[map.desc] || '').trim() : '';
    if (!date || amt == null || amt === 0) { skipped++; continue; }
    out.push({ date, desc: desc || '(no description)', amount: round2(flip ? -amt : amt), category: map.category >= 0 ? String(r[map.category] || '') : '' });
  }
  return { records: out, skipped };
}
function guessFlip(records) { if (records.length < 4) return false; const pos = records.filter(r => r.amount > 0).length; return pos / records.length > 0.72; }

/* ---------- OFX / QFX ---------- */
function parseOFX(text) {
  const out = []; const blocks = String(text).split(/<STMTTRN>/i).slice(1);
  const tag = (b, t) => { const m = b.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
  for (const b of blocks) {
    const date = parseDateAny(tag(b, 'DTPOSTED').slice(0, 8)); const amt = parseAmount(tag(b, 'TRNAMT'));
    const name = tag(b, 'NAME'), memo = tag(b, 'MEMO');
    if (!date || amt == null) continue;
    out.push({ date, desc: (name + (memo && memo !== name ? ' ' + memo : '')).replace(/&amp;/g, '&').trim() || 'Transaction', amount: round2(amt), fitid: tag(b, 'FITID') });
  }
  const bal = String(text).match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i);
  return { records: out, balance: bal ? parseAmount(bal[1]) : null };
}

/* ---------- PDF text fallback (no Claude) ---------- */
/* Navy Federal statement layout: "MM-DD  description  12.34 -  5,678.90" (trailing " -" = money out),
   long descriptions wrap onto the next line, and the year comes from the statement period. Checking sections only. */
function parseNFCUText(text) {
  const per = String(text).match(/(\d\d)\/(\d\d)\/(\d\d)\s*-\s*(\d\d)\/(\d\d)\/(\d\d)/);
  if (!per || !/Statement of Account|navyfederal|Navy Federal/i.test(text)) return null;
  const sm = +per[1], sy = 2000 + +per[3], em = +per[4], ey = 2000 + +per[6];
  const out = []; let inAcct = false, pend = null;
  const amtRe = /^(.*?)\s*([\d,]+\.\d\d)( -)?\s+(-?[\d,]+\.\d\d)\s*$/;
  for (const raw of String(text).split('\n')) {
    const l = raw.trim(); if (!l) continue;
    if (/\b(Checking|Savings)\b.*\s-\s\d{6,}/.test(l) && !/^\d\d-\d\d/.test(l)) { inAcct = /Checking/.test(l); pend = null; continue; }
    if (!inAcct) continue;
    const m = l.match(/^(\d\d)-(\d\d)\s+(.*)$/);
    if (m) {
      const mo = +m[1], dd = +m[2]; let yr = ey; if (sm > em && mo >= sm) yr = sy; else if (sm < em && mo === sm && sy !== ey) yr = sy;
      const date = yr + '-' + pad(mo) + '-' + pad(dd); const rest = m[3];
      if (/Beginning Balance/i.test(rest)) { pend = null; continue; }
      if (/Ending Balance/i.test(rest)) { inAcct = false; pend = null; continue; }
      const a = rest.match(amtRe);
      if (a) { out.push({ date, desc: a[1].trim(), amount: round2(parseFloat(a[2].replace(/,/g, '')) * (a[3] ? -1 : 1)) }); pend = null; }
      else pend = { date, desc: rest.trim() };
      continue;
    }
    if (pend) { const a = l.match(amtRe); if (a) { out.push({ date: pend.date, desc: (pend.desc + ' ' + a[1]).trim(), amount: round2(parseFloat(a[2].replace(/,/g, '')) * (a[3] ? -1 : 1)) }); pend = null; } else if (!/^Page \d|Statement|Access No|Joint Owner|Date\s+Transaction/i.test(l)) pend.desc += ' ' + l; }
  }
  return out.length ? out : null;
}
function regexExtractStatement(text) {
  const nf = parseNFCUText(text); if (nf) return nf;
  const yr = (String(text).match(/\b(20[2-3]\d)\b/) || [])[1]; const out = [];
  for (const line of String(text).split('\n')) {
    const m = line.trim().match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+)?(.+?)\s+(-?\(?\$?[\d,]+\.\d{2}\)?-?)(?:\s+-?\$?[\d,]+\.\d{2})?$/);
    if (!m) continue; const date = parseDateAny(m[1], yr ? +yr : null); let amt = parseAmount(m[3]); if (!date || amt == null) continue;
    const desc = m[2].trim(); if (/BALANCE|TOTAL|BEGINNING|ENDING/i.test(desc)) continue;
    if (amt > 0 && !/DEPOSIT|CREDIT|REFUND|PAYMENT RECEIVED|PAYMENT - THANK|PAYMENT THANK|INTEREST PAID|RETURN/i.test(desc)) amt = -amt;
    out.push({ date, desc, amount: round2(amt) });
  }
  return out;
}

/* ---------- Positions (holdings) files ---------- */
function isPositionsTable(rows) { const hi = detectHeaderPositions(rows); return hi >= 0; }
function detectHeaderPositions(rows) { for (let i = 0; i < Math.min(rows.length, 15); i++) { const r = rows[i].map(c => String(c).toLowerCase()); if (r.some(c => /^symbol|ticker/.test(c)) && r.some(c => /quantity|shares|units/.test(c))) return i; } return -1; }
function parsePositions(rows) {
  const hi = detectHeaderPositions(rows); if (hi < 0) return [];
  const H = rows[hi].map(c => String(c).toLowerCase().trim()); const f = re => H.findIndex(h => re.test(h));
  const ci = { sym: f(/^symbol|ticker/), name: f(/description|name|security|investment/), qty: f(/quantity|shares|units/), price: f(/^(last )?price|share price|current price|nav/), value: f(/current value|market value|^value|total value/), cost: f(/cost basis total|cost basis|total cost|^cost/), acct: f(/account name|account$/) };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; const sym = String(r[ci.sym] || '').replace(/\*+$/, '').trim(); if (!sym || /pending|total|account total/i.test(sym)) continue;
    const qty = parseAmount(r[ci.qty]); let price = ci.price >= 0 ? parseAmount(r[ci.price]) : null; const value = ci.value >= 0 ? parseAmount(r[ci.value]) : null;
    if ((qty == null || qty === 0) && value != null) { out.push({ sym, name: String(r[ci.name] || '').trim(), shares: 1, price: value, cost: ci.cost >= 0 ? parseAmount(r[ci.cost]) || 0 : 0, cls: guessClass(sym, r[ci.name]), er: '' }); continue; }
    if (qty == null) continue; if (price == null && value != null && qty) price = value / qty;
    out.push({ sym, name: String(r[ci.name] || '').trim(), shares: qty, price: round2(price || 0), cost: ci.cost >= 0 ? round2(parseAmount(r[ci.cost]) || 0) : 0, cls: guessClass(sym, r[ci.name]), er: '' });
  }
  return out;
}

/* ---------- Import finalize ---------- */
function txKey(t) { return t.accountId + '|' + t.date + '|' + Number(t.amount).toFixed(2) + '|' + String(t.desc).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14); }
function buildTransactions(records, accountId) {
  const counts = {}; for (const t of state.transactions) { const k = txKey(t); counts[k] = (counts[k] || 0) + 1; }
  const added = [], dupes = [], replaced = [];
  const catByName = {}; for (const c of state.categories) catByName[c.name.toLowerCase()] = c.id;
  for (const r of records) {
    const t = { id: uid(), date: r.date, desc: r.desc, amount: round2(r.amount), accountId, merchant: merchantName(r.desc), categoryId: 'uncat', notes: '', tags: [], business: false, excluded: false };
    const k = txKey(t); if (counts[k]) { counts[k]--; dupes.push(t); continue; }
    const fromFile = r.category && catByName[String(r.category).toLowerCase()];
    const c = categorize(t); t.categoryId = c.cat; applyRuleExtras(t, c.rule);
    if (fromFile && !c.rule && (c.cat === 'uncat' || c.cat === 'income2')) t.categoryId = fromFile;
    if (t.categoryId === 'bizinc' || t.categoryId === 'business') t.business = true;
    const p = takePending(t); if (p) replaced.push(p);
    added.push(t);
  }
  return { added, dupes, replaced };
}

/* A charge entered by hand as "Pending" is replaced when the posted version arrives
   (same account, same amount, within 6 days). Returns the removed pending transaction. */
function takePending(t) {
  const i = state.transactions.findIndex(x => x.accountId === t.accountId && /pending/i.test(x.notes || '') && Math.abs(x.amount - t.amount) < 0.005 && Math.abs(daysBetween(x.date, t.date)) <= 6);
  if (i < 0) return null; return state.transactions.splice(i, 1)[0];
}
function lastPostedDate(accountId) { let d = null; for (const t of state.transactions) if (t.accountId === accountId && !/pending/i.test(t.notes || '') && (!d || t.date > d)) d = t.date; return d; }

/* ---------- Analytics ---------- */
function derive() {
  const D = { months: {}, list: [], latest: null, earliest: null };
  for (const t of state.transactions) {
    if (t.excluded) continue; const m = mKey(t.date); const g = catOf(t.categoryId).group;
    const M = D.months[m] || (D.months[m] = { income: 0, spend: 0, saved: 0, byCat: {}, days: {}, biz: 0, bizInc: 0, count: 0 });
    M.count++;
    if (g === 'income') { M.income += t.amount; if (t.business || t.categoryId === 'bizinc') M.bizInc += t.amount; }
    else if (g === 'savings') M.saved += -t.amount;
    else if (g !== 'transfer') { M.spend += -t.amount; M.byCat[t.categoryId] = (M.byCat[t.categoryId] || 0) - t.amount; if (t.amount < 0) M.days[t.date] = (M.days[t.date] || 0) - t.amount; if (t.business || g === 'business') M.biz += -t.amount; }
    if (!D.latest || t.date > D.latest) D.latest = t.date; if (!D.earliest || t.date < D.earliest) D.earliest = t.date;
  }
  D.list = Object.keys(D.months).sort();
  return D;
}
function monthData(D, m) { return D.months[m] || { income: 0, spend: 0, saved: 0, byCat: {}, days: {}, biz: 0, bizInc: 0, count: 0 }; }
function lastNMonths(m, n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push(addMonths(m, -i)); return a; }
function avgCat(D, cat, endMonth, n) { let t = 0, k = 0; for (let i = 1; i <= n; i++) { const md = D.months[addMonths(endMonth, -i)]; if (!md) continue; k++; t += md.byCat[cat] || 0; } return k ? t / k : 0; }
function fullMonthsBefore(D, m, n) { const a = []; for (let i = 1; i <= n; i++) { const k = addMonths(m, -i); if (D.months[k]) a.push(k); } return a; }

function detectRecurring(opts = {}) {
  const groups = {}; const ref = opts.ref || latestDate() || TODAY;
  for (const t of state.transactions) {
    if (t.excluded) continue; const g = catOf(t.categoryId).group;
    if (opts.income ? g !== 'income' || t.amount <= 0 : (t.amount >= 0 || g === 'transfer' || g === 'income')) continue;
    const key = (t.merchant || t.desc).toUpperCase(); (groups[key] = groups[key] || []).push(t);
  }
  const res = [];
  for (const key in groups) {
    const g = groups[key].sort((a, b) => a.date < b.date ? -1 : 1); if (g.length < 2) continue;
    const months = new Set(g.map(t => mKey(t.date))); if (months.size < 2 && g.length < 3) continue;
    const ints = []; for (let i = 1; i < g.length; i++) ints.push(daysBetween(g[i - 1].date, g[i].date));
    const med = median(ints.filter(x => x > 2)); if (!med) continue;
    let freq = null;
    if (med >= 6 && med <= 8) freq = 'weekly'; else if (med >= 12 && med <= 16) freq = 'biweekly'; else if (med >= 26 && med <= 35) freq = 'monthly'; else if (med >= 84 && med <= 98) freq = 'quarterly'; else if (med >= 350 && med <= 380) freq = 'yearly';
    if (!freq) continue;
    const amts = g.map(t => Math.abs(t.amount)); const mA = median(amts);
    const consistent = amts.filter(a => Math.abs(a - mA) <= Math.max(2, mA * 0.2)).length / amts.length;
    const regular = ints.filter(x => Math.abs(x - med) <= Math.max(3, med * 0.25)).length / ints.length;
    if (consistent < 0.7 || regular < 0.6) continue;
    if ((freq === 'weekly' || freq === 'biweekly') && !opts.income && g.length < 4) continue;
    const per = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[freq];
    const last = g[g.length - 1]; const recent = g.slice(-4).map(t => Math.abs(t.amount)); const lastAmt = Math.abs(last.amount);
    const step = { weekly: 7, biweekly: 14, monthly: 0, quarterly: 0, yearly: 0 }[freq];
    let next = step ? addDays(last.date, step) : addMonthsDate(last.date, freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12);
    const active = daysBetween(last.date, ref) <= med * 1.6 + 6;
    let priceUp = null;
    for (let i = g.length - 2; i >= 0; i--) { const a = Math.abs(g[i].amount); if (Math.abs(a - lastAmt) > lastAmt * 0.03) { if (a < lastAmt && lastAmt - a >= 0.5 && daysBetween(g[i + 1].date, ref) <= 150) priceUp = { from: a, to: lastAmt, since: g[i + 1].date }; break; } }
    const cat = last.categoryId; const cg = catOf(cat).group;
    const isSub = cat === 'subs' || ((freq === 'monthly' || freq === 'yearly') && lastAmt < 80 && ['health', 'entertainment', 'education', 'uncat', 'shopping', 'business'].includes(cat));
    res.push({ key, name: last.merchant || key, cat, freq, amount: round2(lastAmt), monthly: round2(lastAmt * per), yearly: round2(lastAmt * per * 12), last: last.date, next, active, priceUp, isSub, count: g.length, accountId: last.accountId, ignored: !!(state.ignoreRecurring || {})[key] });
  }
  return res.sort((a, b) => b.monthly - a.monthly);
}
function latestDate() { let l = null; for (const t of state.transactions) if (!l || t.date > l) l = t.date; return l; }
function projectOccurrences(r, from, to) {
  const out = []; let d = r.next; let guard = 0;
  while (d < from && guard++ < 200) d = advance(r, d);
  while (d <= to && guard++ < 400) { out.push(d); d = advance(r, d); }
  return out;
}
function advance(r, d) { return r.freq === 'weekly' ? addDays(d, 7) : r.freq === 'biweekly' ? addDays(d, 14) : addMonthsDate(d, r.freq === 'monthly' ? 1 : r.freq === 'quarterly' ? 3 : 12); }
function payDates(from, to) {
  const p = state.settings.pay || {}; if (!p.next || !(+p.amount > 0)) return null;
  const out = []; let d = p.next, g = 0; const stepF = x => p.freq === 'weekly' ? addDays(x, 7) : p.freq === 'biweekly' ? addDays(x, 14) : p.freq === 'semimonthly' ? (+x.slice(8) < 15 ? x.slice(0, 8) + '15' : addMonthsDate(x.slice(0, 8) + '01', 1)) : addMonthsDate(x, 1);
  while (d < from && g++ < 300) d = stepF(d);
  while (d <= to && g++ < 600) { out.push({ date: d, amount: +p.amount }); d = stepF(d); }
  return out;
}
function nextPayday() { const p = payDates(TODAY, addDays(TODAY, 62)); if (p && p.length) return p[0].date; const inc = detectRecurring({ income: true }).filter(r => r.active && r.cat === 'income'); if (inc.length) { const r = inc[0]; const o = projectOccurrences(r, TODAY, addDays(TODAY, 62)); return o[0] || null; } return null; }
function cashAccounts() { return state.accounts.filter(a => a.type === 'checking'); }
function upcomingBills(days) {
  const to = addDays(TODAY, days); const out = [];
  for (const r of detectRecurring()) { if (!r.active || r.ignored) continue; for (const d of projectOccurrences(r, TODAY, to)) out.push({ date: d, name: r.name, amount: r.amount, cat: r.cat, r }); }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function safeToSpend() {
  const pay = nextPayday(); const cash = sumBy(cashAccounts(), acctBalance);
  if (!cashAccounts().length) return null;
  const until = pay || addDays(TODAY, 14);
  const bills = upcomingBills(daysBetween(TODAY, until) + 0).filter(b => b.date < until);
  const billTotal = sumBy(bills, 'amount');
  return { value: round2(cash - billTotal - (+state.settings.buffer || 0)), cash, billTotal, bills, until, pay };
}
function forecast(days) {
  const accts = cashAccounts(); if (!accts.length) return null;
  const start = sumBy(accts, acctBalance); const to = addDays(TODAY, days);
  const ev = {};
  const rec = detectRecurring().filter(r => r.active && !r.ignored);
  for (const r of rec) for (const d of projectOccurrences(r, addDays(TODAY, 1), to)) (ev[d] = ev[d] || []).push({ name: r.name, amount: -r.amount });
  let incomeEvents = payDates(addDays(TODAY, 1), to);
  if (!incomeEvents) { incomeEvents = []; for (const r of detectRecurring({ income: true }).filter(r => r.active)) for (const d of projectOccurrences(r, addDays(TODAY, 1), to)) incomeEvents.push({ date: d, amount: r.amount, name: r.name }); }
  for (const p of incomeEvents) (ev[p.date] = ev[p.date] || []).push({ name: p.name || 'Paycheck', amount: p.amount });
  // average variable (non-recurring) spending per day over last 60 days
  const recKeys = new Set(rec.map(r => r.key)); const since = addDays(TODAY, -60); let variable = 0;
  for (const t of state.transactions) { if (t.excluded || t.date < since || t.amount >= 0) continue; const g = catOf(t.categoryId).group; if (g === 'transfer' || g === 'savings' || g === 'income') continue; if (recKeys.has((t.merchant || t.desc).toUpperCase())) continue; variable += -t.amount; }
  const daily = variable / 60;
  // income that is not on a fixed schedule (commission, side gigs): add its recent monthly average, spread per day
  let extraDaily = 0; const p = state.settings.pay || {};
  if (payDates(TODAY, TODAY) !== null || (p.next && +p.amount > 0)) {
    const per = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 }[p.freq] || 1; const D = derive();
    const ms = fullMonthsBefore(D, THIS_MONTH, 3); if (ms.length) { const avgInc = sumBy(ms, k => D.months[k].income) / ms.length; const gap = avgInc - (+p.amount) * per; if (gap > 50) extraDaily = gap / 30.4; }
  }
  const series = []; let bal = start, low = { v: start, d: TODAY };
  for (let i = 0; i <= days; i++) {
    const d = addDays(TODAY, i); if (i > 0) { bal -= daily; bal += extraDaily; for (const e of (ev[d] || [])) bal += e.amount; }
    series.push({ d, v: round2(bal) }); if (bal < low.v) low = { v: bal, d };
  }
  const events = Object.keys(ev).sort().flatMap(d => ev[d].map(e => ({ date: d, ...e })));
  return { start, series, low, daily, extraDaily, events };
}
function simulateDebts(debts, extra, method) {
  const ds = debts.filter(d => d.bal > 0).map(d => ({ ...d, paidOff: null }));
  const budget = sumBy(ds, d => d.min) + (+extra || 0); let month = 0, interest = 0; const series = [round2(sumBy(ds, 'bal'))];
  while (ds.some(d => d.bal > 0.005) && month < 600) {
    month++; let pool = budget;
    for (const d of ds) if (d.bal > 0) { const i = d.bal * (d.apr / 100) / 12; d.bal += i; interest += i; }
    for (const d of ds) if (d.bal > 0) { const p = Math.min(d.min, d.bal, pool); d.bal -= p; pool -= p; }
    const order = ds.filter(d => d.bal > 0.005).sort(method === 'avalanche' ? (a, b) => b.apr - a.apr : (a, b) => a.bal - b.bal);
    for (const d of order) { if (pool <= 0) break; const p = Math.min(pool, d.bal); d.bal -= p; pool -= p; }
    for (const d of ds) if (d.bal <= 0.005 && !d.paidOff) { d.bal = 0; d.paidOff = month; }
    series.push(round2(sumBy(ds, 'bal')));
  }
  return { months: month, interest: round2(interest), series, order: [...ds].sort((a, b) => (a.paidOff || 999) - (b.paidOff || 999)), never: month >= 600 };
}

/* ---------- Insights: the cut list ---------- */
function buildInsights(D, m) {
  const out = []; const md = monthData(D, m); const prior = fullMonthsBefore(D, m, 3);
  const rec = detectRecurring(); const subs = rec.filter(r => r.isSub && r.active && !r.ignored);
  if (subs.length) out.push({ id: 'subs', sev: 'warn', title: subs.length + ' active subscriptions cost ' + money(sumBy(subs, 'monthly')) + '/mo', body: 'That is ' + money(sumBy(subs, 'yearly')) + ' a year. Open the list and mark any you would not sign up for again today.', yearly: sumBy(subs, 'yearly') * 0.35, tab: 'cut' });
  for (const r of rec.filter(r => r.priceUp && r.active)) out.push({ id: 'pu-' + r.key, sev: 'warn', title: r.name + ' went up to ' + money(r.priceUp.to, true), body: 'It was ' + money(r.priceUp.from, true) + '. Ask for a retention offer, downgrade the plan, or cancel.', yearly: (r.priceUp.to - r.priceUp.from) * (r.monthly / r.amount) * 12 });
  if (prior.length) {
    for (const c in md.byCat) {
      const g = catOf(c).group; if (g !== 'wants' && c !== 'groceries' && c !== 'transport') continue;
      const avg = sumBy(prior, k => D.months[k].byCat[c] || 0) / prior.length; const cur = md.byCat[c];
      const days = m === THIS_MONTH ? +TODAY.slice(8) : daysInMonth(m); const projected = m === THIS_MONTH ? cur / Math.max(days, 1) * daysInMonth(m) : cur;
      if (m === THIS_MONTH && days < 8) continue;
      if (projected > avg * 1.25 && projected - avg > 40) out.push({ id: 'hot-' + c, sev: 'bad', title: catOf(c).name + ' is running ' + Math.round((projected / Math.max(avg, 1) - 1) * 100) + '% above normal', body: (m === THIS_MONTH ? 'On pace for ' : 'You spent ') + money(projected) + ' vs your ' + prior.length + '-month average of ' + money(avg) + '.', yearly: (projected - avg) * 12, cat: c });
    }
  }
  const last3 = lastNMonths(m, 3).filter(k => D.months[k]);
  const avgOf = c => last3.length ? sumBy(last3, k => D.months[k].byCat[c] || 0) / last3.length : 0;
  const dining = avgOf('dining') + avgOf('coffee');
  if (dining > 120) out.push({ id: 'dining', sev: 'info', title: 'Eating out averages ' + money(dining) + '/mo', body: 'Cutting delivery and drive-thru by a third keeps about ' + money(dining / 3) + ' a month. Delivery apps typically add 20–40% in fees and markups over menu prices.', yearly: dining / 3 * 12, cat: 'dining' });
  const since90 = addDays(D.latest || TODAY, -90);
  const fees = state.transactions.filter(t => !t.excluded && t.categoryId === 'fees' && t.date >= since90 && t.amount < 0);
  if (fees.length) { const tot = -sumBy(fees, 'amount'); out.push({ id: 'fees', sev: 'bad', title: money(tot, true) + ' in fees and interest in 90 days', body: fees.length + ' charges, mostly avoidable: overdraft and ATM fees, late fees, card interest. Turn on low-balance alerts and pay the card in full when you can.', yearly: tot * 4 }); }
  const since30 = addDays(D.latest || TODAY, -30);
  const small = state.transactions.filter(t => !t.excluded && t.date >= since30 && t.amount < 0 && t.amount > -15 && ['wants', 'needs'].includes(catOf(t.categoryId).group) && t.categoryId !== 'subs');
  if (small.length >= 12) { const tot = -sumBy(small, 'amount'); out.push({ id: 'small', sev: 'info', title: small.length + ' purchases under $15 in 30 days', body: 'Together they add up to ' + money(tot) + '. Small taps are the easiest spending to forget.', yearly: tot * 12 * 0.4 }); }
  const dup = findDuplicates(); if (dup.length) out.push({ id: 'dupes', sev: 'bad', title: dup.length + ' possible duplicate charge' + (dup.length > 1 ? 's' : ''), body: dup.slice(0, 3).map(d => d.merchant + ' ' + money(-d.amount, true) + ' on ' + dShort(d.date)).join(', ') + '. Check with the merchant or dispute with your bank.', yearly: -sumBy(dup, 'amount') });
  const cc = state.accounts.filter(a => a.type === 'credit' && acctBalance(a) > 0 && +a.apr > 0);
  for (const a of cc) { const mo = acctBalance(a) * a.apr / 100 / 12; if (mo > 5) out.push({ id: 'cc-' + a.id, sev: 'bad', title: a.name + ' costs about ' + money(mo) + '/mo in interest', body: money(acctBalance(a)) + ' balance at ' + a.apr + '% APR. Paying it down is a guaranteed ' + a.apr + '% return. See Plan for a payoff order.', yearly: mo * 12, tab: 'plan' }); }
  const unc = state.transactions.filter(t => t.categoryId === 'uncat' && !t.excluded).length;
  if (unc) out.push({ id: 'uncat', sev: 'info', title: unc + ' uncategorized transactions', body: 'Categorize them so these numbers are complete. Tap one and tick “Always categorize” so it sticks.', yearly: 0, action: 'aicat' });
  const income = md.income, rate = income > 0 ? (income - md.spend) / income : null;
  if (rate != null && md.count > 10) out.push({ id: 'rate', sev: rate >= 0.2 ? 'good' : rate >= 0.1 ? 'warn' : 'bad', title: 'You kept ' + Math.round(rate * 100) + '% of income in ' + mLabel(m), body: rate >= 0.2 ? 'That clears the common 20% benchmark. Point the surplus at a goal so it does not drift into spending.' : 'The common benchmark is 20% or more. The items above are the fastest way to get there.', yearly: 0 });
  return out.sort((a, b) => (b.yearly || 0) - (a.yearly || 0));
}
function findDuplicates() {
  const since = addDays(TODAY, -90); const seen = {}; const out = [];
  const list = state.transactions.filter(t => !t.excluded && t.amount < -5 && t.date >= since && !['transfer', 'savings'].includes(catOf(t.categoryId).group)).sort((a, b) => a.date < b.date ? -1 : 1);
  for (const t of list) { const k = (t.merchant || '') + '|' + t.amount.toFixed(2); const p = seen[k]; if (p && p.date === t.date && t.amount <= -10 && p.id !== t.id) out.push(t); seen[k] = t; }
  return out;
}

/* ---------- Demo data (example only) ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildDemo() {
  const s = emptyState(); s.demo = true; state = s; rebuildCats();
  const rnd = mulberry32(42); const r = (a, b) => a + (b - a) * rnd(); const pick = a => a[Math.floor(rnd() * a.length)];
  const A = (name, type, extra) => { const a = { id: uid(), name, type, institution: '', balance: 0, history: [], holdings: [], apr: '', minPay: '', contribYTD: '', ...extra }; s.accounts.push(a); return a; };
  const chk = A('Everyday Checking', 'checking', { institution: 'Example Credit Union', balance: 2140.55 });
  const sav = A('High-Yield Savings', 'savings', { institution: 'Example Bank', balance: 3800 });
  const cc = A('Rewards Visa', 'credit', { institution: 'Example Card Co.', balance: 1260.4, apr: 27.99, minPay: 45 });
  const auto = A('Auto loan', 'loan', { institution: 'Example Auto Finance', balance: 14200, apr: 6.9, minPay: 389 });
  const stu = A('Student loan', 'loan', { institution: 'Example Servicer', balance: 9800, apr: 5.5, minPay: 210 });
  A('Company 401(k)', 'k401', { institution: 'Example Recordkeeper', contribYTD: 3900, holdings: [
    { sym: 'FXAIX', name: 'Fidelity 500 Index', shares: 38, price: 218.4, cost: 7400, cls: 'US stocks', er: 0.015 },
    { sym: 'FTIHX', name: 'Fidelity Total Intl Index', shares: 140, price: 17.1, cost: 2210, cls: 'International stocks', er: 0.06 },
    { sym: 'FXNAX', name: 'Fidelity US Bond Index', shares: 160, price: 10.42, cost: 1700, cls: 'Bonds', er: 0.025 }] });
  A('Roth IRA', 'roth', { institution: 'Example Brokerage', contribYTD: 2000, holdings: [
    { sym: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 12, price: 312.5, cost: 3300, cls: 'US stocks', er: 0.03 },
    { sym: 'VXUS', name: 'Vanguard Total Intl Stock ETF', shares: 9, price: 66.8, cost: 560, cls: 'International stocks', er: 0.05 }] });
  A('Taxable brokerage', 'brokerage', { institution: 'Example Brokerage', holdings: [
    { sym: 'ARKK', name: 'Example active fund', shares: 20, price: 56.2, cost: 1400, cls: 'US stocks', er: 0.75 }] });
  const tx = []; const add = (d, desc, amt, acct) => tx.push({ date: d, desc, amount: round2(amt), category: '', acct: acct.id });
  const start = '2026-04-01';
  for (let d = start; d <= TODAY; d = addDays(d, 1)) {
    const dom = +d.slice(8), dow = toD(d).getDay(), m = mKey(d);
    if (dow === 5 && daysBetween('2026-04-03', d) % 14 === 0) add(d, 'ACME AUTO GROUP PAYROLL DIR DEP', r(1580, 1640), chk);
    if (dom === 15) add(d, 'ACME AUTO GROUP COMMISSION DIR DEP', r(350, 1700), chk);
    if (dom === 1) add(d, 'PARKVIEW APTS RENT ONLINE PMT', -1450, chk);
    if (dom === 2) { add(d, 'TRANSFER TO SAVINGS 4471', -150, chk); add(d, 'TRANSFER FROM CHECKING', 150, sav); }
    if (dom === 5) add(d, 'ALLY AUTO PAYMENT', -389, chk);
    if (dom === 8) add(d, 'ROCKY MOUNTAIN POWER', -r(48, 112), chk);
    if (dom === 12) add(d, 'XFINITY INTERNET', -75, chk);
    if (dom === 16) add(d, 'FIDELITY ROTH IRA CONTRIB', -200, chk);
    if (dom === 18) add(d, 'T-MOBILE AUTOPAY', -85, cc);
    if (dom === 20) add(d, 'PROGRESSIVE INS PREM', -142, cc);
    if (dom === 22) add(d, 'NELNET STUDENT LOAN', -210, chk);
    if (dom === 3) add(d, 'NETFLIX.COM', m >= '2026-08' ? -17.99 : -15.49, cc);
    if (dom === 9) add(d, 'SPOTIFY USA', -11.99, cc);
    if (dom === 14) add(d, 'HULU 877-8244858', -9.99, cc);
    if (dom === 17) add(d, 'PLANET FITNESS CLUB FEE', -24.99, cc);
    if (dom === 21) add(d, 'OPENAI *CHATGPT SUBSCR', -20, cc);
    if (dom === 11) add(d, 'MICROSOFT*XBOX GAME PASS', m >= '2026-07' ? -19.99 : -16.99, cc);
    if (dom === 6) add(d, 'APPLE.COM/BILL', -2.99, cc);
    if (dom === 25) add(d, 'ADOBE *CREATIVE CLD', -22.99, cc);
    if (d === '2026-06-10') add(d, 'AMAZON PRIME*MEMBERSHIP', -139, cc);
    if (dom === 27) { const p = r(620, 950); add(d, 'ONLINE PAYMENT TO CREDIT CARD', -p, chk); add(d, 'PAYMENT THANK YOU', p, cc); }
    if (dom === 28) add(d, 'INTEREST CHARGE ON PURCHASES', -r(24, 31), cc);
    if (dom === 19) add(d, 'GREAT CLIPS #3311', -24, cc);
    if (dow === 0) add(d, pick(['SMITHS FOOD #4412 SALT LAKE UT', 'WALMART SUPERCENTER #3041', 'WINCO FOODS #112']), -r(48, 135), cc);
    if (dow === 3 && rnd() < 0.6) add(d, pick(['SMITHS FOOD #4412 SALT LAKE UT', 'WALMART SUPERCENTER #3041']), -r(18, 60), cc);
    if (dom === 13) add(d, 'COSTCO WHSE #0479', -r(120, 230), cc);
    if (rnd() < (dow === 5 || dow === 6 ? 0.75 : 0.42)) add(d, pick(['DOORDASH*CHIPOTLE', 'DOORDASH*PANDA EXPRESS', 'UBER *EATS PENDING', 'MCDONALD\'S F2231', 'TACO BELL #3324', 'CHICK-FIL-A #01829', 'IN-N-OUT BURGER #221', 'CAFE RIO #19', 'RAISING CANES #511']), -r(9, 38), cc);
    if (rnd() < 0.38) add(d, pick(['SWIG #12 MIDVALE UT', 'STARBUCKS STORE 10233', 'CRUMBL COOKIES', 'DUTCH BROS #882']), -r(4.5, 13.5), cc);
    if (dom % 6 === 1) add(d, pick(['MAVERIK #431', 'CHEVRON 0092214', 'COSTCO GAS #0479']), -r(38, 64), cc);
    if (rnd() < 0.13) add(d, pick(['AMAZON MKTPL*2K4LM1', 'AMZN Mktp US*RT5G2', 'TARGET 00012345']), -r(12, 92), cc);
    if (rnd() < 0.04) add(d, pick(['AMC THEATRES #2210', 'STEAM GAMES', 'TOPGOLF SALT LAKE']), -r(14, 68), cc);
    if (rnd() < 0.05) add(d, 'ATM FEE NON-NETWORK', -3.5, chk);
  }
  add('2026-07-29', 'OVERDRAFT FEE ITEM PAID', -35, chk);
  add('2026-09-12', 'DOORDASH*PANDA EXPRESS', -27.43, cc); add('2026-09-12', 'DOORDASH*PANDA EXPRESS', -27.43, cc);
  add('2026-08-04', 'AMAZON MKTPL*RETURN', 46.2, cc);
  for (const a of s.accounts) { const recs = tx.filter(t => t.acct === a.id); if (!recs.length) continue; const { added } = buildTransactions(recs, a.id); s.transactions.push(...added); }
  // balance history: walk back from today's balances using monthly drift
  const months = lastNMonths(THIS_MONTH, 7);
  for (const a of s.accounts) {
    const now = acctBalance(a); a.history = [];
    months.forEach((m, i) => { const back = months.length - 1 - i; const f = isLiab(a) ? 1 + back * (a.type === 'credit' ? 0.04 : 0.025) : isInvest(a) ? 1 - back * 0.045 + (back % 2 ? 0.012 : -0.008) : 1 - back * (a.type === 'savings' ? 0.04 : 0.02) + (back % 3 === 1 ? 0.05 : 0); const d = m === THIS_MONTH ? TODAY : m + '-' + pad(daysInMonth(m)); a.history.push({ d, v: round2(now * f) }); });
  }
  s.budgets = { housing: 1450, utilities: 175, groceries: 520, transport: 240, auto: 389, insurance: 142, health: 30, debt: 210, dining: 300, coffee: 60, shopping: 150, subs: 90, entertainment: 60, personal: 30, fees: 0 };
  s.rollover = { groceries: true, shopping: true };
  s.goals = [{ id: uid(), name: 'Emergency fund (3 months)', target: 9000, saved: 0, linked: sav.id, date: '2027-06-30' }, { id: uid(), name: 'Vacation', target: 1500, saved: 320, linked: '', date: '2027-03-01' }];
  let next = '2026-04-03'; while (next <= TODAY) next = addDays(next, 14);
  s.settings.pay = { freq: 'biweekly', next, amount: 1610 };
  s.settings.age = '';
  return s;
}

/* ---------- Persistence ---------- */
const LS_KEY = 'ledgerline:v1';
const Store = {
  mode: 'memory', db: null, uid: null, dirtyMeta: false, dirtyMonths: new Set(), timer: null, writing: false, lastError: null, onStatus: null,
  async init() {
    try {
      const cl = window.claude;
      if (cl && cl.use) {
        const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
        if (db && user) { const id = await user.id(); if (id) { this.db = db; this.uid = id; this.mode = 'cloud'; } }
      }
    } catch (e) { /* fall through */ }
    if (this.mode !== 'cloud') { try { localStorage.setItem('__ll', '1'); localStorage.removeItem('__ll'); this.mode = 'local'; } catch (e) { this.mode = 'memory'; } }
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  async load() {
    let local = null; try { const raw = localStorage.getItem(LS_KEY); if (raw) local = JSON.parse(raw); } catch (e) { }
    if (this.mode === 'cloud') {
      try {
        const snap = await this.col().limit(1000).get();
        if (!snap.empty) {
          let meta = null; const tx = [];
          for (const d of snap.docs) { const b = d.data(); if (d.id === 'meta') meta = b; else if (d.id.startsWith('tx-') && Array.isArray(b.items)) tx.push(...b.items); }
          if (meta) return { ...JSON.parse(JSON.stringify(meta)), transactions: JSON.parse(JSON.stringify(tx)) };
        }
        if (local && !local.demo) { this.markAll(local); return local; }
        return null;
      } catch (e) { this.lastError = e; return local; }
    }
    return local && !local.demo ? local : null;
  },
  markAll(s) { this.dirtyMeta = true; for (const t of s.transactions || []) this.dirtyMonths.add(mKey(t.date)); this.schedule(); },
  mark(meta, months) { if (state.demo) return; if (meta) this.dirtyMeta = true; for (const m of months || []) this.dirtyMonths.add(m); this.schedule(); },
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 700); this.status('saving'); },
  metaPayload() { const { transactions, ...rest } = state; return JSON.parse(JSON.stringify(rest)); },
  async flush() {
    if (state.demo) return;
    if (this.writing) { this.schedule(); return; }
    this.writing = true;
    try {
      if (this.mode === 'cloud') {
        if (this.dirtyMeta) { this.dirtyMeta = false; await this.col().doc('meta').set(this.metaPayload()); }
        const months = [...this.dirtyMonths]; this.dirtyMonths.clear();
        for (const m of months) {
          const items = state.transactions.filter(t => mKey(t.date) === m);
          const ref = this.col().doc('tx-' + m);
          if (items.length) await ref.set({ month: m, items: JSON.parse(JSON.stringify(items)) }); else await ref.delete();
        }
        try { localStorage.removeItem(LS_KEY); } catch (e) { }
      } else if (this.mode === 'local') {
        this.dirtyMeta = false; this.dirtyMonths.clear();
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      }
      this.lastError = null; this.status('saved');
    } catch (e) { this.lastError = e; this.status('error'); }
    finally { this.writing = false; }
  },
  async wipe() {
    if (this.mode === 'cloud') { try { const snap = await this.col().limit(1000).get(); for (const d of snap.docs) await this.col().doc(d.id).delete(); } catch (e) { } }
    try { localStorage.removeItem(LS_KEY); } catch (e) { }
  },
  status(s) { if (this.onStatus) this.onStatus(s); }
};

if (typeof module !== 'undefined') module.exports = { parseNFCUText, takePending, parseDelimited, parseAmount, parseDateAny, guessMapping, rowsToRecords, parseOFX, regexExtractStatement, cleanMerchant, merchantName, buildDemo, derive, detectRecurring, buildInsights, simulateDebts, forecast, safeToSpend, parsePositions, isPositionsTable, getState: () => state, setState: s => { state = s; rebuildCats(); } };
