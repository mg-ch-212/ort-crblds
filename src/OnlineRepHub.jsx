import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════
//  CONFIG — replace with your deployed URL
// ═══════════════════════════════════════════════
const APPS_SCRIPT_URL = "https://script.google.com/a/macros/trading212.com/s/AKfycbwvGlw183D9zU3oHZJBRtWFPRDX9XIde0ArQ3tft1fjaFEkKMt9L1jjkMevW9YRUYf8/exec";

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

const PLATFORM_COLORS = {
  "X":"#000","Instagram":"#E4405F","Facebook":"#1877F2","Reddit":"#FF4500",
  "Trustpilot":"#00B67A","Google Play":"#34A853","App Store":"#007AFF",
  "Google Maps":"#4285F4","YouTube":"#FF0000","TikTok":"#010101",
  "LinkedIn":"#0A66C2","Threads":"#000","Discourse Forum":"#D97706"
};

// ═══════════════════════════════════════════════
//  APPS SCRIPT HELPERS
// ═══════════════════════════════════════════════
async function fetchFromScript(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${APPS_SCRIPT_URL}?${query}` : APPS_SCRIPT_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postToScript(body) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body)
    // No Content-Type header — defaults to text/plain, avoids CORS preflight
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function SocialMediaHub() {
  const [activeTab, setActiveTab]           = useState("templates");
  const [search, setSearch]                 = useState("");
  const [platformFilter, setPlatformFilter] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [openGuideSections, setOpenGuideSections] = useState({});
  const [copiedId, setCopiedId]             = useState(null);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [loading, setLoading]               = useState(true);
  const [syncStatus, setSyncStatus]         = useState(null); // "syncing" | "synced" | "error"
  const [fetchError, setFetchError]         = useState(null);

  // Data from Google Sheet via Apps Script
  const [sheetCategories, setSheetCategories] = useState([]);
  const [allTemplates, setAllTemplates]       = useState([]);

  const loadData = useCallback(async (showSync = false) => {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      setFetchError("Apps Script URL not configured. Open OnlineRepHub.jsx and replace the placeholder at the top.");
      setLoading(false);
      return;
    }
    if (showSync) setSyncStatus("syncing");
    try {
      const [tRes, cRes] = await Promise.all([
        fetchFromScript(),                        // no params → returns templates
        fetchFromScript({ action: "categories" }) // returns categories
      ]);
      if (tRes.success)  setAllTemplates(tRes.templates);
      if (cRes.success)  setSheetCategories(cRes.categories);
      setFetchError(null);
      if (showSync) {
        setSyncStatus("synced");
        setTimeout(() => setSyncStatus(null), 2000);
      }
    } catch (e) {
      setFetchError("Couldn't reach the template library. Check your connection.");
      if (showSync) setSyncStatus("error");
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, []);

  useEffect(() => {
    loadData(false).finally(() => setLoading(false));
  }, [loadData]);

  // ── Build category tree from flat template list ──
  const mergedCategories = (() => {
    const iconMap  = Object.fromEntries(sheetCategories.map(c => [c.name, c.icon]));
    const orderMap = Object.fromEntries(sheetCategories.map(c => [c.name, c.order]));
    const catMap   = {};
    allTemplates.forEach(t => {
      if (!catMap[t.category]) {
        catMap[t.category] = { name: t.category, icon: iconMap[t.category] || "📌", replies: [] };
      }
      catMap[t.category].replies.push({ ...t, builtIn: t.author === "Trading 212" });
    });
    return Object.values(catMap).sort((a, b) =>
      ((orderMap[a.name] ?? 999) - (orderMap[b.name] ?? 999))
    );
  })();

  // ── Filter ──
  const filtered = (() => {
    const q = search.toLowerCase().trim();
    return mergedCategories.map(cat => {
      const replies = cat.replies.filter(r => {
        const matchSearch   = !q || r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
        const matchPlatform = !platformFilter || r.platforms.includes(platformFilter);
        return matchSearch && matchPlatform;
      });
      return { ...cat, replies };
    }).filter(c => c.replies.length > 0);
  })();

  const usedPlatforms  = [...new Set(mergedCategories.flatMap(c => c.replies.flatMap(r => r.platforms)))];
  const totalReplies   = mergedCategories.reduce((s, c) => s + c.replies.length, 0);
  const teamAddedCount = allTemplates.filter(t => t.author !== "Trading 212").length;
  const filteredTotal  = filtered.reduce((s, c) => s + c.replies.length, 0);

  const handleCopy = async (rid, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(rid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#8B949E" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", background: "#F4F4F2", minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── Header ── */}
        <div style={{ background: "linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1C2333 100%)", borderRadius: "16px 16px 0 0", padding: "28px 32px 20px", color: "#E6EDF3", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, background: "radial-gradient(circle, rgba(0,182,122,0.07) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 38, height: 38, background: "rgba(0,182,122,0.12)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, color: "#FFF", margin: 0 }}>Online Reputation Hub</h1>
                <div style={{ fontSize: 13, color: "#8B949E", marginTop: 2 }}>Trading 212 · Templates & Team Guide</div>
              </div>
            </div>
            {activeTab === "templates" && (
              <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                {[
                  [mergedCategories.length, "Categories"],
                  [totalReplies,            "Replies"],
                  [usedPlatforms.length,    "Platforms"],
                  [teamAddedCount,          "Team-Added"]
                ].map(([val, label]) => (
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
          {[
            { id: "templates", icon: "💬", label: "Response Templates" },
            { id: "guide",     icon: "📘", label: "Team Guide" }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none", background: "none", fontFamily: "inherit",
              borderBottom: `2px solid ${activeTab === t.id ? "#00B67A" : "transparent"}`,
              color: activeTab === t.id ? "#FFF" : "#8B949E",
              transition: "all 0.15s", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 7
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
            {/* Error banner */}
            {fetchError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>
                ⚠️ {fetchError}
              </div>
            )}

            {/* Toolbar */}
            <div style={{ background: "#FFF", borderRadius: 12, padding: "16px 20px", marginBottom: 16, border: "1px solid #E1E4E8" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search replies by keyword..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#F6F8FA" }}
                />
                <button
                  onClick={() => loadData(true)}
                  title="Refresh templates from sheet"
                  style={{
                    background: syncStatus === "synced" ? "#DCFCE7" : syncStatus === "error" ? "#FEF2F2" : "#F6F8FA",
                    color:      syncStatus === "synced" ? "#166534" : syncStatus === "error" ? "#DC2626" : "#57606A",
                    border: `1px solid ${syncStatus === "synced" ? "#BBF7D0" : syncStatus === "error" ? "#FECACA" : "#D0D7DE"}`,
                    borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s"
                  }}
                >
                  {syncStatus === "syncing" ? "⟳" : syncStatus === "synced" ? "✓" : syncStatus === "error" ? "✕" : "⟳"}{" "}
                  {syncStatus === "syncing" ? "Syncing…" : syncStatus === "synced" ? "Synced" : syncStatus === "error" ? "Failed" : "Sync"}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
                >
                  + Add Template
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button onClick={() => setPlatformFilter(null)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                  border: `1px solid ${!platformFilter ? "#0D1117" : "#D0D7DE"}`,
                  background: !platformFilter ? "#0D1117" : "#FFF",
                  color: !platformFilter ? "#FFF" : "#57606A"
                }}>All</button>
                {usedPlatforms.map(p => (
                  <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? null : p)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                    border: `1px solid ${platformFilter === p ? (PLATFORM_COLORS[p] || "#888") : "#D0D7DE"}`,
                    background: platformFilter === p ? `${PLATFORM_COLORS[p] || "#888"}14` : "#FFF",
                    color: platformFilter === p ? (PLATFORM_COLORS[p] || "#888") : "#57606A"
                  }}>{p}</button>
                ))}
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
                        const rid     = `${cat.name}-${ri}`;
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
          Trading 212 Online Reputation Team · Internal Use Only
        </div>
      </div>

      {/* ══════════════════════════════════════ */}
      {/*  ADD TEMPLATE MODAL                   */}
      {/* ══════════════════════════════════════ */}
      {showAddModal && (
        <AddTemplateModal
          categories={sheetCategories.map(c => c.name)}
          onSave={async (template) => {
            const data = await postToScript({ action: "add", ...template });
            if (!data.success) throw new Error("Sheet rejected the submission.");
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
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
  const [author,         setAuthor]         = useState("");
  const [platforms,      setPlatforms]      = useState([]);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState(null);
  const [saved,          setSaved]          = useState(false);

  const togglePlatform = (p) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const canSave = title.trim() && text.trim() && author.trim() && platforms.length > 0 &&
    (useCustomCat ? customCategory.trim() : category);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title:     title.trim(),
        category:  useCustomCat ? customCategory.trim() : category,
        text:      text.trim(),
        notes:     notes.trim(),
        author:    author.trim(),
        platforms: platforms.join(", ")
      });
      setSaved(true);
    } catch (e) {
      setSaveError("Couldn't save the template. Please try again.");
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#F6F8FA", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#1F2328", marginBottom: 6, display: "block" };

  if (saved) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
        <div style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 400, padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328", marginBottom: 8 }}>Template submitted!</div>
          <div style={{ fontSize: 13, color: "#57606A", lineHeight: 1.6, marginBottom: 24 }}>
            It's been added to the sheet as a <strong>Draft</strong> and will appear here once approved.
          </div>
          <button onClick={onClose} style={{ background: "#00B67A", color: "#FFF", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 0 }}>

        {/* Modal header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E1E4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2328" }}>Add Response Template</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginTop: 2 }}>Submitted as Draft — visible to the team once approved</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8B949E", padding: 4 }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Reply Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder='e.g. "Withdrawal delay — processing time"' style={inputStyle} />
          </div>

          {/* Author */}
          <div>
            <label style={labelStyle}>Your Name *</label>
            <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="e.g. Alex" style={inputStyle} />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
            {!useCustomCat ? (
              <div style={{ display: "flex", gap: 8 }}>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => setUseCustomCat(true)} style={{ background: "none", border: "1px solid #D0D7DE", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A", whiteSpace: "nowrap" }}>+ New</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="New category name" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => setUseCustomCat(false)} style={{ background: "none", border: "1px solid #D0D7DE", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#57606A" }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Reply text */}
          <div>
            <label style={labelStyle}>Reply Text *</label>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste or type the full reply text here..." rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: "#8B949E" }}>(optional)</span></label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder='e.g. "Adjust country name as needed"' style={inputStyle} />
          </div>

          {/* Platforms */}
          <div>
            <label style={labelStyle}>Platforms * <span style={{ fontWeight: 400, color: "#8B949E" }}>(select all that apply)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_PLATFORMS.map(p => {
                const isSelected = platforms.includes(p);
                return (
                  <button key={p} onClick={() => togglePlatform(p)} style={{
                    fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
                    border: `1px solid ${isSelected ? (PLATFORM_COLORS[p] || "#888") : "#D0D7DE"}`,
                    background: isSelected ? `${PLATFORM_COLORS[p] || "#888"}14` : "#FFF",
                    color: isSelected ? (PLATFORM_COLORS[p] || "#888") : "#57606A",
                    transition: "all 0.12s"
                  }}>{p}</button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {saveError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#DC2626" }}>
              {saveError}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid #E1E4E8", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "#FFF", color: "#57606A", border: "1px solid #D0D7DE", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              background: canSave && !saving ? "#00B67A" : "#D0D7DE",
              color: canSave && !saving ? "#FFF" : "#8B949E",
              border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13,
              cursor: canSave && !saving ? "pointer" : "default",
              fontFamily: "inherit", fontWeight: 600, transition: "all 0.15s"
            }}
          >
            {saving ? "Submitting…" : "Submit Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
