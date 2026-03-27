import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const REPO_OWNER = "mg-ch-212";
const REPO_NAME  = "ort-crblds";
const FILE_PATH  = "templates.json";
const RAW_URL    = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const APP_PIN    = "8XGc-DyH4eRzG5oj7h-Y3C0T";

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
  { value: "PTO",           label: "🏖️ PTO",           bg: "#dbeafe", fg: "#1e40af", accent: "#3b82f6", border: "#93c5fd" },
  { value: "Sick Leave",    label: "🤒 Sick Leave",    bg: "#fce7f3", fg: "#9d174d", accent: "#ec4899", border: "#f9a8d4" },
  { value: "Holiday",       label: "🎉 Holiday",       bg: "#fef3c7", fg: "#92400e", accent: "#f59e0b", border: "#fcd34d" },
  { value: "Paid Vacation", label: "✈️ Paid Vacation", bg: "#d1fae5", fg: "#065f46", accent: "#10b981", border: "#6ee7b7" },
  { value: "Other",         label: "📝 Other",         bg: "#f3e8ff", fg: "#6b21a8", accent: "#a855f7", border: "#c4b5fd" },
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
  const dow = firstDay.getDay();
  let firstMonday = new Date(firstDay);
  if (dow === 0) firstMonday.setDate(firstDay.getDate() + 1);
  else if (dow > 1) firstMonday.setDate(firstDay.getDate() + (8 - dow));
  const weeks = []; let current = new Date(firstMonday); let weekNum = 1;
  while (weekNum <= 6) {
    if (current.getMonth() !== month && weekNum > 1) break;
    const week = []; const weekStart = new Date(current);
    for (let d = 0; d < 7; d++) { const date = new Date(weekStart); date.setDate(weekStart.getDate() + d); week.push(date.getMonth() === month ? date : null); }
    if (week.some(d => d !== null)) { weeks.push({ weekNum, days: week, startDate: weekStart }); weekNum++; }
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
    )
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
  if (value.includes("13:30") || value.includes("22:00")) return { bg: "#ede9fe", fg: "#5b21b6", accent: "#8b5cf6" };
  if (value.includes("08:00")) return { bg: "#ecfdf5", fg: "#065f46", accent: "#10b981" };
  if (value.includes("10:30") || value.includes("11:00")) return { bg: "#fff7ed", fg: "#9a3412", accent: "#f97316" };
  return { bg: "#eff6ff", fg: "#1e40af", accent: "#3b82f6" };
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
  const [unlocked, setUnlocked]                 = useState(() => sessionStorage.getItem("ort_unlocked") === "1");
  const [allTemplates, setAllTemplates]         = useState([]);
  const [categories, setCategories]             = useState([]);
  const [isMobile, setIsMobile]                 = useState(() => window.innerWidth < 700);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const savePat = (p) => { setGhPat(p); p ? localStorage.setItem("ort_gh_pat", p) : localStorage.removeItem("ort_gh_pat"); };

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
    { id:"templates", icon:"💬", label:"Templates" },
    ...(ghPat ? [{ id:"pending", icon:"📥", label:"Pending Items", badge:pendingCount }] : []),
    { id:"schedule",  icon:"📅", label:"Schedule" },
    { id:"resources", icon:"🔗", label:"Resources", soon:true },
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
            <button onClick={()=>setShowSettings(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",background:"none",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,cursor:"pointer",fontFamily:"inherit",color:ghPat?"#00B67A":"#57606A",fontSize:12,textAlign:"left"}}>
              <span>🔑</span><span>{ghPat?"Token active":"Set GitHub token"}</span>
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
          {activeSection==="schedule" && <ScheduleSection />}

          {/* ══ RESOURCES SECTION ══ */}
          {activeSection==="resources" && (
            <div style={{background:"#FFF",borderRadius:12,padding:"48px 24px",border:"1px solid #E1E4E8",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🔗</div>
              <div style={{fontSize:17,fontWeight:700,color:"#1F2328",marginBottom:8}}>Resources</div>
              <div style={{fontSize:13,color:"#8B949E"}}>Useful links and references — coming soon.</div>
            </div>
          )}

          <div style={{textAlign:"center",padding:"28px 0 8px",fontSize:11,color:"#8B949E"}}>Trading 212 ORT Battleground · Internal Use Only</div>
        </div>
      </div>

      {showSettings && <PATSettingsModal currentPat={ghPat} onSave={(p)=>{savePat(p);setShowSettings(false);}} onClose={()=>setShowSettings(false)} />}
      {showAddModal && <AddTemplateModal categories={categories.map(c=>c.name)} onSave={async(t)=>{await submitToGitHub(t,ghPat);setShowAddModal(false);}} onClose={()=>setShowAddModal(false)} />}
      {editingTemplate && <AddTemplateModal categories={categories.map(c=>c.name)} initialData={editingTemplate} onSave={async(t)=>{await editTemplateOnGitHub(editingTemplate.id,t,ghPat);setEditingTemplate(null);}} onClose={()=>setEditingTemplate(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  SCHEDULE SECTION
// ═══════════════════════════════════════════════
function ScheduleSection() {
  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [pattern,       setPattern]       = useState("Rotation 1");
  const [schedule,      setSchedule]      = useState(null);
  const [savedMonths,   setSavedMonths]   = useState({});
  const [showCreator,   setShowCreator]   = useState(false);
  const [loaded,        setLoaded]        = useState(false);
  const [toast,         setToast]         = useState(null);
  const saveTimer = useRef(null);

  const monthLabel = SCHED_MONTHS[selectedMonth] + " " + selectedYear;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ort-schedule-index");
      if (raw) {
        const index = JSON.parse(raw);
        setSavedMonths(index);
        const keys = Object.keys(index).sort();
        if (keys.length > 0) {
          const latest = keys[keys.length - 1];
          const [y, m] = latest.split("-").map(Number);
          setSelectedYear(y); setSelectedMonth(m);
          const data = localStorage.getItem("ort-schedule:" + latest);
          if (data) setSchedule(JSON.parse(data).map(w => ({ ...w, days: w.days.map(d => d ? new Date(d) : null) })));
        }
      }
    } catch(e) {}
    setLoaded(true);
  }, []);

  const saveSchedule = useCallback((sched, year, month, months) => {
    const key = "ort-schedule:" + year + "-" + month;
    const serializable = sched.map(w => ({ ...w, days: w.days.map(d => d ? d.toISOString() : null) }));
    try {
      localStorage.setItem(key, JSON.stringify(serializable));
      const newIndex = { ...(months || savedMonths), [year+"-"+month]: SCHED_MONTHS[month]+" "+year };
      localStorage.setItem("ort-schedule-index", JSON.stringify(newIndex));
      setSavedMonths(newIndex);
      return true;
    } catch(e) { return false; }
  }, [savedMonths]);

  const handleCreate = () => {
    const sched = generateSchedule(selectedYear, selectedMonth, pattern);
    setSchedule(sched);
    const ok = saveSchedule(sched, selectedYear, selectedMonth, savedMonths);
    setToast(ok ? "✓ " + SCHED_MONTHS[selectedMonth] + " " + selectedYear + " created & saved" : "⚠ Created but save failed");
    setShowCreator(false);
  };

  const handleLoadMonth = (key) => {
    const [y, m] = key.split("-").map(Number);
    setSelectedYear(y); setSelectedMonth(m);
    try {
      const data = localStorage.getItem("ort-schedule:" + key);
      if (data) setSchedule(JSON.parse(data).map(w => ({ ...w, days: w.days.map(d => d ? new Date(d) : null) })));
    } catch(e) { setSchedule(generateSchedule(y, m, pattern)); }
  };

  const handleDeleteMonth = (key) => {
    try {
      localStorage.removeItem("ort-schedule:" + key);
      const newIndex = { ...savedMonths }; delete newIndex[key];
      localStorage.setItem("ort-schedule-index", JSON.stringify(newIndex));
      setSavedMonths(newIndex);
      if (selectedYear+"-"+selectedMonth === key) setSchedule(null);
      setToast("✓ Deleted");
    } catch(e) { setToast("⚠ Delete failed"); }
  };

  const handleScheduleUpdate = (s) => {
    setSchedule(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSchedule(s, selectedYear, selectedMonth, savedMonths), 800);
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
            <div style={{display:"flex",gap:14}}>{TEAM.map(m=><div key={m.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#475569"}}><div style={{width:8,height:8,borderRadius:"50%",background:m.color}}/>{m.name.split(" ")[0]}</div>)}</div>
          </div>
          <div style={{display:"flex",gap:14,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}><SchedCoverageBar schedule={schedule}/></div>
            <div style={{flex:1,minWidth:200}}><SchedGapWarnings schedule={schedule}/></div>
          </div>
          <SchedOffSummary schedule={schedule}/>
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

function SchedCell({ value, date, isEditing, onStartEdit }) {
  if(!date) return <td style={SS.emptyCell}/>;
  const {bg,fg,accent}=getShiftStyle(value);
  const isWeekend=value==="Weekend";
  const isOff=isOffDay(value);
  const offInfo=isOff?OFF_REASONS.find(r=>r.value===value):null;
  return (
    <td onClick={e=>{if(!isWeekend)onStartEdit(e.currentTarget.getBoundingClientRect());}}
      style={{...SS.cell,background:bg,color:fg,borderLeft:accent?`3px solid ${accent}`:"none",cursor:isWeekend?"default":"pointer",outline:isEditing?"2px solid #3b82f6":"none",outlineOffset:-1}}
      title={isWeekend?"Weekend":"Click to edit"}>
      <span style={{fontSize:"12.5px",fontWeight:500}}>{isOff&&offInfo?`${offInfo.label.split(" ")[0]} ${value}`:value}</span>
    </td>
  );
}

function SchedGrid({ schedule, setSchedule }) {
  const [editCell, setEditCell] = useState(null);
  const handleShiftChange=(wi,mi,di,val)=>{const u=[...schedule];u[wi]={...u[wi],shifts:u[wi].shifts.map((ms,i)=>i===mi?ms.map((s,j)=>j===di?val:s):ms)};setSchedule(u);};
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
                      <td style={SS.nameCell}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0}}/><span style={{fontSize:"12.5px",fontWeight:600,color:"#1e293b",whiteSpace:"nowrap"}}>{m.name.split(" ")[0]}</span></div></td>
                      {week.days.map((date,di)=><SchedCell key={di} value={week.shifts[mi][di]} date={date} isEditing={editCell&&editCell.wi===wi&&editCell.mi===mi&&editCell.di===di} onStartEdit={(rect)=>setEditCell({wi,mi,di,rect})}/>)}
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
        <div style={{height:"100%",width:`${p("early")}%`,background:"#10b981",borderRadius:"6px 0 0 6px"}}/>
        <div style={{height:"100%",width:`${p("standard")}%`,background:"#3b82f6"}}/>
        <div style={{height:"100%",width:`${p("late")}%`,background:"#8b5cf6"}}/>
        <div style={{height:"100%",width:`${p("off")}%`,background:"#f59e0b",borderRadius:"0 6px 6px 0"}}/>
      </div>
      <div style={{display:"flex",gap:14,marginTop:8,fontSize:11,color:"#64748b"}}>
        {[["early","#10b981"],["standard","#3b82f6"],["late","#8b5cf6"],["off","#f59e0b"]].map(([k,c])=><span key={k}><span style={{width:6,height:6,borderRadius:"50%",display:"inline-block",marginRight:4,background:c}}/>{k.charAt(0).toUpperCase()+k.slice(1)} {p(k)}%</span>)}
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
          <div style={{width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:600,color:"#1e293b",minWidth:80}}>{m.name.split(" ")[0]}</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(days).map(([reason,count])=>{const info=OFF_REASONS.find(r=>r.value===reason);return<span key={reason} style={{fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:500,background:info?info.bg:"#f1f5f9",color:info?info.fg:"#64748b",border:`1px solid ${info?info.border:"#e2e8f0"}`}}>{info?info.label.split(" ")[0]:""} {reason}: {count}d</span>;})}
          </div>
        </div>;
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
        TEAM.forEach((member,mi)=>{const ry=ry0+mi*rowH;ctx.fillStyle=member.color;ctx.beginPath();ctx.arc(pad+14,ry+rowH/2,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#1e293b";ctx.font="600 11px sans-serif";ctx.textAlign="left";ctx.fillText(member.name.split(" ")[0],pad+24,ry+rowH/2+4);
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
//  PAT SETTINGS MODAL
// ═══════════════════════════════════════════════
function PATSettingsModal({ currentPat, onSave, onClose }) {
  const [pat,setPat]=useState(currentPat);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:460}}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #E1E4E8",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:17,fontWeight:700,color:"#1F2328"}}>🔑 GitHub Token</div><div style={{fontSize:12,color:"#8B949E",marginTop:2}}>Required to submit, edit, approve or delete templates.</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#8B949E",padding:4}}>✕</button>
        </div>
        <div style={{padding:"20px 24px"}}>
          <label style={{fontSize:12,fontWeight:600,color:"#1F2328",marginBottom:6,display:"block"}}>Personal Access Token (classic)</label>
          <input type="password" value={pat} onChange={e=>setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{width:"100%",border:"1px solid #D0D7DE",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#F6F8FA",boxSizing:"border-box",marginBottom:12}}/>
          <div style={{fontSize:12,color:"#57606A",background:"#F6F8FA",borderRadius:8,padding:"10px 12px",marginBottom:20,lineHeight:1.6}}>Generate at <strong>github.com/settings/tokens</strong> → Classic token → tick <strong>repo</strong> scope.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            {currentPat&&<button onClick={()=>onSave("")} style={{background:"#FEF2F2",color:"#DC2626",border:"1px solid #FECACA",borderRadius:8,padding:"9px 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Remove token</button>}
            <button onClick={()=>onSave(pat.trim())} disabled={!pat.trim()} style={{background:pat.trim()?"#00B67A":"#E5E7EB",color:pat.trim()?"#FFF":"#9CA3AF",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:pat.trim()?"pointer":"default",fontFamily:"inherit"}}>Save token</button>
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
