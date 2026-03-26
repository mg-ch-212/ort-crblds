import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const REPO_OWNER  = "mg-ch-212";
const REPO_NAME   = "ort-crblds";
const FILE_PATH   = "templates.json";
const RAW_URL     = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
const GITHUB_API  = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const APP_PIN     = "0000"; // ← Change this to your PIN

// ═══════════════════════════════════════════════
//  TEAM GUIDE SECTIONS
// ═══════════════════════════════════════════════
const GUIDE_SECTIONS = [
  {
    id: "morning", icon: "☀️", bg: "#FEF3C7", name: "Start of Shift", desc: "Morning routine & backlog clearing",
    items: [
      { text: "Clear overnight Slack backlog", detail: "Sev 3 is handled by one person, Sev 4–5 by another. Triage everything that came in overnight before moving on." },
      { text: "Review social networks in order", detail: "Reddit → Twitter/X → Community Forum → Instagram. Stick to this priority order." },
      { text: "Check team email inbox", detail: "Respond to anything pending. Flag items that need escalation." },
      { text: "Input daily statistics", detail: "Use the automated stats sheet. Fill in before the day gets busy." }
    ]
  },
  {
    id: "core", icon: "🔄", bg: "#DBEAFE", name: "Core Daily Tasks", desc: "Reviews, moderation, DMs, monitoring",
    items: [
      { text: "Respond to reviews", detail: "Trustpilot → App Store → Google Play. Always prioritise negative reviews first — use the Response Templates tab." },
      { text: "Moderate T212 social via Slack", detail: "Review reported messages, check the \"Hot\" tab, remove unwanted content." },
      { text: "Handle private messages", detail: "Respond to DMs across all social platforms — don't let these pile up." },
      { text: "Monitor networks via Brandwatch", detail: "Twitter, Instagram, LinkedIn, Facebook, Threads, and others. Flag anything unusual." },
      { text: "Monitor MoneySavingExpert forum", detail: "Check for new Trading 212 mentions. Respond or escalate as needed." },
      { text: "Reply to colleague requests in community", detail: "When a colleague takes action on something community-related, confirm it in the relevant thread." }
    ]
  },
  {
    id: "escalation", icon: "🚨", bg: "#FEE2E2", name: "Escalations & Safety", desc: "When to escalate, vulnerable clients, fraud",
    items: [
      { text: "Escalate cases to relevant teams", detail: "Route to Fraud, Transfers, Payments, etc. as needed. Don't sit on anything that's outside your scope." },
      { text: "Escalate vulnerable clients", detail: "If a client shows signs of financial vulnerability or distress, escalate immediately per the vulnerable client process." },
      { text: "Review expired client bans", detail: "Act on ban expiry alerts when they come in. Don't batch these — handle promptly." },
      { text: "Search for impersonation accounts / fake websites", detail: "Proactively search for accounts or sites pretending to be Trading 212. Report and escalate." },
      { text: "Handle compliance approvals", detail: "Social media content that needs compliance sign-off — route it, track it, follow up." }
    ]
  },
  {
    id: "logging", icon: "📝", bg: "#D1FAE5", name: "Logging & Reporting", desc: "Stats, feedback, instrument suggestions",
    items: [
      { text: "Log instrument suggestions", detail: "When clients request specific instruments, log them in the tracker so Product can review." },
      { text: "Log client feedback via Jira forms", detail: "Structured feedback goes through Jira. Use the correct form for the feedback type." },
      { text: "Trustpilot carousel on website", detail: "Keep the website's Trustpilot carousel updated with recent positive reviews." }
    ]
  },
  {
    id: "community", icon: "💬", bg: "#F3E8FF", name: "Community & Content", desc: "Forum posts, communities, content creation",
    items: [
      { text: "Share daily corporate events in the Community Forum", detail: "Evening task — post the next day's corporate events before end of shift." },
      { text: "Review and add new communities", detail: "Based on demand or trending instruments. Check if a new community makes sense before creating." },
      { text: "Create social media posts", detail: "When requested by the team. Follow brand guidelines and get compliance approval if needed." },
      { text: "Generate content ideas", detail: "Low priority, but keep a running list. Good ideas can be pitched in team meetings." }
    ]
  },
  {
    id: "projects", icon: "⚙️", bg: "#E0F2FE", name: "Projects & Improvements", desc: "Automation, AI, process improvements",
    items: [
      { text: "Work on automation and AI improvements", detail: "Manager & senior focus. Identify repetitive tasks that can be automated or improved with AI tooling." }
    ]
  }
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
  const res = await fetch(GITHUB_API, {
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(
    res.status === 401 ? "Invalid GitHub token — check your PAT in settings (🔑)." :
    res.status === 404 ? "Repo or file not found. Check the token has repo access." :
    `GitHub API error: ${res.status}`
  );
  const fileData = await res.json();
  const raw = atob(fileData.content.replace(/\n/g, ""));
  const current = JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  return { sha: fileData.sha, current };
}

async function commitFile(current, sha, message, pat) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
  const res = await fetch(GITHUB_API, {
    method: "PUT",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded, sha })
  });
  if (!res.ok) {
    const err = await res.json();
    const msg = err.message || "Failed to save to GitHub.";
    throw new Error(msg === "Not Found" ? "Write access denied — use the shared team token (🔑)." : msg);
  }
}

async function submitToGitHub(templateData, pat) {
  const { sha, current } = await getFileAndSha(pat);
  const maxN = (current.templates || []).reduce((m, t) => Math.max(m, parseInt((t.id || "T000").replace("T","")) || 0), 0);
  const newId = "T" + String(maxN + 1).padStart(3, "0");
  const today = new Date().toLocaleDateString("en-GB");
  current.templates = [...(current.templates || []), {
    id: newId, title: templateData.title, category: templateData.category,
    platforms: templateData.platforms, text: templateData.text,
    notes: templateData.notes || "", author: templateData.author,
    status: "draft", dateAdded: today
  }];
  if (templateData.isNewCategory && templateData.category) {
    const exists = (current.categories || []).some(c => c.name === templateData.category);
    if (!exists) {
      const maxOrder = (current.categories || []).reduce((m, c) => Math.max(m, c.order || 0), 0);
      current.categories = [...(current.categories || []), { name: templateData.category, icon: "📌", order: maxOrder + 1 }];
    }
  }
  await commitFile(current, sha, `Add template: ${templateData.title}`, pat);
  return newId;
}

async function editTemplateOnGitHub(id, templateData, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.map(t =>
    t.id === id ? { ...t, title: templateData.title, category: templateData.category, platforms: templateData.platforms, text: templateData.text, notes: templateData.notes || "", status: "draft", editedAt: new Date().toLocaleDateString("en-GB") } : t
  );
  await commitFile(current, sha, `Edit request: ${templateData.title}`, pat);
}

async function approveTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.map(t =>
    t.id === id ? { ...t, status: "approved" } : t
  );
  await commitFile(current, sha, `Approve template: ${title}`, pat);
}

async function discardTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.filter(t => t.id !== id);
  await commitFile(current, sha, `Discard template: ${title}`, pat);
}

async function deleteTemplateOnGitHub(id, title, pat) {
  const { sha, current } = await getFileAndSha(pat);
  current.templates = current.templates.map(t =>
    t.id === id ? { ...t, status: "delete-requested" } : t
  );
  await commitFile(current, sha, `Delete request: ${title}`, pat);
}

// ═══════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function SocialMediaHub() {
  const [activeSection, setActiveSection]       = useState("templates");
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
  const [actionLoading, setActionLoading]       = useState(false);
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

  const savePat = (pat) => {
    setGhPat(pat);
    if (pat) localStorage.setItem("ort_gh_pat", pat);
    else localStorage.removeItem("ort_gh_pat");
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${RAW_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllTemplates(data.templates || []);
      setCategories(data.categories || []);
      setFetchError(null);
    } catch {
      setFetchError("Couldn't load templates. Check your connection.");
    }
  }, []);

  useEffect(() => { loadData().finally(() => setLoading(false)); }, [loadData]);

  // PIN gate
  if (!unlocked) return (
    <PinModal onUnlock={() => { sessionStorage.setItem("ort_unlocked", "1"); setUnlocked(true); }} />
  );

  // Derived data
  const approvedTemplates    = allTemplates.filter(t => t.status === "approved");
  const draftTemplates       = allTemplates.filter(t => t.status === "draft");
  const deleteRequested      = allTemplates.filter(t => t.status === "delete-requested");
  const pendingCount         = draftTemplates.length + deleteRequested.length;

  // Category tree (approved only)
  const mergedCategories = (() => {
    const iconMap  = Object.fromEntries(categories.map(c => [c.name, c.icon]));
    const orderMap = Object.fromEntries(categories.map(c => [c.name, c.order]));
    const catMap   = {};
    approvedTemplates.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { name: t.category, icon: iconMap[t.category] || "📌", replies: [] };
      catMap[t.category].replies.push({ ...t, builtIn: t.author === "Trading 212" });
    });
    return Object.values(catMap).sort((a, b) => (orderMap[a.name] ?? 999) - (orderMap[b.name] ?? 999));
  })();

  const filtered = (() => {
    const q = search.toLowerCase().trim();
    return mergedCategories.map(cat => ({
      ...cat,
      replies: cat.replies.filter(r => {
        const matchSearch   = !q || r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
        const matchPlatform = !platformFilter || r.platforms.includes(platformFilter);
        const matchAuthor   = !authorFilter || r.author === authorFilter;
        return matchSearch && matchPlatform && matchAuthor;
      })
    })).filter(c => c.replies.length > 0);
  })();

  const usedPlatforms  = [...new Set(mergedCategories.flatMap(c => c.replies.flatMap(r => r.platforms)))];
  const teamAuthors    = [...new Set(approvedTemplates.filter(t => t.author && t.author !== "Trading 212").map(t => t.author))];
  const totalReplies   = mergedCategories.reduce((s, c) => s + c.replies.length, 0);
  const teamAddedCount = approvedTemplates.filter(t => t.author !== "Trading 212").length;
  const filteredTotal  = filtered.reduce((s, c) => s + c.replies.length, 0);

  const handleCopy = async (rid, text) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopiedId(rid); setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (templateId, templateTitle) => {
    setActionLoading(true);
    try { await deleteTemplateOnGitHub(templateId, templateTitle, ghPat); setDeleteConfirmId(null); await loadData(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  const handleApprove = async (templateId, templateTitle) => {
    setActionLoading(true);
    try { await approveTemplateOnGitHub(templateId, templateTitle, ghPat); await loadData(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  const handleDiscard = async (templateId, templateTitle) => {
    setActionLoading(true);
    try { await discardTemplateOnGitHub(templateId, templateTitle, ghPat); await loadData(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <div style={{ fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#8B949E" }}>
      Loading…
    </div>
  );

  // ── Nav items ──
  const navItems = [
    { id: "templates", icon: "💬", label: "Templates" },
    { id: "guide",     icon: "📘", label: "Team Guide" },
    ...(ghPat ? [{ id: "drafts", icon: "📥", label: "Drafts", badge: pendingCount }] : []),
    { id: "schedule",  icon: "📅", label: "Schedule", soon: true },
  ];

  // ── Shared style helpers ──
  const inputStyle = { width: "100%", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#F6F8FA", boxSizing: "border-box" };

  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", WebkitFontSmoothing: "antialiased", display: "flex", minHeight: "100vh", background: "#F4F4F2" }}>

      {/* ══════════════════════════════════════ */}
      {/*  SIDEBAR (desktop) / TOP NAV (mobile) */}
      {/* ══════════════════════════════════════ */}
      {!isMobile ? (
        <div style={{ width: 220, background: "#0D1117", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: "rgba(0,182,122,0.12)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📋</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFF", lineHeight: 1.2 }}>ORT Battleground</div>
                <div style={{ fontSize: 10, color: "#8B949E", marginTop: 1 }}>Trading 212</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#8B949E", letterSpacing: 1, padding: "4px 10px 8px", textTransform: "uppercase" }}>Main</div>
            {navItems.filter(n => !n.soon).map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px",
                background: activeSection === item.id ? "rgba(0,182,122,0.13)" : "none",
                border: activeSection === item.id ? "1px solid rgba(0,182,122,0.2)" : "1px solid transparent",
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                color: activeSection === item.id ? "#00B67A" : "#8B949E",
                fontSize: 13, fontWeight: activeSection === item.id ? 600 : 400,
                marginBottom: 2, textAlign: "left", transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ background: "#EF4444", color: "#FFF", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 700, lineHeight: 1.4 }}>{item.badge}</span>
                )}
              </button>
            ))}

            <div style={{ fontSize: 9, fontWeight: 600, color: "#8B949E", letterSpacing: 1, padding: "16px 10px 8px", textTransform: "uppercase" }}>Coming Soon</div>
            {navItems.filter(n => n.soon).map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 10px",
                borderRadius: 8, color: "#4B5563", fontSize: 13, marginBottom: 2, opacity: 0.6
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 9, background: "rgba(255,255,255,0.08)", color: "#8B949E", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>SOON</span>
              </div>
            ))}
          </nav>

          {/* PAT token button */}
          <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => setShowSettings(true)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px",
              background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
              cursor: "pointer", fontFamily: "inherit", color: ghPat ? "#00B67A" : "#57606A", fontSize: 12, textAlign: "left"
            }}>
              <span>🔑</span>
              <span>{ghPat ? "Token active" : "Set GitHub token"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mobile top nav */
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "#0D1117", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", padding: "0 12px", height: 52, gap: 4, overflowX: "auto" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFF", whiteSpace: "nowrap", marginRight: 8 }}>ORT</div>
          {navItems.map(item => (
            <button key={item.id} onClick={() => !item.soon && setActiveSection(item.id)} style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: item.soon ? "default" : "pointer",
              border: "none", background: "none", fontFamily: "inherit", whiteSpace: "nowrap",
              borderBottom: `2px solid ${activeSection === item.id ? "#00B67A" : "transparent"}`,
              color: item.soon ? "#4B5563" : activeSection === item.id ? "#FFF" : "#8B949E",
              display: "flex", alignItems: "center", gap: 5, height: 52
            }}>
              {item.icon} {item.label}
              {item.badge > 0 && <span style={{ background: "#EF4444", color: "#FFF", borderRadius: 8, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>{item.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/*  MAIN CONTENT                         */}
      {/* ══════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "68px 12px 24px" : "24px 28px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ── TEMPLATES SECTION ── */}
          {activeSection === "templates" && (
            <>
              {/* Section header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F2328", margin: 0 }}>Response Templates</h2>
                    <div style={{ fontSize: 13, color: "#8B949E", marginTop: 2 }}>
                      {mergedCategories.length} categories · {totalReplies} replies · {teamAddedCount} team-added
                    </div>
                  </div>
                  <button onClick={() => { if (!ghPat) setShowSettings(true); else setShowAddModal(true); }}
                    style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    + Add Template
                  </button>
                </div>
              </div>

              {fetchError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>
                  ⚠️ {fetchError}
                </div>
              )}

              {/* Search + filters */}
              <div style={{ background: "#FFF", borderRadius: 12, padding: "16px 20px", marginBottom: 16, border: "1px solid #E1E4E8" }}>
                <input type="text" placeholder="Search replies by keyword..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 12, fontSize: 14 }} />

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: teamAuthors.length > 0 ? 10 : 0 }}>
                  <button onClick={() => setPlatformFilter(null)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                    border: `1px solid ${!platformFilter ? "#0D1117" : "#D0D7DE"}`,
                    background: !platformFilter ? "#0D1117" : "#FFF", color: !platformFilter ? "#FFF" : "#57606A"
                  }}>All</button>
                  {usedPlatforms.map(p => {
                    const c = PLATFORM_COLORS[p] || "#888";
                    const active = platformFilter === p;
                    return (
                      <button key={p} onClick={() => setPlatformFilter(active ? null : p)} style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                        border: `1px solid ${c}${active ? "80" : "40"}`,
                        background: active ? `${c}20` : `${c}0d`, color: c
                      }}>{p}</button>
                    );
                  })}
                </div>

                {teamAuthors.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTop: "1px solid #F0F0F0", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#8B949E", marginRight: 2 }}>By member:</span>
                    {teamAuthors.map(a => (
                      <button key={a} onClick={() => setAuthorFilter(authorFilter === a ? null : a)} style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                        border: `1px solid ${authorFilter === a ? "#6366F1" : "#D0D7DE"}`,
                        background: authorFilter === a ? "#EEF2FF" : "#FFF",
                        color: authorFilter === a ? "#4F46E5" : "#57606A"
                      }}>{a}</button>
                    ))}
                  </div>
                )}

                {(search || platformFilter || authorFilter) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#57606A" }}>
                    Showing {filteredTotal} {filteredTotal === 1 ? "reply" : "replies"} across {filtered.length} {filtered.length === 1 ? "category" : "categories"}
                  </div>
                )}
              </div>

              {/* Category cards */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#57606A" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <p>{fetchError ? "Templates could not be loaded." : "No replies match your search."}</p>
                </div>
              ) : filtered.map(cat => {
                const isOpen = expandedCategory === cat.name;
                return (
                  <div key={cat.name} style={{ background: "#FFF", borderRadius: 12, marginBottom: 10, border: "1px solid #E1E4E8", overflow: "hidden" }}>
                    <button onClick={() => setExpandedCategory(isOpen ? null : cat.name)} style={{
                      width: "100%", background: "none", border: "none", padding: "14px 18px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", fontFamily: "inherit"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{cat.icon}</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2328" }}>{cat.name}</span>
                        <span style={{ fontSize: 11, color: "#57606A", background: "#F6F8FA", padding: "2px 8px", borderRadius: 12, border: "1px solid #E1E4E8" }}>{cat.replies.length}</span>
                      </div>
                      <span style={{ fontSize: 14, color: "#57606A", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 18px 14px" }}>
                        {cat.replies.map((r, ri) => {
                          const rid = `${cat.name}-${ri}`;
                          const isCopied = copiedId === rid;
                          const isTeamAdded = !r.builtIn;
                          const isDeleteConfirm = deleteConfirmId === rid;
                          return (
                            <div key={rid} style={{ background: isTeamAdded ? "#F0FDF4" : "#F6F8FA", borderRadius: 10, padding: 16, marginBottom: 8, border: `1px solid ${isTeamAdded ? "#BBF7D0" : "#E1E4E8"}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2328" }}>{r.title}</div>
                                  {isTeamAdded && (
                                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#DCFCE7", color: "#166534", fontWeight: 600 }}>
                                      TEAM-ADDED{r.author ? ` · ${r.author}` : ""}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                  {ghPat && (
                                    <>
                                      <button onClick={() => { setDeleteConfirmId(null); setEditingTemplate(r); }} title="Edit" style={{ background: "#F6F8FA", color: "#57606A", border: "1px solid #D0D7DE", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                                      <button onClick={() => setDeleteConfirmId(isDeleteConfirm ? null : rid)} title="Delete" style={{ background: isDeleteConfirm ? "#FEF2F2" : "#F6F8FA", color: isDeleteConfirm ? "#DC2626" : "#57606A", border: `1px solid ${isDeleteConfirm ? "#FECACA" : "#D0D7DE"}`, borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
                                    </>
                                  )}
                                  <button onClick={() => handleCopy(rid, r.text)} style={{
                                    background: isCopied ? "#1A7F37" : "#24292F", color: "#FFF", border: "none", borderRadius: 6,
                                    padding: "5px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500, fontFamily: "inherit", flexShrink: 0
                                  }}>{isCopied ? "✓ Copied" : "Copy"}</button>
                                </div>
                              </div>
                              {isDeleteConfirm && (
                                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, color: "#991B1B" }}>Mark for deletion? It will be hidden until removed in GitHub.</span>
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <button onClick={() => setDeleteConfirmId(null)} style={{ background: "#FFF", border: "1px solid #D0D7DE", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A" }}>Cancel</button>
                                    <button onClick={() => handleDelete(r.id, r.title)} disabled={actionLoading} style={{ background: "#DC2626", color: "#FFF", border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 600, cursor: actionLoading ? "default" : "pointer", fontFamily: "inherit" }}>
                                      {actionLoading ? "…" : "Confirm"}
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: 10 }}>{r.text}</div>
                              {r.notes && (
                                <div style={{ fontSize: 12, color: "#9A6700", background: "#FFF8C5", padding: "6px 10px", borderRadius: 6, border: "1px solid #F5E0A0", marginBottom: 10 }}>
                                  💡 {r.notes}
                                </div>
                              )}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {r.platforms.map(p => (
                                  <span key={p} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 500, background: `${PLATFORM_COLORS[p] || "#888"}12`, color: PLATFORM_COLORS[p] || "#888", border: `1px solid ${PLATFORM_COLORS[p] || "#888"}25` }}>{p}</span>
                                ))}
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

          {/* ── TEAM GUIDE SECTION ── */}
          {activeSection === "guide" && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F2328", margin: 0 }}>Team Guide</h2>
                <div style={{ fontSize: 13, color: "#8B949E", marginTop: 2 }}>Day-to-day tasks, escalations, and processes</div>
              </div>
              <div style={{ background: "#FFF", borderRadius: 12, padding: "14px 20px", marginBottom: 16, border: "1px solid #E1E4E8", fontSize: 13, color: "#57606A", lineHeight: 1.6 }}>
                Everything the team handles day-to-day, organised by when and how. Click any section to expand.
              </div>
              {GUIDE_SECTIONS.map(s => {
                const isOpen = openGuideSections[s.id];
                return (
                  <div key={s.id} style={{ background: "#FFF", borderRadius: 12, marginBottom: 10, border: "1px solid #E1E4E8", overflow: "hidden" }}>
                    <button onClick={() => setOpenGuideSections(prev => ({ ...prev, [s.id]: !prev[s.id] }))} style={{
                      width: "100%", background: "none", border: "none", padding: "16px 20px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", fontFamily: "inherit"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: s.bg, flexShrink: 0 }}>{s.icon}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2328" }}>{s.name}</div>
                          <div style={{ fontSize: 12, color: "#57606A", marginTop: 2 }}>{s.desc}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: "#57606A", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0 }}>▼</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 20px 20px" }}>
                        {s.items.map((item, i) => (
                          <div key={i} style={{ background: "#F6F8FA", borderRadius: 10, padding: "14px 16px", marginBottom: 6, border: "1px solid #E1E4E8" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2328", marginBottom: 4 }}>{item.text}</div>
                            <div style={{ fontSize: 12, color: "#57606A", lineHeight: 1.55 }}>{item.detail}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ── DRAFTS SECTION ── */}
          {activeSection === "drafts" && ghPat && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F2328", margin: 0 }}>Drafts & Pending Actions</h2>
                <div style={{ fontSize: 13, color: "#8B949E", marginTop: 2 }}>Review, approve or discard submitted templates</div>
              </div>

              {(draftTemplates.length === 0 && deleteRequested.length === 0) && (
                <div style={{ background: "#FFF", borderRadius: 12, padding: "48px 24px", border: "1px solid #E1E4E8", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2328", marginBottom: 6 }}>All clear</div>
                  <div style={{ fontSize: 13, color: "#8B949E" }}>No pending drafts or deletion requests.</div>
                </div>
              )}

              {/* Pending drafts */}
              {draftTemplates.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8B949E", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
                    Awaiting approval — {draftTemplates.length}
                  </div>
                  {draftTemplates.map(t => (
                    <DraftCard
                      key={t.id}
                      template={t}
                      type="draft"
                      actionLoading={actionLoading}
                      onApprove={() => handleApprove(t.id, t.title)}
                      onDiscard={() => handleDiscard(t.id, t.title)}
                    />
                  ))}
                </>
              )}

              {/* Delete requests */}
              {deleteRequested.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8B949E", letterSpacing: 0.5, textTransform: "uppercase", margin: draftTemplates.length > 0 ? "20px 0 10px" : "0 0 10px" }}>
                    Deletion requests — {deleteRequested.length}
                  </div>
                  {deleteRequested.map(t => (
                    <DraftCard
                      key={t.id}
                      template={t}
                      type="delete"
                      actionLoading={actionLoading}
                      onApprove={() => handleDiscard(t.id, t.title)}
                      onDiscard={() => handleApprove(t.id, t.title)}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* ── SCHEDULE SECTION (placeholder) ── */}
          {activeSection === "schedule" && (
            <div style={{ background: "#FFF", borderRadius: 12, padding: "48px 24px", border: "1px solid #E1E4E8", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328", marginBottom: 8 }}>Schedule</div>
              <div style={{ fontSize: 13, color: "#8B949E" }}>Coming soon — shift schedules and coverage planning.</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "28px 0 8px", fontSize: 11, color: "#8B949E" }}>
            Trading 212 ORT Battleground · Internal Use Only
          </div>
        </div>
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <PATSettingsModal
          currentPat={ghPat}
          onSave={(pat) => { savePat(pat); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Add Template Modal ── */}
      {showAddModal && (
        <AddTemplateModal
          categories={categories.map(c => c.name)}
          onSave={async (template) => { await submitToGitHub(template, ghPat); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* ── Edit Template Modal ── */}
      {editingTemplate && (
        <AddTemplateModal
          categories={categories.map(c => c.name)}
          initialData={editingTemplate}
          onSave={async (template) => { await editTemplateOnGitHub(editingTemplate.id, template, ghPat); setEditingTemplate(null); }}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  DRAFT CARD (approval panel)
// ═══════════════════════════════════════════════
function DraftCard({ template: t, type, actionLoading, onApprove, onDiscard }) {
  const [expanded, setExpanded] = useState(false);
  const isDelete = type === "delete";

  return (
    <div style={{ background: "#FFF", borderRadius: 12, marginBottom: 10, border: `1px solid ${isDelete ? "#FECACA" : "#E1E4E8"}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2328" }}>{t.title}</span>
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: isDelete ? "#FEE2E2" : "#FEF3C7", color: isDelete ? "#991B1B" : "#92400E" }}>
                {isDelete ? "DELETE REQUEST" : "DRAFT"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#8B949E" }}>
              {t.category} · {t.author || "Unknown"} · {t.dateAdded || ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <button onClick={() => setExpanded(!expanded)} style={{ background: "#F6F8FA", border: "1px solid #D0D7DE", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A" }}>
              {expanded ? "Hide" : "Preview"}
            </button>
            <button onClick={onDiscard} disabled={actionLoading} style={{
              background: isDelete ? "#DCFCE7" : "#FEF2F2",
              color: isDelete ? "#166534" : "#DC2626",
              border: `1px solid ${isDelete ? "#BBF7D0" : "#FECACA"}`,
              borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600,
              cursor: actionLoading ? "default" : "pointer", fontFamily: "inherit"
            }}>
              {isDelete ? "Keep" : "Discard"}
            </button>
            <button onClick={onApprove} disabled={actionLoading} style={{
              background: isDelete ? "#DC2626" : "#00B67A",
              color: "#FFF", border: "none", borderRadius: 6,
              padding: "5px 14px", fontSize: 12, fontWeight: 600,
              cursor: actionLoading ? "default" : "pointer", fontFamily: "inherit"
            }}>
              {actionLoading ? "…" : isDelete ? "Remove" : "Approve"}
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0F0F0" }}>
            <div style={{ fontSize: 13, color: "#444", lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: 10 }}>{t.text}</div>
            {t.notes && (
              <div style={{ fontSize: 12, color: "#9A6700", background: "#FFF8C5", padding: "6px 10px", borderRadius: 6, border: "1px solid #F5E0A0", marginBottom: 10 }}>
                💡 {t.notes}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(t.platforms || []).map(p => (
                <span key={p} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 500, background: `${PLATFORM_COLORS[p] || "#888"}12`, color: PLATFORM_COLORS[p] || "#888", border: `1px solid ${PLATFORM_COLORS[p] || "#888"}25` }}>{p}</span>
              ))}
            </div>
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
  const [pin, setPin]     = useState("");
  const [error, setError] = useState(false);

  const attempt = () => {
    if (pin === APP_PIN) { onUnlock(); }
    else { setError(true); setPin(""); setTimeout(() => setError(false), 1500); }
  };

  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F4F4F2", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ background: "#FFF", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.1)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, background: "linear-gradient(135deg, #0D1117, #1C2333)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 20px" }}>📋</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: "#1F2328", marginBottom: 4 }}>ORT Battleground</div>
        <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 28 }}>Enter your team PIN to continue</div>
        <input
          type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()}
          placeholder="••••" maxLength={12} autoFocus
          style={{
            width: "100%", border: `2px solid ${error ? "#FECACA" : "#E1E4E8"}`, borderRadius: 10,
            padding: "12px 14px", fontSize: 18, letterSpacing: 6, textAlign: "center",
            fontFamily: "inherit", outline: "none", background: error ? "#FEF2F2" : "#F6F8FA",
            boxSizing: "border-box", marginBottom: 12, transition: "border-color 0.2s", color: "#1F2328"
          }}
        />
        {error && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>Incorrect PIN — try again</div>}
        <button onClick={attempt} disabled={!pin} style={{
          width: "100%", background: pin ? "#00B67A" : "#E5E7EB", color: pin ? "#FFF" : "#9CA3AF",
          border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600,
          cursor: pin ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.2s"
        }}>Unlock</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PAT SETTINGS MODAL
// ═══════════════════════════════════════════════
function PATSettingsModal({ currentPat, onSave, onClose }) {
  const [pat, setPat] = useState(currentPat);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 460 }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E1E4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328" }}>🔑 GitHub Token</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginTop: 2 }}>Required to submit, edit, approve or delete templates.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8B949E", padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1F2328", marginBottom: 6, display: "block" }}>Personal Access Token (classic)</label>
          <input type="password" value={pat} onChange={e => setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{ width: "100%", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#F6F8FA", boxSizing: "border-box", marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: "#57606A", background: "#F6F8FA", borderRadius: 8, padding: "10px 12px", marginBottom: 20, lineHeight: 1.6 }}>
            Generate at <strong>github.com/settings/tokens</strong> → Classic token → tick <strong>repo</strong> scope.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {currentPat && <button onClick={() => onSave("")} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Remove token</button>}
            <button onClick={() => onSave(pat.trim())} disabled={!pat.trim()} style={{ background: pat.trim() ? "#00B67A" : "#E5E7EB", color: pat.trim() ? "#FFF" : "#9CA3AF", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: pat.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save token</button>
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
  const isEdit = !!initialData;
  const [title,          setTitle]          = useState(initialData?.title || "");
  const [category,       setCategory]       = useState(initialData?.category || categories[0] || "");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCat,   setUseCustomCat]   = useState(false);
  const [text,           setText]           = useState(initialData?.text || "");
  const [notes,          setNotes]          = useState(initialData?.notes || "");
  const [author,         setAuthor]         = useState(TEAM_MEMBERS.includes(initialData?.author) ? initialData.author : TEAM_MEMBERS[0]);
  const [platforms,      setPlatforms]      = useState(initialData?.platforms || []);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState(null);
  const [saved,          setSaved]          = useState(false);

  const togglePlatform = p => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const canSave = title.trim() && text.trim() && platforms.length > 0 && (useCustomCat ? customCategory.trim() : category);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setSaveError(null);
    try {
      await onSave({ title: title.trim(), category: useCustomCat ? customCategory.trim() : category, text: text.trim(), notes: notes.trim(), author, platforms, isNewCategory: useCustomCat });
      setSaved(true);
    } catch (e) {
      setSaveError(e.message || "Couldn't save the template. Please try again.");
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#F6F8FA", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#1F2328", marginBottom: 6, display: "block" };

  if (saved) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 400, padding: "40px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328", marginBottom: 8 }}>{isEdit ? "Edit submitted!" : "Template submitted!"}</div>
        <div style={{ fontSize: 13, color: "#57606A", lineHeight: 1.6, marginBottom: 24 }}>
          {isEdit ? "Changes saved as Draft — check the Drafts tab to approve." : "Added as Draft — check the Drafts tab to approve."}
        </div>
        <button onClick={onClose} style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E1E4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328" }}>{isEdit ? "Edit Response Template" : "Add Response Template"}</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginTop: 2 }}>Submitted as Draft — approve it in the Drafts tab</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8B949E", padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {saveError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>⚠️ {saveError}</div>}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 4-star — asking for more detail" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Category *</label>
            {!useCustomCat ? (
              <div style={{ display: "flex", gap: 8 }}>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {!isEdit && <button onClick={() => setUseCustomCat(true)} style={{ background: "#F6F8FA", border: "1px solid #D0D7DE", borderRadius: 8, padding: "0 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", color: "#57606A" }}>+ New</button>}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="New category name" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { setUseCustomCat(false); setCustomCategory(""); }} style={{ background: "#F6F8FA", border: "1px solid #D0D7DE", borderRadius: 8, padding: "0 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A" }}>Cancel</button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Platforms * <span style={{ fontWeight: 400, color: "#8B949E" }}>— select all that apply</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_PLATFORMS.map(p => (
                <button key={p} onClick={() => togglePlatform(p)} style={{
                  fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                  border: `1px solid ${platforms.includes(p) ? (PLATFORM_COLORS[p] || "#888") : "#D0D7DE"}`,
                  background: platforms.includes(p) ? `${PLATFORM_COLORS[p] || "#888"}14` : "#FFF",
                  color: platforms.includes(p) ? (PLATFORM_COLORS[p] || "#888") : "#57606A"
                }}>{p}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Reply Text *</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Write the full reply here..." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: "#8B949E" }}>— optional usage tips</span></label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Replace {name} with the reviewer's name" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Your name *</label>
            <select value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle}>
              {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ background: "#F6F8FA", color: "#57606A", border: "1px solid #D0D7DE", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave || saving} style={{
              background: canSave && !saving ? "#00B67A" : "#E5E7EB", color: canSave && !saving ? "#FFF" : "#9CA3AF",
              border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
              cursor: canSave && !saving ? "pointer" : "default", fontFamily: "inherit"
            }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Submit Template"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
