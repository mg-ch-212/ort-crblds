import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const REPO_OWNER  = "mg-ch-212";
const REPO_NAME   = "ort-crblds";
const FILE_PATH   = "templates.json";
const RAW_URL     = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
const GITHUB_API  = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

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

const TEAM_MEMBERS = ["Momchil Georgiev","Kristiyan Ganchev","Bogomil Hadzhiyski","Veselin Valkov"];

const PLATFORM_COLORS = {
  "X":"#000","Instagram":"#E4405F","Facebook":"#1877F2","Reddit":"#FF4500",
  "Trustpilot":"#00B67A","Google Play":"#34A853","App Store":"#007AFF",
  "Google Maps":"#4285F4","YouTube":"#FF0000","TikTok":"#010101",
  "LinkedIn":"#0A66C2","Threads":"#000","Discourse Forum":"#D97706"
};

// ═══════════════════════════════════════════════
//  GITHUB API HELPERS
// ═══════════════════════════════════════════════
async function submitToGitHub(templateData, pat) {
  // 1. Get current file + SHA
  const fileRes = await fetch(GITHUB_API, {
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" }
  });
  if (!fileRes.ok) throw new Error(
    fileRes.status === 401 ? "Invalid GitHub token — check your PAT in settings (🔑)." :
    fileRes.status === 404 ? "Repo or file not found. Check the token has repo access." :
    `GitHub API error: ${fileRes.status}`
  );
  const fileData = await fileRes.json();
  const sha = fileData.sha;
  const raw = atob(fileData.content.replace(/\n/g, ""));
  const current = JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(raw, c => c.charCodeAt(0))));

  // 2. Generate next ID
  const maxN = (current.templates || []).reduce((m, t) => {
    return Math.max(m, parseInt((t.id || "T000").replace("T", "")) || 0);
  }, 0);
  const newId = "T" + String(maxN + 1).padStart(3, "0");

  // 3. Build new template entry
  const today = new Date().toLocaleDateString("en-GB");
  const newTemplate = {
    id: newId,
    title: templateData.title,
    category: templateData.category,
    platforms: templateData.platforms,
    text: templateData.text,
    notes: templateData.notes || "",
    author: templateData.author,
    status: "draft",
    dateAdded: today
  };

  current.templates = [...(current.templates || []), newTemplate];

  // 4. Add new category to categories list if it doesn't exist
  if (templateData.isNewCategory && templateData.category) {
    const exists = (current.categories || []).some(c => c.name === templateData.category);
    if (!exists) {
      const maxOrder = (current.categories || []).reduce((m, c) => Math.max(m, c.order || 0), 0);
      current.categories = [...(current.categories || []), {
        name: templateData.category,
        icon: "📌",
        order: maxOrder + 1
      }];
    }
  }

  // 5. Commit to GitHub
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
  const updateRes = await fetch(GITHUB_API, {
    method: "PUT",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Add template: ${templateData.title}`, content: encoded, sha })
  });
  if (!updateRes.ok) {
    const err = await updateRes.json();
    const msg = err.message || "Failed to save to GitHub.";
    throw new Error(
      msg === "Not Found" ? "Write access denied — your GitHub token needs repo write access. Ask Momchil to add you as a collaborator, or use the shared team token." : msg
    );
  }
  return newId;
}

// ═══════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function SocialMediaHub() {
  const [activeTab, setActiveTab]               = useState("templates");
  const [search, setSearch]                     = useState("");
  const [platformFilter, setPlatformFilter]     = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [openGuideSections, setOpenGuideSections] = useState({});
  const [copiedId, setCopiedId]                 = useState(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [fetchError, setFetchError]             = useState(null);
  const [ghPat, setGhPat]                       = useState(() => localStorage.getItem("ort_gh_pat") || "");

  const [categories, setCategories]   = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);

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
      setAllTemplates((data.templates || []).filter(t => t.status === "approved"));
      setCategories(data.categories || []);
      setFetchError(null);
    } catch (e) {
      setFetchError("Couldn't load templates. Check your connection.");
    }
  }, []);

  useEffect(() => { loadData(false).finally(() => setLoading(false)); }, [loadData]);

  // ── Build category tree ──
  const mergedCategories = (() => {
    const iconMap  = Object.fromEntries(categories.map(c => [c.name, c.icon]));
    const orderMap = Object.fromEntries(categories.map(c => [c.name, c.order]));
    const catMap   = {};
    allTemplates.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { name: t.category, icon: iconMap[t.category] || "📌", replies: [] };
      catMap[t.category].replies.push({ ...t, builtIn: t.author === "Trading 212" });
    });
    return Object.values(catMap).sort((a, b) => ((orderMap[a.name] ?? 999) - (orderMap[b.name] ?? 999)));
  })();

  const filtered = (() => {
    const q = search.toLowerCase().trim();
    return mergedCategories.map(cat => ({
      ...cat,
      replies: cat.replies.filter(r => {
        const matchSearch   = !q || r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
        const matchPlatform = !platformFilter || r.platforms.includes(platformFilter);
        return matchSearch && matchPlatform;
      })
    })).filter(c => c.replies.length > 0);
  })();

  const usedPlatforms  = [...new Set(mergedCategories.flatMap(c => c.replies.flatMap(r => r.platforms)))];
  const totalReplies   = mergedCategories.reduce((s, c) => s + c.replies.length, 0);
  const teamAddedCount = allTemplates.filter(t => t.author !== "Trading 212").length;
  const filteredTotal  = filtered.reduce((s, c) => s + c.replies.length, 0);

  const handleCopy = async (rid, text) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopiedId(rid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return (
    <div style={{ fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#8B949E" }}>
      Loading…
    </div>
  );

  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", background: "#F4F4F2", minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── Header ── */}
        <div style={{ background: "linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1C2333 100%)", borderRadius: "16px 16px 0 0", padding: "28px 32px 20px", color: "#E6EDF3", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, background: "radial-gradient(circle, rgba(0,182,122,0.07) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, background: "rgba(0,182,122,0.12)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, color: "#FFF", margin: 0 }}>ORT Battleground</h1>
                  <div style={{ fontSize: 13, color: "#8B949E", marginTop: 2 }}>Trading 212 · Templates & Team Guide</div>
                </div>
              </div>
              <button onClick={() => setShowSettings(true)} title="GitHub token settings" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 16, color: ghPat ? "#00B67A" : "#8B949E" }}>
                🔑
              </button>
            </div>
            {activeTab === "templates" && (
              <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                {[[mergedCategories.length,"Categories"],[totalReplies,"Replies"],[usedPlatforms.length,"Platforms"],[teamAddedCount,"Team-Added"]].map(([val,label]) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#58A6FF" }}>{val}</div>
                    <div style={{ fontSize: 11, color: "#8B949E" }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: "flex", background: "#161B22", borderRadius: "0 0 16px 16px", padding: "0 24px", marginBottom: 20, gap: 4, overflowX: "auto" }}>
          {[{ id: "templates", icon: "💬", label: "Response Templates" }, { id: "guide", icon: "📘", label: "Team Guide" }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none", background: "none", fontFamily: "inherit",
              borderBottom: `2px solid ${activeTab === t.id ? "#00B67A" : "transparent"}`,
              color: activeTab === t.id ? "#FFF" : "#8B949E",
              transition: "all 0.15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════ */}
        {/*  TEMPLATES TAB                        */}
        {/* ══════════════════════════════════════ */}
        {activeTab === "templates" && (
          <>
            {fetchError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>
                ⚠️ {fetchError}
              </div>
            )}

            {/* Toolbar */}
            <div style={{ background: "#FFF", borderRadius: 12, padding: "16px 20px", marginBottom: 16, border: "1px solid #E1E4E8" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input type="text" placeholder="Search replies by keyword..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#F6F8FA" }} />
                <button onClick={() => { if (!ghPat) { setShowSettings(true); } else { setShowAddModal(true); } }}
                  style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  + Add Template
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                      background: active ? `${c}20` : `${c}0d`,
                      color: c
                    }}>{p}</button>
                  );
                })}
              </div>
              {(search || platformFilter) && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#57606A" }}>
                  Showing {filteredTotal} {filteredTotal === 1 ? "reply" : "replies"} across {filtered.length} {filtered.length === 1 ? "category" : "categories"}
                </div>
              )}
            </div>

            {/* Categories */}
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
                              <button onClick={() => handleCopy(rid, r.text)} style={{
                                background: isCopied ? "#1A7F37" : "#24292F", color: "#FFF", border: "none", borderRadius: 6,
                                padding: "5px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500, fontFamily: "inherit", flexShrink: 0
                              }}>{isCopied ? "✓ Copied" : "Copy"}</button>
                            </div>
                            <div style={{ fontSize: 13, color: "#444", lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: 10 }}>{r.text}</div>
                            {r.notes && (
                              <div style={{ fontSize: 12, color: "#9A6700", background: "#FFF8C5", padding: "6px 10px", borderRadius: 6, border: "1px solid #F5E0A0", marginBottom: 10 }}>
                                💡 {r.notes}
                              </div>
                            )}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {r.platforms.map(p => (
                                <span key={p} style={{
                                  fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 500,
                                  background: `${PLATFORM_COLORS[p] || "#888"}12`,
                                  color: PLATFORM_COLORS[p] || "#888",
                                  border: `1px solid ${PLATFORM_COLORS[p] || "#888"}25`
                                }}>{p}</span>
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

        {/* ══════════════════════════════════════ */}
        {/*  TEAM GUIDE TAB                       */}
        {/* ══════════════════════════════════════ */}
        {activeTab === "guide" && (
          <>
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
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: s.bg }}>{s.icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2328" }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "#57606A", marginTop: 2 }}>{s.desc}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: "#57606A", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
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

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 11, color: "#8B949E" }}>
          Trading 212 ORT Battleground · Internal Use Only
        </div>
      </div>

      {/* ══════════════════════════════════════ */}
      {/*  SETTINGS MODAL (PAT)                 */}
      {/* ══════════════════════════════════════ */}
      {showSettings && (
        <PATSettingsModal
          currentPat={ghPat}
          onSave={(pat) => { savePat(pat); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ══════════════════════════════════════ */}
      {/*  ADD TEMPLATE MODAL                   */}
      {/* ══════════════════════════════════════ */}
      {showAddModal && (
        <AddTemplateModal
          categories={categories.map(c => c.name)}
          onSave={async (template) => {
            await submitToGitHub(template, ghPat);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 460, padding: 0 }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E1E4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328" }}>🔑 GitHub Token</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginTop: 2 }}>Required to submit new templates. Stored locally in your browser only.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8B949E", padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1F2328", marginBottom: 6, display: "block" }}>
            Personal Access Token (classic)
          </label>
          <input
            type="password"
            value={pat}
            onChange={e => setPat(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{ width: "100%", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#F6F8FA", boxSizing: "border-box", marginBottom: 12 }}
          />
          <div style={{ fontSize: 12, color: "#57606A", background: "#F6F8FA", borderRadius: 8, padding: "10px 12px", marginBottom: 20, lineHeight: 1.6 }}>
            Generate at <strong>github.com/settings/tokens</strong> → Classic token → tick <strong>repo</strong> scope. The token never leaves your browser.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {currentPat && (
              <button onClick={() => onSave("")} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Remove token
              </button>
            )}
            <button onClick={() => onSave(pat.trim())} disabled={!pat.trim()} style={{
              background: pat.trim() ? "#00B67A" : "#E5E7EB", color: pat.trim() ? "#FFF" : "#9CA3AF",
              border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: pat.trim() ? "pointer" : "default", fontFamily: "inherit"
            }}>Save token</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  ADD TEMPLATE MODAL
// ═══════════════════════════════════════════════
function AddTemplateModal({ categories, onSave, onClose }) {
  const [title,          setTitle]          = useState("");
  const [category,       setCategory]       = useState(categories[0] || "");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCat,   setUseCustomCat]   = useState(false);
  const [text,           setText]           = useState("");
  const [notes,          setNotes]          = useState("");
  const [author,         setAuthor]         = useState(TEAM_MEMBERS[0]);
  const [platforms,      setPlatforms]      = useState([]);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState(null);
  const [saved,          setSaved]          = useState(false);

  const togglePlatform = p => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const canSave = title.trim() && text.trim() && author && platforms.length > 0 &&
    (useCustomCat ? customCategory.trim() : category);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setSaveError(null);
    try {
      await onSave({
        title:          title.trim(),
        category:       useCustomCat ? customCategory.trim() : category,
        text:           text.trim(),
        notes:          notes.trim(),
        author:         author.trim(),
        platforms,
        isNewCategory:  useCustomCat
      });
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
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328", marginBottom: 8 }}>Template submitted!</div>
        <div style={{ fontSize: 13, color: "#57606A", lineHeight: 1.6, marginBottom: 24 }}>
          Added to the repo as a <strong>Draft</strong>. It will appear here once approved in GitHub.
        </div>
        <button onClick={onClose} style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 0 }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E1E4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328" }}>Add Response Template</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginTop: 2 }}>Submitted as Draft — visible once approved in GitHub</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8B949E", padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {saveError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
              ⚠️ {saveError}
            </div>
          )}

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
                <button onClick={() => setUseCustomCat(true)} style={{ background: "#F6F8FA", border: "1px solid #D0D7DE", borderRadius: 8, padding: "0 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", color: "#57606A" }}>
                  + New
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="New category name" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { setUseCustomCat(false); setCustomCategory(""); }} style={{ background: "#F6F8FA", border: "1px solid #D0D7DE", borderRadius: 8, padding: "0 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A" }}>
                  Cancel
                </button>
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
            <button onClick={onClose} style={{ background: "#F6F8FA", color: "#57606A", border: "1px solid #D0D7DE", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving} style={{
              background: canSave && !saving ? "#00B67A" : "#E5E7EB",
              color: canSave && !saving ? "#FFF" : "#9CA3AF",
              border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
              cursor: canSave && !saving ? "pointer" : "default", fontFamily: "inherit"
            }}>
              {saving ? "Saving…" : "Submit Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
