import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const REPO_OWNER = "mg-ch-212";
const REPO_NAME  = "ort-crblds";
const FILE_PATH  = "templates.json";
const RAW_URL    = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const STORES_URL     = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/analytics-stores.json`;
const SCHED_PATH     = "schedules.json";
const SCHED_API      = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SCHED_PATH}`;
const SCHED_RAW_URL  = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${SCHED_PATH}`;
const APP_PIN    = "8XGc-DyH4eRzG5oj7h-Y3C0T";

// Trustpilot — Business Unit ID is public (same as a domain name)
const TP_BU_ID  = "5a0e1b590000ff0005b0acd9";
const TP_API    = `https://api.trustpilot.com/v1/business-units/${TP_BU_ID}`;

// ═══════════════════════════════════════════════
//  SCHEDULE CONSTANTS
// ═══════════════════════════════════════════════
const TEAM = [
  { name: "Kristiyan Ganchev",  defaultShift: "9:00 - 18:00",  color: "#3B82F6" },
  { name: "Bogomil Hadzhiyski", defaultShift: "13:30 - 22:00", color: "#8B5CF6" },
  { name: "Veselin Valkov",     defaultShift: "9:00 - 17:30",  color: "#10B981" },
  { name: "Momchil Georgiev",   defaultShift: "08:00 - 16:30", color: "#F59E0B" },
];
const SHIFT_TIMES = ["9:00 - 18:00","9:00 - 17:30","13:30 - 22:00","08:00 - 16:30","10:30 - 18:30","11:00 - 19:30"];
const OFF_REASONS = [
  { value: "PTO",           label: "🏖️ PTO",           bg: "#fff7ed", fg: "#9a3412", accent: "#f97316", border: "#fdba74" },
  { value: "Sick Leave",    label: "🤒 Sick Leave",    bg: "#ffe4e6", fg: "#9f1239", accent: "#f43f5e", border: "#fda4af" },
  { value: "Holiday",       label: "🎉 Holiday",       bg: "#fef3c7", fg: "#78350f", accent: "#f59e0b", border: "#fde68a" },
  { value: "Paid Vacation", label: "✈️ Paid Vacation", bg: "#ccfbf1", fg: "#134e4a", accent: "#0d9488", border: "#5eead4" },
  { value: "Other",         label: "📝 Other",         bg: "#f3f4f6", fg: "#374151", accent: "#6b7280", border: "#d1d5db" },
];
const OFF_VALUES = OFF_REASONS.map(r => r.value);
const ROTATION_PATTERNS = {
  "Rotation 1": [["9:00 - 18:00","9:00 - 17:30","13:30 - 22:00","08:00 - 16:30"],["9:00 - 18:00","13:30 - 22:00","9:00 - 17:30","08:00 - 16:30"]],
  "Rotation 2": [["9:00 - 18:00","13:30 - 22:00","9:00 - 17:30","08:00 - 16:30"],["9:00 - 18:00","9:00 - 17:30","13:30 - 22:00","08:00 - 16:30"]],
  "Custom": null,
};
const SCHED_DAYS   = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SCHED_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ═══════════════════════════════════════════════
//  SCHEDULE HELPERS
// ═══════════════════════════════════════════════
function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Find the Monday of the week that contains the 1st (may be in the previous month)
  const dow = firstDay.getDay(); // 0=Sun,1=Mon…6=Sat
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(firstDay);
  weekStart.setDate(firstDay.getDate() + toMonday);
  const weeks = []; let current = new Date(weekStart); let weekNum = 1;
  while (weekNum <= 6) {
    if (current > lastDay) break;
    const week = []; const ws = new Date(current);
    for (let d = 0; d < 7; d++) { const date = new Date(ws); date.setDate(ws.getDate() + d); week.push(date.getMonth() === month ? date : null); }
    if (week.some(d => d !== null)) { weeks.push({ weekNum, days: week, startDate: ws }); weekNum++; }
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}
function generateSchedule(year, month, pattern) {
  const weeks = getMonthWeeks(year, month);
  const rotation = ROTATION_PATTERNS[pattern || "Rotation 1"];
  return weeks.map((week, wi) => ({
    ...week,
    shifts: TEAM.map((member, mi) =>
      week.days.map((date, di) => {
        if (!date) return "";
        if (di >= 5) return "Weekend";
        return rotation ? rotation[wi % rotation.length][mi] : member.defaultShift;
      })
    ),
    homeOffice: TEAM.map(() => Array(7).fill(false)),
  }));
}
function sFmtDate(d) { return d ? `${d.getDate()}` : ""; }
function sFmtFull(d) {
  if (!d) return "";
  return `${SCHED_DAYS[d.getDay() === 0 ? 6 : d.getDay()-1]}, ${SCHED_MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function getShiftStyle(value) {
  if (!value) return { bg: "#fafafa", fg: "#ccc", accent: null };
  if (value === "Weekend") return { bg: "#f1f5f9", fg: "#94a3b8", accent: null };
  const off = OFF_REASONS.find(r => r.value === value);
  if (off) return { bg: off.bg, fg: off.fg, accent: off.accent };
  // Late shift — violet/purple (evening feel)
  if (value.includes("13:30") || value.includes("22:00")) return { bg: "#ede9fe", fg: "#4c1d95", accent: "#7c3aed" };
  // One-off holiday shifts — slate/neutral
  if (value.includes("10:30") || value.includes("11:00")) return { bg: "#f1f5f9", fg: "#475569", accent: "#64748b" };
  // All morning shifts (08:00-16:30, 9:00-17:30, 9:00-18:00) — sky blue
  return { bg: "#e0f2fe", fg: "#075985", accent: "#0ea5e9" };
}
function isOffDay(v) { return OFF_VALUES.includes(v); }

// ═══════════════════════════════════════════════
//  TEAM GUIDE SECTIONS
// ═══════════════════════════════════════════════
const GUIDE_SECTIONS = [
  { id:"morning",    icon:"☀️",  bg:"#FEF3C7", name:"Start of Shift",        desc:"Morning routine & backlog clearing",
    items:[{text:"Clear overnight Slack backlog",detail:"Sev 3 is handled by one person, Sev 4–5 by another. Triage everything that came in overnight before moving on."},{text:"Review social networks in order",detail:"Reddit → Twitter/X → Community Forum → Instagram. Stick to this priority order."},{text:"Check team email inbox",detail:"Respond to anything pending. Flag items that need escalation."},{text:"Input daily statistics",detail:"Use the automated stats sheet. Fill in before the day gets busy."}]},
  { id:"core",       icon:"🔄",  bg:"#DBEAFE", name:"Core Daily Tasks",       desc:"Reviews, moderation, DMs, monitoring",
    items:[{text:"Respond to reviews",detail:"Trustpilot → App Store → Google Play. Always prioritise negative reviews first — use the Response Templates tab."},{text:"Moderate T212 social via Slack",detail:"Review reported messages, check the \"Hot\" tab, remove unwanted content."},{text:"Handle private messages",detail:"Respond to DMs across all social platforms — don't let these pile up."},{text:"Monitor networks via Brandwatch",detail:"Twitter, Instagram, LinkedIn, Facebook, Threads, and others. Flag anything unusual."},{text:"Monitor MoneySavingExpert forum",detail:"Check for new Trading 212 mentions. Respond or escalate as needed."},{text:"Reply to colleague requests in community",detail:"When a colleague takes action on something community-related, confirm it in the relevant thread."}]},
  { id:"escalation", icon:"🚨",  bg:"#FEE2E2", name:"Escalations & Safety",   desc:"When to escalate, vulnerable clients, fraud",
    items:[{text:"Escalate cases to relevant teams",detail:"Route to Fraud, Transfers, Payments, etc. as needed. Don't sit on anything that's outside your scope."},{text:"Escalate vulnerable clients",detail:"If a client shows signs of financial vulnerability or distress, escalate immediately per the vulnerable client process."},{text:"Review expired client bans",detail:"Act on ban expiry alerts when they come in. Don't batch these — handle promptly."},{text:"Search for impersonation accounts / fake websites",detail:"Proactively search for accounts or sites pretending to be Trading 212. Report and escalate."},{text:"Handle compliance approvals",detail:"Social media content that needs compliance sign-off — route it, track it, follow up."}]},
  { id:"logging",    icon:"📝",  bg:"#D1FAE5", name:"Logging & Reporting",    desc:"Stats, feedback, instrument suggestions",
    items:[{text:"Log instrument suggestions",detail:"When clients request specific instruments, log them in the tracker so Product can review."},{text:"Log client feedback via Jira forms",detail:"Structured feedback goes through Jira. Use the correct form for the feedback type."},{text:"Trustpilot carousel on website",detail:"Keep the website's Trustpilot carousel updated with recent positive reviews."}]},
  { id:"community",  icon:"💬",  bg:"#F3E8FF", name:"Community & Content",    desc:"Forum posts, communities, content creation",
    items:[{text:"Share daily corporate events in the Community Forum",detail:"Evening task — post the next day's corporate events before end of shift."},{text:"Review and add new communities",detail:"Based on demand or trending instruments. Check if a new community makes sense before creating."},{text:"Create social media posts",detail:"When requested by the team. Follow brand guidelines and get compliance approval if needed."},{text:"Generate content ideas",detail:"Low priority, but keep a running list. Good ideas can be pitched in team meetings."}]},
  { id:"projects",   icon:"⚙️",  bg:"#E0F2FE", name:"Projects & Improvements",desc:"Automation, AI, process improvements",
    items:[{text:"Work on automation and AI improvements",detail:"Manager & senior focus. Identify repetitive tasks that can be automated or improved with AI tooling."}]},
];

const ALL_PLATFORMS = ["Trustpilot","Google Play","App Store","Google Maps","Reddit","X","Facebook","YouTube","Instagram","LinkedIn","Threads","Discourse Forum","TikTok"];
const TEAM_MEMBERS  = ["Momchil Georgiev","Kristiyan Ganchev","Bogomil Hadzhiyski","Veselin Valkov"];
const PLATFORM_COLORS = {
  "X":"#000","Instagram":"#E4405F","Facebook":"#1877F2","Reddit":"#FF4500",
  "Trustpilot":"#00B67A","Google Play":"#34A853","App Store":"#007AFF",
  "Google Maps":"#4285F4","YouTube":"#FF0000","TikTok":"#010101",
  "LinkedIn":"#0A66C2","Threads":"#000","Discourse Forum":"#D97706"
};

// ═══════════════════════════════════════════════
//  ANALYTICS MOCK DATA
// ═══════════════════════════════════════════════
const MOCK_TP_STATS = {
  trustScore:4.6, stars:4.5, total:83251, today:35, week:361,
  weekAvgRating:4.62, prevWeekAvgRating:4.58,
  dist:{ 5:65732, 4:9102, 3:2768, 2:1216, 1:4433 },
};
const MOCK_TP_24H = [
  {h:0,n:2},{h:1,n:1},{h:2,n:3},{h:3,n:0},{h:4,n:1},{h:5,n:0},
  {h:6,n:1},{h:7,n:2},{h:8,n:5},{h:9,n:8},{h:10,n:12},{h:11,n:0},
  {h:12,n:0},{h:13,n:0},{h:14,n:0},{h:15,n:0},{h:16,n:0},{h:17,n:0},
  {h:18,n:0},{h:19,n:0},{h:20,n:0},{h:21,n:0},{h:22,n:0},{h:23,n:0},
];
const MOCK_TP_7D = [
  {label:"Mon 21",n:52},{label:"Tue 22",n:61},{label:"Wed 23",n:48},
  {label:"Thu 24",n:55},{label:"Fri 25",n:67},{label:"Sat 26",n:43},{label:"Today",n:35},
];
const MOCK_TP_30D = [
  {label:"Mar 1",n:44},{label:"Mar 2",n:51},{label:"Mar 3",n:38},{label:"Mar 4",n:29},{label:"Mar 5",n:57},
  {label:"Mar 6",n:62},{label:"Mar 7",n:48},{label:"Mar 8",n:53},{label:"Mar 9",n:41},{label:"Mar 10",n:66},
  {label:"Mar 11",n:39},{label:"Mar 12",n:55},{label:"Mar 13",n:47},{label:"Mar 14",n:60},{label:"Mar 15",n:43},
  {label:"Mar 16",n:58},{label:"Mar 17",n:72},{label:"Mar 18",n:49},{label:"Mar 19",n:44},{label:"Mar 20",n:61},
  {label:"Mar 21",n:52},{label:"Mar 22",n:61},{label:"Mar 23",n:48},{label:"Mar 24",n:55},{label:"Mar 25",n:67},
  {label:"Mar 26",n:43},{label:"Today",n:35},
];
const MOCK_TP_REVIEWS = [
  {id:"r1",stars:5,author:"Glenys",title:"Excellent app",text:"Excellent app can check balance very easily",time:"10:18 AM",replied:false},
  {id:"r2",stars:5,author:"Mr. John Clarke",title:"Great website",text:"Great website, easy to use",time:"10:16 AM",replied:false},
  {id:"r3",stars:5,author:"Christian Sylvester Backa",title:"Easy to use and very simple",text:"Easy to use and very simple. There aren't any complicated layouts.",time:"10:12 AM",replied:false},
  {id:"r4",stars:1,author:"Poacher",title:"Well I cashed out gold for £156…",text:"Well I cashed out gold for £156 and didn't go to my account. So I am 156 pounds out of pocket.",time:"08:09 AM",replied:true},
  {id:"r5",stars:2,author:"Paul Clark",title:"I find it difficult to set up monthly deposits",text:"I find it difficult to set up monthly deposit and moving money around",time:"01:33 AM",replied:false},
];
// Hour 10 has 12 reviews vs ~4.5 baseline → 2.7× → ELEVATED (demo)
const MOCK_SPIKE = { level:"elevated", type:"volume", ratio:"2.7", count:12, baseline:"4.5" };

// ═══════════════════════════════════════════════
//  ANALYTICS HELPERS
// ═══════════════════════════════════════════════
const ANALYTICS_SNAPS_KEY = "ort-analytics-snaps";

function loadAnalyticsSnaps() {
  try { return JSON.parse(localStorage.getItem(ANALYTICS_SNAPS_KEY)) || []; }
  catch { return []; }
}
function saveAnalyticsSnap(snap) {
  const all = loadAnalyticsSnaps();
  all.push(snap);
  const cutoff = Date.now() - 35*24*60*60*1000; // keep 35 days
  try { localStorage.setItem(ANALYTICS_SNAPS_KEY, JSON.stringify(all.filter(s => new Date(s.ts)>cutoff))); } catch {}
}
function buildHourlyData(reviews) {
  const buckets = Array.from({length:24}, (_,h) => ({ h, n:0, label:`${h}:00` }));
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  (reviews||[]).forEach(r => {
    const d = new Date(r.createdAt);
    if (d >= todayStart) buckets[d.getHours()].n++;
  });
  return buckets;
}
function buildDailyFromSnaps(snaps, days) {
  const result = [];
  const now = new Date();
  for (let i = days-1; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i);
    const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i+1);
    const label    = i===0 ? "Today"
      : dayStart.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
    const daySnaps = snaps.filter(s => { const d=new Date(s.ts); return d>=dayStart&&d<dayEnd; });
    if (daySnaps.length >= 2) {
      result.push({ label, n: Math.max(0, Math.max(...daySnaps.map(s=>s.total)) - Math.min(...daySnaps.map(s=>s.total))) });
    } else {
      // Cross-day delta: last snap of previous day → first snap of this day
      const prevSnaps = snaps.filter(s => new Date(s.ts)<dayStart);
      const first     = daySnaps[0];
      const lastPrev  = prevSnaps.length ? prevSnaps.sort((a,b)=>new Date(b.ts)-new Date(a.ts))[0] : null;
      result.push({ label, n: (first&&lastPrev) ? Math.max(0, first.total-lastPrev.total) : 0 });
    }
  }
  return result;
}
function detectSpike(reviews) {
  if (!reviews || reviews.length < 5) return null;
  const now     = new Date();
  const hourAgo = new Date(now - 60*60*1000);
  const h48Ago  = new Date(now - 48*60*60*1000);
  const current = reviews.filter(r => new Date(r.createdAt) > hourAgo);
  const prior48 = reviews.filter(r => { const d=new Date(r.createdAt); return d>h48Ago&&d<=hourAgo; });
  // Volume spike
  if (prior48.length >= 6) {
    const baseline = prior48.length / 47;
    if (baseline > 0.3) {
      const ratio = current.length / baseline;
      if (ratio >= 2.0) return { level:"high",     type:"volume",    ratio:ratio.toFixed(1), count:current.length, baseline:baseline.toFixed(1) };
      if (ratio >= 1.5) return { level:"elevated",  type:"volume",    ratio:ratio.toFixed(1), count:current.length, baseline:baseline.toFixed(1) };
    }
  }
  // Sentiment spike
  if (current.length >= 3 && prior48.length >= 5) {
    const rNow  = current.reduce((s,r)=>s+r.stars,0)/current.length;
    const rBase = prior48.reduce((s,r)=>s+r.stars,0)/prior48.length;
    if (rBase - rNow >= 1.0) return { level:"elevated", type:"sentiment", recentAvg:rNow.toFixed(1), baselineAvg:rBase.toFixed(1) };
  }
  return null;
}

// ═══════════════════════════════════════════════
//  GITHUB API HELPERS
// ═══════════════════════════════════════════════
async function getFileAndSha(pat) {
  const res = await fetch(GITHUB_API, { headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(
    res.status === 401 ? "Invalid GitHub token — check your PAT in settings (🔑)." :
    res.status === 404 ? "Repo or file not found." : `GitHub API error: ${res.status}`
  );
  const d = await res.json();
  const raw = atob(d.content.replace(/\n/g,""));
  return { sha: d.sha, current: JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(raw, c => c.charCodeAt(0)))) };
}
async function commitFile(current, sha, message, pat) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
  const res = await fetch(GITHUB_API, {
    method: "PUT",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded, sha })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message === "Not Found" ? "Write access denied — use the shared team token (🔑)." : (e.message || "Failed to save.")); }
}
async function getSchedFileAndSha(pat) {
  const res = await fetch(SCHED_API, { headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" } });
  if (res.status === 404) return { sha: null, current: { months: {} } };
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const d = await res.json();
  const raw = atob(d.content.replace(/\n/g,""));
  return { sha: d.sha, current: JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(raw, c => c.charCodeAt(0)))) };
}
async function commitSchedFile(current, sha, message, pat) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  const res = await fetch(SCHED_API, {
    method: "PUT",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to save schedule."); }
}
async function submitToGitHub(d, pat) {
  const { sha, current } = await getFileAndSha(pat);
  const maxN = (current.templates||[]).reduce((m,t) => Math.max(m, parseInt((t.id||"T000").replace("T",""))||0), 0);
  const newId = "T"+String(maxN+1).padStart(3,"0");
  const today = new Date().toLocaleDateString("en-GB");
  current.templates = [...(current.templates||[]), { id:newId, title:d.title, category:d.category, platforms:d.platforms, text:d.text, notes:d.notes||"", author:d.author, status:"draft", dateAdded:today }];
  if (d.isNewCategory && d.category && !(current.categories||[]).some(c=>c.name===d.category)) {
    const mo = (current.categories||[]).reduce((m,c)=>Math.max(m,c.order||0),0);
    current.categories = [...(current.categories||[]), { name:d.category, icon:"📌", order:mo+1 }];
  }
  await commitFile(current, sha, `Add template: ${d.title}`, pat);
}
async function editTemplateOnGitHub(id, d, pat) {
  const { sha, current } = await getFileAndSha(pat);
  const maxN = (current.templates||[]).reduce((m,t) => Math.max(m, parseInt((t.id||"T000").replace("T",""))||0), 0);
  const draftId = "T"+String(maxN+1).padStart(3,"0");
  const today = new Date().toLocaleDateString("en-GB");
  current.templates = [...current.templates, { id:draftId, title:d.title, category:d.category, platforms:d.platforms, text:d.text, notes:d.notes||"", author:d.author||"", status:"draft", pendingAction:"edit", editOf:id, dateAdded:today }];
  await commitFile(current, sha, `Edit request: ${d.title}`, pat);
}
async function approveTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  const template = current.templates.find(t => t.id===id);
  if (template?.pendingAction==="edit" && template?.editOf) {
    current.templates = current.templates
      .filter(t => t.id!==template.editOf)
      .map(t => t.id===id ? { ...t, status:"approved", pendingAction:undefined, editOf:undefined } : t);
  } else {
    current.templates = current.templates.map(t => t.id===id ? { ...t, status:"approved" } : t);
  }
  await commitFile(current, sha, `Approve: ${title}`, pat);
}
async function discardTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.filter(t => t.id!==id);
  await commitFile(current, sha, `Discard template: ${title}`, pat);
}
async function deleteTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.map(t => t.id===id ? { ...t, status:"delete-requested" } : t);
  await commitFile(current, sha, `Delete request: ${title}`, pat);
}

// ═══════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function SocialMediaHub() {
  const [activeSection, setActiveSection]       = useState("templates");
  const [activeTab, setActiveTab]               = useState("templates"); // sub-tab: templates | guide
  const [search, setSearch]                     = useState("");
  const [platformFilter, setPlatformFilter]     = useState(null);
  const [authorFilter, setAuthorFilter]         = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [openGuideSections, setOpenGuideSections] = useState({});
  const [copiedId, setCopiedId]                 = useState(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [editingTemplate, setEditingTemplate]   = useState(null);
  const [deleteConfirmId, setDeleteConfirmId]   = useState(null);
  const [actionLoading, setActionLoading]       = useState(null); // stores the ID being actioned
  const [loading, setLoading]                   = useState(true);
  const [fetchError, setFetchError]             = useState(null);
  const [ghPat, setGhPat]                       = useState(() => localStorage.getItem("ort_gh_pat") || "");
  const [tpKey, setTpKey]                       = useState(() => localStorage.getItem("ort_tp_key") || "");
  const [unlocked, setUnlocked]                 = useState(() => sessionStorage.getItem("ort_unlocked") === "1");
  const [allTemplates, setAllTemplates]         = useState([]);
  const [categories, setCategories]             = useState([]);
  const [isMobile, setIsMobile]                 = useState(() => window.innerWidth < 700);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const savePat   = (p) => { setGhPat(p); p ? localStorage.setItem("ort_gh_pat", p) : localStorage.removeItem("ort_gh_pat"); };
  const saveTpKey = (k) => { setTpKey(k); k ? localStorage.setItem("ort_tp_key", k) : localStorage.removeItem("ort_tp_key"); };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${RAW_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllTemplates(data.templates || []);
      setCategories(data.categories || []);
      setFetchError(null);
    } catch { setFetchError("Couldn't load templates. Check your connection."); }
  }, []);

  useEffect(() => { loadData().finally(() => setLoading(false)); }, [loadData]);

  if (!unlocked) return <PinModal onUnlock={() => { sessionStorage.setItem("ort_unlocked","1"); setUnlocked(true); }} />;

  const approvedTemplates = allTemplates.filter(t => t.status === "approved");
  const draftTemplates    = allTemplates.filter(t => t.status === "draft");
  const deleteRequested   = allTemplates.filter(t => t.status === "delete-requested");
  const pendingCount      = draftTemplates.length + deleteRequested.length;

  const mergedCategories = (() => {
    const iconMap  = Object.fromEntries(categories.map(c => [c.name, c.icon]));
    const orderMap = Object.fromEntries(categories.map(c => [c.name, c.order]));
    const catMap   = {};
    approvedTemplates.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { name:t.category, icon:iconMap[t.category]||"📌", replies:[] };
      catMap[t.category].replies.push({ ...t, builtIn: t.author==="Trading 212" });
    });
    return Object.values(catMap).sort((a,b) => (orderMap[a.name]??999)-(orderMap[b.name]??999));
  })();

  const filtered = (() => {
    const q = search.toLowerCase().trim();
    return mergedCategories.map(cat => ({
      ...cat,
      replies: cat.replies.filter(r => {
        const ms = !q || r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
        const mp = !platformFilter || r.platforms.includes(platformFilter);
        const ma = !authorFilter || r.author === authorFilter;
        return ms && mp && ma;
      })
    })).filter(c => c.replies.length > 0);
  })();

  const usedPlatforms  = [...new Set(mergedCategories.flatMap(c => c.replies.flatMap(r => r.platforms)))];
  const teamAuthors    = [...new Set(approvedTemplates.filter(t => t.author && t.author!=="Trading 212").map(t => t.author))];
  const totalReplies   = mergedCategories.reduce((s,c) => s+c.replies.length, 0);
  const teamAddedCount = approvedTemplates.filter(t => t.author!=="Trading 212").length;
  const filteredTotal  = filtered.reduce((s,c) => s+c.replies.length, 0);

  const handleCopy = async (rid, text) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;opacity:0;left:-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopiedId(rid); setTimeout(() => setCopiedId(null), 2000);
  };
  const handleDelete = async (id, title) => {
    setActionLoading(id);
    setAllTemplates(prev => prev.filter(t => t.id!==id));
    setDeleteConfirmId(null);
    try { await deleteTemplateOnGitHub(id,title,ghPat); }
    catch(e) { alert(e.message); loadData(); } // reload only on failure to restore state
    finally { setActionLoading(null); }
  };
  const handleApprove = async (id, title) => {
    setActionLoading(id);
    const item = allTemplates.find(t => t.id===id);
    setAllTemplates(prev => {
      if (item?.pendingAction==="edit" && item?.editOf)
        return prev.filter(t => t.id!==id && t.id!==item.editOf);
      return prev.filter(t => t.id!==id);
    });
    try { await approveTemplateOnGitHub(id,title,ghPat); }
    catch(e) { alert(e.message); loadData(); }
    finally { setActionLoading(null); }
  };
  const handleDiscard = async (id, title) => {
    setActionLoading(id);
    setAllTemplates(prev => prev.filter(t => t.id!==id));
    try { await discardTemplateOnGitHub(id,title,ghPat); }
    catch(e) { alert(e.message); loadData(); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div style={{fontFamily:"'Poppins',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#8B949E"}}>Loading…</div>;

  const inputStyle = { width:"100%", border:"1px solid #D0D7DE", borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", background:"#F6F8FA", boxSizing:"border-box" };

  const navItems = [
    { id:"templates",   icon:"💬", label:"Templates" },
    ...(ghPat ? [{ id:"pending", icon:"📥", label:"Pending Items", badge:pendingCount }] : []),
    { id:"schedule",    icon:"📅", label:"Schedule" },
    { id:"analytics",   icon:"📊", label:"Analytics" },
    { id:"performance", icon:"🏆", label:"Team Performance", soon:true },
    { id:"resources",   icon:"🔗", label:"Resources" },
  ];

  return (
    <div style={{fontFamily:"'Poppins',-apple-system,BlinkMacSystemFont,sans-serif",WebkitFontSmoothing:"antialiased",display:"flex",minHeight:"100vh",background:"#F4F4F2"}}>

      {/* ── SIDEBAR ── */}
      {!isMobile ? (
        <div style={{width:220,background:"#0D1117",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0}}>
          <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:"rgba(0,182,122,0.12)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📋</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#FFF",lineHeight:1.2}}>ORT Battleground</div>
                <div style={{fontSize:10,color:"#8B949E",marginTop:1}}>Trading 212</div>
              </div>
            </div>
          </div>
          <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
            {navItems.filter(n=>!n.soon).map(item => (
              <button key={item.id} onClick={()=>setActiveSection(item.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",
                background:activeSection===item.id?"rgba(0,182,122,0.13)":"none",
                border:activeSection===item.id?"1px solid rgba(0,182,122,0.2)":"1px solid transparent",
                borderRadius:8,cursor:"pointer",fontFamily:"inherit",
                color:activeSection===item.id?"#00B67A":"#8B949E",
                fontSize:13,fontWeight:activeSection===item.id?600:400,marginBottom:2,textAlign:"left",transition:"all 0.15s"
              }}>
                <span style={{fontSize:15}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge>0 && <span style={{background:"#EF4444",color:"#FFF",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:700,lineHeight:1.4}}>{item.badge}</span>}
              </button>
            ))}
            <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:8,paddingTop:8}}>
              {navItems.filter(n=>n.soon).map(item => (
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:8,color:"#4B5563",fontSize:13,marginBottom:2,opacity:0.5}}>
                  <span style={{fontSize:15}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.label}</span>
                  <span style={{fontSize:9,background:"rgba(255,255,255,0.08)",color:"#8B949E",padding:"2px 6px",borderRadius:4,fontWeight:600}}>SOON</span>
                </div>
              ))}
            </div>
          </nav>
          <div style={{padding:"12px 10px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            <button onClick={()=>setShowSettings(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",background:"none",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,cursor:"pointer",fontFamily:"inherit",color:(ghPat||tpKey)?"#00B67A":"#57606A",fontSize:12,textAlign:"left"}}>
              <span>🔑</span><span>{ghPat&&tpKey?"All tokens set":ghPat?"GitHub token set":tpKey?"Trustpilot key set":"API keys"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"#0D1117",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",padding:"0 12px",height:52,gap:4,overflowX:"auto"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#FFF",whiteSpace:"nowrap",marginRight:8}}>ORT</div>
          {navItems.map(item => (
            <button key={item.id} onClick={()=>!item.soon&&setActiveSection(item.id)} style={{
              padding:"6px 12px",fontSize:12,fontWeight:500,cursor:item.soon?"default":"pointer",
              border:"none",background:"none",fontFamily:"inherit",whiteSpace:"nowrap",
              borderBottom:`2px solid ${activeSection===item.id?"#00B67A":"transparent"}`,
              color:item.soon?"#4B5563":activeSection===item.id?"#FFF":"#8B949E",
              display:"flex",alignItems:"center",gap:5,height:52
            }}>
              {item.icon} {item.label}
              {item.badge>0 && <span style={{background:"#EF4444",color:"#FFF",borderRadius:8,fontSize:9,padding:"1px 5px",fontWeight:700}}>{item.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,minWidth:0,padding:isMobile?"68px 12px 24px":"24px 28px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>

          {/* ══ TEMPLATES SECTION ══ */}
          {activeSection==="templates" && (
            <>
              {/* Inner tab bar */}
              <div style={{display:"flex",background:"#FFF",borderRadius:12,padding:"0 4px",marginBottom:20,border:"1px solid #E1E4E8",gap:2,width:"fit-content"}}>
                {[{id:"templates",label:"💬 Templates"},{id:"guide",label:"📘 Team Guide"}].map(t => (
                  <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                    padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer",border:"none",background:"none",fontFamily:"inherit",borderRadius:8,
                    background:activeTab===t.id?"#0D1117":"none",color:activeTab===t.id?"#FFF":"#8B949E",transition:"all 0.15s",whiteSpace:"nowrap"
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Templates sub-tab */}
              {activeTab==="templates" && (
                <>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:20}}>
                    <div>
                      <h2 style={{fontSize:20,fontWeight:700,color:"#1F2328",margin:0}}>Response Templates</h2>
                      <div style={{fontSize:13,color:"#8B949E",marginTop:2}}>{mergedCategories.length} categories · {totalReplies} replies · {teamAddedCount} team-added</div>
                    </div>
                    <button onClick={()=>{if(!ghPat)setShowSettings(true);else setShowAddModal(true);}} style={{background:"#00B67A",color:"#FFF",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>+ Add Template</button>
                  </div>
                  {fetchError && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#DC2626"}}>⚠️ {fetchError}</div>}
                  <div style={{background:"#FFF",borderRadius:12,padding:"16px 20px",marginBottom:16,border:"1px solid #E1E4E8"}}>
                    <input type="text" placeholder="Search replies by keyword..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inputStyle,marginBottom:12,fontSize:14}} />
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:teamAuthors.length>0?10:0}}>
                      <button onClick={()=>setPlatformFilter(null)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:500,fontFamily:"inherit",border:`1px solid ${!platformFilter?"#0D1117":"#D0D7DE"}`,background:!platformFilter?"#0D1117":"#FFF",color:!platformFilter?"#FFF":"#57606A"}}>All</button>
                      {usedPlatforms.map(p => { const c=PLATFORM_COLORS[p]||"#888"; const active=platformFilter===p; return (
                        <button key={p} onClick={()=>setPlatformFilter(active?null:p)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:500,fontFamily:"inherit",border:`1px solid ${c}${active?"80":"40"}`,background:active?`${c}20`:`${c}0d`,color:c}}>{p}</button>
                      );})}
                    </div>
                    {teamAuthors.length>0 && (
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingTop:10,borderTop:"1px solid #F0F0F0",alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#8B949E",marginRight:2}}>By member:</span>
                        {teamAuthors.map(a => (
                          <button key={a} onClick={()=>setAuthorFilter(authorFilter===a?null:a)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:500,fontFamily:"inherit",border:`1px solid ${authorFilter===a?"#6366F1":"#D0D7DE"}`,background:authorFilter===a?"#EEF2FF":"#FFF",color:authorFilter===a?"#4F46E5":"#57606A"}}>{a}</button>
                        ))}
                      </div>
                    )}
                    {(search||platformFilter||authorFilter) && <div style={{marginTop:10,fontSize:12,color:"#57606A"}}>Showing {filteredTotal} {filteredTotal===1?"reply":"replies"} across {filtered.length} {filtered.length===1?"category":"categories"}</div>}
                  </div>
                  {filtered.length===0 ? (
                    <div style={{textAlign:"center",padding:40,color:"#57606A"}}><div style={{fontSize:32,marginBottom:8}}>🔍</div><p>No replies match your search.</p></div>
                  ) : filtered.map(cat => {
                    const isOpen = expandedCategory===cat.name;
                    return (
                      <div key={cat.name} style={{background:"#FFF",borderRadius:12,marginBottom:10,border:"1px solid #E1E4E8",overflow:"hidden"}}>
                        <button onClick={()=>setExpandedCategory(isOpen?null:cat.name)} style={{width:"100%",background:"none",border:"none",padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",fontFamily:"inherit"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:16}}>{cat.icon}</span>
                            <span style={{fontSize:15,fontWeight:600,color:"#1F2328"}}>{cat.name}</span>
                            <span style={{fontSize:11,color:"#57606A",background:"#F6F8FA",padding:"2px 8px",borderRadius:12,border:"1px solid #E1E4E8"}}>{cat.replies.length}</span>
                          </div>
                          <span style={{fontSize:14,color:"#57606A",transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none"}}>▼</span>
                        </button>
                        {isOpen && (
                          <div style={{padding:"0 18px 14px"}}>
                            {cat.replies.map((r,ri) => {
                              const rid=`${cat.name}-${ri}`;
                              const isCopied=copiedId===rid;
                              const isTeamAdded=!r.builtIn;
                              const isDC=deleteConfirmId===rid;
                              return (
                                <div key={rid} style={{background:isTeamAdded?"#F0FDF4":"#F6F8FA",borderRadius:10,padding:16,marginBottom:8,border:`1px solid ${isTeamAdded?"#BBF7D0":"#E1E4E8"}`}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                      <div style={{fontSize:13,fontWeight:600,color:"#1F2328"}}>{r.title}</div>
                                      {isTeamAdded && <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"#DCFCE7",color:"#166534",fontWeight:600}}>TEAM-ADDED{r.author?` · ${r.author}`:""}</span>}
                                    </div>
                                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                                      {ghPat && (<>
                                        <button onClick={()=>{setDeleteConfirmId(null);setEditingTemplate(r);}} title="Edit" style={{background:"#F6F8FA",color:"#57606A",border:"1px solid #D0D7DE",borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                                        <button onClick={()=>setDeleteConfirmId(isDC?null:rid)} title="Delete" style={{background:isDC?"#FEF2F2":"#F6F8FA",color:isDC?"#DC2626":"#57606A",border:`1px solid ${isDC?"#FECACA":"#D0D7DE"}`,borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                                      </>)}
                                      <button onClick={()=>handleCopy(rid,r.text)} style={{background:isCopied?"#1A7F37":"#24292F",color:"#FFF",border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontWeight:500,fontFamily:"inherit",flexShrink:0}}>{isCopied?"✓ Copied":"Copy"}</button>
                                    </div>
                                  </div>
                                  {isDC && (
                                    <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                                      <span style={{fontSize:12,color:"#991B1B"}}>Mark for deletion? Hidden until removed in GitHub.</span>
                                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                                        <button onClick={()=>setDeleteConfirmId(null)} style={{background:"#FFF",border:"1px solid #D0D7DE",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#57606A"}}>Cancel</button>
                                        <button onClick={()=>handleDelete(r.id,r.title)} disabled={!!actionLoading} style={{background:"#DC2626",color:"#FFF",border:"none",borderRadius:6,padding:"4px 14px",fontSize:12,fontWeight:600,cursor:actionLoading?"default":"pointer",fontFamily:"inherit"}}>{actionLoading===r.id?"Deleting…":"Confirm"}</button>
                                      </div>
                                    </div>
                                  )}
                                  <div style={{fontSize:13,color:"#444",lineHeight:1.65,whiteSpace:"pre-line",marginBottom:10}}>{r.text}</div>
                                  {r.notes && <div style={{fontSize:12,color:"#9A6700",background:"#FFF8C5",padding:"6px 10px",borderRadius:6,border:"1px solid #F5E0A0",marginBottom:10}}>💡 {r.notes}</div>}
                                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                    {r.platforms.map(p => <span key={p} style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:500,background:`${PLATFORM_COLORS[p]||"#888"}12`,color:PLATFORM_COLORS[p]||"#888",border:`1px solid ${PLATFORM_COLORS[p]||"#888"}25`}}>{p}</span>)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Guide sub-tab */}
              {activeTab==="guide" && (
                <>
                  <div style={{background:"#FFF",borderRadius:12,padding:"14px 20px",marginBottom:16,border:"1px solid #E1E4E8",fontSize:13,color:"#57606A",lineHeight:1.6}}>Everything the team handles day-to-day, organised by when and how.</div>
                  {GUIDE_SECTIONS.map(s => {
                    const isOpen=openGuideSections[s.id];
                    return (
                      <div key={s.id} style={{background:"#FFF",borderRadius:12,marginBottom:10,border:"1px solid #E1E4E8",overflow:"hidden"}}>
                        <button onClick={()=>setOpenGuideSections(prev=>({...prev,[s.id]:!prev[s.id]}))} style={{width:"100%",background:"none",border:"none",padding:"16px 20px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",fontFamily:"inherit"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,background:s.bg,flexShrink:0}}>{s.icon}</div>
                            <div><div style={{fontSize:15,fontWeight:600,color:"#1F2328"}}>{s.name}</div><div style={{fontSize:12,color:"#57606A",marginTop:2}}>{s.desc}</div></div>
                          </div>
                          <span style={{fontSize:14,color:"#57606A",transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none",flexShrink:0}}>▼</span>
                        </button>
                        {isOpen && <div style={{padding:"0 20px 20px"}}>{s.items.map((item,i) => <div key={i} style={{background:"#F6F8FA",borderRadius:10,padding:"14px 16px",marginBottom:6,border:"1px solid #E1E4E8"}}><div style={{fontSize:13,fontWeight:600,color:"#1F2328",marginBottom:4}}>{item.text}</div><div style={{fontSize:12,color:"#57606A",lineHeight:1.55}}>{item.detail}</div></div>)}</div>}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* ══ PENDING ITEMS SECTION ══ */}
          {activeSection==="pending" && ghPat && (() => {
            const newDrafts      = draftTemplates.filter(t => !t.pendingAction);
            const editDrafts     = draftTemplates.filter(t => t.pendingAction==="edit");
            const allEmpty       = newDrafts.length===0 && editDrafts.length===0 && deleteRequested.length===0;
            const anyAbove       = (n) => n > 0;
            return (
              <>
                <div style={{marginBottom:20}}>
                  <h2 style={{fontSize:20,fontWeight:700,color:"#1F2328",margin:0}}>Pending Items</h2>
                  <div style={{fontSize:13,color:"#8B949E",marginTop:2}}>New templates, edit requests and deletion requests awaiting action</div>
                </div>
                {allEmpty && (
                  <div style={{background:"#FFF",borderRadius:12,padding:"48px 24px",border:"1px solid #E1E4E8",textAlign:"center"}}>
                    <div style={{fontSize:32,marginBottom:12}}>✅</div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1F2328",marginBottom:6}}>All clear</div>
                    <div style={{fontSize:13,color:"#8B949E"}}>No pending items right now.</div>
                  </div>
                )}
                {newDrafts.length>0 && (<>
                  <div style={{fontSize:12,fontWeight:600,color:"#8B949E",letterSpacing:0.5,textTransform:"uppercase",marginBottom:10}}>New templates — {newDrafts.length}</div>
                  {newDrafts.map(t => <DraftCard key={t.id} template={t} type="new" isLoading={actionLoading===t.id} onApprove={()=>handleApprove(t.id,t.title)} onDiscard={()=>handleDiscard(t.id,t.title)} />)}
                </>)}
                {editDrafts.length>0 && (<>
                  <div style={{fontSize:12,fontWeight:600,color:"#8B949E",letterSpacing:0.5,textTransform:"uppercase",margin:newDrafts.length>0?"20px 0 10px":"0 0 10px"}}>Edit requests — {editDrafts.length}</div>
                  {editDrafts.map(t => <DraftCard key={t.id} template={t} type="edit" isLoading={actionLoading===t.id} onApprove={()=>handleApprove(t.id,t.title)} onDiscard={()=>handleDiscard(t.id,t.title)} />)}
                </>)}
                {deleteRequested.length>0 && (<>
                  <div style={{fontSize:12,fontWeight:600,color:"#8B949E",letterSpacing:0.5,textTransform:"uppercase",margin:(anyAbove(newDrafts.length)||anyAbove(editDrafts.length))?"20px 0 10px":"0 0 10px"}}>Deletion requests — {deleteRequested.length}</div>
                  {deleteRequested.map(t => <DraftCard key={t.id} template={t} type="delete" isLoading={actionLoading===t.id} onApprove={()=>handleDiscard(t.id,t.title)} onDiscard={()=>handleApprove(t.id,t.title)} />)}
                </>)}
              </>
            );
          })()}

          {/* ══ SCHEDULE SECTION ══ */}
          {activeSection==="schedule" && <ScheduleSection ghPat={ghPat} />}

          {/* ══ ANALYTICS SECTION ══ */}
          {activeSection==="analytics" && <AnalyticsSection tpKey={tpKey} />}

          {/* ══ TEAM PERFORMANCE SECTION ══ */}
          {activeSection==="performance" && (
            <div style={{background:"#FFF",borderRadius:12,padding:"48px 24px",border:"1px solid #E1E4E8",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🏆</div>
              <div style={{fontSize:17,fontWeight:700,color:"#1F2328",marginBottom:8}}>Team Performance</div>
              <div style={{fontSize:13,color:"#8B949E",maxWidth:380,margin:"0 auto",lineHeight:1.6}}>Agent stats, response goals and individual performance tracking — coming soon.</div>
            </div>
          )}

          {/* ══ RESOURCES SECTION ══ */}
          {activeSection==="resources" && <ResourcesSection />}

          <div style={{textAlign:"center",padding:"28px 0 8px",fontSize:11,color:"#8B949E"}}>Trading 212 ORT Battleground · Internal Use Only</div>
        </div>
      </div>

      {showSettings && <SettingsModal currentPat={ghPat} currentTpKey={tpKey} onSave={({pat,tpKey:tk})=>{savePat(pat);saveTpKey(tk);setShowSettings(false);}} onClose={()=>setShowSettings(false)} />}
      {showAddModal && <AddTemplateModal categories={categories.map(c=>c.name)} onSave={async(t)=>{await submitToGitHub(t,ghPat);setShowAddModal(false);}} onClose={()=>setShowAddModal(false)} />}
      {editingTemplate && <AddTemplateModal categories={categories.map(c=>c.name)} initialData={editingTemplate} onSave={async(t)=>{await editTemplateOnGitHub(editingTemplate.id,t,ghPat);setEditingTemplate(null);}} onClose={()=>setEditingTemplate(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  SCHEDULE SECTION
// ═══════════════════════════════════════════════
function ScheduleSection({ ghPat }) {
  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [pattern,       setPattern]       = useState("Rotation 1");
  const [schedule,      setSchedule]      = useState(null);
  const [savedMonths,   setSavedMonths]   = useState({});
  const [allSchedules,  setAllSchedules]  = useState({});
  const [showCreator,   setShowCreator]   = useState(false);
  const [loaded,        setLoaded]        = useState(false);
  const [toast,         setToast]         = useState(null);
  const saveTimer = useRef(null);

  const monthLabel = SCHED_MONTHS[selectedMonth] + " " + selectedYear;
  const parseWeeks = (w) => w.map(wk => ({ ...wk, days: wk.days.map(d => d ? new Date(d) : null) }));
  const serializeWeeks = (w) => w.map(wk => ({ ...wk, days: wk.days.map(d => d ? d.toISOString() : null) }));

  // ── initial load ───────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Try GitHub CDN first (all users, no auth needed)
      try {
        const res = await fetch(`${SCHED_RAW_URL}?_=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const months = data.months || {};
          const index = {}, parsed = {};
          for (const [k, v] of Object.entries(months)) {
            index[k] = v.label || k;
            parsed[k] = parseWeeks(v.weeks || []);
          }
          setAllSchedules(parsed); setSavedMonths(index);
          const keys = Object.keys(index).sort();
          if (keys.length > 0) {
            const latest = keys[keys.length - 1];
            const [y, m] = latest.split("-").map(Number);
            setSelectedYear(y); setSelectedMonth(m);
            setSchedule(parsed[latest]);
          }
          setLoaded(true);
          return;
        }
      } catch(e) {}
      // Fallback: localStorage (first time or file not yet on GitHub)
      try {
        const raw = localStorage.getItem("ort-schedule-index");
        if (raw) {
          const index = JSON.parse(raw);
          const parsed = {};
          for (const k of Object.keys(index)) {
            const d = localStorage.getItem("ort-schedule:" + k);
            if (d) parsed[k] = parseWeeks(JSON.parse(d));
          }
          setAllSchedules(parsed); setSavedMonths(index);
          const keys = Object.keys(index).sort();
          if (keys.length > 0) {
            const latest = keys[keys.length - 1];
            const [y, m] = latest.split("-").map(Number);
            setSelectedYear(y); setSelectedMonth(m);
            setSchedule(parsed[latest]);
          }
          // Auto-migrate: push all local months to GitHub if PAT is available
          if (ghPat && Object.keys(parsed).length > 0) {
            (async () => {
              try {
                const { sha, current } = await getSchedFileAndSha(ghPat);
                current.months = current.months || {};
                for (const k of Object.keys(parsed)) {
                  current.months[k] = { label: index[k] || k, weeks: serializeWeeks(parsed[k]) };
                }
                await commitSchedFile(current, sha, "Sync local schedules to GitHub", ghPat);
                setToast("✓ Schedules synced to GitHub — team can now see them");
              } catch(e) { console.error("Auto-sync failed:", e.message); }
            })();
          }
        }
      } catch(e) {}
      setLoaded(true);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── save (GitHub + localStorage cache) ─────────
  const saveSchedule = useCallback(async (sched, year, month) => {
    const key = year + "-" + month;
    const label = SCHED_MONTHS[month] + " " + year;
    const serializable = serializeWeeks(sched);
    setAllSchedules(prev => ({ ...prev, [key]: sched }));
    setSavedMonths(prev => {
      const next = { ...prev, [key]: label };
      try { localStorage.setItem("ort-schedule-index", JSON.stringify(next)); } catch(e) {}
      return next;
    });
    try { localStorage.setItem("ort-schedule:" + key, JSON.stringify(serializable)); } catch(e) {}
    if (ghPat) {
      try {
        const { sha, current } = await getSchedFileAndSha(ghPat);
        current.months = current.months || {};
        current.months[key] = { label, weeks: serializable };
        await commitSchedFile(current, sha, `Update schedule: ${label}`, ghPat);
      } catch(e) { console.error("Schedule sync failed:", e.message); return false; }
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghPat]);

  const handleCreate = async () => {
    const sched = generateSchedule(selectedYear, selectedMonth, pattern);
    setSchedule(sched);
    const ok = await saveSchedule(sched, selectedYear, selectedMonth);
    setToast(ok
      ? "✓ " + SCHED_MONTHS[selectedMonth] + " " + selectedYear + " created" + (ghPat ? " & synced" : " (local — add token in 🔑 to share)")
      : "⚠ Created but sync failed");
    setShowCreator(false);
  };

  const handleLoadMonth = (key) => {
    const [y, m] = key.split("-").map(Number);
    setSelectedYear(y); setSelectedMonth(m);
    setSchedule(allSchedules[key] || generateSchedule(y, m, pattern));
  };

  const handleDeleteMonth = async (key) => {
    const newAll = { ...allSchedules }; delete newAll[key];
    const newIndex = { ...savedMonths }; delete newIndex[key];
    setAllSchedules(newAll); setSavedMonths(newIndex);
    if (selectedYear + "-" + selectedMonth === key) setSchedule(null);
    try { localStorage.removeItem("ort-schedule:" + key); localStorage.setItem("ort-schedule-index", JSON.stringify(newIndex)); } catch(e) {}
    if (ghPat) {
      try {
        const { sha, current } = await getSchedFileAndSha(ghPat);
        if (current.months) delete current.months[key];
        await commitSchedFile(current, sha, `Delete schedule: ${savedMonths[key] || key}`, ghPat);
        setToast("✓ Deleted");
      } catch(e) { setToast("⚠ Deleted locally, sync failed"); }
    } else { setToast("✓ Deleted"); }
  };

  const handleScheduleUpdate = (s) => {
    setSchedule(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSchedule(s, selectedYear, selectedMonth), 800);
  };

  if (!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"40vh",color:"#8B949E",fontFamily:"inherit"}}>Loading schedules…</div>;

  return (
    <div style={{fontFamily:"'DM Sans','Poppins',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {toast && <SchedToast message={toast} onDone={() => setToast(null)} />}

      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:"#0f172a",margin:0}}>Schedule</h2>
          <div style={{fontSize:13,color:"#8B949E",marginTop:2}}>Shift planning · {Object.keys(savedMonths).length} saved months</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {schedule && <SchedExportScreenshot schedule={schedule} monthLabel={monthLabel} />}
          {schedule && <SchedExportXLSX schedule={schedule} monthLabel={monthLabel} />}
          <button onClick={()=>setShowCreator(!showCreator)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            + New Month
          </button>
        </div>
      </div>

      {/* Saved months pills */}
      {Object.keys(savedMonths).length > 0 && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {Object.entries(savedMonths).sort(([a],[b])=>a.localeCompare(b)).map(([key, label]) => {
            const active = selectedYear+"-"+selectedMonth === key;
            return (
              <div key={key} style={{display:"flex",alignItems:"center",background:active?"#e0e7ff":"#FFF",border:`1px solid ${active?"#a5b4fc":"#D0D7DE"}`,borderRadius:8,overflow:"hidden"}}>
                <button onClick={()=>handleLoadMonth(key)} style={{padding:"6px 12px",fontSize:12,fontWeight:active?600:400,color:active?"#3730a3":"#57606A",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
                <button onClick={()=>handleDeleteMonth(key)} style={{padding:"4px 8px",background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:14,fontWeight:700,lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Creator panel */}
      {showCreator && (
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:20,marginBottom:20,animation:"fadeIn 0.25s ease"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:16}}>Create New Month</div>
          <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            {[["Month", <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))} style={SS.sel}>{SCHED_MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}</select>],
              ["Year",  <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} style={SS.sel}>{[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}</select>],
              ["Rotation", <select value={pattern} onChange={e=>setPattern(e.target.value)} style={SS.sel}>{Object.keys(ROTATION_PATTERNS).map(p=><option key={p} value={p}>{p}</option>)}</select>]
            ].map(([label, el]) => (
              <div key={label} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
                {el}
              </div>
            ))}
            <button onClick={handleCreate} style={{padding:"8px 20px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Generate {SCHED_MONTHS[selectedMonth]} {selectedYear}</button>
          </div>
          <p style={{fontSize:12,color:"#94a3b8",marginTop:12}}>Pre-filled with the rotation. Click any cell to edit.</p>
        </div>
      )}

      {schedule ? (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
            <h3 style={{fontSize:20,fontWeight:700,color:"#0f172a",letterSpacing:"-0.03em",margin:0}}>{monthLabel}</h3>
            <div style={{display:"flex",gap:14}}>{TEAM.map(m=><div key={m.name} style={{fontSize:12,color:"#475569",fontWeight:500}}>{m.name.split(" ")[0]}</div>)}</div>
          </div>
          <div style={{display:"flex",gap:14,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}><SchedCoverageBar schedule={schedule}/></div>
            <div style={{flex:1,minWidth:200}}><SchedGapWarnings schedule={schedule}/></div>
          </div>
          <SchedOffSummary schedule={schedule}/>
          <SchedHOSummary schedule={schedule}/>
          <SchedGrid schedule={schedule} setSchedule={handleScheduleUpdate}/>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"50vh",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <p style={{color:"#64748b",fontSize:14,marginBottom:16}}>Select a saved schedule or create a new month</p>
          <button onClick={()=>setShowCreator(true)} style={{padding:"9px 20px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Create First Month</button>
        </div>
      )}
    </div>
  );
}

const SS = {
  sel: { padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,fontFamily:"inherit",color:"#1e293b",background:"#fff",minWidth:140,outline:"none" },
  cell: { padding:"7px 6px",textAlign:"center",borderBottom:"1px solid #f8fafc",borderRight:"1px solid #f8fafc",fontSize:"12.5px",transition:"all 0.1s",minWidth:95 },
  emptyCell: { padding:"7px 6px",background:"#fafafa",borderBottom:"1px solid #f8fafc" },
  th: { padding:"8px 6px",textAlign:"center",borderBottom:"1px solid #f1f5f9",verticalAlign:"bottom" },
  nameCell: { padding:"8px 12px",borderBottom:"1px solid #f8fafc",width:140 },
  presetBtn: { display:"flex",alignItems:"center",gap:6,width:"100%",padding:"6px 10px",border:"none",textAlign:"left",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#334155" },
  sectionLbl: { fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94a3b8",padding:"6px 10px 2px" },
  exportBtn: { display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:"#fff",color:"#334155",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit" },
};

function SchedShiftDropdown({ cellRect, currentValue, onSelect, onClose }) {
  const [val, setVal] = useState(currentValue||"");
  const inputRef = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => { if(inputRef.current) inputRef.current.focus(); },[]);
  useEffect(() => {
    if(!cellRect) return;
    const maxH=340, spaceBelow=window.innerHeight-cellRect.bottom-8, spaceAbove=cellRect.top-8;
    const openUp=spaceBelow<maxH&&spaceAbove>spaceBelow;
    const width=Math.max(cellRect.width,190);
    let left=cellRect.left;
    if(left+width>window.innerWidth-8) left=window.innerWidth-width-8;
    if(left<8) left=8;
    setPos(openUp ? {left,width,bottom:window.innerHeight-cellRect.top+4,maxHeight:Math.min(spaceAbove,maxH)} : {left,width,top:cellRect.bottom+4,maxHeight:Math.min(spaceBelow,maxH)});
  },[cellRect]);
  if(!pos) return null;
  return (
    <>
      <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={onClose}/>
      <div style={{position:"fixed",left:pos.left,width:pos.width,...(pos.top!=null?{top:pos.top}:{bottom:pos.bottom}),maxHeight:pos.maxHeight,overflowY:"auto",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 12px 32px rgba(0,0,0,0.16)",zIndex:9999,fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{padding:"8px 8px 4px",position:"sticky",top:0,background:"#fff",zIndex:1}}>
          <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&val.trim())onSelect(val.trim());if(e.key==="Escape")onClose();}}
            placeholder="Type custom or pick below…"
            style={{width:"100%",padding:"6px 8px",border:"2px solid #3b82f6",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc",boxSizing:"border-box"}}/>
        </div>
        <div style={{padding:"2px 0"}}>
          <div style={SS.sectionLbl}>Shift Times</div>
          {SHIFT_TIMES.map(p=><button key={p} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(p)} style={{...SS.presetBtn,background:p===currentValue?"#e0e7ff":"transparent"}}><span style={{fontSize:12}}>🕐</span>{p}</button>)}
        </div>
        <div style={{height:1,background:"#e2e8f0",margin:"4px 0"}}/>
        <div style={{padding:"2px 0"}}>
          <div style={SS.sectionLbl}>Off / Leave</div>
          {OFF_REASONS.map(r=><button key={r.value} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(r.value)} style={{...SS.presetBtn,background:r.value===currentValue?`${r.accent}18`:"transparent",borderLeft:r.value===currentValue?`3px solid ${r.accent}`:"3px solid transparent"}}>{r.label}</button>)}
        </div>
        <div style={{height:4}}/>
      </div>
    </>
  );
}

function SchedCell({ value, date, isEditing, isHO, onStartEdit, onHOToggle }) {
  if(!date) return <td style={SS.emptyCell}/>;
  const {bg,fg,accent}=getShiftStyle(value);
  const isWeekend=value==="Weekend";
  const isOff=isOffDay(value);
  const offInfo=isOff?OFF_REASONS.find(r=>r.value===value):null;
  return (
    <td onClick={e=>{if(!isWeekend)onStartEdit(e.currentTarget.getBoundingClientRect());}}
      style={{...SS.cell,background:bg,color:fg,borderLeft:accent?`3px solid ${accent}`:"none",cursor:isWeekend?"default":"pointer",outline:isEditing?"2px solid #3b82f6":"none",outlineOffset:-1,position:"relative"}}
      title={isWeekend?"Weekend":"Click to edit"}>
      <span style={{fontSize:"12.5px",fontWeight:500}}>{isOff&&offInfo?`${offInfo.label.split(" ")[0]} ${value}`:value}</span>
      {!isWeekend&&!isOff&&(
        <button onClick={e=>{e.stopPropagation();onHOToggle();}} title={isHO?"Remove Home Office":"Mark as Home Office"}
          style={{position:"absolute",bottom:2,right:2,background:"none",border:"none",cursor:"pointer",fontSize:9,padding:"0 1px",opacity:isHO?1:0.2,lineHeight:1,color:isHO?"#0ea5e9":"inherit"}}>🏠</button>
      )}
    </td>
  );
}

function SchedGrid({ schedule, setSchedule }) {
  const [editCell, setEditCell] = useState(null);
  const handleShiftChange=(wi,mi,di,val)=>{const u=[...schedule];u[wi]={...u[wi],shifts:u[wi].shifts.map((ms,i)=>i===mi?ms.map((s,j)=>j===di?val:s):ms)};setSchedule(u);};
  const handleHOToggle=(wi,mi,di)=>{const u=[...schedule];const ho=(u[wi].homeOffice||TEAM.map(()=>Array(7).fill(false))).map((ms,i)=>i===mi?ms.map((v,j)=>j===di?!v:v):ms);u[wi]={...u[wi],homeOffice:ho};setSchedule(u);};
  return (
    <>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {schedule.map((week,wi)=>(
          <div key={wi} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#1e293b",textTransform:"uppercase",letterSpacing:"0.05em"}}>Week {week.weekNum}</span>
              <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>{week.days.filter(Boolean).length>0&&`${sFmtFull(week.days.find(Boolean))} → ${sFmtFull(week.days.filter(Boolean).pop())}`}</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={{...SS.th,width:160}}/>
                  {SCHED_DAYS.map((day,di)=>(
                    <th key={day} style={{...SS.th,opacity:week.days[di]?1:0.3}}>
                      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"#64748b",fontWeight:600}}>{day.slice(0,3)}</div>
                      <div style={{fontSize:15,fontWeight:700,color:week.days[di]?"#0f172a":"#cbd5e1",marginTop:1}}>{week.days[di]?sFmtDate(week.days[di]):"—"}</div>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {TEAM.map((m,mi)=>(
                    <tr key={mi}>
                      <td style={SS.nameCell}><span style={{fontSize:"12.5px",fontWeight:600,color:"#1e293b",whiteSpace:"nowrap"}}>{m.name.split(" ")[0]}</span></td>
                      {week.days.map((date,di)=><SchedCell key={di} value={week.shifts[mi][di]} date={date} isEditing={editCell&&editCell.wi===wi&&editCell.mi===mi&&editCell.di===di} isHO={(week.homeOffice||[])[mi]?.[di]||false} onStartEdit={(rect)=>setEditCell({wi,mi,di,rect})} onHOToggle={()=>handleHOToggle(wi,mi,di)}/>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {editCell&&<SchedShiftDropdown cellRect={editCell.rect} currentValue={schedule[editCell.wi].shifts[editCell.mi][editCell.di]} onSelect={(val)=>{handleShiftChange(editCell.wi,editCell.mi,editCell.di,val);setEditCell(null);}} onClose={()=>setEditCell(null)}/>}
    </>
  );
}

function SchedCoverageBar({ schedule }) {
  const s={early:0,standard:0,late:0,off:0,total:0};
  schedule.forEach(w=>w.shifts.forEach(ms=>ms.forEach(v=>{if(!v||v==="Weekend")return;s.total++;if(isOffDay(v))s.off++;else if(v.includes("08:00"))s.early++;else if(v.includes("13:30")||v.includes("22:00"))s.late++;else s.standard++;})));
  if(!s.total) return null;
  const p=k=>((s[k]/s.total)*100).toFixed(0);
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94a3b8",fontWeight:700,marginBottom:10}}>Shift Distribution</div>
      <div style={{display:"flex",height:10,borderRadius:6,overflow:"hidden",background:"#f1f5f9"}}>
        <div style={{height:"100%",width:`${p("early")}%`,background:"#38bdf8",borderRadius:"6px 0 0 6px"}}/>
        <div style={{height:"100%",width:`${p("standard")}%`,background:"#0ea5e9"}}/>
        <div style={{height:"100%",width:`${p("late")}%`,background:"#7c3aed"}}/>
        <div style={{height:"100%",width:`${p("off")}%`,background:"#f97316",borderRadius:"0 6px 6px 0"}}/>
      </div>
      <div style={{display:"flex",gap:14,marginTop:8,fontSize:11,color:"#64748b"}}>
        {[["early","#38bdf8"],["standard","#0ea5e9"],["late","#7c3aed"],["off","#f97316"]].map(([k,c])=><span key={k}><span style={{width:6,height:6,borderRadius:"50%",display:"inline-block",marginRight:4,background:c}}/>{k.charAt(0).toUpperCase()+k.slice(1)} {p(k)}%</span>)}
      </div>
    </div>
  );
}

function SchedOffSummary({ schedule }) {
  const offDays={};TEAM.forEach(m=>{offDays[m.name]={};});
  schedule.forEach(week=>{TEAM.forEach((m,mi)=>{week.shifts[mi].forEach((s,di)=>{if(isOffDay(s)&&week.days[di]){if(!offDays[m.name][s])offDays[m.name][s]=0;offDays[m.name][s]++;}});});});
  if(!TEAM.some(m=>Object.keys(offDays[m.name]).length>0)) return null;
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14,marginBottom:16}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94a3b8",fontWeight:700,marginBottom:10}}>Off / Leave Summary</div>
      {TEAM.map(m=>{
        const days=offDays[m.name];if(!Object.keys(days).length)return null;
        return <div key={m.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:12,fontWeight:600,color:"#1e293b",minWidth:80}}>{m.name.split(" ")[0]}</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(days).map(([reason,count])=>{const info=OFF_REASONS.find(r=>r.value===reason);return<span key={reason} style={{fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:500,background:info?info.bg:"#f1f5f9",color:info?info.fg:"#64748b",border:`1px solid ${info?info.border:"#e2e8f0"}`}}>{info?info.label.split(" ")[0]:""} {reason}: {count}d</span>;})}
          </div>
        </div>;
      })}
    </div>
  );
}

function SchedHOSummary({ schedule }) {
  const hoByMember = {};
  TEAM.forEach(m => { hoByMember[m.name] = []; });
  schedule.forEach(week => {
    TEAM.forEach((m, mi) => {
      week.days.forEach((date, di) => {
        if (date && (week.homeOffice || [])[mi]?.[di]) hoByMember[m.name].push(date);
      });
    });
  });
  if (!TEAM.some(m => hoByMember[m.name].length > 0)) return null;
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14,marginBottom:16}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94a3b8",fontWeight:700,marginBottom:10}}>Home Office Dates</div>
      {TEAM.map(m => {
        const dates = hoByMember[m.name];
        return (
          <div key={m.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,color:"#1e293b",minWidth:80}}>{m.name.split(" ")[0]}</span>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {dates.length > 0
                ? dates.map((d,i) => (
                    <span key={i} style={{fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:500,background:"#e0f2fe",color:"#075985",border:"1px solid #bae6fd"}}>
                      {d.getDate()}/{d.getMonth()+1}
                    </span>
                  ))
                : <span style={{fontSize:11,color:"#cbd5e1"}}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SchedGapWarnings({ schedule }) {
  const warnings=[];
  schedule.forEach(week=>week.days.forEach((date,di)=>{
    if(!date||di>=5)return;
    const active=week.shifts.map(ms=>ms[di]).filter(s=>s&&s!=="Weekend"&&!isOffDay(s));
    if(!active.length)warnings.push({date,type:"No coverage",sev:"high"});
    else if(active.length<3)warnings.push({date,type:`Only ${active.length} staff`,sev:"medium"});
    if(active.length&&!active.some(s=>s.includes("13:30")||s.includes("22:00")))warnings.push({date,type:"No late coverage",sev:"low"});
  }));
  if(!warnings.length) return <div style={{background:"#ecfdf5",border:"1px solid #6ee7b7",borderRadius:10,padding:14}}><span style={{color:"#065f46",fontSize:13}}>✓ Full coverage — no gaps</span></div>;
  const colors={high:["#fef2f2","#fca5a5"],medium:["#fffbeb","#fcd34d"],low:["#f0f9ff","#93c5fd"]};
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14}}>
      <div style={{fontSize:10,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Alerts</div>
      {warnings.slice(0,5).map((w,i)=><div key={i} style={{padding:"8px 10px",borderRadius:6,border:"1px solid",marginBottom:4,background:colors[w.sev][0],borderColor:colors[w.sev][1]}}><span style={{fontSize:12,color:"#475569"}}><strong>{sFmtFull(w.date)}</strong> — {w.type}</span></div>)}
      {warnings.length>5&&<span style={{fontSize:11,color:"#94a3b8"}}>+{warnings.length-5} more</span>}
    </div>
  );
}

function SchedExportScreenshot({ schedule, monthLabel }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const handleCapture = () => {
    try {
      const scale=2,colW=105,nameW=150,rowH=26,weekHdrH=30,pad=24;
      const width=nameW+7*colW+pad*2;
      const weekBlockH=weekHdrH+TEAM.length*rowH+8;
      const height=70+schedule.length*(weekBlockH+14)+20;
      const c=document.createElement("canvas");c.width=width*scale;c.height=height*scale;
      const ctx=c.getContext("2d");ctx.scale(scale,scale);
      ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,width,height);
      ctx.fillStyle="#0f172a";ctx.font="bold 20px sans-serif";ctx.fillText(monthLabel,pad,32);
      let lx=pad;ctx.font="500 11px sans-serif";
      TEAM.forEach(m=>{const tw=ctx.measureText(m.name.split(" ")[0]).width;ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(lx+5,50,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#475569";ctx.fillText(m.name.split(" ")[0],lx+14,54);lx+=tw+30;});
      let y=70;
      schedule.forEach(week=>{
        const blockH=weekHdrH+TEAM.length*rowH;
        ctx.fillStyle="#fff";ctx.fillRect(pad,y,width-pad*2,blockH);ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;ctx.strokeRect(pad,y,width-pad*2,blockH);
        ctx.fillStyle="#f8fafc";ctx.fillRect(pad+1,y+1,width-pad*2-2,weekHdrH-1);
        ctx.fillStyle="#1e293b";ctx.font="bold 10px sans-serif";ctx.textAlign="left";ctx.fillText("WEEK "+week.weekNum,pad+10,y+18);
        SCHED_DAYS.forEach((day,di)=>{const x=pad+nameW+di*colW;ctx.fillStyle=week.days[di]?"#64748b":"#cbd5e1";ctx.font="600 9px sans-serif";ctx.textAlign="center";ctx.fillText(day.slice(0,3).toUpperCase(),x+colW/2,y+12);if(week.days[di]){ctx.fillStyle="#0f172a";ctx.font="bold 13px sans-serif";ctx.fillText(String(week.days[di].getDate()),x+colW/2,y+26);}});
        const ry0=y+weekHdrH;
        TEAM.forEach((member,mi)=>{const ry=ry0+mi*rowH;ctx.fillStyle="#1e293b";ctx.font="600 11px sans-serif";ctx.textAlign="left";ctx.fillText(member.name.split(" ")[0],pad+10,ry+rowH/2+4);
          week.shifts[mi].forEach((shift,di)=>{if(!shift&&!week.days[di])return;const x=pad+nameW+di*colW;const st=getShiftStyle(shift);ctx.fillStyle=st.bg;ctx.fillRect(x+1,ry+2,colW-2,rowH-4);if(st.accent){ctx.fillStyle=st.accent;ctx.fillRect(x+1,ry+2,3,rowH-4);}ctx.fillStyle=st.fg;ctx.font="500 10.5px sans-serif";ctx.textAlign="center";ctx.fillText(shift||"",x+colW/2,ry+rowH/2+4);});
        });
        y+=blockH+14;
      });
      ctx.textAlign="left";ctx.fillStyle="#94a3b8";ctx.font="400 10px sans-serif";ctx.fillText("Trading 212 · Online Reputation Team",pad,y);
      setPreviewUrl(c.toDataURL("image/png"));
    } catch(e){console.error("Screenshot failed:",e);}
  };
  return (
    <>
      <button onClick={handleCapture} style={SS.exportBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Screenshot</button>
      {previewUrl&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setPreviewUrl(null)}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,maxWidth:"92vw",maxHeight:"92vh",overflow:"auto",padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Right-click → Save As</span><button onClick={()=>setPreviewUrl(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#94a3b8"}}>×</button></div><img src={previewUrl} alt={"Schedule "+monthLabel} style={{width:"100%",borderRadius:8,border:"1px solid #e2e8f0"}}/></div></div>}
    </>
  );
}

function loadSheetJS(){return new Promise((resolve,reject)=>{if(window.XLSX)return resolve(window.XLSX);const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error("Failed to load SheetJS"));document.head.appendChild(s);});}

function SchedExportXLSX({ schedule, monthLabel }) {
  const [status, setStatus] = useState(null);
  const handleExport = async () => {
    setStatus("working");
    try {
      const XLSX=await loadSheetJS();
      const rows=[["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",""]];
      schedule.forEach(week=>{rows.push(["Week "+week.weekNum,...week.days.map(d=>d?d:""),""]); TEAM.forEach((m,mi)=>rows.push([m.name,...week.shifts[mi].map(s=>s||""),""]));});
      const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:22},...Array(7).fill({wch:16}),{wch:5}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,monthLabel.slice(0,31));
      XLSX.writeFile(wb,"ORT_Schedule_"+monthLabel.replace(/\s/g,"_")+".xlsx");
      setStatus("done");setTimeout(()=>setStatus(null),2000);
    } catch(e){setStatus("error");setTimeout(()=>setStatus(null),3000);}
  };
  return <button onClick={handleExport} disabled={status==="working"} style={{...SS.exportBtn,background:status==="done"?"#ecfdf5":status==="error"?"#fef2f2":"#fff"}}>{status==="done"?"✓ Exported":status==="error"?"✗ Failed":status==="working"?"Exporting…":<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export .xlsx</>}</button>;
}

function SchedToast({ message, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,2200);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:10000,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",fontFamily:"'DM Sans',sans-serif"}}>{message}</div>;
}

// ═══════════════════════════════════════════════
//  ANALYTICS — HELPERS + SECTION
// ═══════════════════════════════════════════════
function StarRating({ stars, size=12 }) {
  const full = Math.round(stars);
  return (
    <span style={{color:"#F59E0B",fontSize:size,letterSpacing:1,lineHeight:1}}>
      {"★".repeat(full)}{"☆".repeat(5-full)}
    </span>
  );
}

function BarChart({ data, valueKey="n", color="#00B67A", height=96 }) {
  const max = Math.max(...data.map(d=>d[valueKey]), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height,width:"100%"}}>
      {data.map((d,i) => {
        const pct = (d[valueKey]/max)*100;
        return (
          <div key={i} style={{flex:1,height:"100%",display:"flex",alignItems:"flex-end"}}>
            <div
              title={`${d.label||`${d.h}:00`} · ${d[valueKey]} review${d[valueKey]!==1?"s":""}`}
              style={{width:"100%",background:d[valueKey]>0?color:"#F3F4F6",borderRadius:"2px 2px 0 0",
                height:`${Math.max(pct, d[valueKey]>0?3:0)}%`,transition:"height 0.3s",cursor:"default"}}
            />
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  RESOURCES SECTION
// ═══════════════════════════════════════════════
function ResourcesSection() {
  const [socialsOpen, setSocialsOpen] = useState(true);

  const favicon = domain => `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;

  const quickLinks = [
    { label:"Gmail",        url:"https://mail.google.com",                                                emoji:"✉️" },
    { label:"hiBob",        url:"https://app.hibob.com/home",                                             emoji:"👤" },
    { label:"Backoffice",   url:"https://backoffice.live.trading212.avus.io/customercare",                 emoji:"🏢" },
    { label:"Help Centre",  url:"https://helpcentre.trading212.com/hc/en-us",                             domain:"trading212.com" },
    { label:"T212 Learn",   url:"https://www.trading212.com/learn",                                       domain:"trading212.com" },
    { label:"ChatGPT",      url:"https://chatgpt.com",                                                    emoji:"🤖" },
    { label:"Claude",       url:"https://claude.ai",                                                      emoji:"✨" },
    { label:"Gemini",       url:"https://gemini.google.com",                                              domain:"google.com" },
    { label:"Perplexity",   url:"https://www.perplexity.ai/",                                             domain:"perplexity.ai" },
    { label:"Exchanges",    url:"https://www.interactivebrokers.ie/en/trading/products-exchanges.php#/",  domain:"interactivebrokers.ie" },
  ];

  const tools = [
    { label:"Falcon",                      url:"https://app.falcon.io/#/engage/overview",                              domain:"falcon.io" },
    { label:"Amplitude",                   url:"https://app.amplitude.com/analytics/trading212/home",                  domain:"amplitude.com" },
    { label:"Social Moderation",            url:"https://app.amplitude.com/analytics/trading212/dashboard/50xw74vq",    domain:"amplitude.com" },
    { label:"Marqeta",                     url:"https://app.marqeta.com",                                               domain:"marqeta.com" },
    { label:"Zendesk",                     url:"https://trading2129704.zendesk.com/agent/search/1",                     domain:"zendesk.com" },
  ];

  const sheets = [
    { label:"Stats",            url:"https://docs.google.com/spreadsheets/d/1giEdcUX2sphS1P8ieJB5E0o7I0pkW5sa2bxo3wQFsbM/edit?gid=1837238448#gid=1837238448", domain:"docs.google.com" },
    { label:"Post Sizing",      url:"https://docs.google.com/spreadsheets/d/1HNRtj5IfU_gV3ALgUvz2rJ-7_E5jsQfqwvbdDxAsCQc/edit",                                 domain:"docs.google.com" },
    { label:"Social Bans",      url:"https://docs.google.com/spreadsheets/d/1OaKDt7AmqXzabcp02hFHTLZfQiOlBjjfBOjtatuXH4Y/edit?gid=1697261709#gid=1697261709",   domain:"docs.google.com" },
  ];

  const jira = [
    { label:"Online Rep Board",      url:"https://trading212.atlassian.net/jira/software/c/projects/OR/boards/271",          domain:"atlassian.net" },
    { label:"Fin Promotions Board",  url:"https://trading212.atlassian.net/jira/software/c/projects/FP/boards/216",          domain:"atlassian.net" },
    { label:"Confluence Wiki",       url:"https://trading212.atlassian.net/wiki/spaces/GCRR/overview?homepageId=11239712",   domain:"atlassian.net" },
    { label:"Creative Design Form",  url:"https://trading212.atlassian.net/jira/software/c/projects/CREATE/form/142",        domain:"atlassian.net" },
  ];

  const socials = [
    { label:"Trustpilot",          url:"https://businessapp.b2b.trustpilot.com/reviews",                                                                                                           domain:"trustpilot.com" },
    { label:"X / Twitter",         url:"https://twitter.com/home",                                                                                                                                 domain:"twitter.com" },
    { label:"Instagram",           url:"https://www.instagram.com/",                                                                                                                               domain:"instagram.com" },
    { label:"Meta Business Suite", url:"https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=874174999312139&mio=0&asset_id=440091156053861",                            domain:"facebook.com" },
    { label:"LinkedIn",            url:"https://www.linkedin.com/feed/",                                                                                                                           domain:"linkedin.com" },
    { label:"YouTube",             url:"https://www.youtube.com/",                                                                                                                                 domain:"youtube.com" },
    { label:"Reddit",              url:"https://www.reddit.com/r/trading212/new/",                                                                                                                 domain:"reddit.com" },
    { label:"Google Maps",         url:"https://www.google.com/maps",                                                                                                                              domain:"google.com" },
    { label:"Glassdoor",           url:"https://www.glassdoor.com/Overview/Working-at-Trading-212-EI_IE1671489.11,22.htm",                                                                         domain:"glassdoor.com" },
    { label:"App Store Connect",   url:"https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/ng/app/566325832/ios/ratingsResponses",                                                   domain:"apple.com" },
    { label:"Google Play Console", url:"https://play.google.com/console/u/0/developers/5000184188293498537/app/4974459231864602677/user-feedback/reviews",                                          domain:"google.com" },
    { label:"Community Forum",     url:"https://community.trading212.com/",                                                                                                                         domain:"trading212.com" },
  ];

  const sectionLabel = (text) => (
    <div style={{fontSize:11,fontWeight:700,color:"#8B949E",textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,marginTop:4}}>{text}</div>
  );

  const linkCard = ({ label, url, domain, emoji }) => (
    <a key={label} href={url} target="_blank" rel="noopener noreferrer"
      style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px",height:44,background:"#FFF",border:"1px solid #E1E4E8",borderRadius:10,textDecoration:"none",color:"#1F2328",transition:"border-color 0.15s",cursor:"pointer",overflow:"hidden"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="#0969DA"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="#E1E4E8"}>
      {domain
        ? <img src={favicon(domain)} alt="" width={18} height={18} style={{borderRadius:3,flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
        : <span style={{fontSize:16,lineHeight:1,flexShrink:0}}>{emoji}</span>
      }
      <span style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
      <span style={{marginLeft:"auto",fontSize:11,color:"#C0C0C0",flexShrink:0}}>↗</span>
    </a>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:"#1F2328",margin:0}}>Resources</h2>
          <div style={{fontSize:13,color:"#8B949E",marginTop:2}}>Quick access to tools, dashboards and channels</div>
        </div>
      </div>

      {/* Quick Access */}
      {sectionLabel("Quick Access")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8,marginBottom:20}}>
        {quickLinks.map(l => linkCard(l))}
      </div>

      {/* Tools */}
      {sectionLabel("Tools")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8,marginBottom:20}}>
        {tools.map(l => linkCard(l))}
      </div>

      {/* Sheets */}
      {sectionLabel("Sheets")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8,marginBottom:20}}>
        {sheets.map(l => linkCard(l))}
      </div>

      {/* Jira & Confluence */}
      {sectionLabel("Jira & Confluence")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8,marginBottom:20}}>
        {jira.map(l => linkCard(l))}
      </div>

      {/* Socials — collapsible */}
      <div style={{background:"#FFF",border:"1px solid #E1E4E8",borderRadius:12,overflow:"hidden",marginBottom:8}}>
        <button onClick={()=>setSocialsOpen(o=>!o)}
          style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#8B949E",textTransform:"uppercase",letterSpacing:0.8}}>Socials & Platforms</span>
          <span style={{fontSize:12,color:"#8B949E",transition:"transform 0.2s",display:"inline-block",transform:socialsOpen?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
        </button>
        {socialsOpen && (
          <div style={{padding:"0 12px 12px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
            {socials.map(l => linkCard(l))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsSection({ tpKey }) {
  const [liveStats,   setLiveStats]   = useState(null);
  const [liveReviews, setLiveReviews] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [platform,    setPlatform]    = useState("trustpilot");
  const [range,       setRange]       = useState("24h");
  const [snaps,       setSnaps]       = useState(() => loadAnalyticsSnaps());
  const [storeData,    setStoreData]    = useState(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError,   setStoreError]   = useState(null);
  const [reviewLimit,  setReviewLimit]  = useState(10);
  const [reviewPeriod, setReviewPeriod] = useState("all");

  const fetchStores = useCallback(async () => {
    setStoreLoading(true); setStoreError(null);
    try {
      const res = await fetch(`${STORES_URL}?_=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStoreData(await res.json());
    } catch(e) { setStoreError(e.message); }
    finally { setStoreLoading(false); }
  }, []);

  const doFetch = useCallback(async () => {
    if (!tpKey) return;
    setLoading(true); setFetchError(null);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${TP_API}?apikey=${tpKey}`),
        fetch(`${TP_API}/reviews?apikey=${tpKey}&perPage=100&orderBy=createdat.desc`),
      ]);
      if (!sRes.ok) throw new Error(sRes.status===401 ? "Invalid Trustpilot key — check 🔑 settings." : `Trustpilot API error (${sRes.status})`);
      const [s, r] = await Promise.all([sRes.json(), rRes.json()]);
      setLiveStats(s);
      setLiveReviews(r.reviews || []);
      setLastUpdated(new Date());
      saveAnalyticsSnap({ ts:new Date().toISOString(), score:s.score?.trustScore, total:s.numberOfReviews?.total });
      setSnaps(loadAnalyticsSnaps());
    } catch(e) { setFetchError(e.message); }
    finally { setLoading(false); }
  }, [tpKey]);

  useEffect(() => { doFetch(); }, [doFetch]);
  useEffect(() => {
    if (platform === "appstore" || platform === "play") fetchStores();
    setReviewLimit(10);
    setReviewPeriod("all");
  }, [platform, fetchStores]);

  // ── derive display data ──────────────────────────────────
  const isLive = !!liveStats;
  const reviews = isLive ? liveReviews : [];

  const stats = isLive ? {
    trustScore:    liveStats.score?.trustScore ?? "—",
    total:         liveStats.numberOfReviews?.total ?? 0,
    today:         buildHourlyData(reviews).reduce((s,h)=>s+h.n, 0),
    weekCount:     reviews.filter(r=>new Date(r.createdAt)>new Date(Date.now()-7*24*3600*1000)).length,
    weekAvgRating: (() => { const w=reviews.filter(r=>new Date(r.createdAt)>new Date(Date.now()-7*24*3600*1000)); return w.length?w.reduce((s,r)=>s+r.stars,0)/w.length:0; })(),
    prevWeekAvgRating: (() => { const s=new Date(Date.now()-14*24*3600*1000),e=new Date(Date.now()-7*24*3600*1000); const w=reviews.filter(r=>{const d=new Date(r.createdAt);return d>s&&d<e;}); return w.length?w.reduce((a,r)=>a+r.stars,0)/w.length:0; })(),
    dist: { 5:liveStats.numberOfReviews?.fiveStars||0, 4:liveStats.numberOfReviews?.fourStars||0, 3:liveStats.numberOfReviews?.threeStars||0, 2:liveStats.numberOfReviews?.twoStars||0, 1:liveStats.numberOfReviews?.oneStar||0 },
  } : MOCK_TP_STATS;

  const spike      = isLive ? detectSpike(reviews) : MOCK_SPIKE;
  const hourly24h  = isLive ? buildHourlyData(reviews) : MOCK_TP_24H.map(d=>({...d,label:`${d.h}:00`}));
  const daily7d    = isLive ? buildDailyFromSnaps(snaps,7)  : MOCK_TP_7D;
  const daily30d   = isLive ? buildDailyFromSnaps(snaps,30) : MOCK_TP_30D;
  const chartData  = range==="24h" ? hourly24h : range==="7d" ? daily7d : daily30d;
  const total5     = Object.values(stats.dist).reduce((a,b)=>a+(b||0),0);

  const filterByPeriod = (revs, period) => {
    if (period === "all") return revs;
    const cutoff = period === "today"
      ? new Date(new Date().setHours(0,0,0,0)).getTime()
      : Date.now() - ({  "7d":7, "30d":30, "60d":60 }[period] || 0) * 24 * 3600 * 1000;
    return revs.filter(r => new Date(r.createdAt).getTime() >= cutoff);
  };

  const tpFiltered = isLive ? filterByPeriod(reviews, reviewPeriod) : [];
  const displayReviews = isLive
    ? tpFiltered.slice(0, reviewLimit).map(r=>({ id:r.id, stars:r.stars,
        author: r.consumer?.displayName||"Anonymous",
        title:  r.title, text:r.text,
        time:   new Date(r.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
        replied:!!r.companyReply }))
    : MOCK_TP_REVIEWS;

  const ratingDelta   = (stats.weekAvgRating||0) - (stats.prevWeekAvgRating||0);
  const ratingTrendUp = ratingDelta >= 0;
  const fmtUpdated    = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})
    : loading ? "Fetching…" : "—";

  const storeSyncTime = storeData ? (() => {
    const key = platform === "play" ? "googlePlay" : "appStore";
    const ts  = storeData[key]?.updatedAt;
    return ts ? new Date(ts).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "—";
  })() : null;

  const starColors    = {5:"#22C55E",4:"#84CC16",3:"#EAB308",2:"#F97316",1:"#EF4444"};
  const platforms     = [
    { id:"trustpilot", label:"⭐ Trustpilot" },
    { id:"appstore",   label:"🍎 App Store" },
    { id:"play",       label:"▶ Google Play" },
  ];

  // ── spike banner helpers ─────────────────────────────────
  const spikeIsHigh = spike?.level==="high";
  const spikeMsg = spike ? (
    spike.type==="sentiment"
      ? `Average rating dropped to ${spike.recentAvg}★ in the last hour vs ${spike.baselineAvg}★ baseline`
      : `${spike.ratio}× more reviews than usual this hour (${spike.count} vs ~${spike.baseline} avg)`
  ) : null;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:"#1F2328",margin:0}}>Analytics</h2>
          <div style={{fontSize:13,color:"#8B949E",marginTop:2,display:"flex",alignItems:"center",gap:6}}>
            <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",
              background:(platform==="trustpilot"?(loading?"#F59E0B":isLive?"#22C55E":"#F59E0B"):(storeLoading?"#F59E0B":storeData?"#22C55E":"#F59E0B")),flexShrink:0}}/>
            {platform==="trustpilot"
              ? (!tpKey ? "Add Trustpilot key in 🔑 to go live — showing mock data"
                  : loading ? "Fetching live data…"
                  : fetchError ? "Showing mock data (fetch failed)"
                  : `Live · updated at ${fmtUpdated}`)
              : storeLoading ? "Fetching from GitHub…"
              : storeError ? `Error: ${storeError}`
              : storeData ? `Synced by Apps Script · every 15 min · Last sync ${storeSyncTime}`
              : "Click Refresh to load"}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {(tpKey || platform !== "trustpilot") && (
            <button onClick={platform==="trustpilot"?doFetch:fetchStores} disabled={loading||storeLoading}
              style={{background:"#FFF",border:"1px solid #D0D7DE",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:500,cursor:(loading||storeLoading)?"default":"pointer",fontFamily:"inherit",color:"#57606A",display:"flex",alignItems:"center",gap:5,opacity:(loading||storeLoading)?0.6:1}}>
              <span style={{fontSize:13,display:"inline-block",animation:(loading||storeLoading)?"spin 1s linear infinite":"none"}}>🔄</span>
              {(loading||storeLoading)?"Refreshing…":"Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#DC2626"}}>⚠️ {fetchError}</div>}

      {/* Platform tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {platforms.map(p => (
          <button key={p.id} onClick={()=>!p.soon&&setPlatform(p.id)} style={{
            padding:"7px 16px",fontSize:13,fontWeight:500,borderRadius:8,
            cursor:p.soon?"default":"pointer",fontFamily:"inherit",
            border:`1px solid ${platform===p.id&&!p.soon?"#00B67A":"#D0D7DE"}`,
            background:platform===p.id&&!p.soon?"#F0FDF9":"#FFF",
            color:p.soon?"#C0C0C0":platform===p.id?"#059669":"#57606A",
            display:"flex",alignItems:"center",gap:6,
          }}>
            {p.label}
            {p.soon && <span style={{fontSize:9,background:"#F3F4F6",color:"#9CA3AF",padding:"1px 5px",borderRadius:3,fontWeight:600}}>SOON</span>}
          </button>
        ))}
      </div>

      {/* ── Trustpilot content ── */}
      {platform === "trustpilot" && (<>

        {/* Spike / sentiment alert */}
        {spike && (
          <div style={{background:spikeIsHigh?"#FEF2F2":"#FFFBEB",border:`1px solid ${spikeIsHigh?"#FECACA":"#FDE68A"}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20,flexShrink:0}}>{spikeIsHigh?"🔴":"🟡"}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:spikeIsHigh?"#991B1B":"#92400E"}}>
                {spike.type==="sentiment" ? "Sentiment drop detected" : spikeIsHigh ? "Volume spike" : "Elevated volume"}
              </div>
              <div style={{fontSize:12,color:spikeIsHigh?"#DC2626":"#B45309",marginTop:1}}>{spikeMsg}</div>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:16}}>
          {[
            { label:"TrustScore",    value:stats.trustScore,                                   sub:"out of 5.0" },
            { label:"Total reviews", value:(stats.total||0).toLocaleString(),                   sub:"all time" },
            { label:"Today",         value:stats.today,                                         sub:"reviews so far" },
            { label:"7-day avg ★",   value:stats.weekAvgRating?(stats.weekAvgRating.toFixed(2)+"★"):"—",
              sub: stats.weekAvgRating ? `${ratingTrendUp?"↑":"↓"} ${Math.abs(ratingDelta).toFixed(2)} vs prev week` : `${stats.weekCount||0} reviews this week`,
              subColor: stats.weekAvgRating ? (ratingTrendUp?"#22C55E":"#EF4444") : undefined },
          ].map(card => (
            <div key={card.label} style={{background:"#FFF",borderRadius:12,padding:"16px 18px",border:"1px solid #E1E4E8"}}>
              <div style={{fontSize:10,fontWeight:600,color:"#8B949E",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>{card.label}</div>
              <div style={{fontSize:26,fontWeight:700,color:"#1F2328",lineHeight:1}}>{card.value}</div>
              <div style={{fontSize:12,color:card.subColor||"#8B949E",marginTop:5}}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:12}}>
          <div style={{background:"#FFF",borderRadius:12,padding:"18px 20px",border:"1px solid #E1E4E8"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"#1F2328"}}>Review volume</div>
              <div style={{display:"flex",gap:3}}>
                {["24h","7d","30d"].map(r => (
                  <button key={r} onClick={()=>setRange(r)} style={{padding:"3px 10px",fontSize:11,fontWeight:500,borderRadius:6,cursor:"pointer",fontFamily:"inherit",border:"1px solid",borderColor:range===r?"#00B67A":"#D0D7DE",background:range===r?"#F0FDF9":"#FFF",color:range===r?"#059669":"#57606A"}}>{r}</button>
                ))}
              </div>
            </div>
            <BarChart data={chartData} color="#00B67A" height={96}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:"#C0C0C0"}}>
              <span>{chartData[0]?.label}</span>
              <span>{chartData[Math.floor(chartData.length/2)]?.label}</span>
              <span>{chartData[chartData.length-1]?.label}</span>
            </div>
            {isLive && range!=="24h" && snaps.length<2 && (
              <div style={{fontSize:11,color:"#8B949E",marginTop:8,textAlign:"center"}}>📈 7d/30d charts fill in over time as the app collects daily snapshots</div>
            )}
          </div>

          <div style={{background:"#FFF",borderRadius:12,padding:"18px 20px",border:"1px solid #E1E4E8"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#1F2328",marginBottom:14}}>Star distribution</div>
            {[5,4,3,2,1].map(s => {
              const pct = total5>0 ? (stats.dist[s]/total5)*100 : 0;
              return (
                <div key={s} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                  <span style={{fontSize:11,color:"#57606A",width:16,textAlign:"right",flexShrink:0}}>{s}★</span>
                  <div style={{flex:1,background:"#F3F4F6",borderRadius:4,height:8,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,background:starColors[s],height:"100%",borderRadius:4,transition:"width 0.4s"}}/>
                  </div>
                  <span style={{fontSize:10,color:"#8B949E",width:34,textAlign:"right",flexShrink:0}}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #F3F4F6",fontSize:12,color:"#8B949E",textAlign:"center"}}>{total5.toLocaleString()} total</div>
          </div>
        </div>

        {/* Recent reviews */}
        {(() => {
          const maxLimit = 50;
          const filteredTotal = isLive ? tpFiltered.length : MOCK_TP_REVIEWS.length;
          const canMore = isLive && reviewLimit < Math.min(filteredTotal, maxLimit);
          return (
            <div style={{background:"#FFF",borderRadius:12,border:"1px solid #E1E4E8",overflow:"hidden"}}>
              <div style={{padding:"13px 20px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1F2328"}}>Recent reviews{isLive?"":" · mock data"}</div>
                <div style={{display:"flex",gap:3}}>
                  {["all","today","7d","30d","60d"].map(p=>(
                    <button key={p} onClick={()=>{setReviewPeriod(p);setReviewLimit(10);}}
                      style={{padding:"3px 9px",fontSize:11,fontWeight:500,borderRadius:6,cursor:"pointer",fontFamily:"inherit",border:"1px solid",borderColor:reviewPeriod===p?"#00B67A":"#D0D7DE",background:reviewPeriod===p?"#F0FDF9":"#FFF",color:reviewPeriod===p?"#059669":"#57606A"}}>
                      {p==="all"?"All":p}
                    </button>
                  ))}
                </div>
              </div>
              {loading && !liveReviews && (
                <div style={{padding:"32px",textAlign:"center",color:"#8B949E",fontSize:13}}>Loading reviews…</div>
              )}
              {displayReviews.map((r,i) => (
                <div key={r.id} style={{padding:"12px 20px",borderBottom:"1px solid #F8F8F8",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{flexShrink:0,paddingTop:2}}><StarRating stars={r.stars} size={11}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#1F2328"}}>{r.author}</span>
                      <span style={{fontSize:11,color:"#8B949E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</span>
                      {r.replied && <span style={{fontSize:9,background:"#DBEAFE",color:"#1D4ED8",padding:"1px 5px",borderRadius:3,fontWeight:600,flexShrink:0}}>REPLIED</span>}
                      {!r.replied && r.stars<=2 && <span style={{fontSize:9,background:"#FEE2E2",color:"#991B1B",padding:"1px 5px",borderRadius:3,fontWeight:600,flexShrink:0}}>NEEDS REPLY</span>}
                    </div>
                    <div style={{fontSize:12,color:"#57606A",lineHeight:1.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.text}</div>
                  </div>
                  <div style={{fontSize:11,color:"#C0C0C0",flexShrink:0,paddingTop:2}}>{r.time}</div>
                </div>
              ))}
              {canMore && (
                <div style={{padding:"12px 20px",borderTop:"1px solid #F3F4F6",textAlign:"center"}}>
                  <button onClick={()=>setReviewLimit(l=>Math.min(l+10,maxLimit))}
                    style={{background:"#F6F8FA",border:"1px solid #D0D7DE",borderRadius:8,padding:"7px 20px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",color:"#57606A"}}>
                    See 10 more · showing {reviewLimit} of {Math.min(filteredTotal,maxLimit)}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </>)}

      {/* ── App Store / Google Play content ── */}
      {(platform === "appstore" || platform === "play") && (() => {
        const isPlay = platform === "play";
        const key = isPlay ? "googlePlay" : "appStore";
        const pd = storeData?.[key];
        const allRevs = pd?.recentReviews || [];
        const maxLimit = 50;

        if (storeLoading) return (
          <div style={{padding:"56px",textAlign:"center",color:"#8B949E",fontSize:13}}>
            <div style={{fontSize:28,marginBottom:12}}>⏳</div>
            Loading {isPlay?"Google Play":"App Store"} data…
          </div>
        );
        if (storeError) return (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 16px",fontSize:13,color:"#DC2626"}}>⚠️ {storeError}</div>
        );
        if (!storeData) return (
          <div style={{padding:"56px",textAlign:"center",color:"#8B949E",fontSize:13}}>
            <div style={{fontSize:28,marginBottom:12}}>📡</div>
            Click Refresh to load data from GitHub.
          </div>
        );

        // ── unified + extra KPI data ──────────────────────
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayCount = allRevs.filter(r => new Date(r.createdAt) >= todayStart).length;
        const w7 = allRevs.filter(r => new Date(r.createdAt) > new Date(Date.now()-7*24*3600*1000));
        const w7avg = w7.length ? w7.reduce((s,r)=>s+r.stars,0)/w7.length : null;
        const needsReply = allRevs.filter(r => !r.replied && r.stars <= 2).length;

        const unifiedKpis = isPlay
          ? [
              { label:"Avg Rating",     value: pd.stats?.avgRating ? `${parseFloat(pd.stats.avgRating).toFixed(2)}★` : "—", sub:"recent reviews" },
              { label:"Recent Reviews", value: pd.stats?.fetchedCount ?? "—", sub:"fetched this cycle" },
              { label:"Today",          value: todayCount, sub:"reviews so far" },
              { label:"7-day avg ★",    value: w7avg ? `${w7avg.toFixed(2)}★` : "—",
                sub: w7.length ? `${w7.length} reviews this week` : "no data yet" },
            ]
          : [
              { label:"Overall Rating", value: pd.stats?.rating ? `${pd.stats.rating.toFixed(2)}★` : "—", sub:"App Store score" },
              { label:"Total Ratings",  value: pd.stats?.ratingCount ? pd.stats.ratingCount.toLocaleString() : "—", sub:"all time" },
              { label:"Today",          value: todayCount, sub:"reviews so far" },
              { label:"7-day avg ★",    value: w7avg ? `${w7avg.toFixed(2)}★` : "—",
                sub: w7.length ? `${w7.length} reviews this week` : "no data yet" },
            ];

        const extraKpis = isPlay
          ? [{ label:"Needs Reply", value: needsReply, sub:"≤2★ unanswered" }]
          : [{ label:"App Version", value: pd.stats?.version ?? "—", sub:"current" }];

        const filteredRevs = filterByPeriod(allRevs, reviewPeriod);
        const displayRevs = filteredRevs.slice(0, reviewLimit).map(r => ({
          id: r.id, stars: r.stars, author: r.author, title: r.title||"",
          text: r.text, replied: r.replied,
          time: new Date(r.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"}),
        }));
        const canMore = reviewLimit < Math.min(filteredRevs.length, maxLimit);

        const cardStyle = {background:"#FFF",borderRadius:12,padding:"16px 18px",border:"1px solid #E1E4E8"};
        const labelS = {fontSize:10,fontWeight:600,color:"#8B949E",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8};
        const valS   = {fontSize:26,fontWeight:700,color:"#1F2328",lineHeight:1};
        const subS   = {fontSize:12,color:"#8B949E",marginTop:5};

        return (
          <div>
            {/* Unified KPI row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:extraKpis.length?8:16}}>
              {unifiedKpis.map(c=>(
                <div key={c.label} style={cardStyle}>
                  <div style={labelS}>{c.label}</div>
                  <div style={valS}>{c.value}</div>
                  <div style={subS}>{c.sub}</div>
                </div>
              ))}
            </div>
            {/* Platform-specific extras row */}
            {extraKpis.length > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:16}}>
                {extraKpis.map(c=>(
                  <div key={c.label} style={cardStyle}>
                    <div style={labelS}>{c.label}</div>
                    <div style={valS}>{c.value}</div>
                    <div style={subS}>{c.sub}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Recent reviews */}
            <div style={{background:"#FFF",borderRadius:12,border:"1px solid #E1E4E8",overflow:"hidden"}}>
              <div style={{padding:"13px 20px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1F2328"}}>Recent reviews</div>
                <div style={{display:"flex",gap:3}}>
                  {["all","today","7d","30d","60d"].map(p=>(
                    <button key={p} onClick={()=>{setReviewPeriod(p);setReviewLimit(10);}}
                      style={{padding:"3px 9px",fontSize:11,fontWeight:500,borderRadius:6,cursor:"pointer",fontFamily:"inherit",border:"1px solid",borderColor:reviewPeriod===p?"#00B67A":"#D0D7DE",background:reviewPeriod===p?"#F0FDF9":"#FFF",color:reviewPeriod===p?"#059669":"#57606A"}}>
                      {p==="all"?"All":p}
                    </button>
                  ))}
                </div>
              </div>
              {displayRevs.length===0 && <div style={{padding:"32px",textAlign:"center",color:"#8B949E",fontSize:13}}>No reviews available</div>}
              {displayRevs.map((r,i) => (
                <div key={r.id} style={{padding:"12px 20px",borderBottom:"1px solid #F8F8F8",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{flexShrink:0,paddingTop:2}}><StarRating stars={r.stars} size={11}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#1F2328"}}>{r.author}</span>
                      {r.title && <span style={{fontSize:11,color:"#8B949E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</span>}
                      {r.replied && <span style={{fontSize:9,background:"#DBEAFE",color:"#1D4ED8",padding:"1px 5px",borderRadius:3,fontWeight:600,flexShrink:0}}>REPLIED</span>}
                      {!r.replied && r.stars<=2 && <span style={{fontSize:9,background:"#FEE2E2",color:"#991B1B",padding:"1px 5px",borderRadius:3,fontWeight:600,flexShrink:0}}>NEEDS REPLY</span>}
                    </div>
                    <div style={{fontSize:12,color:"#57606A",lineHeight:1.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.text}</div>
                  </div>
                  <div style={{fontSize:11,color:"#C0C0C0",flexShrink:0,paddingTop:2}}>{r.time}</div>
                </div>
              ))}
              {canMore && (
                <div style={{padding:"12px 20px",borderTop:"1px solid #F3F4F6",textAlign:"center"}}>
                  <button onClick={()=>setReviewLimit(l=>Math.min(l+10,maxLimit))}
                    style={{background:"#F6F8FA",border:"1px solid #D0D7DE",borderRadius:8,padding:"7px 20px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",color:"#57606A"}}>
                    See 10 more · showing {reviewLimit} of {Math.min(filteredRevs.length,maxLimit)}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  DRAFT CARD
// ═══════════════════════════════════════════════
function DraftCard({ template:t, type, isLoading, onApprove, onDiscard }) {
  const [expanded, setExpanded] = useState(false);
  const isDel  = type === "delete";
  const isEdit = type === "edit";

  // Badge appearance per type
  const badge = isDel
    ? { label:"DELETE REQUEST", bg:"#FEE2E2", color:"#991B1B" }
    : isEdit
    ? { label:"EDIT REQUEST",   bg:"#DBEAFE", color:"#1E40AF" }
    : { label:"NEW DRAFT",      bg:"#FEF3C7", color:"#92400E" };

  // Border tint per type
  const borderColor = isDel ? "#FECACA" : isEdit ? "#BFDBFE" : "#E1E4E8";

  // Button labels — idle vs loading
  const approveIdle    = isDel ? "Remove"   : "Approve";
  const approveLoading = isDel ? "Removing…": "Approving…";
  const discardIdle    = isDel ? "Keep"     : "Discard";
  const discardLoading = isDel ? "Keeping…" : "Discarding…";

  return (
    <div style={{background:"#FFF",borderRadius:12,marginBottom:10,border:`1px solid ${borderColor}`,overflow:"hidden"}}>
      <div style={{padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:"#1F2328"}}>{t.title}</span>
              <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,fontWeight:600,background:badge.bg,color:badge.color}}>{badge.label}</span>
              {isEdit && t.editOf && <span style={{fontSize:10,color:"#8B949E",fontStyle:"italic"}}>replaces {t.editOf}</span>}
            </div>
            <div style={{fontSize:12,color:"#8B949E"}}>{t.category} · {t.author||"Unknown"} · {t.dateAdded||""}</div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
            <button onClick={()=>setExpanded(!expanded)} style={{background:"#F6F8FA",border:"1px solid #D0D7DE",borderRadius:6,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#57606A"}}>{expanded?"Hide":"Preview"}</button>
            <button onClick={onDiscard} disabled={isLoading} style={{background:isDel?"#DCFCE7":"#FEF2F2",color:isDel?"#166534":"#DC2626",border:`1px solid ${isDel?"#BBF7D0":"#FECACA"}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:isLoading?"default":"pointer",fontFamily:"inherit",minWidth:82,opacity:isLoading?0.65:1}}>
              {isLoading ? discardLoading : discardIdle}
            </button>
            <button onClick={onApprove} disabled={isLoading} style={{background:isDel?"#DC2626":"#00B67A",color:"#FFF",border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:isLoading?"default":"pointer",fontFamily:"inherit",minWidth:90,opacity:isLoading?0.65:1}}>
              {isLoading ? approveLoading : approveIdle}
            </button>
          </div>
        </div>
        {expanded && (
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F0F0F0"}}>
            <div style={{fontSize:13,color:"#444",lineHeight:1.65,whiteSpace:"pre-line",marginBottom:10}}>{t.text}</div>
            {t.notes&&<div style={{fontSize:12,color:"#9A6700",background:"#FFF8C5",padding:"6px 10px",borderRadius:6,border:"1px solid #F5E0A0",marginBottom:10}}>💡 {t.notes}</div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{(t.platforms||[]).map(p=><span key={p} style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:500,background:`${PLATFORM_COLORS[p]||"#888"}12`,color:PLATFORM_COLORS[p]||"#888",border:`1px solid ${PLATFORM_COLORS[p]||"#888"}25`}}>{p}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PIN MODAL
// ═══════════════════════════════════════════════
function PinModal({ onUnlock }) {
  const [pin,setPin]=useState(""); const [error,setError]=useState(false);
  const attempt=()=>{if(pin===APP_PIN){onUnlock();}else{setError(true);setPin("");setTimeout(()=>setError(false),1500);}};
  return (
    <div style={{fontFamily:"'Poppins',-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#F4F4F2"}}>
      <div style={{background:"#FFF",borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:340,boxShadow:"0 8px 40px rgba(0,0,0,0.1)",textAlign:"center"}}>
        <div style={{width:52,height:52,background:"linear-gradient(135deg,#0D1117,#1C2333)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 20px"}}>📋</div>
        <div style={{fontSize:19,fontWeight:700,color:"#1F2328",marginBottom:4}}>ORT Battleground</div>
        <div style={{fontSize:13,color:"#8B949E",marginBottom:28}}>Enter your team PIN to continue</div>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="••••" maxLength={50} autoFocus
          style={{width:"100%",border:`2px solid ${error?"#FECACA":"#E1E4E8"}`,borderRadius:10,padding:"12px 14px",fontSize:18,letterSpacing:6,textAlign:"center",fontFamily:"inherit",outline:"none",background:error?"#FEF2F2":"#F6F8FA",boxSizing:"border-box",marginBottom:12,transition:"border-color 0.2s",color:"#1F2328"}}/>
        {error&&<div style={{fontSize:12,color:"#DC2626",marginBottom:12}}>Incorrect PIN — try again</div>}
        <button onClick={attempt} disabled={!pin} style={{width:"100%",background:pin?"#00B67A":"#E5E7EB",color:pin?"#FFF":"#9CA3AF",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:pin?"pointer":"default",fontFamily:"inherit"}}>Unlock</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  SETTINGS MODAL
// ═══════════════════════════════════════════════
function SettingsModal({ currentPat, currentTpKey, onSave, onClose }) {
  const [pat,  setPat]  = useState(currentPat);
  const [tpKey,setTpKey] = useState(currentTpKey);
  const iS = {width:"100%",border:"1px solid #D0D7DE",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#F6F8FA",boxSizing:"border-box"};
  const lS = {fontSize:12,fontWeight:600,color:"#1F2328",marginBottom:6,display:"block"};
  const hintS = {fontSize:12,color:"#57606A",background:"#F6F8FA",borderRadius:8,padding:"10px 12px",lineHeight:1.6};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #E1E4E8",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:17,fontWeight:700,color:"#1F2328"}}>🔑 API Keys</div><div style={{fontSize:12,color:"#8B949E",marginTop:2}}>Stored in your browser only — never sent anywhere except the respective API.</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#8B949E",padding:4}}>✕</button>
        </div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:24}}>

          {/* GitHub PAT */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#1F2328",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16}}>🐙</span> GitHub Token
              {pat.trim() && <span style={{fontSize:10,background:"#DCFCE7",color:"#166534",padding:"1px 6px",borderRadius:4,fontWeight:600}}>SET</span>}
            </div>
            <label style={lS}>Personal Access Token (classic)</label>
            <input type="password" value={pat} onChange={e=>setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" style={{...iS,marginBottom:8}}/>
            <div style={hintS}>Generate at <strong>github.com/settings/tokens</strong> → Classic token → tick <strong>repo</strong> scope. Required to submit, approve or delete templates.</div>
          </div>

          <div style={{borderTop:"1px solid #F0F0F0"}}/>

          {/* Trustpilot API Key */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#1F2328",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16}}>⭐</span> Trustpilot API Key
              {tpKey.trim() && <span style={{fontSize:10,background:"#DCFCE7",color:"#166534",padding:"1px 6px",borderRadius:4,fontWeight:600}}>SET</span>}
            </div>
            <label style={lS}>API Key (Consumer Key)</label>
            <input type="password" value={tpKey} onChange={e=>setTpKey(e.target.value)} placeholder="tpk_xxxxxxxxxxxxxxxxxxxx" style={{...iS,marginBottom:8}}/>
            <div style={hintS}>From <strong>businessapp.b2b.trustpilot.com → Developers → your app</strong>. Read-only — used for the Analytics tab.</div>
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4}}>
            <button onClick={onClose} style={{background:"#F6F8FA",color:"#57606A",border:"1px solid #D0D7DE",borderRadius:8,padding:"9px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            <button onClick={()=>onSave({pat:pat.trim(),tpKey:tpKey.trim()})} style={{background:"#00B67A",color:"#FFF",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  ADD / EDIT TEMPLATE MODAL
// ═══════════════════════════════════════════════
function AddTemplateModal({ categories, initialData, onSave, onClose }) {
  const isEdit=!!initialData;
  const [title,setTitle]=useState(initialData?.title||"");
  const [category,setCategory]=useState(initialData?.category||categories[0]||"");
  const [customCategory,setCustomCategory]=useState("");
  const [useCustomCat,setUseCustomCat]=useState(false);
  const [text,setText]=useState(initialData?.text||"");
  const [notes,setNotes]=useState(initialData?.notes||"");
  const [author,setAuthor]=useState(TEAM_MEMBERS.includes(initialData?.author)?initialData.author:TEAM_MEMBERS[0]);
  const [platforms,setPlatforms]=useState(initialData?.platforms||[]);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);
  const [saved,setSaved]=useState(false);

  const togglePlatform=p=>setPlatforms(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);
  const canSave=title.trim()&&text.trim()&&platforms.length>0&&(useCustomCat?customCategory.trim():category);
  const handleSave=async()=>{
    if(!canSave||saving)return;
    setSaving(true);setSaveError(null);
    try{await onSave({title:title.trim(),category:useCustomCat?customCategory.trim():category,text:text.trim(),notes:notes.trim(),author,platforms,isNewCategory:useCustomCat});setSaved(true);}
    catch(e){setSaveError(e.message||"Couldn't save. Please try again.");setSaving(false);}
  };
  const iS={width:"100%",border:"1px solid #D0D7DE",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#F6F8FA",boxSizing:"border-box"};
  const lS={fontSize:12,fontWeight:600,color:"#1F2328",marginBottom:6,display:"block"};

  if(saved) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:400,padding:"40px 32px",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>✅</div>
        <div style={{fontSize:17,fontWeight:700,color:"#1F2328",marginBottom:8}}>{isEdit?"Edit submitted!":"Template submitted!"}</div>
        <div style={{fontSize:13,color:"#57606A",lineHeight:1.6,marginBottom:24}}>{isEdit?"Edit request saved — approve it in Pending Items.":"Submitted as draft — approve it in Pending Items."}</div>
        <button onClick={onClose} style={{background:"#00B67A",color:"#FFF",border:"none",borderRadius:8,padding:"10px 28px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Close</button>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #E1E4E8",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:17,fontWeight:700,color:"#1F2328"}}>{isEdit?"Edit Response Template":"Add Response Template"}</div><div style={{fontSize:12,color:"#8B949E",marginTop:2}}>Submitted as pending — approve in Pending Items</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#8B949E",padding:4}}>✕</button>
        </div>
        <div style={{padding:"20px 24px"}}>
          {saveError&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px",marginBottom:16,fontSize:12,color:"#DC2626"}}>⚠️ {saveError}</div>}
          <div style={{marginBottom:16}}><label style={lS}>Title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. 4-star — asking for more detail" style={iS}/></div>
          <div style={{marginBottom:16}}>
            <label style={lS}>Category *</label>
            {!useCustomCat?(
              <div style={{display:"flex",gap:8}}>
                <select value={category} onChange={e=>setCategory(e.target.value)} style={{...iS,flex:1}}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
                {!isEdit&&<button onClick={()=>setUseCustomCat(true)} style={{background:"#F6F8FA",border:"1px solid #D0D7DE",borderRadius:8,padding:"0 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",color:"#57606A"}}>+ New</button>}
              </div>
            ):(
              <div style={{display:"flex",gap:8}}>
                <input value={customCategory} onChange={e=>setCustomCategory(e.target.value)} placeholder="New category name" style={{...iS,flex:1}}/>
                <button onClick={()=>{setUseCustomCat(false);setCustomCategory("");}} style={{background:"#F6F8FA",border:"1px solid #D0D7DE",borderRadius:8,padding:"0 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#57606A"}}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{marginBottom:16}}>
            <label style={lS}>Platforms * <span style={{fontWeight:400,color:"#8B949E"}}>— select all that apply</span></label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {ALL_PLATFORMS.map(p=><button key={p} onClick={()=>togglePlatform(p)} style={{fontSize:11,padding:"5px 10px",borderRadius:6,cursor:"pointer",fontWeight:500,fontFamily:"inherit",border:`1px solid ${platforms.includes(p)?(PLATFORM_COLORS[p]||"#888"):"#D0D7DE"}`,background:platforms.includes(p)?`${PLATFORM_COLORS[p]||"#888"}14`:"#FFF",color:platforms.includes(p)?(PLATFORM_COLORS[p]||"#888"):"#57606A"}}>{p}</button>)}
            </div>
          </div>
          <div style={{marginBottom:16}}><label style={lS}>Reply Text *</label><textarea value={text} onChange={e=>setText(e.target.value)} rows={6} placeholder="Write the full reply here..." style={{...iS,resize:"vertical",lineHeight:1.6}}/></div>
          <div style={{marginBottom:16}}><label style={lS}>Notes <span style={{fontWeight:400,color:"#8B949E"}}>— optional usage tips</span></label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Replace {name} with the reviewer's name" style={iS}/></div>
          <div style={{marginBottom:24}}><label style={lS}>Your name *</label><select value={author} onChange={e=>setAuthor(e.target.value)} style={iS}>{TEAM_MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{background:"#F6F8FA",color:"#57606A",border:"1px solid #D0D7DE",borderRadius:8,padding:"9px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave||saving} style={{background:canSave&&!saving?"#00B67A":"#E5E7EB",color:canSave&&!saving?"#FFF":"#9CA3AF",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:canSave&&!saving?"pointer":"default",fontFamily:"inherit"}}>{saving?"Saving…":isEdit?"Save Changes":"Submit Template"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
