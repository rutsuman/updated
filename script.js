// ==============================================
// ==============================================
// ARTHEIM - STUDENT SCRIPT
// COMPLETE OPTIMIZED VERSION
// ==============================================
// ==============================================

// ==============================================
// SECTION 1: GLOBAL STATE & CACHE MANAGEMENT
// ==============================================

// --- Global State Object (NEW - For caching) ---
const AppState = {
    studentData: {
        completedQuests: null,
        questGrades: null,
        questAccepted: null,
        questStartTimes: null,
        earnedBadges: null,
        loaded: false,
        lastLoadTime: null
    },
    teacherData: {
        customTimers: {},
        classDuration: 75,
        loaded: false
    },
    questRelationships: {
        leadsTo: {},      // questId -> [questIds that have it as prerequisite]
        prerequisites: {} // questId -> [prerequisite questIds]
    },
    relationshipsBuilt: false
};

// --- Original Global Variables ---
let isAddingHotspots = false;
let rubricLocked = {};
let currentMap = "map1";
let completedQuests = loadQuestData();
let questGrades = loadQuestGrades() || {};
let currentQuestId = null;
let scale = 1;
let quests = {};
let questTimers = {};
let questStartTimes = loadQuestStartTimes();
let questAccepted = loadQuestAccepted();
let questRewards = loadQuestRewards() || {};
let studentWorks = loadStudentWorks();
let hotspotPositions = {};
let activeQuestId = null;
let badgesData = null;
let earnedBadges = loadEarnedBadges();
let isSaving = false;
let isLoadingFromCloud = false;
let currentTeacherName = null;
let currentTeacherFramework = 'ncas';
let pathfinderQuestions = null;
let allMVPQuests = null;
let currentPathfinderAnswers = {};
let helpModal = null;
let helpBtn = null;
let closeBtn = null;
let realtimeSubscription = null;
let seenNewQuests = loadSeenNewQuests();
let currentUserId = null;
let cachedQuests = null;
let cachedCustomTimer = null;
let cachedClassDuration = null;
let cachedTimerQuestId = null;
let _lastDisplayedTime = '';
let _lastActiveQuestId = null;
let _animationFrameId = null;
let isSavingWork = false;
let _lastUpdateTime = 0;
const QUEST_CACHE_VERSION = '2026-05-25-v1';
const QUEST_CACHE_KEY = 'cachedQuests';
const QUEST_CACHE_VERSION_KEY = 'cachedQuestsVersion';
const QUEST_CACHE_TIMESTAMP_KEY = 'cachedQuestsTimestamp';
const QUEST_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
let cachedScheduleData = {
    noClassDays: [],
    weekendSettings: { saturday_is_class: false, sunday_is_class: false },
    frequencyDays: []
};
let currentContestForSubmission = null;
window.raceJitterInterval = null;

// --- Cache Invalidation Functions (NEW) ---
function invalidateStudentDataCache() {
    AppState.studentData.loaded = false;
    AppState.studentData.lastLoadTime = null;
    console.log("Student data cache invalidated");
}

function invalidateTeacherDataCache() {
    AppState.teacherData.loaded = false;
    AppState.teacherData.customTimers = {};
    console.log("Teacher data cache invalidated");
}

function invalidateAllCaches() {
    invalidateStudentDataCache();
    invalidateTeacherDataCache();
    console.log("All caches invalidated");
}

// ==============================================
// SECTION 2: QUEST RELATIONSHIP BUILDER (NEW)
// ==============================================

function buildQuestRelationships() {
    if (AppState.relationshipsBuilt && Object.keys(AppState.questRelationships.leadsTo).length > 0) {
        return; // Already built
    }
    
    console.log("Building quest relationships...");
    const questKeys = Object.keys(quests);
    
    // Reset
    AppState.questRelationships.leadsTo = {};
    AppState.questRelationships.prerequisites = {};
    
    for (const questId of questKeys) {
        const quest = quests[questId];
        if (!quest) continue;
        
        // Store prerequisites
        if (quest.prerequisites && quest.prerequisites.length) {
            AppState.questRelationships.prerequisites[questId] = quest.prerequisites;
            
            // Build reverse lookup (leads to)
            for (const prereqId of quest.prerequisites) {
                if (!AppState.questRelationships.leadsTo[prereqId]) {
                    AppState.questRelationships.leadsTo[prereqId] = [];
                }
                if (!AppState.questRelationships.leadsTo[prereqId].includes(questId)) {
                    AppState.questRelationships.leadsTo[prereqId].push(questId);
                }
            }
        } else {
            AppState.questRelationships.prerequisites[questId] = [];
        }
    }
    
    AppState.relationshipsBuilt = true;
    console.log("Quest relationships built successfully");
}

// ==============================================
// SECTION 3: PREVENT HTML MISTAKES BY TEACHERS
// ==============================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==============================================
// SECTION 4: STANDARD/DOMAIN NAMES
// ==============================================

const STANDARD_NAMES = {
    "Art.FA.CR.1.1.IA": "Generate: Conceptualize artistic ideas",
    "Art.FA.CR.1.2.IA": "Practice: Organize and develop ideas",
    "Art.FA.CR.2.1.IA": "Explore: Refine artistic work",
    "Art.FA.CR.2.3.IA": "Transform: Document creative process",
    "Art.FA.CR.3.1.IA": "Reflect: Reflect on artistic process",
    "Art.FA.PR.6.1.IA": "Analyze: Convey meaning through presentation",
    "Art.FA.RE.8.1.8A": "Interpret: Interpret intent and meaning",
    "Art.FA.CN.10.1.IA": "Document: Synthesize and relate knowledge"
};
const STANDARD_SHORT_NAMES = {
    "Art.FA.CR.1.1.IA": "Generate",
    "Art.FA.CR.1.2.IA": "Practice",
    "Art.FA.CR.2.1.IA": "Explore",
    "Art.FA.CR.2.3.IA": "Transform",
    "Art.FA.CR.3.1.IA": "Reflect",
    "Art.FA.PR.6.1.IA": "Analyze",
    "Art.FA.RE.8.1.8A": "Interpret",
    "Art.FA.CN.10.1.IA": "Document"
};
const IB_CRITERIA_MAPPING = {
    "A": {
        name: "A: Knowing & Understanding",
        ncasStandards: ["Art.FA.CN.10.1.IA", "Art.FA.PR.6.1.IA"]
    },
    "B": {
        name: "B: Developing Skills", 
        ncasStandards: ["Art.FA.CR.1.2.IA", "Art.FA.CR.2.1.IA", "Art.FA.CR.2.3.IA"]
    },
    "C": {
        name: "C: Thinking Creatively",
        ncasStandards: ["Art.FA.CR.1.1.IA"]
    },
    "D": {
        name: "D: Responding",
        ncasStandards: ["Art.FA.CR.3.1.IA", "Art.FA.RE.8.1.8A"]
    }
};
const IB_BANDS = {
    "7-8": "Excellent (7-8)",
    "5-6": "Good (5-6)", 
    "3-4": "Satisfactory (3-4)",
    "1-2": "Limited (1-2)"
};
const IGCSE_MAPPING = {};

// ==============================================
// SECTION 5: ACTIVE QUEST FLOATING BUTTON
// ==============================================

function updateActiveQuestButton(timestamp) {
    if (document.hidden) {
        _animationFrameId = requestAnimationFrame(updateActiveQuestButton);
        return;
    }
    
    if (timestamp && timestamp - _lastUpdateTime < 1000) {
        _animationFrameId = requestAnimationFrame(updateActiveQuestButton);
        return;
    }
    _lastUpdateTime = timestamp || Date.now();
    
    const button = document.getElementById('floating-active-quest');
    const timerSpan = document.getElementById('active-quest-timer');
    
    if (!button || !timerSpan) {
        _animationFrameId = requestAnimationFrame(updateActiveQuestButton);
        return;
    }
    
    let activeQuestId = null;
    for (const [questId, isAccepted] of Object.entries(questAccepted)) {
        if (isAccepted === true && !completedQuests[questId]) {
            activeQuestId = questId;
            break;
        }
    }
    
    if (!activeQuestId) {
        if (button.style.display !== 'none') {
            button.style.display = 'none';
        }
        if (_animationFrameId) {
            cancelAnimationFrame(_animationFrameId);
            _animationFrameId = null;
        }
        return;
    }
    
    button.style.display = 'flex';
    button.dataset.questId = activeQuestId;
    
    const remaining = calculateRemainingMinutes(activeQuestId);
    const quest = quests[activeQuestId];
    
    let totalMinutes = quest?.timer?.allottedMinutes || 75;
    const customTimer = getCustomTimerForQuestSync(activeQuestId);
    const classDuration = getClassDurationSync();
    if (customTimer !== null) {
        totalMinutes = customTimer * classDuration;
    }
    
    let timeString;
    let warningClass = '';
    let timesUpClass = '';
    
    if (remaining <= 0) {
        timeString = '⏰ TIME UP!';
        timesUpClass = 'times-up';
    } else if ((remaining / totalMinutes) * 100 <= 30) {
        timeString = formatTime(remaining, true);
        warningClass = 'warning';
    } else {
        timeString = formatTime(remaining, true);
    }
    
    if (timeString !== _lastDisplayedTime) {
        timerSpan.textContent = timeString;
        _lastDisplayedTime = timeString;
    }
    
    button.classList.remove('warning', 'times-up');
    if (timesUpClass) button.classList.add(timesUpClass);
    if (warningClass) button.classList.add(warningClass);
    
    _animationFrameId = requestAnimationFrame(updateActiveQuestButton);
}

function setupActiveQuestButton() {
    const button = document.getElementById('floating-active-quest');
    if (!button) return;
    
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.addEventListener('click', function() {
        const questId = this.dataset.questId;
        if (questId) {
            const questOverlay = document.getElementById('quest-overlay');
            if (questOverlay) questOverlay.style.display = 'none';
            openQuest(questId);
        }
    });
}

function startActiveQuestTimerUpdates() {
    if (_animationFrameId) {
        cancelAnimationFrame(_animationFrameId);
        _animationFrameId = null;
    }
    _lastDisplayedTime = '';
    _lastUpdateTime = 0;
    updateActiveQuestButton(Date.now());
}

function stopActiveQuestTimerUpdates() {
    if (_animationFrameId) {
        cancelAnimationFrame(_animationFrameId);
        _animationFrameId = null;
    }
    _lastDisplayedTime = '';
}

// ==============================================
// SECTION 6: LOCAL STORAGE HELPERS
// ==============================================

function loadEarnedBadges() {
    const data = localStorage.getItem("earnedBadges");
    return data ? JSON.parse(data) : {};
}

function saveEarnedBadges() {
    localStorage.setItem("earnedBadges", JSON.stringify(earnedBadges));
}

function loadStudentWorks() {
    const data = localStorage.getItem("studentWorks");
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Error parsing studentWorks:", e);
            return {};
        }
    }
    return {};
}

function saveStudentWorks() {
    localStorage.setItem("studentWorks", JSON.stringify(studentWorks));
}

function loadSeenNewQuests() {
    const data = localStorage.getItem("seenNewQuests");
    return data ? JSON.parse(data) : [];
}

function saveSeenNewQuests() {
    localStorage.setItem("seenNewQuests", JSON.stringify(seenNewQuests));
}

// ==============================================
// SECTION 7: WORK OVERLAY SYSTEM
// ==============================================

function handlePreviewClick(e) {
    e.stopPropagation();
    const preview = document.getElementById("image-preview");
    if (!preview || !preview.src || preview.src === "") return;
    const overlay = document.getElementById("work-overlay");
    const questId = overlay?.dataset.questId;
    if (questId && studentWorks[questId]) {
        const work = studentWorks[questId];
        const quest = quests[questId];
        openFullscreenFromWork(work, quest);
    } else {
        openFullscreenImageSimple(preview.src);
    }
}

function saveWorkData() {
    // Prevent multiple simultaneous saves
    if (isSavingWork) {
        console.log("Save already in progress, ignoring duplicate call");
        return;
    }
    
    const overlay = document.getElementById("work-overlay");
    const questId = overlay.dataset.questId;
    
    if (!questId) {
        alert("Error: No quest associated with this work.");
        return;
    }

    // Check if this quest is already saved (prevent resubmission)
    if (studentWorks[questId] && studentWorks[questId].image && studentWorks[questId].image !== "pending") {
        const confirmResave = confirm("You have already saved work for this quest. Do you want to replace it?");
        if (!confirmResave) {
            return;
        }
    }

    const title = document.getElementById("work-title").value;
    const size = document.getElementById("work-size").value;
    const media = document.getElementById("work-media").value;
    const description = document.getElementById("work-description").value;
    const imageInput = document.getElementById("work-image");
    const imageFile = imageInput.files[0];
    
    // Validate required fields
    if (!title) {
        alert("Please enter a title for your work.");
        return;
    }
    
    if (!imageFile) {
        alert("Please upload an image of your work.");
        return;
    }
    
    // Check file size
    if (imageFile.size > 5 * 1024 * 1024) {
        alert("Image is very large (over 5MB). It will be compressed but may take a moment.");
    }
    
    // Set lock
    isSavingWork = true;
    
    const workData = {
        title: title,
        size: size,
        media: media,
        description: description,
        lastModified: new Date().toISOString()
    };
    
    // Store in local studentWorks
    studentWorks[questId] = {
        ...workData,
        image: "pending"
    };
    saveStudentWorks();
    
    // Show saving indicator
    const saveBtn = document.querySelector(".save-work");
    if (saveBtn) {
        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;
    }
    
    // Use a unique upload ID to prevent duplicates
    const uploadId = `${questId}_${Date.now()}`;
    
    saveWorkToCloud(questId, workData, imageFile, uploadId).then(async success => {
        if (saveBtn) {
            saveBtn.textContent = "Save";
            saveBtn.disabled = false;
        }
        
        // Release lock
        isSavingWork = false;
        
        if (success) {
            alert("🎨 Work saved successfully!");
            closeWorkOverlay();
            
            window._selfAssessmentPending = true;
            
            setTimeout(() => {
                openRubricPopup(questId, true);
            }, 400);
            
            const galleryOverlay = document.getElementById("gallery-overlay");
            if (galleryOverlay && galleryOverlay.style.display === "flex") {
                renderGalleryItems();
            }
        } else {
            alert("Work saved locally only. Please try saving to cloud again later.");
        }
    }).catch(err => {
        isSavingWork = false;
        if (saveBtn) {
            saveBtn.textContent = "Save";
            saveBtn.disabled = false;
        }
        alert("Error saving work. Please try again.");
        console.error("Save error:", err);
    });
}

async function deleteWorkImage() {
    const preview = document.getElementById("image-preview");
    const overlay = document.getElementById("work-overlay");
    const questId = overlay.dataset.questId;
    console.log("Deleting quest ID:", questId);
    if (!questId) {
        console.error("No quest ID found");
        return;
    }
    if (!confirm("Are you sure you want to delete this work completely? All title, description, and image will be removed.")) {
        return;
    }
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
        const { error } = await window.supabase
            .from('student_works')
            .delete()
            .eq('quest_id', questId)
            .eq('user_id', session.user.id);
        if (error) {
            console.error("Error deleting from cloud:", error);
            alert("Failed to delete from cloud");
            return;
        } else {
            console.log("Work deleted from cloud");
        }
    }
    if (studentWorks[questId]) {
        delete studentWorks[questId];
        console.log("Deleted from local studentWorks, now has:", Object.keys(studentWorks));
    }
    saveStudentWorks();
    await loadCloudWorksIntoGallery();
    if (preview) {
        preview.src = "";
        preview.style.display = "none";
    }
    document.getElementById("work-title").value = "";
    document.getElementById("work-size").value = "";
    document.getElementById("work-media").value = "";
    document.getElementById("work-description").value = "";
    const imageInput = document.getElementById("work-image");
    if (imageInput) {
        imageInput.value = "";
    }
    const galleryOverlay = document.getElementById("gallery-overlay");
    if (galleryOverlay && galleryOverlay.style.display === "flex") {
        await renderGalleryItems();
    }
    alert("Work deleted successfully!");
    closeWorkOverlay();
}

function initializeWorkOverlay() {
    const finishedWorkBtn = document.getElementById("finished-work-btn");
    if (finishedWorkBtn) {
        finishedWorkBtn.removeAttribute("onclick");
        finishedWorkBtn.addEventListener("click", function(e) {
            e.preventDefault();
            if (!currentQuestId) {
                alert("Please open a quest first to add your work.");
                return;
            }
            openWorkOverlay(currentQuestId);
        });
    } else {
        console.warn("Finished Work button not found in DOM");
    }
    const closeButtons = document.querySelectorAll("#work-overlay .close-overlay, #work-overlay button[onclick='closeWorkOverlay()']");
    closeButtons.forEach(btn => {
        btn.removeAttribute("onclick");
        btn.addEventListener("click", function(e) {
            e.preventDefault();
            closeWorkOverlay();
        });
    });
    const deleteBtn = document.getElementById("delete-work-image");
    if (deleteBtn) {
        deleteBtn.removeAttribute("onclick");
        deleteBtn.addEventListener("click", function(e) {
            e.preventDefault();
            deleteWorkImage();
        });
    }
    const imageInput = document.getElementById("work-image");
    if (imageInput) {
        imageInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert("File is too large. Please select an image under 5MB.");
                return;
            }
            if (!file.type.startsWith("image/")) {
                alert("Please select an image file.");
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.getElementById("image-preview");
                if (preview) {
                    preview.src = event.target.result;
                    preview.style.display = "block";
                }
            };
            reader.readAsDataURL(file);
        });
    }
    const saveBtn = document.querySelector(".save-work");
    if (saveBtn) {
        saveBtn.addEventListener("click", function(e) {
            e.preventDefault();
            saveWorkData();
        });
    }
}

function openFullscreenFromWork(work, quest) {
    const overlay = document.getElementById("fullscreen-image-overlay");
    const fullscreenImg = document.getElementById("fullscreen-image");
    const titleEl = document.getElementById("fullscreen-title");
    const detailsEl = document.getElementById("fullscreen-details");
    const descriptionEl = document.getElementById("fullscreen-description");
    if (!overlay || !fullscreenImg) return;
    fullscreenImg.src = work.image;
    titleEl.textContent = work.title || quest?.title || "Artwork";
    let details = [];
    if (quest && quest.title) details.push(`Quest: ${quest.title}`);
    if (work.size) details.push(`Size: ${work.size}`);
    if (work.media) details.push(`Media: ${work.media}`);
    if (work.lastModified) {
        const date = new Date(work.lastModified);
        details.push(`Last modified: ${date.toLocaleDateString()}`);
    }
    detailsEl.textContent = details.join(" • ");
    descriptionEl.textContent = work.description || (quest?.description ? `Quest: ${quest.description}` : "No description");
    overlay.style.display = "flex";
    overlay.currentWork = work;
    overlay.currentQuest = quest;
    const escHandler = function(e) {
        if (e.key === "Escape") {
            closeFullscreenImage();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
    overlay.escHandler = escHandler;
}

function openFullscreenImageSimple(imageSrc) {
    const overlay = document.getElementById("fullscreen-image-overlay");
    const fullscreenImg = document.getElementById("fullscreen-image");
    const titleEl = document.getElementById("fullscreen-title");
    const detailsEl = document.getElementById("fullscreen-details");
    const descriptionEl = document.getElementById("fullscreen-description");
    if (!overlay || !fullscreenImg) return;
    fullscreenImg.src = imageSrc;
    titleEl.textContent = "Image Preview";
    detailsEl.textContent = "";
    descriptionEl.textContent = "";
    overlay.style.display = "flex";
    const escHandler = function(e) {
        if (e.key === "Escape") {
            closeFullscreenImage();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
    overlay.escHandler = escHandler;
}

function closeWorkOverlay() {
    const overlay = document.getElementById("work-overlay");
    if (overlay) overlay.style.display = "none";
}

// ==============================================
// SECTION 8: TEACHER FRAMEWORK DETECTION
// ==============================================

async function detectTeacherFramework() {
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) {
        console.log("No teacher_code found, using NCAS");
        return 'ncas';
    }
    const { data: teacher, error } = await window.supabase
        .from('teachers')
        .select('framework')
        .eq('class_code', profile.teacher_code)
        .single();
    if (error || !teacher) {
        console.log("Teacher not found or no framework set, using NCAS");
        return 'ncas';
    }
    console.log("Teacher framework detected:", teacher.framework);
    return teacher.framework || 'ncas';
}

function getQuestsFileForFramework(framework) {
    switch(framework) {
        case 'ib-myp':
            return 'quests-ib-myp.json';
        case 'igcse':
            return 'quests-igcse.json';
        default:
            return 'quests.json';
    }
}

// ==============================================
// SECTION 9: NEW QUEST ANNOUNCEMENT SYSTEM
// ==============================================

function findNewQuests() {
    if (!quests || Object.keys(quests).length === 0) {
        return [];
    }
    const allQuestIds = Object.keys(quests);
    const newQuests = allQuestIds.filter(questId => !seenNewQuests.includes(questId));
    return newQuests;
}

function showNewQuestOverlay(newQuestIds) {
    const overlay = document.getElementById("new-quest-overlay");
    const listElement = document.getElementById("new-quest-list");
    if (!overlay || !listElement) {
        console.error("New quest overlay elements not found");
        return;
    }
    listElement.innerHTML = "";
    newQuestIds.forEach(questId => {
        const quest = quests[questId];
        if (!quest) return;
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = quest.title || questId;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            overlay.style.display = "none";
            setTimeout(() => {
                openQuest(questId);
            }, 100);
        });
        li.appendChild(link);
        listElement.appendChild(li);
    });
    overlay.style.display = "flex";
    newQuestIds.forEach(questId => {
        if (!seenNewQuests.includes(questId)) {
            seenNewQuests.push(questId);
        }
    });
    saveSeenNewQuests();
}

function checkForNewQuests() {
    if (!quests || Object.keys(quests).length === 0) {
        setTimeout(checkForNewQuests, 1000);
        return;
    }
    const newQuests = findNewQuests();
    if (newQuests.length > 0) {
        showNewQuestOverlay(newQuests);
    }
}

function initializeNewQuestSystem() {
    const closeBtn = document.getElementById("close-new-quest");
    const continueBtn = document.getElementById("new-quest-continue");
    const overlay = document.getElementById("new-quest-overlay");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            overlay.style.display = "none";
        });
    }
    if (continueBtn) {
        continueBtn.addEventListener("click", () => {
            overlay.style.display = "none";
        });
    }
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.style.display = "none";
            }
        });
    }
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay && overlay.style.display === "flex") {
            overlay.style.display = "none";
        }
    });
}

// ==============================================
// SECTION 10: STUDENT PROFILE
// ==============================================

function saveStudentProfile(profile) {
    localStorage.setItem("studentProfile", JSON.stringify(profile));
}

function loadStudentProfile() {
    const data = localStorage.getItem("studentProfile");
    return data ? JSON.parse(data) : null;
}

function updateProfileUI() {
    const profile = loadStudentProfile();
    if (!profile) return;
    const avatar = document.getElementById("student-avatar");
    const name = document.getElementById("student-name");
    const profileBtn = document.querySelector(".profile-btn"); 
    const profileBtnImg = profileBtn ? profileBtn.querySelector("img") : null;
    if (avatar) avatar.src = profile.character;
    if (name) name.innerText = profile.name;
    if (profileBtnImg) {
        profileBtnImg.src = profile.character;
    }
}

function debugStudentProfile() {
    const profile = loadStudentProfile();
    console.log("=== STUDENT PROFILE DEBUG ===");
    console.log("Full profile:", profile);
    console.log("teacher_code:", profile?.teacher_code);
    console.log("name:", profile?.name);
    console.log("==============================");
}

// ==============================================
// SECTION 11: LOGIN / LOGOUT
// ==============================================

async function handleLoginSubmit() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const messageEl = document.getElementById("login-message");
    if (!email || !password) {
        if (messageEl) messageEl.textContent = "Please enter email and password";
        return;
    }
    if (messageEl) messageEl.textContent = "Logging in...";
    const { data, error } = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) {
        if (messageEl) messageEl.textContent = error.message;
        return;
    }
    const { data: profile, error: profileError } = await window.supabase
        .from('profiles')
        .select('grade_level')
        .eq('id', data.user.id)
        .single();
    if (profileError) {
        if (messageEl) messageEl.textContent = 'Error checking student profile';
        return;
    }
    if (profile?.grade_level === 'ms') {
        messageEl.textContent = 'This is the High School portal. Please use the Middle School portal.';
        await window.supabase.auth.signOut();
        setTimeout(() => {
            window.location.href = 'ms-index.html';
        }, 1500);
        return;
    }
    currentUserId = data.user.id;
    document.getElementById("welcome-overlay").style.display = "none";
    await checkQuestCacheValidity();
    if (!quests || Object.keys(quests).length === 0) {
        messageEl.textContent = "Loading quests...";
        await new Promise((resolve) => {
            const checkQuests = setInterval(() => {
                if (quests && Object.keys(quests).length > 0) {
                    clearInterval(checkQuests);
                    resolve();
                }
            }, 100);
        });
    }
    messageEl.textContent = "Loading your data...";
    await loadStudentDataFromCloud();
    await loadScheduleForStudent();
    updateProfileUI();
    checkForNewQuests();
    startActiveQuestTimerUpdates();
    setTimeout(() => {
        setupRealtimeRefresh();
    }, 1000);
}

async function logout() {
    console.log("Logout started...");
    stopActiveQuestTimerUpdates();
    try {
        const { error } = await window.supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            alert("Logout failed: " + error.message);
            return;
        }
        localStorage.removeItem('sb-qzxvwoyigrrpdywvhckk-auth-token');
        localStorage.clear();
        completedQuests = {};
        questGrades = {};
        studentWorks = {};
        questRewards = {};
        rubricLocked = {};
        questAccepted = {};
        questStartTimes = {};
        earnedBadges = {};
        invalidateAllCaches();
        console.log("Logged out successfully - all data cleared");
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (err) {
        console.error("Unexpected error during logout:", err);
    }
}

// ==============================================
// SECTION 12: MAP CONFIG & HELPERS
// ==============================================

const MAPS = {
    map1: { image: "map.jpg" },
    map2: { image: "map2.jpg" },
    map3: { image: "map3.jpg" }
};

function getMapForQuest(questId) {
    const hotspot = document.querySelector(`.hotspot[data-city="${questId}"]`);
    return hotspot ? hotspot.dataset.map : null;
}

// ==============================================
// SECTION 13: SUMMATIVE PATH MENU
// ==============================================

const pathQuests = {
    paintersPath: [
        { title: "Trial of the Modern Masters", id: "quest4", style: "mvp" },
        { title: "Duel of the Silent Master", id: "quest11", style: "mvp" },
        { title: "The Beast of the Borderlands", id: "quest35", style: "mvp" },
        { title: "Chaos Sealed in Color", id: "quest36", style: "mvp" },
        { title: "Bastions of Light and Stone", id: "quest66", style: "mvp" },
        { title: "The Painted Visage", id: "quest69", style: "mvp" },
        { title: "The Tones of the Abyss", id: "quest80", style: "mvp" },
    ],
    sketcherPath: [
        { title: "The Threat of the East", id: "quest30", style: "mvp" },
        { title: "The Master's Table", id: "quest41", style: "mvp" },
        { title: "The Scroll of Unwritten Fates", id: "quest72", style: "mvp" },
        { title: "The Fashionista's Sketchbook", id: "quest75", style: "mvp" },
        { title: "The Mirror of the Soul-Eater", id: "quest78", style: "mvp" },
        { title: "The Beast of Thornhollow", id: "quest79", style: "mvp" },
    ],
    watercoloursPath: [
        { title: "The Silent Objects Trial", id: "quest16", style: "mvp" },
        { title: "Chronicle of Living Stone", id: "quest25", style: "mvp" },
        { title: "The Elven Vista Trial", id: "quest17", style: "mvp" },
        { title: "Legacy of Azure and Verdant Peaks", id: "quest50", style: "mvp" },
        { title: "Duel with Loki, The Trickster", id: "quest27", style: "mvp" },
    ],
    "3DPath": [
        { title: "The face stealer", id: "quest53", style: "mvp" },
        { title: "The Necklace of the Desert Moon", id: "quest54", style: "mvp" },
        { title: "The Story Tile of the Hearth", id: "quest56", style: "mvp" },
        { title: "The Bound Spirit", id: "quest57", style: "mvp" },
        { title: "The Citadel of Forms", id: "quest58", style: "mvp" },
        { title: "The Master Forgemaster’s Covenant", id: "quest68", style: "mvp" },
        { title: "The Animist's Awakening", id: "quest70", style: "mvp" },
        { title: "The Dreamweaver's Gambit", id: "quest71", style: "mvp" },
        { title: "The Sculptor's Menagerie", id: "quest76", style: "mvp" },
        { title: "The Weaver's Legacy", id: "quest77", style: "mvp" },
    ]
};

// ==============================================
// SECTION 14: HOTSPOT POSITIONING
// ==============================================

function initializeHotspotPositions() {
    document.querySelectorAll(".hotspot").forEach(hotspot => {
        const id = hotspot.dataset.city;
        const left = hotspot.style.left || hotspot.dataset.left;
        const top = hotspot.style.top || hotspot.dataset.top;
        if (left && top) {
            hotspotPositions[id] = { left: left, top: top };
        }
    });
    if (Object.keys(hotspotPositions).length === 0) {
        calculateHotspotPositions();
    }
}

function calculateHotspotPositions() {
    const mapImage = document.getElementById("map-image");
    const mapContainer = document.getElementById("map-container");
    if (!mapImage || !mapContainer) return;
    if (!mapImage.complete) {
        mapImage.onload = () => calculateHotspotPositions();
        return;
    }
    const mapRect = mapImage.getBoundingClientRect();
    const containerRect = mapContainer.getBoundingClientRect();
    document.querySelectorAll(".hotspot").forEach(hotspot => {
        const id = hotspot.dataset.city;
        const rect = hotspot.getBoundingClientRect();
        const leftPercent = ((rect.left + rect.width/2 - mapRect.left) / mapRect.width) * 100;
        const topPercent = ((rect.top + rect.height/2 - mapRect.top) / mapRect.height) * 100;
        hotspotPositions[id] = {
            left: `${leftPercent}%`,
            top: `${topPercent}%`
        };
    });
}

function updateHotspotPositions() {
    const mapImage = document.getElementById("map-image");
    const mapContainer = document.getElementById("map-container");
    const floatingNav = document.getElementById("floating-nav");
    if (!mapImage || !mapContainer) return;
    const mapRect = mapImage.getBoundingClientRect();
    const containerRect = mapContainer.getBoundingClientRect();
    const mapScale = scale || 1;
    document.querySelectorAll(".hotspot").forEach(hotspot => {
        const id = hotspot.dataset.city;
        const mapAttr = hotspot.dataset.map;
        const position = hotspotPositions[id];
        if (position) {
            hotspot.style.left = position.left;
            hotspot.style.top = position.top;
            hotspot.style.transform = `translate(-50%, -50%) scale(${mapScale})`;
            hotspot.style.display = mapAttr === currentMap ? "block" : "none";
            hotspot.style.zIndex = "1000";
        }
    });
}

// ==============================================
// SECTION 15: FLOATING NAVIGATION
// ==============================================

function initializeFloatingNavigation() {
    const floatingGallery = document.getElementById("floating-gallery");
    if (floatingGallery) {
        floatingGallery.addEventListener("click", () => {
            openGallery();
        });
    }
}

// ==============================================
// SECTION 16: BIND HOTSPOTS
// ==============================================

function bindHotspots() {
    document.querySelectorAll(".hotspot").forEach(hotspot => {
        const cityId = hotspot.dataset.city;
        if (cityId.startsWith('custom_')) {
            console.log("FOUND CUSTOM QUEST HOTSPOT:", cityId);
            hotspot.addEventListener("click", () => {
                console.log("Custom quest clicked:", cityId);
                openQuest(cityId);
            });
        } else if (quests[cityId]?.style === "mvp") {
            hotspot.classList.add("mvp-hotspot");
            hotspot.addEventListener("click", () => {
                if (MAPS[cityId]) {
                    switchMap(cityId);
                } else {
                    openQuest(cityId);
                }
            });
        } else {
            hotspot.addEventListener("click", () => {
                if (MAPS[cityId]) {
                    switchMap(cityId);
                } else {
                    openQuest(cityId);
                }
            });
        }
    });
}

// ==============================================
// SECTION 17: SWITCH MAP & HOTSPOT VISIBILITY
// ==============================================

function updateHotspotVisibility() {
    console.log("updateHotspotVisibility called, currentMap:", currentMap);
    updateHotspotPositions();
    document.querySelectorAll(".hotspot").forEach(hotspot => {
        const hotspotMap = hotspot.getAttribute('data-map');
        const cityId = hotspot.getAttribute('data-city');
        if (hotspot.classList.contains('custom-quest-hotspot')) {
            console.log("Custom hotspot:", cityId, "hotspotMap:", hotspotMap, "currentMap:", currentMap);
            hotspot.style.display = currentMap === "map2" ? "block" : "none";
        } else {
            hotspot.style.display = hotspotMap === currentMap ? "block" : "none";
        }
    });
    const floatingNav = document.getElementById("floating-nav");
    if (floatingNav) {
        floatingNav.style.display = "flex";
    }
    if (currentMap === 'map2') {
        const existingCustomHotspots = document.querySelectorAll('.hotspot.custom-quest-hotspot');
        if (existingCustomHotspots.length === 0) {
            console.log("No custom hotspots found on map2, adding them...");
            addCustomQuestHotspots();
        }
    }
}

function switchMap(mapId, keepQuestOpen = false) {
    if (!MAPS[mapId]) return;
    currentMap = mapId;
    const mapImage = document.getElementById("map-image");
    mapImage.src = MAPS[mapId].image;
    mapImage.onload = () => {
        updateHotspotPositions();
        checkAllQuestWarnings();
        updateHotspotVisibility();
        if (mapId === 'map2') {
            addCustomQuestHotspots();
        }
        if (!keepQuestOpen) {
            closeQuest();
        }
    };
    const mapSelector = document.getElementById("map-selector");
    if (mapSelector) mapSelector.value = mapId;
}


// ==============================================
// SECTION 18: OPEN QUEST (OPTIMIZED - INSTANT)
// ==============================================

async function openQuest(cityId) {
    // Build quest relationships once (synchronous, cheap after first call)
    buildQuestRelationships();
    
    if (cityId === "gallery") {
        openGallery();
        return;
    }
    
    const quest = quests[cityId];
    if (!quest) return;

    // Switch map if needed (synchronous trigger; image loads in background)
    const mapId = getMapForQuest(cityId);
    if (mapId && mapId !== currentMap) {
        switchMap(mapId, true);
    }

    currentQuestId = cityId;
    const questBox = document.getElementById("quest-box");
    questBox.className = "";
    questBox.classList.remove("custom-quest");
    if (quest.teacher_quest === true || quest.is_custom === true) {
        questBox.classList.add("custom-quest");
    }
    if (quest.style) questBox.classList.add(quest.style);
    if (completedQuests[cityId]) questBox.classList.add("completed");

    // ===== RENDER EVERYTHING SYNCHRONOUSLY FROM MEMORY (instant) =====
    document.getElementById("quest-title").innerText = quest.title || "";
    document.getElementById("quest-rationale").innerHTML = `<a href="#" onclick="openRationalePopup('${cityId}')">Rationale</a>`;
    document.getElementById("quest-text").innerText = quest.description || "";
    document.getElementById("quest-character").src = quest.character || "";
    document.getElementById("quest-rubric").innerHTML = `<a href="#" onclick="openRubricPopup('${cityId}')">Rubric</a>`;

    const rewardCoins = calculateQuestRewardCoins(cityId);
    questRewards[cityId] = rewardCoins;
    document.getElementById("quest-reward").innerHTML = rewardCoins ? `<strong>${rewardCoins} 💰</strong>` : "—";
    updateProfileRewards();
    
    const pathContainer = document.getElementById("quest-paths");
    if (pathContainer) {
        pathContainer.innerHTML = Array.isArray(quest.path) && quest.path.length ? quest.path.join(", ") : "No path assigned";
    }

    // Prerequisites (from pre-built cache)
    const prereqContainer = document.getElementById("quest-prereq-leads-prereq");
    if (prereqContainer) {
        const prereqIds = AppState.questRelationships.prerequisites[cityId] || [];
        if (prereqIds && prereqIds.length) {
            prereqContainer.innerHTML = prereqIds.map(id => {
                const completed = completedQuests[id] ? '<span class="prereq-check"> ✔</span>' : '';
                const questTitle = quests[id]?.title || id;
                return `<li><a href="#" onclick="openQuest('${id}')">${questTitle}</a>${completed}</li>`;
            }).join('');
        } else {
            prereqContainer.innerHTML = "<li>None</li>";
        }
    }

    // Timer controls (SYNCHRONOUS — uses cached values only)
    setupTimerControlsSync(cityId);

    const reqBox = document.getElementById("quest-requirements");
    if (reqBox) {
        reqBox.innerHTML = "";
        if (Array.isArray(quest.requirements)) {
            const ul = document.createElement("ul");
            quest.requirements.forEach(r => { const li = document.createElement("li"); li.textContent = r; ul.appendChild(li); });
            reqBox.appendChild(ul);
        }
    }

    const linksEl = document.getElementById("quest-links");
    if (linksEl) {
        linksEl.innerHTML = Array.isArray(quest.links)
            ? quest.links.map((l,i) => `<li><a href="${l.url || '#'}" target="_blank">${l.type || 'Sample'} ${i+1}</a></li>`).join("")
            : "";
    }

    const starsContainer = document.querySelector("#quest-box .difficulty .stars");
    if (starsContainer) {
        starsContainer.innerHTML = "";
        const difficulty = quest.difficulty || 0;
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement("span");
            star.className = i <= difficulty ? "star solid" : "star outline";
            star.innerText = "★";
            starsContainer.appendChild(star);
        }
    }

    // "Leads to" (from pre-built cache)
    const leadsContainer = document.getElementById("quest-prereq-leads-to");
    if (leadsContainer) {
        const leads = AppState.questRelationships.leadsTo[cityId] || [];
        if (leads.length > 0) {
            leadsContainer.innerHTML = leads.map(id => {
                const completed = completedQuests[id] ? '<span class="prereq-check"> ✔</span>' : '';
                const questTitle = quests[id]?.title || id;
                return `<li><a href="#" onclick="openQuest('${id}')">${questTitle}</a>${completed}</li>`;
            }).join('');
        } else {
            leadsContainer.innerHTML = "<li>None</li>";
        }
    }
    
    // Restricted elements (SYNCHRONOUS)
    updateRestrictedElementsVisibilitySync(cityId);
    
    // ===== SHOW OVERLAY IMMEDIATELY =====
    document.getElementById("quest-overlay").style.display = "block";
    
    // ===== BACKGROUND WORK (doesn't block UI) =====
    const isDataFresh = AppState.studentData.loaded && 
                        (Date.now() - AppState.studentData.lastLoadTime < 5000);
    
    if (!isDataFresh) {
        loadStudentDataFromCloud(false)
            .then(() => {
                // Refresh restricted elements in case accepted status changed
                updateRestrictedElementsVisibilitySync(cityId);
                setupTimerControlsSync(cityId);
            })
            .catch(err => console.error("Background student data load error:", err));
    }
    
    // Only fetch timer values if not cached
    if (cachedTimerQuestId !== cityId || cachedClassDuration === null) {
        cacheTimerValuesForQuest(cityId)
            .then(() => {
                // Update timer once data is ready
                if (currentQuestId === cityId) {
                    setupTimerControlsSync(cityId);
                    updateTimerDisplay(cityId);
                }
            })
            .catch(err => console.error("Background timer cache error:", err));
    } else {
        // Already cached - just make sure display is fresh
        updateTimerDisplay(cityId);
    }
}

// ==============================================
// SECTION 19: QUEST COMPLETION & DATA
// ==============================================

function markQuestCompleteFromWork(questId) {
    const quest = quests[questId];
    if (!quest) return;
    completedQuests[questId] = true;
    if (activeQuestId === questId) {
        activeQuestId = null;
        if (questAccepted[questId]) {
            questAccepted[questId] = false;
            saveQuestAccepted();
        }
    }
    updateActiveQuestButton();
    stopActiveQuestTimerUpdates();
    updateBadgesAfterQuest();
    if (currentQuestId === questId) {
        const questBox = document.getElementById("quest-box");
        if (questBox) questBox.classList.add("completed");
        const questCheck = document.getElementById("quest-check");
        if (questCheck) questCheck.checked = true;
        const timerDisplay = document.getElementById("timer-display");
        if (timerDisplay) timerDisplay.textContent = "Completed";
    }
    saveQuestData();
    if (questAccepted[questId]) {
        stopQuestTimer(questId);
        questAccepted[questId] = false;
        saveQuestAccepted();
    }
    // Invalidate cache after completion
    invalidateStudentDataCache();
}

function saveQuestData() { 
    localStorage.setItem("completedQuests", JSON.stringify(completedQuests)); 
}

function loadQuestData() { 
    const saved = localStorage.getItem("completedQuests"); 
    return saved ? JSON.parse(saved) : {}; 
}

function saveQuestGrades() {
    localStorage.setItem("questGrades", JSON.stringify(questGrades));
}

function loadQuestGrades() {
    const data = localStorage.getItem("questGrades");
    return data ? JSON.parse(data) : {};
}

function saveQuestRewards() {
    localStorage.setItem("questRewards", JSON.stringify(questRewards));
}

function loadQuestRewards() {
    const data = localStorage.getItem("questRewards");
    return data ? JSON.parse(data) : {};
}

function saveQuestAccepted() {
    localStorage.setItem("questAccepted", JSON.stringify(questAccepted));
    autoSaveToCloud();
}

function loadQuestAccepted() {
    const data = localStorage.getItem("questAccepted");
    return data ? JSON.parse(data) : {};
}

function saveQuestStartTimes() {
    localStorage.setItem("questStartTimes", JSON.stringify(questStartTimes));
    autoSaveToCloud();
}

function loadQuestStartTimes() {
    const data = localStorage.getItem("questStartTimes");
    return data ? JSON.parse(data) : {};
}

function saveRubricLocks() {
    localStorage.setItem("rubricLocked", JSON.stringify(rubricLocked));
}

// ==============================================
// SECTION 20: CLOSE QUEST
// ==============================================

function closeQuest() {
    if (currentQuestId && questTimers[currentQuestId]) {
        stopQuestTimer(currentQuestId);
    }
    document.getElementById("quest-overlay").style.display = "none";
    const pathSel = document.getElementById("path-selector");
    const mvpSel = document.getElementById("mvp-quests");
    if (pathSel) pathSel.value = "";
    if (mvpSel) {
        mvpSel.style.display = "none";
        mvpSel.innerHTML = '<option value="">Select MVP Quest</option>';
    }
}

// ==============================================
// SECTION 21: FORGOT PASSWORD
// ==============================================

function setupForgotPassword() {
    const forgotLink = document.getElementById('forgot-password-link');
    const modal = document.getElementById('forgot-password-modal');
    const cancelBtn = document.getElementById('reset-cancel-btn');
    const submitBtn = document.getElementById('reset-submit-btn');
    const emailInput = document.getElementById('reset-email-input');
    const messageDiv = document.getElementById('reset-message');
    if (!forgotLink) return;
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
        emailInput.value = '';
        messageDiv.innerHTML = '';
    });
    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
            messageDiv.innerHTML = 'Please enter your email address.';
            messageDiv.style.color = '#ff8888';
            return;
        }
        messageDiv.innerHTML = 'Sending reset link...';
        messageDiv.style.color = '#ffd700';
        const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });
        if (error) {
            messageDiv.innerHTML = error.message;
            messageDiv.style.color = '#ff8888';
        } else {
            messageDiv.innerHTML = 'Reset link sent! Check your email.';
            messageDiv.style.color = '#4caf50';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ==============================================
// SECTION 22: INVITATION HANDLING
// ==============================================

async function checkForInvitation() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (!inviteToken) return null;
    const { data: invitation, error } = await window.supabase
        .from('student_invitations')
        .select('*')
        .eq('token', inviteToken)
        .eq('used', false)
        .single();
    if (error || !invitation) {
        console.log("Invalid or expired invitation token");
        return null;
    }
    if (new Date(invitation.expires_at) < new Date()) {
        console.log("Invitation has expired");
        return null;
    }
    return invitation;
}

async function applyInvitationToForm() {
    const invitation = await checkForInvitation();
    if (invitation) {
        const teacherCodeInput = document.getElementById('student-teacher-code');
        if (teacherCodeInput) {
            teacherCodeInput.value = invitation.teacher_code;
            teacherCodeInput.disabled = true;
            teacherCodeInput.style.opacity = '0.7';
            const note = document.createElement('p');
            note.style.color = '#4caf50';
            note.style.fontSize = '12px';
            note.style.marginTop = '5px';
            note.innerHTML = '✓ Invitation verified! Your teacher code has been auto-filled.';
            teacherCodeInput.parentNode.insertBefore(note, teacherCodeInput.nextSibling);
        }
    }
}

async function markInvitationAsUsed(invitationToken) {
    if (!invitationToken) return;
    await window.supabase
        .from('student_invitations')
        .update({ used: true })
        .eq('token', invitationToken);
}

// ==============================================
// SECTION 23: STUDENT SETUP (CHARACTERS)
// ==============================================

let characters = [];

function initializeStudentSetup() {
    const profile = loadStudentProfile();
    if (profile && profile.name) {
        updateProfileUI();
        return;
    }
    showWelcomeOverlay();
}

function showWelcomeOverlay() {
    const welcomeOverlay = document.getElementById("welcome-overlay");
    if (welcomeOverlay) welcomeOverlay.style.display = "flex";
}

function showStudentSetupOverlay() {
    const overlay = document.getElementById("student-setup-overlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    applyInvitationToForm();
    const submitBtn = document.getElementById("student-create-account-btn");
    const nameInput = document.getElementById("student-name-input");
    const emailInput = document.getElementById("student-email-input");
    const passwordInput = document.getElementById("student-password-input");
    const confirmPasswordInput = document.getElementById("student-confirm-password-input");
    const teacherCodeInput = document.getElementById("student-teacher-code");
    const characterDiv = document.getElementById("character-selection");
    const charactersList = document.getElementById("characters-list");

    if (!submitBtn || !nameInput || !emailInput || !passwordInput || !confirmPasswordInput || !teacherCodeInput) return;

    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    
    newSubmitBtn.addEventListener("click", async () => {
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const teacherCode = teacherCodeInput.value.trim();
        const messageEl = document.getElementById("setup-message");
        
        if (!name || !email || !password || !confirmPassword) {
            if (messageEl) messageEl.textContent = "Please fill in all fields";
            return;
        }
        if (password.length < 6) {
            if (messageEl) messageEl.textContent = "Password must be at least 6 characters";
            return;
        }
        if (password !== confirmPassword) {
            if (messageEl) messageEl.textContent = "Passwords do not match";
            return;
        }
        if (!teacherCode) {
            if (messageEl) messageEl.textContent = "Please enter your teacher code";
            return;
        }

        const { data: teacherData, error: teacherError } = await window.supabase
            .from('teachers')
            .select('id, class_code, max_students')
            .eq('class_code', teacherCode)
            .single();

        if (teacherError || !teacherData) {
            if (messageEl) messageEl.textContent = "Invalid teacher code. Please ask your teacher for the correct code.";
            return;
        }

        const { data: canAdd, error: canAddError } = await window.supabase
            .rpc('can_add_student', { teacher_code_param: teacherCode });

        if (canAddError) {
            console.error("Error checking student capacity:", canAddError);
        } else if (!canAdd) {
            const maxStudents = teacherData.max_students || 50;
            if (messageEl) {
                messageEl.textContent = `This teacher has reached the maximum of ${maxStudents} students. Please contact your teacher.`;
                messageEl.style.color = '#000000';
            }
            return;
        }
        const teacherId = teacherData.id;

        if (messageEl) messageEl.textContent = "Creating account...";
        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { display_name: name } }
        });
        if (error) {
            if (messageEl) messageEl.textContent = error.message;
            return;
        }
        const { error: profileError } = await window.supabase
            .from('profiles')
            .upsert({
                id: data.user.id,
                name: name,
                avatar_url: "profile.png",
                email: email,
                teacher_id: teacherId,
                teacher_code: teacherCode
            });
        if (profileError) console.error("Error saving profile:", profileError);
        const profile = { name: name, character: "profile.png" };
        saveStudentProfile(profile);
        updateProfileUI();
        const { error: loginError } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (loginError) {
            if (messageEl) messageEl.textContent = "Account created! Please login.";
            setTimeout(() => {
                showWelcomeOverlay();
                document.getElementById("login-email").value = email;
            }, 2000);
            return;
        }
        nameInput.disabled = true;
        emailInput.disabled = true;
        passwordInput.disabled = true;
        confirmPasswordInput.disabled = true;
        teacherCodeInput.disabled = true;
        newSubmitBtn.style.display = "none";
        if (characterDiv) characterDiv.style.display = "block";
        loadCharacterSelectionForProfile(charactersList);
    });

    fetch("characters/characters.json")
        .then(res => res.json())
        .then(data => {
            characters = data.characters || [];
            if (charactersList) charactersList.innerHTML = "";
            characters.forEach(char => {
                const card = document.createElement("div");
                card.className = "character-card";
                card.innerHTML = `<img src="${char.image}" alt="${char.name}" /><div class="character-name">${char.name}</div>`;
                card.addEventListener("click", () => selectCharacter(char));
                if (charactersList) charactersList.appendChild(card);
            });
        });
}

async function selectCharacter(character) {
    const nameInput = document.getElementById("student-name-input");
    const teacherCodeInput = document.getElementById("student-teacher-code");
    const name = nameInput ? nameInput.value.trim() : "";
    const teacherCode = teacherCodeInput ? teacherCodeInput.value.trim() : "";
    if (!teacherCode) {
        alert("Please enter your teacher code before selecting a character.");
        return;
    }
    const profile = {
        name: name,
        character: character.image,
        teacher_code: teacherCode,
        class_id: null
    };
    saveStudentProfile(profile);
    updateProfileUI();
    await loadTeacherNameForProfile();
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
        await window.supabase
            .from('profiles')
            .upsert({
                id: session.user.id,
                name: name,
                avatar_url: character.image,
                email: session.user.email,
                teacher_code: teacherCode,
                class_id: null
            });
    }
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken) {
        await markInvitationAsUsed(inviteToken);
    }
    const setupOverlay = document.getElementById("student-setup-overlay");
    if (setupOverlay) setupOverlay.style.display = "none";
}

// ==============================================
// SECTION 24: CLOUD SAVE/LOAD FUNCTIONS (OPTIMIZED)
// ==============================================

async function saveStudentDataToCloud() {
    if (isLoadingFromCloud) {
        console.log("Skipping save - currently loading from cloud");
        return false;
    }
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        console.log("Not logged in, skipping cloud save");
        return false;
    }
    const userId = session.user.id;
    const studentData = {
        user_id: userId,
        quest_accepted: questAccepted,
        quest_start_times: questStartTimes,
        updated_at: new Date().toISOString()
    };
    console.log("Student saving ONLY timer data to cloud:", {
        acceptedCount: Object.keys(questAccepted).length
    });
    const { error } = await window.supabase
        .from('student_progress') 
        .upsert(studentData, { onConflict: 'user_id' });
    if (error) {
        console.error("Error saving to cloud:", error);
        return false;
    }
    console.log("Timer data saved to cloud successfully");
    return true;
}

async function loadStudentDataFromCloud(forceRefresh = false) {
    // --- OPTIMIZATION: Check cache first ---
    if (!forceRefresh && AppState.studentData.loaded && AppState.studentData.lastLoadTime) {
        const cacheAge = Date.now() - AppState.studentData.lastLoadTime;
        // Cache for 5 seconds - enough to prevent repeated loads during quest openings
        if (cacheAge < 5000) {
            console.log("Using cached student data (age: " + cacheAge + "ms)");
            // Restore data from cache to global variables
            completedQuests = AppState.studentData.completedQuests || {};
            questGrades = AppState.studentData.questGrades || {};
            questAccepted = AppState.studentData.questAccepted || {};
            questStartTimes = AppState.studentData.questStartTimes || {};
            earnedBadges = AppState.studentData.earnedBadges || {};
            // Also restore self-assessments from cache
            if (AppState.studentData.selfAssessments) {
                window.selfAssessments = AppState.studentData.selfAssessments;
            }
            return true;
        }
    }

    isLoadingFromCloud = true;
    console.log("Starting to load from cloud...");
    
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.log("Not logged in, cannot load from cloud");
            return false;
        }
        const userId = session.user.id;
        console.log("Loading data for user:", userId);
        const { data, error } = await window.supabase
            .from('student_progress')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        
        if (error) {
            if (error.code === 'PGRST116') {
                console.log("No existing progress data found for this student - clearing local data");
                completedQuests = {};
                questGrades = {};
                questRewards = {};
                earnedBadges = {};
                questAccepted = {};
                questStartTimes = {};
                seenNewQuests = [];
                window.selfAssessments = {};
                for (const questId in questTimers) {
                    clearInterval(questTimers[questId]);
                    delete questTimers[questId];
                }
                saveQuestData();
                saveQuestGrades();
                saveQuestRewards();
                saveEarnedBadges();
                saveQuestAccepted();
                saveQuestStartTimes();
                saveSeenNewQuests();
                localStorage.removeItem('selfAssessments');
            } else {
                console.error("Error loading from cloud:", error);
            }
        } else if (data) {
            const isEmpty = (!data.completed_quests || Object.keys(data.completed_quests).length === 0) &&
                            (!data.quest_grades || Object.keys(data.quest_grades).length === 0) &&
                            (!data.quest_accepted || Object.keys(data.quest_accepted).length === 0) &&
                            (!data.quest_start_times || Object.keys(data.quest_start_times).length === 0);
            
            if (isEmpty) {
                console.log("Progress data is effectively empty - clearing local data");
                completedQuests = {};
                questGrades = {};
                questRewards = {};
                earnedBadges = {};
                questAccepted = {};
                questStartTimes = {};
                seenNewQuests = [];
                window.selfAssessments = {};
                for (const questId in questTimers) {
                    clearInterval(questTimers[questId]);
                    delete questTimers[questId];
                }
                saveQuestData();
                saveQuestGrades();
                saveQuestRewards();
                saveEarnedBadges();
                saveQuestAccepted();
                saveQuestStartTimes();
                saveSeenNewQuests();
                localStorage.removeItem('selfAssessments');
                checkAllQuestWarnings();
                if (typeof updateProfileStandardsTable === 'function') updateProfileStandardsTable();
                if (typeof renderRadarChart === 'function') renderRadarChart();
                if (typeof updateProfileRewards === 'function') updateProfileRewards();
                console.log("Local data cleared due to empty cloud data");
            } else {
                console.log("Progress data loaded successfully!");
                console.log("  - completed_quests:", data.completed_quests);
                console.log("  - quest_grades:", data.quest_grades);
                console.log("  - quest_rewards:", data.quest_rewards);
                console.log("  - earned_badges:", data.earned_badges);
                
                if (data.completed_quests) completedQuests = data.completed_quests;
                if (data.quest_grades) questGrades = data.quest_grades;
                if (data.quest_rewards) questRewards = data.quest_rewards;
                if (data.earned_badges) {
                    const mergedBadges = { ...data.earned_badges, ...earnedBadges };
                    earnedBadges = mergedBadges;
                    saveEarnedBadges();
                }
                if (data.seen_new_quests) seenNewQuests = data.seen_new_quests;
                
                // --- NEW: Load self-assessments ---
                if (data.self_assessments) {
                    window.selfAssessments = data.self_assessments;
                    // Save to localStorage for offline access
                    localStorage.setItem('selfAssessments', JSON.stringify(data.self_assessments));
                    console.log("  - self_assessments:", Object.keys(data.self_assessments).length);
                } else {
                    // Try to load from localStorage if cloud doesn't have it
                    const localData = localStorage.getItem('selfAssessments');
                    if (localData) {
                        try {
                            window.selfAssessments = JSON.parse(localData);
                            console.log("  - self_assessments loaded from localStorage:", Object.keys(window.selfAssessments).length);
                        } catch (e) {
                            window.selfAssessments = {};
                        }
                    } else {
                        window.selfAssessments = {};
                    }
                }
                
                questAccepted = data.quest_accepted || {};
                questStartTimes = data.quest_start_times || {};
                
                saveQuestAccepted();
                saveQuestStartTimes();
                saveQuestData();
                if (typeof saveQuestGrades === 'function') saveQuestGrades();
                if (typeof saveQuestRewards === 'function') saveQuestRewards();
                if (typeof saveQuestAccepted === 'function') saveQuestAccepted();
                saveEarnedBadges();
                saveSeenNewQuests();
                
                if (currentQuestId && document.getElementById("quest-overlay").style.display === "block") {
                    console.log("Refreshing current quest UI for:", currentQuestId);
                    setupTimerControls(currentQuestId);
                    const acceptBtn = document.getElementById("quest-accept");
                    if (acceptBtn) {
                        const isAccepted = questAccepted[currentQuestId] === true;
                        if (isAccepted) {
                            acceptBtn.disabled = true;
                            acceptBtn.textContent = "Accepted";
                        } else {
                            acceptBtn.disabled = false;
                            acceptBtn.textContent = "Accept Quest";
                        }
                    }
                }
                
                if (typeof updateProfileStandardsTable === 'function') updateProfileStandardsTable();
                if (typeof renderRadarChart === 'function') renderRadarChart();
                if (typeof updateProfileRewards === 'function') updateProfileRewards();
                if (typeof recalculateAllQuestRewards === 'function') recalculateAllQuestRewards();
                
                if (currentQuestId && document.getElementById("rubric-overlay").style.display === "flex") {
                    console.log("Refreshing open rubric for quest:", currentQuestId);
                    openRubricPopup(currentQuestId);
                }
                
                if (document.getElementById("profile-overlay").style.display === "flex") {
                    if (typeof renderBadges === 'function') renderBadges();
                }
                
                console.log("All displays updated with cloud data");
            }
        }
        
        const { data: profileData, error: profileError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileData && profileData.name) {
            const profile = {
                name: profileData.name,
                character: profileData.avatar_url || "profile.png",
                teacher_code: profileData.teacher_code,
                class_id: profileData.class_id  
            };
            saveStudentProfile(profile);
            updateProfileUI();
            console.log("Profile loaded from cloud:", profile.name);
            console.log("Class ID saved:", profileData.class_id);
        }

        // --- OPTIMIZATION: Store in cache ---
        AppState.studentData.completedQuests = { ...completedQuests };
        AppState.studentData.questGrades = { ...questGrades };
        AppState.studentData.questAccepted = { ...questAccepted };
        AppState.studentData.questStartTimes = { ...questStartTimes };
        AppState.studentData.earnedBadges = { ...earnedBadges };
        AppState.studentData.selfAssessments = { ...window.selfAssessments };
        AppState.studentData.loaded = true;
        AppState.studentData.lastLoadTime = Date.now();

    } catch (err) {
        console.error("Error in loadStudentDataFromCloud:", err);
    } finally {
        isLoadingFromCloud = false;
        console.log("Finished loading from cloud");
    }
    return true;
}

async function manualRefreshGrades() {
    console.log("Manually refreshing grades...");
    invalidateStudentDataCache();
    await loadStudentDataFromCloud(true);
    alert("Data refreshed! Check your rubric and profile.");
}

// ==============================================
// SECTION 25: WORK CLOUD SAVE
// ==============================================

async function saveWorkToCloud(questId, workData, imageFile, uploadId = null) {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        console.log("Not logged in");
        return false;
    }
    
    const userId = session.user.id;
    let imageUrl = null;
    
    // Check if this exact upload is already in progress
    if (uploadId && window._activeUploads && window._activeUploads[uploadId]) {
        console.log("Upload already in progress for:", uploadId);
        return false;
    }
    
    // Track active upload
    if (!window._activeUploads) window._activeUploads = {};
    if (uploadId) {
        window._activeUploads[uploadId] = true;
    }
    
    try {
        // Upload image if a file was provided
        if (imageFile) {
            // COMPRESS THE IMAGE
            let fileToUpload = imageFile;
            if (imageFile.type.startsWith('image/')) {
                try {
                    fileToUpload = await compressImage(imageFile, 800, 0.8);
                } catch (error) {
                    console.error("Error compressing image:", error);
                }
            }
            
            // --- FIX: Deterministic filename (NO TIMESTAMP) ---
            // This prevents duplicates by using the same filename for the same user+quest
            const fileExt = 'jpg';
            const fileName = `${userId}/${questId}.${fileExt}`;
            
            console.log("Uploading to:", fileName);
            
            // --- FIX: upsert: true will REPLACE existing file ---
            const { data, error } = await window.supabase.storage
                .from('student-works')
                .upload(fileName, fileToUpload, {
                    cacheControl: '86400',
                    upsert: true // ← This replaces the file if it already exists!
                });
            
            if (error) {
                console.error("Upload error:", error);
                throw error;
            }
            
            console.log("Upload successful!");
            
            const { data: urlData } = window.supabase.storage
                .from('student-works')
                .getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }
        
        // Save metadata to database
        const { data: existingData } = await window.supabase
            .from('student_works')
            .select('id')
            .eq('user_id', userId)
            .eq('quest_id', questId)
            .maybeSingle();
        
        let error;
        
        if (existingData) {
            // UPDATE existing record
            const updateData = {
                image_url: imageUrl,
                title: workData.title,
                description: workData.description,
                size: workData.size,
                media: workData.media,
                grading_status: 'pending',
                uploaded_at: new Date().toISOString()
            };
            
            if (!imageUrl) delete updateData.image_url;
            
            const { error: updateError } = await window.supabase
                .from('student_works')
                .update(updateData)
                .eq('user_id', userId)
                .eq('quest_id', questId);
            
            error = updateError;
        } else {
            // INSERT new record
            const { error: insertError } = await window.supabase
                .from('student_works')
                .insert({
                    user_id: userId,
                    quest_id: questId,
                    image_url: imageUrl,
                    title: workData.title,
                    description: workData.description,
                    size: workData.size,
                    media: workData.media,
                    grading_status: 'pending',
                    uploaded_at: new Date().toISOString()
                });
            
            error = insertError;
        }
        
        if (error) {
            console.error("Error saving work metadata:", error);
            return false;
        }
        
        console.log("Work saved to cloud successfully!");
        return true;
        
    } catch (err) {
        console.error("Error in saveWorkToCloud:", err);
        return false;
    } finally {
        // Clear active upload tracking
        if (uploadId && window._activeUploads) {
            delete window._activeUploads[uploadId];
        }
    }
}

function autoSaveToCloud() {
    if (isLoadingFromCloud) {
        console.log("Skipping auto-save - currently loading from cloud");
        return;
    }
    window.supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            console.log("Auto-saving timer data to cloud...");
            saveStudentDataToCloud();
        }
    }).catch(err => {
        console.error("Auto-save error:", err);
    });
}

// ==============================================
// SECTION 26: PATH DROPDOWN HANDLER
// ==============================================

function handlePathChange() {
    const path = this.value;
    const mvpSelector = document.getElementById("mvp-quests");
    if (!mvpSelector) return;
    if (path && pathQuests[path]) {
        mvpSelector.style.display = "inline";
        mvpSelector.innerHTML = '<option value="">Select MVP Quest</option>';
        const mvpQuests = pathQuests[path].filter(q => q.style === "mvp");
        if (mvpQuests.length) {
            mvpQuests.forEach(q => {
                const opt = document.createElement("option");
                opt.value = q.id;
                opt.textContent = q.title;
                mvpSelector.appendChild(opt);
            });
        } else {
            mvpSelector.innerHTML += '<option value="">No MVP quests available</option>';
        }
    } else {
        mvpSelector.style.display = "none";
    }
}

// ==============================================
// SECTION 27: SEARCH ENGINE (FUZZY)
// ==============================================

const searchInput = document.getElementById("quest-search");
const searchResults = document.getElementById("quest-search-results");

if (searchInput) {
    searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();
        searchResults.innerHTML = "";
        if (term.length < 2) return;
        const matches = fuzzySearchQuests(term);
        if (!matches.length) {
            searchResults.innerHTML = `<div class="search-result">No results</div>`;
            return;
        }
        matches.forEach(({ id, quest }) => {
            const div = document.createElement("div");
            div.className = "search-result";
            const paths = Array.isArray(quest.path)
                ? quest.path.join(", ")
                : quest.path || "No path";
            div.innerHTML = `
                <strong>${paths}</strong><br>
                <span>${quest.title}</span>
            `;
            div.onclick = () => {
                const mapId = getMapForQuest(id);
                if (mapId && mapId !== currentMap) {
                    switchMap(mapId);
                }
                scale = 1;
                const mapViewport = document.getElementById("map-viewport");
                if (mapViewport) mapViewport.style.transform = "scale(1)";
                openQuest(id);
                searchResults.innerHTML = "";
                searchInput.value = "";
            };
            searchResults.appendChild(div);
        });
    });
}

function fuzzySearchQuests(term) {
    const words = term.split(/\s+/);
    return Object.entries(quests)
        .map(([id, quest]) => {
            const haystack = [
                quest.title,
                quest.description,
                ...(quest.requirements || []),
                ...(quest.path || [])
            ]
                .join(" ")
                .toLowerCase();
            let score = 0;
            words.forEach(word => {
                if (haystack.includes(word)) score++;
            });
            return score > 0 ? { id, quest, score } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
}

// ==============================================
// SECTION 28: RATIONALE POPUP LOGIC
// ==============================================

function openRationalePopup(questId) {
    const quest = quests[questId];
    if (!quest || !quest.rationale) return;
    document.getElementById("rationale-content").innerHTML = quest.rationale;
    playUnrollSound();
    document.getElementById("rationale-overlay").style.display = "flex";
}

function closeRationalePopup() {
    document.getElementById("rationale-overlay").style.display = "none";
}

function playUnrollSound() {
    const audio = document.getElementById("unroll-sound");
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.25;
    audio.play();
}

function initializeRationaleOverlay() {
    const overlay = document.getElementById("rationale-overlay");
    const closeBtn = document.getElementById("rationale-close");
    if (!overlay || !closeBtn) return;
    closeBtn.addEventListener("click", closeRationalePopup);
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeRationalePopup();
    });
}

// ==============================================
// SECTION 29: ACHIEVEMENTS DATA
// ==============================================

const achievementsData = [
    {
        title: "The Master of Perspective",
        note: "Complete all perspective quests",
        questsNeeded: ["quest42","quest43","quest44","quest45","quest46", "quest47"]
    },
    {
        title: "The Master of touch",
        note: "Complete quests that teach how to create different textures",
        questsNeeded: ["quest7","quest8","quest9","quest10","quest19","quest34","quest35", "quest64", "quest55"]
    },
    {
        title: "The master of the East",
        note: "Complete all quests related to China\nPS: For 'The Story Tile of the Heart` use a chinese theme for the tile.",
        questsNeeded: ["quest56","quest49","quest50"]
    },
    {
        title: "The Facemaster",
        note: "Complete all quests related to portrature (non mvp)",
        questsNeeded: ["quest18","quest20", "quest21","quest29","quest26","quest27","quest53"]
    },
    {
        title: "That who understand the principles",
        note: "Complete all quest related to the Principles of Design",
        questsNeeded: ["quest59","quest60","quest61","quest62","quest63"]
    },
    {
        title: "The Nature Chronicler",
        note: "Complete all landscape and natural subject quests.",
        questsNeeded: ["quest10","quest17","quest24","quest23","quest65"]
    },
    {
        title: "The Abstract Visionary",
        note: "Explore non-representational and pattern-based art across paths.",
        questsNeeded: ["quest12","quest13","quest14","quest15","quest36"]
    },
    {
        title: "The Traditionalist",
        note: "Complete all quests rooted in classical or cultural art traditions.",
        questsNeeded: ["quest49","quest50","quest54","quest67"]
    },
    {
        title: "The Architectural Scholar",
        note: "Excel in architectural drawing, perspective, and structure.",
        questsNeeded: ["quest42", "quest43", "quest44", "quest25", "quest58", "quest66"]
    },
    {
        title: "The Seasonal Storyteller",
        note: "Create art inspired by holidays and seasonal themes.",
        questsNeeded: ["quest51", "quest52"]
    },
    {
        title: "The Still Life Connoisseur",
        note: "Excel at observing and rendering still life across mediums.",
        questsNeeded: ["quest5", "quest16", "quest22", "quest41"]
    },
    {
        title: "The Light & Shadow Adept",
        note: "Master the use of value, light, and shadow across media.",
        questsNeeded: ["quest5", "quest8", "quest9", "quest33", "quest64"]
    },
    {
        title: "The Acrylic Master",
        note: "Complete all quests that specifically cite 'acrylic painting'",
        questsNeeded: ["quest1", "quest4", "quest5", "quest6", "quest10", "quest11", "quest19", "quest33", "quest34", "quest35", "quest36", "quest37", "quest66"]
    },
    {
        title: "The Water Sage",
        note: "Complete all watercolor-specific quests.",
        questsNeeded: ["quest32", "quest22", "quest23", "quest24", "quest25", "quest26", "quest27", "quest49", "quest50", "quest65"]
    },
    {
        title: "The 3D Master",
        note: "Complete all 3D quests",
        questsNeeded: ["quest53", "quest54", "quest56", "quest57", "quest58", "quest59", "quest60", "quest61", "quest62", "quest63", "quest68"]
    },
    {
        title: "The Sketch Master",
        note: "Complete all quests that specifically require pencil, ink or charcoal drawing\nPS: for this achievement, the quest 'Trial of Textured Cubes' need to be done pencil, charcoal or ink",
        questsNeeded: ["quest53", "quest54", "quest56", "quest57", "quest58", "quest59", "quest60", "quest61", "quest62", "quest63", "quest68"]
    },
    {
        title: "The MVP Conquistador",
        note: "Complete all high-difficulty summative quests.",
        questsNeeded: ["quest4","quest11","quest16","quest27", "quest35", "quest36", "quest50", "quest66"]
    },
];

// ==============================================
// SECTION 30: ACHIEVEMENTS OVERLAY FUNCTIONS
// ==============================================

function openAchievementsOverlay() {
    const rationaleOverlay = document.getElementById("rationale-overlay");
    if (rationaleOverlay && rationaleOverlay.style.display === "flex") {
        rationaleOverlay.style.display = "none";
    }
    const questOverlay = document.getElementById("quest-overlay");
    if (questOverlay && questOverlay.style.display === "block") {
        closeQuest();
    }
    document.getElementById("achievements-overlay").style.display = "flex";
    renderCompletedQuests();
    renderAchievementsList();
}

function closeAchievementsOverlay() {
    document.getElementById("achievements-overlay").style.display = "none";
}

function renderCompletedQuests() {
    const grid = document.getElementById("completed-quests-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const paths = {};
    for (const [id, quest] of Object.entries(quests)) {
        if (!quest || !completedQuests[id]) continue;
        const questPaths = Array.isArray(quest.path) ? quest.path : [quest.path];
        questPaths.forEach(p => {
            if (!paths[p]) paths[p] = [];
            paths[p].push({ id, title: quest.title });
        });
    }
    for (const [path, list] of Object.entries(paths)) {
        if (list.length === 0) continue;
        const col = document.createElement("div");
        col.innerHTML = `<h3>${path}</h3>`;
        list.forEach(q => {
            const link = document.createElement("a");
            link.href = "#";
            link.innerText = q.title;
            link.addEventListener("click", () => {
                closeAchievementsOverlay();
                openQuest(q.id);
            });
            col.appendChild(link);
            col.appendChild(document.createElement("br"));
        });
        grid.appendChild(col);
    }
}

function renderAchievementsList() {
    const container = document.getElementById("achievements-list");
    if (!container) return;
    container.innerHTML = "";
    achievementsData.forEach(item => {
        const completedCount = item.questsNeeded.filter(qid => completedQuests[qid]).length;
        const totalCount = item.questsNeeded.length;
        const div = document.createElement("div");
        div.classList.add("achievement-item");
        const header = document.createElement("div");
        header.classList.add("achievement-header");
        const expandBtn = document.createElement("button");
        expandBtn.classList.add("achievement-expand");
        expandBtn.innerText = "+";
        const title = document.createElement("h3");
        title.innerHTML = `
            ${item.title}
            <span class="achievement-progress">(${completedCount}/${totalCount})</span>
        `;
        header.appendChild(title);
        header.appendChild(expandBtn);
        div.appendChild(header);
        if (item.note) {
            const note = document.createElement("div");
            note.classList.add("achievement-note");
            note.innerText = item.note;
            div.appendChild(note);
        }
        const list = document.createElement("ul");
        list.classList.add("achievement-quests");
        item.questsNeeded.forEach(qid => {
            const completed = completedQuests[qid];
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = "#";
            link.innerText = quests[qid]?.title || qid;
            if (completed) {
                link.innerHTML += " <span class='ach-check'>✓</span>";
            }
            link.addEventListener("click", (e) => {
                e.preventDefault();
                closeAchievementsOverlay();
                openQuest(qid);
            });
            li.appendChild(link);
            list.appendChild(li);
        });
        div.appendChild(list);
        container.appendChild(div);
        expandBtn.addEventListener("click", () => {
            div.classList.toggle("expanded");
            expandBtn.innerText = div.classList.contains("expanded") ? "−" : "+";
        });
    });
}

// ==============================================
// SECTION 31: PATHFINDER SYSTEM
// ==============================================

async function loadPathfinderQuestions() {
    try {
        const response = await fetch('pathfinder-questions.json');
        pathfinderQuestions = await response.json();
        return pathfinderQuestions;
    } catch (error) {
        console.error('Failed to load pathfinder questions:', error);
        return null;
    }
}

function loadMVPQuests() {
    if (!quests || Object.keys(quests).length === 0) {
        console.warn('Quests not loaded yet');
        return [];
    }
    allMVPQuests = Object.entries(quests)
        .filter(([id, quest]) => quest.style === 'mvp')
        .map(([id, quest]) => ({
            id,
            title: quest.title,
            path: Array.isArray(quest.path) ? quest.path[0] : quest.path || 'Unknown Path',
            description: quest.description || ''
        }));
    return allMVPQuests;
}

function renderPathfinderQuestions() {
    const container = document.getElementById('pathfinder-questions-container');
    const introContainer = document.getElementById('pathfinder-intro');
    const resultsContainer = document.getElementById('pathfinder-results-container');
    const submitContainer = document.getElementById('pathfinder-submit-container');
    if (!container) {
        console.error("Questions container not found!");
        return;
    }
    if (!pathfinderQuestions) {
        console.error("No pathfinder questions loaded!");
        return;
    }
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (submitContainer) submitContainer.style.display = 'block';
    container.style.display = 'block';
    if (introContainer) {
        introContainer.innerHTML = pathfinderQuestions.intro || '';
    }
    container.innerHTML = '';
    currentPathfinderAnswers = {};
    pathfinderQuestions.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'pathfinder-question';
        questionDiv.dataset.questionId = question.id;
        const header = document.createElement('h4');
        header.textContent = `${question.id}. ${question.text}`;
        questionDiv.appendChild(header);
        if (question.note) {
            const note = document.createElement('div');
            note.className = 'pathfinder-question-note';
            note.textContent = question.note;
            questionDiv.appendChild(note);
        }
        const answersDiv = document.createElement('div');
        answersDiv.className = 'pathfinder-answers';
        question.answers.forEach(answer => {
            const answerId = `q${question.id}_${answer.letter}`;
            const answerWrapper = document.createElement('div');
            answerWrapper.className = 'pathfinder-answer';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `question_${question.id}`;
            radio.value = answer.letter;
            radio.id = answerId;
            const label = document.createElement('label');
            label.htmlFor = answerId;
            label.innerHTML = `<strong>${answer.letter})</strong> ${answer.text}`;
            answerWrapper.appendChild(radio);
            answerWrapper.appendChild(label);
            answerWrapper.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    radio.checked = true;
                    const event = new Event('change', { bubbles: true });
                    radio.dispatchEvent(event);
                }
            });
            radio.addEventListener('change', () => {
                document.querySelectorAll(`.pathfinder-question[data-question-id="${question.id}"] .pathfinder-answer`)
                    .forEach(el => el.classList.remove('selected'));
                answerWrapper.classList.add('selected');
                currentPathfinderAnswers[question.id] = answer.letter;
            });
            answersDiv.appendChild(answerWrapper);
        });
        questionDiv.appendChild(answersDiv);
        container.appendChild(questionDiv);
    });
}

function processPathfinderAnswers() {
    const totalQuestions = pathfinderQuestions.questions.length;
    const answeredCount = Object.keys(currentPathfinderAnswers).length;
    if (answeredCount < totalQuestions) {
        alert(`Please answer all ${totalQuestions} questions before finding your path.`);
        return null;
    }
    if (!allMVPQuests || allMVPQuests.length === 0) {
        allMVPQuests = loadMVPQuests();
    }
    const scores = {};
    allMVPQuests.forEach(quest => {
        scores[quest.id] = 0;
    });
    pathfinderQuestions.questions.forEach(question => {
        const answerLetter = currentPathfinderAnswers[question.id];
        const answerObj = question.answers.find(a => a.letter === answerLetter);
        if (answerObj && answerObj.score) {
            Object.entries(answerObj.score).forEach(([questId, points]) => {
                if (scores.hasOwnProperty(questId)) {
                    scores[questId] += points;
                }
            });
        }
    });
    const sortedQuests = Object.entries(scores)
        .filter(([id, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, score]) => {
            const quest = allMVPQuests.find(q => q.id === id);
            return { ...quest, score };
        });
    return sortedQuests;
}

function renderPathfinderResults(topQuests) {
    const questionsContainer = document.getElementById('pathfinder-questions-container');
    const resultsContainer = document.getElementById('pathfinder-results-container');
    const submitContainer = document.getElementById('pathfinder-submit-container');
    const resultMessageDiv = document.getElementById('pathfinder-result-message');
    const questListDiv = document.getElementById('pathfinder-quest-list');
    if (!resultsContainer || !questListDiv) {
        console.error("Required result elements not found!");
        return;
    }
    if (!topQuests || topQuests.length === 0) {
        if (resultMessageDiv) {
            resultMessageDiv.innerHTML = '<p>No matching quests found. Try different answers!</p>';
        }
    } else {
        const topQuestIds = topQuests.map(q => q.id);
        let bestMessage = pathfinderQuestions.resultMessages.find(msg => 
            msg.keywords.some(keyword => topQuestIds.includes(keyword))
        );
        if (!bestMessage) {
            bestMessage = {
                message: "Your answers reveal a unique artistic path! The quests below match your interests. Choose the one that calls to you most strongly."
            };
        }
        if (resultMessageDiv) {
            resultMessageDiv.innerHTML = `<p>${bestMessage.message}</p>`;
        }
        questListDiv.innerHTML = '';
        topQuests.forEach((quest, index) => {
            const questElement = document.createElement('div');
            questElement.className = 'questlist-item';
            questElement.dataset.questId = quest.id;
            const isCompleted = completedQuests[quest.id] || false;
            const isActive = questAccepted[quest.id] || false;
            let pathDisplay = quest.path || 'Unknown Path';
            questElement.innerHTML = `
                <div class="questlist-header">
                    <h3 class="questlist-title">${index + 1}. ${quest.title || 'Untitled'}</h3>
                    <span class="questlist-id">${quest.id}</span>
                </div>
                <div class="questlist-details">
                    <div>
                        <span class="questlist-path">${pathDisplay}</span>
                    </div>
                    <div>
                        ${isCompleted ? '<span class="questlist-completed">✓ Completed</span>' : ''}
                        ${isActive ? '<span class="questlist-timer active">🔴 Active</span>' : ''}
                    </div>
                </div>
            `;
            questElement.addEventListener('click', () => {
                closeAchievementsOverlay();
                openQuest(quest.id);
            });
            questListDiv.appendChild(questElement);
        });
    }
    if (questionsContainer) questionsContainer.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'block';
    if (submitContainer) submitContainer.style.display = 'none';
}

function resetPathfinder() {
    const questionsContainer = document.getElementById('pathfinder-questions-container');
    const resultsContainer = document.getElementById('pathfinder-results-container');
    const submitContainer = document.getElementById('pathfinder-submit-container');
    if (questionsContainer) questionsContainer.style.display = 'block';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (submitContainer) submitContainer.style.display = 'block';
    renderPathfinderQuestions();
}

async function initializePathfinder() {
    await loadPathfinderQuestions();
    loadMVPQuests();
    renderPathfinderQuestions();
    const submitBtn = document.getElementById('pathfinder-submit');
    const retakeBtn = document.getElementById('pathfinder-retake');
    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', () => {
            const topQuests = processPathfinderAnswers();
            if (topQuests) {
                renderPathfinderResults(topQuests);
            }
        });
    }
    if (retakeBtn) {
        const newRetakeBtn = retakeBtn.cloneNode(true);
        retakeBtn.parentNode.replaceChild(newRetakeBtn, retakeBtn);
        newRetakeBtn.addEventListener('click', () => {
            resetPathfinder();
        });
    }
}

// ==============================================
// SECTION 32: ACHIEVEMENTS INITIALIZATION
// ==============================================

function initializeAchievementsSystem() {
    const achievementsBtn = document.getElementById("achievements-btn");
    if (achievementsBtn) {
        const newBtn = achievementsBtn.cloneNode(true);
        achievementsBtn.parentNode.replaceChild(newBtn, achievementsBtn);
        newBtn.addEventListener("click", openAchievementsOverlay);
    }
    const closeBtn = document.getElementById("close-achievements");
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener("click", closeAchievementsOverlay);
    }
}

// ==============================================
// SECTION 33: RUBRIC POPUP - DISPLAY
// ==============================================

async function openRubricPopup(cityId, isSelfAssessment = false) {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        console.log("User not logged in - cannot load rubric");
        return;
    }
    
    const overlay = document.getElementById("rubric-overlay");
    const content = document.getElementById("rubric-content");
    const title = document.getElementById("rubric-title");
    const closeBtn = document.getElementById("close-rubric");
    
    document.getElementById("quest-overlay").style.display = "none";
    
    const quest = quests[cityId];
    if (!quest || !quest.rubric) {
        console.error("Quest or rubric not found");
        return;
    }
    
    currentQuestId = cityId;
    title.textContent = quest.rubric.overall || quest.title;
    
    const isSelfAssessmentMode = isSelfAssessment || window._selfAssessmentPending;
    
    const framework = await detectTeacherFramework();
    const isIGCSE = framework === 'igcse';
    const isIB = framework === 'ib-myp';
    const isNCAS = framework === 'ncas';
    
    const selectedStandards = await getTeacherStandardsForQuest(cityId);
    
    const isNCASFormat = quest.rubric.standards && Array.isArray(quest.rubric.standards);
    const isIBFormat = quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
    const isIGCSEFormat = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);
    
    let itemsToShow = [];
    let gradeLevels = [];
    let headerLabel = '';
    let isMVP = quest.style === "mvp";
    let gradeOptions = [];
    let gradeMapping = {};
    let column = isMVP ? "mvpGrade" : "grade";
    
    if (isNCASFormat) {
        itemsToShow = quest.rubric.standards;
        gradeLevels = ['4', '3', '2', '1'];
        headerLabel = 'Standard';
        gradeOptions = [
            { value: '4', label: '4 - Excellent' },
            { value: '3.5', label: '3.5 - Strong' },
            { value: '3', label: '3 - Good' },
            { value: '2.5', label: '2.5 - Developing' },
            { value: '2', label: '2 - Satisfactory' },
            { value: '1.5', label: '1.5 - Limited' },
            { value: '1', label: '1 - Beginning' }
        ];
        gradeMapping = {
            '4': 4, '3.5': 3.5, '3': 3, '2.5': 2.5,
            '2': 2, '1.5': 1.5, '1': 1
        };
    } else if (isIBFormat) {
        itemsToShow = quest.rubric.criteria;
        gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        headerLabel = 'Criterion';
        gradeOptions = [
            { value: '7-8', label: '7-8 - Excellent' },
            { value: '5-6', label: '5-6 - Good' },
            { value: '3-4', label: '3-4 - Satisfactory' },
            { value: '1-2', label: '1-2 - Limited' }
        ];
        gradeMapping = {
            '7-8': 7.5, '5-6': 5.5, '3-4': 3.5, '1-2': 1.5
        };
    } else if (isIGCSEFormat) {
        itemsToShow = quest.rubric.assessment_objectives;
        gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        headerLabel = 'Assessment Objective';
        gradeOptions = [
            { value: 'A*', label: 'A* - Outstanding' },
            { value: 'A', label: 'A - Excellent' },
            { value: 'B', label: 'B - Good' },
            { value: 'C', label: 'C - Satisfactory' },
            { value: 'D', label: 'D - Limited' },
            { value: 'E', label: 'E - Basic' },
            { value: 'F', label: 'F - Weak' },
            { value: 'G', label: 'G - Very Weak' }
        ];
        gradeMapping = {
            'A*': 8, 'A': 7, 'B': 6, 'C': 5,
            'D': 4, 'E': 3, 'F': 2, 'G': 1
        };
    }
    
    if (selectedStandards && selectedStandards.length > 0) {
        itemsToShow = itemsToShow.filter(item => selectedStandards.includes(item.code));
    }
    
    if (itemsToShow.length === 0) {
        content.innerHTML = `<div class="rubric-empty-message">
            <p>📋 No ${headerLabel}s Selected</p>
            <p>Your teacher has not selected any ${headerLabel}s for this quest yet.</p>
            <p>Please check back later or contact your teacher.</p>
        </div>`;
        overlay.style.display = "flex";
        if (closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.display = "none";
                document.getElementById("quest-overlay").style.display = "flex";
            };
        }
        return;
    }
    
    let workImageUrl = null;
    if (isSelfAssessmentMode) {
        const { data: workData } = await window.supabase
            .from('student_works')
            .select('image_url')
            .eq('user_id', session.user.id)
            .eq('quest_id', cityId)
            .maybeSingle();
        if (workData?.image_url) {
            workImageUrl = workData.image_url;
        }
    } else {
        const { data: workData } = await window.supabase
            .from('student_works')
            .select('image_url')
            .eq('user_id', session.user.id)
            .eq('quest_id', cityId)
            .maybeSingle();
        if (workData?.image_url) {
            workImageUrl = workData.image_url;
        }
    }
    
    let selfAssessment = {};
    if (window.selfAssessments && window.selfAssessments[cityId]) {
        selfAssessment = window.selfAssessments[cityId];
    }
    
    let html = '';
    
    if (workImageUrl) {
        html += `
            <div class="self-assessment-header" style="display: flex; gap: 20px; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div class="self-assessment-image">
                    <img src="${workImageUrl}" alt="Your work" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #ffd700; object-fit: cover;">
                </div>
                <div class="self-assessment-info">
                    ${isSelfAssessmentMode ? `
                        <h3 style="color: #ffd700; margin: 0;">📝 Self-Assessment Required</h3>
                        <p style="color: #f0e6d2; margin: 5px 0;">Review your work and honestly assess your performance.</p>
                        <p style="color: #ffd700; font-size: 14px; font-style: italic;">"The artist who judges their own work grows faster than any teacher can teach."</p>
                    ` : `
                        <h3 style="color: #ffd700; margin: 0;">📋 Your Work</h3>
                        <p style="color: #f0e6d2; margin: 5px 0;">Review your submitted work before viewing the rubric.</p>
                    `}
                </div>
            </div>
        `;
    } else if (isSelfAssessmentMode) {
        html += `
            <div class="self-assessment-header" style="margin-bottom: 15px; padding: 10px; background: rgba(255, 0, 0, 0.15); border-radius: 8px; border: 1px solid rgba(255, 0, 0, 0.3);">
                <p style="color: #ff8888; margin: 0;">⚠️ No work image found. Please submit your work before self-assessment.</p>
            </div>
        `;
    }
    
    html += `
        <div class="rubric-display-note" style="background: #2d2a94; padding: 10px; margin-bottom: 15px; border-radius: 5px;">
            ${isSelfAssessmentMode ? '📋 Select the grade you believe you deserve for each standard. Be honest!' : '📋 This rubric shows how your teacher will evaluate your work. Grades will appear here after your teacher reviews your submission.'}
        </div>
        <table class="rubric-table">
            <thead>
                <tr>
                    <th style="min-width: 120px;">${headerLabel}</th>
                    <th>${gradeLevels[0]}</th>
                    <th>${gradeLevels[1]}</th>
                    <th>${gradeLevels[2]}</th>
                    <th>${gradeLevels[3]}</th>
                    <th style="min-width: ${isSelfAssessmentMode ? '180px' : '100px'};">
                        ${isSelfAssessmentMode ? 'My Assessment' : 'Your Grade'}
                    </th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let allSelected = true;
    const columnType = isMVP ? "mvpGrade" : "grade";
    
    itemsToShow.forEach(item => {
        const teacherGrade = questGrades[cityId]?.[columnType]?.[item.code] ?? "";
        const selfGrade = selfAssessment[item.code] || "";
        const hasTeacherGrade = teacherGrade !== "";
        const hasSelfGrade = selfGrade !== "";
        
        // Determine which level to highlight for teacher (yellow)
        let teacherHighlightLevel = null;
        if (hasTeacherGrade) {
            let gradeNum = parseFloat(teacherGrade);
            if (isIGCSE) {
                teacherHighlightLevel = gradeNum ? Math.ceil(gradeNum / 2) : null;
            } else if (isIB) {
                const bandNum = parseFloat(teacherGrade);
                if (bandNum >= 7) teacherHighlightLevel = 4;
                else if (bandNum >= 5) teacherHighlightLevel = 3;
                else if (bandNum >= 3) teacherHighlightLevel = 2;
                else if (bandNum >= 1) teacherHighlightLevel = 1;
            } else {
                // NCAS: 4, 3.5, 3, 2.5, 2, 1.5, 1
                // Map to levels 1-4
                if (gradeNum >= 4) teacherHighlightLevel = 4;
                else if (gradeNum >= 3) teacherHighlightLevel = 3;
                else if (gradeNum >= 2) teacherHighlightLevel = 2;
                else if (gradeNum >= 1) teacherHighlightLevel = 1;
            }
        }
        
        // Determine which level to highlight for self-assessment (teal)
        let selfHighlightLevel = null;
        if (hasSelfGrade) {
            // Convert self-grade string to number for comparison
            let selfNum = parseFloat(selfGrade);
            if (isIGCSE) {
                // IGCSE letter grades
                const gradeMap = { 'A*': 8, 'A': 7, 'B': 6, 'C': 5, 'D': 4, 'E': 3, 'F': 2, 'G': 1 };
                selfNum = gradeMap[selfGrade] || 0;
                selfHighlightLevel = selfNum ? Math.ceil(selfNum / 2) : null;
            } else if (isIB) {
                // IB bands
                if (selfGrade === '7-8') selfHighlightLevel = 4;
                else if (selfGrade === '5-6') selfHighlightLevel = 3;
                else if (selfGrade === '3-4') selfHighlightLevel = 2;
                else if (selfGrade === '1-2') selfHighlightLevel = 1;
            } else {
                // NCAS
                if (selfNum >= 4) selfHighlightLevel = 4;
                else if (selfNum >= 3) selfHighlightLevel = 3;
                else if (selfNum >= 2) selfHighlightLevel = 2;
                else if (selfNum >= 1) selfHighlightLevel = 1;
            }
        }
        
        let gradeDisplay = "—";
        if (hasTeacherGrade) {
            if (isIGCSE) {
                gradeDisplay = convertNumberToLetterGrade(parseInt(teacherGrade));
            } else if (isIB) {
                const numGrade = parseFloat(teacherGrade);
                if (numGrade >= 7) gradeDisplay = "7-8";
                else if (numGrade >= 5) gradeDisplay = "5-6";
                else if (numGrade >= 3) gradeDisplay = "3-4";
                else if (numGrade >= 1) gradeDisplay = "1-2";
                else gradeDisplay = teacherGrade;
            } else {
                gradeDisplay = teacherGrade;
            }
        }
        
        let dropdownOptions = '';
        if (isSelfAssessmentMode) {
            dropdownOptions += `<option value="">— Select —</option>`;
            gradeOptions.forEach(opt => {
                const selected = selfGrade === opt.value ? 'selected' : '';
                dropdownOptions += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
        }
        
        if (isSelfAssessmentMode && !selfGrade) {
            allSelected = false;
        }
        
        // ==========================================
        // BUILD THE DESCRIPTION CELLS WITH HIGHLIGHTS
        // ==========================================
        // Level 4 cell
        let level4Class = '';
        if (teacherHighlightLevel === 4) level4Class = 'teacher-highlight';
        if (selfHighlightLevel === 4) level4Class = level4Class ? level4Class + ' self-highlight' : 'self-highlight';
        
        // Level 3 cell
        let level3Class = '';
        if (teacherHighlightLevel === 3) level3Class = 'teacher-highlight';
        if (selfHighlightLevel === 3) level3Class = level3Class ? level3Class + ' self-highlight' : 'self-highlight';
        
        // Level 2 cell
        let level2Class = '';
        if (teacherHighlightLevel === 2) level2Class = 'teacher-highlight';
        if (selfHighlightLevel === 2) level2Class = level2Class ? level2Class + ' self-highlight' : 'self-highlight';
        
        // Level 1 cell
        let level1Class = '';
        if (teacherHighlightLevel === 1) level1Class = 'teacher-highlight';
        if (selfHighlightLevel === 1) level1Class = level1Class ? level1Class + ' self-highlight' : 'self-highlight';
        
        // ==========================================
        // GRADE CELL DISPLAY
        // ==========================================
        let gradeCellContent = '';
        
        if (isSelfAssessmentMode) {
            // Self-assessment mode: dropdown + selected grade in teal
            gradeCellContent = `
                <div class="self-assessment-cell">
                    <select class="self-assessment-dropdown" data-standard="${item.code}" style="width: 100%; padding: 4px; border-radius: 4px; background: rgba(0,0,0,0.3); color: #f0e6d2; border: 1px solid rgba(255,215,0,0.3);">
                        ${dropdownOptions}
                    </select>
                    ${selfGrade ? `<div style="margin-top: 4px; background: rgba(0, 255, 200, 0.3); padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #b0f0e0; text-align: center; font-weight: bold;">${selfGrade}</div>` : `<div style="margin-top: 4px; font-size: 11px; color: #666; text-align: center;">Select a grade</div>`}
                </div>
            `;
        } else {
            // Normal view: Show grades with colored backgrounds
            if (hasTeacherGrade && hasSelfGrade) {
                // BOTH exist: Teacher in YELLOW, Self in TEAL
                gradeCellContent = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="background: rgba(255, 215, 0, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: bold; text-align: center; font-size: 14px; color: #ffd700;">
                            ${gradeDisplay}
                        </div>
                        <div style="background: rgba(0, 255, 200, 0.25); padding: 4px 8px; border-radius: 4px; font-weight: bold; text-align: center; font-size: 14px; color: #b0f0e0;">
                            ${selfGrade}
                        </div>
                    </div>
                `;
            } else if (hasTeacherGrade) {
                // Only teacher grade - YELLOW
                gradeCellContent = `
                    <div style="background: rgba(255, 215, 0, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: bold; text-align: center; font-size: 16px; color: #ffd700;">
                        ${gradeDisplay}
                    </div>
                `;
            } else if (hasSelfGrade) {
                // Only self-assessment - TEAL
                gradeCellContent = `
                    <div style="background: rgba(0, 255, 200, 0.25); padding: 4px 8px; border-radius: 4px; font-weight: bold; text-align: center; font-size: 16px; color: #b0f0e0;">
                        ${selfGrade}
                    </div>
                `;
            } else {
                // No grades yet
                gradeCellContent = `
                    <div style="font-size: 11px; color: #666; text-align: center; padding: 4px;">
                        ⏳ Awaiting grading
                    </div>
                `;
            }
        }
        
        html += `
            <tr>
                <td><strong>${item.code}</strong>${!isNCAS ? `<br><span style="font-size: 11px; color: #aaa;">${item.name}</span>` : ''}</td>
                <td class="${level4Class}">${item.levels[gradeLevels[0]] || ""}</td>
                <td class="${level3Class}">${item.levels[gradeLevels[1]] || ""}</td>
                <td class="${level2Class}">${item.levels[gradeLevels[2]] || ""}</td>
                <td class="${level1Class}">${item.levels[gradeLevels[3]] || ""}</td>
                <td>${gradeCellContent}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    const questGrade = (questGrades && questGrades[cityId]) ? questGrades[cityId] : null;
    const teacherComment = questGrade?.[column]?.teacher_comment || null;
    if (teacherComment && teacherComment.trim() !== '') {
        html += `
            <div class="teacher-comment-section" style="margin-top: 15px; padding: 12px; background: rgba(255, 215, 0, 0.1); border-radius: 8px; border-left: 3px solid #ffd700;">
                <div class="teacher-comment-label" style="color: #ffd700; font-weight: bold;">📝 Teacher's Feedback:</div>
                <div class="teacher-comment-content" style="color: #f0e6d2; margin-top: 5px;">${escapeHtml(teacherComment)}</div>
            </div>
        `;
    }
    
    if (isSelfAssessmentMode) {
        html += `
            <div class="self-assessment-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,215,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span style="color: #ffd700;">⚠️ Please complete all assessments before continuing</span>
                    </div>
                    <button id="submit-self-assessment-btn" class="auth-btn auth-btn-primary" ${allSelected ? '' : 'disabled'} style="${allSelected ? '' : 'opacity: 0.5; cursor: not-allowed;'} padding: 8px 20px;">
                        ${allSelected ? '✅ Submit Self-Assessment' : '⚠️ Complete all selections first'}
                    </button>
                </div>
                <p style="color: #999; font-size: 12px; margin-top: 8px; text-align: center;">Your self-assessment helps you reflect on your work. Be honest and thoughtful.</p>
            </div>
        `;
    }
    
    content.innerHTML = html;
    overlay.style.display = "flex";
    
    if (isSelfAssessmentMode) {
        const dropdowns = overlay.querySelectorAll('.self-assessment-dropdown');
        const submitBtn = document.getElementById('submit-self-assessment-btn');
        
        dropdowns.forEach(dropdown => {
            dropdown.addEventListener('change', function() {
                const tempAssessment = {};
                const allDropdowns = overlay.querySelectorAll('.self-assessment-dropdown');
                allDropdowns.forEach(d => {
                    if (d.value) {
                        tempAssessment[d.dataset.standard] = d.value;
                    }
                });
                localStorage.setItem('pendingSelfAssessment_' + cityId, JSON.stringify(tempAssessment));
                
                let allFilled = true;
                allDropdowns.forEach(d => {
                    if (!d.value) allFilled = false;
                });
                
                if (allFilled) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.textContent = '✅ Submit Self-Assessment';
                } else {
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.5';
                    submitBtn.style.cursor = 'not-allowed';
                    submitBtn.textContent = '⚠️ Complete all selections first';
                }
            });
        });
        
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                const assessment = {};
                const allDropdowns = overlay.querySelectorAll('.self-assessment-dropdown');
                allDropdowns.forEach(d => {
                    if (d.value) {
                        assessment[d.dataset.standard] = d.value;
                    }
                });
                saveSelfAssessment(cityId, assessment);
            });
        }
        
        const pendingData = localStorage.getItem('pendingSelfAssessment_' + cityId);
        if (pendingData) {
            try {
                const pending = JSON.parse(pendingData);
                const dropdowns2 = overlay.querySelectorAll('.self-assessment-dropdown');
                dropdowns2.forEach(d => {
                    if (pending[d.dataset.standard]) {
                        d.value = pending[d.dataset.standard];
                        d.dispatchEvent(new Event('change'));
                    }
                });
                localStorage.removeItem('pendingSelfAssessment_' + cityId);
            } catch (e) {
                console.error("Error loading pending self-assessment:", e);
            }
        }
    }
    
    if (!isSelfAssessmentMode) {
        if (closeBtn) {
            closeBtn.style.display = 'block';
            closeBtn.onclick = () => {
                overlay.style.display = "none";
                document.getElementById("quest-overlay").style.display = "flex";
            };
        }
    } else {
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }
    }
}

// ==============================================
// SECTION 33b: SELF-ASSESSMENT FUNCTIONS
// ==============================================

async function saveSelfAssessment(questId, assessment) {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        alert("Please log in to save your self-assessment.");
        return;
    }
    
    // Validate all standards have selections
    const quest = quests[questId];
    if (!quest || !quest.rubric) {
        alert("Quest not found.");
        return;
    }
    
    // Check which standards are selected (teacher-selected)
    const selectedStandards = await getTeacherStandardsForQuest(questId);
    let itemsToCheck = [];
    if (quest.rubric.standards) {
        itemsToCheck = quest.rubric.standards;
    } else if (quest.rubric.criteria) {
        itemsToCheck = quest.rubric.criteria;
    } else if (quest.rubric.assessment_objectives) {
        itemsToCheck = quest.rubric.assessment_objectives;
    }
    
    if (selectedStandards && selectedStandards.length > 0) {
        itemsToCheck = itemsToCheck.filter(item => selectedStandards.includes(item.code));
    }
    
    // Check if all standards have a selection
    for (const item of itemsToCheck) {
        if (!assessment[item.code]) {
            alert(`Please select a grade for ${item.code}`);
            return;
        }
    }
    
    // Save to database
    const userId = session.user.id;
    
    // Get existing progress
    const { data: progress, error: fetchError } = await window.supabase
        .from('student_progress')
        .select('self_assessments')
        .eq('user_id', userId)
        .maybeSingle();
    
    let selfAssessments = {};
    if (progress?.self_assessments) {
        selfAssessments = progress.self_assessments;
    }
    
    // Update with new assessment
    selfAssessments[questId] = assessment;
    
    // Save back to database
    const { error: saveError } = await window.supabase
        .from('student_progress')
        .update({
            self_assessments: selfAssessments,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    
    if (saveError) {
        console.error("Error saving self-assessment:", saveError);
        alert("Error saving your self-assessment. Please try again.");
        return;
    }
    
    // Also save locally
    if (!window.selfAssessments) window.selfAssessments = {};
    window.selfAssessments[questId] = assessment;
    localStorage.setItem('selfAssessments', JSON.stringify(window.selfAssessments));
    
    // Clear pending auto-save
    localStorage.removeItem('pendingSelfAssessment_' + questId);
    
    // Close the rubric overlay (self-assessment mode)
    const overlay = document.getElementById("rubric-overlay");
    if (overlay) {
        overlay.style.display = "none";
    }
    document.getElementById("quest-overlay").style.display = "flex";
    
    // Show success message
    alert("✅ Self-assessment submitted successfully! You can now continue your journey.");
    
    // Clear the self-assessment pending flag
    window._selfAssessmentPending = false;
    
    // Update profile if open
    const profileOverlay = document.getElementById("profile-overlay");
    if (profileOverlay && profileOverlay.style.display === "flex") {
        if (typeof renderBadges === 'function') renderBadges();
    }
}

// ==============================================
// SECTION 34: REWARDS OVERLAY FUNCTIONS
// ==============================================

function openRewardsOverlay() {
    const overlay = document.getElementById("rewards-overlay");
    if (!overlay) return;
    const { totals } = calculateRewardsPerStandard();
    const totalAll = Object.values(totals).reduce((sum, val) => sum + val, 0);
    const totalSummary = document.getElementById("rewards-total-summary");
    if (totalSummary) {
        totalSummary.innerHTML = `Total Rewards: <strong>${totalAll} 💰</strong>`;
    }
    renderRewardsTableSimple(totals);
    overlay.style.display = "flex";
}

function closeRewardsOverlay() {
    const overlay = document.getElementById("rewards-overlay");
    if (overlay) overlay.style.display = "none";
}

function renderRewardsTableSimple(totals) {
    const tableBody = document.getElementById("rewards-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    const sortedStandards = Object.keys(STANDARD_NAMES).sort();
    sortedStandards.forEach(standardCode => {
        const row = document.createElement("tr");
        const codeCell = document.createElement("td");
        codeCell.className = "standard-code";
        codeCell.textContent = standardCode;
        const nameCell = document.createElement("td");
        nameCell.className = "standard-name";
        nameCell.textContent = STANDARD_SHORT_NAMES[standardCode] || standardCode;
        const earnedCell = document.createElement("td");
        earnedCell.className = "reward-amount";
        const earned = totals[standardCode] || 0;
        earnedCell.innerHTML = `${earned} 💰`;
        row.appendChild(codeCell);
        row.appendChild(nameCell);
        row.appendChild(earnedCell);
        tableBody.appendChild(row);
    });
    const totalRow = document.createElement("tr");
    totalRow.style.backgroundColor = "rgba(0,30,180,0.5)";
    totalRow.style.fontWeight = "bold";
    const totalLabelCell = document.createElement("td");
    totalLabelCell.colSpan = 2;
    totalLabelCell.textContent = "TOTAL";
    totalLabelCell.style.textAlign = "right";
    const totalEarned = document.createElement("td");
    totalEarned.className = "reward-amount";
    totalEarned.innerHTML = `${Object.values(totals).reduce((s, v) => s + v, 0)} 💰`;
    totalRow.appendChild(totalLabelCell);
    totalRow.appendChild(totalEarned);
    tableBody.appendChild(totalRow);
}

function initializeRewardsOverlay() {
    const rewardLink = document.getElementById("profile-reward-link");
    const closeBtn = document.getElementById("close-rewards");
    const overlay = document.getElementById("rewards-overlay");
    if (rewardLink) {
        const newRewardLink = rewardLink.cloneNode(true);
        rewardLink.parentNode.replaceChild(newRewardLink, rewardLink);
        newRewardLink.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            updateProfileRewards();
            openRewardsOverlay();
        });
    }
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener("click", closeRewardsOverlay);
    }
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeRewardsOverlay();
        });
    }
}

// ==============================================
// SECTION 35: TEACHER STANDARDS FILTERING
// ==============================================

async function getTeacherStandardsForQuest(questId) {
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) {
        console.log("No teacher_code found in student profile");
        return null;
    }
    const { data: teacher, error: teacherError } = await window.supabase
        .from('teachers')
        .select('id, name')
        .eq('class_code', profile.teacher_code)
        .maybeSingle();
    if (teacherError || !teacher) {
        console.log("Teacher not found for code:", profile.teacher_code);
        return null;
    }
    currentTeacherName = teacher.name;
    const teacherNameSpan = document.getElementById("profile-teacher-name");
    if (teacherNameSpan) {
        teacherNameSpan.textContent = currentTeacherName;
    }
    const { data, error } = await window.supabase
        .from('teacher_quest_standards')
        .select('selected_standards')
        .eq('teacher_id', teacher.id)
        .eq('quest_id', questId)
        .maybeSingle();
    if (error) {
        if (error.code !== 'PGRST116') {
            console.log("Error fetching teacher standards:", error.message);
        }
        return null;
    }
    return data?.selected_standards || null;
}

async function loadTeacherNameForProfile() {
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            const { data: profileData } = await window.supabase
                .from('profiles')
                .select('teacher_code')
                .eq('id', session.user.id)
                .single();
            if (profileData?.teacher_code) {
                const updatedProfile = { ...profile, teacher_code: profileData.teacher_code };
                saveStudentProfile(updatedProfile);
                profile.teacher_code = profileData.teacher_code;
            } else {
                return;
            }
        } else {
            return;
        }
    }
    const { data: teacher, error } = await window.supabase
        .from('teachers')
        .select('name')
        .eq('class_code', profile.teacher_code)
        .single();
    if (!error && teacher) {
        currentTeacherName = teacher.name;
        const teacherNameSpan = document.getElementById("profile-teacher-name");
        if (teacherNameSpan) {
            teacherNameSpan.textContent = currentTeacherName;
        }
    }
}

// ==============================================
// SECTION 36: REWARD MATH FUNCTIONS
// ==============================================

function calculateQuestRewardCoins(questId) {
    if (!completedQuests[questId]) {
        return 0;
    }
    const quest = quests[questId];
    if (!quest || !quest.rubric) {
        return 0;
    }
    const column = quest.style === "mvp" ? "mvpGrade" : "grade";
    const grades = questGrades[questId]?.[column];
    if (!grades || Object.keys(grades).length === 0) {
        return 0;
    }
    let totalCoins = 0;
    Object.values(grades).forEach(val => {
        if (typeof val === "number" && !isNaN(val)) {
            totalCoins += Math.round(val * 10);
        }
    });
    return totalCoins;
}

function recalculateAllQuestRewards() {
    questRewards = {};
    Object.keys(completedQuests).forEach(qid => {
        if (completedQuests[qid]) {
            const coins = calculateQuestRewardCoins(qid);
            questRewards[qid] = coins;
        }
    });
    saveQuestRewards();
    updateProfileRewards();
}

function updateProfileRewards() {
    let totalRewards = 0;
    Object.entries(completedQuests).forEach(([questId, isCompleted]) => {
        if (isCompleted) {
            totalRewards += calculateQuestRewardCoins(questId);
        }
    });
    const el = document.getElementById("profile-total-coins");
    if (el) {
        el.innerText = `${totalRewards} 💰`;
    }
    const rewardsOverlay = document.getElementById("rewards-overlay");
    if (rewardsOverlay && rewardsOverlay.style.display === "flex") {
        const { totals } = calculateRewardsPerStandard();
        renderRewardsTableSimple(totals);
        const totalSummary = document.getElementById("rewards-total-summary");
        if (totalSummary) {
            totalSummary.innerHTML = `Total Rewards: <strong>${totalRewards} 💰</strong>`;
        }
    }
}

function calculateRewardsPerStandard() {
    const standardTotals = {};
    Object.keys(STANDARD_NAMES).forEach(standard => {
        standardTotals[standard] = 0;
    });
    Object.entries(completedQuests).forEach(([questId, isCompleted]) => {
        if (!isCompleted) return;
        const quest = quests[questId];
        if (!quest || !quest.rubric) return;
        const column = quest.style === "mvp" ? "mvpGrade" : "grade";
        const grades = questGrades[questId]?.[column];
        if (!grades) return;
        quest.rubric.standards.forEach(std => {
            const standardCode = std.code;
            const grade = grades[standardCode];
            if (typeof grade === "number" && !isNaN(grade)) {
                const coins = Math.round(grade * 10);
                if (standardTotals.hasOwnProperty(standardCode)) {
                    standardTotals[standardCode] += coins;
                }
            }
        });
    });
    return { totals: standardTotals, sources: {} };
}

// ==============================================
// SECTION 37: PROFILE BUTTON HANDLER
// ==============================================

function initializeProfileSystem() {
    const profileBtn = document.getElementById("profile-btn");
    const profileOverlay = document.getElementById("profile-overlay");
    const profileClose = document.getElementById("profile-close");
    if (!profileBtn || !profileOverlay || !profileClose) return;
    const newProfileBtn = profileBtn.cloneNode(true);
    profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
    newProfileBtn.addEventListener("click", async () => {
        await loadStudentDataFromCloud();
        await loadTeacherNameForProfile();
        profileOverlay.style.display = "flex";
        updateProfileStandardsTable();
        renderRadarChart();
        updateProfileUI();
        if (typeof showAvatarChangeUI === 'function') showAvatarChangeUI();
        updateProfileRewards();
        if (typeof renderBadges === 'function') renderBadges();
    });
    const newProfileClose = profileClose.cloneNode(true);
    profileClose.parentNode.replaceChild(newProfileClose, profileClose);
    newProfileClose.addEventListener("click", () => {
        profileOverlay.style.display = "none";
    });
    profileOverlay.addEventListener("click", (e) => {
        if (e.target === profileOverlay) {
            profileOverlay.style.display = "none";
        }
    });
}

// ==============================================
// SECTION 38: AVATAR CHANGE UI
// ==============================================

function showAvatarChangeUI() {
    const changeBtn = document.getElementById("change-avatar-btn");
    if (!changeBtn) return;
    const newChangeBtn = changeBtn.cloneNode(true);
    changeBtn.parentNode.replaceChild(newChangeBtn, changeBtn);
    newChangeBtn.addEventListener("click", () => {
        const setupOverlay = document.getElementById("student-setup-overlay");
        if (setupOverlay) {
            setupOverlay.style.display = "flex";
            const nameInput = document.getElementById("student-name-input");
            const emailInput = document.getElementById("student-email-input");
            const passwordInput = document.getElementById("student-password-input");
            const confirmInput = document.getElementById("student-confirm-password-input");
            const createBtn = document.getElementById("student-create-account-btn");
            const backLink = document.getElementById("back-to-login-link");
            if (nameInput) nameInput.style.display = "none";
            if (emailInput) emailInput.style.display = "none";
            if (passwordInput) passwordInput.style.display = "none";
            if (confirmInput) confirmInput.style.display = "none";
            if (createBtn) createBtn.style.display = "none";
            if (backLink) backLink.style.display = "none";
            const characterDiv = document.getElementById("character-selection");
            if (characterDiv) characterDiv.style.display = "block";
            const charactersList = document.getElementById("characters-list");
            if (charactersList && charactersList.innerHTML === "") {
                loadCharacterSelectionForProfile(charactersList);
            }
        }
    });
}

function loadCharacterSelectionForProfile(container) {
    fetch("characters/characters.json")
        .then(res => res.json())
        .then(characters => {
            container.innerHTML = "";
            characters.forEach(charFile => {
                const img = document.createElement("img");
                img.src = "characters/" + charFile;
                img.classList.add("character-img");
                img.style.cssText = "width: 80px; height: 80px; cursor: pointer; border-radius: 50%; margin: 5px; border: 2px solid gold;";
                img.addEventListener("click", async () => {
                    const imagePath = "characters/" + charFile;
                    const currentProfile = loadStudentProfile();
                    const studentName = currentProfile ? currentProfile.name : "Student";
                    const profile = { name: studentName, character: imagePath };
                    saveStudentProfile(profile);
                    updateProfileUI();
                    const { data: { session } } = await window.supabase.auth.getSession();
                    if (session) {
                        const { error } = await window.supabase
                            .from('profiles')
                            .upsert({
                                id: session.user.id,
                                name: studentName,
                                avatar_url: imagePath,
                                email: session.user.email
                            });
                        if (error) console.error("Error saving avatar to cloud:", error);
                    }
                    const setupOverlay = document.getElementById("student-setup-overlay");
                    if (setupOverlay) setupOverlay.style.display = "none";
                });
                container.appendChild(img);
            });
        })
        .catch(err => console.error("Failed to load characters.json:", err));
}

// ==============================================
// SECTION 39: MVP GRADE LOGIC
// ==============================================

function computeStandardAverage(isMVP, standardCode) {
    let sum = 0;
    let count = 0;
    for (const qid in questGrades) {
        const quest = quests[qid];
        if (!quest) continue;
        if (!completedQuests[qid]) continue;
        if (isMVP && quest.style !== "mvp") continue;
        if (!isMVP && quest.style === "mvp") continue;
        const column = isMVP ? "mvpGrade" : "grade";
        const raw = questGrades[qid]?.[column]?.[standardCode];
        if (raw !== null && raw !== undefined && !isNaN(raw)) {
            sum += raw;
            count++;
        }
    }
    return count ? (sum / count) : "";
}

// ==============================================
// SECTION 40: PROFILE GRADE AVERAGE
// ==============================================

async function updateProfileStandardsTable() {
    const tbody = document.getElementById("standards-table-body");
    if (!tbody) return;
    const framework = await detectTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    if (isIB) {
        await renderIBStandardsTable(tbody);
    } else if (isIGCSE) {
        await renderIGCSESTandardsTable(tbody);
    } else {
        await renderNCASStandardsTable(tbody);
    }
}

async function renderNCASStandardsTable(tbody) {
    const table = document.getElementById("standards-table");
    if (table) {
        const thead = table.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Standard</th>
                    <th>Formative Grade</th>
                    <th>Summative Grade</th>
                </tr>
            `;
        }
    }
    const userId = window.currentUserId || (await getCurrentUserId());
    if (!userId) {
        console.log("No user ID found, cannot render NCAS standards table");
        tbody.innerHTML = '<tr><td colspan="3">Please log in to view standards</td></tr>';
        return;
    }
    const { data: progress, error } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error("Error loading progress:", error);
        tbody.innerHTML = '<tr><td colspan="3">Error loading standards</td></tr>';
        return;
    }
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const mvpQuests = [];
    const regularQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = quests[questId];
        if (!quest) continue;
        if (quest.style === 'mvp') {
            mvpQuests.push(questId);
        } else {
            regularQuests.push(questId);
        }
    }
    const mvpScores = {};
    const mvpCounts = {};
    const regularScores = {};
    const regularCounts = {};
    for (const questId of mvpQuests) {
        const grades = questGrades[questId]?.mvpGrade || {};
        for (const [standard, grade] of Object.entries(grades)) {
            mvpScores[standard] = (mvpScores[standard] || 0) + grade;
            mvpCounts[standard] = (mvpCounts[standard] || 0) + 1;
        }
    }
    for (const questId of regularQuests) {
        const grades = questGrades[questId]?.grade || {};
        for (const [standard, grade] of Object.entries(grades)) {
            regularScores[standard] = (regularScores[standard] || 0) + grade;
            regularCounts[standard] = (regularCounts[standard] || 0) + 1;
        }
    }
    const standards = [
        { code: "Art.FA.CR.1.1.IA", name: "Generate" },
        { code: "Art.FA.CR.1.2.IA", name: "Practice" },
        { code: "Art.FA.CR.2.1.IA", name: "Explore" },
        { code: "Art.FA.CR.2.3.IA", name: "Transform" },
        { code: "Art.FA.CR.3.1.IA", name: "Reflect" },
        { code: "Art.FA.PR.6.1.IA", name: "Analyze" },
        { code: "Art.FA.RE.8.1.8A", name: "Interpret" },
        { code: "Art.FA.CN.10.1.IA", name: "Document" }
    ];
    tbody.innerHTML = '';
    for (const standard of standards) {
        const formativeAvg = regularCounts[standard.code] ? (regularScores[standard.code] / regularCounts[standard.code]).toFixed(2) : '—';
        const summativeAvg = mvpCounts[standard.code] ? (mvpScores[standard.code] / mvpCounts[standard.code]).toFixed(2) : '—';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${standard.code}</strong><br><span style="font-size: 11px;">${standard.name}</span></td>
            <td>${formativeAvg}</td>
            <td>${summativeAvg}</td>
        `;
        tbody.appendChild(row);
    }
}

async function renderIBStandardsTable(tbody) {
    const table = document.getElementById("standards-table");
    if (table) {
        const thead = table.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Criterion</th>
                    <th>Formative Grade</th>
                    <th>Summative Grade</th>
                </tr>
            `;
        }
    }
    const userId = window.currentUserId || (await getCurrentUserId());
    if (!userId) {
        console.log("No user ID found, cannot render IB standards table");
        tbody.innerHTML = '<tr><td colspan="3">Please log in to view standards</td></tr>';
        return;
    }
    const { data: progress, error } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', userId)
        .maybeSingle();
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const mvpQuests = [];
    const regularQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = quests[questId];
        if (!quest) continue;
        if (quest.style === 'mvp') {
            mvpQuests.push(questId);
        } else {
            regularQuests.push(questId);
        }
    }
    const mvpScores = { A: 0, B: 0, C: 0, D: 0 };
    const mvpCounts = { A: 0, B: 0, C: 0, D: 0 };
    const regularScores = { A: 0, B: 0, C: 0, D: 0 };
    const regularCounts = { A: 0, B: 0, C: 0, D: 0 };
    function addGradeToCriterion(criterionCode, grade, isMvp) {
        if (!grade || isNaN(grade)) return;
        const targetScores = isMvp ? mvpScores : regularScores;
        const targetCounts = isMvp ? mvpCounts : regularCounts;
        targetScores[criterionCode] = (targetScores[criterionCode] || 0) + grade;
        targetCounts[criterionCode] = (targetCounts[criterionCode] || 0) + 1;
    }
    for (const questId of regularQuests) {
        const quest = quests[questId];
        if (!quest || !quest.rubric?.criteria) continue;
        const grades = questGrades[questId]?.grade || {};
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            addGradeToCriterion(criterion.code, grade, false);
        });
    }
    for (const questId of mvpQuests) {
        const quest = quests[questId];
        if (!quest || !quest.rubric?.criteria) continue;
        const grades = questGrades[questId]?.mvpGrade || {};
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            addGradeToCriterion(criterion.code, grade, true);
        });
    }
    const criteria = [
        { code: "A", name: "A: Knowing & Understanding" },
        { code: "B", name: "B: Developing Skills" },
        { code: "C", name: "C: Thinking Creatively" },
        { code: "D", name: "D: Responding" }
    ];
    tbody.innerHTML = '';
    for (const criterion of criteria) {
        const formativeAvg = regularCounts[criterion.code] ? (regularScores[criterion.code] / regularCounts[criterion.code]).toFixed(2) : '—';
        const summativeAvg = mvpCounts[criterion.code] ? (mvpScores[criterion.code] / mvpCounts[criterion.code]).toFixed(2) : '—';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${criterion.name}</strong></td>
            <td>${formativeAvg}</td>
            <td>${summativeAvg}</td>
        `;
        tbody.appendChild(row);
    }
}

async function renderIGCSESTandardsTable(tbody) {
    const table = document.getElementById("standards-table");
    if (table) {
        const thead = table.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Assessment Objective</th>
                    <th>Grade</th>
                </tr>
            `;
        }
    }
    const userId = window.currentUserId || (await getCurrentUserId());
    if (!userId) {
        console.log("No user ID found, cannot render IGCSE standards table");
        tbody.innerHTML = '<tr><td colspan="3">Please log in to view standards</td></tr>';
        return;
    }
    const { data: progress, error } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', userId)
        .maybeSingle();
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const allCompletedQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = quests[questId];
        if (!quest) continue;
        allCompletedQuests.push(questId);
    }
    const totalScores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    const totalCounts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    function addGradeToAO(aoCode, grade) {
        if (!grade || isNaN(grade)) return;
        totalScores[aoCode] = (totalScores[aoCode] || 0) + grade;
        totalCounts[aoCode] = (totalCounts[aoCode] || 0) + 1;
    }
    for (const questId of allCompletedQuests) {
        const quest = quests[questId];
        if (!quest || !quest.rubric?.assessment_objectives) continue;
        const column = quest.style === "mvp" ? "mvpGrade" : "grade";
        const grades = questGrades[questId]?.[column] || {};
        quest.rubric.assessment_objectives.forEach(ao => {
            const grade = grades[ao.code];
            addGradeToAO(ao.code, grade);
        });
    }
    const assessmentObjectives = [
        { code: "AO1", name: "AO1: Record" },
        { code: "AO2", name: "AO2: Explore & Select" },
        { code: "AO3", name: "AO3: Develop" },
        { code: "AO4", name: "AO4: Present" }
    ];
    tbody.innerHTML = '';
    for (const ao of assessmentObjectives) {
        const avgGrade = totalCounts[ao.code] ? (totalScores[ao.code] / totalCounts[ao.code]).toFixed(2) : '—';
        let displayGrade = avgGrade;
        if (avgGrade !== '—') {
            const numAvg = parseFloat(avgGrade);
            displayGrade = convertNumberToLetterGrade(Math.round(numAvg));
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${ao.name}</strong></td>
            <td>${displayGrade}</td>
        `;
        tbody.appendChild(row);
    }
}

async function getCurrentUserId() {
    const { data: { session } } = await window.supabase.auth.getSession();
    return session?.user?.id;
}

function convertNumberToLetterGrade(number) {
    const gradeMap = {
        8: 'A*',
        7: 'A',
        6: 'B',
        5: 'C',
        4: 'D',
        3: 'E',
        2: 'F',
        1: 'G'
    };
    return gradeMap[number] || '';
}

function convertLetterGradeToNumber(letter) {
    if (!letter) return null;
    const upperLetter = letter.toString().toUpperCase().trim();
    const gradeMap = {
        'A*': 8,
        'A': 7,
        'B': 6,
        'C': 5,
        'D': 4,
        'E': 3,
        'F': 2,
        'G': 1
    };
    return gradeMap[upperLetter] || null;
}

// ==============================================
// SECTION 41: RADAR CHART
// ==============================================

async function computeDomainGrades() {
    const framework = await detectTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    if (isIB) {
        return computeIBDomainGrades();
    } else if (isIGCSE) {
        return computeIGCSEDomainGrades();
    } else {
        return computeNCASDomainGrades();
    }
}

function computeNCASDomainGrades() {
    const ncasDomains = {
        creating: [
            "Art.FA.CR.1.1.IA",
            "Art.FA.CR.1.2.IA",
            "Art.FA.CR.2.1.IA",
            "Art.FA.CR.2.3.IA",
            "Art.FA.CR.3.1.IA"
        ],
        presenting: ["Art.FA.PR.6.1.IA"],
        responding: ["Art.FA.RE.8.1.8A"],
        connecting: ["Art.FA.CN.10.1.IA"]
    };
    const domainGrades = {};
    for (const domain in ncasDomains) {
        let sum = 0;
        let count = 0;
        ncasDomains[domain].forEach(code => {
            const avg = computeStandardAverage(true, code);
            if (typeof avg === "number" && !isNaN(avg)) {
                sum += avg;
                count++;
            }
        });
        domainGrades[domain] = count ? sum / count : 0;
    }
    return domainGrades;
}

async function computeIBDomainGrades() {
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', currentUserId || (await getCurrentUserId()))
        .maybeSingle();
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const mvpQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = quests[questId];
        if (quest && quest.style === 'mvp') {
            mvpQuests.push(questId);
        }
    }
    const criteriaScores = { A: 0, B: 0, C: 0, D: 0 };
    const criteriaCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const questId of mvpQuests) {
        const quest = quests[questId];
        if (!quest || !quest.rubric?.criteria) continue;
        const grades = questGrades[questId]?.mvpGrade || {};
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            if (grade && typeof grade === 'number' && !isNaN(grade)) {
                criteriaScores[criterion.code] += grade;
                criteriaCounts[criterion.code]++;
            }
        });
    }
    const domainGrades = {
        "A: Knowing & Understanding": criteriaCounts.A ? criteriaScores.A / criteriaCounts.A : 0,
        "B: Developing Skills": criteriaCounts.B ? criteriaScores.B / criteriaCounts.B : 0,
        "C: Thinking Creatively": criteriaCounts.C ? criteriaScores.C / criteriaCounts.C : 0,
        "D: Responding": criteriaCounts.D ? criteriaScores.D / criteriaCounts.D : 0
    };
    return domainGrades;
}

async function computeIGCSEDomainGrades() {
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', currentUserId || (await getCurrentUserId()))
        .maybeSingle();
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const allCompletedQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        allCompletedQuests.push(questId);
    }
    const aoScores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    const aoCounts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    for (const questId of allCompletedQuests) {
        const quest = quests[questId];
        if (!quest || !quest.rubric?.assessment_objectives) continue;
        const column = quest.style === "mvp" ? "mvpGrade" : "grade";
        const grades = questGrades[questId]?.[column] || {};
        quest.rubric.assessment_objectives.forEach(ao => {
            const grade = grades[ao.code];
            if (grade && typeof grade === 'number' && !isNaN(grade)) {
                aoScores[ao.code] += grade;
                aoCounts[ao.code]++;
            }
        });
    }
    const domainGrades = {
        "AO1: Record": aoCounts.AO1 ? aoScores.AO1 / aoCounts.AO1 : 0,
        "AO2: Explore & Select": aoCounts.AO2 ? aoScores.AO2 / aoCounts.AO2 : 0,
        "AO3: Develop": aoCounts.AO3 ? aoScores.AO3 / aoCounts.AO3 : 0,
        "AO4: Present": aoCounts.AO4 ? aoScores.AO4 / aoCounts.AO4 : 0
    };
    return domainGrades;
}

async function renderRadarChart() {
    const canvas = document.getElementById("radar-chart");
    const tooltip = document.getElementById("radar-tooltip");
    if (!canvas) return;
    const userId = window.currentUserId || (await getCurrentUserId());
    if (!userId) {
        console.log("No user ID found, cannot render radar chart");
        return;
    }
    const framework = await detectTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isNCAS = framework === 'ncas';
    let radarData = {};
    let labels = [];
    let descriptions = {};
    if (isIB) {
        radarData = await computeIBDomainGrades();
        labels = ["A: Knowing & Understanding", "B: Developing Skills", "C: Thinking Creatively", "D: Responding"];
        descriptions = {
            "A: Knowing & Understanding": "Knowledge of art forms, genres, and movements. Understanding context and using correct terminology.",
            "B: Developing Skills": "Application of techniques, use of media, development of ideas, and artistic choices.",
            "C: Thinking Creatively": "Exploration of ideas, originality, problem-solving, and personal expression.",
            "D: Responding": "Reflection on own work, critique of artwork, and evaluation of artistic development."
        };
    } else if (isIGCSE) {
        radarData = await computeIGCSEDomainGrades();
        labels = ["AO1: Record", "AO2: Explore & Select", "AO3: Develop", "AO4: Present"];
        descriptions = {
            "AO1: Record": "Record ideas, observations and insights relevant to intentions. Document research and process.",
            "AO2: Explore & Select": "Explore and select appropriate resources, media, techniques and processes.",
            "AO3: Develop": "Develop ideas through investigations, demonstrating critical understanding of sources.",
            "AO4: Present": "Present a personal and meaningful response that realises intentions."
        };
    } else if (isNCAS) {
        radarData = computeNCASDomainGrades();
        labels = ["creating", "presenting", "responding", "connecting"];
        descriptions = {
            creating: "Creating: Generating ideas and creating art through experimentation and planning.",
            presenting: "Presenting: Sharing and presenting art with intentional choices and reflection.",
            responding: "Responding: Interpreting and evaluating art using reasoning and evidence.",
            connecting: "Connecting: Making connections between art, culture, and personal experiences."
        };
    } else {
        radarData = { creating: 0, presenting: 0, responding: 0, connecting: 0 };
        labels = ["creating", "presenting", "responding", "connecting"];
        descriptions = {
            creating: "Creating", presenting: "Presenting", responding: "Responding", connecting: "Connecting"
        };
    }
    const values = labels.map(l => radarData[l] || 0);
    const ctx = canvas.getContext("2d");
    const size = 350;
    canvas.width = size;
    canvas.height = size;
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 110;
    const steps = 4;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    for (let s = 1; s <= steps; s++) {
        ctx.beginPath();
        const r = (maxRadius / steps) * s;
        for (let i = 0; i < labels.length; i++) {
            const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    for (let i = 0; i < labels.length; i++) {
        const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
        const x = centerX + maxRadius * Math.cos(angle);
        const y = centerY + maxRadius * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelPositions = [];
    for (let i = 0; i < labels.length; i++) {
        const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
        const x = centerX + (maxRadius + 22) * Math.cos(angle);
        const y = centerY + (maxRadius + 22) * Math.sin(angle);
        let displayLabel = labels[i];
        if (isIB) {
            displayLabel = labels[i].charAt(0);
            ctx.fillText(displayLabel, x, y);
        } else if (isIGCSE) {
            displayLabel = labels[i].split(':')[0];
            ctx.fillText(displayLabel, x, y);
        } else {
            ctx.fillText(displayLabel, x, y);
        }
        labelPositions.push({ x, y, label: labels[i] });
    }
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
        const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
        let scaledValue = values[i];
        if (isIGCSE) {
            scaledValue = values[i] / 2;
        }
        const r = (scaledValue / 4) * maxRadius;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    const pointPositions = [];
    values.forEach((val, i) => {
        const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
        let scaledValue = val;
        if (isIGCSE) {
            scaledValue = val / 2;
        }
        const r = (scaledValue / 4) * maxRadius;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        pointPositions.push({ x, y, label: labels[i] });
    });
    canvas.onmousemove = (e) => {
        const container = document.getElementById("radar-chart-container");
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        let found = false;
        for (const pt of pointPositions) {
            const dist = Math.hypot(mouseX - pt.x, mouseY - pt.y);
            if (dist < 10) {
                tooltip.innerText = descriptions[pt.label] || pt.label;
                tooltip.style.opacity = 1;
                tooltip.style.left = (mouseX + 15) + "px";
                tooltip.style.top = (mouseY - 25) + "px";
                found = true;
                break;
            }
        }
        if (!found) {
            for (const lbl of labelPositions) {
                const dist = Math.hypot(mouseX - lbl.x, mouseY - lbl.y);
                if (dist < 40) {
                    tooltip.innerText = descriptions[lbl.label] || lbl.label;
                    tooltip.style.opacity = 1;
                    tooltip.style.left = (mouseX + 15) + "px";
                    tooltip.style.top = (mouseY - 25) + "px";
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            tooltip.style.opacity = 0;
        }
    };
}

// ==============================================
// SECTION 42: TIMER FUNCTIONS
// ==============================================

function formatTime(minutes, showClasses = true) {
    if (showClasses) {
        const classes = minutes / 75;
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.floor((minutes * 60) % 60);
        if (classes >= 1) {
            const wholeClasses = Math.floor(classes);
            const remainingMinutes = Math.round((classes - wholeClasses) * 75);
            if (wholeClasses > 0 && remainingMinutes > 0) {
                return `${wholeClasses} ${wholeClasses === 1 ? 'class' : 'classes'} ${remainingMinutes}m`;
            } else if (wholeClasses > 0) {
                return `${wholeClasses} ${wholeClasses === 1 ? 'class' : 'classes'}`;
            } else {
                return `${remainingMinutes}m`;
            }
        }
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
}

function initializeQuestTimers() {
    for (const questId in questAccepted) {
        if (questAccepted[questId] && questStartTimes[questId]) {
            startQuestTimer(questId);
        }
    }
    checkAllQuestWarnings();
    updateActiveQuestButton();
    startActiveQuestTimerUpdates();
}

function startQuestTimer(questId) {
    if (questTimers[questId]) clearInterval(questTimers[questId]);
    questTimers[questId] = setInterval(() => {
        checkAllQuestWarnings();
        if (currentQuestId === questId) {
            const remaining = updateTimerDisplay(questId);
            if (remaining <= 0) stopQuestTimer(questId);
        }
    }, 1000);
    updateTimerDisplay(questId);
}

function stopQuestTimer(questId) {
    if (questTimers[questId]) {
        clearInterval(questTimers[questId]);
        delete questTimers[questId];
    }
}

// ==============================================
// SECTION 43: BACKGROUND TIMER CHECK
// ==============================================

function startBackgroundTimerCheck() {
    setInterval(() => {
        for (const questId in questAccepted) {
            if (questAccepted[questId] && !completedQuests[questId]) {
                if (currentQuestId === questId) updateTimerDisplay(questId);
                const remaining = calculateRemainingMinutes(questId);
                if (remaining <= 0) {
                    const questBox = document.getElementById("quest-box");
                    if (questBox && currentQuestId === questId) {
                        questBox.classList.add("times-up");
                        questBox.classList.remove("warning");
                    }
                }
            }
        }
    }, 60000);
}

function calculateRemainingMinutes(questId) {
    if (!questStartTimes[questId]) return 0;
    const quest = quests[questId];
    if (!quest) return 0;
    const classDuration = getClassDurationSync();
    let totalMinutes;
    const customTimer = getCustomTimerForQuestSync(questId);
    if (customTimer !== null) {
        totalMinutes = customTimer * classDuration;
    } else if (quest.timer) {
        totalMinutes = quest.timer.allottedMinutes;
    } else {
        return 0;
    }
    const startTime = new Date(questStartTimes[questId]);
    const now = new Date();
    let elapsedClassDays = 0;
    const current = new Date(startTime);
    const today = new Date(now);
    current.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    while (current < today) {
        if (isClassDay(current)) {
            elapsedClassDays++;
        }
        current.setDate(current.getDate() + 1);
    }
    const elapsedMinutes = elapsedClassDays * classDuration;
    const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
    return remainingMinutes;
}

function updateTimerDisplay(questId) {
    if (!questStartTimes[questId]) return;
    const remaining = calculateRemainingMinutes(questId);
    const timerDisplay = document.getElementById("timer-display");
    const questBox = document.getElementById("quest-box");
    if (timerDisplay && questBox && currentQuestId === questId) {
        timerDisplay.textContent = formatTime(remaining, true);
        const quest = quests[questId];
        let totalMinutes = quest?.timer?.allottedMinutes || 75;
        if (cachedCustomTimer !== null && cachedClassDuration) {
            totalMinutes = cachedCustomTimer * cachedClassDuration;
        }
        const remainingPercent = totalMinutes > 0 ? (remaining / totalMinutes) * 100 : 0;
        const warningThreshold = 30;
        if (remaining <= 0) {
            questBox.classList.add("times-up");
            questBox.classList.remove("warning");
            timerDisplay.textContent = "TIME'S UP!";
        } else if (remainingPercent <= warningThreshold) {
            questBox.classList.add("warning");
            questBox.classList.remove("times-up");
        } else {
            questBox.classList.remove("warning", "times-up");
        }
    }
    checkAllQuestWarnings();
    return remaining;
}

// ==============================================
// SECTION 44: START ACTIVE QUEST TIMER UPDATES
// ==============================================

function startActiveQuestTimerUpdates() {
    if (window._activeQuestTimerInterval) {
        clearInterval(window._activeQuestTimerInterval);
        window._activeQuestTimerInterval = null;
    }
    updateActiveQuestButton();
    window._activeQuestTimerInterval = setInterval(() => {
        updateActiveQuestButton();
    }, 1000);
}

function acceptQuest(questId) {
    const quest = quests[questId];
    if (!quest || !quest.timer) return;
    const check = canAcceptQuest(questId);
    if (!check.allowed) {
        if (check.reason === "active_quest") {
            showRestrictionPopup(check.activeQuestId);
        } else if (check.reason === "prerequisites") {
            let message = "";
            if (check.required === 2) {
                message = `This MVP quest requires at least 2 completed formative quests. You have completed ${check.completed} of the required ${check.required}.`;
            } else {
                message = `This MVP quest requires completing its formative quest first.`;
            }
            showPrerequisitePopup(message, check.prerequisites);
        }
        return;
    }
    if (confirm(`Accept "${quest.title}"?\n\nYou will have ${formatTime(quest.timer.allottedMinutes, true)} to complete this quest.`)) {
        if (activeQuestId && activeQuestId !== questId) {
            questAccepted[activeQuestId] = false;
            stopQuestTimer(activeQuestId);
        }
        questAccepted[questId] = true;
        questStartTimes[questId] = new Date().toISOString();
        saveQuestAccepted();
        saveQuestStartTimes();
        const acceptBtn = document.getElementById("quest-accept");
        if (acceptBtn) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = "Accepted";
        }
        const timerDisplay = document.getElementById("timer-display");
        if (timerDisplay) timerDisplay.style.display = "block";
        startQuestTimer(questId);
        saveQuestData();
        updateActiveQuestButton();
        startActiveQuestTimerUpdates();
        const finishedWorkBtn = document.getElementById("finished-work-btn");
        const linksContainer = document.getElementById("quest-links");
        if (finishedWorkBtn) {
            finishedWorkBtn.style.opacity = "1";
            finishedWorkBtn.style.cursor = "pointer";
            finishedWorkBtn.removeAttribute('disabled');
            finishedWorkBtn.title = "Upload your finished work";
            const newBtn = finishedWorkBtn.cloneNode(true);
            finishedWorkBtn.parentNode.replaceChild(newBtn, finishedWorkBtn);
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (!currentQuestId) {
                    alert("Please open a quest first to add your work.");
                    return;
                }
                openWorkOverlay(currentQuestId);
            });
        }
        if (linksContainer) {
            linksContainer.style.opacity = "1";
            linksContainer.style.pointerEvents = "auto";
            linksContainer.title = "";
        }
        updateTimerDisplay(questId);
        // Invalidate cache after accepting
        invalidateStudentDataCache();
    }
}

function resetQuestTimer(questId) {
    delete questStartTimes[questId];
    delete questAccepted[questId];
    saveQuestStartTimes();
    saveQuestAccepted();
    stopQuestTimer(questId);
    const questBox = document.getElementById("quest-box");
    if (questBox && currentQuestId === questId) {
        questBox.classList.remove("warning", "times-up");
    }
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay && currentQuestId === questId) {
        timerDisplay.textContent = "";
        timerDisplay.style.display = "none";
    }
    const acceptBtn = document.getElementById("quest-accept");
    if (acceptBtn && currentQuestId === questId) {
        acceptBtn.disabled = false;
        acceptBtn.textContent = "Accept Quest";
    }
    const questCheck = document.getElementById("quest-check");
    if (questCheck && currentQuestId === questId) {
        questCheck.disabled = false;
        questCheck.title = "";
    }
    // Invalidate cache after reset
    invalidateStudentDataCache();
}

function setupTimerControls(questId) {
    const quest = quests[questId];
    const acceptBtn = document.getElementById("quest-accept");
    const timerDisplay = document.getElementById("timer-display");
    if (!quest || !acceptBtn || !timerDisplay) return;
    const customTimer = getCustomTimerForQuest(questId);
    if (customTimer !== null || quest.timer) {
        acceptBtn.style.display = "block";
        if (questAccepted[questId]) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = "Accepted";
            timerDisplay.style.display = "block";
            if (!questTimers[questId] && questStartTimes[questId]) {
                startQuestTimer(questId);
            }
        } else {
            acceptBtn.disabled = false;
            acceptBtn.textContent = "Accept Quest";
            timerDisplay.style.display = "none";
        }
        const newAcceptBtn = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
        newAcceptBtn.addEventListener("click", () => {
            if (!questAccepted[questId]) {
                acceptQuestWithCustomTimer(questId);
            }
        });
    } else {
        acceptBtn.style.display = "none";
        timerDisplay.style.display = "none";
        document.getElementById("quest-box").classList.add("no-timer");
    }
    const questCheck = document.getElementById("quest-check");
    if (questCheck) {
        questCheck.disabled = false;
        questCheck.title = "";
    }
}

// ==============================================
// SECTION 44b: SYNCHRONOUS TIMER CONTROLS (for instant quest open)
// ==============================================

function setupTimerControlsSync(questId) {
    const quest = quests[questId];
    const acceptBtn = document.getElementById("quest-accept");
    const timerDisplay = document.getElementById("timer-display");
    if (!quest || !acceptBtn || !timerDisplay) return;
    
    // Use cached values only - no async calls
    const customTimer = getCustomTimerForQuestSync(questId);
    
    if (customTimer !== null || quest.timer) {
        acceptBtn.style.display = "block";
        if (questAccepted[questId]) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = "Accepted";
            timerDisplay.style.display = "block";
            if (!questTimers[questId] && questStartTimes[questId]) {
                startQuestTimer(questId);
            }
            updateTimerDisplay(questId);
        } else {
            acceptBtn.disabled = false;
            acceptBtn.textContent = "Accept Quest";
            timerDisplay.style.display = "none";
        }
        // Prevent duplicate listeners
        const newAcceptBtn = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
        newAcceptBtn.addEventListener("click", () => {
            if (!questAccepted[questId]) {
                acceptQuestWithCustomTimer(questId);
            }
        });
    } else {
        acceptBtn.style.display = "none";
        timerDisplay.style.display = "none";
        const qb = document.getElementById("quest-box");
        if (qb) qb.classList.add("no-timer");
    }
    
    const questCheck = document.getElementById("quest-check");
    if (questCheck) {
        questCheck.disabled = false;
        questCheck.title = "";
    }
}

// ==============================================
// SECTION 45: CUSTOM TIMER FUNCTIONS (OPTIMIZED)
// ==============================================

async function getCustomTimerForQuest(questId) {
    // --- OPTIMIZATION: Check cache first ---
    if (AppState.teacherData.loaded && AppState.teacherData.customTimers[questId] !== undefined) {
        return AppState.teacherData.customTimers[questId];
    }
    
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) return null;
    const { data: teacher } = await window.supabase
        .from('teachers')
        .select('id')
        .eq('class_code', profile.teacher_code)
        .maybeSingle();
    if (!teacher) return null;
    let query = window.supabase
        .from('teacher_quest_standards')
        .select('timer_classes')
        .eq('teacher_id', teacher.id)
        .eq('quest_id', questId);
    if (profile.class_id) {
        const { data, error } = await query.eq('class_id', profile.class_id).maybeSingle();
        if (!error && data?.timer_classes !== null && data?.timer_classes !== undefined) {
            AppState.teacherData.customTimers[questId] = data.timer_classes;
            AppState.teacherData.loaded = true;
            return data.timer_classes;
        }
        const { data: globalData, error: globalError } = await query.is('class_id', null).maybeSingle();
        if (!globalError && globalData?.timer_classes !== null && globalData?.timer_classes !== undefined) {
            AppState.teacherData.customTimers[questId] = globalData.timer_classes;
            AppState.teacherData.loaded = true;
            return globalData.timer_classes;
        }
    } else {
        const { data, error } = await query.is('class_id', null).maybeSingle();
        if (!error && data?.timer_classes !== null && data?.timer_classes !== undefined) {
            AppState.teacherData.customTimers[questId] = data.timer_classes;
            AppState.teacherData.loaded = true;
            return data.timer_classes;
        }
    }
    AppState.teacherData.customTimers[questId] = null;
    AppState.teacherData.loaded = true;
    return null;
}

async function getClassDuration() {
    const profile = loadStudentProfile();
    if (!profile || !profile.class_id) return 75;
    const { data } = await window.supabase
        .from('class_settings')
        .select('class_duration_minutes')
        .eq('class_id', profile.class_id)
        .single();
    const duration = data?.class_duration_minutes || 75;
    AppState.teacherData.classDuration = duration;
    return duration;
}

async function acceptQuestWithCustomTimer(questId) {
    const quest = quests[questId];
    if (!quest) return;
    const check = canAcceptQuest(questId);
    if (!check.allowed) {
        if (check.reason === "active_quest") {
            showRestrictionPopup(check.activeQuestId);
        } else if (check.reason === "prerequisites") {
            let message = "";
            if (check.required === 2) {
                message = `This MVP quest requires at least 2 completed formative quests. You have completed ${check.completed} of the required ${check.required}.`;
            } else {
                message = `This MVP quest requires completing its formative quest first.`;
            }
            showPrerequisitePopup(message, check.prerequisites);
        }
        return;
    }
    const customTimerClasses = await getCustomTimerForQuest(questId);
    const classDuration = await getClassDuration();
    let allottedMinutes;
    if (customTimerClasses !== null) {
        allottedMinutes = customTimerClasses * classDuration;
    } else if (quest.timer) {
        allottedMinutes = quest.timer.allottedMinutes;
    } else {
        allottedMinutes = 75;
    }
    const timeText = formatTime(allottedMinutes, true);
    if (confirm(`Accept "${quest.title}"?\n\nYou will have ${timeText} to complete this quest.`)) {
        if (activeQuestId && activeQuestId !== questId) {
            questAccepted[activeQuestId] = false;
            stopQuestTimer(activeQuestId);
        }
        questAccepted[questId] = true;
        questStartTimes[questId] = new Date().toISOString();
        if (customTimerClasses !== null) {
            questTimers[questId] = { allottedMinutes: allottedMinutes, classDuration: classDuration };
        }
        saveQuestAccepted();
        saveQuestStartTimes();
        const acceptBtn = document.getElementById("quest-accept");
        if (acceptBtn) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = "Accepted";
        }
        const timerDisplay = document.getElementById("timer-display");
        if (timerDisplay) {
            timerDisplay.style.display = "block";
        }
        startQuestTimer(questId);
        saveQuestData();
        const finishedWorkBtn = document.getElementById("finished-work-btn");
        if (finishedWorkBtn) {
            finishedWorkBtn.style.opacity = "1";
            finishedWorkBtn.style.cursor = "pointer";
            finishedWorkBtn.removeAttribute('disabled');
            const newBtn = finishedWorkBtn.cloneNode(true);
            finishedWorkBtn.parentNode.replaceChild(newBtn, finishedWorkBtn);
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (!currentQuestId) {
                    alert("Please open a quest first to add your work.");
                    return;
                }
                openWorkOverlay(currentQuestId);
            });
        }
        const linksContainer = document.getElementById("quest-links");
        if (linksContainer) {
            linksContainer.style.opacity = "1";
            linksContainer.style.pointerEvents = "auto";
        }
        updateTimerDisplay(questId);
        // Invalidate cache after accepting
        invalidateStudentDataCache();
    }
}

function getCustomTimerForQuestSync(questId) {
    // Check per-quest cache first
    if (cachedTimerQuestId === questId && cachedCustomTimer !== null) {
        return cachedCustomTimer;
    }
    // Fall back to AppState cache (populated by preCacheAllTimerValues)
    if (AppState.teacherData.loaded && AppState.teacherData.customTimers[questId] !== undefined) {
        return AppState.teacherData.customTimers[questId];
    }
    return null;
}

function getClassDurationSync() {
    return cachedClassDuration || AppState.teacherData.classDuration || 75;
}

async function cacheTimerValuesForQuest(questId) {
    // --- OPTIMIZATION: Check cache first ---
    if (AppState.teacherData.loaded && AppState.teacherData.customTimers[questId] !== undefined) {
        cachedCustomTimer = AppState.teacherData.customTimers[questId];
        cachedClassDuration = AppState.teacherData.classDuration;
        cachedTimerQuestId = questId;
        return;
    }
    cachedTimerQuestId = questId;
    cachedCustomTimer = await getCustomTimerForQuest(questId);
    cachedClassDuration = await getClassDuration();
    // Store in cache
    AppState.teacherData.customTimers[questId] = cachedCustomTimer;
    AppState.teacherData.classDuration = cachedClassDuration;
    AppState.teacherData.loaded = true;
}

function checkAllQuestWarnings() {
    const overlay = document.getElementById("map-warning-overlay");
    if (!overlay) return;
    let hasWarning = false;
    let hasTimeUp = false;
    for (const [questId, isAccepted] of Object.entries(questAccepted)) {
        if (isAccepted === true && !completedQuests[questId]) {
            const remaining = calculateRemainingMinutes(questId);
            const quest = quests[questId];
            let totalMinutes = quest?.timer?.allottedMinutes || 75;
            const customTimer = getCustomTimerForQuestSync(questId);
            const classDuration = getClassDurationSync();
            if (customTimer !== null) {
                totalMinutes = customTimer * classDuration;
            }
            const remainingPercent = totalMinutes > 0 ? (remaining / totalMinutes) * 100 : 0;
            if (remaining <= 0) {
                hasTimeUp = true;
            } else if (remainingPercent <= 30) {
                hasWarning = true;
            }
        }
    }
    overlay.classList.remove("warning", "times-up");
    if (hasTimeUp) {
        overlay.classList.add("times-up");
        console.log("⏰ TIME'S UP - Map overlay turned red");
    } else if (hasWarning) {
        overlay.classList.add("warning");
        console.log("⚠️ WARNING - Map overlay pulsing red");
    }
}

// ==============================================
// SECTION 46: SCHEDULE DATA FOR TIMER
// ==============================================

async function loadScheduleForStudent() {
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) {
        console.log("No teacher_code found, using default schedule (weekends off)");
        return;
    }
    
    console.log("Loading schedule for teacher_code:", profile.teacher_code);
    
    // First, get the teacher's ID and class code from the teacher_code
    const { data: teacher, error: teacherError } = await window.supabase
        .from('teachers')
        .select('id, class_code')
        .eq('class_code', profile.teacher_code)
        .single();
    
    if (teacherError || !teacher) {
        console.log("Teacher not found for code:", profile.teacher_code);
        return;
    }
    
    const teacherId = teacher.id;
    const teacherClassCode = teacher.class_code;
    console.log("Teacher found:", teacherId, "Class code:", teacherClassCode);
    
    // Try multiple approaches to find schedule data
    
    // APPROACH 1: Try class-specific schedule (if student has class_id)
    let classId = profile.class_id;
    let noClassDays = [];
    let weekendSettings = { saturday_is_class: false, sunday_is_class: false };
    let frequencyDays = [];
    
    if (classId) {
        console.log("Trying class-specific schedule for class_id:", classId);
        
        // Load no-class days for this class
        const { data: classNoClassDays, error: classNoError } = await window.supabase
            .from('class_schedule_overrides')
            .select('date, reason, notes, is_class_day')
            .eq('class_id', classId);
        
        if (!classNoError && classNoClassDays && classNoClassDays.length > 0) {
            noClassDays = classNoClassDays;
            console.log("Found class-specific no-class days:", noClassDays.length);
        } else {
            console.log("No class-specific no-class days found or error:", classNoError?.message);
        }
        
        // Load weekend settings for this class
        const { data: classWeekendSettings, error: weekendError } = await window.supabase
            .from('class_weekend_settings')
            .select('saturday_is_class, sunday_is_class')
            .eq('class_id', classId)
            .maybeSingle();
        
        if (!weekendError && classWeekendSettings) {
            weekendSettings = classWeekendSettings;
            console.log("Found class-specific weekend settings:", weekendSettings);
        } else {
            console.log("No class-specific weekend settings found:", weekendError?.message);
        }
        
        // Load frequency rules for this class
        const { data: classFrequencyRules, error: freqError } = await window.supabase
            .from('class_schedule_rules')
            .select('type, days')
            .eq('class_id', classId)
            .maybeSingle();
        
        if (!freqError && classFrequencyRules && classFrequencyRules.type === 'custom') {
            frequencyDays = classFrequencyRules.days || [];
            console.log("Found class-specific frequency rules:", frequencyDays);
        } else {
            console.log("No class-specific frequency rules found:", freqError?.message);
        }
    }
    
    // APPROACH 2: If no class-specific data, try using the teacher's class_code
    if (noClassDays.length === 0) {
        console.log("No class-specific schedule found, trying to find class by teacher_code...");
        
        // Find all classes with this teacher_code
        const { data: classes, error: classesError } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', teacherId);
        
        if (!classesError && classes && classes.length > 0) {
            // Try each class to find schedule data
            for (const cls of classes) {
                console.log("Trying class_id:", cls.id);
                
                // Try to load no-class days
                const { data: classNoClassDays } = await window.supabase
                    .from('class_schedule_overrides')
                    .select('date, reason, notes, is_class_day')
                    .eq('class_id', cls.id);
                
                if (classNoClassDays && classNoClassDays.length > 0) {
                    noClassDays = classNoClassDays;
                    console.log("Found no-class days in class:", cls.id);
                    break;
                }
            }
        }
    }
    
    // APPROACH 3: If still no data, try to find ANY schedule data (for display purposes)
    if (noClassDays.length === 0) {
        console.log("No class-based schedule found, checking for any schedule data...");
        
        // Try to get ANY schedule overrides (ignoring class_id filter)
        const { data: anyOverrides, error: anyError } = await window.supabase
            .from('class_schedule_overrides')
            .select('date, reason, notes, is_class_day')
            .limit(10);
        
        if (!anyError && anyOverrides && anyOverrides.length > 0) {
            console.log("Found some schedule overrides in the system (may not be for this class)");
            // We found data, but it might be for other classes
            // Let's filter by teacher_id if possible
            noClassDays = anyOverrides;
        }
    }
    
    // Store the loaded data
    cachedScheduleData.noClassDaysDetails = noClassDays;
    cachedScheduleData.noClassDays = noClassDays.map(d => d.date);
    cachedScheduleData.weekendSettings = weekendSettings;
    cachedScheduleData.frequencyDays = frequencyDays;
    
    console.log("Schedule loaded successfully:", {
        noClassDays: cachedScheduleData.noClassDays.length,
        weekendSettings: cachedScheduleData.weekendSettings,
        frequencyDays: cachedScheduleData.frequencyDays
    });
    
    // Log the actual dates for debugging
    if (cachedScheduleData.noClassDays.length > 0) {
        console.log("No-class dates:", cachedScheduleData.noClassDays);
    }
}

function isClassDay(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = date.getDay();
    if (cachedScheduleData.noClassDays.includes(dateStr)) {
        return false;
    }
    if (dayOfWeek === 6) {
        return cachedScheduleData.weekendSettings.saturday_is_class;
    }
    if (dayOfWeek === 0) {
        return cachedScheduleData.weekendSettings.sunday_is_class;
    }
    if (cachedScheduleData.frequencyDays.length > 0) {
        const jsDay = dayOfWeek === 0 ? 7 : dayOfWeek;
        return cachedScheduleData.frequencyDays.includes(jsDay);
    }
    return true;
}

function countClassDays(startDate, endDate) {
    let classDays = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        if (isClassDay(current)) {
            classDays++;
        }
        current.setDate(current.getDate() + 1);
    }
    return classDays;
}

// ==============================================
// SECTION 47: STUDENT CALENDAR
// ==============================================

let currentCalendarDate = new Date();
let calendarQuestData = null;

async function openStudentCalendar() {
    await loadStudentDataFromCloud();
    await loadScheduleForStudent();
    await loadQuestCalendarData();
    renderStudentCalendar();
    document.getElementById('calendar-modal').style.display = 'flex';
}

async function loadQuestCalendarData() {
    const { data: { session } } = await window.supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
        console.log("No user logged in");
        return;
    }
    calendarQuestData = {
        activeQuest: null,
        completedQuests: []
    };
    const { data: progress, error } = await window.supabase
        .from('student_progress')
        .select('completed_quests, quest_grades, quest_accepted, quest_start_times')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error("Error loading progress:", error);
        return;
    }
    if (!progress) return;
    const completedQuests = progress.completed_quests || {};
    const questGrades = progress.quest_grades || {};
    const questAccepted = progress.quest_accepted || {};
    const questStartTimes = progress.quest_start_times || {};
    console.log("Raw data - Start times:", questStartTimes);
    console.log("Raw data - Completed:", completedQuests);
    for (const [questId, isAccepted] of Object.entries(questAccepted)) {
        if (isAccepted === true && !completedQuests[questId]) {
            const quest = quests[questId];
            const startTime = new Date(questStartTimes[questId]);
            if (isNaN(startTime.getTime())) {
                console.log(`Invalid start time for ${questId}`);
                continue;
            }
            const classDuration = await getClassDuration();
            const customTimer = await getCustomTimerForQuest(questId);
            let totalMinutes;
            if (customTimer !== null) {
                totalMinutes = customTimer * classDuration;
            } else if (quest.timer) {
                totalMinutes = quest.timer.allottedMinutes;
            } else {
                continue;
            }
            const dueDate = calculateDueDate(startTime, totalMinutes, classDuration);
            calendarQuestData.activeQuest = {
                id: questId,
                title: quest.title,
                startDate: startTime,
                dueDate: dueDate,
                totalMinutes: totalMinutes
            };
            console.log(`Active quest: ${questId}, start: ${startTime}, due: ${dueDate}`);
            break;
        }
    }
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (isCompleted === true) {
            const quest = quests[questId];
            if (!quest) {
                console.log(`Quest ${questId} not found in quests data`);
                continue;
            }
            const startTime = questStartTimes[questId];
            let completedDate = null;
            const grades = questGrades[questId];
            console.log(`Processing completed quest ${questId}:`, {
                startTime: startTime,
                grades: grades
            });
            if (grades) {
                if (grades.updated_at) {
                    completedDate = new Date(grades.updated_at);
                } else if (grades.graded_at) {
                    completedDate = new Date(grades.graded_at);
                } else {
                    completedDate = startTime ? new Date(startTime) : new Date();
                    if (startTime) {
                        completedDate.setDate(completedDate.getDate() + 1);
                    }
                }
            } else {
                completedDate = startTime ? new Date(startTime) : new Date();
                if (startTime) {
                    completedDate.setDate(completedDate.getDate() + 1);
                }
            }
            calendarQuestData.completedQuests.push({
                id: questId,
                title: quest.title,
                startDate: startTime ? new Date(startTime) : null,
                completedDate: completedDate,
                dueDate: null
            });
            console.log(`Added completed quest: ${questId}, start: ${startTime}, completed: ${completedDate}`);
        }
    }
    console.log("Final calendarQuestData:", calendarQuestData);
}

function calculateDueDate(startDate, totalMinutes, classDuration) {
    const totalClassPeriods = Math.ceil(totalMinutes / classDuration);
    let classDaysCount = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    while (classDaysCount < totalClassPeriods) {
        if (isClassDay(currentDate)) {
            classDaysCount++;
        }
        if (classDaysCount < totalClassPeriods) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    return currentDate;
}

function renderStudentCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('student-calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const totalCells = firstDay + daysInMonth;
    const numRows = Math.ceil(totalCells / 7);
    const totalGridCells = numRows * 7;
    for (let i = 0; i < totalGridCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        const dayNumber = i - firstDay + 1;
        const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
        if (isCurrentMonth) {
            const currentDate = new Date(year, month, dayNumber);
            currentDate.setHours(0, 0, 0, 0);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            const daySpan = document.createElement('div');
            daySpan.className = 'calendar-day-number';
            daySpan.textContent = dayNumber;
            cell.appendChild(daySpan);
            const statuses = [];
            const scheduleEntry = cachedScheduleData.noClassDaysDetails?.find(d => d.date === dateStr);
            const isTeacherNoClassDay = scheduleEntry && scheduleEntry.is_class_day === false;
            if (isTeacherNoClassDay) {
                statuses.push({
                    type: 'no-class',
                    priority: 1,
                    color: 'rgba(255, 0, 0, 0.35)',
                    label: `🚫 No Class: ${scheduleEntry.reason || 'Teacher scheduled'}`,
                    fullText: scheduleEntry.reason || 'No Class'
                });
            }
            if (scheduleEntry?.notes) {
                statuses.push({
                    type: 'note',
                    priority: 2,
                    color: 'rgba(76, 175, 80, 0.35)',
                    label: `📝 Note: ${scheduleEntry.notes}`,
                    fullText: scheduleEntry.notes
                });
            }
            if (calendarQuestData.completedQuests && calendarQuestData.completedQuests.length > 0) {
                for (const completed of calendarQuestData.completedQuests) {
                    if (completed.startDate && completed.completedDate) {
                        const start = new Date(completed.startDate);
                        start.setHours(0, 0, 0, 0);
                        const completion = new Date(completed.completedDate);
                        completion.setHours(0, 0, 0, 0);
                        if (currentDate >= start && currentDate <= completion) {
                            statuses.push({
                                type: 'completed',
                                priority: 3,
                                color: 'rgba(100, 100, 100, 0.35)',
                                label: `✅ Completed: ${completed.title}`,
                                questId: completed.id,
                                isCompletedDate: currentDate.getTime() === completion.getTime()
                            });
                        }
                    }
                }
            }
            if (calendarQuestData.activeQuest) {
                const startDate = new Date(calendarQuestData.activeQuest.startDate);
                startDate.setHours(0, 0, 0, 0);
                const dueDate = new Date(calendarQuestData.activeQuest.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                if (currentDate >= startDate && currentDate <= dueDate) {
                    const alreadyCompleted = statuses.some(s => s.type === 'completed' && s.questId === calendarQuestData.activeQuest.id);
                    if (!alreadyCompleted) {
                        statuses.push({
                            type: 'active',
                            priority: 4,
                            color: 'rgba(0, 150, 255, 0.35)',
                            label: `📘 Active: ${calendarQuestData.activeQuest.title}`,
                            questId: calendarQuestData.activeQuest.id,
                            isStartDate: currentDate.getTime() === startDate.getTime(),
                            isDueDate: currentDate.getTime() === dueDate.getTime()
                        });
                    }
                }
            }
            const uniqueStatuses = [];
            const seenTypes = new Set();
            for (const status of statuses) {
                if (!seenTypes.has(status.type)) {
                    seenTypes.add(status.type);
                    uniqueStatuses.push(status);
                }
            }
            uniqueStatuses.sort((a, b) => a.priority - b.priority);
            if (uniqueStatuses.length === 1) {
                cell.style.background = uniqueStatuses[0].color;
            } else if (uniqueStatuses.length === 2) {
                cell.style.background = `linear-gradient(to bottom, 
                    ${uniqueStatuses[0].color} 0%, 
                    ${uniqueStatuses[0].color} 35%,
                    ${uniqueStatuses[1].color} 65%,
                    ${uniqueStatuses[1].color} 100%)`;
            } else if (uniqueStatuses.length === 3) {
                cell.style.background = `linear-gradient(to bottom, 
                    ${uniqueStatuses[0].color} 0%, 
                    ${uniqueStatuses[0].color} 25%,
                    ${uniqueStatuses[1].color} 40%,
                    ${uniqueStatuses[1].color} 60%,
                    ${uniqueStatuses[2].color} 75%,
                    ${uniqueStatuses[2].color} 100%)`;
            } else if (uniqueStatuses.length >= 4) {
                const segmentPercent = 100 / uniqueStatuses.length;
                const gradientStops = [];
                uniqueStatuses.forEach((status, index) => {
                    const startPercent = index * segmentPercent;
                    const endPercent = (index + 1) * segmentPercent;
                    const overlap = segmentPercent * 0.15;
                    gradientStops.push(`${status.color} ${startPercent}%`);
                    gradientStops.push(`${status.color} ${endPercent - overlap}%`);
                    if (index < uniqueStatuses.length - 1) {
                        gradientStops.push(`${uniqueStatuses[index + 1].color} ${endPercent - overlap}%`);
                    }
                });
                cell.style.background = `linear-gradient(to bottom, ${gradientStops.join(', ')})`;
            }
            if (uniqueStatuses.length > 0) {
                const tooltipLines = [`📅 ${currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`];
                tooltipLines.push('━━━━━━━━━━━━━━━━━');
                for (const status of uniqueStatuses) {
                    tooltipLines.push(status.label);
                }
                cell.setAttribute('data-tooltip', tooltipLines.join('\n'));
            } else {
                cell.setAttribute('data-tooltip', '');
            }
            for (const status of uniqueStatuses) {
                if (status.type === 'completed' && status.isCompletedDate) {
                    const checkSpan = document.createElement('div');
                    checkSpan.className = 'calendar-completed-check';
                    checkSpan.innerHTML = '✅';
                    checkSpan.title = `Completed: ${status.label}`;
                    cell.appendChild(checkSpan);
                    break;
                }
            }
            for (const status of uniqueStatuses) {
                if (status.type === 'active' && status.isStartDate && calendarQuestData.activeQuest) {
                    const questNameSpan = document.createElement('div');
                    questNameSpan.className = 'calendar-quest-name';
                    questNameSpan.textContent = `${calendarQuestData.activeQuest.title.substring(0, 15)}...`;
                    questNameSpan.title = calendarQuestData.activeQuest.title;
                    questNameSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.getElementById('calendar-modal').style.display = 'none';
                        openQuest(calendarQuestData.activeQuest.id);
                    });
                    cell.appendChild(questNameSpan);
                    break;
                }
            }
            for (const status of uniqueStatuses) {
                if (status.type === 'active' && status.isDueDate && calendarQuestData.activeQuest) {
                    cell.classList.add('quest-due');
                    const dueSpan = document.createElement('div');
                    dueSpan.className = 'calendar-quest-name';
                    dueSpan.textContent = `Due: ${calendarQuestData.activeQuest.title.substring(0, 10)}...`;
                    dueSpan.title = calendarQuestData.activeQuest.title;
                    dueSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.getElementById('calendar-modal').style.display = 'none';
                        openQuest(calendarQuestData.activeQuest.id);
                    });
                    cell.appendChild(dueSpan);
                    break;
                }
            }
        } else {
            cell.style.visibility = 'hidden';
            cell.style.pointerEvents = 'none';
        }
        grid.appendChild(cell);
    }
}

function calendarPrevMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderStudentCalendar();
}

function calendarNextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderStudentCalendar();
}

function setupCalendarTooltipDelegation() {
    const grid = document.getElementById('student-calendar-grid');
    if (!grid) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'calendar-custom-tooltip';
    tooltip.className = 'calendar-tooltip';
    document.body.appendChild(tooltip);
    grid.addEventListener('mousemove', (e) => {
        const cell = e.target.closest('.calendar-day');
        if (!cell) {
            tooltip.style.display = 'none';
            return;
        }
        const tooltipText = cell.getAttribute('data-tooltip');
        if (tooltipText && tooltipText !== '') {
            tooltip.innerHTML = tooltipText.replace(/\n/g, '<br>');
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    });
    grid.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}

// ==============================================
// SECTION 48: RESTRICTED ELEMENTS VISIBILITY
// ==============================================

function updateRestrictedElementsVisibility(questId) {
    const isAccepted = questAccepted[questId] === true;
    const isCompleted = completedQuests[questId] === true;
    const hasTimer = quests[questId]?.timer !== undefined;
    const canAccess = !hasTimer || isAccepted || isCompleted;
    const finishedWorkBtn = document.getElementById("finished-work-btn");
    const linksContainer = document.getElementById("quest-links");
    if (finishedWorkBtn) {
        const newBtn = finishedWorkBtn.cloneNode(true);
        finishedWorkBtn.parentNode.replaceChild(newBtn, finishedWorkBtn);
        if (!canAccess) {
            newBtn.style.opacity = "0.5";
            newBtn.style.cursor = "not-allowed";
            newBtn.title = "You must accept this quest first";
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                showAcceptQuestRestrictionPopup(questId);
            });
        } else {
            newBtn.style.opacity = "1";
            newBtn.style.cursor = "pointer";
            newBtn.title = "Upload your finished work";
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (!currentQuestId) {
                    alert("Please open a quest first to add your work.");
                    return;
                }
                openWorkOverlay(currentQuestId);
            });
        }
    }
    if (linksContainer) {
        if (!canAccess) {
            linksContainer.style.opacity = "0.5";
            linksContainer.style.pointerEvents = "none";
            linksContainer.title = "You must accept this quest first";
        } else {
            linksContainer.style.opacity = "1";
            linksContainer.style.pointerEvents = "auto";
            linksContainer.title = "";
        }
    }
}

// ==============================================
// SECTION 48b: SYNCHRONOUS RESTRICTED ELEMENTS (for instant quest open)
// ==============================================

function updateRestrictedElementsVisibilitySync(questId) {
    const isAccepted = questAccepted[questId] === true;
    const isCompleted = completedQuests[questId] === true;
    const hasTimer = quests[questId]?.timer !== undefined;
    const canAccess = !hasTimer || isAccepted || isCompleted;
    
    const finishedWorkBtn = document.getElementById("finished-work-btn");
    const linksContainer = document.getElementById("quest-links");
    
    if (finishedWorkBtn) {
        const newBtn = finishedWorkBtn.cloneNode(true);
        finishedWorkBtn.parentNode.replaceChild(newBtn, finishedWorkBtn);
        if (!canAccess) {
            newBtn.style.opacity = "0.5";
            newBtn.style.cursor = "not-allowed";
            newBtn.title = "You must accept this quest first";
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                showAcceptQuestRestrictionPopup(questId);
            });
        } else {
            newBtn.style.opacity = "1";
            newBtn.style.cursor = "pointer";
            newBtn.title = "Upload your finished work";
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (!currentQuestId) {
                    alert("Please open a quest first to add your work.");
                    return;
                }
                openWorkOverlay(currentQuestId);
            });
        }
    }
    
    if (linksContainer) {
        if (!canAccess) {
            linksContainer.style.opacity = "0.5";
            linksContainer.style.pointerEvents = "none";
            linksContainer.title = "You must accept this quest first";
        } else {
            linksContainer.style.opacity = "1";
            linksContainer.style.pointerEvents = "auto";
            linksContainer.title = "";
        }
    }
}

// ==============================================
// SECTION 49: RESTRICTION POPUPS
// ==============================================

function showAcceptQuestRestrictionPopup(questId) {
    const quest = quests[questId];
    const popup = document.getElementById("accept-quest-restriction-popup");
    const messageEl = document.getElementById("accept-quest-restriction-message");
    if (messageEl) {
        messageEl.innerText = `You must accept the quest "${quest?.title || questId}" first before accessing samples or uploading work.`;
    }
    if (popup) popup.style.display = "flex";
}

function closeAcceptQuestRestrictionPopup() {
    const popup = document.getElementById("accept-quest-restriction-popup");
    if (popup) popup.style.display = "none";
}

// ==============================================
// SECTION 50: WORK OVERLAY FUNCTIONS
// ==============================================

async function openWorkOverlay(questId) {
    await loadCloudWorksIntoGallery();
    const overlay = document.getElementById("work-overlay");
    if (!overlay) {
        console.error("Work overlay element not found!");
        return;
    }
    const targetQuestId = questId || currentQuestId;
    if (!targetQuestId) {
        console.error("No quest ID available to open work overlay");
        return;
    }
    overlay.style.display = "flex";
    overlay.dataset.questId = targetQuestId;
    document.getElementById("work-title").value = "";
    document.getElementById("work-size").value = "";
    document.getElementById("work-media").value = "";
    document.getElementById("work-description").value = "";
    const preview = document.getElementById("image-preview");
    if (preview) {
        preview.src = "";
        preview.style.display = "none";
        preview.style.cursor = "pointer";
        preview.removeEventListener("click", handlePreviewClick);
        preview.addEventListener("click", handlePreviewClick);
    }
    if (studentWorks && studentWorks[targetQuestId]) {
        const work = studentWorks[targetQuestId];
        document.getElementById("work-title").value = work.title || "";
        document.getElementById("work-size").value = work.size || "";
        document.getElementById("work-media").value = work.media || "";
        document.getElementById("work-description").value = work.description || "";
        if (work.image && preview) {
            preview.src = work.image;
            preview.style.display = "block";
        }
    }
    const imageInput = document.getElementById("work-image");
    if (imageInput) imageInput.value = "";
}

// ==============================================
// SECTION 51: JSON PROFILE SAVE/LOAD SYSTEM
// ==============================================

function collectStudentData() {
    const studentProfile = loadStudentProfile() || {
        name: document.getElementById('student-name')?.textContent || 'Unnamed Artist',
        character: document.getElementById('student-avatar')?.src || 'profile.png'
    };
    const studentData = {
        name: studentProfile.name,
        character: studentProfile.character,
        studentProfile: studentProfile,
        timestamp: new Date().toISOString(),
        completedQuests: completedQuests,
        questGrades: questGrades,
        rubricLocked: rubricLocked,
        questAccepted: questAccepted,
        questStartTimes: questStartTimes,
        works: studentWorks,
        questRewards: questRewards,
        earnedBadges: earnedBadges,
        standards: {},
        appName: "Artheim",
        version: "1.0",
        exportDate: new Date().toLocaleString()
    };
    document.querySelectorAll('#standards-table tbody tr').forEach(row => {
        const standard = row.getAttribute('data-standard');
        const gradeCell = row.children[1];
        const mvpCell = row.querySelector('.mvp-cell');
        if (standard) {
            studentData.standards[standard] = {
                regular: gradeCell?.textContent.trim() || '',
                mvp: mvpCell?.textContent.trim() || ''
            };
        }
    });
    return studentData;
}

function saveProfileAsJSON() {
    const studentData = collectStudentData();
    const jsonString = JSON.stringify(studentData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const studentName = document.getElementById('student-name')?.textContent || 'Student';
    const sanitizedName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.download = `Artheim-${sanitizedName}-${dateStr}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    const completedCount = Object.values(studentData.completedQuests || {}).filter(v => v).length;
    const gradedCount = Object.keys(studentData.questGrades || {}).length;
    alert(`✅ Profile saved successfully!\n\nFilename: ${link.download}\nCompleted quests: ${completedCount}\nGraded quests: ${gradedCount}\n\nSave this file to backup your progress.`);
}

function loadProfileFromJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const studentData = JSON.parse(jsonString);
            if (!studentData.appName || studentData.appName !== "Artheim") {
                throw new Error('This is not a valid Artheim profile file.');
            }
            const completedCount = Object.values(studentData.completedQuests || {}).filter(v => v).length;
            const gradedCount = Object.keys(studentData.questGrades || {}).length;
            if (confirm(`Load profile for "${studentData.name}"?\n\nCompleted quests: ${completedCount}\nGraded quests: ${gradedCount}\nExport date: ${studentData.exportDate || 'Unknown'}\n\nThis will OVERRIDE all current progress and grades.`)) {
                loadStudentData(studentData);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile: ' + error.message);
        }
    };
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    reader.readAsText(file);
}

function loadStudentData(data) {
    const currentProfile = loadStudentProfile() || {};
    const currentStudentName = currentProfile.name || "";
    const loadedStudentName = data.name || "";
    const isSameStudent = (currentStudentName === loadedStudentName && currentStudentName !== "");
    if (!isSameStudent) {
        earnedBadges = {};
        completedQuests = {};
        questGrades = {};
        studentWorks = {};
        questRewards = {};
        rubricLocked = {};
        questAccepted = {};
        questStartTimes = {};
        saveEarnedBadges();
        saveQuestData();
        saveQuestGrades();
        saveStudentWorks();
        saveQuestRewards();
        saveRubricLocks();
        saveQuestAccepted();
        saveQuestStartTimes();
    }
    if (data.name) {
        const nameElement = document.getElementById("student-name");
        if (nameElement) nameElement.innerText = data.name;
        const profile = loadStudentProfile() || {};
        profile.name = data.name;
        if (data.character) profile.character = data.character;
        saveStudentProfile(profile);
    }
    if (data.character) {
        const avatar = document.getElementById("student-avatar");
        if (avatar) avatar.src = data.character;
        const profileBtn = document.querySelector(".profile-btn img");
        if (profileBtn) profileBtn.src = data.character;
        const profile = loadStudentProfile() || {};
        profile.character = data.character;
        if (data.name) profile.name = data.name;
        saveStudentProfile(profile);
    }
    if (data.studentProfile) saveStudentProfile(data.studentProfile);
    if (data.completedQuests) {
        if (isSameStudent) {
            for (const key in completedQuests) delete completedQuests[key];
        }
        Object.assign(completedQuests, data.completedQuests);
        saveQuestData();
    }
    if (data.questGrades) {
        if (isSameStudent) {
            for (const key in questGrades) delete questGrades[key];
        }
        Object.assign(questGrades, data.questGrades);
        if (!isLoadingFromCloud) saveQuestGrades();
    }
    if (data.rubricLocked) {
        if (isSameStudent) {
            for (const key in rubricLocked) delete rubricLocked[key];
        }
        Object.assign(rubricLocked, data.rubricLocked);
        saveRubricLocks();
    }
    if (data.questAccepted) {
        if (isSameStudent) {
            for (const key in questAccepted) delete questAccepted[key];
        }
        Object.assign(questAccepted, data.questAccepted);
        saveQuestAccepted();
    }
    if (data.questStartTimes) {
        if (isSameStudent) {
            for (const key in questStartTimes) delete questStartTimes[key];
        }
        Object.assign(questStartTimes, data.questStartTimes);
        saveQuestStartTimes();
    }
    if (data.works) {
        if (isSameStudent) {
            for (const key in studentWorks) delete studentWorks[key];
        }
        Object.assign(studentWorks, data.works);
        saveStudentWorks();
    }
    if (data.questRewards) {
        if (isSameStudent) {
            for (const key in questRewards) delete questRewards[key];
        }
        Object.assign(questRewards, data.questRewards);
        saveQuestRewards();
    }
    if (data.standards) {
        Object.entries(data.standards).forEach(([standard, grades]) => {
            const row = document.querySelector(`tr[data-standard="${standard}"]`);
            if (row) {
                const gradeCell = row.children[1];
                const mvpCell = row.querySelector('.mvp-cell');
                if (gradeCell && grades.regular) gradeCell.textContent = grades.regular;
                if (mvpCell && grades.mvp) mvpCell.textContent = grades.mvp;
            }
        });
    }
    if (data.earnedBadges) {
        earnedBadges = data.earnedBadges;
    } else {
        earnedBadges = {};
    }
    saveEarnedBadges();
    if (badgesData) {
        const previousBadges = { ...earnedBadges };
        earnedBadges = {};
        badgesData.forEach(badge => {
            if (badge.teacherAwarded && previousBadges[badge.id]?.earned) {
                earnedBadges[badge.id] = previousBadges[badge.id];
                return;
            }
            if (badge.progression) {
                checkProgressionBadge(badge);
            } else if (badge.checkFunction) {
                let earned = false;
                if (badge.checkFunction === "checkPathMastery") {
                    earned = checkPathMastery(badge.params);
                } else if (badge.checkFunction === "checkColorExpert") {
                    earned = checkColorExpert(badge.params);
                } else if (badge.checkFunction === "checkPerspectivePro") {
                    earned = checkPerspectivePro(badge.params);
                }
                if (earned) {
                    earnedBadges[badge.id] = {
                        earned: true,
                        earnedAt: previousBadges[badge.id]?.earnedAt || new Date().toISOString()
                    };
                }
            }
        });
        const earnedCount = Object.values(earnedBadges).filter(b => b.earned).length;
        console.log(`After re-validation: ${earnedCount} badges earned`);
    }
    saveEarnedBadges();
    recalculateAllQuestRewards();
    updateProfileUI();
    updateProfileStandardsTable();
    renderRadarChart();
    renderCompletedQuests();
    renderAchievementsList();
    updateProfileRewards();
    initializeQuestTimers();
    if (document.getElementById("profile-overlay").style.display === "flex") {
        if (typeof renderBadges === 'function') renderBadges();
    }
    setTimeout(() => {
        const completedCount = Object.values(completedQuests).filter(v => v).length;
        const gradedCount = Object.keys(questGrades).length;
        const worksCount = Object.keys(studentWorks).length;
        const badgesCount = Object.values(earnedBadges).filter(b => b.earned).length;
        alert(`✅ Profile for "${data.name || 'Student'}" loaded successfully!\n\nCompleted quests: ${completedCount}\nGraded quests: ${gradedCount}\nSaved works: ${worksCount}\nBadges earned: ${badgesCount}\n\nYour progress has been restored.`);
        const profileOverlay = document.getElementById('profile-overlay');
        if (profileOverlay) profileOverlay.style.display = 'none';
    }, 300);
}

window.ArtheimProfile = {
    saveProfileAsJSON,
    loadProfileFromJSON,
    collectStudentData,
    loadStudentData
};

// ==============================================
// SECTION 52: MINUTES TO CLASSES CONVERSION
// ==============================================

function convertMinutesToClasses(minutes) {
    if (typeof minutes !== 'number' || isNaN(minutes)) return "0 classes";
    const classes = Math.round(minutes / 75);
    return classes === 1 ? "1 class" : `${classes} classes`;
}

function convertMinutesToClassesDecimal(minutes, decimalPlaces = 1) {
    if (typeof minutes !== 'number' || isNaN(minutes)) return "0 classes";
    const classes = (minutes / 75).toFixed(decimalPlaces);
    return `${classes} classes`;
}

// ==============================================
// SECTION 53: QUEST RESTRICTION FUNCTIONS
// ==============================================

function getActiveQuestId() {
    for (const questId in questAccepted) {
        if (questAccepted[questId] && !completedQuests[questId]) {
            return questId;
        }
    }
    return null;
}

function updateActiveQuestId() {
    activeQuestId = getActiveQuestId();
    return activeQuestId;
}

function canAcceptQuest(questId) {
    updateActiveQuestId();
    const quest = quests[questId];
    if (!quest) return { allowed: false, reason: "Quest not found" };
    if (activeQuestId && activeQuestId !== questId) {
        return { 
            allowed: false, 
            reason: "active_quest",
            activeQuestId: activeQuestId
        };
    }
    if (quest.style === "mvp") {
        const prerequisites = quest.prerequisites || [];
        const completedPrereqs = prerequisites.filter(prereqId => completedQuests[prereqId]);
        const requiredPrereqs = prerequisites.length >= 2 ? 2 : prerequisites.length;
        if (completedPrereqs.length < requiredPrereqs) {
            return {
                allowed: false,
                reason: "prerequisites",
                prerequisites: prerequisites,
                completed: completedPrereqs.length,
                required: requiredPrereqs
            };
        }
    }
    return { allowed: true };
}

function initializeActiveQuest() {
    activeQuestId = getActiveQuestId();
}

// ==============================================
// SECTION 54: QUEST LIST FUNCTIONS
// ==============================================

function renderQuestList(filter = 'all') {
    const container = document.getElementById('questlist-container');
    if (!container) return;
    container.innerHTML = '';
    if (!quests || Object.keys(quests).length === 0) {
        container.innerHTML = '<div class="questlist-empty">Loading quests...</div>';
        return;
    }
    let filteredQuests = [];
    switch(filter) {
        case 'active':
            filteredQuests = Object.entries(quests).filter(([id, quest]) => 
                questAccepted[id] && quest.timer
            );
            break;
        case 'paintersPath':
        case 'sketcherPath':
        case 'watercoloursPath':
        case '3DPath':
            const pathMap = {
                'paintersPath': 'Painter Path',
                'sketcherPath': 'Sketcher Path', 
                'watercoloursPath': 'Watercolor Path',
                '3DPath': '3D Path'
            };
            const targetPath = pathMap[filter];
            filteredQuests = Object.entries(quests).filter(([id, quest]) => {
                if (!quest.path) return false;
                if (Array.isArray(quest.path)) {
                    return quest.path.includes(targetPath);
                }
                return false;
            });
            break;
        default:
            filteredQuests = Object.entries(quests);
    }
    filteredQuests.sort(([idA], [idB]) => {
        const numA = parseInt(idA.replace('quest', '')) || 0;
        const numB = parseInt(idB.replace('quest', '')) || 0;
        return numA - numB;
    });
    const countEl = document.getElementById('questlist-count');
    if (countEl) {
        countEl.textContent = `${filteredQuests.length} ${filter === 'all' ? 'total' : 'filtered'} quest${filteredQuests.length !== 1 ? 's' : ''}`;
    }
    if (filteredQuests.length === 0) {
        container.innerHTML = '<div class="questlist-empty">No quests match your filter</div>';
        return;
    }
    filteredQuests.forEach(([id, quest]) => {
        const isActive = questAccepted[id] && quest.timer && !completedQuests[id];
        const isCompleted = completedQuests[id];
        const isCustom = quest.teacher_quest === true || quest.is_custom === true;
        const questElement = document.createElement('div');
        questElement.className = `questlist-item ${isActive ? 'active' : ''} ${isCustom ? 'custom-quest-item' : ''}`;
        questElement.dataset.questId = id;
        let timerDisplay = '';
        if (quest.timer) {
            const allottedMinutes = quest.timer.allottedMinutes || 0;
            const classes = Math.round(allottedMinutes / 75);
            timerDisplay = `${classes} class${classes !== 1 ? 'es' : ''}`;
        }
        let pathDisplay = 'No path assigned';
        if (quest.path && Array.isArray(quest.path)) {
            pathDisplay = quest.path.join(', ');
        }
        questElement.innerHTML = `
            <div class="questlist-header">
                <h3 class="questlist-title">${quest.title || 'Untitled Quest'}</h3>
                <span class="questlist-id">${id}</span>
                ${isCustom ? '<span class="custom-quest-badge">📝 Custom</span>' : ''}
            </div>
            <div class="questlist-details">
                <div>
                    <span class="questlist-path">${pathDisplay}</span>
                    ${quest.timer ? `<span class="questlist-timer ${isActive ? 'active' : ''}">⏱ ${timerDisplay}</span>` : ''}
                </div>
                <div>
                    ${isCompleted ? '<span class="questlist-completed">✓ Completed</span>' : ''}
                    ${isActive ? '<span class="questlist-timer active">🔴 Active</span>' : ''}
                </div>
            </div>
        `;
        questElement.addEventListener('click', async () => {
            console.log("Quest clicked:", id);
            const achievementsOverlay = document.getElementById('achievements-overlay');
            if (achievementsOverlay) achievementsOverlay.style.display = 'none';
            console.log("Loading all quests...");
            const allQuests = await getAllQuestsForStudent();
            console.log("All quests loaded:", Object.keys(allQuests).length);
            const quest = allQuests[id];
            console.log("Found quest:", quest);
            if (quest) {
                console.log("Opening quest:", id);
                openQuest(id);
            } else {
                console.error("Quest not found:", id);
            }
        });    
        container.appendChild(questElement);
    });
}

function initializeQuestList() {
    const filterSelect = document.getElementById('questlist-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            renderQuestList(e.target.value);
        });
    }
}

// ==============================================
// SECTION 55: LOAD TEACHER CUSTOM QUESTS
// ==============================================

async function loadTeacherCustomQuests() {
    const profile = loadStudentProfile();
    if (!profile || !profile.teacher_code) {
        return [];
    }
    const { data: teacher, error: teacherError } = await window.supabase
        .from('teachers')
        .select('id')
        .eq('class_code', profile.teacher_code)
        .single();
    if (teacherError || !teacher) {
        console.log("Teacher not found for code:", profile.teacher_code);
        return [];
    }
    const { data, error } = await window.supabase
        .from('teacher_custom_quests')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('deleted', false);
    if (error) {
        console.error("Error loading custom quests:", error);
        return [];
    }
    return data || [];
}

async function getAllQuestsForStudent(forceRefresh = false) {
    if (forceRefresh) {
        console.log("Force refresh - bypassing cache");
        cachedQuests = null;
        cachedQuestsIncludeCustom = false;
    }
    if (cachedQuests && cachedQuestsIncludeCustom && !forceRefresh) {
        console.log("Returning cached quests with custom quests included, count:", Object.keys(cachedQuests).length);
        return cachedQuests;
    }
    console.log("Loading quests with custom quests...");
    const baseQuests = await getQuests();
    const customQuests = await loadTeacherCustomQuests();
    const allQuests = { ...baseQuests };
    for (let i = 0; i < customQuests.length; i++) {
        const custom = customQuests[i];
        const customImages = [
            "charimage/custom1.gif",
            "charimage/custom2.gif",
            "charimage/custom3.gif",
            "charimage/custom4.gif",
            "charimage/custom5.gif"
        ];
        const imageIndex = i % customImages.length;
        const characterImage = customImages[imageIndex];
        allQuests[custom.quest_id] = {
            path: [custom.path],
            difficulty: custom.difficulty,
            title: custom.title,
            rationale: custom.rationale,
            description: custom.description,
            requirements: custom.requirements,
            rubric: custom.rubric,
            links: custom.links,
            reward: "",
            character: characterImage,
            style: "custom",
            prerequisites: [],
            timer: { allottedMinutes: 75 },
            is_custom: true,
            teacher_quest: true
        };
    }
    cachedQuests = allQuests;
    cachedQuestsIncludeCustom = true;
    console.log("Quests with custom quests cached successfully:", Object.keys(cachedQuests).length, "quests found");
    return cachedQuests;
}

async function addCustomQuestHotspots() {
    if (isAddingHotspots) {
        console.log("Already adding hotspots, skipping...");
        return;
    }
    isAddingHotspots = true;
    try {
        const hasCustomQuests = Object.keys(quests).some(id => id.startsWith('custom_'));
        if (!hasCustomQuests) {
            console.log("Custom quests missing from quests object, refreshing...");
            const freshQuests = await getAllQuestsForStudent(true);
            quests = freshQuests;
            cachedQuests = freshQuests;
            console.log("Quests refreshed, now has:", Object.keys(quests).length, "quests");
            console.log("Custom quests now:", Object.keys(quests).filter(id => id.startsWith('custom_')));
        }
        if (!quests || Object.keys(quests).length === 0) {
            console.log("Quests not loaded yet, waiting...");
            setTimeout(() => addCustomQuestHotspots(), 500);
            return;
        }
        const customQuests = await loadTeacherCustomQuests();
        console.log("Adding custom quest hotspots, found:", customQuests.length);
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;
        const existingHotspots = document.querySelectorAll('.hotspot.custom-quest-hotspot');
        existingHotspots.forEach(hotspot => hotspot.remove());
        const customPositions = [
            { top: "71.8%", left: "23.2%" },
            { top: "71%", left: "5%" },
            { top: "83.5%", left: "22.6%" },
            { top: "88.3%", left: "10%" },
            { top: "93.8%", left: "26%" }
        ];
        for (let i = 0; i < customQuests.length && i < customPositions.length; i++) {
            const quest = customQuests[i];
            const pos = customPositions[i];
            if (!quests[quest.quest_id]) {
                console.log(`Warning: Quest ${quest.quest_id} not found in quests object`);
                continue;
            }
            const hotspot = document.createElement('div');
            hotspot.className = 'hotspot debug custom-quest-hotspot';
            hotspot.setAttribute('data-city', quest.quest_id);
            hotspot.setAttribute('data-map', 'map2');
            hotspot.style.top = pos.top;
            hotspot.style.left = pos.left;
            hotspot.style.position = 'absolute';
            hotspot.title = quest.title;
            hotspot.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Custom quest clicked:", quest.quest_id);
                console.log("Quest exists in quests?", !!quests[quest.quest_id]);
                if (quests[quest.quest_id]) {
                    openQuest(quest.quest_id);
                } else {
                    console.error("Quest not found in quests object!");
                }
            });
            mapContainer.appendChild(hotspot);
            console.log("Added custom quest hotspot for:", quest.title, "on map2");
        }
        bindHotspots();
        updateHotspotVisibility();
    } catch (error) {
        console.error("Error adding custom quest hotspots:", error);
    } finally {
        isAddingHotspots = false;
    }
}

// ==============================================
// SECTION 56: RESPONSIVE HELPER FUNCTIONS
// ==============================================

function handleOrientationChange() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait && window.innerWidth < 768) {
        document.querySelectorAll('.hotspot').forEach(hotspot => {
            hotspot.style.transform = 'translate(-50%, -50%) scale(1.2)';
        });
    } else {
        document.querySelectorAll('.hotspot').forEach(hotspot => {
            hotspot.style.transform = 'translate(-50%, -50%)';
        });
    }
    if (document.getElementById('profile-overlay').style.display === 'flex') {
        renderRadarChart();
    }
}

function initializeTouchEvents() {
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'SELECT' ||
            e.target.classList.contains('hotspot') ||
            e.target.classList.contains('tab-button')) {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    document.addEventListener('touchstart', function(e) {
        const target = e.target;
        if (target.tagName === 'BUTTON' || 
            target.classList.contains('tab-button') ||
            target.classList.contains('profile-btn-small') ||
            target.classList.contains('hotspot')) {
            target.classList.add('touch-active');
        }
    });
    document.addEventListener('touchend', function(e) {
        const target = e.target;
        if (target.classList.contains('touch-active')) {
            setTimeout(() => {
                target.classList.remove('touch-active');
            }, 150);
        }
    });
}

function adjustHotspotPositions() {
    updateHotspotPositions();
}

function initializeResponsiveBehaviors() {
    handleOrientationChange();
    adjustHotspotPositions();
    initializeTouchEvents();
    window.addEventListener('resize', () => {
        handleOrientationChange();
        adjustHotspotPositions();
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleOrientationChange();
            adjustHotspotPositions();
        }, 300);
    });
}

// ==============================================
// SECTION 57: HELP MODAL
// ==============================================

window.closeHelpModal = function() {
    if (helpModal) {
        helpModal.style.display = 'none';
    }
};

function initializeHelpModal() {
    helpModal = document.getElementById('helpModal');
    helpBtn = document.getElementById('helpButton');
    closeBtn = document.getElementById('closeModalBtn');
    if (!helpModal || !helpBtn || !closeBtn) {
        console.warn("Help modal elements not found - check IDs in HTML");
        return;
    }
    function openHelpModal(e) {
        e.preventDefault();
        e.stopPropagation();
        helpModal.style.display = 'block';
    }
    helpBtn.addEventListener('click', openHelpModal);
    closeBtn.addEventListener('click', window.closeHelpModal);
    window.addEventListener('click', function(event) {
        if (event.target === helpModal) {
            window.closeHelpModal();
        }
    });
}

// ==============================================
// SECTION 58: GALLERY FUNCTIONS
// ==============================================

function openGallery() {
    const overlay = document.getElementById("gallery-overlay");
    if (!overlay) return;
    const profile = loadStudentProfile() || {};
    const studentName = profile.name || "Student";
    const header = document.getElementById("gallery-student-name");
    if (header) {
        header.textContent = `${studentName}'s Art Gallery`;
    }
    renderGalleryItems();
    overlay.style.display = "flex";
}

function closeGallery() {
    const overlay = document.getElementById("gallery-overlay");
    if (overlay) overlay.style.display = "none";
}

async function loadCloudWorksIntoGallery() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        console.log("Not logged in, cannot load from cloud");
        return;
    }
    const { data, error } = await window.supabase
        .from('student_works')
        .select('*')
        .eq('user_id', session.user.id);
    if (error) {
        console.error("Error loading from cloud:", error);
        return;
    }
    const cloudQuestIds = new Set();
    if (data && data.length > 0) {
        data.forEach(work => {
            cloudQuestIds.add(work.quest_id);
            studentWorks[work.quest_id] = {
                title: work.title || "",
                size: work.size || "",
                media: work.media || "",
                description: work.description || "",
                image: work.image_url || "",
                image_url: work.image_url || "",
                lastModified: work.uploaded_at || new Date().toISOString()
            };
        });
    }
    for (let questId in studentWorks) {
        if (!cloudQuestIds.has(questId)) {
            delete studentWorks[questId];
        }
    }
    saveStudentWorks();
}

async function renderGalleryItems() {
    await loadCloudWorksIntoGallery();
    const galleryGrid = document.getElementById("gallery-grid");
    if (!galleryGrid) return;
    galleryGrid.innerHTML = "";
    const works = studentWorks || {};
    const worksArray = Object.entries(works);
    if (worksArray.length === 0) {
        galleryGrid.innerHTML = '<div class="gallery-empty">No artworks uploaded yet</div>';
        return;
    }
    worksArray.forEach(([questId, work]) => {
        if (!work.title && !work.image && !work.description) return;
        const galleryItem = document.createElement("div");
        galleryItem.className = "gallery-item";
        const quest = quests[questId];
        if (quest && quest.style === "mvp") {
            galleryItem.classList.add("mvp");
        }
        galleryItem.dataset.questId = questId;
        const thumbnailWrapper = document.createElement("div");
        thumbnailWrapper.className = "gallery-thumbnail-wrapper";
        const thumbnail = document.createElement("img");
        thumbnail.className = "gallery-thumbnail";
        if (work.image_url) {
            thumbnail.src = work.image_url;
            thumbnail.style.cursor = "pointer";
            thumbnail.addEventListener("click", (e) => {
                e.stopPropagation();
                openFullscreenImage(work, quest);
            });
        } else if (work.image) {
            thumbnail.src = work.image;
            thumbnail.style.cursor = "pointer";
            thumbnail.addEventListener("click", (e) => {
                e.stopPropagation();
                openFullscreenImage(work, quest);
            });
        } else {
            const questData = quests[questId];
            thumbnail.src = questData?.character || "placeholder.png";
            thumbnail.style.opacity = "0.7";
            thumbnail.style.cursor = "default";
        }
        thumbnail.alt = work.title || "Artwork";
        const title = document.createElement("div");
        title.className = "gallery-title";
        title.textContent = work.title || "Untitled";
        const info = document.createElement("div");
        info.className = "gallery-info";
        if (work.size || work.media) {
            info.textContent = [work.size, work.media].filter(Boolean).join(" • ");
            info.style.fontSize = "11px";
            info.style.opacity = "0.7";
            info.style.marginTop = "4px";
        }
        thumbnailWrapper.appendChild(thumbnail);
        galleryItem.appendChild(thumbnailWrapper);
        galleryItem.appendChild(title);
        if (info.textContent) galleryItem.appendChild(info);
        galleryItem.addEventListener("click", (e) => {
            if (e.target === thumbnail) return;
            closeGallery();
            setTimeout(() => {
                if (quests[questId]) {
                    openQuest(questId);
                    setTimeout(() => {
                        openWorkOverlay(questId);
                    }, 100);
                }
            }, 100);
        });
        galleryGrid.appendChild(galleryItem);
    });
    if (galleryGrid.children.length === 0) {
        galleryGrid.innerHTML = '<div class="gallery-empty">No artworks uploaded yet</div>';
    }
}

function initializeGallery() {
    const closeBtn = document.getElementById("close-gallery");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeGallery);
    }
    const overlay = document.getElementById("gallery-overlay");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeGallery();
        });
    }
}

// ==============================================
// SECTION 59: FULLSCREEN IMAGE VIEWER
// ==============================================

function initializeFullscreenViewer() {
    const overlay = document.getElementById("fullscreen-image-overlay");
    const closeBtn = document.getElementById("fullscreen-close");
    if (!overlay || !closeBtn) return;
    closeBtn.addEventListener("click", closeFullscreenImage);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeFullscreenImage();
    });
}

function openFullscreenImage(work, quest) {
    const overlay = document.getElementById("fullscreen-image-overlay");
    const fullscreenImg = document.getElementById("fullscreen-image");
    const titleEl = document.getElementById("fullscreen-title");
    const detailsEl = document.getElementById("fullscreen-details");
    const descriptionEl = document.getElementById("fullscreen-description");
    if (!overlay || !fullscreenImg) return;
    fullscreenImg.src = work.image || work.image_url;
    titleEl.textContent = work.title || "Untitled";
    let details = [];
    if (quest && quest.title) details.push(`Quest: ${quest.title}`);
    if (work.size) details.push(`Size: ${work.size}`);
    if (work.media) details.push(`Media: ${work.media}`);
    detailsEl.textContent = details.join(" • ");
    descriptionEl.textContent = work.description || "";
    overlay.style.display = "flex";
    const escHandler = function(e) {
        if (e.key === "Escape") {
            closeFullscreenImage();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
    overlay.escHandler = escHandler;
}

function closeFullscreenImage() {
    const overlay = document.getElementById("fullscreen-image-overlay");
    if (!overlay) return;
    overlay.style.display = "none";
    if (overlay.escHandler) {
        document.removeEventListener("keydown", overlay.escHandler);
        delete overlay.escHandler;
    }
}

// ==============================================
// SECTION 60: RESTRICTION POPUP FUNCTIONS
// ==============================================

function showRestrictionPopup(activeQuestId) {
    const popup = document.getElementById("restriction-popup");
    const link = document.getElementById("active-quest-link");
    const activeQuest = quests[activeQuestId];
    if (activeQuest) {
        link.textContent = `"${activeQuest.title}"`;
        link.onclick = (e) => {
            e.preventDefault();
            closeRestrictionPopup();
            const questOverlay = document.getElementById("quest-overlay");
            if (questOverlay && questOverlay.style.display === "block") {
                closeQuest();
            }
            setTimeout(() => {
                openQuest(activeQuestId);
            }, 100);
        };
    }
    popup.style.display = "flex";
}

function closeRestrictionPopup() {
    const popup = document.getElementById("restriction-popup");
    if (popup) popup.style.display = "none";
}

function showPrerequisitePopup(message, prerequisites) {
    const popup = document.getElementById("prerequisite-popup");
    const messageEl = document.getElementById("prerequisite-message");
    const listEl = document.getElementById("prerequisite-quests-list");
    if (messageEl) messageEl.textContent = message;
    if (prerequisites && prerequisites.length > 0) {
        let listHTML = "<ul style='list-style: none; padding: 0;'>";
        prerequisites.forEach(prereqId => {
            const quest = quests[prereqId];
            if (quest) {
                const completed = completedQuests[prereqId] ? "✓" : "✗";
                const color = completedQuests[prereqId] ? "#4CAF50" : "#ff6b6b";
                listHTML += `<li style='margin: 8px 0; color: ${color};'>${completed} ${quest.title}</li>`;
            }
        });
        listHTML += "</ul>";
        if (listEl) listEl.innerHTML = listHTML;
    }
    if (popup) popup.style.display = "flex";
}

function closePrerequisitePopup() {
    const popup = document.getElementById("prerequisite-popup");
    if (popup) popup.style.display = "none";
}

// ==============================================
// SECTION 61: QUEST CACHING (BANDWIDTH OPTIMIZATION)
// ==============================================

let cachedQuestsIncludeCustom = false;

async function getQuests() {
    if (cachedQuests) {
        console.log("Returning cached quests, count:", Object.keys(cachedQuests).length);
        return cachedQuests;
    }
    const framework = await detectTeacherFramework();
    const questsFile = getQuestsFileForFramework(framework);
    console.log(`Loading quests from ${questsFile} based on teacher's framework...`);
    const response = await fetch(questsFile);
    const rawQuests = await response.json();
    const filteredQuests = {};
    for (const [key, value] of Object.entries(rawQuests)) {
        if (key.startsWith('quest') && value && typeof value === 'object') {
            filteredQuests[key] = value;
        }
    }
    cachedQuests = filteredQuests;
    console.log("Quests cached successfully:", Object.keys(cachedQuests).length, "quests found");
    return cachedQuests;
}

function refreshQuestsCache() {
    refreshAllQuestCaches();
    console.log("Quest cache cleared by refreshQuestsCache()");
}

function refreshAllQuestCaches() {
    cachedQuests = null;
    cachedQuestsIncludeCustom = false;
    localStorage.removeItem(QUEST_CACHE_KEY);
    localStorage.removeItem(QUEST_CACHE_VERSION_KEY);
    localStorage.removeItem(QUEST_CACHE_TIMESTAMP_KEY);
    console.log("All quest caches cleared (memory + localStorage)");
}

async function getQuestsWithLocalCache(forceRefresh = false) {
    if (forceRefresh) {
        console.log("Force refresh - clearing in-memory cache");
        cachedQuests = null;
        cachedQuestsIncludeCustom = false;
    }
    let teacherTimestamp = null;
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            const { data: profile } = await window.supabase
                .from('profiles')
                .select('teacher_code')
                .eq('id', session.user.id)
                .single();
            if (profile?.teacher_code) {
                const { data: teacher } = await window.supabase
                    .from('teachers')
                    .select('quests_updated_at')
                    .eq('class_code', profile.teacher_code)
                    .single();
                teacherTimestamp = teacher?.quests_updated_at ? new Date(teacher.quests_updated_at).getTime() : null;
            }
        }
    } catch(e) {
        console.log("Could not check teacher timestamp:", e);
    }
    const cachedTimestamp = localStorage.getItem(QUEST_CACHE_TIMESTAMP_KEY);
    const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : Infinity;
    const isCacheExpired = cacheAge > QUEST_CACHE_DURATION;
    const teacherHasNewerQuests = teacherTimestamp && cachedTimestamp && teacherTimestamp > parseInt(cachedTimestamp);
    if (forceRefresh || teacherHasNewerQuests || isCacheExpired) {
        console.log("Refreshing quest cache...", {
            forceRefresh,
            teacherHasNewerQuests,
            isCacheExpired
        });
        const freshQuests = await getAllQuestsForStudent(true);
        cachedQuests = freshQuests;
        quests = freshQuests;
        localStorage.setItem(QUEST_CACHE_KEY, JSON.stringify(freshQuests));
        localStorage.setItem(QUEST_CACHE_VERSION_KEY, QUEST_CACHE_VERSION);
        localStorage.setItem(QUEST_CACHE_TIMESTAMP_KEY, Date.now().toString());
        return freshQuests;
    }
    const cached = localStorage.getItem(QUEST_CACHE_KEY);
    const storedVersion = localStorage.getItem(QUEST_CACHE_VERSION_KEY);
    if (cached && storedVersion === QUEST_CACHE_VERSION) {
        console.log("Using cached quests from localStorage");
        const parsedCache = JSON.parse(cached);
        cachedQuests = parsedCache;
        quests = parsedCache;
        return parsedCache;
    }
    console.log("Fetching fresh quests from server...");
    const freshQuests = await getAllQuestsForStudent(true);
    cachedQuests = freshQuests;
    quests = freshQuests;
    localStorage.setItem(QUEST_CACHE_KEY, JSON.stringify(freshQuests));
    localStorage.setItem(QUEST_CACHE_VERSION_KEY, QUEST_CACHE_VERSION);
    localStorage.setItem(QUEST_CACHE_TIMESTAMP_KEY, Date.now().toString());
    return freshQuests;
}

async function checkQuestCacheValidity() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return false;
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('teacher_code')
        .eq('id', session.user.id)
        .single();
    if (!profile?.teacher_code) return false;
    const { data: teacher } = await window.supabase
        .from('teachers')
        .select('quests_updated_at')
        .eq('class_code', profile.teacher_code)
        .single();
    if (!teacher?.quests_updated_at) return false;
    const cachedTimestamp = localStorage.getItem(QUEST_CACHE_TIMESTAMP_KEY);
    const teacherTimestamp = new Date(teacher.quests_updated_at).getTime();
    if (!cachedTimestamp || teacherTimestamp > parseInt(cachedTimestamp)) {
        console.log("Teacher updated quests, refreshing cache...");
        refreshAllQuestCaches();
        return true;
    }
    console.log("Quest cache is valid (teacher hasn't changed quests)");
    return false;
}

// ==============================================
// SECTION 62: IMAGE COMPRESSION
// ==============================================

async function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // More aggressive resizing
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            // If image is very large, scale down even more
            if (width > 1200) {
                const scale = 1200 / width;
                width = 1200;
                height = height * scale;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with quality
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Image compression failed'));
                    return;
                }
                
                // Create a new file from blob
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                
                console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (${Math.round((1 - blob.size/file.size) * 100)}% reduction)`);
                
                resolve(compressedFile);
            }, 'image/jpeg', quality);
        };
        
        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// ==============================================
// SECTION 63: BADGE SYSTEM
// ==============================================

function loadBadgesFromJSON() {
    return fetch("badges.json")
        .then(res => {
            if (!res.ok) throw new Error("Failed to load badges.json");
            return res.json();
        })
        .then(data => {
            badgesData = data.badges;
            console.log("Badges loaded:", badgesData);
            return badgesData;
        })
        .catch(err => {
            console.error("Error loading badges:", err);
            badgesData = [];
            return badgesData;
        });
}

function initializeBadgeSystem() {
    console.log("Initializing badge system...");
    console.log("Current earned badges before check:", earnedBadges);
    const existingBadges = { ...earnedBadges };
    checkAllBadges(false);
    for (const [badgeId, badgeData] of Object.entries(existingBadges)) {
        if (badgeData.earned && !earnedBadges[badgeId]) {
            console.log("Restoring badge that was lost:", badgeId);
            earnedBadges[badgeId] = badgeData;
        }
    }
    saveEarnedBadges();
    console.log("Badge system initialized. Final badges:", earnedBadges);
}

function checkAllBadges(showCelebration = true) {
    if (!badgesData) return;
    const previousBadges = { ...earnedBadges };
    let newBadgesEarned = false;
    badgesData.forEach(badge => {
        if (previousBadges[badge.id]?.earned === true) {
            if (!earnedBadges[badge.id]) {
                earnedBadges[badge.id] = previousBadges[badge.id];
            }
            return;
        }
        if (badge.teacherAwarded) return;
        let earned = false;
        if (badge.progression) {
            earned = checkProgressionBadge(badge);
        } else if (badge.checkFunction) {
            if (badge.checkFunction === "checkPathMastery") {
                earned = checkPathMastery(badge.params);
            } else if (badge.checkFunction === "checkColorExpert") {
                earned = checkColorExpert(badge.params);
            } else if (badge.checkFunction === "checkPerspectivePro") {
                earned = checkPerspectivePro(badge.params);
            }
        }
        if (earned) {
            if (!previousBadges[badge.id]?.earned) {
                newBadgesEarned = true;
                console.log(`New badge earned: ${badge.name}`);
                if (showCelebration) showBadgeNotification(badge.name);
            }
            if (!badge.progression) {
                earnedBadges[badge.id] = {
                    earned: true,
                    earnedAt: earnedBadges[badge.id]?.earnedAt || new Date().toISOString()
                };
            }
        }
    });
    saveEarnedBadges();
    if (newBadgesEarned) {
        console.log("New badges earned, saving to cloud...");
        saveBadgesToCloud();
    }
    console.log("Final earned badges after check:", earnedBadges);
}

function checkProgressionBadge(badge) {
    if (!badge.levels) return false;
    let mvpCount = 0;
    const mvpQuestIds = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (isCompleted === true) {
            const quest = quests[questId];
            if (quest && quest.style === 'mvp') {
                mvpCount++;
                mvpQuestIds.push(questId);
            }
        }
    }
    console.log(`Badge ${badge.id}: MVP count = ${mvpCount} (Quests: ${mvpQuestIds.join(', ')})`);
    let highestLevel = null;
    if (badge.levels) {
        for (const level of badge.levels) {
            if (mvpCount >= level.count) {
                highestLevel = level;
            }
        }
    }
    if (highestLevel) {
        earnedBadges[badge.id] = {
            earned: true,
            level: highestLevel.level,
            count: mvpCount,
            image: highestLevel.image || badge.image,
            borderClass: highestLevel.borderClass,
            tooltip: highestLevel.tooltip,
            earnedAt: earnedBadges[badge.id]?.earnedAt || new Date().toISOString()
        };
        console.log(`✅ Badge ${badge.id} earned at level ${highestLevel.level}`);
        return true;
    } else {
        if (earnedBadges[badge.id] && earnedBadges[badge.id].earned) {
            console.log(`Badge ${badge.id} already earned, keeping`);
            return true;
        }
        return false;
    }
}

async function saveBadgesToCloud() {
    if (isLoadingFromCloud) return;
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const { error } = await window.supabase
        .from('student_progress')
        .update({
            earned_badges: earnedBadges,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    if (error) {
        console.error("Error saving badges to cloud:", error);
    } else {
        console.log("Badges saved to cloud successfully");
    }
}

function checkPathMastery(params) {
    const { path, count } = params;
    let completedCount = 0;
    Object.entries(completedQuests).forEach(([questId, isCompleted]) => {
        if (!isCompleted) return;
        const quest = quests[questId];
        if (!quest || quest.style !== "mvp") return;
        if (Array.isArray(quest.path) && quest.path.includes(path)) {
            completedCount++;
        } else if (quest.path === path) {
            completedCount++;
        }
    });
    return completedCount >= count;
}

function checkColorExpert(params) {
    const { count } = params;
    const colorQuests = [
        "quest1", "quest5", "quest8", "quest9", "quest10",
        "quest33", "quest34", "quest35", "quest36", "quest64"
    ];
    let completedCount = 0;
    colorQuests.forEach(questId => {
        if (completedQuests[questId] && quests[questId]?.style === "mvp") {
            completedCount++;
        }
    });
    return completedCount >= count;
}

function checkPerspectivePro(params) {
    const { achievement } = params;
    const targetAchievement = achievementsData.find(a => a.title === achievement);
    if (!targetAchievement) return false;
    return targetAchievement.questsNeeded.every(questId => completedQuests[questId]);
}

// ==============================================
// SECTION 64: RENDER BADGES IN PROFILE
// ==============================================

function renderBadges() {
    const container = document.getElementById("badge-container");
    const titleElement = document.getElementById("badge-title");
    if (!container || !badgesData) return;
    container.innerHTML = "";
    const profile = loadStudentProfile() || {};
    const studentName = profile.name || "Student";
    if (titleElement) {
        titleElement.textContent = `${studentName}'s Art Badges`;
    }
    const sortedBadges = [...badgesData].sort((a, b) => {
        const order = { path: 1, skill: 2, progression: 3, teacher: 4 };
        return (order[a.category] || 5) - (order[b.category] || 5);
    });
    sortedBadges.forEach(badge => {
        const badgeSlot = document.createElement("div");
        badgeSlot.className = "badge-slot";
        const earnedInfo = earnedBadges[badge.id];
        const isEarned = earnedInfo?.earned;
        const img = document.createElement("img");
        if (badge.progression && isEarned && earnedInfo?.image) {
            img.src = earnedInfo.image;
        } else {
            img.src = badge.image;
        }
        img.alt = badge.name;
        img.onerror = function() {
            this.style.backgroundColor = "rgba(100,100,100,0.3)";
            this.style.borderRadius = "50%";
        };
        if (isEarned) {
            badgeSlot.classList.add("earned");
            if (badge.category === "teacher" || earnedInfo?.teacherAwarded) {
                badgeSlot.classList.add("teacher-awarded");
            }
            if (badge.progression && earnedInfo?.borderClass) {
                badgeSlot.classList.add(earnedInfo.borderClass);
            }
            let tooltip = "";
            if (badge.progression && earnedInfo?.tooltip) {
                tooltip = earnedInfo.tooltip;
            } else if (badge.teacherAwarded) {
                tooltip = `Teacher Award: ${badge.name}`;
            } else {
                tooltip = badge.tooltipEarned ? badge.tooltipEarned.replace("{name}", studentName) : badge.name;
            }
            badgeSlot.setAttribute("data-tooltip", tooltip);
        } else {
            badgeSlot.classList.add("shadow");
            let tooltip = "";
            if (badge.progression) {
                const count = earnedInfo?.count || 0;
                const nextLevel = badge.levels?.find(l => l.count > count);
                if (nextLevel) {
                    tooltip = `Quest Completer: ${count}/${nextLevel.count} summatives completed. ${nextLevel.tooltip}`;
                } else {
                    tooltip = badge.tooltipShadow || badge.name;
                }
            } else {
                tooltip = badge.tooltipShadow || badge.name;
            }
            badgeSlot.setAttribute("data-tooltip", tooltip);
        }
        badgeSlot.appendChild(img);
        container.appendChild(badgeSlot);
    });
}

// ==============================================
// SECTION 65: UPDATE BADGES AFTER QUEST COMPLETION
// ==============================================

function updateBadgesAfterQuest() {
    console.log("Updating badges after quest completion...");
    checkAllBadges(true);
    if (document.getElementById("profile-overlay").style.display === "flex") {
        renderBadges();
    }
    saveBadgesToCloud();
}

// ==============================================
// SECTION 66: REAL-TIME BADGE UPDATES
// ==============================================

function setupRealtimeRefresh() {
    if (!window.supabase || !window.supabase.auth) {
        console.log("Supabase not ready yet, retrying in 1 second...");
        setTimeout(setupRealtimeRefresh, 1000);
        return;
    }
    window.supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error || !session) {
            console.log("No active session, waiting for login...");
            setTimeout(setupRealtimeRefresh, 3000);
            return;
        }
        console.log("Setting up real-time updates for user:", session.user.id);
        if (realtimeSubscription) {
            window.supabase.removeChannel(realtimeSubscription);
        }
        realtimeSubscription = window.supabase
            .channel('student-progress-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'student_progress',
                filter: `user_id=eq.${session.user.id}`
            }, (payload) => {
                console.log("Real-time update received for student progress:", payload);
                console.log("Real-time update received, calling refreshStudentData");
                refreshStudentData();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'student_works',
                filter: `user_id=eq.${session.user.id}`
            }, (payload) => {
                console.log("Real-time update received for student works:", payload);
                const galleryOverlay = document.getElementById("gallery-overlay");
                if (galleryOverlay && galleryOverlay.style.display === "flex") {
                    renderGalleryItems();
                }
                refreshStudentData();
            })
            .subscribe((status) => {
                console.log("Realtime subscription status:", status);
            });
    }).catch(error => {
        console.error("Failed to setup realtime:", error);
        setTimeout(setupRealtimeRefresh, 2000);
    });
}

function showBadgeNotification(badgeName) {
    const notification = document.createElement('div');
    notification.className = 'badge-notification';
    notification.innerHTML = `<div class="badge-notification-content">🎉 New Badge Unlocked: ${badgeName}! 🎉</div>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

async function manualRefreshBadges() {
    console.log("Manually refreshing badges...");
    await loadStudentDataFromCloud();
    const profileOverlay = document.getElementById("profile-overlay");
    if (profileOverlay && profileOverlay.style.display === "flex") {
        renderBadges();
    }
    const localBadges = loadEarnedBadges();
    console.log("Badges in localStorage:", localBadges);
    console.log("Badges in memory:", earnedBadges);
    alert("Badges refreshed! Check console for details.");
}

// ==============================================
// SECTION 67: SAFETY NET FUNCTIONS (Empty/Removed)
// ==============================================

function loadStandardDeductions() { 
    console.warn("loadStandardDeductions called but function removed");
    return {}; 
}

function saveStandardDeductions() { 
    console.warn("saveStandardDeductions called but function removed");
}

function initializeDeductionSystem() { 
    console.warn("initializeDeductionSystem called but function removed");
}

// ==============================================
// SECTION 68: REFRESH STUDENT DATA
// ==============================================

async function refreshStudentData() {
    console.log("Refreshing student data from cloud...");
    invalidateStudentDataCache();
    await loadStudentDataFromCloud(true);
    await loadScheduleForStudent();
    updateProfileUI();
    updateProfileStandardsTable();
    renderRadarChart();
    updateProfileRewards();
    checkAllQuestWarnings();
    if (currentQuestId && document.getElementById("rubric-overlay").style.display === "flex") {
        openRubricPopup(currentQuestId);
    }
    const profileOverlay = document.getElementById("profile-overlay");
    if (profileOverlay && profileOverlay.style.display === "flex") {
        renderBadges();
    }
    if (typeof renderQuestList === 'function') {
        const filterSelect = document.getElementById("questlist-filter");
        if (filterSelect) {
            renderQuestList(filterSelect.value);
        }
    }
    console.log("Student data refreshed");
}

// ==============================================
// SECTION 69: ART BATTLE FUNCTIONS (STUDENT SIDE)
// ==============================================

async function openArtBattle() {
    const overlay = document.getElementById('artbattle-overlay');
    const content = document.getElementById('artbattle-content');
    content.innerHTML = '<div class="artbattle-loading">Loading competitions...</div>';
    overlay.style.display = 'flex';
    await loadArtBattleContests();
}

async function loadArtBattleContests() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        document.getElementById('artbattle-content').innerHTML = '<div class="artbattle-loading">Please log in to view competitions.</div>';
        return;
    }
    const { data: contests, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .order('start_date', { ascending: true });
    if (error) {
        console.error("Error loading contests:", error);
        document.getElementById('artbattle-content').innerHTML = `<div class="artbattle-loading">Error: ${error.message}</div>`;
        return;
    }
    if (!contests || contests.length === 0) {
        document.getElementById('artbattle-content').innerHTML = '<div class="artbattle-loading">No active competitions at this time. Check back later!</div>';
        return;
    }
    const profile = loadStudentProfile();
    const { data: teacherData } = await window.supabase
        .from('teachers')
        .select('id')
        .eq('class_code', profile.teacher_code)
        .single();
    const teacherId = teacherData?.id;
    const visibleContests = contests.filter(contest => {
        const hiddenBy = contest.hidden_by_teachers || [];
        return !hiddenBy.includes(teacherId);
    });
    if (visibleContests.length === 0) {
        document.getElementById('artbattle-content').innerHTML = '<div class="artbattle-loading">No active competitions at this time. Check back later!</div>';
        return;
    }
    const now = new Date();
    let html = '<h2 style="color: #ffd700; margin-bottom: 20px;">⚔️ Art Battle Competitions</h2>';
    for (const contest of visibleContests) {
        const startDate = new Date(contest.start_date);
        const endDate = new Date(contest.end_date);
        let status = '';
        let statusClass = '';
        if (now < startDate) {
            status = 'Upcoming';
            statusClass = 'status-upcoming';
        } else if (now > endDate) {
            status = 'Ended';
            statusClass = 'status-ended';
        } else {
            status = 'Active';
            statusClass = 'status-active';
        }
        html += `
            <div class="artbattle-contest-card" data-contest-id="${contest.id}" data-contest-status="${status.toLowerCase()}">
                <div class="artbattle-contest-title">⚔️ ${escapeHtml(contest.title)}</div>
                <div class="artbattle-contest-dates">
                    📅 ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}
                    <span class="artbattle-contest-status ${statusClass}">${status}</span>
                </div>
                <div class="artbattle-contest-description">${escapeHtml(contest.description.substring(0, 150))}${contest.description.length > 150 ? '...' : ''}</div>
            </div>
        `;
    }
    document.getElementById('artbattle-content').innerHTML = html;
    document.querySelectorAll('.artbattle-contest-card').forEach(card => {
        card.addEventListener('click', () => {
            const contestId = card.dataset.contestId;
            const status = card.dataset.contestStatus;
            if (window.raceJitterInterval) {
                clearInterval(window.raceJitterInterval);
                window.raceJitterInterval = null;
            }
            openArtBattleContest(contestId, status);
        });
    });
}

async function voteForSubmission(contestId, submissionId) {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        alert("Please log in to vote.");
        return;
    }
    const { data: approvedSubmissions } = await window.supabase
        .from('art_battle_submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('status', 'approved');
    const totalSubmissions = approvedSubmissions?.length || 0;
    const maxVotes = totalSubmissions <= 2 ? 1 : 2;
    const { data: existingVotes } = await window.supabase
        .from('art_battle_votes')
        .select('submission_id')
        .eq('contest_id', contestId)
        .eq('student_id', session.user.id);
    const currentVoteCount = existingVotes?.length || 0;
    const alreadyVotedForThis = existingVotes?.some(v => v.submission_id === submissionId);
    if (alreadyVotedForThis) {
        alert("You have already voted for this artwork!");
        return;
    }
    if (currentVoteCount >= maxVotes) {
        alert(`You must vote for ${maxVotes} different artwork${maxVotes > 1 ? 's' : ''}. You have already used all your votes.`);
        return;
    }
    if (maxVotes === 2 && currentVoteCount === 1) {
        const confirmed = confirm("You have cast 1 of 2 required votes. Continue with your second vote?");
        if (!confirmed) return;
    }
    const { error } = await window.supabase
        .from('art_battle_votes')
        .insert({
            contest_id: contestId,
            student_id: session.user.id,
            submission_id: submissionId
        });
    if (error) {
        console.error("Error voting:", error);
        alert("Error voting. Please try again.");
        return;
    }
    await window.supabase.rpc('increment_vote_count', { submission_id: submissionId });
    const remainingVotes = maxVotes - (currentVoteCount + 1);
    if (remainingVotes > 0) {
        alert(`Vote cast! You have ${remainingVotes} more vote${remainingVotes > 1 ? 's' : ''} remaining.`);
    } else {
        alert("Vote cast successfully! You have used all your votes for this contest.");
    }
    await openArtBattleContest(contestId, 'active');
}

async function viewStudentContestSubmission(submissionId) {
    const { data: submission, error } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('id', submissionId)
        .single();
    if (error) {
        console.error("Error loading submission:", error);
        return;
    }
    alert(`Title: ${submission.title}\nStudent: ${submission.profiles?.name}\nDescription: ${submission.description || 'No description'}\nVotes: ${submission.votes || 0}`);
}

function initArtBattleHotspot() {
    const hotspot = document.querySelector('.hotspot.artbattle-hotspot');
    if (hotspot) {
        hotspot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openArtBattle();
        });
    }
}

function closeArtBattle() {
    const overlay = document.getElementById('artbattle-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function initArtBattleClose() {
    const closeBtn = document.getElementById('close-artbattle');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeArtBattle);
    }
    const overlay = document.getElementById('artbattle-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeArtBattle();
            }
        });
    }
}

async function openSubmitArtworkModal(contestId) {
    const { data: session } = await window.supabase.auth.getSession();
    const { data: existingSubmission } = await window.supabase
        .from('art_battle_submissions')
        .select('id, status')
        .eq('contest_id', contestId)
        .eq('student_id', session?.user?.id)
        .maybeSingle();
    if (existingSubmission) {
        if (existingSubmission.status === 'pending') {
            const replace = confirm("You already have a pending submission. Do you want to replace it with a new one?");
            if (!replace) return;
            const { error: deleteError } = await window.supabase
                .from('art_battle_submissions')
                .delete()
                .eq('id', existingSubmission.id);
            if (deleteError) {
                alert("Error deleting old submission: " + deleteError.message);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        } else if (existingSubmission.status === 'approved') {
            alert("Your artwork has already been approved for this contest. You cannot submit another.");
            return;
        } else if (existingSubmission.status === 'rejected') {
            const resubmit = confirm("Your previous submission was rejected. Would you like to submit a new artwork?");
            if (!resubmit) return;
            const { error: deleteError } = await window.supabase
                .from('art_battle_submissions')
                .delete()
                .eq('id', existingSubmission.id);
            if (deleteError) {
                alert("Error deleting rejected submission: " + deleteError.message);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    currentContestForSubmission = contestId;
    const titleInput = document.getElementById('contest-submission-title');
    const descInput = document.getElementById('contest-submission-description');
    const imageInput = document.getElementById('contest-submission-image');
    const filenameDiv = document.getElementById('contest-submission-filename');
    const messageDiv = document.getElementById('contest-submission-message');
    const modal = document.getElementById('submit-contest-work-modal');
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (imageInput) imageInput.value = '';
    if (filenameDiv) filenameDiv.style.display = 'none';
    if (messageDiv) messageDiv.innerHTML = '';
    if (modal) modal.style.display = 'flex';
}

function closeSubmitArtworkModal() {
    document.getElementById('submit-contest-work-modal').style.display = 'none';
}

async function viewContestSubmissionDetails(submissionId, forStudent = false, contestEnded = false) {
    const { data: submission, error } = await window.supabase
        .from('art_battle_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
    if (error) {
        console.error("Error loading submission:", error);
        return;
    }
    let isContestEnded = contestEnded;
    if (!contestEnded && submission.contest_id) {
        const { data: contest } = await window.supabase
            .from('art_battle_contests')
            .select('end_date')
            .eq('id', submission.contest_id)
            .single();
        if (contest) {
            isContestEnded = new Date(contest.end_date) < new Date();
        }
    }
    const modal = document.getElementById('teacher-work-modal');
    if (!modal) {
        console.error("Modal not found");
        return;
    }
    const content = document.getElementById('teacher-work-content');
    if (!content) {
        console.error("Content element not found");
        return;
    }
    const showStudentName = isContestEnded;
    content.innerHTML = `
        <div style="max-width: 500px; margin: 0 auto; text-align: center;">
            <h3 style="color: #ffd700;">${escapeHtml(submission.title || 'Untitled')}</h3>
            <div style="margin: 15px 0;">
                <img src="${submission.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;">
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: left;">
                ${showStudentName ? `<p><strong>Student:</strong> ${escapeHtml(submission.student_name || 'Unknown')}</p>` : ''}
                <p><strong>Votes:</strong> ⭐ ${parseFloat(submission.votes || 0).toFixed(1)}</p>
                <p><strong>Description:</strong><br>${escapeHtml(submission.description || 'No description')}</p>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function setupSubmissionImagePreview() {
    const imageInput = document.getElementById('contest-submission-image');
    const filenameDiv = document.getElementById('contest-submission-filename');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && filenameDiv) {
                filenameDiv.textContent = `📎 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                filenameDiv.style.display = 'block';
            }
        });
    }
}

async function submitContestArtwork() {
    const title = document.getElementById('contest-submission-title').value.trim();
    const description = document.getElementById('contest-submission-description').value.trim();
    const imageFile = document.getElementById('contest-submission-image').files[0];
    const messageDiv = document.getElementById('contest-submission-message');
    if (!title) {
        messageDiv.innerHTML = 'Please enter a title.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!imageFile) {
        messageDiv.innerHTML = 'Please select an image.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (imageFile.size > 2 * 1024 * 1024) {
        messageDiv.innerHTML = 'Image too large. Max 2MB. Upload a Screenshot or the photo, not the photo';
        messageDiv.style.color = '#ff8888';
        return;
    }
    messageDiv.innerHTML = 'Uploading...';
    messageDiv.style.color = '#ffd700';
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        messageDiv.innerHTML = 'Please log in.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', session.user.id)
        .single();
    const studentName = profile?.name || 'Unknown';
    const studentAvatar = profile?.avatar_url || 'profile.png';
    try {
        const compressedFile = await compressImage(imageFile, 1024, 0.85);
        const fileName = `contest_${currentContestForSubmission}_${session.user.id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await window.supabase.storage
            .from('contest-submissions')
            .upload(fileName, compressedFile);
        if (uploadError) {
            throw uploadError;
        }
        const { data: urlData } = window.supabase.storage
            .from('contest-submissions')
            .getPublicUrl(fileName);
        const { error: insertError } = await window.supabase
            .from('art_battle_submissions')
            .insert({
                contest_id: currentContestForSubmission,
                student_id: session.user.id,
                image_url: urlData.publicUrl,
                title: title,
                description: description,
                avatar_url: studentAvatar,
                student_name: studentName,
                status: 'pending',
                votes: 0,
                submitted_at: new Date().toISOString()
            });
        if (insertError) {
            throw insertError;
        }
        messageDiv.innerHTML = '✅ Artwork submitted! Waiting for teacher approval.';
        messageDiv.style.color = '#4caf50';
        setTimeout(() => {
            closeSubmitArtworkModal();
            openArtBattleContest(currentContestForSubmission, 'active');
        }, 2000);
    } catch (error) {
        console.error("Submission error:", error);
        messageDiv.innerHTML = 'Error submitting artwork. Please try again.';
        messageDiv.style.color = '#ff8888';
    }
}

function initSubmissionModal() {
    const modal = document.getElementById('submit-contest-work-modal');
    const closeX = document.getElementById('close-submit-contest-modal');
    const cancel = document.getElementById('cancel-submit-contest-btn');
    const submit = document.getElementById('confirm-submit-contest-btn');
    function closeModal() {
        if (modal) modal.style.display = 'none';
    }
    if (closeX) closeX.onclick = closeModal;
    if (cancel) cancel.onclick = closeModal;
    if (modal) modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    if (submit) submit.onclick = submitContestArtwork;
    setupSubmissionImagePreview();
    console.log("Submission modal initialized");
}

async function deletePendingSubmission(contestId) {
    const { data: session } = await window.supabase.auth.getSession();
    const confirmed = confirm("Are you sure you want to delete your pending submission? This cannot be undone.");
    if (!confirmed) return;
    const { data: submission } = await window.supabase
        .from('art_battle_submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('student_id', session?.user?.id)
        .eq('status', 'pending')
        .single();
    if (!submission) {
        alert("No pending submission found.");
        return;
    }
    const { error } = await window.supabase
        .from('art_battle_submissions')
        .delete()
        .eq('id', submission.id);
    if (error) {
        alert("Error deleting submission: " + error.message);
        return;
    }
    alert("Your submission has been deleted.");
    await openArtBattleContest(contestId, 'active');
}

async function replaceSubmission(contestId) {
    const { data: session } = await window.supabase.auth.getSession();
    const confirmed = confirm("Replace your current submission? Your existing artwork will be deleted and you can upload a new one.");
    if (!confirmed) return;
    const { data: submission } = await window.supabase
        .from('art_battle_submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('student_id', session?.user?.id)
        .eq('status', 'pending')
        .single();
    if (submission) {
        await window.supabase
            .from('art_battle_submissions')
            .delete()
            .eq('id', submission.id);
    }
    openSubmitArtworkModal(contestId);
}

async function openArtBattleContest(contestId, status) {
    console.log("Opening contest:", contestId, "Status:", status);
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();
    if (error) {
        console.error("Error loading contest details:", error);
        return;
    }
    const { data: allSubmissions, error: subError } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('contest_id', contestId);
    if (subError) {
        console.error("Error loading submissions:", subError);
    }
    const submissions = allSubmissions?.filter(s => s.status === 'approved') || [];
    const startDate = new Date(contest.start_date);
    const endDate = new Date(contest.end_date);
    const now = new Date();
    const isActive = now >= startDate && now <= endDate;
    const isUpcoming = now < startDate;
    const isEnded = now > endDate;
    const startDateStr = startDate.toLocaleDateString();
    const endDateStr = endDate.toLocaleDateString();
    const { data: { user } } = await window.supabase.auth.getUser();
    const mySubmission = allSubmissions?.find(s => s.student_id === user?.id);
    const isRejected = mySubmission && mySubmission.status === 'rejected';
    const rejectionReason = mySubmission?.rejection_reason || '';
    const { data: myVotes } = await window.supabase
        .from('art_battle_votes')
        .select('submission_id')
        .eq('contest_id', contestId)
        .eq('student_id', user?.id);
    const { data: approvedSubmissionsForVotes } = await window.supabase
        .from('art_battle_submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('status', 'approved');
    const totalApproved = approvedSubmissionsForVotes?.length || 0;
    const maxVotesAllowed = totalApproved <= 2 ? 1 : 2;
    const currentVoteCount = myVotes?.length || 0;
    const remainingVotes = maxVotesAllowed - currentVoteCount;
    const hasVotedCompletely = currentVoteCount >= maxVotesAllowed;
    const isContestActive = isActive && status !== 'ended';
    if (isContestActive && hasVotedCompletely && submissions.length > 0) {
        await renderRaceTrackView(contestId);
        return;
    }
    if (isEnded) {
        await renderResultsView(contestId);
        return;
    }
    let actionButtons = '';
    if (isRejected) {
        actionButtons = `
            <div class="contest-status-message" style="background: rgba(244, 67, 54, 0.3); border-color: #f44336; margin-top: 20px;">
                ❌ Your submission was not approved.<br>
                <strong>Reason:</strong> ${escapeHtml(rejectionReason)}
            </div>
        `;
    } else if (isActive && status !== 'ended') {
        const hasSubmitted = allSubmissions?.some(s => s.student_id === user?.id);
        if (!hasSubmitted) {
            actionButtons = `
                <div class="contest-action-buttons" style="margin-top: 20px;">
                    <button id="submit-artwork-btn" class="submit-artwork-btn">🎨 Submit Your Artwork</button>
                </div>
            `;
        } else if (hasSubmitted) {
            const mySubmission = allSubmissions?.find(s => s.student_id === user?.id);
            const isPending = mySubmission?.status === 'pending';
            actionButtons = `
                <div class="contest-action-buttons" style="margin-top: 20px;">
                    <div class="already-submitted">✅ You have already submitted artwork for this contest!</div>
                    ${isPending ? `
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button id="delete-submission-btn" class="delete-submission-btn">🗑️ Delete Pending Submission</button>
                            <button id="replace-submission-btn" class="replace-submission-btn">🔄 Replace with New Artwork</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    } else if (isUpcoming) {
        actionButtons = `<div class="contest-status-message">⏳ This contest starts on ${startDateStr}</div>`;
    } else if (isEnded) {
        actionButtons = `<div class="contest-status-message">🏁 This contest has ended. Winners will be announced soon!</div>`;
    }
    let submissionsHtml = '<div class="contest-submissions-section"><h3>📷 Submitted Artworks</h3><div class="contest-submissions-grid">';
    if (submissions && submissions.length > 0) {
        for (const sub of submissions) {
            const isOwnSubmission = sub.student_id === user?.id;
            const canVote = isActive && !isRejected && !isOwnSubmission && remainingVotes > 0;
            submissionsHtml += `
                <div class="contest-submission-card" data-submission-id="${sub.id}">
                    <div class="submission-thumbnail" style="cursor: pointer;">
                        <img src="${sub.image_url}" alt="${sub.title || 'Artwork'}">
                    </div>
                    <div class="submission-info">
                        <div class="submission-title">${escapeHtml(sub.title || 'Untitled')}</div>
                        <div class="submission-student">👤 ${escapeHtml(sub.profiles?.name || 'Unknown')}</div>
                        <div class="submission-votes">⭐ ${parseFloat(sub.votes || 0).toFixed(1)} votes</div>
                        ${canVote ? `<button class="vote-btn" data-submission-id="${sub.id}">👍 Vote (${remainingVotes} more needed)</button>` : ''}
                    </div>
                </div>
            `;
        }
    } else {
        submissionsHtml += '<div class="no-submissions">No submissions yet. Be the first to submit!</div>';
    }
    submissionsHtml += '</div></div>';
    const contestHtml = `
        <div class="contest-detail-view">
            <button id="back-to-contests" class="back-btn">← Back to Contests</button>
            <div class="contest-info-section">
                <div class="contest-info-title">📋 ${escapeHtml(contest.title)}</div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Dates:</div>
                    <div class="contest-info-value">${startDateStr} - ${endDateStr}</div>
                </div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Your Votes:</div>
                    <div class="contest-info-value">${currentVoteCount} of ${maxVotesAllowed} required (${remainingVotes} more needed)</div>
                </div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Description:</div>
                    <div class="contest-info-value">${escapeHtml(contest.description)}</div>
                </div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Requirements:</div>
                    <div class="contest-info-value">${escapeHtml(contest.requirements)}</div>
                </div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Voting Guidelines:</div>
                    <div class="contest-info-value">${escapeHtml(contest.rubric)}</div>
                </div>
            </div>
            ${submissionsHtml}
            ${actionButtons}
        </div>
    `;
    document.getElementById('artbattle-content').innerHTML = contestHtml;
    document.getElementById('back-to-contests')?.addEventListener('click', () => {
        loadArtBattleContests();
    });
    document.querySelectorAll('.contest-submission-card .submission-thumbnail').forEach(thumb => {
        thumb.addEventListener('click', async () => {
            const card = thumb.closest('.contest-submission-card');
            const submissionId = card.dataset.submissionId;
            if (typeof viewContestSubmissionDetails === 'function') {
                await viewContestSubmissionDetails(submissionId, true, false);
            } else {
                console.error("viewContestSubmissionDetails not available");
            }
        });
    });
    if (!isRejected) {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const submissionId = btn.dataset.submissionId;
                await voteForSubmission(contestId, submissionId);
            });
        });
    }
    document.getElementById('delete-submission-btn')?.addEventListener('click', () => {
        deletePendingSubmission(contestId);
    });
    document.getElementById('replace-submission-btn')?.addEventListener('click', () => {
        replaceSubmission(contestId);
    });
    const hasSubmitted = submissions?.some(s => s.student_id === user?.id);
    if (!isRejected && !hasSubmitted && isActive && status !== 'ended') {
        document.getElementById('submit-artwork-btn')?.addEventListener('click', () => {
            openSubmitArtworkModal(contestId);
        });
    }
}

async function renderRaceTrackView(contestId) {
    console.log("Rendering race track for contest:", contestId);
    if (window.raceJitterInterval) {
        clearInterval(window.raceJitterInterval);
        window.raceJitterInterval = null;
    }
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();
    if (error) {
        console.error("Error loading contest:", error);
        return;
    }
    const { data: submissions, error: subError } = await window.supabase
        .from('art_battle_submissions')
        .select('*')
        .eq('contest_id', contestId)
        .eq('status', 'approved');
    if (subError) {
        console.error("Error loading submissions:", subError);
        return;
    }
    if (!submissions || submissions.length === 0) {
        document.getElementById('artbattle-content').innerHTML = '<div class="artbattle-loading">No artworks in this contest yet.</div>';
        return;
    }
    const totalVotes = submissions.reduce((sum, sub) => sum + (sub.votes || 0), 0);
    const sortedSubmissions = [...submissions].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const startDate = new Date(contest.start_date);
    const endDate = new Date(contest.end_date);
    const startDateStr = startDate.toLocaleDateString();
    const endDateStr = endDate.toLocaleDateString();
    const { data: { user } } = await window.supabase.auth.getUser();
    const hasSubmitted = submissions?.some(s => s.student_id === user?.id);
    const userSubmission = submissions?.find(s => s.student_id === user?.id);
    const isPending = userSubmission?.status === 'pending';
    let submitButtonHtml = '';
    if (!hasSubmitted) {
        submitButtonHtml = `
            <div class="contest-action-buttons" style="margin-top: 20px;">
                <button id="submit-artwork-btn" class="submit-artwork-btn">🎨 Submit Your Artwork</button>
            </div>
        `;
    } else if (isPending) {
        submitButtonHtml = `
            <div class="contest-action-buttons" style="margin-top: 20px;">
                <div class="already-submitted">⏳ Your artwork is pending teacher approval.</div>
            </div>
        `;
    }
    let raceHtml = `
        <div class="contest-detail-view">
            <button id="back-to-contests" class="back-btn">← Back to Contests</button>
            <div class="contest-info-section" style="text-align: center;">
                <div class="contest-info-title" style="text-align: center; border-left: none;">🏁 ${escapeHtml(contest.title)}</div>
                <div class="contest-info-row">
                    <div class="contest-info-value">${startDateStr} - ${endDateStr}</div>
                </div>
            </div>
            <div class="race-track-container" id="race-track-container">
                <div class="race-header">
                    <span class="start-line">🏁 START</span>
                    <span class="finish-line">🏁 FINISH</span>
                </div>
                <div class="race-track" id="race-track">
    `;
    for (let i = 0; i < sortedSubmissions.length; i++) {
        const sub = sortedSubmissions[i];
        const votePercentage = totalVotes > 0 ? ((sub.votes || 0) / totalVotes) * 100 : 0;
        const basePosition = Math.min(votePercentage, 95);
        const randomOffset = (Math.random() * 40) - 20;
        let position = basePosition + randomOffset;
        position = Math.max(2, Math.min(95, position));
        const randomDistance = (Math.random() * 15) + 5;
        const studentAvatar = sub.avatar_url || 'profile.png';
        raceHtml += `
            <div class="race-lane" data-submission-id="${sub.id}">
                <div class="race-character racing" style="left: ${position}%; --random-offset: ${randomDistance}px;">
                    <div class="race-avatar">
                        <img src="${studentAvatar}" alt="Student">
                    </div>
                    <div class="race-votes">${parseFloat(sub.votes || 0).toFixed(1)} ⭐</div>
                </div>
                <div class="race-track-line"></div>
            </div>
        `;
    }
    raceHtml += `
                </div>
            </div>
            ${submitButtonHtml}
            <div style="text-align: center; margin-top: 10px;">
                <button id="reset-race-btn" class="refresh-race-btn">🏁 Reset Race Positions</button>
            </div>
        </div>
    `;
    document.getElementById('artbattle-content').innerHTML = raceHtml;
    document.getElementById('back-to-contests')?.addEventListener('click', () => {
        if (window.raceJitterInterval) {
            clearInterval(window.raceJitterInterval);
            window.raceJitterInterval = null;
        }
        loadArtBattleContests();
    });
    document.querySelectorAll('.race-lane').forEach(lane => {
        lane.addEventListener('click', async () => {
            const submissionId = lane.dataset.submissionId;
            await viewContestSubmissionDetails(submissionId, true, true);
        });
    });
    document.getElementById('submit-artwork-btn')?.addEventListener('click', () => {
        openSubmitArtworkModal(contestId);
    });
    document.getElementById('reset-race-btn')?.addEventListener('click', () => {
        const lanes = document.querySelectorAll('.race-lane');
        lanes.forEach((lane, index) => {
            const sub = sortedSubmissions[index];
            if (sub) {
                const votePercentage = totalVotes > 0 ? ((sub.votes || 0) / totalVotes) * 100 : 0;
                const actualPosition = Math.min(votePercentage, 95);
                const character = lane.querySelector('.race-character');
                if (character) {
                    character.style.left = `${actualPosition}%`;
                }
            }
        });
    });
    startRaceJitter(contestId);
}

function startRaceJitter(contestId) {
    if (window.raceJitterInterval) {
        clearInterval(window.raceJitterInterval);
    }
    window.raceJitterInterval = setInterval(() => {
        const raceTrack = document.getElementById('race-track');
        if (!raceTrack) {
            clearInterval(window.raceJitterInterval);
            window.raceJitterInterval = null;
            return;
        }
        const lanes = document.querySelectorAll('.race-lane');
        lanes.forEach(lane => {
            const character = lane.querySelector('.race-character');
            if (character) {
                let currentLeft = parseFloat(character.style.left);
                if (isNaN(currentLeft)) currentLeft = 50;
                let newLeft = currentLeft + (Math.random() * 12 - 6);
                newLeft = Math.max(2, Math.min(95, newLeft));
                character.style.left = `${newLeft}%`;
                const newDistance = (Math.random() * 15) + 5;
                character.style.setProperty('--random-offset', `${newDistance}px`);
            }
        });
    }, 500);
}

async function renderResultsView(contestId) {
    console.log("Rendering results view for contest:", contestId);
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();
    if (error) {
        console.error("Error loading contest:", error);
        return;
    }
    const { data: submissions, error: subError } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('contest_id', contestId)
        .eq('status', 'approved')
        .order('votes', { ascending: false });
    if (subError) {
        console.error("Error loading submissions:", subError);
        return;
    }
    if (!submissions || submissions.length === 0) {
        document.getElementById('artbattle-content').innerHTML = '<div class="artbattle-loading">No artworks in this contest.</div>';
        return;
    }
    const winners = submissions.slice(0, 3);
    const totalVotes = submissions.reduce((sum, sub) => sum + (sub.votes || 0), 0);
    const startDate = new Date(contest.start_date);
    const endDate = new Date(contest.end_date);
    const startDateStr = startDate.toLocaleDateString();
    const endDateStr = endDate.toLocaleDateString();
    let podiumHtml = `
        <div class="results-podium">
            <h3 style="color: #ffd700; text-align: center; margin-bottom: 20px;">🏆 WINNERS 🏆</h3>
            <div class="podium-container">
    `;
    const podiumOrder = [1, 0, 2];
    for (let i = 0; i < 3; i++) {
        const idx = podiumOrder[i];
        const winner = winners[idx];
        if (winner) {
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉');
            const medalClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : 'bronze');
            podiumHtml += `
            <div class="podium-spot ${medalClass}">
                <div class="podium-medal">${medal}</div>
                <div class="podium-avatar">
                    <img src="${winner.avatar_url || 'profile.png'}" alt="${escapeHtml(winner.title)}">
                </div>
                <div class="podium-name">${escapeHtml(winner.student_name || 'Unknown Student')}</div>
                <div class="podium-votes">${winner.votes || 0} ⭐</div>
                <div class="podium-thumbnail">
                    <img src="${winner.image_url}" alt="${winner.title}">
                </div>
            </div>
            `;
        }
    }
    podiumHtml += `
            </div>
        </div>
    `;
    const sortedSubmissions = [...submissions].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    let raceHtml = `
        <div class="race-track-container">
            <div class="race-header">
                <span class="start-line">🏁 START</span>
                <span class="finish-line">🏁 FINISH</span>
            </div>
            <div class="race-track">
    `;
    for (let i = 0; i < sortedSubmissions.length; i++) {
        const sub = sortedSubmissions[i];
        let finalPosition;
        if (i === 0) {
            finalPosition = 95;
        } else {
            const votePercentage = totalVotes > 0 ? ((sub.votes || 0) / totalVotes) * 100 : 0;
            finalPosition = Math.min(votePercentage, 95);
        }
        const studentAvatar = sub.avatar_url || 'profile.png';
        raceHtml += `
            <div class="race-lane" data-submission-id="${sub.id}">
                <div class="race-character" style="left: ${finalPosition}%;">
                    <div class="race-avatar">
                        <img src="${studentAvatar}" alt="Student">
                    </div>
                    <div class="race-name">${escapeHtml(sub.student_name || 'Unknown Student')}</div>
                    <div class="race-votes">${parseFloat(sub.votes || 0).toFixed(1)} ⭐</div>
                </div>
                <div class="race-track-line"></div>
            </div>
        `;
    }
    raceHtml += `
            </div>
        </div>
    `;
    const fullHtml = `
        <div class="contest-detail-view">
            <button id="back-to-contests" class="back-btn">← Back to Contests</button>
            <div class="contest-info-section">
                <div class="contest-info-title">🏁 ${escapeHtml(contest.title)}</div>
                <div class="contest-info-row">
                    <div class="contest-info-label">Dates:</div>
                    <div class="contest-info-value">${startDateStr} - ${endDateStr}</div>
                </div>
            </div>
            <div class="results-tabs">
                <button class="results-tab-btn active" data-tab="podium">🏆 Winners</button>
                <button class="results-tab-btn" data-tab="racetrack">🏁 Final Positions</button>
            </div>
            <div id="results-podium-tab" class="results-tab-content active">
                ${podiumHtml}
            </div>
            <div id="results-racetrack-tab" class="results-tab-content" style="display: none;">
                ${raceHtml}
            </div>
        </div>
    `;
    document.getElementById('artbattle-content').innerHTML = fullHtml;
    document.getElementById('back-to-contests')?.addEventListener('click', () => {
        loadArtBattleContests();
    });
    document.querySelectorAll('.results-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.results-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('results-podium-tab').style.display = tab === 'podium' ? 'block' : 'none';
            document.getElementById('results-racetrack-tab').style.display = tab === 'racetrack' ? 'block' : 'none';
        });
    });
    document.querySelectorAll('.race-lane').forEach(lane => {
        lane.addEventListener('click', async () => {
            const submissionId = lane.dataset.submissionId;
            await viewContestSubmissionDetails(submissionId, true, false);
        });
    });
}

// ==============================================
// SECTION 70: DOM CONTENT LOADED
// ==============================================

document.addEventListener("DOMContentLoaded", () => {
    // Load quests using caching
    getQuestsWithLocalCache().then(questsData => {
        quests = questsData;
        cachedQuests = questsData;          // ← Mark in-memory cache as set
        cachedQuestsIncludeCustom = true;   // ← Mark as fully loaded (skip re-fetch)
        console.log("Quests ready, count:", Object.keys(quests).length);
        
        // Build quest relationships once on load
        buildQuestRelationships();

        // ==============================================
        // Pre-cache all teacher timer values in background
        // (defined here so it has access to `quests`)
        // ==============================================
        async function preCacheAllTimerValues() {
            if (!quests || Object.keys(quests).length === 0) return;
            const profile = loadStudentProfile();
            if (!profile?.teacher_code) return;
            try {
                const { data: teacher } = await window.supabase
                    .from('teachers')
                    .select('id')
                    .eq('class_code', profile.teacher_code)
                    .maybeSingle();
                if (!teacher) return;
                
                const { data: timers } = await window.supabase
                    .from('teacher_quest_standards')
                    .select('quest_id, timer_classes')
                    .eq('teacher_id', teacher.id);
                
                if (timers) {
                    timers.forEach(t => {
                        AppState.teacherData.customTimers[t.quest_id] = t.timer_classes;
                    });
                }
                AppState.teacherData.classDuration = await getClassDuration();
                AppState.teacherData.loaded = true;
                console.log("Timer values pre-cached:", Object.keys(AppState.teacherData.customTimers).length);
            } catch (err) {
                console.error("Error pre-caching timer values:", err);
            }
        }
        // Fire and forget (don't await — runs in background)
        preCacheAllTimerValues();
        
        // Initialize everything that needs quests
        initializeWorkOverlay();
        initializeGallery();
        updateProfileUI();
        initializeRewardsOverlay();
        initializeActiveQuest();
        startBackgroundTimerCheck();
        initializeNewQuestSystem();
        initializeFloatingNavigation();
        initializeFullscreenViewer();
        setupForgotPassword();
        bindHotspots();
        updateProfileStandardsTable();
        renderRadarChart();
        initializeQuestTimers();
        initializeQuestList();
        initializeRationaleOverlay();
        initializeAchievementsSystem();
        initializeProfileSystem();
        initializeResponsiveBehaviors();
        initializeHelpModal();
        setupCalendarTooltipDelegation();
        initArtBattleHotspot();
        initArtBattleClose();
        initSubmissionModal();
        setupActiveQuestButton();
        updateActiveQuestButton();
        
        // Hotspot positioning
        const mapImage = document.getElementById("map-image");
        if (mapImage) {
            if (mapImage.complete) {
                initializeHotspotPositions();
                updateHotspotPositions();
                updateHotspotVisibility();
                addCustomQuestHotspots();
            } else {
                mapImage.onload = () => {
                    initializeHotspotPositions();
                    updateHotspotPositions();
                    updateHotspotVisibility();
                    addCustomQuestHotspots();
                };
            }
        }
        
        loadBadgesFromJSON().then(() => {
            initializeBadgeSystem();
        });
        
        // UI event listeners
        const mapSelector = document.getElementById("map-selector");
        mapSelector?.addEventListener("change", () => {
            switchMap(mapSelector.value);
        });

        document.getElementById("path-selector")?.addEventListener("change", handlePathChange);
        document.getElementById("mvp-quests")?.addEventListener("change", function() {
            if (this.value) openQuest(this.value);
            this.style.display = "none";
        });

        const container = document.getElementById("map-container");
        window.addEventListener("wheel", e => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const zoomFactor = 0.1;
            const MIN_SCALE = 1;
            scale += e.deltaY < 0 ? zoomFactor : -zoomFactor;
            if (scale < MIN_SCALE) scale = MIN_SCALE;
            if (container) {
                container.style.transform = `scale(${scale})`;
                requestAnimationFrame(() => updateHotspotPositions());
            }
        }, { passive: false });

        function isVisible(el) {
            return el && getComputedStyle(el).display !== "none";
        }
        
        const workImageInput = document.getElementById("work-image-input");
        if (workImageInput) {
            workImageInput.addEventListener("change", function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(event) {
                    const preview = document.getElementById("work-preview");
                    if (preview) preview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        initializeStudentSetup();

        // Load self-assessments from localStorage
        const savedSelfAssessments = localStorage.getItem('selfAssessments');
        if (savedSelfAssessments) {
            try {
                window.selfAssessments = JSON.parse(savedSelfAssessments);
                console.log("Loaded self-assessments from localStorage:", Object.keys(window.selfAssessments).length);
            } catch (e) {
                window.selfAssessments = {};
            }
        } else {
            window.selfAssessments = {};
        }

        // Check if there's a pending self-assessment (in case of page refresh)
        const pendingQuest = localStorage.getItem('pendingSelfAssessmentQuest');
        if (pendingQuest) {
            console.log("Found pending self-assessment for quest:", pendingQuest);
            setTimeout(() => {
                if (confirm(`You have a pending self-assessment for a quest. Would you like to complete it now?`)) {
                    window._selfAssessmentPending = true;
                    openRubricPopup(pendingQuest, true);
                    localStorage.removeItem('pendingSelfAssessmentQuest');
                }
            }, 2000);
        }

        // Create New Profile and Back to Login links
        const createProfileLink = document.getElementById("create-profile-link");
        if (createProfileLink) {
            createProfileLink.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("welcome-overlay").style.display = "none";
                showStudentSetupOverlay();
            });
        }

        const backToLoginLink = document.getElementById("back-to-login-link");
        if (backToLoginLink) {
            backToLoginLink.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("student-setup-overlay").style.display = "none";
                document.getElementById("welcome-overlay").style.display = "flex";
            });
        }

        // ESC key handler
        window.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;

            const achievementsOverlay = document.getElementById("achievements-overlay");
            const rationaleOverlay = document.getElementById("rationale-overlay");
            const questOverlay = document.getElementById("quest-overlay");
            const rubricOverlay = document.getElementById("rubric-overlay");
            const workOverlay = document.getElementById("work-overlay"); 
            const galleryOverlay = document.getElementById("gallery-overlay");
            const modal = document.getElementById("helpModal");
            const restrictionPopup = document.getElementById("accept-quest-restriction-popup");
            const setupOverlay = document.getElementById("student-setup-overlay");
            const profileOverlay = document.getElementById("profile-overlay");
            const artBattleOverlay = document.getElementById("artbattle-overlay");
            const submitModal = document.getElementById('submit-contest-work-modal');
            const teacherWorkModal = document.getElementById('teacher-work-modal');
            const calendarModal = document.getElementById('calendar-modal');

            if (isVisible(achievementsOverlay)) {
                closeAchievementsOverlay();
                return;
            }
            if (calendarModal && calendarModal.style.display === 'flex') {
                calendarModal.style.display = 'none';
                return;
            }
            if (isVisible(rationaleOverlay)) {
                closeRationalePopup();
                return;
            }
            if (isVisible(modal)) {
                if (typeof window.closeHelpModal === 'function') {
                    window.closeHelpModal();
                } else {
                    modal.style.display = "none";
                }
                return;
            }
            if (isVisible(workOverlay)) {
                closeWorkOverlay();
                return;
            }
            if (isVisible(rubricOverlay)) {
                rubricOverlay.style.display = "none";
                questOverlay.style.display = "block";
                return;
            }
            if (isVisible(questOverlay)) {
                closeQuest();
                return;
            }
            if (profileOverlay && profileOverlay.style.display === "flex") {
                profileOverlay.style.display = "none";
                return;
            }
            if (restrictionPopup && restrictionPopup.style.display === "flex") {
                closeAcceptQuestRestrictionPopup();
                return;
            }
            if (galleryOverlay && galleryOverlay.style.display === "flex") {
                closeGallery();
                return;
            }
            if (teacherWorkModal && teacherWorkModal.style.display === 'flex') {
                teacherWorkModal.style.display = 'none';
                return;
            }
            if (artBattleOverlay && artBattleOverlay.style.display === "flex") {
                closeArtBattle();
                return;
            }
            if (submitModal && submitModal.style.display === 'flex') {
                submitModal.style.display = 'none';
                return;
            }
            if (setupOverlay && setupOverlay.style.display === "flex") {
                setupOverlay.style.display = "none";
                setupOverlay.classList.remove("hide-setup-text");
                const nameInput = document.getElementById("student-name-input");
                const nameSubmit = document.getElementById("student-name-submit");
                const characterDiv = document.getElementById("character-selection");
                if (nameInput) nameInput.style.display = "block";
                if (nameSubmit) nameSubmit.style.display = "block";
                if (characterDiv) characterDiv.style.display = "none";
                return;
            }
        });
        
        // Tab buttons
        document.querySelectorAll(".tab-button").forEach(button => {
            button.addEventListener("click", () => {
                const tab = button.dataset.tab;
                document.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
                document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
                const tabEl = document.getElementById("tab-" + tab);
                if (tabEl) tabEl.style.display = "block";
                button.classList.add("active");
                
                if (tab === "questlist") {
                    const filterSelect = document.getElementById("questlist-filter");
                    if (filterSelect && typeof renderQuestList === 'function') {
                        renderQuestList(filterSelect.value);
                    }
                } else if (tab === "pathfinder") {
                    if (!pathfinderQuestions && typeof initializePathfinder === 'function') {
                        initializePathfinder();
                    }
                }
            });
        });
        initializeStudentSetup();
        
        // Login/Logout listeners
        const loginBtn = document.getElementById("login-submit-btn");
        if (loginBtn) {
            loginBtn.addEventListener("click", handleLoginSubmit);
        }
        
        const logoutBtn = document.getElementById("logout-profile-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", logout);
        }
        
        // Calendar button
        const calendarBtn = document.getElementById('calendar-btn');
        if (calendarBtn) {
            calendarBtn.addEventListener('click', openStudentCalendar);
        }
        
        // Close calendar
        const closeCalendar = document.getElementById('close-calendar');
        if (closeCalendar) {
            closeCalendar.addEventListener('click', () => {
                document.getElementById('calendar-modal').style.display = 'none';
            });
        }
        
        // Calendar navigation
        const prevBtn = document.getElementById('calendar-prev-month');
        if (prevBtn) {
            prevBtn.addEventListener('click', calendarPrevMonth);
        }
        
        const nextBtn = document.getElementById('calendar-next-month');
        if (nextBtn) {
            nextBtn.addEventListener('click', calendarNextMonth);
        }
        
        const calendarModal = document.getElementById('calendar-modal');
        if (calendarModal) {
            calendarModal.addEventListener('click', (e) => {
                if (e.target === calendarModal) {
                    calendarModal.style.display = 'none';
                }
            });
        }
        
        // Real-time refresh (after login)
        setTimeout(() => {
            setupRealtimeRefresh();
        }, 3000);
    }).catch(err => console.error("Failed to load quests:", err));
});
