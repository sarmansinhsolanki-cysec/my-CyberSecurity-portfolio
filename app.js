/**
 * Web App Security Portfolio - Interactive Logic
 * Data + auth: Supabase
 */

// ==========================================================================
// CONFIG
// ==========================================================================
const SUPABASE_URL = 'https://cvcwovibiouqzyfxxmyq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3dvdmliaW91cXp5Znh4bXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTU5NDUsImV4cCI6MjEwNzA5MTk0NX0.HxcL2mPUlgtRddTFVXJOciWMiqyniNEr8DKoV5vmyPU';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ==========================================================================
// SEED DATA
// Paste your existing INITIAL_WRITEUPS array here, UNCHANGED.
// It is uploaded to Supabase once, on the first author login, if the table is empty.
// ==========================================================================
const INITIAL_WRITEUPS = [
  // ... your existing entries ...
];

// ==========================================================================
// STATE
// ==========================================================================
let allWriteups = [];
let isAuthor = false;
let seedChecked = false;
let authSuccessCallback = null;
let currentCategory = "all";
let currentSearchQuery = "";
let currentSelectedImageDataUrl = "";

// ==========================================================================
// DATA MAPPING (database row <-> app object)
// ==========================================================================
function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    target: r.target || "",
    sector: r.sector || "",
    severity: r.severity || "",
    cvss: r.cvss || "",
    date: r.disclosure_date || (r.created_at || "").slice(0, 10),
    tags: r.tags || [],
    summary: r.summary || "",
    content: r.content || ""
  };
}

function toRow(w) {
  return {
    title: w.title,
    category: w.category,
    target: w.target,
    sector: w.sector,
    severity: w.severity,
    cvss: w.cvss,
    disclosure_date: w.date || null,
    tags: w.tags,
    summary: w.summary,
    content: w.content
  };
}

// ==========================================================================
// AUTH
// ==========================================================================
db.auth.onAuthStateChange(async (_event, session) => {
  isAuthor = !!session && session.user.app_metadata?.role === "author";
  renderAuthLock();

  if (isAuthor && !seedChecked) {
    seedChecked = true;
    await seedIfEmpty();
  }
  await loadWriteups();
});

function renderAuthLock() {
  const btn = document.getElementById("authLockBtn");
  const icon = document.getElementById("authLockIcon");
  const label = document.getElementById("authLockLabel");
  if (!btn) return;
  btn.classList.toggle("locked", !isAuthor);
  btn.classList.toggle("unlocked", isAuthor);
  btn.title = isAuthor ? "Author mode active. Click to sign out." : "Click to sign in as author.";
  if (icon) icon.textContent = isAuthor ? "🔓" : "🔒";
  if (label) label.textContent = isAuthor ? "AUTHOR UNLOCKED" : "AUTHOR LOCKED";
}

function toggleAuthorAuthModal() {
  if (isAuthor) {
    if (confirm("Sign out of author mode?")) {
      db.auth.signOut();
    }
    return;
  }
  openAuthModal();
}

function openAuthModal(onSuccess) {
  authSuccessCallback = onSuccess || null;
  const form = document.getElementById("authPasskeyForm");
  const errEl = document.getElementById("authError");
  if (form) form.reset();
  if (errEl) errEl.textContent = "";
  const modal = document.getElementById("authModal");
  if (modal) modal.showModal();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.close();
  authSuccessCallback = null;
}

async function handleAuthPasskeySubmit(e) {
  e.preventDefault();
  const email = document.getElementById("authorEmailInput").value.trim();
  const password = document.getElementById("authorPasskeyInput").value;
  const errEl = document.getElementById("authError");
  errEl.textContent = "";

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = "Login failed. Check your email and password.";
    return;
  }

  // Only accounts with the author role get write access
  if (data.user.app_metadata?.role !== "author") {
    await db.auth.signOut();
    errEl.textContent = "This account does not have author access.";
    return;
  }

  isAuthor = true;
  renderAuthLock();
  closeAuthModal();
  showToast("✓ Author verified: publishing & editing unlocked!");

  if (typeof authSuccessCallback === "function") {
    const cb = authSuccessCallback;
    authSuccessCallback = null;
    cb();
  }
}

// Runs the action if the user is an author, otherwise shows the login modal first
function requireAuthor(action) {
  if (isAuthor) {
    action();
  } else {
    openAuthModal(action);
  }
}

// ==========================================================================
// DATABASE: LOAD, SEED, SAVE, DELETE
// ==========================================================================
async function seedIfEmpty() {
  if (!INITIAL_WRITEUPS || INITIAL_WRITEUPS.length === 0) return;

  const { count, error: countErr } = await db
    .from("writeups")
    .select("*", { count: "exact", head: true });
  if (countErr) {
    console.error("Seed check failed:", countErr.message);
    return;
  }
  if (count > 0) return;

  const { error } = await db.from("writeups").insert(INITIAL_WRITEUPS.map(toRow));
  if (error) {
    console.error("Seed failed:", error.message);
  } else {
    showToast("Initial write-ups uploaded to database");
  }
}

async function loadWriteups() {
  const { data, error } = await db
    .from("writeups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load write-ups:", error.message);
    showToast("Could not load write-ups");
    return;
  }

  allWriteups = data.map(fromRow);
  renderWriteups();
  renderTickerStats();
}

function findWriteup(id) {
  return allWriteups.find(w => w.id === id);
}

// ==========================================================================
// THEME
// ==========================================================================
function initTheme() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const storedTheme = localStorage.getItem("theme");
  const activeTheme = storedTheme || "dark";
  document.documentElement.setAttribute("data-theme", activeTheme);
  updateThemeIcon(activeTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      updateThemeIcon(next);
      showToast(`Switched to ${next.toUpperCase()} mode`);
    });
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  if (theme === "dark") {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    btn.setAttribute("title", "Switch to Light Mode");
  } else {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btn.setAttribute("title", "Switch to Dark Mode");
  }
}

// ==========================================================================
// RENDER WRITE-UPS
// ==========================================================================
function renderWriteups() {
  const container = document.getElementById("writeupsListContainer");
  if (!container) return;

  const query = currentSearchQuery.toLowerCase();
  const filtered = allWriteups.filter(item => {
    const categoryMatch = currentCategory === "all" || item.category === currentCategory;
    const searchMatch = !query ||
      item.title.toLowerCase().includes(query) ||
      item.target.toLowerCase().includes(query) ||
      item.summary.toLowerCase().includes(query) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(query)));
    return categoryMatch && searchMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <p>No write-ups or CTFs found matching "<strong>${escapeHtml(currentSearchQuery)}</strong>"</p>
        <button class="btn-ghost" onclick="resetFilters()">Reset Filter</button>
      </div>`;
    updateCountBadges(allWriteups);
    return;
  }

  container.innerHTML = filtered.map(item => {
    const sevClass = getSeverityBadgeClass(item.severity, item.category);
    return `
      <article class="writeup-item-row reveal-on-scroll" data-id="${escapeHtml(item.id)}" onclick="openReaderModal('${escapeHtml(item.id)}')">
        <div class="writeup-item-date">
          <span>${escapeHtml(item.date || "RECENT")}</span>
          <span class="writeup-item-badge ${sevClass}">${item.category === "ctf-walkthroughs" ? "CTF" : escapeHtml(item.severity)}</span>
        </div>
        <div class="writeup-item-main">
          <div class="writeup-category-tag">
            <span>// [${escapeHtml(item.target || "TARGET")}]</span>
            <span>•</span>
            <span>${item.category === "ctf-walkthroughs" ? "CTF Walkthrough" : "Bug Bounty Write-up"}</span>
            ${item.cvss ? `<span>• CVSS ${escapeHtml(item.cvss)}</span>` : ""}
          </div>
          <h3 class="writeup-title">${escapeHtml(item.title)}</h3>
          <p class="writeup-snippet">${escapeHtml(item.summary)}</p>
          <div class="writeup-tags-list">
            ${(item.tags || []).slice(0, 4).map(t => `<span class="tech-tag">#${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
        <div class="writeup-item-end">
          <div class="btn-read-arrow" title="Read Full Analysis">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </article>`;
  }).join("");

  updateCountBadges(allWriteups);
  setupScrollFadeIn();
}

function getSeverityBadgeClass(severity, category) {
  if (category === "ctf-walkthroughs") return "badge-ctf";
  const s = (severity || "").toLowerCase();
  if (s.includes("crit")) return "badge-critical";
  if (s.includes("high")) return "badge-high";
  if (s.includes("med")) return "badge-medium";
  return "badge-low";
}

function updateCountBadges(writeups) {
  const bAll = document.getElementById("badgeCountAll");
  const bWriteups = document.getElementById("badgeCountWriteups");
  const bCTF = document.getElementById("badgeCountCTF");
  if (bAll) bAll.textContent = `[${writeups.length}]`;
  if (bWriteups) bWriteups.textContent = `[${writeups.filter(w => w.category === "write-ups").length}]`;
  if (bCTF) bCTF.textContent = `[${writeups.filter(w => w.category === "ctf-walkthroughs").length}]`;
}

function renderTickerStats() {
  const tickerReported = document.getElementById("tickerReportedBugs");
  if (tickerReported) {
    tickerReported.textContent = `${allWriteups.length}+ Documented`;
  }
}

// ==========================================================================
// READER MODAL
// ==========================================================================
function openReaderModal(id) {
  const item = findWriteup(id);
  if (!item) return;

  const modal = document.getElementById("readerModal");
  const body = document.getElementById("readerModalBody");
  if (!modal || !body) return;

  const sevClass = getSeverityBadgeClass(item.severity, item.category);

  body.innerHTML = `
    <div class="reader-article-header">
      <div class="reader-meta-bar">
        <span class="writeup-item-badge ${sevClass}">${item.category === "ctf-walkthroughs" ? "CTF WALKTHROUGH" : escapeHtml(item.severity)}</span>
        <span class="tech-tag">${item.category === "ctf-walkthroughs" ? "CTF CHALLENGE" : "SECURITY WRITE-UP"}</span>
        <span class="tech-tag">[ TARGET: ${escapeHtml(item.target)} ]</span>
        ${item.cvss ? `<span class="tech-tag">CVSS ${escapeHtml(item.cvss)}</span>` : ""}
        <span class="tech-tag">${escapeHtml(item.date || "2026")}</span>
      </div>
      <h1 class="reader-headline">${escapeHtml(item.title)}</h1>
      <div class="reader-stats-grid">
        <div class="reader-stat-col"><label>Target / Scope</label><span>${escapeHtml(item.target)}</span></div>
        <div class="reader-stat-col"><label>Sector</label><span>${escapeHtml(item.sector || "Production")}</span></div>
        <div class="reader-stat-col"><label>Severity Score</label><span>${escapeHtml(item.severity)} (${escapeHtml(item.cvss || "N/A")})</span></div>
        <div class="reader-stat-col"><label>Status</label><span style="color:#10B981;">Disclosed & Resolved</span></div>
      </div>
    </div>
    <div class="article-markdown-body">
      ${parseSimpleMarkdown(item.content || item.summary || "")}
    </div>
    <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid var(--border-primary); display: flex; justify-content: space-between; align-items: center;">
      <div class="writeup-tags-list">
        ${(item.tags || []).map(t => `<span class="tech-tag">#${escapeHtml(t)}</span>`).join("")}
      </div>
      ${isAuthor ? `<button class="btn-ghost" style="color:#C4001D; border-color:rgba(196,0,29,0.3);" onclick="confirmDeleteWriteup('${escapeHtml(item.id)}')">Delete Write-up</button>` : ""}
    </div>`;

  modal.showModal();
}

function closeReaderModal() {
  const modal = document.getElementById("readerModal");
  if (modal) modal.close();
}

async function confirmDeleteWriteup(id) {
  requireAuthor(async () => {
    if (!confirm("Are you sure you want to delete this write-up? This cannot be undone.")) return;

    const { error } = await db.from("writeups").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    closeReaderModal();
    await loadWriteups();
    showToast("Write-up removed successfully");
  });
}

// ==========================================================================
// WRITER MODAL
// ==========================================================================
function openWriterModal() {
  requireAuthor(() => {
    const modal = document.getElementById("writerModal");
    if (!modal) return;

    document.getElementById("writeupForm").reset();
    document.getElementById("formDate").value = new Date().toISOString().split("T")[0];
    switchEditorTab("write");

    const contentArea = document.getElementById("formContent");
    if (contentArea && !contentArea.value) {
      contentArea.value = `## Summary
Provide a concise overview of the vulnerability and attack chain discovered.

## Target & Scope
- Target Application:
- Endpoint:
- Authentication Role Required:

## Step-by-Step Reproduction
1. Send the following HTTP request to the authorization service:
\`\`\`http
POST /api/v1/auth/exchange HTTP/1.1
Host: target.internal
Authorization: Bearer <token>
Content-Type: application/json

{"role": "user", "scope": "read"}
\`\`\`
2. Intercept the response and modify parameter \`X\`...
3. Observe successful privilege escalation to administrative controls.

## Impact & Remediation
- **Impact**: Full account takeover / business logic disruption.
- **Remediation**: Validate session tokens cryptographically on the server-side.`;
    }

    modal.showModal();
  });
}

function closeWriterModal() {
  const modal = document.getElementById("writerModal");
  if (modal) modal.close();
}

function switchEditorTab(tab) {
  const writeBtn = document.getElementById("tabWriteBtn");
  const previewBtn = document.getElementById("tabPreviewBtn");
  const textarea = document.getElementById("formContent");
  const previewBox = document.getElementById("editorPreviewBox");

  if (tab === "write") {
    writeBtn.classList.add("active");
    previewBtn.classList.remove("active");
    textarea.style.display = "block";
    previewBox.style.display = "none";
  } else {
    writeBtn.classList.remove("active");
    previewBtn.classList.add("active");
    textarea.style.display = "none";
    previewBox.style.display = "block";
    previewBox.innerHTML = parseSimpleMarkdown(textarea.value || "*No content entered yet.*");
  }
}

async function handleWriteupSubmit(e) {
  e.preventDefault();

  if (!isAuthor) {
    alert("Please sign in as author first.");
    return;
  }

  const title = document.getElementById("formTitle").value.trim();
  const category = document.getElementById("formCategory").value;
  const target = document.getElementById("formTarget").value.trim() || "Independent Target";
  const sector = document.getElementById("formSector").value.trim() || "Web Application";
  const severity = document.getElementById("formSeverity").value;
  const cvss = document.getElementById("formCvss").value.trim() || "7.5";
  const date = document.getElementById("formDate").value || new Date().toISOString().split("T")[0];
  const tagsStr = document.getElementById("formTags").value.trim();
  const summary = document.getElementById("formSummary").value.trim();
  const content = document.getElementById("formContent").value.trim();

  if (!title) {
    alert("Please enter a write-up title.");
    return;
  }

  const tags = tagsStr
    ? tagsStr.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean)
    : [category === "ctf-walkthroughs" ? "CTF" : "WebSecurity"];

  const row = toRow({
    title,
    category,
    target,
    sector,
    severity,
    cvss,
    date,
    tags,
    summary: summary || title,
    content: content || summary
  });

  const { error } = await db.from("writeups").insert(row);
  if (error) {
    alert("Save failed: " + error.message);
    return;
  }

  closeWriterModal();
  await loadWriteups();
  showToast("Write-up published successfully!");

  const section = document.getElementById("writeups");
  if (section) section.scrollIntoView({ behavior: "smooth" });
}

// ==========================================================================
// EXPORT (backup of what's currently in the database)
// ==========================================================================
function exportWriteupsJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allWriteups, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `security-portfolio-writeups-${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Exported all write-ups as JSON");
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  const tabs = document.querySelectorAll(".writeup-category-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category || "all";
      renderWriteups();
    });
  });

  const searchInput = document.getElementById("writeupSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.trim();
      renderWriteups();
    });
  }

  const targetTabs = document.querySelectorAll(".target-filter-tab");
  const targetCards = document.querySelectorAll(".target-card");
  targetTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      targetTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const sector = tab.dataset.sector;
      targetCards.forEach(card => {
        card.style.display = (sector === "all" || card.dataset.sector === sector) ? "flex" : "none";
      });
    });
  });

  const modals = document.querySelectorAll("dialog.mistral-modal");
  modals.forEach(modal => {
    modal.addEventListener("click", (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
      if (!isInDialog) modal.close();
    });
  });

  const mobileBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener("click", () => navLinks.classList.toggle("mobile-open"));
    navLinks.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => navLinks.classList.remove("mobile-open"));
    });
  }
}

function resetFilters() {
  currentCategory = "all";
  currentSearchQuery = "";
  const searchInput = document.getElementById("writeupSearchInput");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".writeup-category-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.category === "all");
  });
  renderWriteups();
}

// ==========================================================================
// TOAST
// ==========================================================================
function showToast(message) {
  let toast = document.getElementById("siteToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "siteToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style="color:var(--flame-3); font-weight:bold;">//</span><span>${escapeHtml(message)}</span>`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

// ==========================================================================
// PROFILE (display info only, stored in the browser; no passkey)
// ==========================================================================
const PROFILE_STORAGE_KEY = "webapp_sec_portfolio_profile_v1";
const DEFAULT_PROFILE = {
  name: "SARMANSINH",
  handle: "@sarmansinh",
  title: "APPLICATION SECURITY RESEARCHER",
  bio: "I break authentication flows, chain business-logic bugs, and trace attack paths across live production targets — reported through HackerOne and Bugcrowd, on programs spanning fintech, social platforms, and delivery infrastructure.",
  h1: "https://hackerone.com",
  bugcrowd: "https://bugcrowd.com"
};

function loadProfile() {
  let profile = DEFAULT_PROFILE;
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) profile = JSON.parse(stored);
  } catch (e) {
    console.warn("Could not parse profile from localStorage:", e);
  }
  applyProfile(profile);
}

function applyProfile(profile) {
  const navBrand = document.getElementById("navBrandName");
  const navLabel = document.getElementById("navProfileNameLabel");
  const heroName = document.getElementById("heroResearcherName");
  const heroBio = document.querySelector(".hero-bio");

  const displayName = profile.name || "SARMANSINH";
  if (navBrand) navBrand.textContent = displayName;
  if (navLabel) navLabel.textContent = displayName;
  if (heroName) heroName.textContent = displayName;
  if (heroBio && profile.bio) heroBio.textContent = profile.bio;

  const inName = document.getElementById("profileNameInput");
  const inHandle = document.getElementById("profileHandleInput");
  const inTitle = document.getElementById("profileTitleInput");
  const inBio = document.getElementById("profileBioInput");
  const inH1 = document.getElementById("profileH1Input");
  const inBc = document.getElementById("profileBcInput");

  if (inName) inName.value = displayName;
  if (inHandle) inHandle.value = profile.handle || "@sarmansinh";
  if (inTitle) inTitle.value = profile.title || "APPLICATION SECURITY RESEARCHER";
  if (inBio) inBio.value = profile.bio || DEFAULT_PROFILE.bio;
  if (inH1) inH1.value = profile.h1 || "";
  if (inBc) inBc.value = profile.bugcrowd || "";
}

function openProfileModal() {
  requireAuthor(() => {
    const modal = document.getElementById("profileModal");
    if (modal) modal.showModal();
  });
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.close();
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("profileNameInput").value.trim() || "SARMANSINH";
  const handle = document.getElementById("profileHandleInput").value.trim() || "@sarmansinh";
  const title = document.getElementById("profileTitleInput").value.trim();
  const bio = document.getElementById("profileBioInput").value.trim();
  const h1 = document.getElementById("profileH1Input").value.trim();
  const bugcrowd = document.getElementById("profileBcInput").value.trim();

  const profile = { name, handle, title, bio, h1, bugcrowd };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Failed to save profile:", err);
  }

  applyProfile(profile);
  closeProfileModal();
  showToast(`Profile updated: ${name}`);
}

// ==========================================================================
// IMAGE INSERTION & STEP SCREENSHOT TOOLBAR
// ==========================================================================
function openImageInserterModal() {
  const modal = document.getElementById("imageInserterModal");
  currentSelectedImageDataUrl = "";
  const fileInput = document.getElementById("stepImageFileInput");
  const urlInput = document.getElementById("stepImageUrlInput");
  const previewBox = document.getElementById("imagePreviewContainer");
  if (fileInput) fileInput.value = "";
  if (urlInput) urlInput.value = "";
  if (previewBox) previewBox.style.display = "none";
  if (modal) modal.showModal();
}

function closeImageInserterModal() {
  const modal = document.getElementById("imageInserterModal");
  if (modal) modal.close();
}

function handleImageFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    currentSelectedImageDataUrl = event.target.result;
    const previewImg = document.getElementById("imagePreviewImg");
    const previewBox = document.getElementById("imagePreviewContainer");
    if (previewImg && previewBox) {
      previewImg.src = currentSelectedImageDataUrl;
      previewBox.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
}

function confirmInsertStepImage() {
  const caption = document.getElementById("stepImageCaption").value.trim() || "Step Screenshot";
  const urlInput = document.getElementById("stepImageUrlInput").value.trim();
  const imgSource = currentSelectedImageDataUrl || urlInput;

  if (!imgSource) {
    alert("Please select an image file or enter an image URL.");
    return;
  }

  insertIntoContentTextarea(`\n\n![${caption}](${imgSource})\n\n`);
  closeImageInserterModal();
  showToast("Step screenshot inserted into write-up!");
}

function insertStepHeader() {
  const stepNum = prompt("Enter Step Title / Number:", "Step 2: Intercepting HTTP Request in Burp Suite");
  if (stepNum) {
    insertIntoContentTextarea(`\n\n### ${stepNum}\nDescribe the action taken and methodology in this step...\n\n`);
  }
}

function insertPocRequest() {
  insertIntoContentTextarea(`\n\n\`\`\`http
POST /api/v1/auth/exchange HTTP/1.1
Host: target.internal
Authorization: Bearer <token>
Content-Type: application/json

{"role": "user", "scope": "read"}
\`\`\`\n\n`);
}

function insertCodeBlockSnippet() {
  insertIntoContentTextarea(`\n\n\`\`\`python
# Exploit Script / Automation POC
import requests

res = requests.post("https://target.internal/api")
print(res.status_code, res.text)
\`\`\`\n\n`);
}

function insertCalloutBanner() {
  insertIntoContentTextarea(`\n\n> [!] **VULNERABILITY FINDING / FLAG**: Explain critical impact or token capture here.\n\n`);
}

function insertIntoContentTextarea(text) {
  const textarea = document.getElementById("formContent");
  if (!textarea) return;
  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + text + val.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function setupEditorDropAndPaste() {
  const textarea = document.getElementById("formContent");
  if (!textarea) return;

  textarea.addEventListener("paste", (e) => {
    const items = e.clipboardData ? e.clipboardData.items : [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          insertIntoContentTextarea(`\n\n![Pasted Step Screenshot](${event.target.result})\n\n`);
          showToast("Pasted screenshot embedded into write-up!");
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  textarea.addEventListener("dragover", (e) => e.preventDefault());

  textarea.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const caption = file.name ? file.name.replace(/\.[^/.]+$/, "") : "Step Screenshot";
          insertIntoContentTextarea(`\n\n![${caption}](${event.target.result})\n\n`);
          showToast("Dropped screenshot embedded into write-up!");
        };
        reader.readAsDataURL(file);
      }
    }
  });
}

// ==========================================================================
// IMAGE LIGHTBOX
// ==========================================================================
function openImageLightbox(src, caption) {
  const modal = document.getElementById("imageLightboxModal");
  const img = document.getElementById("lightboxImg");
  const cap = document.getElementById("lightboxCaption");
  if (!modal || !img) return;
  img.src = src;
  if (cap) cap.textContent = caption || "Step Screenshot Full View";
  modal.showModal();
}

function closeImageLightbox() {
  const modal = document.getElementById("imageLightboxModal");
  if (modal) modal.close();
}

// ==========================================================================
// MARKDOWN PARSER
// ==========================================================================
function parseSimpleMarkdown(md) {
  if (!md) return "";
  let html = escapeHtml(md);

  html = html.replace(/^### (Step \d+[:\s\w\-\.]*)/gim, '<div class="ctf-step-banner">$1</div>');
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gim, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const rawSrc = src.replace(/&amp;/g, "&");
    return `<figure class="article-image-figure">
      <img src="${rawSrc}" alt="${alt}" class="article-zoomable-img" onclick="openImageLightbox('${rawSrc}', '${alt}')" loading="lazy" />
      ${alt ? `<figcaption class="article-img-caption"><span class="caption-icon">//</span> <span>${alt}</span> <span class="click-zoom">[click to expand]</span></figcaption>` : ""}
    </figure>`;
  });

  html = html.replace(/\n\s*\n/g, "</p><p>");
  html = "<p>" + html + "</p>";

  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p><h/g, "<h");
  html = html.replace(/<\/h([1-6])><\/p>/g, "</h$1>");
  html = html.replace(/<p><pre>/g, "<pre>");
  html = html.replace(/<\/pre><\/p>/g, "</pre>");
  html = html.replace(/<p><blockquote>/g, "<blockquote>");
  html = html.replace(/<\/blockquote><\/p>/g, "</blockquote>");
  html = html.replace(/<p><figure/g, "<figure");
  html = html.replace(/<\/figure><\/p>/g, "</figure>");
  html = html.replace(/<p><div class="ctf-step-banner"/g, '<div class="ctf-step-banner"');
  html = html.replace(/<\/div><\/p>/g, "</div>");

  return html;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================================================
// SCROLL FADE-IN
// ==========================================================================
function setupScrollFadeIn() {
  const elements = document.querySelectorAll(".reveal-on-scroll, .stagger-parent");

  if (!("IntersectionObserver" in window)) {
    elements.forEach(el => el.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });

  elements.forEach(el => observer.observe(el));
}

// ==========================================================================
// INIT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadProfile();
  renderAuthLock();
  setupEventListeners();
  setupEditorDropAndPaste();
  setupScrollFadeIn();
  // Write-ups load through the onAuthStateChange listener at the top of this file
});