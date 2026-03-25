// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const SHEET_ID  = "1W4U45V14VmL70DjA_7fWkWyIzBDIg50WeDxhRf660Ng/"; // from your Google Sheet URL
const LIB_SHEET = "Template Library";
const CAT_SHEET = "Categories";

// ═══════════════════════════════════════════════
//  GET — read templates & categories
// ═══════════════════════════════════════════════
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || "templates";
  try {
    if (action === "categories") return respond(getCategories());
    return respond(getTemplates());
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════
//  POST — add new template
// ═══════════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return respond(addTemplate(data));
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════
//  HANDLERS
// ═══════════════════════════════════════════════
function getTemplates() {
  const rows = getSheet(LIB_SHEET).getDataRange().getValues();
  const templates = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[7] !== "Approved") continue; // col H = Status
    templates.push({
      id:        r[0],
      category:  r[1],
      title:     r[2],
      platforms: r[3] ? r[3].split(",").map(p => p.trim()) : [],
      text:      r[4],
      notes:     r[5] || "",
      author:    r[6],
      dateAdded: r[8]
    });
  }
  return { success: true, templates };
}

function getCategories() {
  const rows = getSheet(CAT_SHEET).getDataRange().getValues();
  const cats = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    cats.push({ order: r[0], name: r[1], icon: r[2], description: r[3] });
  }
  return { success: true, categories: cats.sort((a, b) => a.order - b.order) };
}

function addTemplate(p) {
  const sheet   = getSheet(LIB_SHEET);
  const lastRow = sheet.getLastRow();
  const ids     = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  const maxN  = ids.reduce((m, id) => Math.max(m, parseInt((id || "T000").replace("T", "")) || 0), 0);
  const newId = "T" + String(maxN + 1).padStart(3, "0");
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  sheet.appendRow([
    newId,
    p.category  || "",
    p.title     || "",
    p.platforms || "",
    p.text      || "",
    p.notes     || "",
    p.author    || "Team",
    "Draft",
    today
  ]);
  return { success: true, id: newId };
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
