// ==========================================================
// TEACHER DASHBOARD - MS INTEGRATED (OPTIMIZED + ORGANIZED)
// ==========================================================
//
// TABLE OF CONTENTS
//   1. CONSTANTS & GLOBAL STATE
//   2. CACHES & CACHE HELPERS
//   3. UTILITY HELPERS
//   4. AUTH & SESSION
//   5. FRAMEWORK & GRADE LEVEL
//   6. QUESTS DATA (fetch + cache)
//   7. QUESTS TAB (accordions, details panel, standards)
//   8. STUDENTS TAB (list, accordion, profile)
//   9. STUDENT PROFILE RENDERING (sync, from pre-fetched data)
//  10. GRADING
//  11. BADGES
//  12. CLASS MANAGEMENT TAB
//  13. CLASS SETTINGS
//  14. STUDENT INVITATIONS
//  15. SCHEDULE TAB
//  16. ANALYTICS TAB
//  17. ART BATTLE CONTESTS
//  18. CUSTOM QUESTS
//  19. PRINT / EXPORT
//  20. MODALS & ESCAPE HANDLING
//  21. TABS SETUP
//  22. DOMContentLoaded BOOTSTRAP
// ==========================================================


// ==========================================================
// 1. CONSTANTS & GLOBAL STATE
// ==========================================================

// --- Standards ---
const MS_STANDARDS = [
    { code: "VA:Cr1.2.7a",  name: "Goal Setting" },
    { code: "VA:Cr2.1.7a",  name: "Skill Development" },
    { code: "VA:Cr2.3.8a",  name: "Visual Communication" },
    { code: "VA:Cr3.1.7a",  name: "Reflection" },
    { code: "VA:Re8.1.8a",  name: "Interpretation" },
    { code: "VA:Cn11.1.8a", name: "Cultural Context" }
];

const HS_STANDARDS = [
    { code: "Art.FA.CR.1.1.IA", name: "Generate" },
    { code: "Art.FA.CR.1.2.IA", name: "Practice" },
    { code: "Art.FA.CR.2.1.IA", name: "Explore" },
    { code: "Art.FA.CR.2.3.IA", name: "Transform" },
    { code: "Art.FA.CR.3.1.IA", name: "Reflect" },
    { code: "Art.FA.PR.6.1.IA", name: "Analyze" },
    { code: "Art.FA.RE.8.1.8A", name: "Interpret" },
    { code: "Art.FA.CN.10.1.IA", name: "Document" }
];

// --- Global state ---
let currentGradeLevel = 'hs';
let currentClassFilter = 'all';
let teacherClasses = [];
let bulkAssignMode = false;
let selectedStudentsForBulk = new Set();
let currentStudentId = null;
let deleteMode = false;
let selectedStudentsForDelete = new Set();
let currentTeacherEmail = null;
let currentQuestData = null;
let currentFramework = null;
let cachedFramework = null;
let cachedFrameworkTime = 0;
const FRAMEWORK_CACHE_DURATION = 300000;

let currentScheduleClassId = null;
let currentScheduleDate = new Date();
let scheduleData = {
    noClassDays: [],
    weekendSettings: {},
    frequencySettings: {}
};

let currentContestId = null;
let currentRejectSubmissionId = null;

let analyticsData = {
    students: [],
    questStats: {},
    framework: 'ncas',
    classFilter: 'all'
};

let currentQuestPage = 1;
const QUESTS_PER_PAGE = 10;

let classCodeVisible = false;
let actualClassCode = '';

// Guard against concurrent student loads
let _loadingStudentId = null;
// Debounce for tab switches
let _tabSwitchTimeout = null;


// ==========================================================
// 2. CACHES & CACHE HELPERS
// ==========================================================

// --- Auth cache ---
let _cachedAuth = null;
let _cachedAuthTime = 0;
let _pendingAuthPromise = null;
const AUTH_CACHE_DURATION = 5 * 60 * 1000;

// --- Quests cache ---
let cachedQuests = null;
let _cachedAllQuests = null;
let _cachedAllQuestsTime = 0;
const ALL_QUESTS_CACHE_DURATION = 10 * 60 * 1000;

// --- Custom quests cache ---
let _cachedCustomQuests = null;
let _cachedCustomQuestsTime = 0;
const CUSTOM_QUESTS_CACHE_DURATION = 120000;

// --- Students + pending works cache ---
let _cachedStudents = null;
let _cachedStudentsTime = 0;
let _cachedPendingSet = null;
let _cachedPendingTime = 0;
const STUDENTS_CACHE_MS = 60 * 1000;

// --- Teacher quest standards cache ---
const _standardsCache = new Map();

// --- Tab-level cache ---
const _tabCache = {
    students: { data: null, time: 0, ttl: 30000 },
    quests: { data: null, time: 0, ttl: 30000 },
    classes: { data: null, time: 0, ttl: 30000 },
    analytics: { data: null, time: 0, ttl: 60000 },
    schedule: { data: null, time: 0, ttl: 30000 }
};

function invalidateTabCache(tabName) {
    if (tabName && _tabCache[tabName]) {
        _tabCache[tabName].data = null;
        _tabCache[tabName].time = 0;
    } else if (!tabName) {
        Object.keys(_tabCache).forEach(k => {
            _tabCache[k].data = null;
            _tabCache[k].time = 0;
        });
    }
}

function isTabCacheValid(tabName) {
    const cache = _tabCache[tabName];
    return !!(cache && cache.data && (Date.now() - cache.time) < cache.ttl);
}

function markTabCacheValid(tabName) {
    const cache = _tabCache[tabName];
    if (cache) {
        cache.data = true;
        cache.time = Date.now();
    }
}

function invalidateStandardsCache(questId) {
    for (const k of Array.from(_standardsCache.keys())) {
        if (k.startsWith(questId + '::')) _standardsCache.delete(k);
    }
}

function invalidateTeacherAuthCache() {
    _cachedAuth = null;
    _cachedAuthTime = 0;
    _pendingAuthPromise = null;
}

function invalidateStudentsCache() {
    _cachedStudents = null;
    _cachedStudentsTime = 0;
    _cachedPendingSet = null;
    _cachedPendingTime = 0;
}

function invalidateCustomQuestsCache() {
    _cachedCustomQuests = null;
    _cachedCustomQuestsTime = 0;
}

function invalidateAllQuestsCache() {
    _cachedAllQuests = null;
    _cachedAllQuestsTime = 0;
}

function refreshQuestsCache() {
    cachedQuests = null;
}

// --- Cached fetch helpers ---
async function getStudentsCached(forceRefresh = false) {
    const auth = await checkTeacherAuth();
    if (!auth) return [];

    if (!forceRefresh && _cachedStudents && (Date.now() - _cachedStudentsTime) < STUDENTS_CACHE_MS) {
        return _cachedStudents;
    }

    const { data } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', auth.teacher.class_code);

    _cachedStudents = data || [];
    _cachedStudentsTime = Date.now();
    return _cachedStudents;
}

async function getPendingWorksCached(forceRefresh = false) {
    if (!forceRefresh && _cachedPendingSet && (Date.now() - _cachedPendingTime) < STUDENTS_CACHE_MS) {
        return _cachedPendingSet;
    }

    const auth = await checkTeacherAuth();
    if (!auth) {
        _cachedPendingSet = new Set();
        _cachedPendingTime = Date.now();
        return _cachedPendingSet;
    }

    // Fetch student IDs for this teacher (uses students cache to avoid duplicate query)
    const students = await getStudentsCached();
    if (!students.length) {
        _cachedPendingSet = new Set();
        _cachedPendingTime = Date.now();
        return _cachedPendingSet;
    }

    const ids = students.map(s => s.id);
    const { data } = await window.supabase
        .from('student_works')
        .select('user_id')
        .eq('grading_status', 'pending')
        .in('user_id', ids);

    _cachedPendingSet = new Set((data || []).map(w => w.user_id));
    _cachedPendingTime = Date.now();
    return _cachedPendingSet;
}

async function getAllQuestsForTeacher(forceRefresh = false) {
    if (!forceRefresh && _cachedAllQuests && (Date.now() - _cachedAllQuestsTime) < ALL_QUESTS_CACHE_DURATION) {
        return _cachedAllQuests;
    }

    // Parallel fetch base quests + custom quests
    const [baseQuests, customQuests] = await Promise.all([
        getQuests(),
        loadTeacherCustomQuests()
    ]);

    const allQuests = { ...baseQuests };

    for (const custom of customQuests) {
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
            character: custom.character || "charimage/custom1.gif",
            style: "custom",
            prerequisites: [],
            timer: { allottedMinutes: 75 },
            is_custom: true,
            custom_id: custom.id
        };
    }

    _cachedAllQuests = allQuests;
    _cachedAllQuestsTime = Date.now();
    return allQuests;
}


// ==========================================================
// 3. UTILITY HELPERS
// ==========================================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function convertNumberToLetterGrade(number) {
    const gradeMap = { 8: 'A*', 7: 'A', 6: 'B', 5: 'C', 4: 'D', 3: 'E', 2: 'F', 1: 'G' };
    return gradeMap[number] || '';
}

function convertLetterGradeToNumber(letter) {
    const gradeMap = { 'A*': 8, 'A': 7, 'B': 6, 'C': 5, 'D': 4, 'E': 3, 'F': 2, 'G': 1 };
    return gradeMap[letter] || null;
}

function getCurrentStandards() {
    if (currentFramework === 'ib-myp' || currentFramework === 'igcse') return [];
    return currentGradeLevel === 'ms' ? MS_STANDARDS : HS_STANDARDS;
}

function getStandardsForGradeLevel(rubric) {
    if (currentGradeLevel === 'ms') return MS_STANDARDS;
    return rubric?.standards || HS_STANDARDS;
}

function getQuestsFileForFramework(framework) {
    if (currentGradeLevel === 'ms') {
        switch(framework) {
            case 'ib-myp': return 'quests-ib-myp.json';
            case 'igcse':  return 'quests-igcse.json';
            default:       return 'quests-ms.json';
        }
    }
    switch(framework) {
        case 'ib-myp': return 'quests-ib-myp.json';
        case 'igcse':  return 'quests-igcse.json';
        default:       return 'quests.json';
    }
}

function mapStandardToDomain(standardCode) {
    const mapping = {
        'Art.FA.CR.1.1.IA': 'creating',
        'Art.FA.CR.1.2.IA': 'creating',
        'Art.FA.CR.2.1.IA': 'creating',
        'Art.FA.CR.2.3.IA': 'creating',
        'Art.FA.CR.3.1.IA': 'creating',
        'Art.FA.PR.6.1.IA': 'presenting',
        'Art.FA.RE.8.1.8A': 'responding',
        'Art.FA.CN.10.1.IA': 'connecting'
    };
    return mapping[standardCode];
}

function mapMSStandardToDomain(standardCode) {
    const mapping = {
        'VA:Cr1.2.7a': 'creating',
        'VA:Cr2.1.7a': 'creating',
        'VA:Cr2.3.8a': 'creating',
        'VA:Cr3.1.7a': 'reflecting',
        'VA:Re8.1.8a': 'responding',
        'VA:Cn11.1.8a': 'connecting'
    };
    return mapping[standardCode];
}


// ==========================================================
// 4. AUTH & SESSION
// ==========================================================

async function checkTeacherAuth() {
    if (_cachedAuth && (Date.now() - _cachedAuthTime) < AUTH_CACHE_DURATION) {
        return _cachedAuth;
    }

    if (_pendingAuthPromise) return _pendingAuthPromise;

    _pendingAuthPromise = (async () => {
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                _cachedAuth = null;
                return null;
            }

            const { data: teacher, error } = await window.supabase
                .from('teachers')
                .select('id, class_code')
                .eq('id', session.user.id)
                .maybeSingle();

            if (error || !teacher) {
                _cachedAuth = null;
                return null;
            }

            _cachedAuth = { session, teacher };
            _cachedAuthTime = Date.now();
            return _cachedAuth;
        } finally {
            _pendingAuthPromise = null;
        }
    })();

    return _pendingAuthPromise;
}

async function handleTeacherLogin() {
    const email = document.getElementById('teacher-email').value;
    const password = document.getElementById('teacher-password').value;
    const messageEl = document.getElementById('teacher-login-message');

    if (!email || !password) {
        messageEl.textContent = 'Please enter email and password';
        return;
    }

    messageEl.textContent = 'Logging in...';

    const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });

    if (error) {
        messageEl.textContent = error.message;
        return;
    }

    messageEl.textContent = 'Login successful! Checking teacher status...';

    const { data: { session } } = await window.supabase.auth.getSession();

    const { data: teacher, error: teacherError } = await window.supabase
        .from('teachers')
        .select('*')
        .eq('id', session.user.id);

    if (teacherError || !teacher || teacher.length === 0) {
        messageEl.textContent = 'This account is not a teacher.';
        await window.supabase.auth.signOut();
        return;
    }

    currentTeacherEmail = email;
    invalidateTeacherAuthCache();

    messageEl.textContent = 'Teacher verified! Loading dashboard...';

    document.getElementById('teacher-login-container').style.display = 'none';
    document.getElementById('teacher-dashboard-container').style.display = 'block';

    setupGradeLevelToggle();
    await preloadTeacherDashboard();

    await renderClassAccordion();
    await loadAllStudents();
    await renderAllQuestAccordions();
    await updateStudentLimitDisplay();
}

async function checkExistingSession() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return;

    const { data: teacher } = await window.supabase
        .from('teachers')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

    if (!teacher) return;

    document.getElementById('teacher-login-container').style.display = 'none';
    document.getElementById('teacher-dashboard-container').style.display = 'block';

    setupGradeLevelToggle();
    await preloadTeacherDashboard();

    await renderClassAccordion();
    await loadAllStudents();
    await renderAllQuestAccordions();
    await updateStudentLimitDisplay();

    const questsContainer = document.getElementById('quests-accordion-container');
    if (questsContainer) await renderQuestsAccordion();
}

async function teacherLogout() {
    invalidateTeacherAuthCache();
    await window.supabase.auth.signOut();
    window.location.href = '/index.html';
}

async function preloadTeacherDashboard() {
    console.log("Preloading teacher dashboard...");
    const t0 = Date.now();

    await Promise.all([
        loadClasses(),
        getQuests(),
        loadTeacherCustomQuests(),
        loadTeacherFramework(),
        loadTeacherContests()
    ]);

    await getAllQuestsForTeacher();

    console.log(`Dashboard preloaded in ${Date.now() - t0}ms`);
}

async function verifyTeacherPassword() {
    if (!currentTeacherEmail) {
        alert("Session error. Please log in again.");
        return false;
    }

    return new Promise((resolve) => {
        const modal = document.getElementById('password-verify-modal');
        const input = document.getElementById('verify-password-input');
        const confirmBtn = document.getElementById('verify-confirm-btn');
        const cancelBtn = document.getElementById('verify-cancel-btn');
        const closeBtn = document.querySelector('.password-verify-close');

        input.value = '';
        modal.style.display = 'flex';
        input.focus();

        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', escHandler);
        };

        const handleConfirm = async () => {
            const password = input.value;
            if (!password) {
                alert("Please enter your password.");
                input.focus();
                return;
            }

            const { error } = await window.supabase.auth.signInWithPassword({
                email: currentTeacherEmail,
                password: password
            });

            if (error) {
                alert("Incorrect password. Please try again.");
                input.value = '';
                input.focus();
                return;
            }

            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') handleCancel();
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        if (closeBtn) closeBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', escHandler);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) handleCancel();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleConfirm();
        });
    });
}

function setupTeacherForgotPassword() {
    const forgotLink = document.getElementById('teacher-forgot-password-link');
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
}


// ==========================================================
// 5. FRAMEWORK & GRADE LEVEL
// ==========================================================

async function loadTeacherFramework(forceRefresh = false) {
    if (!forceRefresh && cachedFramework && (Date.now() - cachedFrameworkTime) < FRAMEWORK_CACHE_DURATION) {
        return cachedFramework;
    }

    const auth = await checkTeacherAuth();
    if (!auth) return 'ncas';

    const { data, error } = await window.supabase
        .from('teachers')
        .select('framework')
        .eq('id', auth.teacher.id)
        .maybeSingle();

    const framework = (error || !data) ? 'ncas' : (data.framework || 'ncas');

    cachedFramework = framework;
    cachedFrameworkTime = Date.now();
    return framework;
}

async function saveTeacherFramework(framework) {
    const auth = await checkTeacherAuth();
    if (!auth) return false;

    const { error } = await window.supabase
        .from('teachers')
        .update({ framework: framework })
        .eq('id', auth.teacher.id);

    if (error) {
        console.error("Error saving framework:", error);
        return false;
    }
    return true;
}

async function confirmFrameworkChange(newFramework) {
    return new Promise((resolve) => {
        const confirmMessage = confirm(
            `⚠️ CHANGE FRAMEWORK TO ${newFramework.toUpperCase()}?\n\n` +
            `This will permanently DELETE:\n` +
            `• All student grades for all quests\n` +
            `• All rubric scores and standards mastery data\n` +
            `• All badge progress tied to specific standards\n\n` +
            `Student profiles and artwork will be preserved.\n\n` +
            `This action CANNOT be undone.\n\n` +
            `Click OK to continue or Cancel to abort.`
        );

        if (!confirmMessage) { resolve(false); return; }

        const userInput = prompt(
            `Type "CONFIRM" to permanently switch to ${newFramework.toUpperCase()} and delete ALL grade data:`
        );

        if (userInput === 'CONFIRM') resolve(true);
        else { alert('Framework change cancelled.'); resolve(false); }
    });
}

async function initializeFrameworkSelector() {
    const currentFrameworkValue = await loadTeacherFramework();
    currentFramework = currentFrameworkValue;

    const radio = document.querySelector(`input[name="framework"][value="${currentFrameworkValue}"]`);
    if (radio) radio.checked = true;

    const radios = document.querySelectorAll('input[name="framework"]');
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const warningDiv = document.getElementById('framework-warning');
            if (radio.checked && radio.value !== currentFramework) {
                if (warningDiv) warningDiv.style.display = 'block';
            } else {
                if (warningDiv) warningDiv.style.display = 'none';
            }
        });
    });

    const saveBtn = document.getElementById('save-framework-btn');
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        newSaveBtn.addEventListener('click', async () => {
            const selectedRadio = document.querySelector('input[name="framework"]:checked');
            const newFramework = selectedRadio?.value;

            if (!newFramework) {
                showFrameworkMessage('Please select a framework', 'error');
                return;
            }
            if (newFramework === currentFramework) {
                showFrameworkMessage('This is already your current framework', 'error');
                return;
            }

            const passwordValid = await verifyTeacherPassword();
            if (!passwordValid) {
                showFrameworkMessage('Password verification failed. Framework not changed.', 'error');
                const currentRadio = document.querySelector(`input[name="framework"][value="${currentFramework}"]`);
                if (currentRadio) currentRadio.checked = true;
                return;
            }

            const confirmed = await confirmFrameworkChange(newFramework);
            if (!confirmed) {
                const currentRadio = document.querySelector(`input[name="framework"][value="${currentFramework}"]`);
                if (currentRadio) currentRadio.checked = true;
                showFrameworkMessage('Framework change cancelled', 'error');
                return;
            }

            await deleteAllGradingData();
            const success = await saveTeacherFramework(newFramework);

            if (success) {
                currentFramework = newFramework;
                cachedQuests = null;
                refreshQuestsCache();
                invalidateAllQuestsCache();
                invalidateStudentsCache();
                invalidateTabCache();
                showFrameworkMessage(`✅ Framework changed to ${newFramework.toUpperCase()}. Page will reload to apply changes.`, 'success');
                await notifyQuestsChanged();
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showFrameworkMessage('Error saving framework. Please try again.', 'error');
            }
        });
    }
}

function showFrameworkMessage(message, type) {
    const messageDiv = document.getElementById('framework-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `framework-message ${type}`;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'framework-message';
        }, 5000);
    }
}

async function deleteAllGradingData() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const { data: students } = await window.supabase
        .from('profiles')
        .select('id')
        .eq('teacher_code', auth.teacher.class_code);

    if (!students || students.length === 0) return;

    const studentIds = students.map(s => s.id);

    await window.supabase.from('student_progress').delete().in('user_id', studentIds);
    await window.supabase.from('student_works').update({ grading_status: 'pending' }).in('user_id', studentIds);

    invalidateStudentsCache();
    invalidateAllQuestsCache();
}

// --- Grade Level Toggle ---
function setupGradeLevelToggle() {
    const hsBtn = document.getElementById('toggle-hs');
    const msBtn = document.getElementById('toggle-ms');

    if (!hsBtn || !msBtn) {
        console.log("Toggle buttons not found");
        return;
    }

    const newHsBtn = hsBtn.cloneNode(true);
    const newMsBtn = msBtn.cloneNode(true);
    hsBtn.parentNode.replaceChild(newHsBtn, hsBtn);
    msBtn.parentNode.replaceChild(newMsBtn, msBtn);

    newHsBtn.addEventListener('click', () => switchGradeLevel('hs'));
    newMsBtn.addEventListener('click', () => switchGradeLevel('ms'));

    updateToggleButtons('hs');
}

function switchGradeLevel(level) {
    if (currentGradeLevel === level) return;

    currentGradeLevel = level;
    updateToggleButtons(level);

    cachedQuests = null;
    invalidateStudentsCache();
    invalidateAllQuestsCache();
    invalidateTabCache();

    refreshAllTeacherDisplays();

    const studentsTab = document.getElementById('students-main-content');
    if (studentsTab && studentsTab.style.display !== 'none') {
        loadAllStudents();
        renderClassAccordion();
    }

    const classesTab = document.getElementById('classes-main-content');
    if (classesTab && classesTab.style.display !== 'none') {
        renderClassManagementView();
        renderClassSettingsTable();
    }

    const analyticsTab = document.getElementById('analytics-main-content');
    if (analyticsTab && analyticsTab.style.display !== 'none') {
        loadAnalyticsData();
    }
}

function updateToggleButtons(level) {
    const hsBtn = document.getElementById('toggle-hs');
    const msBtn = document.getElementById('toggle-ms');
    if (hsBtn) hsBtn.classList.toggle('active', level === 'hs');
    if (msBtn) msBtn.classList.toggle('active', level === 'ms');
}

async function refreshAllTeacherDisplays() {
    await loadQuestsForCurrentGradeLevel();
    await renderClassAccordion();
    await renderAllQuestAccordions();
    await loadTeacherContests();

    if (currentStudentId && document.getElementById('student-details-panel').style.display === 'block') {
        await loadStudentDetails(currentStudentId, document.getElementById('selected-student-name').textContent);
    }

    if (currentQuestData && document.getElementById('quest-details-panel').style.display === 'block') {
        const allQuests = await getAllQuestsForTeacher();
        openQuestDetailsPanel(currentQuestData.id, allQuests);
    }

    const analyticsEl = document.getElementById('analytics-main-content');
    if (analyticsEl && analyticsEl.style.display === 'block') {
        await loadAnalyticsData();
    }
}

async function loadQuestsForCurrentGradeLevel() {
    cachedQuests = null;
    await getQuests();
}


// ==========================================================
// 6. QUESTS DATA (fetch + cache)
// ==========================================================

async function getQuests() {
    if (cachedQuests) return cachedQuests;

    const framework = await loadTeacherFramework();
    const questsFile = getQuestsFileForFramework(framework);

    const response = await fetch(questsFile);
    const rawQuests = await response.json();

    const filteredQuests = {};
    for (const [key, value] of Object.entries(rawQuests)) {
        if (key.startsWith('quest') && value && typeof value === 'object') {
            filteredQuests[key] = value;
        }
    }

    cachedQuests = filteredQuests;
    return cachedQuests;
}

async function loadTeacherCustomQuests(forceRefresh = false) {
    if (!forceRefresh && _cachedCustomQuests && (Date.now() - _cachedCustomQuestsTime) < CUSTOM_QUESTS_CACHE_DURATION) {
        return _cachedCustomQuests;
    }

    const auth = await checkTeacherAuth();
    if (!auth) return [];

    const { data, error } = await window.supabase
        .from('teacher_custom_quests')
        .select('*')
        .eq('teacher_id', auth.teacher.id)
        .eq('deleted', false);

    if (error) {
        console.error("Error loading custom quests:", error);
        return [];
    }

    _cachedCustomQuests = data || [];
    _cachedCustomQuestsTime = Date.now();
    return _cachedCustomQuests;
}

async function notifyQuestsChanged() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    await window.supabase
        .from('teachers')
        .update({ quests_updated_at: new Date().toISOString() })
        .eq('id', auth.teacher.id);
}


// ==========================================================
// 7. QUESTS TAB
// ==========================================================

async function renderAllQuestAccordions() {
    await renderQuestsAccordion();
    await renderActiveQuestsAccordion();
    await renderCompletedQuestsAccordion();
}

async function renderQuestsAccordion() {
    const container = document.getElementById('quests-accordion-container');
    if (!container) return;
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const allQuests = await getAllQuestsForTeacher();

    const validPaths = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    const questsByPath = {
        'Painter Path': [], 'Sketcher Path': [],
        'Watercolor Path': [], '3D Path': []
    };

    for (const [questId, quest] of Object.entries(allQuests)) {
        if (!quest || !quest.path) continue;
        let foundPath = null;
        if (Array.isArray(quest.path) && quest.path.length > 0) {
            if (validPaths.includes(quest.path[0])) foundPath = quest.path[0];
        } else if (typeof quest.path === 'string' && validPaths.includes(quest.path)) {
            foundPath = quest.path;
        }
        if (foundPath) {
            questsByPath[foundPath].push({
                id: questId,
                title: quest.title,
                isMVP: quest.style === 'mvp',
                isCustom: quest.is_custom === true,
                customId: quest.custom_id
            });
        }
    }

    container.innerHTML = '';

    const pathOrder = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    const allPathHeaders = [];
    const allPathContents = [];

    for (const path of pathOrder) {
        const quests = questsByPath[path];
        if (quests.length === 0) continue;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'quest-accordion-item';

        const pathHeader = document.createElement('div');
        pathHeader.className = 'quest-accordion-header';
        pathHeader.innerHTML = `
            <div>
                <span class="quest-title">📚 ${path}</span>
                <span class="quest-path-badge">(${quests.length} quests)</span>
                ${currentGradeLevel === 'ms' ? '<span class="grade-badge ms">MS</span>' : '<span class="grade-badge hs">HS</span>'}
            </div>
            <span class="quest-expand-icon">▼</span>
        `;

        const pathContent = document.createElement('div');
        pathContent.className = 'quest-accordion-content';

        const questsList = document.createElement('div');
        questsList.className = 'quests-list';

        quests.forEach(quest => {
            const questLink = document.createElement('div');
            questLink.className = 'quest-link-item';
            if (quest.isMVP) questLink.classList.add('mvp-quest-link');
            if (quest.isCustom) questLink.classList.add('custom-quest-item');

            questLink.innerHTML = `
                <span class="quest-link-title">${escapeHtml(quest.title)}</span>
                ${quest.isMVP ? '<span class="mvp-badge">👑 MVP</span>' : ''}
                ${quest.isCustom ? '<span class="custom-quest-badge">📝 Custom</span>' : ''}
                ${quest.isCustom ? '<button class="delete-custom-quest-btn" data-quest-id="' + quest.id + '" data-quest-title="' + escapeHtml(quest.title) + '" title="Delete Custom Quest">🗑️</button>' : ''}
            `;

            questLink.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-custom-quest-btn')) return;
                e.stopPropagation();
                const freshQuests = await getAllQuestsForTeacher();
                openQuestDetailsPanel(quest.id, freshQuests);
            });

            questsList.appendChild(questLink);
        });

        pathContent.appendChild(questsList);
        allPathHeaders.push(pathHeader);
        allPathContents.push(pathContent);

        let pathExpanded = false;
        pathHeader.addEventListener('click', () => {
            if (pathExpanded) {
                pathExpanded = false;
                pathContent.classList.remove('expanded');
                pathHeader.classList.remove('expanded');
            } else {
                allPathHeaders.forEach((header, idx) => {
                    if (header !== pathHeader) {
                        allPathContents[idx].classList.remove('expanded');
                        allPathHeaders[idx].classList.remove('expanded');
                    }
                });
                pathExpanded = true;
                pathContent.classList.add('expanded');
                pathHeader.classList.add('expanded');
            }
        });

        pathDiv.appendChild(pathHeader);
        pathDiv.appendChild(pathContent);
        container.appendChild(pathDiv);
    }
}

async function loadQuestStatistics() {
    const auth = await checkTeacherAuth();
    if (!auth) return { activeQuests: {}, completedQuests: {} };

    const students = await getStudentsCached();
    if (!students.length) return { activeQuests: {}, completedQuests: {} };

    const studentIds = students.map(s => s.id);
    const { data: progressData } = await window.supabase
        .from('student_progress')
        .select('user_id, completed_quests, quest_accepted')
        .in('user_id', studentIds);

    const activeQuests = {};
    const completedQuests = {};

    (progressData || []).forEach(progress => {
        const completed = progress.completed_quests || {};
        const questAccepted = progress.quest_accepted || {};

        Object.keys(questAccepted).forEach(questId => {
            if (questAccepted[questId] === true && !completed[questId]) {
                activeQuests[questId] = (activeQuests[questId] || 0) + 1;
            }
        });

        Object.keys(completed).forEach(questId => {
            if (completed[questId] === true) {
                completedQuests[questId] = (completedQuests[questId] || 0) + 1;
            }
        });
    });

    return { activeQuests, completedQuests };
}

async function renderActiveQuestsAccordion() {
    const container = document.getElementById('active-quests-accordion');
    if (!container) return;

    const { activeQuests } = await loadQuestStatistics();
    const allQuests = await getQuests();

    const activeQuestIds = Object.keys(activeQuests);
    if (activeQuestIds.length === 0) {
        container.innerHTML = '<div class="no-active-quests">No active quests at the moment</div>';
        return;
    }

    const validPaths = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    const questsByPath = { 'Painter Path': [], 'Sketcher Path': [], 'Watercolor Path': [], '3D Path': [] };

    for (const questId of activeQuestIds) {
        const quest = allQuests[questId];
        if (!quest) continue;
        if (quest.path && Array.isArray(quest.path) && validPaths.includes(quest.path[0])) {
            questsByPath[quest.path[0]].push({
                id: questId, title: quest.title,
                studentCount: activeQuests[questId],
                isMVP: quest.style === 'mvp'
            });
        }
    }

    container.innerHTML = '';
    renderQuestAccordionByPath(container, questsByPath, 'active');
}

async function renderCompletedQuestsAccordion() {
    const container = document.getElementById('completed-quests-accordion');
    if (!container) return;

    const { completedQuests } = await loadQuestStatistics();
    const allQuests = await getQuests();

    const completedQuestIds = Object.keys(completedQuests);
    if (completedQuestIds.length === 0) {
        container.innerHTML = '<div class="no-completed-quests">No completed quests yet</div>';
        return;
    }

    const validPaths = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    const questsByPath = { 'Painter Path': [], 'Sketcher Path': [], 'Watercolor Path': [], '3D Path': [] };

    for (const questId of completedQuestIds) {
        const quest = allQuests[questId];
        if (!quest) continue;
        if (quest.path && Array.isArray(quest.path) && validPaths.includes(quest.path[0])) {
            questsByPath[quest.path[0]].push({
                id: questId, title: quest.title,
                studentCount: completedQuests[questId],
                isMVP: quest.style === 'mvp'
            });
        }
    }

    container.innerHTML = '';
    renderQuestAccordionByPath(container, questsByPath, 'completed');
}

// Shared helper for active/completed accordions
function renderQuestAccordionByPath(container, questsByPath, mode) {
    const pathOrder = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    const allPathHeaders = [];
    const allPathContents = [];

    for (const path of pathOrder) {
        const quests = questsByPath[path];
        if (quests.length === 0) continue;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'quest-accordion-item';

        const totalStudents = quests.reduce((sum, q) => sum + q.studentCount, 0);
        const badgeSuffix = mode === 'active'
            ? `${totalStudents} active students`
            : `${totalStudents} completed`;

        const pathHeader = document.createElement('div');
        pathHeader.className = 'quest-accordion-header';
        pathHeader.innerHTML = `
            <div>
                <span class="quest-title">📚 ${path}</span>
                <span class="quest-path-badge">(${quests.length} quests, ${badgeSuffix})</span>
                ${currentGradeLevel === 'ms' ? '<span class="grade-badge ms">MS</span>' : '<span class="grade-badge hs">HS</span>'}
            </div>
            <span class="quest-expand-icon">▼</span>
        `;

        const pathContent = document.createElement('div');
        pathContent.className = 'quest-accordion-content';

        const questsList = document.createElement('div');
        questsList.className = 'quests-list';

        quests.forEach(quest => {
            const questLink = document.createElement('div');
            questLink.className = 'quest-link-item';
            if (quest.isMVP) questLink.classList.add('mvp-quest-link');

            const badgeClass = mode === 'completed' ? 'quest-student-count-badge completed' : 'quest-student-count-badge';
            questLink.innerHTML = `
                <span class="quest-link-title">${escapeHtml(quest.title)}</span>
                <span class="${badgeClass}">${quest.studentCount} student${quest.studentCount !== 1 ? 's' : ''}</span>
                ${quest.isMVP ? '<span class="mvp-badge">👑 MVP</span>' : ''}
            `;

            questLink.addEventListener('click', async (e) => {
                e.stopPropagation();
                const allQuests = await getQuests();
                openQuestDetailsPanel(quest.id, allQuests);
            });

            questsList.appendChild(questLink);
        });

        pathContent.appendChild(questsList);
        allPathHeaders.push(pathHeader);
        allPathContents.push(pathContent);

        let pathExpanded = false;
        pathHeader.addEventListener('click', () => {
            if (pathExpanded) {
                pathExpanded = false;
                pathContent.classList.remove('expanded');
                pathHeader.classList.remove('expanded');
            } else {
                allPathHeaders.forEach((header, idx) => {
                    if (header !== pathHeader) {
                        allPathContents[idx].classList.remove('expanded');
                        allPathHeaders[idx].classList.remove('expanded');
                    }
                });
                pathExpanded = true;
                pathContent.classList.add('expanded');
                pathHeader.classList.add('expanded');
            }
        });

        pathDiv.appendChild(pathHeader);
        pathDiv.appendChild(pathContent);
        container.appendChild(pathDiv);
    }
}

// --- Quest details panel ---
async function openQuestDetailsPanel(questId, allQuests) {
    const filteredQuest = await getFilteredRubricForQuest(questId);
    const quest = filteredQuest;

    if (!quest) {
        console.error("Quest not found:", questId);
        return;
    }

    currentQuestData = { id: questId, data: quest, allQuests: allQuests };

    document.getElementById('quest-details-title').textContent = quest.title || questId;
    document.getElementById('quest-profile-image').src = quest.character || 'profile.png';
    document.getElementById('quest-profile-title').textContent = quest.title || 'Untitled';

    let pathText = 'No path assigned';
    if (quest.path && Array.isArray(quest.path)) pathText = quest.path.join(', ');
    else if (quest.path) pathText = quest.path;
    document.getElementById('quest-profile-path').textContent = `Path: ${pathText}`;

    let difficultyText = 'Not specified';
    if (quest.difficulty) {
        const difficultyValue = Math.min(quest.difficulty, 3);
        const emptyStars = Math.max(0, 3 - difficultyValue);
        const stars = '★'.repeat(difficultyValue) + '☆'.repeat(emptyStars);
        difficultyText = `${quest.difficulty}/3 ${stars}`;
    }
    document.getElementById('quest-profile-difficulty').textContent = `Difficulty: ${difficultyText}`;

    const requirementsList = document.getElementById('quest-requirements-list');
    requirementsList.innerHTML = '';
    if (quest.requirements && Array.isArray(quest.requirements)) {
        quest.requirements.forEach(req => {
            const li = document.createElement('li');
            li.textContent = req;
            requirementsList.appendChild(li);
        });
    } else {
        requirementsList.innerHTML = '<li>No specific requirements</li>';
    }

    const rubricContainer = document.getElementById('quest-rubric-container');
    if (quest.rubric) {
        const isIB = quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
        const isNCAS = quest.rubric.standards && Array.isArray(quest.rubric.standards);
        const isIGCSE = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);

        let rubricHtml = '';
        const savedData = await loadTeacherQuestStandards(questId);
        const savedDescriptions = savedData?.rubric_descriptions || null;

        if (isNCAS && quest.rubric.standards.length > 0) {
            let standardsToShow = quest.rubric.standards;
            if (savedDescriptions) {
                standardsToShow = standardsToShow.map(std => {
                    const desc = savedDescriptions[std.code];
                    if (desc) {
                        return {
                            ...std,
                            levels: {
                                "4": desc["4"] || std.levels?.["4"] || "",
                                "3": desc["3"] || std.levels?.["3"] || "",
                                "2": desc["2"] || std.levels?.["2"] || "",
                                "1": desc["1"] || std.levels?.["1"] || ""
                            }
                        };
                    }
                    return std;
                });
            }

            rubricHtml = `<table class="rubric-table">
                <thead><tr><th>Standard</th><th>Grade 4</th><th>Grade 3</th><th>Grade 2</th><th>Grade 1</th></tr></thead>
                <tbody>`;

            standardsToShow.forEach(std => {
                rubricHtml += `<tr>
                    <td>${std.code}${std.name ? `: ${std.name}` : ''}</td>
                    <td>${std.levels?.["4"] || ""}</td>
                    <td>${std.levels?.["3"] || ""}</td>
                    <td>${std.levels?.["2"] || ""}</td>
                    <td>${std.levels?.["1"] || ""}</td>
                </tr>`;
            });
            rubricHtml += `</tbody></table>`;
        }
        else if (isIB && quest.rubric.criteria.length > 0) {
            let criteriaToShow = quest.rubric.criteria;
            if (savedDescriptions) {
                criteriaToShow = criteriaToShow.map(criterion => {
                    const desc = savedDescriptions[criterion.code];
                    if (desc) {
                        return {
                            ...criterion,
                            levels: {
                                "7-8": desc["7-8"] || criterion.levels?.["7-8"] || "",
                                "5-6": desc["5-6"] || criterion.levels?.["5-6"] || "",
                                "3-4": desc["3-4"] || criterion.levels?.["3-4"] || "",
                                "1-2": desc["1-2"] || criterion.levels?.["1-2"] || ""
                            }
                        };
                    }
                    return criterion;
                });
            }

            rubricHtml = `<table class="rubric-table">
                <thead><tr><th>Criterion</th><th>Grade 7-8</th><th>Grade 5-6</th><th>Grade 3-4</th><th>Grade 1-2</th></tr></thead>
                <tbody>`;

            criteriaToShow.forEach(criterion => {
                rubricHtml += `<tr>
                    <td><strong>${criterion.code}</strong>: ${criterion.name}</td>
                    <td>${criterion.levels["7-8"] || ""}</td>
                    <td>${criterion.levels["5-6"] || ""}</td>
                    <td>${criterion.levels["3-4"] || ""}</td>
                    <td>${criterion.levels["1-2"] || ""}</td>
                </tr>`;
            });
            rubricHtml += `</tbody></table>`;
        }
        else if (isIGCSE && quest.rubric.assessment_objectives.length > 0) {
            let aosToShow = quest.rubric.assessment_objectives;
            if (savedDescriptions) {
                aosToShow = aosToShow.map(ao => {
                    const desc = savedDescriptions[ao.code];
                    if (desc) {
                        return {
                            ...ao,
                            levels: {
                                "A*-A": desc["A*-A"] || ao.levels?.["A*-A"] || "",
                                "B-C": desc["B-C"] || ao.levels?.["B-C"] || "",
                                "D-E": desc["D-E"] || ao.levels?.["D-E"] || "",
                                "F-G": desc["F-G"] || ao.levels?.["F-G"] || ""
                            }
                        };
                    }
                    return ao;
                });
            }

            rubricHtml = `<table class="rubric-table">
                <thead><tr><th>Assessment Objective</th><th>Grade A*-A</th><th>Grade B-C</th><th>Grade D-E</th><th>Grade F-G</th></tr></thead>
                <tbody>`;

            aosToShow.forEach(ao => {
                rubricHtml += `<tr>
                    <td><strong>${ao.code}</strong>: ${ao.name}</td>
                    <td>${ao.levels["A*-A"] || ""}</td>
                    <td>${ao.levels["B-C"] || ""}</td>
                    <td>${ao.levels["D-E"] || ""}</td>
                    <td>${ao.levels["F-G"] || ""}</td>
                </tr>`;
            });
            rubricHtml += `</tbody></table>`;
        } else {
            rubricHtml = '<p>No standards, criteria, or assessment objectives selected for this quest. Please go to the "Select Standards" tab to choose which items to assess.</p>';
        }

        rubricContainer.innerHTML = rubricHtml;
    } else {
        rubricContainer.innerHTML = '<p>No rubric available for this quest.</p>';
    }

    const rationaleElement = document.getElementById('quest-rationale-text');
    rationaleElement.innerHTML = quest.rationale ? quest.rationale : 'No rationale provided.';

    document.getElementById('quest-profile-tab').style.display = 'block';
    document.getElementById('quest-prerequisites-tab').style.display = 'none';
    document.getElementById('quest-standards-tab').style.display = 'none';
    document.getElementById('quest-students-tab').style.display = 'none';

    document.querySelectorAll('#quest-details-panel .quest-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('#quest-details-panel .quest-tab-btn[data-quest-tab="profile"]')?.classList.add('active');

    loadPrerequisitesAndLeadsTo(questId, allQuests);

    document.getElementById('quest-details-panel').style.display = 'block';
}

function closeQuestDetailsPanel() {
    document.getElementById('quest-details-panel').style.display = 'none';
}

function setupQuestDetailsTabs() {
    const tabsContainer = document.querySelector('#quest-details-panel .teacher-tabs');
    if (!tabsContainer) return;

    tabsContainer.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.quest-tab-btn');
        if (!tabBtn) return;

        const tabId = tabBtn.dataset.questTab;

        const profileTab = document.getElementById('quest-profile-tab');
        const prereqTab = document.getElementById('quest-prerequisites-tab');
        const standardsTab = document.getElementById('quest-standards-tab');
        const studentsTab = document.getElementById('quest-students-tab');

        document.querySelectorAll('#quest-details-panel .quest-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');

        if (profileTab) profileTab.style.display = 'none';
        if (prereqTab) prereqTab.style.display = 'none';
        if (standardsTab) standardsTab.style.display = 'none';
        if (studentsTab) studentsTab.style.display = 'none';

        if (tabId === 'profile') {
            if (profileTab) profileTab.style.display = 'block';
        } else if (tabId === 'prerequisites') {
            if (prereqTab) {
                prereqTab.style.display = 'block';
                if (currentQuestData) loadPrerequisitesAndLeadsTo(currentQuestData.id, currentQuestData.allQuests);
            }
        } else if (tabId === 'standards') {
            if (standardsTab) {
                standardsTab.style.display = 'block';
                if (currentQuestData) renderStandardsSelectionTab(currentQuestData.id);
            }
        } else if (tabId === 'students') {
            if (studentsTab) {
                studentsTab.style.display = 'block';
                if (currentQuestData) loadActiveStudentsForQuest(currentQuestData.id);
            }
        }
    });
}

function setupQuestDetailsClose() {
    const closeBtn = document.getElementById('close-quest-details-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuestDetailsPanel);
}

function loadPrerequisitesAndLeadsTo(questId, allQuests) {
    const quest = allQuests[questId];

    setTimeout(() => {
        const prerequisitesList = document.getElementById('prerequisites-list');
        const leadsToList = document.getElementById('leads-to-list');
        if (!prerequisitesList) return;

        const prerequisites = [];
        if (quest && quest.prerequisites && Array.isArray(quest.prerequisites)) {
            quest.prerequisites.forEach(prereqId => {
                if (allQuests[prereqId]) {
                    prerequisites.push({ id: prereqId, title: allQuests[prereqId].title });
                }
            });
        }

        const leadsTo = [];
        for (const [id, q] of Object.entries(allQuests)) {
            if (q.prerequisites && Array.isArray(q.prerequisites) && q.prerequisites.includes(questId)) {
                leadsTo.push({ id, title: q.title });
            }
        }

        prerequisitesList.innerHTML = '';
        if (prerequisites.length === 0) {
            prerequisitesList.innerHTML = '<div class="prerequisite-link">No prerequisites required</div>';
        } else {
            prerequisites.forEach(prereq => {
                const link = document.createElement('div');
                link.className = 'prerequisite-link';
                link.textContent = prereq.title;
                link.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const freshQuests = await getQuests();
                    openQuestDetailsPanel(prereq.id, freshQuests);
                });
                prerequisitesList.appendChild(link);
            });
        }

        leadsToList.innerHTML = '';
        if (leadsTo.length === 0) {
            leadsToList.innerHTML = '<div class="leads-to-link">This quest does not lead to any other quests</div>';
        } else {
            leadsTo.forEach(lead => {
                const link = document.createElement('div');
                link.className = 'leads-to-link';
                link.textContent = lead.title;
                link.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const freshQuests = await getQuests();
                    openQuestDetailsPanel(lead.id, freshQuests);
                });
                leadsToList.appendChild(link);
            });
        }
    }, 50);
}

async function loadActiveStudentsForQuest(questId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const activeContainer = document.getElementById('active-students-list');
    const completedContainer = document.getElementById('completed-students-list');
    if (!activeContainer || !completedContainer) return;

    const students = await getStudentsCached();
    if (!students.length) {
        activeContainer.innerHTML = '<div class="no-data">No students found</div>';
        completedContainer.innerHTML = '<div class="no-data">No students found</div>';
        return;
    }

    const studentIds = students.map(s => s.id);
    const { data: progressData } = await window.supabase
        .from('student_progress')
        .select('user_id, completed_quests, quest_accepted')
        .in('user_id', studentIds);

    const progressMap = new Map();
    (progressData || []).forEach(p => progressMap.set(p.user_id, p));

    const activeStudents = [];
    const completedStudents = [];

    for (const student of students) {
        const progress = progressMap.get(student.id);
        const completedQuests = progress?.completed_quests || {};
        const questAccepted = progress?.quest_accepted || {};

        if (completedQuests[questId] === true) completedStudents.push(student);
        else if (questAccepted[questId] === true) activeStudents.push(student);
    }

    activeContainer.innerHTML = '';
    if (activeStudents.length === 0) {
        activeContainer.innerHTML = '<div class="no-data">No active students for this quest</div>';
    } else {
        activeStudents.forEach(student => {
            const card = document.createElement('div');
            card.className = 'quest-student-card';
            card.innerHTML = `
                <img src="${student.avatar_url || 'profile.png'}" alt="${student.name}">
                <span class="quest-student-name">${escapeHtml(student.name)}</span>
                <span class="grade-level-badge ${student.grade_level || 'hs'}">${(student.grade_level || 'HS').toUpperCase()}</span>
            `;
            card.addEventListener('click', () => {
                closeQuestDetailsPanel();
                loadStudentDetails(student.id, student.name);
            });
            activeContainer.appendChild(card);
        });
    }

    completedContainer.innerHTML = '';
    if (completedStudents.length === 0) {
        completedContainer.innerHTML = '<div class="no-data">No completed students for this quest</div>';
    } else {
        completedStudents.forEach(student => {
            const card = document.createElement('div');
            card.className = 'quest-student-card';
            card.innerHTML = `
                <img src="${student.avatar_url || 'profile.png'}" alt="${student.name}">
                <span class="quest-student-name">${escapeHtml(student.name)}</span>
                <span class="grade-level-badge ${student.grade_level || 'hs'}">${(student.grade_level || 'HS').toUpperCase()}</span>
            `;
            card.addEventListener('click', () => {
                closeQuestDetailsPanel();
                loadStudentDetails(student.id, student.name);
            });
            completedContainer.appendChild(card);
        });
    }
}

// --- Teacher quest standards (cached) ---
async function loadTeacherQuestStandards(questId, classId = null) {
    const cacheKey = `${questId}::${classId ?? 'null'}`;
    if (_standardsCache.has(cacheKey)) {
        return _standardsCache.get(cacheKey);
    }

    const auth = await checkTeacherAuth();
    if (!auth) return null;

    let query = window.supabase
        .from('teacher_quest_standards')
        .select('selected_standards, timer_classes, class_id, rubric_descriptions')
        .eq('teacher_id', auth.teacher.id)
        .eq('quest_id', questId);

    if (classId !== null) query = query.eq('class_id', classId);
    else query = query.is('class_id', null);

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error("Error loading standards override:", error);
    }

    const result = {
        selected_standards: data?.selected_standards || null,
        timer_classes: data?.timer_classes || null,
        class_id: data?.class_id || null,
        rubric_descriptions: data?.rubric_descriptions || null
    };

    _standardsCache.set(cacheKey, result);
    return result;
}

async function saveTeacherQuestStandards(questId, selectedStandards, timerClasses = null, classId = null, rubricDescriptions = null) {
    const auth = await checkTeacherAuth();
    if (!auth) return false;

    const dataToSave = {
        teacher_id: auth.teacher.id,
        quest_id: questId,
        selected_standards: selectedStandards,
        updated_at: new Date().toISOString()
    };

    if (timerClasses !== null) dataToSave.timer_classes = timerClasses;
    if (classId !== null && classId !== '') dataToSave.class_id = classId;
    if (rubricDescriptions !== null) dataToSave.rubric_descriptions = rubricDescriptions;

    let error;

    if (classId !== null && classId !== '') {
        const { error: upsertError } = await window.supabase
            .from('teacher_quest_standards')
            .upsert(dataToSave, { onConflict: 'teacher_id, quest_id, class_id' });
        error = upsertError;
    } else {
        const { data: existing } = await window.supabase
            .from('teacher_quest_standards')
            .select('id')
            .eq('teacher_id', auth.teacher.id)
            .eq('quest_id', questId)
            .is('class_id', null)
            .maybeSingle();

        if (existing) {
            const { error: updateError } = await window.supabase
                .from('teacher_quest_standards')
                .update(dataToSave)
                .eq('id', existing.id);
            error = updateError;
        } else {
            const { error: insertError } = await window.supabase
                .from('teacher_quest_standards')
                .insert(dataToSave);
            error = insertError;
        }
    }

    if (error) {
        console.error("Error saving standards:", error);
        alert("Error saving standards: " + error.message);
        return false;
    }

    invalidateAllQuestsCache();
    invalidateStandardsCache(questId);
    return true;
}

async function resetTeacherQuestStandards(questId, classId = null) {
    const auth = await checkTeacherAuth();
    if (!auth) return false;

    let query = window.supabase
        .from('teacher_quest_standards')
        .delete()
        .eq('teacher_id', auth.teacher.id)
        .eq('quest_id', questId);

    if (classId !== null) query = query.eq('class_id', classId);

    const { error } = await query;

    if (error) {
        console.error("Error resetting standards:", error);
        alert("Error resetting standards: " + error.message);
        return false;
    }

    invalidateAllQuestsCache();
    invalidateStandardsCache(questId);
    refreshQuestsCache();
    await notifyQuestsChanged();
    return true;
}

async function getFilteredRubricForQuest(questId, teacherId = null) {
    const allQuests = await getAllQuestsForTeacher();
    const quest = allQuests[questId];

    if (!quest || !quest.rubric) return quest;

    const hasStandards = quest.rubric.standards && Array.isArray(quest.rubric.standards);
    const hasCriteria = quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
    const hasAssessmentObjectives = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);

    if (!hasStandards && !hasCriteria && !hasAssessmentObjectives) return quest;

    if (!teacherId) {
        const auth = await checkTeacherAuth();
        if (!auth) return quest;
        teacherId = auth.teacher.id;
    }

    const { data } = await window.supabase
        .from('teacher_quest_standards')
        .select('selected_standards')
        .eq('teacher_id', teacherId)
        .eq('quest_id', questId)
        .maybeSingle();

    if (data?.selected_standards && data.selected_standards.length > 0) {
        if (hasStandards) {
            let standardsToFilter = quest.rubric.standards;
            if (currentGradeLevel === 'ms') standardsToFilter = MS_STANDARDS;
            const filteredStandards = standardsToFilter.filter(std => data.selected_standards.includes(std.code));
            return { ...quest, rubric: { ...quest.rubric, standards: filteredStandards } };
        } else if (hasCriteria) {
            const filteredCriteria = quest.rubric.criteria.filter(c => data.selected_standards.includes(c.code));
            return { ...quest, rubric: { ...quest.rubric, criteria: filteredCriteria } };
        } else if (hasAssessmentObjectives) {
            const filteredAOs = quest.rubric.assessment_objectives.filter(ao => data.selected_standards.includes(ao.code));
            return { ...quest, rubric: { ...quest.rubric, assessment_objectives: filteredAOs } };
        }
    }

    return quest;
}

async function renderStandardsSelectionTab(questId) {
    const container = document.getElementById('standards-checkbox-list');
    if (!container) return;

    const allQuests = await getAllQuestsForTeacher();
    const quest = allQuests[questId];

    if (!quest || !quest.rubric) {
        container.innerHTML = '<p>No rubric found for this quest.</p>';
        return;
    }

    const isIB = quest.rubric.criteria && Array.isArray(quest.rubric.criteria) && quest.rubric.criteria.length > 0;
    const isNCAS = quest.rubric.standards && Array.isArray(quest.rubric.standards) && quest.rubric.standards.length > 0;
    const isIGCSE = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives) && quest.rubric.assessment_objectives.length > 0;

    let itemsToShow = [];
    let gradeLevels = [];
    let headerLabel = '';

    if (isIB) {
        itemsToShow = quest.rubric.criteria;
        gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        headerLabel = 'Criterion';
    } else if (isIGCSE) {
        itemsToShow = quest.rubric.assessment_objectives;
        gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        headerLabel = 'Assessment Objective';
    } else if (isNCAS) {
        itemsToShow = quest.rubric.standards;
        gradeLevels = ['4', '3', '2', '1'];
        headerLabel = 'Standard';
    } else {
        container.innerHTML = '<p>No standards, criteria, or assessment objectives found for this quest.</p>';
        return;
    }

    let classOptions = '<option value="">All Classes (default)</option>';
    for (const cls of teacherClasses) {
        classOptions += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
    }

    const savedData = await loadTeacherQuestStandards(questId);
    const savedStandards = savedData?.selected_standards || null;
    const savedTimerClasses = savedData?.timer_classes || null;
    const savedClassId = savedData?.class_id || null;
    const savedDescriptions = savedData?.rubric_descriptions || null;

    if (savedDescriptions) {
        itemsToShow = itemsToShow.map(item => {
            const desc = savedDescriptions[item.code];
            if (desc) {
                const mergedLevels = {};
                gradeLevels.forEach(level => {
                    mergedLevels[level] = desc[level] || item.levels?.[level] || "";
                });
                return { ...item, levels: mergedLevels };
            }
            return item;
        });
    }

    const defaultTimerMinutes = quest.timer?.allottedMinutes || 75;
    let classDuration = 75;

    async function updateClassDuration(selectedClassId) {
        if (selectedClassId) {
            const { data: classSetting } = await window.supabase
                .from('class_settings')
                .select('class_duration_minutes')
                .eq('class_id', selectedClassId)
                .maybeSingle();
            classDuration = classSetting?.class_duration_minutes || 75;
        } else if (teacherClasses.length > 0) {
            const { data: classSetting } = await window.supabase
                .from('class_settings')
                .select('class_duration_minutes')
                .eq('class_id', teacherClasses[0].id)
                .maybeSingle();
            classDuration = classSetting?.class_duration_minutes || 75;
        }
        return classDuration;
    }

    let initialClassId = savedClassId || (teacherClasses.length > 0 ? teacherClasses[0].id : null);
    if (initialClassId) classDuration = await updateClassDuration(initialClassId);

    const defaultTimerClasses = (defaultTimerMinutes / classDuration).toFixed(1);
    const currentTimerClasses = savedTimerClasses !== null ? savedTimerClasses : null;

    const timerHtml = `
        <div class="timer-settings-section">
            <h4>⏱️ Timer Settings</h4>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #ffd700;">Apply to class:</span>
                    <select id="timer-class-select">${classOptions}</select>
                </label>
            </div>
            <div class="timer-option">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="radio" name="timer-type" value="default" ${!currentTimerClasses ? 'checked' : ''}>
                    <span>Use default timer</span>
                    <span style="font-size: 12px; opacity: 0.8;" id="default-timer-text">(${defaultTimerMinutes} minutes = ${defaultTimerClasses} class periods of ${classDuration} min)</span>
                </label>
            </div>
            <div class="timer-option">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="radio" name="timer-type" value="custom" ${currentTimerClasses ? 'checked' : ''}>
                    <span>Custom timer:</span>
                    <input type="number" id="custom-timer-classes" value="${currentTimerClasses || 1}" style="width: 70px; padding: 4px;" ${!currentTimerClasses ? 'disabled' : ''}>
                    <span>class period(s)</span>
                    <span style="font-size: 12px; opacity: 0.8;">(${classDuration} min/class = <span id="custom-timer-minutes-preview">${(currentTimerClasses || 1) * classDuration}</span> min)</span>
                </label>
            </div>
            <div class="timer-info-text">💡 Timer counts only school days (Monday-Friday). Weekends are automatically skipped.</div>
        </div>
        <div class="standards-checkbox-list"></div>
    `;

    const frameworkDisplay = currentFramework ? currentFramework.toUpperCase() : 'NCAS';
    const gradeDisplay = currentGradeLevel === 'ms' ? 'Middle School' : 'High School';

    let tableHtml = `
        <div style="margin: 10px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 13px;">
            📋 ${gradeDisplay} - ${frameworkDisplay} Framework - Showing ${headerLabel}s
        </div>
        <table class="rubric-table standards-selection-table">
            <thead><tr><th style="width: 50px;">✓</th><th>${headerLabel}</th><th>${gradeLevels[0]}</th><th>${gradeLevels[1]}</th><th>${gradeLevels[2]}</th><th>${gradeLevels[3]}</th></tr></thead>
            <tbody>
    `;

    for (const item of itemsToShow) {
        const itemCode = item.code;
        const isChecked = savedStandards ? savedStandards.includes(itemCode) : true;
        const level1Value = item.levels?.[gradeLevels[0]] || '';
        const level2Value = item.levels?.[gradeLevels[1]] || '';
        const level3Value = item.levels?.[gradeLevels[2]] || '';
        const level4Value = item.levels?.[gradeLevels[3]] || '';

        tableHtml += `
            <tr class="standard-select-row" data-standard="${itemCode}">
                <td style="text-align: center;"><input type="checkbox" class="standard-select-checkbox" value="${itemCode}" ${isChecked ? 'checked' : ''}></td>
                <td class="standard-code-cell"><strong>${escapeHtml(itemCode)}: ${escapeHtml(item.name || '')}</strong></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[0]}" value="${escapeHtml(level1Value)}" placeholder="Grade ${gradeLevels[0]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[1]}" value="${escapeHtml(level2Value)}" placeholder="Grade ${gradeLevels[1]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[2]}" value="${escapeHtml(level3Value)}" placeholder="Grade ${gradeLevels[2]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[3]}" value="${escapeHtml(level4Value)}" placeholder="Grade ${gradeLevels[3]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
            </tr>
        `;
    }

    tableHtml += `</tbody></table>`;

    container.innerHTML = timerHtml;
    const standardsContainer = container.querySelector('.standards-checkbox-list');
    if (standardsContainer) standardsContainer.innerHTML = tableHtml;
    else container.innerHTML += tableHtml;

    const classSelect = document.getElementById('timer-class-select');
    if (classSelect && savedClassId) classSelect.value = savedClassId;

    async function refreshTimerDisplay() {
        const selectedClassId = classSelect?.value;
        const newClassDuration = await updateClassDuration(selectedClassId);
        const defaultTimerMinutes = quest.timer?.allottedMinutes || 75;
        const defaultTimerClasses = (defaultTimerMinutes / newClassDuration).toFixed(1);

        const defaultTimerText = document.getElementById('default-timer-text');
        if (defaultTimerText) {
            defaultTimerText.textContent = `(${defaultTimerMinutes} minutes = ${defaultTimerClasses} class periods of ${newClassDuration} min)`;
        }

        const customInput = document.getElementById('custom-timer-classes');
        const minutesPreview = document.getElementById('custom-timer-minutes-preview');
        if (minutesPreview && customInput) {
            const classes = parseInt(customInput.value) || 0;
            minutesPreview.textContent = classes * newClassDuration;
        }
    }

    if (classSelect) classSelect.addEventListener('change', refreshTimerDisplay);

    const defaultRadio = document.querySelector('input[name="timer-type"][value="default"]');
    const customRadio = document.querySelector('input[name="timer-type"][value="custom"]');
    const customInput = document.getElementById('custom-timer-classes');
    const minutesPreview = document.getElementById('custom-timer-minutes-preview');

    if (defaultRadio && customRadio && customInput) {
        defaultRadio.addEventListener('change', () => { if (defaultRadio.checked) customInput.disabled = true; });
        customRadio.addEventListener('change', () => { if (customRadio.checked) customInput.disabled = false; });

        customInput.addEventListener('input', async () => {
            const selectedClassId = classSelect?.value;
            const newClassDuration = await updateClassDuration(selectedClassId);
            const classes = parseInt(customInput.value) || 0;
            if (minutesPreview) minutesPreview.textContent = classes * newClassDuration;
        });
    }

    document.querySelectorAll('.standard-select-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const row = e.target.closest('.standard-select-row');
            if (row) {
                if (e.target.checked) {
                    row.style.opacity = '1';
                    row.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                } else {
                    row.style.opacity = '0.6';
                    row.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                }
            }
        });

        const row = cb.closest('.standard-select-row');
        if (row && !cb.checked) {
            row.style.opacity = '0.6';
            row.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        }
    });

    const saveStandardsBtn = document.getElementById('save-standards-btn');
    if (saveStandardsBtn) {
        const newSaveBtn = saveStandardsBtn.cloneNode(true);
        saveStandardsBtn.parentNode.replaceChild(newSaveBtn, saveStandardsBtn);

        newSaveBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('#standards-checkbox-list .standard-select-checkbox');
            const selectedStandards = [];
            checkboxes.forEach(cb => { if (cb.checked) selectedStandards.push(cb.value); });

            if (selectedStandards.length === 0) {
                alert("You must select at least one standard/criterion/assessment objective for this quest.");
                return;
            }

            const classSelectElem = document.getElementById('timer-class-select');
            const selectedClassId = classSelectElem?.value || null;

            const timerType = document.querySelector('input[name="timer-type"]:checked')?.value;
            let timerClasses = null;
            if (timerType === 'custom') {
                const customInputElem = document.getElementById('custom-timer-classes');
                timerClasses = parseInt(customInputElem?.value) || null;
            }

            const inputs = document.querySelectorAll('#standards-checkbox-list .grade-level-input');
            const rubricDescriptions = {};
            inputs.forEach(input => {
                const standard = input.dataset.standard;
                const level = input.dataset.level;
                if (!rubricDescriptions[standard]) rubricDescriptions[standard] = {};
                rubricDescriptions[standard][level] = input.value;
            });

            const success = await saveTeacherQuestStandards(
                questId, selectedStandards, timerClasses, selectedClassId, rubricDescriptions
            );

            if (success) {
                if (quest.is_custom === true) {
                    const { data: questData } = await window.supabase
                        .from('teacher_custom_quests')
                        .select('rubric')
                        .eq('quest_id', questId)
                        .maybeSingle();

                    if (questData) {
                        const updatedRubric = questData.rubric;

                        if (updatedRubric.standards) {
                            updatedRubric.standards.forEach(standard => {
                                if (rubricDescriptions[standard.code]) {
                                    const savedLevels = rubricDescriptions[standard.code];
                                    standard.levels = {
                                        "4": savedLevels["4"] || standard.levels?.["4"] || "",
                                        "3": savedLevels["3"] || standard.levels?.["3"] || "",
                                        "2": savedLevels["2"] || standard.levels?.["2"] || "",
                                        "1": savedLevels["1"] || standard.levels?.["1"] || ""
                                    };
                                }
                            });
                        } else if (updatedRubric.criteria) {
                            updatedRubric.criteria.forEach(criterion => {
                                if (rubricDescriptions[criterion.code]) {
                                    const savedLevels = rubricDescriptions[criterion.code];
                                    criterion.levels = {
                                        "7-8": savedLevels["7-8"] || criterion.levels?.["7-8"] || "",
                                        "5-6": savedLevels["5-6"] || criterion.levels?.["5-6"] || "",
                                        "3-4": savedLevels["3-4"] || criterion.levels?.["3-4"] || "",
                                        "1-2": savedLevels["1-2"] || criterion.levels?.["1-2"] || ""
                                    };
                                }
                            });
                        } else if (updatedRubric.assessment_objectives) {
                            updatedRubric.assessment_objectives.forEach(ao => {
                                if (rubricDescriptions[ao.code]) {
                                    const savedLevels = rubricDescriptions[ao.code];
                                    ao.levels = {
                                        "A*-A": savedLevels["A*-A"] || ao.levels?.["A*-A"] || "",
                                        "B-C": savedLevels["B-C"] || ao.levels?.["B-C"] || "",
                                        "D-E": savedLevels["D-E"] || ao.levels?.["D-E"] || "",
                                        "F-G": savedLevels["F-G"] || ao.levels?.["F-G"] || ""
                                    };
                                }
                            });
                        }

                        await window.supabase
                            .from('teacher_custom_quests')
                            .update({ rubric: updatedRubric })
                            .eq('quest_id', questId);
                    }
                }

                refreshQuestsCache();
                await notifyQuestsChanged();
                alert(`${selectedStandards.length} item(s) saved!`);
                const allQuestsFresh = await getAllQuestsForTeacher(true);
                openQuestDetailsPanel(questId, allQuestsFresh);
            }
        });
    }

    const resetStandardsBtn = document.getElementById('reset-standards-btn');
    if (resetStandardsBtn) {
        const newResetBtn = resetStandardsBtn.cloneNode(true);
        resetStandardsBtn.parentNode.replaceChild(newResetBtn, resetStandardsBtn);

        newResetBtn.addEventListener('click', async () => {
            if (confirm("Reset to all standards/criteria/assessment objectives? This will restore everything.")) {
                const success = await resetTeacherQuestStandards(questId);
                if (success) {
                    alert("Reset to all items.");
                    refreshQuestsCache();
                    await notifyQuestsChanged();
                    await renderStandardsSelectionTab(questId);
                    const allQuestsFresh = await getAllQuestsForTeacher(true);
                    openQuestDetailsPanel(questId, allQuestsFresh);
                }
            }
        });
    }
}


// ==========================================================
// 8. STUDENTS TAB (list, accordion)
// ==========================================================

async function renderClassAccordion() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const container = document.getElementById('class-accordion-container');
    if (!container) return;

    const allStudents = await getStudentsCached();

    if (!allStudents || allStudents.length === 0) {
        container.innerHTML = '<div class="no-students">No students found</div>';
        return;
    }

    const pendingSet = await getPendingWorksCached();

    // Filter by grade level
    let students = [];
    if (currentGradeLevel === 'hs') {
        students = allStudents.filter(s => s.grade_level === 'hs' || !s.grade_level);
    } else if (currentGradeLevel === 'ms') {
        students = allStudents.filter(s => s.grade_level === 'ms');
    } else {
        students = allStudents;
    }

    // Group by class
    const studentsByClass = {};
    const unassignedStudents = [];
    students.forEach(student => {
        if (student.class_id) {
            if (!studentsByClass[student.class_id]) studentsByClass[student.class_id] = [];
            studentsByClass[student.class_id].push(student);
        } else {
            unassignedStudents.push(student);
        }
    });

    container.innerHTML = '';

    function createAccordionItem(id, name, studentList) {
        const accordion = document.createElement('div');
        accordion.className = 'class-accordion-item';

        const pendingCount = studentList.filter(s => pendingSet.has(s.id)).length;

        const header = document.createElement('div');
        header.className = 'class-accordion-header';
        header.innerHTML = `
            <div>
                <span class="class-title">📋 ${escapeHtml(name)}</span>
                <span class="class-stats">(${studentList.length} student${studentList.length !== 1 ? 's' : ''}${pendingCount > 0 ? `, ${pendingCount} pending` : ''})</span>
                <span class="grade-level-badge ${currentGradeLevel}">${currentGradeLevel.toUpperCase()}</span>
            </div>
            <span class="class-expand-icon">▼</span>
        `;

        const studentListDiv = document.createElement('div');
        studentListDiv.className = 'class-student-list';

        studentList.forEach(student => {
            const hasPending = pendingSet.has(student.id);
            const gradeLevel = student.grade_level || 'hs';
            const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

            const studentCard = document.createElement('div');
            studentCard.className = 'class-student-card';
            studentCard.dataset.userId = student.id;
            studentCard.innerHTML = `
                <img src="${student.avatar_url || 'profile.png'}" alt="${student.name}">
                <div class="class-student-info">
                    <div class="class-student-name">
                        ${escapeHtml(student.name)}
                        ${hasPending ? '<span class="pending-dot-small" title="Has pending work"></span>' : ''}
                        <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
                    </div>
                    <div class="class-student-email">${student.email || ''}</div>
                </div>
            `;
            studentCard.addEventListener('click', () => loadStudentDetails(student.id, student.name));
            studentListDiv.appendChild(studentCard);
        });

        let expanded = false;
        header.addEventListener('click', () => {
            expanded = !expanded;
            studentListDiv.classList.toggle('expanded', expanded);
            header.classList.toggle('expanded', expanded);
        });

        accordion.appendChild(header);
        accordion.appendChild(studentListDiv);
        return accordion;
    }

    let hasStudents = false;

    for (const cls of teacherClasses) {
        const classStudents = studentsByClass[cls.id] || [];
        if (classStudents.length > 0) {
            container.appendChild(createAccordionItem(cls.id, cls.name, classStudents));
            hasStudents = true;
        }
    }

    if (unassignedStudents.length > 0) {
        container.appendChild(createAccordionItem('unassigned', 'No Class', unassignedStudents));
        hasStudents = true;
    }

    if (!hasStudents) {
        container.innerHTML = `<div class="no-students">No ${currentGradeLevel.toUpperCase()} students found. Switch to the other grade level to see students.</div>`;
    }
}

async function loadAllStudents() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const allStudents = await getStudentsCached();

    let filteredStudents = allStudents;
    if (currentClassFilter !== 'all') {
        filteredStudents = allStudents.filter(s => s.class_id === currentClassFilter);
    }

    if (currentGradeLevel === 'hs') {
        filteredStudents = filteredStudents.filter(s => s.grade_level === 'hs' || !s.grade_level);
    } else if (currentGradeLevel === 'ms') {
        filteredStudents = filteredStudents.filter(s => s.grade_level === 'ms');
    }

    const container = document.getElementById('student-list-container');
    if (!container) return;

    if (!filteredStudents || filteredStudents.length === 0) {
        container.innerHTML = `<div class="no-students">No ${currentGradeLevel.toUpperCase()} students found</div>`;
        return;
    }

    const pendingSet = await getPendingWorksCached();

    container.innerHTML = '';
    filteredStudents.forEach(profile => {
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card';
        studentCard.dataset.userId = profile.id;

        const hasPending = pendingSet.has(profile.id);
        const redDotHtml = hasPending ? `<span class="pending-dot" title="Has pending work"></span>` : '';

        const gradeLevel = profile.grade_level || 'hs';
        const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

        studentCard.innerHTML = `
            ${redDotHtml}
            <img src="${profile.avatar_url || 'profile.png'}" alt="${profile.name}">
            <div class="student-info">
                <h3>${escapeHtml(profile.name)}</h3>
                <p>${profile.email || ''}</p>
                <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
            </div>
        `;
        studentCard.addEventListener('click', () => loadStudentDetails(profile.id, profile.name));
        container.appendChild(studentCard);
    });

    await renderClassAccordion();
}

function renderClassFilters() {
    const container = document.getElementById('class-filter-container');
    if (!container) return;

    let html = `<button class="class-filter-btn ${currentClassFilter === 'all' ? 'active' : ''}" data-class="all">📋 All Students</button>`;

    teacherClasses.forEach(cls => {
        html += `<button class="class-filter-btn ${currentClassFilter === cls.id ? 'active' : ''}" data-class="${cls.id}">📁 ${escapeHtml(cls.name)}</button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.class-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentClassFilter = btn.dataset.class;
            renderClassFilters();
            loadAllStudents();
        });
    });
}

async function updateStudentLimitDisplay() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    try {
        const { data: teacher } = await window.supabase
            .from('teachers')
            .select('max_students')
            .eq('id', auth.teacher.id)
            .single();

        const maxStudents = teacher?.max_students || 50;

        const { count } = await window.supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_code', auth.teacher.class_code);

        const currentCount = count || 0;

        document.getElementById('student-count-display').textContent = currentCount;
        document.getElementById('student-max-display').textContent = maxStudents;

        const countDisplay = document.getElementById('student-limit-text');
        if (currentCount >= maxStudents) countDisplay.style.color = '#ff8888';
        else if (currentCount >= maxStudents * 0.8) countDisplay.style.color = '#ffa726';
        else countDisplay.style.color = '#81c784';
    } catch (error) {
        console.error("Error in updateStudentLimitDisplay:", error);
    }
}


// ==========================================================
// 9. STUDENT PROFILE — OPTIMIZED (parallel batch, sync render)
// ==========================================================

async function loadStudentDetails(userId, studentName) {
    // Guard: prevent duplicate concurrent loads for same student
    if (_loadingStudentId === userId) return;
    _loadingStudentId = userId;

    currentStudentId = userId;

    document.getElementById('selected-student-name').textContent = studentName;
    document.getElementById('student-details-panel').style.display = 'block';

    const profileTab = document.querySelector('#student-details-panel .tab-btn[data-tab="profile"]');
    if (profileTab) profileTab.click();

    try {
        // Fire all independent queries in parallel
        const [allQuests, progressRes, worksRes, profileRes, badgesRes] = await Promise.all([
            getAllQuestsForTeacher(),
            window.supabase
                .from('student_progress')
                .select('completed_quests, quest_grades, earned_badges, quest_accepted, quest_start_times, standard_deductions')
                .eq('user_id', userId)
                .maybeSingle(),
            window.supabase
                .from('student_works')
                .select('quest_id, grading_status, title, image_url, uploaded_at, description, size, media')
                .eq('user_id', userId),
            window.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle(),
            fetch('badges.json').then(r => r.json()).catch(() => ({ badges: [] }))
        ]);

        const profile = profileRes.data;
        const progress = progressRes.data;
        const works = worksRes.data || [];
        const badgesData = badgesRes.badges || [];

        if (!profile) {
            console.warn("Student profile not found:", userId);
            return;
        }

        // Render all three tabs synchronously from pre-fetched data
        renderStudentProfileData(profile, progress, badgesData, allQuests);
        renderStudentProgressData(userId, progress, works, allQuests);
        renderStudentWorksData(userId, works, allQuests);
    } finally {
        _loadingStudentId = null;
    }
}

// --- Profile tab (sync) ---
function renderStudentProfileData(profile, progress, badgesData, allQuests) {
    document.getElementById('teacher-profile-avatar').src = profile.avatar_url || 'profile.png';
    document.getElementById('teacher-profile-name').textContent = profile.name;
    document.getElementById('teacher-profile-email').textContent = `Email: ${profile.email || 'Not provided'}`;
    document.getElementById('teacher-profile-code').textContent = `Teacher code: ${profile.teacher_code || 'N/A'}`;

    const studentGradeLevel = profile.grade_level || 'hs';
    window._currentStudentGradeLevel = studentGradeLevel;
    const isMS = studentGradeLevel === 'ms';

    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const earnedBadges = progress?.earned_badges || {};
    const standardDeductions = progress?.standard_deductions || {};

    renderStudentStandardsTable(questGrades, completedQuests, isMS, allQuests);
    renderStudentRewards(questGrades, standardDeductions);
    renderStudentBadges(earnedBadges, badgesData, profile.name);
}

function renderStudentStandardsTable(questGrades, completedQuests, isMS, allQuests) {
    const tbody = document.getElementById('teacher-standards-tbody');
    const table = document.getElementById('teacher-standards-table');
    if (!tbody || !table) return;

    const framework = currentFramework || 'ncas';
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const thead = table.querySelector('thead');
    // Use passed allQuests — no re-fetch
    const quests = allQuests || _cachedAllQuests || {};

    if (isIB) {
        if (thead) {
            thead.innerHTML = `<tr><th>Criterion</th><th>Description</th><th>Formative Grade</th><th>Summative Grade</th></tr>`;
        }
        const regularScores = { A: 0, B: 0, C: 0, D: 0 };
        const regularCounts = { A: 0, B: 0, C: 0, D: 0 };
        const mvpScores = { A: 0, B: 0, C: 0, D: 0 };
        const mvpCounts = { A: 0, B: 0, C: 0, D: 0 };

        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (!isCompleted) continue;
            const quest = quests[questId];
            if (!quest || !quest.rubric?.criteria) continue;
            const isMVP = quest.style === 'mvp';
            const grades = questGrades[questId]?.[isMVP ? 'mvpGrade' : 'grade'] || {};
            const targetScores = isMVP ? mvpScores : regularScores;
            const targetCounts = isMVP ? mvpCounts : regularCounts;
            quest.rubric.criteria.forEach(c => {
                const g = grades[c.code];
                if (typeof g === 'number' && !isNaN(g)) {
                    targetScores[c.code] = (targetScores[c.code] || 0) + g;
                    targetCounts[c.code] = (targetCounts[c.code] || 0) + 1;
                }
            });
        }

        const criteria = [
            { code: "A", name: "Knowing & Understanding" },
            { code: "B", name: "Developing Skills" },
            { code: "C", name: "Thinking Creatively" },
            { code: "D", name: "Responding" }
        ];

        tbody.innerHTML = criteria.map(c => `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>${regularCounts[c.code] ? (regularScores[c.code] / regularCounts[c.code]).toFixed(2) : '—'}</td>
                <td>${mvpCounts[c.code] ? (mvpScores[c.code] / mvpCounts[c.code]).toFixed(2) : '—'}</td>
            </tr>
        `).join('');

    } else if (isIGCSE) {
        if (thead) {
            thead.innerHTML = `<tr><th>Assessment Objective</th><th>Description</th><th>Grade</th></tr>`;
        }
        const totalScores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        const totalCounts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };

        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (!isCompleted) continue;
            const quest = quests[questId];
            if (!quest || !quest.rubric?.assessment_objectives) continue;
            const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';
            const grades = questGrades[questId]?.[column] || {};
            quest.rubric.assessment_objectives.forEach(ao => {
                const g = grades[ao.code];
                if (typeof g === 'number' && !isNaN(g)) {
                    totalScores[ao.code] = (totalScores[ao.code] || 0) + g;
                    totalCounts[ao.code] = (totalCounts[ao.code] || 0) + 1;
                }
            });
        }

        const aos = [
            { code: "AO1", name: "Record" },
            { code: "AO2", name: "Explore & Select" },
            { code: "AO3", name: "Develop" },
            { code: "AO4", name: "Present" }
        ];

        tbody.innerHTML = aos.map(ao => {
            const avg = totalCounts[ao.code] ? (totalScores[ao.code] / totalCounts[ao.code]).toFixed(2) : '—';
            let display = avg;
            if (avg !== '—') display = convertNumberToLetterGrade(Math.round(parseFloat(avg)));
            return `<tr><td><strong>${ao.code}</strong></td><td>${ao.name}</td><td>${display}</td></tr>`;
        }).join('');

    } else {
        if (thead) {
            thead.innerHTML = `<tr><th>Standard Code</th><th>Standard Name</th><th>Formative Grade</th><th>Summative Grade</th></tr>`;
        }

        const standards = isMS ? MS_STANDARDS : HS_STANDARDS;
        const regularScores = {};
        const regularCounts = {};
        const mvpScores = {};
        const mvpCounts = {};

        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (!isCompleted) continue;
            const quest = quests[questId];
            if (!quest) continue;
            const isMVP = quest.style === 'mvp';
            const grades = questGrades[questId]?.[isMVP ? 'mvpGrade' : 'grade'] || {};
            const targetScores = isMVP ? mvpScores : regularScores;
            const targetCounts = isMVP ? mvpCounts : regularCounts;
            for (const [code, g] of Object.entries(grades)) {
                if (typeof g !== 'number' || isNaN(g)) continue;
                targetScores[code] = (targetScores[code] || 0) + g;
                targetCounts[code] = (targetCounts[code] || 0) + 1;
            }
        }

        tbody.innerHTML = standards.map(std => `
            <tr>
                <td><strong>${std.code}</strong></td>
                <td>${std.name}</td>
                <td>${regularCounts[std.code] ? (regularScores[std.code] / regularCounts[std.code]).toFixed(2) : '—'}</td>
                <td>${mvpCounts[std.code] ? (mvpScores[std.code] / mvpCounts[std.code]).toFixed(2) : '—'}</td>
            </tr>
        `).join('');
    }
}

function renderStudentRewards(questGrades, standardDeductions) {
    const container = document.getElementById('teacher-total-coins');
    if (!container) return;

    let totalEarned = 0;
    for (const questData of Object.values(questGrades)) {
        const regularGrades = questData.grade || {};
        const mvpGrades = questData.mvpGrade || {};
        for (const grade of [...Object.values(regularGrades), ...Object.values(mvpGrades)]) {
            if (typeof grade === 'number' && !isNaN(grade)) totalEarned += Math.round(grade * 10);
        }
    }

    let totalDeductions = 0;
    for (const d of Object.values(standardDeductions)) {
        if (typeof d === 'number') totalDeductions += d;
    }

    const netRewards = Math.max(0, totalEarned - totalDeductions);
    container.innerHTML = `Total Coins: <strong>${netRewards} 💰</strong>`;
}

function renderStudentBadges(earnedBadges, badgesData, studentName) {
    const container = document.getElementById('teacher-badges-container');
    if (!container) return;

    container.innerHTML = '';
    const badgesGrid = document.createElement('div');
    badgesGrid.className = 'badge-container';

    const sortedBadges = [...badgesData].sort((a, b) => {
        const order = { path: 1, skill: 2, progression: 3, teacher: 4 };
        return (order[a.category] || 5) - (order[b.category] || 5);
    });

    for (const badge of sortedBadges) {
        const badgeSlot = document.createElement('div');
        badgeSlot.className = 'badge-slot';

        const earnedInfo = earnedBadges[badge.id];
        const isEarned = earnedInfo?.earned === true;

        const img = document.createElement('img');

        if (badge.progression && isEarned && earnedInfo?.image) {
            img.src = earnedInfo.image;
        } else if (badge.progression && !isEarned && earnedInfo?.count !== undefined) {
            img.src = badge.image;
            img.style.opacity = '0.3';
        } else {
            img.src = badge.image;
        }

        img.alt = badge.name;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.borderRadius = '50%';

        let tooltipText = '';
        if (isEarned) {
            if (badge.progression && earnedInfo?.tooltip) tooltipText = earnedInfo.tooltip;
            else if (badge.teacherAwarded) tooltipText = `Teacher Award: ${badge.name}`;
            else tooltipText = badge.tooltipEarned ? badge.tooltipEarned.replace('{name}', studentName) : badge.name;
        } else {
            if (badge.progression) {
                const count = earnedInfo?.count || 0;
                const nextLevel = badge.levels?.find(l => l.count > count);
                tooltipText = nextLevel
                    ? `Quest Completer: ${count}/${nextLevel.count} summatives completed. ${nextLevel.tooltip}`
                    : (badge.tooltipShadow || badge.name);
            } else {
                tooltipText = badge.tooltipShadow || badge.name;
            }
        }

        badgeSlot.setAttribute('data-tooltip', tooltipText);
        badgeSlot.classList.add(isEarned ? 'earned' : 'shadow');

        if (badge.teacherAwarded && !isEarned) {
            badgeSlot.style.cursor = 'pointer';
            badgeSlot.addEventListener('click', async (e) => {
                e.stopPropagation();
                const isValid = await verifyTeacherPassword();
                if (!isValid) {
                    alert("Password verification failed. Badge not awarded.");
                    return;
                }

                const userId = currentStudentId;
                const { data: progress } = await window.supabase
                    .from('student_progress')
                    .select('earned_badges')
                    .eq('user_id', userId)
                    .maybeSingle();

                const updatedBadges = progress?.earned_badges || {};
                updatedBadges[badge.id] = {
                    earned: true,
                    teacherAwarded: true,
                    earnedAt: new Date().toISOString()
                };

                const { error: upsertError } = await window.supabase
                    .from('student_progress')
                    .upsert({
                        user_id: userId,
                        earned_badges: updatedBadges,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });

                if (upsertError) {
                    alert("Error saving badge: " + upsertError.message);
                } else {
                    alert(`✅ Badge "${badge.name}" awarded!`);
                    await loadStudentDetails(userId, studentName);
                }
            });
        }

        badgeSlot.appendChild(img);
        badgesGrid.appendChild(badgeSlot);
    }

    container.appendChild(badgesGrid);
}

// --- Progress tab (sync) ---
function renderStudentProgressData(userId, progress, works, allQuests) {
    const container = document.getElementById('student-quests-list');
    if (!container) return;

    const completedQuests = progress?.completed_quests || {};
    const questGrades = progress?.quest_grades || {};
    const questAccepted = progress?.quest_accepted || {};
    const questStartTimes = progress?.quest_start_times || {};

    const savedWorksMap = new Map();
    (works || []).forEach(work => {
        savedWorksMap.set(work.quest_id, {
            grading_status: work.grading_status,
            title: work.title,
            hasImage: !!work.image_url,
            uploaded_at: work.uploaded_at
        });
    });

    const completedQuestList = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true);

    const activeQuestList = [];
    for (const [questId, isAccepted] of Object.entries(questAccepted)) {
        if (isAccepted === true && !completedQuests[questId]) activeQuestList.push(questId);
    }

    const pendingQuestList = [];
    for (const [questId] of savedWorksMap) {
        if (!completedQuestList.includes(questId) && !activeQuestList.includes(questId)) pendingQuestList.push(questId);
    }

    const allDisplayQuests = [...new Set([...completedQuestList, ...activeQuestList, ...pendingQuestList])];

    if (allDisplayQuests.length === 0) {
        container.innerHTML = '<div class="no-data">No quests with saved work or completed quests yet</div>';
        return;
    }

    const sortedQuests = allDisplayQuests.sort((a, b) => {
        const aIsActive = activeQuestList.includes(a);
        const bIsActive = activeQuestList.includes(b);
        const aIsCompleted = completedQuestList.includes(a);
        const bIsCompleted = completedQuestList.includes(b);
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        if (!aIsCompleted && bIsCompleted) return -1;
        if (aIsCompleted && !bIsCompleted) return 1;
        return 0;
    });

    container.innerHTML = '';

    if (activeQuestList.length > 0) {
        const activeHeader = document.createElement('div');
        activeHeader.className = 'quest-section-header';
        activeHeader.innerHTML = '<h3>🟢 Active Quests</h3><hr>';
        container.appendChild(activeHeader);
    }

    const template = document.getElementById('quest-item-template');
    let lastWasActive = true;
    let activeSectionEnded = false;

    for (const questId of sortedQuests) {
        const quest = allQuests[questId];
        if (!quest) continue;

        const isActive = activeQuestList.includes(questId);
        const isCompleted = completedQuestList.includes(questId);
        const hasSavedWork = savedWorksMap.has(questId);
        const workInfo = savedWorksMap.get(questId);

        if (!isActive && !activeSectionEnded && !isCompleted) {
            const pendingHeader = document.createElement('div');
            pendingHeader.className = 'quest-section-header';
            pendingHeader.innerHTML = '<h3>⏳ Pending Grading</h3><hr>';
            container.appendChild(pendingHeader);
            activeSectionEnded = true;
            lastWasActive = false;
        }

        if (isCompleted && (lastWasActive || !activeSectionEnded)) {
            const completedHeader = document.createElement('div');
            completedHeader.className = 'quest-section-header';
            completedHeader.innerHTML = '<h3>✅ Completed & Graded</h3><hr>';
            container.appendChild(completedHeader);
            activeSectionEnded = true;
            lastWasActive = false;
        }

        const clone = template.content.cloneNode(true);
        const questDiv = clone.querySelector('.teacher-quest-item');
        questDiv.dataset.questId = questId;

        const titleSpan = clone.querySelector('.teacher-quest-title');
        titleSpan.textContent = quest.title || questId;

        const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';

        if (isCompleted) {
            const datesContainer = clone.querySelector('.teacher-quest-dates');
            if (datesContainer) {
                const startTime = questStartTimes[questId];
                const completedDate = workInfo?.uploaded_at ? new Date(workInfo.uploaded_at) : new Date();
                if (startTime) {
                    const startDate = new Date(startTime);
                    datesContainer.innerHTML = `
                        <span class="quest-date">📅 Started: ${startDate.toLocaleDateString()}</span>
                        <span class="quest-date">✅ Completed: ${completedDate.toLocaleDateString()}</span>
                    `;
                } else {
                    datesContainer.innerHTML = `<span class="quest-date">✅ Completed: ${completedDate.toLocaleDateString()}</span>`;
                }
            }
        }

        const grades = questGrades[questId]?.[column] || {};
        const hasGrades = Object.keys(grades).length > 0;

        let statusText = '', statusClass = '', showRedDot = false;
        if (isActive) { statusText = '🟢 Active'; statusClass = 'active'; }
        else if (hasGrades) { statusText = '✓ Graded'; statusClass = 'graded'; }
        else if (hasSavedWork && workInfo?.grading_status === 'pending') { statusText = '⚠ Pending Grading'; statusClass = 'pending'; showRedDot = true; }
        else if (isCompleted) { statusText = '⚠ Not Graded'; statusClass = 'ungraded'; showRedDot = true; }
        else if (hasSavedWork) { statusText = '⚠ Pending Grading'; statusClass = 'pending'; showRedDot = true; }
        else { statusText = 'Not Started'; statusClass = 'not-started'; }

        const statusSpan = clone.querySelector('.teacher-quest-status');
        statusSpan.textContent = statusText;
        statusSpan.classList.add(statusClass);

        if (showRedDot) {
            const redDot = document.createElement('span');
            redDot.className = 'quest-pending-dot';
            redDot.innerHTML = '🔴';
            redDot.style.marginLeft = '8px';
            redDot.style.fontSize = '12px';
            redDot.title = 'Awaiting grading';
            statusSpan.appendChild(redDot);
        }

        const expandBtn = clone.querySelector('.teacher-expand-btn');
        const detailsDiv = clone.querySelector('.teacher-quest-details');

        expandBtn.addEventListener('click', () => {
            const isVisible = detailsDiv.style.display === 'block';
            detailsDiv.style.display = isVisible ? 'none' : 'block';
            expandBtn.textContent = isVisible ? '▼' : '▲';
            if (!isVisible) loadRubricForQuest(questId, quest, questGrades, detailsDiv, userId);
        });

        const viewWorkBtn = clone.querySelector('.teacher-view-work-btn');
        viewWorkBtn.addEventListener('click', () => viewStudentWork(userId, questId));

        const deleteBtn = clone.querySelector('.teacher-delete-quest-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const statusText = isActive ? 'ACTIVE' : (isCompleted ? 'COMPLETED' : 'PENDING');
                const confirmDelete = confirm(
                    `⚠️ DELETE QUEST DATA\n\n` +
                    `Quest: ${quest.title || questId}\n` +
                    `Student: ${document.getElementById('selected-student-name').textContent}\n` +
                    `Status: ${statusText}\n\n` +
                    `This will permanently delete:\n` +
                    `• All grades for this quest\n` +
                    `• Student's artwork submission\n` +
                    `• Timer data for this quest\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Click OK to delete.`
                );
                if (!confirmDelete) return;
                await deleteQuestData(userId, questId, quest, allQuests);
                invalidateStudentsCache();
                invalidateTabCache('students');
                invalidateTabCache('analytics');
                await loadStudentDetails(userId, document.getElementById('selected-student-name').textContent);
            });
        }

        container.appendChild(clone);
        lastWasActive = isActive;
    }
}

// --- Works tab (sync) ---
function renderStudentWorksData(userId, works, allQuests) {
    const container = document.getElementById('student-works-gallery');
    if (!container) return;

    if (!works || works.length === 0) {
        container.innerHTML = '<div class="no-data">No artwork uploaded yet</div>';
        return;
    }

    container.innerHTML = '';

    for (const work of works) {
        const quest = allQuests[work.quest_id];
        const questTitle = quest?.title || work.quest_id;

        const workItem = document.createElement('div');
        workItem.className = 'teacher-gallery-item';
        workItem.innerHTML = `
            <div class="teacher-gallery-thumbnail">
                ${work.image_url ?
                    `<img src="${work.image_url}" alt="${work.title || 'Artwork'}">` :
                    `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 12px; color: #999; background: rgba(0,0,0,0.3); padding: 2px;">No artwork<br>uploaded<br>🖼️</div>`
                }
            </div>
            <div class="teacher-gallery-info">
                <div class="teacher-gallery-title">${work.title || 'Untitled'}</div>
                <div class="teacher-gallery-quest">Quest: ${questTitle}</div>
                <button class="teacher-gallery-view-btn" data-quest="${work.quest_id}">View Details</button>
            </div>
        `;

        const viewBtn = workItem.querySelector('.teacher-gallery-view-btn');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewStudentWork(userId, work.quest_id);
        });

        container.appendChild(workItem);
    }
}


// ==========================================================
// 10. GRADING
// ==========================================================

async function loadRubricForQuest(questId, quest, questGrades, detailsDiv, userId) {
    const rubricContainer = detailsDiv.querySelector('.teacher-rubric-container');

    if (!quest.rubric) {
        rubricContainer.innerHTML = '<p>No rubric available</p>';
        return;
    }

    const { data: profile } = await window.supabase
        .from('profiles')
        .select('grade_level')
        .eq('id', userId)
        .maybeSingle();

    const studentGradeLevel = profile?.grade_level || 'hs';
    const isMS = studentGradeLevel === 'ms';

    const savedData = await loadTeacherQuestStandards(questId);
    const selectedStandards = savedData?.selected_standards || null;
    const rubricDescriptions = savedData?.rubric_descriptions || null;

    const isIB = quest.rubric.criteria && Array.isArray(quest.rubric.criteria) && quest.rubric.criteria.length > 0;
    const isNCAS = quest.rubric.standards && Array.isArray(quest.rubric.standards) && quest.rubric.standards.length > 0;
    const isIGCSE = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives) && quest.rubric.assessment_objectives.length > 0;

    let itemsToShow = [];
    let gradeLevels = [];
    let gradeInputMax = 0;
    let headerLabel = '';

    if (isNCAS) {
        if (isMS) {
            itemsToShow = MS_STANDARDS.map(std => ({
                ...std,
                levels: quest.rubric.standards?.find(s => s.code === std.code)?.levels || { "4": "", "3": "", "2": "", "1": "" }
            }));
        } else {
            itemsToShow = quest.rubric.standards;
        }
        gradeLevels = ['4', '3', '2', '1'];
        gradeInputMax = 4;
        headerLabel = 'Standard';
    } else if (isIB) {
        itemsToShow = quest.rubric.criteria;
        gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        gradeInputMax = 8;
        headerLabel = 'Criterion';
    } else if (isIGCSE) {
        itemsToShow = quest.rubric.assessment_objectives;
        gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        gradeInputMax = 8;
        headerLabel = 'Assessment Objective';
    }

    if (selectedStandards && selectedStandards.length > 0) {
        itemsToShow = itemsToShow.filter(item => selectedStandards.includes(item.code));
    }

    if (rubricDescriptions) {
        itemsToShow = itemsToShow.map(item => {
            const desc = rubricDescriptions[item.code];
            if (desc) {
                const mergedLevels = {};
                gradeLevels.forEach(level => {
                    mergedLevels[level] = desc[level] || item.levels?.[level] || "";
                });
                return { ...item, levels: mergedLevels };
            }
            return item;
        });
    }

    if (itemsToShow.length === 0) {
        rubricContainer.innerHTML = `<div class="rubric-empty-message">
            <p>📋 No ${headerLabel}s Selected</p>
            <p>Your teacher has not selected any ${headerLabel}s for this quest yet.</p>
            <p>Please check back later or contact your teacher.</p>
        </div>`;
        return;
    }

    const column = quest.style === "mvp" ? "mvpGrade" : "grade";
    const grades = questGrades[questId]?.[column] || {};

    let html = `<table class="rubric-table">
        <thead><tr><th>${headerLabel}</th><th>${gradeLevels[0]}</th><th>${gradeLevels[1]}</th><th>${gradeLevels[2]}</th><th>${gradeLevels[3]}</th><th>Grade</th></tr></thead>
        <tbody>`;

    for (const item of itemsToShow) {
        const savedGrade = grades[item.code] || "";
        let displayValue = savedGrade;
        if (isIGCSE && savedGrade) displayValue = convertNumberToLetterGrade(parseInt(savedGrade));

        html += `<tr>
            <td><strong>${item.code}</strong>${item.name ? `: ${item.name}` : ''}</td>
            <td>${item.levels[gradeLevels[0]] || ""}</td>
            <td>${item.levels[gradeLevels[1]] || ""}</td>
            <td>${item.levels[gradeLevels[2]] || ""}</td>
            <td>${item.levels[gradeLevels[3]] || ""}</td>
            <td>`;

        if (isIGCSE) {
            html += `<input type="text" value="${displayValue}" class="teacher-grade-input" data-standard="${item.code}" data-quest="${questId}" placeholder="A*-G" maxlength="2">`;
        } else {
            html += `<input type="number" step="0.5" min="1" max="${gradeInputMax}" value="${savedGrade}" class="teacher-grade-input" data-standard="${item.code}" data-quest="${questId}">`;
        }

        html += `</td></tr>`;
    }

    html += `</tbody></table>
    <button class="teacher-save-grades-btn" data-quest="${questId}">Save Grades</button>`;

    const existingGrades = questGrades[questId]?.[column] || {};
    const savedComment = existingGrades.teacher_comment || '';

    const commentHtml = `
        <div class="teacher-comment-field" style="margin-top: 15px;">
            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-size: 12px;">📝 Teacher Comment (visible to student):</label>
            <textarea class="teacher-comment-input" data-quest="${questId}" rows="3" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 6px; color: white; resize: vertical; font-family: inherit;">${escapeHtml(savedComment)}</textarea>
        </div>
    `;

    rubricContainer.innerHTML = html + commentHtml;

    const saveBtn = rubricContainer.querySelector('.teacher-save-grades-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveTeacherGrades(questId, quest, userId, detailsDiv));
}

async function saveTeacherGrades(questId, quest, userId, detailsDiv) {
    const inputs = detailsDiv.querySelectorAll('.teacher-grade-input');
    const grades = {};

    const isIB = quest.rubric && quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
    const isIGCSE = quest.rubric && quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);

    let maxGrade = 4;
    if (isIB) maxGrade = 8;
    if (isIGCSE) maxGrade = 8;

    inputs.forEach(input => {
        const standard = input.dataset.standard;
        const value = input.value;

        if (isIGCSE) {
            const numValue = convertLetterGradeToNumber(value);
            if (numValue !== null) grades[standard] = numValue;
        } else {
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue >= 1 && numValue <= maxGrade) grades[standard] = numValue;
        }
    });

    const commentInput = detailsDiv.querySelector('.teacher-comment-input');
    if (commentInput) grades.teacher_comment = commentInput.value.trim();

    grades.completed_at = new Date().toISOString();
    const column = quest.style === "mvp" ? "mvpGrade" : "grade";

    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests, earned_badges, quest_accepted, quest_start_times')
        .eq('user_id', userId)
        .maybeSingle();

    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const existingBadges = progress?.earned_badges || {};
    const questAccepted = progress?.quest_accepted || {};
    const questStartTimes = progress?.quest_start_times || {};

    if (!questGrades[questId]) questGrades[questId] = {};
    questGrades[questId][column] = grades;
    completedQuests[questId] = true;

    const { error } = await window.supabase
        .from('student_progress')
        .upsert({
            user_id: userId,
            quest_grades: questGrades,
            completed_quests: completedQuests,
            earned_badges: existingBadges,
            quest_accepted: questAccepted,
            quest_start_times: questStartTimes,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        alert('Error saving grades: ' + error.message);
        return;
    }

    await window.supabase
        .from('student_works')
        .update({ grading_status: 'graded' })
        .eq('user_id', userId)
        .eq('quest_id', questId);

    alert('Grades saved and quest marked as complete!');

    const statusSpan = detailsDiv.closest('.teacher-quest-item').querySelector('.teacher-quest-status');
    if (statusSpan) {
        statusSpan.textContent = '✓ Graded';
        statusSpan.classList.remove('ungraded', 'pending');
        statusSpan.classList.add('graded');
        const redDot = statusSpan.querySelector('.quest-pending-dot');
        if (redDot) redDot.remove();
    }

    await updateStudentCardPendingCount(userId);
    invalidateStudentsCache();
    invalidateTabCache('students');
    invalidateTabCache('analytics');
    invalidateTabCache('quests');
    await loadStudentDetails(userId, document.getElementById('selected-student-name').textContent);
    await syncStudentBadges(userId);
}

async function updateStudentCardPendingCount(userId) {
    const { data: pendingWorks } = await window.supabase
        .from('student_works')
        .select('id')
        .eq('user_id', userId)
        .eq('grading_status', 'pending');

    const pendingCount = pendingWorks?.length || 0;
    const studentCard = document.querySelector(`.student-card[data-user-id="${userId}"]`);

    if (studentCard) {
        const existingDot = studentCard.querySelector('.pending-dot');
        if (existingDot) existingDot.remove();

        if (pendingCount > 0) {
            const redDot = document.createElement('span');
            redDot.className = 'pending-dot';
            redDot.title = `${pendingCount} quest${pendingCount !== 1 ? 's' : ''} pending grading`;
            studentCard.insertBefore(redDot, studentCard.firstChild);
        }
    }
}

async function deleteQuestData(userId, questId, quest, allQuests) {
    try {
        await window.supabase
            .from('student_works')
            .delete()
            .eq('user_id', userId)
            .eq('quest_id', questId);

        const { data: progress, error: progressError } = await window.supabase
            .from('student_progress')
            .select('quest_grades, completed_quests, earned_badges, quest_accepted, quest_start_times')
            .eq('user_id', userId)
            .maybeSingle();

        if (progressError || !progress) {
            alert("No progress data found for this student.");
            return;
        }

        const questGrades = progress.quest_grades || {};
        const completedQuests = progress.completed_quests || {};
        const questAccepted = progress.quest_accepted || {};
        const questStartTimes = progress.quest_start_times || {};
        const earnedBadges = progress.earned_badges || {};

        let modified = false;

        if (questGrades[questId]) { delete questGrades[questId]; modified = true; }
        if (completedQuests[questId]) { delete completedQuests[questId]; modified = true; }
        if (questAccepted[questId]) { delete questAccepted[questId]; modified = true; }
        if (questStartTimes[questId]) { delete questStartTimes[questId]; modified = true; }

        // Badge recalculation if MVP
        if (quest && quest.style === 'mvp') {
            const allCompletedQuestIds = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true);
            const mvpCount = allCompletedQuestIds.filter(qid => {
                const q = allQuests ? allQuests[qid] : null;
                return q && q.style === 'mvp';
            }).length;

            if (mvpCount < 1 && earnedBadges.quest_completer) {
                delete earnedBadges.quest_completer;
                modified = true;
            } else if (earnedBadges.quest_completer) {
                const badgesRes = await fetch('badges.json');
                const badgesData = (await badgesRes.json()).badges;
                const progressionBadge = badgesData.find(b => b.id === 'quest_completer');

                if (progressionBadge && progressionBadge.levels) {
                    let earnedLevel = null;
                    for (const level of progressionBadge.levels) {
                        if (mvpCount >= level.count) earnedLevel = level;
                    }

                    if (earnedLevel && earnedLevel.level !== earnedBadges.quest_completer.level) {
                        earnedBadges.quest_completer = {
                            earned: true,
                            level: earnedLevel.level,
                            count: mvpCount,
                            image: earnedLevel.image,
                            borderClass: earnedLevel.borderClass,
                            tooltip: earnedLevel.tooltip,
                            earnedAt: new Date().toISOString()
                        };
                        modified = true;
                    }
                }
            }
        }

        if (!modified) {
            alert("No data found for this quest to delete.");
            return;
        }

        const { error: updateError } = await window.supabase
            .from('student_progress')
            .update({
                quest_grades: questGrades,
                completed_quests: completedQuests,
                quest_accepted: questAccepted,
                quest_start_times: questStartTimes,
                earned_badges: earnedBadges,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) {
            alert("Error deleting grades: " + updateError.message);
            return;
        }

        alert(`✅ Quest data deleted successfully!\n\nAll grades and artwork for "${quest?.title || questId}" have been removed.`);
        invalidateStudentsCache();
    } catch (error) {
        console.error("Error in deleteQuestData:", error);
        alert("An error occurred while deleting quest data: " + error.message);
    }
}


// ==========================================================
// 11. BADGES
// ==========================================================

async function syncStudentBadges(studentId) {
    try {
        const { data: progress } = await window.supabase
            .from('student_progress')
            .select('completed_quests, earned_badges')
            .eq('user_id', studentId)
            .maybeSingle();

        if (!progress) return false;

        const allQuests = await getAllQuestsForTeacher();
        const completedQuests = progress.completed_quests || {};

        let mvpCount = 0;
        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (isCompleted === true) {
                const quest = allQuests[questId];
                if (quest && quest.style === 'mvp') mvpCount++;
            }
        }

        const badgesRes = await fetch('badges.json');
        const badgesData = await badgesRes.json();
        const progressionBadge = badgesData.badges.find(b => b.id === 'quest_completer');

        if (!progressionBadge || !progressionBadge.levels) return false;

        let earnedLevel = null;
        for (const level of progressionBadge.levels) {
            if (mvpCount >= level.count) earnedLevel = level;
        }

        const updatedBadges = progress.earned_badges || {};

        if (earnedLevel) {
            updatedBadges.quest_completer = {
                earned: true,
                level: earnedLevel.level,
                count: mvpCount,
                image: earnedLevel.image,
                borderClass: earnedLevel.borderClass,
                tooltip: earnedLevel.tooltip,
                earnedAt: new Date().toISOString()
            };
        } else if (mvpCount === 0 && updatedBadges.quest_completer) {
            delete updatedBadges.quest_completer;
        }

        const { error: updateError } = await window.supabase
            .from('student_progress')
            .update({ earned_badges: updatedBadges })
            .eq('user_id', studentId);

        if (updateError) return false;
        return true;
    } catch (error) {
        console.error("Error in syncStudentBadges:", error);
        return false;
    }
}

async function syncAllStudentBadges() {
    const auth = await checkTeacherAuth();
    if (!auth) { alert("Not authenticated"); return; }

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed."); return; }

    const students = await getStudentsCached(true);
    if (!students.length) { alert("No students found."); return; }

    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
        const success = await syncStudentBadges(student.id);
        if (success) successCount++;
        else errorCount++;
    }

    alert(`Badges synced!\n✅ ${successCount} students updated\n❌ ${errorCount} errors`);
}


// ==========================================================
// 12. CLASS MANAGEMENT TAB
// ==========================================================

async function loadClasses() {
    const auth = await checkTeacherAuth();
    if (!auth) return [];

    const { data, error } = await window.supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', auth.teacher.id)
        .order('name');

    if (error) {
        console.error("Error loading classes:", error);
        return [];
    }

    teacherClasses = data || [];
    return teacherClasses;
}

async function renderClassManagementView() {
    try {
        const auth = await checkTeacherAuth();
        if (!auth) return;

        const allStudents = await getStudentsCached();
        const pendingSet = await getPendingWorksCached();

        let filteredStudents = [];
        if (currentGradeLevel === 'hs') {
            filteredStudents = allStudents.filter(s => s.grade_level === 'hs' || !s.grade_level);
        } else if (currentGradeLevel === 'ms') {
            filteredStudents = allStudents.filter(s => s.grade_level === 'ms');
        } else {
            filteredStudents = allStudents;
        }

        const allUnassignedStudents = allStudents.filter(s => !s.class_id);

        const studentsByClass = {};
        const unassignedStudents = [];

        filteredStudents.forEach(student => {
            if (student.class_id) {
                if (!studentsByClass[student.class_id]) studentsByClass[student.class_id] = [];
                studentsByClass[student.class_id].push(student);
            } else {
                unassignedStudents.push(student);
            }
        });

        const dropZones = document.getElementById('class-drop-zones');
        if (!dropZones) return;
        dropZones.innerHTML = '';

        if (allUnassignedStudents.length > 0) {
            const unassignedColumn = createClassColumn('unassigned', 'Unassigned', allUnassignedStudents, pendingSet, null);
            dropZones.appendChild(unassignedColumn);
        }

        const filteredClasses = teacherClasses.filter(cls => {
            return cls.grade_level === currentGradeLevel ||
                   (currentGradeLevel === 'hs' && !cls.grade_level);
        });

        for (const cls of filteredClasses) {
            const classStudents = studentsByClass[cls.id] || [];
            const column = createClassColumn(cls.id, cls.name, classStudents, pendingSet, cls);
            dropZones.appendChild(column);
        }

        const addColumn = document.createElement('div');
        addColumn.className = 'class-drop-zone';
        addColumn.style.cssText = 'display: flex; align-items: center; justify-content: center; min-height: 200px;';
        addColumn.innerHTML = '<button id="add-new-class-btn" class="add-class-btn">+ Create New Class</button>';
        dropZones.appendChild(addColumn);

        const addBtn = document.getElementById('add-new-class-btn');
        if (addBtn) addBtn.addEventListener('click', showCreateClassModal);

        if (bulkAssignMode) updateBulkPanelUI();
        if (deleteMode) updateDeletePanelUI();

    } catch (error) {
        console.error("Error in renderClassManagementView:", error);
    }
}

function createClassColumn(classId, className, students, pendingSet, classData) {
    const column = document.createElement('div');
    column.className = 'class-drop-zone';
    column.dataset.classId = classId;

    const header = document.createElement('div');
    header.className = 'class-header';

    const gradeLevel = classData?.grade_level || 'hs';
    const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

    header.innerHTML = `
        <div>
            <span class="class-title">🗃️ ${escapeHtml(className)}</span>
            <span class="class-grade-badge ${gradeLevel}">${gradeBadge}</span>
            <span class="class-student-count">(${students.length} student${students.length !== 1 ? 's' : ''})</span>
        </div>
        ${classData ? `<button class="delete-class-btn" data-id="${classData.id}" title="Delete Class">🗑️</button>` : ''}
    `;

    const studentList = document.createElement('div');
    studentList.className = 'class-student-list';

    students.forEach(student => {
        const hasPending = pendingSet.has(student.id);
        const studentCard = createDraggableStudentCard(student, hasPending);
        studentList.appendChild(studentCard);
    });

    column.appendChild(header);
    column.appendChild(studentList);
    column.setAttribute('draggable', 'false');

    column.addEventListener('dragover', (e) => { e.preventDefault(); column.classList.add('drag-over'); });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));

    column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');

        const studentId = e.dataTransfer.getData('text/plain');
        if (!studentId) return;

        const targetClassId = classId === 'unassigned' ? null : classId;
        await assignStudentToClass(studentId, targetClassId);
        invalidateTabCache('classes');
        invalidateTabCache('students');
        await renderClassManagementView();
        await renderClassAccordion();
    });

    if (classData) {
        const deleteBtn = header.querySelector('.delete-class-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete class "${className}"? Students will be moved to Unassigned.`)) {
                    await deleteClass(classData.id);
                }
            });
        }
    }

    return column;
}

function createDraggableStudentCard(student, hasPending) {
    const card = document.createElement('div');
    card.className = 'class-student-card';
    card.dataset.studentId = student.id;

    const gradeLevel = student.grade_level || 'hs';
    const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

    if (bulkAssignMode) {
        card.draggable = false;
        const isChecked = selectedStudentsForBulk.has(student.id);
        card.innerHTML = `
            <input type="checkbox" class="bulk-student-checkbox" data-id="${student.id}" ${isChecked ? 'checked' : ''}>
            <img src="${student.avatar_url || 'profile.png'}" class="class-student-avatar">
            <span class="class-student-name">${escapeHtml(student.name)}${hasPending ? ' 🔴' : ''}</span>
            <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
        `;

        const checkbox = card.querySelector('.bulk-student-checkbox');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) selectedStudentsForBulk.add(student.id);
            else selectedStudentsForBulk.delete(student.id);
            updateBulkPanelUI();
        });
    } else if (deleteMode) {
        card.draggable = false;
        const isChecked = selectedStudentsForDelete.has(student.id);
        card.innerHTML = `
            <input type="checkbox" class="delete-student-checkbox" data-id="${student.id}" ${isChecked ? 'checked' : ''}>
            <img src="${student.avatar_url || 'profile.png'}" class="class-student-avatar">
            <span class="class-student-name">${escapeHtml(student.name)}${hasPending ? ' 🔴' : ''}</span>
            <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
        `;

        const checkbox = card.querySelector('.delete-student-checkbox');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) selectedStudentsForDelete.add(student.id);
            else selectedStudentsForDelete.delete(student.id);
            updateDeletePanelUI();
        });
    } else {
        card.draggable = true;
        card.style.cursor = 'grab';
        card.innerHTML = `
            <img src="${student.avatar_url || 'profile.png'}" class="class-student-avatar">
            <span class="class-student-name">${escapeHtml(student.name)}${hasPending ? ' 🔴' : ''}</span>
            <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
        `;

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', student.id);
            e.dataTransfer.effectAllowed = 'move';
            card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', () => { card.style.opacity = '1'; });

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            loadStudentDetails(student.id, student.name);
        });
    }

    return card;
}

async function assignStudentToClass(studentId, classId) {
    let gradeLevel = 'hs';
    if (classId) {
        const classData = teacherClasses.find(c => c.id === classId);
        if (classData) gradeLevel = classData.grade_level || 'hs';
    }

    const { error } = await window.supabase
        .from('profiles')
        .update({ class_id: classId, grade_level: gradeLevel })
        .eq('id', studentId);

    if (error) {
        console.error("Error assigning student:", error);
        alert("Error assigning student: " + error.message);
    } else {
        invalidateStudentsCache();
        invalidateTabCache('classes');
        invalidateTabCache('students');
        invalidateTabCache('analytics');
    }
}

async function deleteClass(classId) {
    try {
        await window.supabase.from('profiles').update({ class_id: null }).eq('class_id', classId);
        await window.supabase.from('student_invitations').delete().eq('class_id', classId);
        await window.supabase.from('class_settings').delete().eq('class_id', classId);
        await window.supabase.from('class_schedule_overrides').delete().eq('class_id', classId);
        await window.supabase.from('class_weekend_settings').delete().eq('class_id', classId);
        await window.supabase.from('class_schedule_rules').delete().eq('class_id', classId);

        const { error } = await window.supabase.from('classes').delete().eq('id', classId);

        if (error) {
            alert("Error deleting class: " + error.message);
            return;
        }

        invalidateStudentsCache();
        invalidateTabCache('classes');
        invalidateTabCache('students');
        invalidateTabCache('analytics');
        await loadClasses();
        await renderClassManagementView();
        await renderClassAccordion();
        alert("Class deleted successfully!");
    } catch (error) {
        console.error("Unexpected error:", error);
        alert("An unexpected error occurred while deleting the class.");
    }
}

function showCreateClassModal() {
    const modal = document.getElementById('create-class-modal');
    modal.classList.add('open');

    const input = document.getElementById('new-class-name-input');
    const gradeSelect = document.getElementById('new-class-grade');
    input.value = '';
    gradeSelect.value = 'hs';

    const confirmBtn = document.getElementById('confirm-create-class');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
        const className = input.value.trim();
        const gradeLevel = gradeSelect.value;

        if (!className) { alert("Please enter a class name."); return; }

        const auth = await checkTeacherAuth();
        if (!auth) return;

        const { error } = await window.supabase
            .from('classes')
            .insert({ teacher_id: auth.teacher.id, name: className, grade_level: gradeLevel });

        if (error) {
            alert("Error creating class: " + error.message);
        } else {
            modal.style.display = 'none';
            invalidateTabCache('classes');
            await loadClasses();
            await renderClassManagementView();
            await renderClassAccordion();
            alert("Class created successfully!");
        }
    });
}

function toggleBulkAssignMode() {
    bulkAssignMode = !bulkAssignMode;
    selectedStudentsForBulk.clear();

    const bulkBtn = document.getElementById('bulk-assign-mode-btn');
    if (bulkBtn) {
        bulkBtn.classList.toggle('active', bulkAssignMode);
        bulkBtn.textContent = bulkAssignMode ? '✕ Exit Bulk Mode' : '✓ Bulk Assign Students';
    }

    renderClassManagementView();
}

async function confirmBulkAssign() {
    const select = document.getElementById('bulk-class-select');
    const targetClassId = select.value;

    if (!targetClassId) { alert("Please select a class"); return; }
    if (selectedStudentsForBulk.size === 0) { alert("No students selected"); return; }

    const classIdToAssign = targetClassId === 'unassigned' ? null : targetClassId;

    for (const studentId of selectedStudentsForBulk) {
        await assignStudentToClass(studentId, classIdToAssign);
    }

    selectedStudentsForBulk.clear();
    bulkAssignMode = false;
    invalidateStudentsCache();

    await renderClassManagementView();
    await renderClassAccordion();

    const bulkBtn = document.getElementById('bulk-assign-mode-btn');
    if (bulkBtn) {
        bulkBtn.classList.remove('active');
        bulkBtn.textContent = '✓ Bulk Assign Students';
    }

    alert(`Students assigned successfully`);
    await updateStudentLimitDisplay();
}

function updateBulkPanelUI() {
    const bulkPanel = document.getElementById('bulk-assign-panel');
    const studentListDiv = document.getElementById('bulk-student-list');
    const classSelect = document.getElementById('bulk-class-select');

    if (selectedStudentsForBulk.size > 0) {
        bulkPanel.style.display = 'block';

        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        classSelect.innerHTML += '<option value="unassigned">📁 No Class (Unassigned)</option>';
        teacherClasses.forEach(cls => {
            classSelect.innerHTML += `<option value="${cls.id}">📁 ${escapeHtml(cls.name)}</option>`;
        });

        studentListDiv.innerHTML = `<span>${selectedStudentsForBulk.size} student(s) selected</span>`;
    } else {
        bulkPanel.style.display = 'none';
    }
}

function toggleDeleteMode() {
    deleteMode = !deleteMode;
    selectedStudentsForDelete.clear();

    const deleteBtn = document.getElementById('delete-students-btn');
    if (deleteBtn) {
        deleteBtn.classList.toggle('active', deleteMode);
        deleteBtn.textContent = deleteMode ? '✕ Exit Delete Mode' : '🗑️ Delete Students';
    }

    if (deleteMode && bulkAssignMode) toggleBulkAssignMode();

    renderClassManagementView();
}

function updateDeletePanelUI() {
    const deletePanel = document.getElementById('delete-confirm-panel');

    if (selectedStudentsForDelete.size > 0) {
        if (!deletePanel) createDeletePanel();
        const panel = document.getElementById('delete-confirm-panel');
        const countSpan = document.getElementById('delete-student-count');
        if (countSpan) countSpan.innerText = selectedStudentsForDelete.size;
        panel.style.display = 'block';
    } else {
        if (deletePanel) deletePanel.style.display = 'none';
    }
}

function createDeletePanel() {
    if (document.getElementById('delete-confirm-panel')) return;

    const dropZones = document.getElementById('class-drop-zones');
    const panel = document.createElement('div');
    panel.id = 'delete-confirm-panel';
    panel.className = 'delete-confirm-panel';
    panel.innerHTML = `
        <p>⚠️ You are about to delete <span id="delete-student-count">0</span> student(s). This action cannot be undone.</p>
        <p>All quest data, grades, and artwork will be permanently deleted.</p>
        <div class="delete-confirm-buttons">
            <button id="confirm-delete-btn" class="confirm-delete-btn">Yes, Delete Permanently</button>
            <button id="cancel-delete-btn" class="cancel-delete-btn">Cancel</button>
        </div>
    `;

    dropZones.insertAdjacentElement('afterend', panel);

    document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteStudents);
    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        selectedStudentsForDelete.clear();
        updateDeletePanelUI();
        renderClassManagementView();
    });
}

async function confirmDeleteStudents() {
    if (selectedStudentsForDelete.size === 0) return;

    const isValid = await verifyTeacherPassword();
    if (!isValid) { alert("Password verification failed. Deletion cancelled."); return; }

    const confirmMessage = confirm(`⚠️ WARNING: You are about to delete ${selectedStudentsForDelete.size} student(s). This action CANNOT be undone.\n\nAll quest data, grades, and artwork will be permanently deleted.\n\nClick OK to confirm.`);
    if (!confirmMessage) return;

    let deletedCount = 0;
    let errorCount = 0;
    const SUPABASE_URL = 'https://qzxvwoyigrrpdywvhckk.supabase.co';

    for (const studentId of selectedStudentsForDelete) {
        let authDeleted = false;

        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ studentUserId: studentId })
            });

            if (!response.ok) {
                errorCount++;
            } else {
                authDeleted = true;
            }
        } catch (err) {
            errorCount++;
        }

        if (authDeleted) {
            const { error: profileError } = await window.supabase
                .from('profiles')
                .delete()
                .eq('id', studentId);

            if (profileError) errorCount++;
            else deletedCount++;
        }
    }

    alert(`Deleted ${deletedCount} student(s). ${errorCount} error(s).`);
    await updateStudentLimitDisplay();
    deleteMode = false;
    selectedStudentsForDelete.clear();

    const deleteBtn = document.getElementById('delete-students-btn');
    if (deleteBtn) {
        deleteBtn.classList.remove('active');
        deleteBtn.textContent = '🗑️ Delete Students';
    }

    invalidateStudentsCache();
    invalidateTabCache('students');
    invalidateTabCache('classes');
    invalidateTabCache('analytics');
    await loadClasses();
    await renderClassManagementView();
    await renderClassAccordion();
    await loadAllStudents();

    const panel = document.getElementById('delete-confirm-panel');
    if (panel) panel.style.display = 'none';
}

// --- Teacher class code ---
async function loadTeacherClassCode() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    actualClassCode = auth.teacher.class_code;
    const classCodeSpan = document.getElementById('teacher-class-code');
    if (classCodeSpan) {
        classCodeSpan.textContent = '••••••';
        classCodeSpan.classList.add('class-code-hidden');
        classCodeSpan.classList.remove('class-code-visible');
    }
}

function toggleClassCodeVisibility() {
    const classCodeSpan = document.getElementById('teacher-class-code');
    const toggleBtn = document.getElementById('toggle-code-visibility');

    if (!classCodeSpan || !actualClassCode) return;

    classCodeVisible = !classCodeVisible;

    if (classCodeVisible) {
        classCodeSpan.textContent = actualClassCode;
        classCodeSpan.classList.remove('class-code-hidden');
        classCodeSpan.classList.add('class-code-visible');
        toggleBtn.textContent = '🙈';
        toggleBtn.title = 'Hide code';
    } else {
        classCodeSpan.textContent = '••••••';
        classCodeSpan.classList.add('class-code-hidden');
        classCodeSpan.classList.remove('class-code-visible');
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Show code';
    }
}


// ==========================================================
// 13. CLASS SETTINGS
// ==========================================================

async function loadClassSettings() {
    const settings = {};
    for (const cls of teacherClasses) {
        const { data } = await window.supabase
            .from('class_settings')
            .select('target_formative, target_summative, class_duration_minutes')
            .eq('class_id', cls.id)
            .maybeSingle();

        settings[cls.id] = {
            target_formative: data?.target_formative || 15,
            target_summative: data?.target_summative || 5,
            class_duration_minutes: data?.class_duration_minutes || 75
        };
    }
    return settings;
}

async function renderClassSettingsTable() {
    const tbody = document.getElementById('class-settings-tbody');
    if (!tbody) return;

    const settings = await loadClassSettings();
    tbody.innerHTML = '';

    for (const cls of teacherClasses) {
        const clsSettings = settings[cls.id] || { target_formative: 15, target_summative: 5, class_duration_minutes: 75 };

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(cls.name)}</strong></td>
            <td><input type="number" class="target-formative-input" data-class-id="${cls.id}" value="${clsSettings.target_formative}" min="0" max="81" step="1" style="width: 80px;"></td>
            <td><input type="number" class="target-summative-input" data-class-id="${cls.id}" value="${clsSettings.target_summative}" min="0" max="81" step="1" style="width: 80px;"></td>
            <td>
                <input type="number" class="class-duration-input" data-class-id="${cls.id}" value="${clsSettings.class_duration_minutes}" min="30" max="120" step="5" style="width: 80px;">
                <span style="font-size: 11px;">minutes</span>
            </td>
            <td><button class="reset-class-defaults-btn" data-class-id="${cls.id}" style="background: none; border: none; color: #ff8888; cursor: pointer;">↺ Reset</button></td>
        `;
        tbody.appendChild(row);
    }

    document.querySelectorAll('.reset-class-defaults-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const classId = btn.dataset.classId;
            const formativeInput = document.querySelector(`.target-formative-input[data-class-id="${classId}"]`);
            const summativeInput = document.querySelector(`.target-summative-input[data-class-id="${classId}"]`);
            const durationInput = document.querySelector(`.class-duration-input[data-class-id="${classId}"]`);
            if (formativeInput) formativeInput.value = 15;
            if (summativeInput) summativeInput.value = 5;
            if (durationInput) durationInput.value = 75;
        });
    });
}

async function saveAllClassSettings() {
    const auth = await checkTeacherAuth();
    if (!auth) return false;

    const formativeInputs = document.querySelectorAll('.target-formative-input');
    const summativeInputs = document.querySelectorAll('.target-summative-input');
    const durationInputs = document.querySelectorAll('.class-duration-input');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < formativeInputs.length; i++) {
        const classId = formativeInputs[i].dataset.classId;
        const target_formative = parseInt(formativeInputs[i].value) || 0;
        const target_summative = parseInt(summativeInputs[i].value) || 0;
        const class_duration_minutes = parseInt(durationInputs[i]?.value) || 75;

        const { error } = await window.supabase
            .from('class_settings')
            .upsert({
                class_id: classId,
                target_formative,
                target_summative,
                class_duration_minutes,
                updated_at: new Date().toISOString()
            }, { onConflict: 'class_id' });

        if (error) errorCount++;
        else successCount++;
    }

    showSettingsMessage(`Saved ${successCount} class setting(s). ${errorCount} error(s).`, errorCount === 0 ? 'success' : 'error');

    invalidateTabCache('analytics');

    const analyticsEl = document.getElementById('analytics-main-content');
    if (analyticsEl && analyticsEl.style.display === 'block') {
        await loadAnalyticsData();
    }
}

function showSettingsMessage(message, type) {
    const messageDiv = document.getElementById('settings-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `settings-message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
    } else {
        alert(message);
    }
}

async function getClassTargets(classId) {
    if (!classId) {
        return { formative: 15, summative: 5, total: 20 };
    }
    const { data } = await window.supabase
        .from('class_settings')
        .select('target_formative, target_summative')
        .eq('class_id', classId)
        .maybeSingle();

    return {
        formative: data?.target_formative || 15,
        summative: data?.target_summative || 5,
        total: (data?.target_formative || 15) + (data?.target_summative || 5)
    };
}


// ==========================================================
// 14. STUDENT INVITATIONS
// ==========================================================

async function openInviteModal() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const classSelect = document.getElementById('invite-class');
    classSelect.innerHTML = '<option value="">Select Class (optional)</option>';

    for (const cls of teacherClasses) {
        classSelect.innerHTML += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
    }

    document.getElementById('invite-email').value = '';
    document.getElementById('invite-message').innerHTML = '';
    document.getElementById('invite-modal').style.display = 'flex';
}

async function sendInvitation() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const email = document.getElementById('invite-email').value.trim();
    const classId = document.getElementById('invite-class').value;

    if (!email) { showInviteMessage("Please enter a student email address.", "error"); return; }

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { showInviteMessage("Password verification failed.", "error"); return; }

    const sendBtn = document.getElementById('send-invite-btn');
    const originalText = sendBtn.textContent;
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    try {
        const inviteToken = generateInviteToken();

        const { error: inviteError } = await window.supabase
            .from('student_invitations')
            .insert({
                email,
                teacher_code: auth.teacher.class_code,
                class_id: classId || null,
                token: inviteToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

        if (inviteError) {
            showInviteMessage("Failed to create invitation. Please try again.", "error");
            return;
        }

        const inviteLink = `${window.location.origin}/signup.html?invite=${inviteToken}`;
        showInviteMessage(`✅ Invitation created! Share this link with the student:\n\n${inviteLink}\n\nThe link expires in 7 days.`, "success");

        setTimeout(() => {
            document.getElementById('invite-modal').style.display = 'none';
        }, 5000);

    } catch (error) {
        showInviteMessage("An error occurred. Please try again.", "error");
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
    }
}

function generateInviteToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

function showInviteMessage(message, type) {
    const messageDiv = document.getElementById('invite-message');
    messageDiv.textContent = message;
    messageDiv.className = `settings-message ${type}`;
    messageDiv.style.whiteSpace = 'pre-wrap';
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'settings-message';
    }, 8000);
}


// ==========================================================
// 15. SCHEDULE TAB
// ==========================================================

async function loadScheduleData() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const classSelect = document.getElementById('schedule-class-select');
    if (classSelect) {
        classSelect.innerHTML = '<option value="">-- Select a class --</option>';
        for (const cls of teacherClasses) {
            classSelect.innerHTML += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
        }
    }

    if (classSelect && currentScheduleClassId) classSelect.value = currentScheduleClassId;
    if (!currentScheduleClassId) return;

    const { data: noClassDays } = await window.supabase
        .from('class_schedule_overrides')
        .select('*')
        .eq('class_id', currentScheduleClassId);

    if (noClassDays) scheduleData.noClassDays = noClassDays;

    const { data: weekendSettings } = await window.supabase
        .from('class_weekend_settings')
        .select('*')
        .eq('class_id', currentScheduleClassId)
        .maybeSingle();

    if (weekendSettings) {
        scheduleData.weekendSettings = weekendSettings;
        document.getElementById('weekend-saturday-class').checked = weekendSettings.saturday_is_class || false;
        document.getElementById('weekend-sunday-class').checked = weekendSettings.sunday_is_class || false;
    } else {
        scheduleData.weekendSettings = { saturday_is_class: false, sunday_is_class: false };
        document.getElementById('weekend-saturday-class').checked = false;
        document.getElementById('weekend-sunday-class').checked = false;
    }

    const { data: frequencySettings } = await window.supabase
        .from('class_schedule_rules')
        .select('type, days')
        .eq('class_id', currentScheduleClassId)
        .maybeSingle();

    if (frequencySettings) {
        scheduleData.frequencySettings = frequencySettings;
        updateFrequencyUI(frequencySettings);
    } else {
        resetFrequencyUI();
    }

    renderCalendar();
}

function resetFrequencyUI() {
    document.querySelectorAll('.day-checkboxes input').forEach(cb => { cb.checked = false; });
}

function updateFrequencyUI(settings) {
    if (!settings || settings.type !== 'custom') {
        resetFrequencyUI();
        return;
    }
    document.querySelectorAll('.day-checkboxes input').forEach(cb => {
        cb.checked = settings.days && settings.days.includes(parseInt(cb.value));
    });
}

function renderCalendar() {
    const year = currentScheduleDate.getFullYear();
    const month = currentScheduleDate.getMonth();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) monthYearEl.textContent = `${monthNames[month]} ${year}`;

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const scheduleMap = new Map();
    if (scheduleData.noClassDays) {
        scheduleData.noClassDays.forEach(day => scheduleMap.set(day.date, day));
    }

    const satIsClass = scheduleData.weekendSettings?.saturday_is_class || false;
    const sunIsClass = scheduleData.weekendSettings?.sunday_is_class || false;

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
            const dayOfWeek = currentDate.getDay();
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;

            const dayNumberSpan = document.createElement('div');
            dayNumberSpan.className = 'calendar-day-number';
            dayNumberSpan.textContent = dayNumber;
            cell.appendChild(dayNumberSpan);

            if (isWeekend) {
                cell.classList.add('weekend');
                if ((dayOfWeek === 6 && !satIsClass) || (dayOfWeek === 0 && !sunIsClass)) {
                    cell.style.opacity = '0.6';
                    const noteSpan = document.createElement('div');
                    noteSpan.className = 'calendar-day-reason';
                    noteSpan.textContent = 'Weekend (no class)';
                    cell.appendChild(noteSpan);
                }
            }

            const scheduleEntry = scheduleMap.get(dateStr);

            if (scheduleEntry) {
                if (!scheduleEntry.is_class_day) {
                    cell.classList.add('no-class');
                    const reasonSpan = document.createElement('div');
                    reasonSpan.className = 'calendar-day-reason';
                    reasonSpan.textContent = scheduleEntry.reason || 'No Class';
                    cell.appendChild(reasonSpan);
                }
                if (scheduleEntry.notes) {
                    cell.classList.add('has-notes');
                    const noteSpan = document.createElement('div');
                    noteSpan.className = 'calendar-day-notes';
                    noteSpan.textContent = scheduleEntry.notes;
                    cell.appendChild(noteSpan);
                }
            }

            cell.addEventListener('click', () => openDateModal(currentDate, scheduleEntry));
        } else {
            cell.style.visibility = 'hidden';
            cell.style.pointerEvents = 'none';
            cell.style.backgroundColor = 'transparent';
            cell.style.border = 'none';
        }

        grid.appendChild(cell);
    }
}

function openDateModal(date, existingEntry) {
    const modal = document.getElementById('date-modal');
    const titleEl = document.getElementById('date-modal-title');
    const dateTextEl = document.getElementById('modal-date-text');
    const dateValueEl = document.getElementById('modal-date-value');
    const statusSelect = document.getElementById('modal-status');
    const reasonInput = document.getElementById('modal-reason');
    const notesInput = document.getElementById('modal-notes');
    const reasonGroup = document.getElementById('reason-group');
    const applyAllCheckbox = document.getElementById('modal-apply-all');
    const deleteBtn = document.getElementById('modal-delete-btn');

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    dateTextEl.textContent = `${dayNames[date.getDay()]}, ${month}/${day}/${year}`;
    dateValueEl.value = dateStr;

    if (existingEntry) {
        titleEl.textContent = 'Edit Day';
        statusSelect.value = existingEntry.is_class_day ? 'class' : 'no-class';
        reasonInput.value = existingEntry.reason || '';
        notesInput.value = existingEntry.notes || '';
        applyAllCheckbox.checked = existingEntry.apply_to_all_classes || false;
        deleteBtn.style.display = 'inline-block';
        modal.dataset.existingId = existingEntry.id;
    } else {
        titleEl.textContent = 'Mark Day';
        statusSelect.value = 'class';
        reasonInput.value = '';
        notesInput.value = '';
        applyAllCheckbox.checked = false;
        deleteBtn.style.display = 'none';
        delete modal.dataset.existingId;
    }

    reasonGroup.style.display = statusSelect.value === 'no-class' ? 'block' : 'none';
    modal.style.display = 'flex';
}

async function handleScheduleClassChange() {
    const classSelect = document.getElementById('schedule-class-select');
    if (!classSelect) return;

    currentScheduleClassId = classSelect.value;
    if (currentScheduleClassId) {
        const selectedOption = classSelect.options[classSelect.selectedIndex];
        updateClassIndicator(selectedOption ? selectedOption.text : '');
        await loadScheduleData();
    } else {
        const grid = document.getElementById('calendar-grid');
        if (grid) grid.innerHTML = '<div style="grid-column: span 7; text-align: center; padding: 40px;">Select a class to view schedule</div>';
        scheduleData = { noClassDays: [], weekendSettings: {}, frequencySettings: {} };
        updateClassIndicator('');
    }
}

function updateClassIndicator(className) {
    let indicator = document.getElementById('selected-class-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'selected-class-indicator';
        indicator.className = 'selected-class-indicator';
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) calendarContainer.parentNode.insertBefore(indicator, calendarContainer);
    }

    if (className) {
        indicator.innerHTML = `<strong>📋 Currently viewing schedule for: ${escapeHtml(className)}</strong>`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function previousMonth() {
    currentScheduleDate.setMonth(currentScheduleDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentScheduleDate.setMonth(currentScheduleDate.getMonth() + 1);
    renderCalendar();
}

function closeDateModal() {
    document.getElementById('date-modal').style.display = 'none';
}

async function saveDateModal() {
    const dateValue = document.getElementById('modal-date-value').value;
    const status = document.getElementById('modal-status').value;
    const reason = document.getElementById('modal-reason').value;
    const notes = document.getElementById('modal-notes').value;
    const applyToAll = document.getElementById('modal-apply-all').checked;
    const existingId = document.getElementById('date-modal').dataset.existingId;

    if (status === 'no-class' && !reason) {
        alert('Please enter a reason for no-class day.');
        return;
    }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    let classesToUpdate = [];

    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    if (existingId) {
        const { error } = await window.supabase
            .from('class_schedule_overrides')
            .update({
                is_class_day: status === 'class',
                reason: status === 'no-class' ? reason : null,
                notes: notes || null,
                apply_to_all_classes: applyToAll
            })
            .eq('id', existingId);

        if (error) { alert("Error saving changes."); return; }
    } else {
        const { data: existing } = await window.supabase
            .from('class_schedule_overrides')
            .select('id')
            .eq('class_id', currentScheduleClassId)
            .eq('date', dateValue)
            .maybeSingle();

        if (existing) {
            alert('This date already has a setting. Please edit the existing entry.');
            closeDateModal();
            await loadScheduleData();
            return;
        }

        const { error } = await window.supabase
            .from('class_schedule_overrides')
            .insert({
                class_id: currentScheduleClassId,
                date: dateValue,
                is_class_day: status === 'class',
                reason: status === 'no-class' ? reason : null,
                notes: notes || null,
                apply_to_all_classes: applyToAll
            });

        if (error) { alert("Error saving changes."); return; }
    }

    if (applyToAll) {
        for (const classId of classesToUpdate) {
            if (classId === currentScheduleClassId) continue;

            const { data: existingOther } = await window.supabase
                .from('class_schedule_overrides')
                .select('id')
                .eq('class_id', classId)
                .eq('date', dateValue)
                .maybeSingle();

            if (existingOther) {
                await window.supabase
                    .from('class_schedule_overrides')
                    .update({
                        is_class_day: status === 'class',
                        reason: status === 'no-class' ? reason : null,
                        notes: notes || null,
                        apply_to_all_classes: applyToAll
                    })
                    .eq('id', existingOther.id);
            } else {
                await window.supabase
                    .from('class_schedule_overrides')
                    .insert({
                        class_id: classId,
                        date: dateValue,
                        is_class_day: status === 'class',
                        reason: status === 'no-class' ? reason : null,
                        notes: notes || null,
                        apply_to_all_classes: applyToAll
                    });
            }
        }
    }

    closeDateModal();
    invalidateTabCache('schedule');
    await loadScheduleData();
}

async function deleteDateModal() {
    const dateValue = document.getElementById('modal-date-value').value;
    const applyToAll = document.getElementById('modal-apply-all').checked;

    if (!dateValue) return;
    if (!confirm('Remove this no-class setting?')) return;

    const auth = await checkTeacherAuth();
    if (!auth) return;

    let classesToUpdate = [];

    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    let successCount = 0;
    let errorCount = 0;

    for (const classId of classesToUpdate) {
        const { data: entry } = await window.supabase
            .from('class_schedule_overrides')
            .select('id')
            .eq('class_id', classId)
            .eq('date', dateValue)
            .maybeSingle();

        if (entry) {
            const { error } = await window.supabase
                .from('class_schedule_overrides')
                .delete()
                .eq('id', entry.id);

            if (error) errorCount++;
            else successCount++;
        }
    }

    closeDateModal();
    invalidateTabCache('schedule');
    await loadScheduleData();

    if (errorCount > 0) alert(`Removed from ${successCount} class(es). ${errorCount} error(s).`);
    else if (successCount > 0) alert(`No-class setting removed from ${successCount} class(es)!`);
}

async function saveWeekendSettings() {
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }

    const saturdayIsClass = document.getElementById('weekend-saturday-class').checked;
    const sundayIsClass = document.getElementById('weekend-sunday-class').checked;
    const applyToAll = document.getElementById('weekend-apply-all').checked;

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed. Settings not saved."); return; }

    const { error } = await window.supabase
        .from('class_weekend_settings')
        .upsert({
            class_id: currentScheduleClassId,
            saturday_is_class: saturdayIsClass,
            sunday_is_class: sundayIsClass,
            apply_to_all_classes: applyToAll,
            updated_at: new Date().toISOString()
        }, { onConflict: 'class_id' });

    if (error) alert("Error saving settings: " + error.message);
    else { alert("Weekend settings saved successfully!"); invalidateTabCache('schedule'); await loadScheduleData(); }
}

async function saveFrequencySettings() {
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }

    const checkboxes = document.querySelectorAll('.day-checkboxes input:checked');
    const days = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (days.length === 0) { alert('Please select at least one class day.'); return; }

    const applyToAll = document.getElementById('frequency-apply-all').checked;

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed. Settings not saved."); return; }

    const { error } = await window.supabase
        .from('class_schedule_rules')
        .upsert({
            class_id: currentScheduleClassId,
            type: 'custom',
            days: days,
            apply_to_all_classes: applyToAll,
            updated_at: new Date().toISOString()
        }, { onConflict: 'class_id' });

    if (error) alert("Error saving settings: " + error.message);
    else { alert("Frequency settings saved successfully!"); invalidateTabCache('schedule'); await loadScheduleData(); }
}

async function resetScheduleSettings() {
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }
    if (!confirm('Reset all schedule settings for this class?')) return;

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed. Settings not reset."); return; }

    await window.supabase.from('class_schedule_overrides').delete().eq('class_id', currentScheduleClassId);
    await window.supabase.from('class_weekend_settings').delete().eq('class_id', currentScheduleClassId);
    await window.supabase.from('class_schedule_rules').delete().eq('class_id', currentScheduleClassId);

    alert('Schedule settings reset to default.');
    invalidateTabCache('schedule');
    await loadScheduleData();
}


// ==========================================================
// 16. ANALYTICS TAB
// ==========================================================

async function loadAnalyticsData() {
    analyticsData.framework = await loadTeacherFramework();
    await populateClassFilter();
    await loadStudentAnalytics();
    await loadQuestAnalytics();
    await updateAnalyticsUI();
}

async function populateClassFilter() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const filterSelect = document.getElementById('analytics-class-filter');
    if (!filterSelect) return;

    const currentValue = filterSelect.value;

    filterSelect.innerHTML = '<option value="all">All Classes</option>';
    for (const cls of teacherClasses) {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        filterSelect.appendChild(option);
    }

    if (currentValue !== 'all' && teacherClasses.some(c => c.id === currentValue)) {
        filterSelect.value = currentValue;
    } else {
        filterSelect.value = 'all';
    }
    analyticsData.classFilter = filterSelect.value;

    filterSelect.removeEventListener('change', handleClassFilterChange);
    filterSelect.addEventListener('change', handleClassFilterChange);
}

async function handleClassFilterChange(e) {
    analyticsData.classFilter = e.target.value;
    await loadStudentAnalytics();
    await updateAnalyticsUI();
}

async function loadStudentAnalytics() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    let query = window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', auth.teacher.class_code);

    if (analyticsData.classFilter !== 'all') {
        query = query.eq('class_id', analyticsData.classFilter);
    }

    const { data: students, error } = await query;
    if (error || !students) {
        console.error("Error loading students:", error);
        return;
    }

    const studentIds = students.map(s => s.id);
    const classIds = teacherClasses.map(c => c.id);

    // Fire all 3 queries in parallel
    const [progressRes, worksRes, settingsRes] = await Promise.all([
        studentIds.length > 0
            ? window.supabase.from('student_progress').select('*').in('user_id', studentIds)
            : Promise.resolve({ data: [] }),
        studentIds.length > 0
            ? window.supabase
                .from('student_works')
                .select('user_id, uploaded_at')
                .in('user_id', studentIds)
                .order('uploaded_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        classIds.length > 0
            ? window.supabase
                .from('class_settings')
                .select('class_id, target_formative, target_summative')
                .in('class_id', classIds)
            : Promise.resolve({ data: [] })
    ]);

    const progressMap = new Map((progressRes.data || []).map(p => [p.user_id, p]));
    const lastUploadMap = new Map();
    (worksRes.data || []).forEach(w => {
        if (!lastUploadMap.has(w.user_id)) lastUploadMap.set(w.user_id, w.uploaded_at);
    });
    const settingsMap = new Map((settingsRes.data || []).map(s => [s.class_id, s]));

    const classMap = new Map(teacherClasses.map(c => [c.id, c.name]));
    const allQuests = await getQuests();

    analyticsData.students = [];
    let totalCompletedQuests = 0;
    let totalActiveStudents = 0;

    for (const student of students) {
        const progress = progressMap.get(student.id);
        const completedQuests = progress?.completed_quests || {};
        const questAccepted = progress?.quest_accepted || {};
        const questGrades = progress?.quest_grades || {};

        let completedCount = 0;
        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (isCompleted === true) completedCount++;
        }
        totalCompletedQuests += completedCount;

        let activeQuest = null;
        for (const [questId, isAccepted] of Object.entries(questAccepted)) {
            if (isAccepted === true && !completedQuests[questId]) {
                const quest = allQuests[questId];
                activeQuest = quest?.title || questId;
                break;
            }
        }
        if (activeQuest) totalActiveStudents++;

        const clsSettings = settingsMap.get(student.class_id);
        const targetTotal = (clsSettings?.target_formative || 15) + (clsSettings?.target_summative || 5);

        const studentGradeLevel = student.grade_level || 'hs';
        const domainGrades = calculateStudentDomainGrades(questGrades, completedQuests, allQuests, studentGradeLevel);
        const lastUpload = lastUploadMap.get(student.id);

        analyticsData.students.push({
            id: student.id,
            name: student.name,
            classId: student.class_id,
            className: classMap.get(student.class_id) || 'No Class',
            completedCount,
            targetTotal,
            activeQuest,
            domainGrades,
            lastUpload,
            gradeLevel: studentGradeLevel
        });
    }

    const studentCount = analyticsData.students.length;
    analyticsData.classAverages = {
        completionRate: studentCount > 0 ? (totalCompletedQuests / studentCount).toFixed(1) : 0,
        activeStudents: totalActiveStudents,
        domainAverages: calculateClassDomainAverages(analyticsData.students)
    };
}

function calculateStudentDomainGrades(questGrades, completedQuests, allQuests, studentGradeLevel) {
    const framework = analyticsData.framework;
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isMS = studentGradeLevel === 'ms';

    let scores = {}, counts = {};

    if (isIB) {
        scores = { A: 0, B: 0, C: 0, D: 0 };
        counts = { A: 0, B: 0, C: 0, D: 0 };
    } else if (isIGCSE) {
        scores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        counts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    } else if (isMS) {
        scores = { creating: 0, reflecting: 0, responding: 0, connecting: 0 };
        counts = { creating: 0, reflecting: 0, responding: 0, connecting: 0 };
    } else {
        scores = { creating: 0, presenting: 0, responding: 0, connecting: 0 };
        counts = { creating: 0, presenting: 0, responding: 0, connecting: 0 };
    }

    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
        if (!quest) continue;

        const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';
        const grades = questGrades[questId]?.[column] || {};

        if (isIB && quest.rubric?.criteria) {
            quest.rubric.criteria.forEach(criterion => {
                const grade = grades[criterion.code];
                if (grade && typeof grade === 'number') {
                    scores[criterion.code] += grade;
                    counts[criterion.code]++;
                }
            });
        } else if (isIGCSE && quest.rubric?.assessment_objectives) {
            quest.rubric.assessment_objectives.forEach(ao => {
                const grade = grades[ao.code];
                if (grade && typeof grade === 'number') {
                    scores[ao.code] += grade;
                    counts[ao.code]++;
                }
            });
        } else if (quest.rubric?.standards) {
            quest.rubric.standards.forEach(standard => {
                const grade = grades[standard.code];
                if (grade && typeof grade === 'number') {
                    let domain;
                    if (isMS) domain = mapMSStandardToDomain(standard.code);
                    else domain = mapStandardToDomain(standard.code);
                    if (domain) {
                        scores[domain] = (scores[domain] || 0) + grade;
                        counts[domain] = (counts[domain] || 0) + 1;
                    }
                }
            });
        }
    }

    const result = {};
    for (const key of Object.keys(scores)) {
        if (counts[key] > 0) {
            let avg = scores[key] / counts[key];
            if (isIGCSE) avg = convertNumberToLetterGrade(Math.round(avg));
            else avg = avg.toFixed(1);
            result[key] = avg;
        } else {
            result[key] = '—';
        }
    }
    return result;
}

function calculateClassDomainAverages(students) {
    const framework = analyticsData.framework;
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isMS = currentGradeLevel === 'ms';

    let keys = [];
    if (isIB) keys = ['A', 'B', 'C', 'D'];
    else if (isIGCSE) keys = ['AO1', 'AO2', 'AO3', 'AO4'];
    else if (isMS) keys = ['creating', 'reflecting', 'responding', 'connecting'];
    else keys = ['creating', 'presenting', 'responding', 'connecting'];

    const totals = {}, counts = {};
    keys.forEach(key => { totals[key] = 0; counts[key] = 0; });

    for (const student of students) {
        for (const key of keys) {
            const val = student.domainGrades[key];
            if (val !== '—' && val !== null && val !== undefined) {
                const numVal = parseFloat(val);
                if (!isNaN(numVal)) { totals[key] += numVal; counts[key]++; }
            }
        }
    }

    const averages = {};
    for (const key of keys) {
        if (counts[key] > 0) {
            let avg = totals[key] / counts[key];
            if (isIGCSE) avg = convertNumberToLetterGrade(Math.round(avg));
            else avg = avg.toFixed(1);
            averages[key] = avg;
        } else {
            averages[key] = '—';
        }
    }
    return averages;
}

async function loadQuestAnalytics() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    let query = window.supabase
        .from('profiles')
        .select('id')
        .eq('teacher_code', auth.teacher.class_code);

    if (analyticsData.classFilter !== 'all') {
        query = query.eq('class_id', analyticsData.classFilter);
    }

    const { data: students } = await query;
    if (!students || students.length === 0) return;

    const studentIds = students.map(s => s.id);

    const { data: progressData } = await window.supabase
        .from('student_progress')
        .select('user_id, completed_quests, quest_grades, quest_accepted')
        .in('user_id', studentIds);

    const allQuests = await getQuests();
    analyticsData.questStats = {};

    for (const [questId, quest] of Object.entries(allQuests)) {
        if (!questId.startsWith('quest')) continue;
        analyticsData.questStats[questId] = {
            id: questId,
            title: quest.title,
            path: quest.path?.[0] || 'Unknown',
            type: quest.style === 'mvp' ? 'MVP' : 'Formative',
            completedCount: 0,
            totalStudents: students.length,
            totalTime: 0,
            timesCompleted: 0,
            activeCount: 0,
            domainScores: {},
            domainCounts: {}
        };
    }

    for (const progress of (progressData || [])) {
        const completedQuests = progress.completed_quests || {};
        const questGrades = progress.quest_grades || {};
        const questAccepted = progress.quest_accepted || {};

        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (isCompleted === true && analyticsData.questStats[questId]) {
                analyticsData.questStats[questId].completedCount++;
                analyticsData.questStats[questId].timesCompleted++;

                const quest = allQuests[questId];
                if (quest) {
                    const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';
                    const grades = questGrades[questId]?.[column] || {};
                    collectQuestDomainGrades(questId, quest, grades, analyticsData.questStats[questId]);
                }
            }
        }

        for (const [questId, isAccepted] of Object.entries(questAccepted)) {
            if (isAccepted === true && !completedQuests[questId] && analyticsData.questStats[questId]) {
                analyticsData.questStats[questId].activeCount++;
            }
        }
    }

    for (const questId in analyticsData.questStats) {
        const stat = analyticsData.questStats[questId];
        stat.completionPercentage = stat.totalStudents > 0 ? ((stat.completedCount / stat.totalStudents) * 100).toFixed(1) : 0;
        stat.popularity = stat.completedCount + stat.activeCount;

        for (const domain in stat.domainScores) {
            if (stat.domainCounts[domain] > 0) {
                let avg = stat.domainScores[domain] / stat.domainCounts[domain];
                if (analyticsData.framework === 'igcse') avg = convertNumberToLetterGrade(Math.round(avg));
                else avg = avg.toFixed(1);
                stat.domainAverages = stat.domainAverages || {};
                stat.domainAverages[domain] = avg;
            }
        }
    }

    const questArray = Object.values(analyticsData.questStats);
    questArray.sort((a, b) => b.popularity - a.popularity);
    analyticsData.sortedQuests = questArray;
}

function collectQuestDomainGrades(questId, quest, grades, stat) {
    const framework = analyticsData.framework;
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isMS = currentGradeLevel === 'ms';

    if (isIB && quest.rubric?.criteria) {
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            if (grade && typeof grade === 'number') {
                stat.domainScores[criterion.code] = (stat.domainScores[criterion.code] || 0) + grade;
                stat.domainCounts[criterion.code] = (stat.domainCounts[criterion.code] || 0) + 1;
            }
        });
    } else if (isIGCSE && quest.rubric?.assessment_objectives) {
        quest.rubric.assessment_objectives.forEach(ao => {
            const grade = grades[ao.code];
            if (grade && typeof grade === 'number') {
                stat.domainScores[ao.code] = (stat.domainScores[ao.code] || 0) + grade;
                stat.domainCounts[ao.code] = (stat.domainCounts[ao.code] || 0) + 1;
            }
        });
    } else if (quest.rubric?.standards) {
        quest.rubric.standards.forEach(standard => {
            const grade = grades[standard.code];
            if (grade && typeof grade === 'number') {
                let domain;
                if (isMS) domain = mapMSStandardToDomain(standard.code);
                else domain = mapStandardToDomain(standard.code);
                if (domain) {
                    stat.domainScores[domain] = (stat.domainScores[domain] || 0) + grade;
                    stat.domainCounts[domain] = (stat.domainCounts[domain] || 0) + 1;
                }
            }
        });
    }
}

async function updateAnalyticsUI() {
    await updateTopCards();
    await updateAverageGradeGrid();
    await updateStudentsTable();
    await updateQuestsTable();
}

async function updateTopCards() {
    const students = analyticsData.students;
    const classAverages = analyticsData.classAverages;

    let totalCompleted = 0;
    let totalTarget = 0;
    for (const student of students) {
        totalCompleted += student.completedCount;
        totalTarget += student.targetTotal;
    }
    const completionRate = students.length > 0 && totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

    const completionEl = document.getElementById('analytics-completion');
    const completionDetailEl = document.getElementById('analytics-completion-detail');
    if (completionEl) completionEl.textContent = `${completionRate}%`;
    if (completionDetailEl) completionDetailEl.textContent = `(${totalCompleted}/${totalTarget})`;

    const activeStudentsEl = document.getElementById('analytics-active-students');
    if (activeStudentsEl) activeStudentsEl.textContent = classAverages?.activeStudents || 0;
}

async function updateAverageGradeGrid() {
    const framework = analyticsData.framework;
    const classAverages = analyticsData.classAverages;
    const gridContainer = document.getElementById('analytics-avg-grade-grid');
    const isMS = currentGradeLevel === 'ms';

    if (!gridContainer) return;

    let domains = [], labels = [], cellClasses = [];

    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        labels = ['Knowing & Understanding', 'Developing Skills', 'Thinking Creatively', 'Responding'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        labels = ['Record', 'Explore & Select', 'Develop', 'Present'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        labels = ['Creating', 'Reflecting', 'Responding', 'Connecting'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        labels = ['Creating', 'Presenting', 'Responding', 'Connecting'];
    }
    cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];

    const domainAverages = classAverages?.domainAverages || {};
    const getDisplayName = (domain, framework, isMS) => {
        if (framework === 'ib-myp' || framework === 'igcse') return domain;
        if (isMS) {
            const mapping = { creating: 'Cr', reflecting: 'Re', responding: 'Rs', connecting: 'Cn' };
            return mapping[domain] || domain;
        }
        const mapping = { creating: 'Cr', presenting: 'Pr', responding: 'Re', connecting: 'Cn' };
        return mapping[domain] || domain;
    };

    let html = '';
    for (let i = 0; i < domains.length; i++) {
        html += `
            <div class="${cellClasses[i]}">
                <div class="grade-cell-label">${getDisplayName(domains[i], framework, isMS)}: ${labels[i]}</div>
                <div class="grade-cell-value">${domainAverages[domains[i]] || '—'}</div>
            </div>
        `;
    }
    gridContainer.innerHTML = html;
}

async function updateStudentsTable() {
    const tbody = document.getElementById('analytics-students-tbody');
    const tfoot = document.getElementById('analytics-students-tfoot');
    const framework = analyticsData.framework;
    const isMS = currentGradeLevel === 'ms';

    if (!tbody) return;

    if (analyticsData.students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No students found...</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    let domains = [], shortLabels = [], cellClasses = [];

    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        shortLabels = ['A', 'B', 'C', 'D'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        shortLabels = ['AO1', 'AO2', 'AO3', 'AO4'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Re', 'Rs', 'Cn'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Pr', 'Re', 'Cn'];
    }
    cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];

    for (const student of analyticsData.students) {
        const row = document.createElement('tr');

        let lastUploadText = 'Never';
        if (student.lastUpload) {
            const date = new Date(student.lastUpload);
            const daysAgo = Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
            if (daysAgo === 0) lastUploadText = 'Today';
            else if (daysAgo === 1) lastUploadText = 'Yesterday';
            else lastUploadText = `${daysAgo} days ago`;
        }

        let domainHtml = '<div class="domain-mini-grid">';
        for (let i = 0; i < domains.length; i++) {
            const grade = student.domainGrades[domains[i]] || '—';
            domainHtml += `
                <div class="domain-mini-cell ${cellClasses[i]}">
                    <div class="domain-mini-label">${shortLabels[i]}</div>
                    <div>${grade}</div>
                </div>
            `;
        }
        domainHtml += '</div>';

        const gradeBadge = student.gradeLevel === 'ms' ? 'MS' : 'HS';

        row.innerHTML = `
            <td class="student-name-link" data-user-id="${student.id}">
                ${escapeHtml(student.name)}
                <span class="grade-level-badge ${student.gradeLevel || 'hs'}">${gradeBadge}</span>
            </td>
            <td>${escapeHtml(student.className)}</td>
            <td>${student.completedCount}/${student.targetTotal} (${Math.round((student.completedCount/student.targetTotal)*100)}%)</td>
            <td>${student.activeQuest ? `<span class="active-quest-badge">${escapeHtml(student.activeQuest)}</span>` : '—'}</td>
            <td>${domainHtml}</td>
            <td>${lastUploadText}</td>
        `;

        tbody.appendChild(row);
    }

    document.querySelectorAll('.student-name-link').forEach(el => {
        el.addEventListener('click', async () => {
            const userId = el.dataset.userId;
            const student = analyticsData.students.find(s => s.id === userId);
            if (student) await loadStudentDetails(userId, student.name);
        });
    });

    if (analyticsData.classAverages && analyticsData.students.length > 0) {
        tfoot.style.display = 'table-footer-group';
        const classAvg = analyticsData.classAverages.domainAverages || {};
        let avgDomainHtml = '<div class="domain-mini-grid">';
        for (let i = 0; i < domains.length; i++) {
            const avg = classAvg[domains[i]] || '—';
            avgDomainHtml += `
                <div class="domain-mini-cell ${cellClasses[i]}">
                    <div class="domain-mini-label">${shortLabels[i]}</div>
                    <div>${avg}</div>
                </div>
            `;
        }
        avgDomainHtml += '</div>';

        const avgCompletion = analyticsData.students.reduce((sum, s) => sum + s.completedCount, 0) / analyticsData.students.length;
        tfoot.innerHTML = `
            <tr style="background: rgba(0, 0, 0, 0.3); font-weight: bold;">
                <td>Class Average</td>
                <td>—</td>
                <td>${avgCompletion.toFixed(1)}/${analyticsData.students[0]?.targetTotal || 22}</td>
                <td>—</td>
                <td>${avgDomainHtml}</td>
                <td>—</td>
            </tr>
        `;
    }
}

async function updateQuestsTable() {
    const tbody = document.getElementById('analytics-quests-tbody');
    const framework = analyticsData.framework;
    const isMS = currentGradeLevel === 'ms';

    if (!tbody) return;

    const sortedQuests = analyticsData.sortedQuests || [];

    if (sortedQuests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No quest data available...</td></tr>';
        return;
    }

    const totalPages = Math.ceil(sortedQuests.length / QUESTS_PER_PAGE);
    const startIndex = (currentQuestPage - 1) * QUESTS_PER_PAGE;
    const pageQuests = sortedQuests.slice(startIndex, startIndex + QUESTS_PER_PAGE);

    updatePaginationControls(totalPages);

    let domains = [], shortLabels = [], cellClasses = [];

    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        shortLabels = ['A', 'B', 'C', 'D'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        shortLabels = ['AO1', 'AO2', 'AO3', 'AO4'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Re', 'Rs', 'Cn'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Pr', 'Re', 'Cn'];
    }
    cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];

    tbody.innerHTML = '';

    for (const quest of pageQuests) {
        const row = document.createElement('tr');

        let domainHtml = '<div class="domain-mini-grid">';
        for (let i = 0; i < domains.length; i++) {
            const grade = quest.domainAverages?.[domains[i]] || '—';
            domainHtml += `
                <div class="domain-mini-cell ${cellClasses[i]}">
                    <div class="domain-mini-label">${shortLabels[i]}</div>
                    <div>${grade}</div>
                </div>
            `;
        }
        domainHtml += '</div>';

        row.innerHTML = `
            <td class="quest-name-link" data-quest-id="${quest.id}">${escapeHtml(quest.title)}</td>
            <td>${escapeHtml(quest.path)}</td>
            <td>${quest.type}</td>
            <td>${quest.completedCount}/${quest.totalStudents} (${quest.completionPercentage}%)</td>
            <td>—</td>
            <td>${domainHtml}</td>
            <td>${quest.popularity}</td>
        `;

        tbody.appendChild(row);
    }

    document.querySelectorAll('.quest-name-link').forEach(el => {
        el.addEventListener('click', async () => {
            const questId = el.dataset.questId;
            const allQuests = await getQuests();
            openQuestDetailsPanel(questId, allQuests);
        });
    });
}

function updatePaginationControls(totalPages) {
    const container = document.getElementById('analytics-pagination');
    if (!container) return;

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${i === currentQuestPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentQuestPage = parseInt(btn.dataset.page);
            await updateQuestsTable();
        });
    });
}


// ==========================================================
// 17. ART BATTLE CONTESTS
// ==========================================================

async function loadTeacherContests() {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const { data: contests, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('teacher_id', auth.teacher.id)
        .order('created_at', { ascending: false });

    if (error) { console.error("Error loading contests:", error); return; }

    const container = document.getElementById('contests-accordion-container');
    if (!container) return;

    if (!contests || contests.length === 0) {
        container.innerHTML = '<div class="no-data" style="padding: 20px; text-align: center;">No contests created yet. Click "Create Art Battle" to start one!</div>';
        return;
    }

    container.innerHTML = '';
    const accordionDiv = document.createElement('div');
    accordionDiv.className = 'quest-accordion-item';

    const header = document.createElement('div');
    header.className = 'quest-accordion-header';

    const gradeBadge = currentGradeLevel === 'ms' ? 'MS' : 'HS';
    const badgeClass = currentGradeLevel === 'ms' ? 'ms' : 'hs';

    header.innerHTML = `
        <div>
            <span class="quest-title">⚔️ Active Contests</span>
            <span class="quest-path-badge">(${contests.length})</span>
            <span class="grade-badge ${badgeClass}">${gradeBadge}</span>
        </div>
        <span class="quest-expand-icon">▼</span>
    `;

    const content = document.createElement('div');
    content.className = 'quest-accordion-content';

    const questsList = document.createElement('div');
    questsList.className = 'quests-list';

    for (const contest of contests) {
        const now = new Date();
        const startDate = new Date(contest.start_date);
        const endDate = new Date(contest.end_date);

        let statusText = '', statusColor = '';
        if (now < startDate) { statusText = '⏳ Upcoming'; statusColor = '#ffa726'; }
        else if (now > endDate) { statusText = '🏁 Ended'; statusColor = '#aaa'; }
        else { statusText = '🔥 Active'; statusColor = '#4caf50'; }

        const contestItem = document.createElement('div');
        contestItem.className = 'quest-link-item';
        contestItem.style.borderLeft = `3px solid ${statusColor}`;
        contestItem.innerHTML = `
            <span class="quest-link-title">⚔️ ${escapeHtml(contest.title)}</span>
            <span style="font-size: 11px; color: ${statusColor};">${statusText}</span>
        `;

        contestItem.addEventListener('click', () => openContestManagement(contest.id));
        questsList.appendChild(contestItem);
    }

    content.appendChild(questsList);
    accordionDiv.appendChild(header);
    accordionDiv.appendChild(content);
    container.appendChild(accordionDiv);

    let expanded = false;
    header.addEventListener('click', () => {
        expanded = !expanded;
        content.classList.toggle('expanded', expanded);
        header.classList.toggle('expanded', expanded);
    });
}

async function openContestManagement(contestId) {
    currentContestId = contestId;

    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*, teachers(name)')
        .eq('id', contestId)
        maybeSingle();

        if (!contest) { 
    alert("Contest not found or has been deleted."); 
    return; 
}

    if (error) { console.error("Error loading contest:", error); return; }

    document.getElementById('contest-management-title').textContent = `🎨 ${contest.title}`;

    await loadContestProfile(contest);
    await loadContestSubmissions(contestId, 'pending', 'contest-pending-list', 'pending-count');
    await loadContestSubmissions(contestId, 'approved', 'contest-submitted-list', 'submitted-count');

    document.getElementById('contest-management-overlay').style.display = 'flex';
}

async function loadContestProfile(contest) {
    const container = document.getElementById('contest-profile-content');
    const startDateStr = new Date(contest.start_date).toLocaleDateString();
    const endDateStr = new Date(contest.end_date).toLocaleDateString();
    const teacherName = contest.teachers?.name || 'Unknown Teacher';

    const auth = await checkTeacherAuth();
    const isCreator = auth?.teacher.id === contest.teacher_id;
    const isHidden = contest.hidden_by_teachers?.includes(auth?.teacher.id) || false;
    const isEnded = new Date() > new Date(contest.end_date);

    container.innerHTML = `
        <div class="contest-info-section">
            <div class="contest-info-title">📋 Contest Information</div>
            <div class="contest-info-row"><div class="contest-info-label">Title:</div><div class="contest-info-value">${escapeHtml(contest.title)}</div></div>
            <div class="contest-info-row"><div class="contest-info-label">Created by:</div><div class="contest-info-value">${escapeHtml(teacherName)}</div></div>
            <div class="contest-info-row"><div class="contest-info-label">Visibility:</div><div class="contest-info-value">${contest.is_worldwide ? '🌍 Worldwide' : '📚 Local (Your students only)'}</div></div>
            <div class="contest-info-row"><div class="contest-info-label">Dates:</div><div class="contest-info-value">${startDateStr} - ${endDateStr}</div></div>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div class="contest-info-section" style="flex: 1;"><div class="contest-info-title">Description / Theme</div><div class="contest-info-value">${escapeHtml(contest.description || 'No description provided.')}</div></div>
            <div class="contest-info-section" style="flex: 1;"><div class="contest-info-title">Requirements</div><div class="contest-info-value">${escapeHtml(contest.requirements || 'No specific requirements.')}</div></div>
        </div>

        <div class="contest-info-section">
            <div class="contest-info-title">Voting Rubric / Guidelines</div>
            <div class="contest-info-value">${escapeHtml(contest.rubric || 'No guidelines provided.')}</div>
        </div>
        ${contest.resources ? `<div class="contest-info-section"><div class="contest-info-title">Resources</div><div class="contest-info-value">${escapeHtml(contest.resources)}</div></div>` : ''}

        <div style="display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap;">
            ${!isCreator ? `
                <div style="flex: 1;">
                    ${!isHidden
                        ? `<button id="hide-from-students-btn" class="contest-action-btn hide-btn">🙈 Hide from My Students</button>`
                        : `<button id="unhide-from-students-btn" class="contest-action-btn unhide-btn">🐵 Show to My Students</button>`
                    }
                </div>
            ` : `
                <div style="display: flex; gap: 15px; flex: 1;">
                    <button id="edit-contest-btn" class="contest-action-btn edit-btn">✏️ Edit Contest</button>
                    <button id="delete-contest-btn" class="contest-action-btn delete-btn">🗑️ Delete Contest (Permanent)</button>
                </div>
            `}
        </div>
    `;

    setTimeout(() => {
        if (!isCreator) {
            document.getElementById('hide-from-students-btn')?.addEventListener('click', () => hideContestFromMyStudents(contest.id));
            document.getElementById('unhide-from-students-btn')?.addEventListener('click', () => unhideContestForMyStudents(contest.id));
        } else {
            document.getElementById('edit-contest-btn')?.addEventListener('click', () => openEditContestModal(contest.id));
            document.getElementById('delete-contest-btn')?.addEventListener('click', () => deleteContest(contest.id));
        }
    }, 100);

    if (isEnded && isCreator) {
        const { data: submissions } = await window.supabase
            .from('art_battle_submissions')
            .select('*, profiles(name, avatar_url)')
            .eq('contest_id', contest.id)
            .eq('status', 'approved')
            .order('votes', { ascending: false });

        if (submissions && submissions.length > 0) {
            container.innerHTML += `
                <div class="contest-info-section" style="margin-top: 20px;">
                    <div class="contest-info-title">🔧 Vote Adjustment (Tie Breaker)</div>
                    <p>Add 0.1 votes to break ties.</p>
                    <div id="vote-adjustment-list"></div>
                </div>
            `;

            const adjustContainer = document.getElementById('vote-adjustment-list');
            if (adjustContainer) {
                adjustContainer.innerHTML = submissions.map(sub => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: rgba(0,0,0,0.3); border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${sub.avatar_url || 'profile.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div><strong>${escapeHtml(sub.title)}</strong><br><small>${escapeHtml(sub.profiles?.name || 'Unknown')}</small></div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span>⭐ ${parseFloat(sub.votes || 0).toFixed(1)} votes</span>
                            <button class="add-vote-btn" data-id="${sub.id}" style="background: rgba(255,215,0,0.3); border: 1px solid #ffd700; color: #ffd700; padding: 5px 10px; border-radius: 4px; cursor: pointer;">+0.1</button>
                        </div>
                    </div>
                `).join('');

                document.querySelectorAll('.add-vote-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await addTieBreakerVote(btn.dataset.id, contest.id);
                    });
                });
            }
        }
    }
}

async function loadContestSubmissions(contestId, status, containerId, countId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { data: submissions, error } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('contest_id', contestId)
        .eq('status', status)
        .order('submitted_at', { ascending: false });

    if (error) {
        container.innerHTML = '<div class="no-data">Error loading submissions.</div>';
        return;
    }

    const countSpan = document.getElementById(countId);
    if (countSpan) countSpan.textContent = submissions.length;

    if (!submissions || submissions.length === 0) {
        container.innerHTML = `<div class="no-data">No ${status} submissions.</div>`;
        return;
    }

    container.innerHTML = '';

    for (const submission of submissions) {
        const card = document.createElement('div');
        card.className = 'teacher-gallery-item';
        card.dataset.submissionId = submission.id;

        const gradeLevel = submission.profiles?.grade_level || 'hs';
        const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

        card.innerHTML = `
            <div class="teacher-gallery-thumbnail" style="cursor: pointer;">
                <img src="${submission.image_url}" alt="${escapeHtml(submission.title || 'Artwork')}">
            </div>
            <div class="teacher-gallery-info">
                <div class="teacher-gallery-title">${escapeHtml(submission.title || 'Untitled')}</div>
                <div class="teacher-gallery-quest">Student: ${escapeHtml(submission.profiles?.name || 'Unknown')} <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span></div>
                <div style="font-size: 11px; color: #aaa; margin: 5px 0;">${escapeHtml((submission.description || 'No description').substring(0, 80))}${submission.description?.length > 80 ? '...' : ''}</div>
                <div style="display: flex; gap: 10px; margin-top: 8px;">
                    ${status === 'pending'
                        ? `<button class="accept-btn" data-id="${submission.id}">✓ Accept</button><button class="decline-btn" data-id="${submission.id}">✗ Decline</button>`
                        : `<button class="view-details-btn" data-id="${submission.id}">📷 View Details</button>`}
                </div>
            </div>
        `;

        container.appendChild(card);
    }

    if (status === 'pending') {
        document.querySelectorAll('#contest-pending-list .accept-btn').forEach(btn => {
            btn.addEventListener('click', () => approveSubmission(btn.dataset.id));
        });
        document.querySelectorAll('#contest-pending-list .decline-btn').forEach(btn => {
            btn.addEventListener('click', () => openRejectModal(btn.dataset.id));
        });
        document.querySelectorAll('#contest-pending-list .teacher-gallery-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', async () => {
                const submissionId = thumb.closest('.teacher-gallery-item').dataset.submissionId;
                await viewContestSubmissionDetails(submissionId);
            });
        });
    } else {
        document.querySelectorAll('#contest-submitted-list .view-details-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await viewContestSubmissionDetails(btn.dataset.id);
            });
        });
        document.querySelectorAll('#contest-submitted-list .teacher-gallery-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', async () => {
                const submissionId = thumb.closest('.teacher-gallery-item').dataset.submissionId;
                await viewContestSubmissionDetails(submissionId);
            });
        });
    }
}

async function viewContestSubmissionDetails(submissionId, forStudent = false) {
    const { data: submission, error } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('id', submissionId)
        .single();

    if (error) { console.error("Error loading submission:", error); return; }

    const modal = document.getElementById('teacher-work-modal');
    const content = document.getElementById('teacher-work-content');

    const gradeLevel = submission.profiles?.grade_level || 'hs';
    const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';

    if (forStudent) {
        content.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; text-align: center;">
                <h3 style="color: #ffd700;">${escapeHtml(submission.title || 'Untitled')}</h3>
                <div style="margin: 15px 0;"><img src="${submission.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;"></div>
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: left;">
                    <p><strong>Student:</strong> ${escapeHtml(submission.profiles?.name || 'Unknown')} <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span></p>
                    <p><strong>Votes:</strong> ⭐ ${submission.votes || 0}</p>
                    <p><strong>Description:</strong><br>${escapeHtml(submission.description || 'No description')}</p>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <h3 style="color: #ffd700;">${escapeHtml(submission.title || 'Untitled')}</h3>
                <div class="teacher-work-details">
                    <p><strong>Student:</strong> ${escapeHtml(submission.profiles?.name || 'Unknown')} <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span></p>
                    <p><strong>Submitted:</strong> ${new Date(submission.submitted_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> ${submission.status === 'approved' ? '✅ Approved' : (submission.status === 'pending' ? '⏳ Pending' : '❌ Rejected')}</p>
                </div>
                <p><strong>Description:</strong><br>${escapeHtml(submission.description || 'No description')}</p>
                ${submission.image_url ? `<div class="teacher-work-image" style="margin-top: 15px;"><img src="${submission.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;"></div>` : ''}
            </div>
        `;
    }

    modal.style.display = 'flex';

    const closeBtn = modal.querySelector('.teacher-work-close');
    if (closeBtn) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }
}

async function approveSubmission(submissionId) {
    const { error } = await window.supabase
        .from('art_battle_submissions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', submissionId);

    if (error) { alert('Error approving submission: ' + error.message); return; }

    await loadContestSubmissions(currentContestId, 'pending', 'contest-pending-list', 'pending-count');
    await loadContestSubmissions(currentContestId, 'approved', 'contest-submitted-list', 'submitted-count');
}

function openRejectModal(submissionId) {
    currentRejectSubmissionId = submissionId;
    document.getElementById('reject-modal').style.display = 'flex';
}

async function confirmRejection() {
    const reason = document.getElementById('rejection-reason').value.trim();
    if (!reason) { alert('Please provide a reason for rejection.'); return; }

    const { error } = await window.supabase
        .from('art_battle_submissions')
        .delete()
        .eq('id', currentRejectSubmissionId);

    if (error) { alert('Error rejecting submission: ' + error.message); return; }

    document.getElementById('reject-modal').style.display = 'none';
    await loadContestSubmissions(currentContestId, 'pending', 'contest-pending-list', 'pending-count');
}

async function deleteContest(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const { data: contest, error: checkError } = await window.supabase
        .from('art_battle_contests')
        .select('teacher_id, title')
        .eq('id', contestId)
        maybeSingle();

        if (!contest) { 
    alert("Contest not found or has been deleted."); 
    return; 
}

    if (checkError || contest.teacher_id !== auth.teacher.id) {
        alert("Only the teacher who created this contest can delete it.");
        return;
    }

    if (!confirm(`⚠️ PERMANENTLY DELETE CONTEST\n\n"${contest.title}"\n\nThis CANNOT be undone.\n\nClick OK to permanently delete.`)) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed."); return; }

    const { data: submissions } = await window.supabase
        .from('art_battle_submissions')
        .select('image_url')
        .eq('contest_id', contestId);

    if (submissions) {
        for (const sub of submissions) {
            if (sub.image_url) {
                try {
                    const fileName = sub.image_url.split('/').pop();
                    await window.supabase.storage.from('contest-submissions').remove([fileName]);
                } catch(e) {}
            }
        }
    }

    await window.supabase.from('art_battle_votes').delete().eq('contest_id', contestId);
    await window.supabase.from('art_battle_submissions').delete().eq('contest_id', contestId);
    await window.supabase.from('art_battle_contests').delete().eq('id', contestId);

    alert("✅ Contest permanently deleted!");
    document.getElementById('contest-management-overlay').style.display = 'none';
    await loadTeacherContests();
}

async function hideContestFromMyStudents(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    if (!confirm("Hide this contest from your students?")) return;

    const { data: contest } = await window.supabase
        .from('art_battle_contests')
        .select('hidden_by_teachers')
        .eq('id', contestId)
        .single();

    const hiddenBy = contest.hidden_by_teachers || [];
    if (!hiddenBy.includes(auth.teacher.id)) hiddenBy.push(auth.teacher.id);

    await window.supabase
        .from('art_battle_contests')
        .update({ hidden_by_teachers: hiddenBy })
        .eq('id', contestId);

    alert("✅ Contest hidden from your students!");
    openContestManagement(contestId);
}

async function unhideContestForMyStudents(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const { data: contest } = await window.supabase
        .from('art_battle_contests')
        .select('hidden_by_teachers')
        .eq('id', contestId)
        .single();

    const hiddenBy = (contest.hidden_by_teachers || []).filter(id => id !== auth.teacher.id);

    await window.supabase
        .from('art_battle_contests')
        .update({ hidden_by_teachers: hiddenBy })
        .eq('id', contestId);

    alert("✅ Contest is now visible to your students again!");
    openContestManagement(contestId);
}

async function openEditContestModal(contestId) {
    const modal = document.getElementById('edit-contest-modal');
    if (!modal) return;

    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();

    if (error) { alert("Error loading contest data"); return; }

    document.getElementById('edit-contest-end-date').value = contest.end_date;
    document.getElementById('edit-contest-resources').value = contest.resources || '';
    document.getElementById('edit-contest-message').innerHTML = '';

    modal.dataset.contestId = contestId;
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 20000; align-items: center; justify-content: center;';
}

async function saveEditContest() {
    const modal = document.getElementById('edit-contest-modal');
    const contestId = modal.dataset.contestId;
    const endDate = document.getElementById('edit-contest-end-date').value;
    const resources = document.getElementById('edit-contest-resources').value.trim();
    const messageDiv = document.getElementById('edit-contest-message');

    if (!endDate) { messageDiv.innerHTML = 'Please select an end date.'; messageDiv.style.color = '#ff8888'; return; }
    if (new Date(endDate) <= new Date()) { messageDiv.innerHTML = 'End date must be in the future.'; messageDiv.style.color = '#ff8888'; return; }

    messageDiv.innerHTML = 'Saving...';
    messageDiv.style.color = '#ffd700';

    const { error } = await window.supabase
        .from('art_battle_contests')
        .update({ end_date: endDate, resources: resources || null, updated_at: new Date().toISOString() })
        .eq('id', contestId);

    if (error) { messageDiv.innerHTML = 'Error saving: ' + error.message; messageDiv.style.color = '#ff8888'; return; }

    messageDiv.innerHTML = '✅ Contest updated successfully!';
    messageDiv.style.color = '#4caf50';

    setTimeout(() => {
        modal.style.display = 'none';
        openContestManagement(contestId);
    }, 1500);
}

async function addTieBreakerVote(submissionId, contestId) {
    const { data: submission } = await window.supabase
        .from('art_battle_submissions')
        .select('votes')
        .eq('id', submissionId)
        .single();

    const newVotes = (submission.votes || 0) + 0.1;

    const { error } = await window.supabase
        .from('art_battle_submissions')
        .update({ votes: newVotes })
        .eq('id', submissionId);

    if (error) { alert("Error adjusting votes: " + error.message); return; }

    alert("✅ Vote adjusted!");
    openContestManagement(contestId);
}

async function createArtBattleContest() {
    const title = document.getElementById('contest-title').value.trim();
    const description = document.getElementById('contest-description').value.trim();
    const requirements = document.getElementById('contest-requirements').value.trim();
    const rubric = document.getElementById('contest-rubric').value.trim();
    const resources = document.getElementById('contest-resources').value.trim();
    const visibility = document.querySelector('input[name="visibility"]:checked').value;
    const startDate = document.getElementById('contest-start-date').value;
    const endDate = document.getElementById('contest-end-date').value;
    const password = document.getElementById('contest-password').value;
    const messageDiv = document.getElementById('contest-message');

    if (!title || !description || !requirements || !rubric) {
        messageDiv.innerHTML = 'Please fill in all required fields.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!startDate || !endDate) {
        messageDiv.innerHTML = 'Please select both dates.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!password) {
        messageDiv.innerHTML = 'Please enter your password.';
        messageDiv.style.color = '#ff8888';
        return;
    }

    if (new Date(startDate) < new Date()) {
        messageDiv.innerHTML = 'Start date cannot be in the past.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
        messageDiv.innerHTML = 'End date must be after start date.';
        messageDiv.style.color = '#ff8888';
        return;
    }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const { error: verifyError } = await window.supabase.auth.signInWithPassword({
        email: currentTeacherEmail, password
    });

    if (verifyError) {
        messageDiv.innerHTML = 'Incorrect password.';
        messageDiv.style.color = '#ff8888';
        return;
    }

    const { error: contestError } = await window.supabase
        .from('art_battle_contests')
        .insert({
            teacher_id: auth.teacher.id,
            title, description, requirements, rubric,
            resources: resources || null,
            is_worldwide: visibility === 'worldwide',
            start_date: startDate,
            end_date: endDate,
            is_active: true,
            created_at: new Date().toISOString()
        });

    if (contestError) {
        messageDiv.innerHTML = 'Error creating contest: ' + contestError.message;
        messageDiv.style.color = '#ff8888';
        return;
    }

    messageDiv.innerHTML = '✅ Contest created successfully!';
    messageDiv.style.color = '#4caf50';

    setTimeout(() => {
        closeCreateContestModal();
        loadTeacherContests();
    }, 2000);
}

function openCreateContestModal() {
    document.getElementById('contest-title').value = '';
    document.getElementById('contest-description').value = '';
    document.getElementById('contest-requirements').value = '';
    document.getElementById('contest-rubric').value = '';
    document.getElementById('contest-resources').value = '';
    document.getElementById('contest-password').value = '';
    document.getElementById('contest-message').innerHTML = '';
    document.getElementById('contest-warning').style.display = 'none';

    document.querySelector('input[name="visibility"][value="local"]').checked = true;

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);

    document.getElementById('contest-start-date').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('contest-end-date').value = nextWeek.toISOString().split('T')[0];

    document.getElementById('create-contest-overlay').style.display = 'flex';
}

function closeCreateContestModal() {
    document.getElementById('create-contest-overlay').style.display = 'none';
}

function initArtBattleContests() {
    document.getElementById('create-contest-btn')?.addEventListener('click', openCreateContestModal);
    document.getElementById('close-contest-overlay')?.addEventListener('click', closeCreateContestModal);
    document.getElementById('cancel-contest-btn')?.addEventListener('click', closeCreateContestModal);
    document.getElementById('create-contest-submit-btn')?.addEventListener('click', createArtBattleContest);

    const overlay = document.getElementById('create-contest-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeCreateContestModal();
        });
    }

    ['contest-title', 'contest-description', 'contest-requirements', 'contest-rubric', 'contest-start-date', 'contest-end-date'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('focus', () => {
                document.getElementById('contest-warning').style.display = 'block';
            });
        }
    });
}

function initContestManagement() {
    document.getElementById('close-contest-management')?.addEventListener('click', () => {
        document.getElementById('contest-management-overlay').style.display = 'none';
    });

    const overlay = document.getElementById('contest-management-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });
    }

    const tabBtns = document.querySelectorAll('.tab-btn[data-contest-tab]');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.contestTab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.getElementById('contest-profile-tab').style.display = 'none';
            document.getElementById('contest-pending-tab').style.display = 'none';
            document.getElementById('contest-submitted-tab').style.display = 'none';

            if (tab === 'profile') document.getElementById('contest-profile-tab').style.display = 'block';
            else if (tab === 'pending') document.getElementById('contest-pending-tab').style.display = 'block';
            else if (tab === 'submitted') document.getElementById('contest-submitted-tab').style.display = 'block';
        });
    });

    document.getElementById('cancel-reject')?.addEventListener('click', () => {
        document.getElementById('reject-modal').style.display = 'none';
    });
    document.getElementById('confirm-reject')?.addEventListener('click', confirmRejection);

    const rejectModal = document.getElementById('reject-modal');
    if (rejectModal) {
        rejectModal.addEventListener('click', (e) => {
            if (e.target === rejectModal) rejectModal.style.display = 'none';
        });
    }

    loadTeacherContests();
}

function initEditContestModal() {
    const modal = document.getElementById('edit-contest-modal');
    if (!modal) return;

    modal.style.display = 'none';

    const closeModal = () => { modal.style.display = 'none'; };

    modal.querySelector('.teacher-work-close')?.addEventListener('click', closeModal);
    document.getElementById('cancel-edit-contest-btn')?.addEventListener('click', closeModal);
    document.getElementById('save-edit-contest-btn')?.addEventListener('click', saveEditContest);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}


// ==========================================================
// 18. CUSTOM QUESTS
// ==========================================================

async function canCreateCustomQuest() {
    const auth = await checkTeacherAuth();
    if (!auth) return false;

    const { count, error } = await window.supabase
        .from('teacher_custom_quests')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', auth.teacher.id)
        .eq('deleted', false);

    if (error) return true;
    return count < 5;
}

async function openCreateCustomQuestModal() {
    const canCreate = await canCreateCustomQuest();
    if (!canCreate) {
        alert("You have reached the maximum of 5 custom quests.");
        return;
    }

    document.getElementById('custom-quest-title').value = '';
    document.getElementById('custom-quest-path').value = 'Painter Path';
    document.getElementById('custom-quest-difficulty').value = '1';
    document.getElementById('custom-quest-rationale').value = '';
    document.getElementById('custom-quest-description').value = '';

    document.getElementById('custom-quest-requirements-list').innerHTML = `
        <div class="requirement-item">
            <input type="text" class="requirement-input" placeholder="Requirement">
            <button type="button" class="remove-requirement-btn">✖</button>
        </div>
    `;

    document.getElementById('custom-quest-links-list').innerHTML = `
        <div class="link-item">
            <input type="text" class="link-type" placeholder="Type (e.g., Video sample)">
            <input type="url" class="link-url" placeholder="URL">
            <button type="button" class="remove-link-btn">✖</button>
        </div>
    `;

    document.getElementById('custom-quest-message').innerHTML = '';
    document.getElementById('create-custom-quest-modal').style.display = 'flex';
}

async function saveCustomQuest() {
    const title = document.getElementById('custom-quest-title').value.trim();
    const path = document.getElementById('custom-quest-path').value;
    const difficulty = parseInt(document.getElementById('custom-quest-difficulty').value);
    const rationale = document.getElementById('custom-quest-rationale').value.trim();
    const description = document.getElementById('custom-quest-description').value.trim();

    if (!title || !rationale || !description) {
        showCustomQuestMessage("Please fill in all fields.", "error");
        return;
    }

    const requirementInputs = document.querySelectorAll('.requirement-input');
    const requirements = [];
    requirementInputs.forEach(input => {
        const value = input.value.trim();
        if (value) requirements.push(value);
    });

    if (requirements.length === 0) {
        showCustomQuestMessage("Please add at least one requirement.", "error");
        return;
    }

    const linkTypeInputs = document.querySelectorAll('.link-type');
    const linkUrlInputs = document.querySelectorAll('.link-url');
    const links = [];
    for (let i = 0; i < linkTypeInputs.length; i++) {
        const type = linkTypeInputs[i].value.trim();
        const url = linkUrlInputs[i].value.trim();
        if (type && url) links.push({ type, url });
    }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        showCustomQuestMessage("Password verification failed.", "error");
        return;
    }

    const canCreate = await canCreateCustomQuest();
    if (!canCreate) {
        showCustomQuestMessage("You have reached the maximum of 5 custom quests.", "error");
        return;
    }

    const { count } = await window.supabase
        .from('teacher_custom_quests')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', auth.teacher.id)
        .eq('deleted', false);

    const customImages = ["charimage/custom1.gif", "charimage/custom2.gif", "charimage/custom3.gif", "charimage/custom4.gif", "charimage/custom5.gif"];
    const customImage = customImages[count] || "charimage/teacher_quest.png";

    const timestamp = Date.now();
    const questId = `custom_${auth.teacher.id.substring(0, 8)}_${timestamp}`;

    const framework = await loadTeacherFramework();

    let rubric;
    if (framework === 'ib-myp') {
        rubric = {
            overall: title,
            criteria: [
                { code: "A", name: "Knowing & Understanding", levels: { "7-8": "", "5-6": "", "3-4": "", "1-2": "" } },
                { code: "B", name: "Developing Skills", levels: { "7-8": "", "5-6": "", "3-4": "", "1-2": "" } },
                { code: "C", name: "Thinking Creatively", levels: { "7-8": "", "5-6": "", "3-4": "", "1-2": "" } },
                { code: "D", name: "Responding", levels: { "7-8": "", "5-6": "", "3-4": "", "1-2": "" } }
            ]
        };
    } else if (framework === 'igcse') {
        rubric = {
            overall: title,
            assessment_objectives: [
                { code: "AO1", name: "Record", levels: { "A*-A": "", "B-C": "", "D-E": "", "F-G": "" } },
                { code: "AO2", name: "Explore & Select", levels: { "A*-A": "", "B-C": "", "D-E": "", "F-G": "" } },
                { code: "AO3", name: "Develop", levels: { "A*-A": "", "B-C": "", "D-E": "", "F-G": "" } },
                { code: "AO4", name: "Present", levels: { "A*-A": "", "B-C": "", "D-E": "", "F-G": "" } }
            ]
        };
    } else {
        const standardsList = currentGradeLevel === 'ms' ? MS_STANDARDS : HS_STANDARDS;
        rubric = {
            overall: title,
            standards: standardsList.map(std => ({
                code: std.code, name: std.name,
                levels: { "4": "", "3": "", "2": "", "1": "" }
            }))
        };
    }

    const isMSQuest = currentGradeLevel === 'ms';

    const saveBtn = document.getElementById('save-custom-quest-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Creating...';
    saveBtn.disabled = true;

    try {
        const { error } = await window.supabase
            .from('teacher_custom_quests')
            .insert({
                teacher_id: auth.teacher.id,
                quest_id: questId,
                title, rationale, description, requirements, links, difficulty, path, rubric,
                selected_standards: [],
                character: customImage,
                grade_level: isMSQuest ? 'ms' : 'hs',
                created_at: new Date().toISOString()
            });

        if (error) {
            showCustomQuestMessage("Error creating quest: " + error.message, "error");
        } else {
            showCustomQuestMessage(`✅ Custom quest "${title}" created successfully!`, "success");
            invalidateCustomQuestsCache();
            invalidateAllQuestsCache();
            invalidateTabCache('quests');

            setTimeout(async () => {
                document.getElementById('create-custom-quest-modal').style.display = 'none';
                renderAllQuestAccordions();
                await notifyQuestsChanged();
            }, 2000);
        }
    } catch (error) {
        showCustomQuestMessage("An error occurred. Please try again.", "error");
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

function showCustomQuestMessage(message, type) {
    const messageDiv = document.getElementById('custom-quest-message');
    messageDiv.textContent = message;
    messageDiv.className = `settings-message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'settings-message';
    }, 5000);
}

async function deleteCustomQuest(questId, questTitle) {
    if (!confirm(`Delete custom quest "${questTitle}"?\n\nStudent grades and artwork will be preserved (archived).`)) return;

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) { alert("Password verification failed."); return; }

    const { error } = await window.supabase
        .from('teacher_custom_quests')
        .update({ deleted: true, deleted_at: new Date().toISOString() })
        .eq('quest_id', questId)
        .eq('teacher_id', auth.teacher.id);

    if (error) {
        alert("Error deleting quest: " + error.message);
    } else {
        alert(`✅ Quest "${questTitle}" has been archived.`);
        invalidateCustomQuestsCache();
        invalidateAllQuestsCache();
        invalidateTabCache('quests');
        renderAllQuestAccordions();
        await notifyQuestsChanged();
    }
}


// ==========================================================
// 19. PRINT / EXPORT
// ==========================================================

async function getStudentInfo(userId) {
    const auth = await checkTeacherAuth();
    if (!auth) return null;

    const { data: profile } = await window.supabase
        .from('profiles').select('*').eq('id', userId).maybeSingle();

    if (!profile) return null;

    const { data: teacher } = await window.supabase
        .from('teachers').select('name').eq('class_code', profile.teacher_code).maybeSingle();

    let className = 'No Class';
    let classId = null;
    if (profile.class_id) {
        const cls = teacherClasses.find(c => c.id === profile.class_id);
        if (cls) { className = cls.name; classId = profile.class_id; }
    }

    return {
        id: profile.id,
        name: profile.name,
        email: profile.email || 'Not provided',
        avatar: profile.avatar_url || 'profile.png',
        teacherName: teacher?.name || 'Teacher',
        className, classId,
        teacherCode: profile.teacher_code,
        gradeLevel: profile.grade_level || 'hs'
    };
}

async function printStudentProfile(includeQuests = true) {
    if (!currentStudentId) { alert("No student selected."); return; }

    const student = await getStudentInfo(currentStudentId);
    if (!student) { alert("Student not found."); return; }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Generating print preview...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#ffd700;padding:20px;border-radius:12px;z-index:10000;';
    document.body.appendChild(loadingMsg);

    try {
        const printHtml = await generateStudentPrintHtml(student, includeQuests);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                loadingMsg.remove();
            }, 500);
        };
    } catch (error) {
        console.error("Error generating print:", error);
        alert("Error generating print preview.");
        loadingMsg.remove();
    }
}

async function generateStudentPrintHtml(student, includeQuests = true) {
    const framework = await loadTeacherFramework();
    const isMS = student.gradeLevel === 'ms';

    const { data: progress } = await window.supabase
        .from('student_progress').select('*').eq('user_id', student.id).maybeSingle();

    const completedQuests = progress?.completed_quests || {};
    const questGrades = progress?.quest_grades || {};
    const earnedBadges = progress?.earned_badges || {};

    const allQuests = await getQuests();
    const classTargets = await getClassTargets(student.classId);
    const targetTotal = classTargets.total;

    let completedQuestList = [];
    if (includeQuests) {
        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (isCompleted === true) {
                const quest = allQuests[questId];
                if (quest) completedQuestList.push({ id: questId, quest, grade: questGrades[questId] });
            }
        }
    }

    const badgesRes = await fetch('badges.json');
    const badgesData = (await badgesRes.json()).badges;

    const standardsHtml = await generateStandardsTableForPrint(student.id, framework);
    const badgesHtml = generateBadgesForPrint(earnedBadges, badgesData);

    const totalCompleted = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true).length;
    const gradeLevelDisplay = isMS ? 'Middle School' : 'High School';

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${student.name} - Art Progress Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; color: black; padding: 20px; }
            .print-container { max-width: 1100px; margin: 0 auto; }
            .print-student-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .print-student-info h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a2e; }
            .print-student-info p { margin: 5px 0; color: #333; }
            .print-student-avatar img { width: 80px; height: 80px; }
            .grade-level-tag { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; background: ${isMS ? '#4a6a8a' : '#2d5a27'}; color: white; margin-left: 10px; }
            h2 { font-size: 18px; margin: 20px 0 15px 0; color: #1a1a2e; border-left: 4px solid #4a6a8a; padding-left: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f0f0f0; font-weight: bold; }
            .badge-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
            .badge-item { text-align: center; width: 80px; }
            .badge-item img { width: 60px; height: 60px; border-radius: 50%; }
            .badge-item .badge-name { font-size: 11px; margin-top: 5px; color: #333; }
            .badge-item.unearned img { opacity: 0.3; filter: grayscale(100%); }
            .quest-section { margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
            .quest-section.mvp { border-left: 4px solid #ffd700; padding-left: 12px; }
            .quest-header { margin-bottom: 10px; }
            .quest-title { font-size: 16px; font-weight: bold; color: #1a1a2e; }
            .quest-path { font-size: 12px; color: #666; margin-left: 10px; }
            .highlight { background-color: #ffff99 !important; font-weight: bold !important; }
            @media print {
                body { padding: 0; }
                .quest-section { break-inside: avoid; page-break-inside: avoid; }
                table { break-inside: avoid; }
                .highlight { background-color: #ffff99 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style>
    </head>
    <body>
        <div class="print-container">
            <div class="print-student-header">
                <div class="print-student-info">
                    <h1>${escapeHtml(student.name)} <span class="grade-level-tag">${gradeLevelDisplay}</span></h1>
                    <p><strong>Email:</strong> ${escapeHtml(student.email)}</p>
                    <p><strong>Class:</strong> ${escapeHtml(student.className)}</p>
                    <p><strong>Teacher:</strong> ${escapeHtml(student.teacherName)}</p>
                </div>
                <div class="print-student-avatar"><img src="${student.avatar}" alt="Avatar"></div>
            </div>
            <h2>🎨 Art Standards Summary</h2>
            ${standardsHtml}
            <h2>🏆 Badges Earned</h2>
            ${badgesHtml}
            <h2>📝 Teacher Notes</h2>
            <div style="border: 1px solid #ccc; padding: 15px; min-height: 120px; margin: 20px 0; background: #fafafa; border-radius: 8px;">
                <p style="color: #666; margin-bottom: 8px;"><strong>Strengths:</strong></p>
                <p style="color: #666; margin-bottom: 15px;">_________________________________________</p>
                <p style="color: #666; margin-bottom: 8px;"><strong>Areas for Improvement:</strong></p>
                <p style="color: #666; margin-bottom: 15px;">_________________________________________</p>
                <p style="color: #666; margin-bottom: 8px;"><strong>Teacher's Signature:</strong></p>
                <p style="color: #666;">_________________________  Date: ___________</p>
            </div>
            ${includeQuests && completedQuestList.length > 0 ? '<h2>📋 Completed Quests</h2>' + await generateCompletedQuestsForPrint(completedQuestList, framework) : ''}
        </div>
    </body>
    </html>`;
}

async function generateStandardsTableForPrint(userId, framework) {
    const { data: profile } = await window.supabase
        .from('profiles').select('grade_level').eq('id', userId).maybeSingle();

    const isMS = (profile?.grade_level || 'hs') === 'ms';
    const { data: progress } = await window.supabase
        .from('student_progress').select('quest_grades, completed_quests').eq('user_id', userId).maybeSingle();

    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const allQuests = await getQuests();

    const mvpQuests = [];
    const regularQuests = [];
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
        if (!quest) continue;
        if (quest.style === 'mvp') mvpQuests.push(questId);
        else regularQuests.push(questId);
    }

    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';

    if (isIB) {
        const mvpScores = { A: 0, B: 0, C: 0, D: 0 }, mvpCounts = { A: 0, B: 0, C: 0, D: 0 };
        const regScores = { A: 0, B: 0, C: 0, D: 0 }, regCounts = { A: 0, B: 0, C: 0, D: 0 };

        for (const questId of regularQuests) {
            const quest = allQuests[questId];
            if (!quest?.rubric?.criteria) continue;
            const grades = questGrades[questId]?.grade || {};
            quest.rubric.criteria.forEach(c => {
                const g = grades[c.code];
                if (typeof g === 'number') { regScores[c.code] += g; regCounts[c.code]++; }
            });
        }
        for (const questId of mvpQuests) {
            const quest = allQuests[questId];
            if (!quest?.rubric?.criteria) continue;
            const grades = questGrades[questId]?.mvpGrade || {};
            quest.rubric.criteria.forEach(c => {
                const g = grades[c.code];
                if (typeof g === 'number') { mvpScores[c.code] += g; mvpCounts[c.code]++; }
            });
        }

        const criteria = [
            { code: "A", name: "Knowing & Understanding" },
            { code: "B", name: "Developing Skills" },
            { code: "C", name: "Thinking Creatively" },
            { code: "D", name: "Responding" }
        ];

        let html = `<table><thead><tr><th>Criterion</th><th>Description</th><th>Formative Grade</th><th>Summative Grade</th></tr></thead><tbody>`;
        for (const c of criteria) {
            const fa = regCounts[c.code] ? (regScores[c.code] / regCounts[c.code]).toFixed(2) : '—';
            const sa = mvpCounts[c.code] ? (mvpScores[c.code] / mvpCounts[c.code]).toFixed(2) : '—';
            html += `<tr><td><strong>${c.code}</strong></td><td>${c.name}</td><td>${fa}</td><td>${sa}</td></tr>`;
        }
        return html + `</tbody></table>`;
    } else if (isIGCSE) {
        const allCompleted = [...regularQuests, ...mvpQuests];
        const totalScores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        const totalCounts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };

        for (const questId of allCompleted) {
            const quest = allQuests[questId];
            if (!quest?.rubric?.assessment_objectives) continue;
            const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';
            const grades = questGrades[questId]?.[column] || {};
            quest.rubric.assessment_objectives.forEach(ao => {
                const g = grades[ao.code];
                if (typeof g === 'number') { totalScores[ao.code] += g; totalCounts[ao.code]++; }
            });
        }

        const aos = [
            { code: "AO1", name: "Record" },
            { code: "AO2", name: "Explore & Select" },
            { code: "AO3", name: "Develop" },
            { code: "AO4", name: "Present" }
        ];

        let html = `<table><thead><tr><th>Assessment Objective</th><th>Description</th><th>Grade</th></tr></thead><tbody>`;
        for (const ao of aos) {
            const avg = totalCounts[ao.code] ? (totalScores[ao.code] / totalCounts[ao.code]).toFixed(2) : '—';
            const display = avg !== '—' ? convertNumberToLetterGrade(Math.round(parseFloat(avg))) : avg;
            html += `<tr><td><strong>${ao.code}</strong></td><td>${ao.name}</td><td>${display}</td></tr>`;
        }
        return html + `</tbody></table>`;
    } else {
        const standardsList = isMS ? MS_STANDARDS : HS_STANDARDS;
        const mvpScores = {}, mvpCounts = {}, regScores = {}, regCounts = {};

        for (const questId of regularQuests) {
            const grades = questGrades[questId]?.grade || {};
            for (const [standard, grade] of Object.entries(grades)) {
                regScores[standard] = (regScores[standard] || 0) + grade;
                regCounts[standard] = (regCounts[standard] || 0) + 1;
            }
        }
        for (const questId of mvpQuests) {
            const grades = questGrades[questId]?.mvpGrade || {};
            for (const [standard, grade] of Object.entries(grades)) {
                mvpScores[standard] = (mvpScores[standard] || 0) + grade;
                mvpCounts[standard] = (mvpCounts[standard] || 0) + 1;
            }
        }

        let html = `<table><thead><tr><th>Standard Code</th><th>Standard Name</th><th>Formative Grade</th><th>Summative Grade</th></tr></thead><tbody>`;
        for (const std of standardsList) {
            const fa = regCounts[std.code] ? (regScores[std.code] / regCounts[std.code]).toFixed(2) : '—';
            const sa = mvpCounts[std.code] ? (mvpScores[std.code] / mvpCounts[std.code]).toFixed(2) : '—';
            html += `<tr><td>${std.code}</td><td>${std.name}</td><td>${fa}</td><td>${sa}</td></tr>`;
        }
        return html + `</tbody></table>`;
    }
}

function generateBadgesForPrint(earnedBadges, badgesData) {
    const earnedBadgeIds = Object.keys(earnedBadges).filter(id => earnedBadges[id]?.earned === true);
    let html = '<div class="badge-grid">';
    for (const badge of badgesData) {
        const isEarned = earnedBadgeIds.includes(badge.id);
        html += `
            <div class="badge-item ${isEarned ? 'earned' : 'unearned'}">
                <img src="${badge.image}" alt="${badge.name}" style="${isEarned ? '' : 'opacity: 0.3; filter: grayscale(100%);'}">
                <div class="badge-name" style="${isEarned ? 'color: black;' : 'color: #999;'}">${escapeHtml(badge.name)}</div>
            </div>
        `;
    }
    return html + '</div>';
}

async function generateCompletedQuestsForPrint(completedQuestList, framework) {
    if (completedQuestList.length === 0) return '<p>No completed quests yet.</p>';

    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isMS = currentGradeLevel === 'ms';

    let html = '';

    for (const item of completedQuestList) {
        const quest = item.quest;
        const gradeData = item.grade;
        const isMVP = quest.style === 'mvp';

        let gradeLevels = [];
        let itemsToShow = [];

        if (isIB) {
            itemsToShow = quest.rubric?.criteria || [];
            gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        } else if (isIGCSE) {
            itemsToShow = quest.rubric?.assessment_objectives || [];
            gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        } else {
            itemsToShow = isMS ? MS_STANDARDS : (quest.rubric?.standards || []);
            gradeLevels = ['4', '3', '2', '1'];
        }

        if (itemsToShow.length === 0) continue;

        const column = isMVP ? 'mvpGrade' : 'grade';
        const grades = gradeData?.[column] || {};
        const mvpClass = isMVP ? 'mvp' : '';

        html += `<div class="quest-section ${mvpClass}">
            <div class="quest-header">
                <span class="quest-title">${escapeHtml(quest.title)}</span>
                <span class="quest-path">(${escapeHtml(quest.path?.[0] || 'Unknown')} - ${isMVP ? 'MVP' : 'Formative'})</span>
            </div>
            <table class="quest-rubric-table"><thead><tr>
                <th>${isIB ? 'Criterion' : (isIGCSE ? 'Assessment Objective' : 'Standard')}</th>
                <th>${gradeLevels[0]}</th><th>${gradeLevels[1]}</th><th>${gradeLevels[2]}</th><th>${gradeLevels[3]}</th>
            </tr></thead><tbody>`;

        for (const rubricItem of itemsToShow) {
            const studentGrade = grades[rubricItem.code] || '';
            let highlights = ['', '', '', ''];
            let gradeDisplay = '—';

            if (studentGrade) {
                if (isIGCSE) {
                    gradeDisplay = convertNumberToLetterGrade(Math.round(studentGrade));
                    if (['A*', 'A'].includes(gradeDisplay)) highlights[0] = 'highlight';
                    else if (['B', 'C'].includes(gradeDisplay)) highlights[1] = 'highlight';
                    else if (['D', 'E'].includes(gradeDisplay)) highlights[2] = 'highlight';
                    else if (['F', 'G'].includes(gradeDisplay)) highlights[3] = 'highlight';
                } else {
                    gradeDisplay = studentGrade;
                    const gv = Math.floor(studentGrade);
                    if (gv >= 7 || gv === 4) highlights[0] = 'highlight';
                    else if (gv >= 5 || gv === 3) highlights[1] = 'highlight';
                    else if (gv >= 3 || gv === 2) highlights[2] = 'highlight';
                    else highlights[3] = 'highlight';
                }
            }

            html += `<tr>
                <td><strong>${escapeHtml(rubricItem.code)}</strong>${rubricItem.name ? `: ${escapeHtml(rubricItem.name)}` : ''}</td>
                ${gradeLevels.map((lvl, i) => {
                    const txt = escapeHtml(rubricItem.levels?.[lvl] || '—');
                    return `<td class="${highlights[i]}">${highlights[i] ? `<strong>${txt}</strong>` : txt}</td>`;
                }).join('')}
            </tr>`;
        }

        html += `</tbody></table></div>`;
    }

    return html;
}

async function printAllProfilesCompact() { await printAllProfilesBatch(false); }
async function printAllProfilesFull() { await printAllProfilesBatch(true); }

async function printAllProfilesBatch(includeQuests) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    const classFilter = document.getElementById('analytics-class-filter')?.value || 'all';
    let query = window.supabase.from('profiles').select('*').eq('teacher_code', auth.teacher.class_code);
    if (classFilter !== 'all') query = query.eq('class_id', classFilter);

    const { data: students } = await query;
    if (!students || students.length === 0) { alert("No students found to print."); return; }

    const className = classFilter !== 'all'
        ? teacherClasses.find(c => c.id === classFilter)?.name || 'Selected Class'
        : 'All Classes';

    const questsText = includeQuests ? 'with quests' : 'compact (no quests)';
    if (!confirm(`Print ${students.length} student profile(s) (${questsText}) from ${className}?`)) return;

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = `Generating ${students.length} profile(s)... Please wait.`;
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#ffd700;padding:20px;border-radius:12px;z-index:10000;';
    document.body.appendChild(loadingMsg);

    try {
        let allHtmlChunks = [];

        for (let i = 0; i < students.length; i++) {
            loadingMsg.textContent = `Generating profile ${i+1} of ${students.length}...`;
            const studentInfo = await getStudentInfo(students[i].id);
            if (!studentInfo) continue;

            const studentHtml = await generateStudentPrintHtml(studentInfo, includeQuests);
            const bodyMatch = studentHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : '';

            allHtmlChunks.push(`<div class="student-section" style="page-break-after: always; break-after: page;">${bodyContent}</div>`);
        }

        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Class Progress Reports</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; color: black; padding: 20px; }
            .print-container { max-width: 1100px; margin: 0 auto; }
            .student-section { margin-bottom: 40px; page-break-after: always; break-after: page; }
            .student-section:last-child { page-break-after: auto; }
            h2 { font-size: 18px; margin: 20px 0 15px 0; border-left: 4px solid #4a6a8a; padding-left: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f0f0f0; }
            .badge-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
            .badge-item { text-align: center; width: 80px; }
            .badge-item img { width: 60px; height: 60px; border-radius: 50%; }
            .highlight { background-color: #ffff99 !important; font-weight: bold !important; }
            @media print {
                body { padding: 0; }
                .student-section { page-break-after: always; }
                .highlight { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style></head><body><div class="print-container">${allHtmlChunks.join('')}</div></body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(fullHtml);
        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                loadingMsg.remove();
            }, 500);
        };
    } catch (error) {
        console.error("Error generating batch print:", error);
        alert("Error generating print preview.");
        loadingMsg.remove();
    }
}

async function exportAnalyticsToCSV() {
    const allQuests = await getQuests();
    const framework = analyticsData.framework;
    const isMS = currentGradeLevel === 'ms';

    let domainHeaders = [];
    if (framework === 'ib-myp') domainHeaders = ['A: Knowing & Understanding', 'B: Developing Skills', 'C: Thinking Creatively', 'D: Responding'];
    else if (framework === 'igcse') domainHeaders = ['AO1: Record', 'AO2: Explore & Select', 'AO3: Develop', 'AO4: Present'];
    else if (isMS) domainHeaders = ['Creating (Cr)', 'Reflecting (Re)', 'Responding (Rs)', 'Connecting (Cn)'];
    else domainHeaders = ['Creating (Cr)', 'Presenting (Pr)', 'Responding (Re)', 'Connecting (Cn)'];

    const studentsData = [['Student Name', 'Class', 'Grade Level', 'Quests Completed', 'Target Quests', 'Completion %', 'Active Quest', ...domainHeaders, 'Last Upload']];

    for (const student of analyticsData.students) {
        const targetTotal = student.targetTotal || 22;
        const completionPercent = targetTotal > 0 ? Math.round((student.completedCount / targetTotal) * 100) : 0;
        const domainKeys = Object.keys(student.domainGrades);

        studentsData.push([
            student.name, student.className, student.gradeLevel || 'HS',
            student.completedCount, targetTotal, `${completionPercent}%`,
            student.activeQuest || 'None',
            domainKeys.length > 0 ? student.domainGrades[domainKeys[0]] || '—' : '—',
            domainKeys.length > 1 ? student.domainGrades[domainKeys[1]] || '—' : '—',
            domainKeys.length > 2 ? student.domainGrades[domainKeys[2]] || '—' : '—',
            domainKeys.length > 3 ? student.domainGrades[domainKeys[3]] || '—' : '—',
            student.lastUpload ? new Date(student.lastUpload).toLocaleDateString() : 'Never'
        ]);
    }

    const questsData = [['Quest ID', 'Title', 'Path', 'Type', 'Completed Count', 'Total Students', 'Completion %', 'Popularity', ...domainHeaders]];
    const allQuestIds = Object.keys(allQuests).filter(id => id.startsWith('quest')).sort();

    for (const questId of allQuestIds) {
        const quest = allQuests[questId];
        const stats = analyticsData.questStats[questId] || { completedCount: 0, totalStudents: analyticsData.students.length, completionPercentage: 0, popularity: 0, domainAverages: {} };
        const completionPercent = stats.totalStudents > 0 ? ((stats.completedCount / stats.totalStudents) * 100).toFixed(1) : 0;
        const domainKeys = Object.keys(stats.domainAverages || {});

        questsData.push([
            questId, quest.title || 'Untitled', quest.path?.[0] || 'Unknown',
            quest.style === 'mvp' ? 'MVP (Summative)' : 'Formative',
            stats.completedCount, stats.totalStudents, `${completionPercent}%`, stats.popularity || 0,
            domainKeys.length > 0 ? stats.domainAverages[domainKeys[0]] || '—' : '—',
            domainKeys.length > 1 ? stats.domainAverages[domainKeys[1]] || '—' : '—',
            domainKeys.length > 2 ? stats.domainAverages[domainKeys[2]] || '—' : '—',
            domainKeys.length > 3 ? stats.domainAverages[domainKeys[3]] || '—' : '—'
        ]);
    }

    downloadCSV(convertToCSV(studentsData), `analytics_students_${new Date().toISOString().slice(0, 19)}.csv`);
    setTimeout(() => downloadCSV(convertToCSV(questsData), `analytics_quests_${new Date().toISOString().slice(0, 19)}.csv`), 100);

    alert("✅ Export complete! Two CSV files have been downloaded.");
}

function convertToCSV(data) {
    return data.map(row => row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    }).join(',')).join('\n');
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// ==========================================================
// 20. MODALS & ESCAPE HANDLING
// ==========================================================

function initTermsModal() {
    const link = document.getElementById('terms-link');
    const modal = document.getElementById('terms-modal');
    const closeBtn = document.getElementById('close-terms-modal');
    const acceptBtn = document.getElementById('accept-terms-btn');

    if (!link || !modal) return;

    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);

    newLink.onclick = (e) => { e.preventDefault(); modal.style.display = 'flex'; };

    const closeModal = () => { modal.style.display = 'none'; };

    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = closeModal;
    }
    if (acceptBtn) {
        const newAcceptBtn = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
        newAcceptBtn.onclick = closeModal;
    }

    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function initWorkModal() {
    const modal = document.getElementById('teacher-work-modal');
    const closeBtn = document.querySelector('.teacher-work-close');

    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

function setupModalEscapeHandling() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const modals = [
            'teacher-work-modal',
            'contest-management-overlay',
            'create-class-modal',
            'password-verify-modal',
            'restriction-popup',
            'prerequisite-popup',
            'accept-quest-restriction-popup'
        ];

        for (const modalId of modals) {
            const modal = document.getElementById(modalId);
            if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
                modal.style.display = 'none';
                e.preventDefault();
                return;
            }
        }

        const questDetailsPanel = document.getElementById('quest-details-panel');
        if (questDetailsPanel && questDetailsPanel.style.display === 'block') {
            questDetailsPanel.style.display = 'none';
            e.preventDefault();
            return;
        }

        const detailsPanel = document.getElementById('student-details-panel');
        if (detailsPanel && detailsPanel.style.display === 'block') {
            detailsPanel.style.display = 'none';
            e.preventDefault();
            return;
        }
    });
}


// ==========================================================
// 21. TABS SETUP
// ==========================================================

function setupMainTabs() {
    const tabs = [
        {
            id: 'students',
            tabId: 'students-main-tab',
            contentId: 'students-main-content',
            onShow: async () => {
                if (!isTabCacheValid('students')) {
                    await renderClassAccordion();
                    await loadAllStudents();
                    markTabCacheValid('students');
                }
            }
        },
        {
            id: 'quests',
            tabId: 'quests-main-tab',
            contentId: 'quests-main-content',
            onShow: async () => {
                if (!isTabCacheValid('quests')) {
                    await renderAllQuestAccordions();
                    markTabCacheValid('quests');
                }
            }
        },
        {
            id: 'classes',
            tabId: 'classes-main-tab',
            contentId: 'classes-main-content',
            onShow: async () => {
                if (!isTabCacheValid('classes')) {
                    await loadClasses();
                    await renderClassManagementView();
                    await renderClassSettingsTable();
                    await loadTeacherClassCode();
                    await initializeFrameworkSelector();
                    markTabCacheValid('classes');
                }
            }
        },
        {
            id: 'analytics',
            tabId: 'analytics-main-tab',
            contentId: 'analytics-main-content',
            onShow: async () => {
                if (!isTabCacheValid('analytics')) {
                    await loadAnalyticsData();
                    markTabCacheValid('analytics');
                }
            }
        },
        {
            id: 'schedule',
            tabId: 'schedule-main-tab',
            contentId: 'schedule-main-content',
            onShow: async () => {
                if (!isTabCacheValid('schedule')) {
                    await loadScheduleData();
                    markTabCacheValid('schedule');
                }
            }
        }
    ];

    const allTabs = tabs.map(t => document.getElementById(t.tabId)).filter(Boolean);
    if (allTabs.length !== tabs.length) return;

    tabs.forEach(tabConfig => {
        const tabBtn = document.getElementById(tabConfig.tabId);
        if (!tabBtn) return;

        tabBtn.addEventListener('click', () => {
            allTabs.forEach(t => t.classList.remove('active'));
            tabBtn.classList.add('active');

            tabs.forEach(t => {
                const content = document.getElementById(t.contentId);
                if (content) content.style.display = 'none';
            });

            const activeContent = document.getElementById(tabConfig.contentId);
            if (activeContent) activeContent.style.display = 'block';

            // Debounce rapid tab switches
            if (_tabSwitchTimeout) clearTimeout(_tabSwitchTimeout);
            _tabSwitchTimeout = setTimeout(async () => {
                if (tabConfig.onShow) await tabConfig.onShow();
            }, 60);
        });
    });
}


// ==========================================================
// 22. DOMContentLoaded BOOTSTRAP
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // Basic buttons
    document.getElementById('teacher-login-btn')?.addEventListener('click', handleTeacherLogin);
    document.getElementById('teacher-logout-btn')?.addEventListener('click', teacherLogout);
    document.getElementById('close-details-btn')?.addEventListener('click', () => {
        document.getElementById('student-details-panel').style.display = 'none';
    });

    // Analytics / class settings
    document.getElementById('export-analytics-btn')?.addEventListener('click', exportAnalyticsToCSV);
    document.getElementById('save-class-settings-btn')?.addEventListener('click', saveAllClassSettings);

    // Invitations
    document.getElementById('invite-student-btn')?.addEventListener('click', openInviteModal);
    document.getElementById('send-invite-btn')?.addEventListener('click', sendInvitation);
    document.getElementById('cancel-invite-btn')?.addEventListener('click', () => {
        document.getElementById('invite-modal').style.display = 'none';
    });
    document.querySelector('#invite-modal .teacher-work-close')?.addEventListener('click', () => {
        document.getElementById('invite-modal').style.display = 'none';
    });
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) inviteModal.style.display = 'none';
        });
    }

    // Class code
    document.getElementById('toggle-code-visibility')?.addEventListener('click', toggleClassCodeVisibility);

    // Print buttons
    document.getElementById('print-student-compact-btn')?.addEventListener('click', () => printStudentProfile(false));
    document.getElementById('print-student-full-btn')?.addEventListener('click', () => printStudentProfile(true));
    document.getElementById('print-all-compact-btn')?.addEventListener('click', printAllProfilesCompact);
    document.getElementById('print-all-full-btn')?.addEventListener('click', printAllProfilesFull);

    // Custom quests
    document.getElementById('create-custom-quest-btn')?.addEventListener('click', openCreateCustomQuestModal);
    document.getElementById('save-custom-quest-btn')?.addEventListener('click', saveCustomQuest);
    document.getElementById('cancel-custom-quest-btn')?.addEventListener('click', () => {
        document.getElementById('create-custom-quest-modal').style.display = 'none';
    });
    document.querySelector('#create-custom-quest-modal .teacher-work-close')?.addEventListener('click', () => {
        document.getElementById('create-custom-quest-modal').style.display = 'none';
    });
    const customModal = document.getElementById('create-custom-quest-modal');
    if (customModal) {
        customModal.addEventListener('click', (e) => {
            if (e.target === customModal) customModal.style.display = 'none';
        });
    }

    // Add requirement/link buttons
    document.getElementById('add-requirement-btn')?.addEventListener('click', () => {
        const container = document.getElementById('custom-quest-requirements-list');
        const newItem = document.createElement('div');
        newItem.className = 'requirement-item';
        newItem.innerHTML = `<input type="text" class="requirement-input" placeholder="Requirement"><button type="button" class="remove-requirement-btn">✖</button>`;
        container.appendChild(newItem);
        newItem.querySelector('.remove-requirement-btn').addEventListener('click', () => newItem.remove());
    });

    document.getElementById('add-link-btn')?.addEventListener('click', () => {
        const container = document.getElementById('custom-quest-links-list');
        const newItem = document.createElement('div');
        newItem.className = 'link-item';
        newItem.innerHTML = `<input type="text" class="link-type" placeholder="Type"><input type="url" class="link-url" placeholder="URL"><button type="button" class="remove-link-btn">✖</button>`;
        container.appendChild(newItem);
        newItem.querySelector('.remove-link-btn').addEventListener('click', () => newItem.remove());
    });

    // Schedule
    document.getElementById('schedule-class-select')?.addEventListener('change', handleScheduleClassChange);
    document.getElementById('prev-month-btn')?.addEventListener('click', previousMonth);
    document.getElementById('next-month-btn')?.addEventListener('click', nextMonth);

    document.querySelector('#date-modal .teacher-work-close')?.addEventListener('click', closeDateModal);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeDateModal);
    document.getElementById('modal-save-btn')?.addEventListener('click', saveDateModal);
    document.getElementById('modal-delete-btn')?.addEventListener('click', deleteDateModal);

    document.getElementById('modal-status')?.addEventListener('change', () => {
        const reasonGroup = document.getElementById('reason-group');
        reasonGroup.style.display = document.getElementById('modal-status').value === 'no-class' ? 'block' : 'none';
    });

    const dateModal = document.getElementById('date-modal');
    if (dateModal) {
        dateModal.addEventListener('click', (e) => {
            if (e.target === dateModal) closeDateModal();
        });
    }

    document.getElementById('save-weekend-settings')?.addEventListener('click', saveWeekendSettings);
    document.getElementById('save-frequency-settings')?.addEventListener('click', saveFrequencySettings);
    document.getElementById('reset-schedule-btn')?.addEventListener('click', resetScheduleSettings);

    // Delete students
    document.getElementById('delete-students-btn')?.addEventListener('click', toggleDeleteMode);

    // Bulk assign
    document.getElementById('bulk-assign-mode-btn')?.addEventListener('click', toggleBulkAssignMode);
    document.getElementById('bulk-assign-confirm')?.addEventListener('click', confirmBulkAssign);
    document.getElementById('bulk-cancel-btn')?.addEventListener('click', () => {
        bulkAssignMode = false;
        selectedStudentsForBulk.clear();
        renderClassManagementView();
        const bulkBtn = document.getElementById('bulk-assign-mode-btn');
        if (bulkBtn) {
            bulkBtn.classList.remove('active');
            bulkBtn.textContent = '✓ Bulk Assign Students';
        }
    });

    // Create class modal
    document.querySelector('#create-class-modal .teacher-work-close')?.addEventListener('click', () => {
        document.getElementById('create-class-modal').classList.remove('open');
    });
    document.getElementById('create-class-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('create-class-modal')) {
            document.getElementById('create-class-modal').classList.remove('open');
        }
    });

    // Custom quest delete delegation
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-custom-quest-btn')) {
            await deleteCustomQuest(e.target.dataset.questId, e.target.dataset.questTitle);
        }
    });

    // Quest search
    setupQuestSearch();

    // Init subsystems
    initTermsModal();
    setupMainTabs();
    initWorkModal();
    setupModalEscapeHandling();
    setupTeacherForgotPassword();
    setupQuestDetailsTabs();
    setupQuestDetailsClose();
    setupICSImport();
    initArtBattleContests();
    initContestManagement();
    initEditContestModal();
    setupDateRangeTabs();

    // Schedule range buttons
    document.getElementById('add-range-btn')?.addEventListener('click', addDateRange);
    document.getElementById('remove-range-btn')?.addEventListener('click', removeDateRange);
    document.getElementById('add-no-class-btn')?.addEventListener('click', addNoClassDay);
    document.getElementById('import-ics-btn')?.addEventListener('click', () => {
        // handled in setupICSImport
    });

    // PDF contest
    document.getElementById('save-results-pdf-btn')?.addEventListener('click', () => {
        if (currentContestId) generateResultsPDF(currentContestId);
    });

    // Student tab sub-tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.teacher-tab-content').forEach(tab => { tab.style.display = 'none'; });
            const activeTab = document.getElementById(`${tabId}-tab`);
            if (activeTab) activeTab.style.display = 'block';
        });
    });

    // Boot
    checkExistingSession();
});


// ==========================================================
// QUEST SEARCH (kept at end — self-contained)
// ==========================================================

function setupQuestSearch() {
    const searchInput = document.getElementById('quest-search-input');
    const resultsContainer = document.getElementById('quest-search-results');
    if (!searchInput || !resultsContainer) return;

    let searchTimeout = null;

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTimeout) clearTimeout(searchTimeout);

        if (searchTerm.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            showAllQuestAccordions();
            return;
        }

        searchTimeout = setTimeout(async () => {
            await performQuestSearch(searchTerm);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.quest-search-container')) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function performQuestSearch(searchTerm) {
    const resultsContainer = document.getElementById('quest-search-results');
    if (!resultsContainer) return;

    const allQuests = await getAllQuestsForTeacher();
    const results = [];

    for (const [questId, quest] of Object.entries(allQuests)) {
        if (!quest || !quest.title) continue;
        if (quest.title.toLowerCase().includes(searchTerm)) {
            results.push({
                id: questId,
                title: quest.title,
                path: Array.isArray(quest.path) ? quest.path.join(', ') : quest.path || 'Unknown',
                isMVP: quest.style === 'mvp',
                isCustom: quest.is_custom === true
            });
        }
    }

    results.sort((a, b) => a.title.localeCompare(b.title));

    if (results.length === 0) {
        resultsContainer.innerHTML = `<div class="no-results">No quests found matching "${searchTerm}"</div>`;
        resultsContainer.style.display = 'block';
        hideAllQuestAccordions();
        return;
    }

    let html = '';
    results.forEach(result => {
        const badge = result.isMVP ? '<span class="search-result-badge mvp">👑 MVP</span>' :
                      result.isCustom ? '<span class="search-result-badge">📝 Custom</span>' : '';
        html += `
            <div class="search-result-item" data-quest-id="${result.id}">
                <div>
                    <span class="search-result-title">${escapeHtml(result.title)}</span>
                    <div class="search-result-path">${escapeHtml(result.path)}</div>
                </div>
                ${badge}
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
    hideAllQuestAccordions();

    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', async function() {
            const questId = this.dataset.questId;
            if (questId) {
                resultsContainer.style.display = 'none';
                const allQuests = await getAllQuestsForTeacher();
                openQuestDetailsPanel(questId, allQuests);
            }
        });
    });
}

function hideAllQuestAccordions() {
    const container = document.getElementById('quests-accordion-container');
    if (container) container.querySelectorAll('.quest-accordion-item').forEach(item => item.style.display = 'none');
}

function showAllQuestAccordions() {
    const container = document.getElementById('quests-accordion-container');
    if (container) container.querySelectorAll('.quest-accordion-item').forEach(item => item.style.display = 'block');
}


// ==========================================================
// SCHEDULE RANGE TABS + ICS IMPORT (kept at end)
// ==========================================================

function setupDateRangeTabs() {
    const singleDayTab = document.getElementById('single-day-tab');
    const addRangeTab = document.getElementById('add-range-tab');
    const removeRangeTab = document.getElementById('remove-range-tab');
    const singleDayForm = document.getElementById('single-day-form');
    const addRangeForm = document.getElementById('add-range-form');
    const removeRangeForm = document.getElementById('remove-range-form');

    if (singleDayTab) {
        singleDayTab.addEventListener('click', () => {
            singleDayTab.classList.add('active');
            addRangeTab.classList.remove('active');
            removeRangeTab.classList.remove('active');
            singleDayForm.style.display = 'flex';
            addRangeForm.style.display = 'none';
            removeRangeForm.style.display = 'none';
        });
    }
    if (addRangeTab) {
        addRangeTab.addEventListener('click', () => {
            addRangeTab.classList.add('active');
            singleDayTab.classList.remove('active');
            removeRangeTab.classList.remove('active');
            singleDayForm.style.display = 'none';
            addRangeForm.style.display = 'flex';
            removeRangeForm.style.display = 'none';
        });
    }
    if (removeRangeTab) {
        removeRangeTab.addEventListener('click', () => {
            removeRangeTab.classList.add('active');
            singleDayTab.classList.remove('active');
            addRangeTab.classList.remove('active');
            singleDayForm.style.display = 'none';
            addRangeForm.style.display = 'none';
            removeRangeForm.style.display = 'flex';
        });
    }
}

async function addNoClassDay() {
    const dateInput = document.getElementById('no-class-date');
    const reasonInput = document.getElementById('no-class-reason');
    const applyToAllCheckbox = document.getElementById('apply-to-all-classes');

    const dateValue = dateInput.value;
    const reason = reasonInput.value.trim();
    const applyToAll = applyToAllCheckbox.checked;

    if (!dateValue) { alert('Please select a date.'); return; }
    if (!reason) { alert('Please enter a reason.'); return; }
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    let classesToUpdate = [];
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes').select('id').eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    for (const classId of classesToUpdate) {
        const { data: existing } = await window.supabase
            .from('class_schedule_overrides')
            .select('id').eq('class_id', classId).eq('date', dateValue).maybeSingle();

        if (existing) {
            await window.supabase
                .from('class_schedule_overrides')
                .update({ is_class_day: false, reason, apply_to_all_classes: applyToAll })
                .eq('id', existing.id);
        } else {
            await window.supabase
                .from('class_schedule_overrides')
                .insert({ class_id: classId, date: dateValue, is_class_day: false, reason, apply_to_all_classes: applyToAll });
        }
    }

    dateInput.value = '';
    reasonInput.value = '';
    applyToAllCheckbox.checked = false;

    invalidateTabCache('schedule');
    await loadScheduleData();
}

async function addDateRange() {
    const startDate = document.getElementById('range-start-date').value;
    const endDate = document.getElementById('range-end-date').value;
    const reason = document.getElementById('range-reason').value.trim();
    const applyToAll = document.getElementById('range-apply-to-all-classes').checked;
    const excludeWeekends = document.getElementById('exclude-weekends').checked;

    if (!startDate || !endDate) { alert('Please select both dates.'); return; }
    if (!reason) { alert('Please enter a reason.'); return; }
    if (new Date(startDate) > new Date(endDate)) { alert('Start must be before end.'); return; }
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (!(excludeWeekends && isWeekend)) {
            dates.push(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`);
        }
        current.setDate(current.getDate() + 1);
    }

    if (dates.length === 0) { alert('No dates selected.'); return; }

    let classesToUpdate = [];
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes').select('id').eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    for (const classId of classesToUpdate) {
        for (const dateStr of dates) {
            const { data: existing } = await window.supabase
                .from('class_schedule_overrides')
                .select('id').eq('class_id', classId).eq('date', dateStr).maybeSingle();

            if (existing) {
                await window.supabase
                    .from('class_schedule_overrides')
                    .update({ is_class_day: false, reason, apply_to_all_classes: applyToAll })
                    .eq('id', existing.id);
            } else {
                await window.supabase
                    .from('class_schedule_overrides')
                    .insert({ class_id: classId, date: dateStr, is_class_day: false, reason, apply_to_all_classes: applyToAll });
            }
        }
    }

    document.getElementById('range-start-date').value = '';
    document.getElementById('range-end-date').value = '';
    document.getElementById('range-reason').value = '';
    document.getElementById('range-apply-to-all-classes').checked = false;
    document.getElementById('exclude-weekends').checked = false;

    invalidateTabCache('schedule');
    await loadScheduleData();
    alert(`Added ${dates.length * classesToUpdate.length} no-class day(s).`);
}

async function removeDateRange() {
    const startDate = document.getElementById('remove-range-start').value;
    const endDate = document.getElementById('remove-range-end').value;
    const removeFromAll = document.getElementById('remove-from-all-classes').checked;
    const excludeWeekends = document.getElementById('remove-exclude-weekends').checked;

    if (!startDate || !endDate) { alert('Please select both dates.'); return; }
    if (new Date(startDate) > new Date(endDate)) { alert('Start must be before end.'); return; }
    if (!currentScheduleClassId) { alert('Please select a class first.'); return; }

    const auth = await checkTeacherAuth();
    if (!auth) return;

    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (!(excludeWeekends && isWeekend)) {
            dates.push(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`);
        }
        current.setDate(current.getDate() + 1);
    }

    let classesToUpdate = [];
    if (removeFromAll) {
        const { data: allClasses } = await window.supabase
            .from('classes').select('id').eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    if (!confirm(`Remove ${dates.length} day(s) from ${classesToUpdate.length} class(es)?`)) return;

    for (const classId of classesToUpdate) {
        for (const dateStr of dates) {
            await window.supabase
                .from('class_schedule_overrides')
                .delete()
                .eq('class_id', classId)
                .eq('date', dateStr);
        }
    }

    document.getElementById('remove-range-start').value = '';
    document.getElementById('remove-range-end').value = '';
    document.getElementById('remove-from-all-classes').checked = false;
    document.getElementById('remove-exclude-weekends').checked = false;

    invalidateTabCache('schedule');
    await loadScheduleData();
    alert(`Removed settings for ${dates.length} day(s).`);
}

function setupICSImport() {
    const importBtn = document.getElementById('import-ics-btn');
    const fileInput = document.getElementById('ics-file-input');
    if (!importBtn || !fileInput) return;

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!currentScheduleClassId) { alert('Please select a class first.'); fileInput.value = ''; return; }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const events = parseICS(event.target.result);
            if (events.length === 0) { alert('No events found.'); fileInput.value = ''; return; }

            const noClassEvents = events.filter(ev => {
                const s = (ev.summary || '').toLowerCase();
                const d = (ev.description || '').toLowerCase();
                const keywords = ['holiday', 'break', 'vacation', 'no school', 'off', 'closed'];
                return keywords.some(k => s.includes(k) || d.includes(k));
            });

            if (noClassEvents.length === 0) { alert('No holiday events found.'); fileInput.value = ''; return; }

            const applyToAll = confirm(`Import ${noClassEvents.length} event(s)? Click OK for ALL classes, Cancel for current only.`);
            await importICSEvents(noClassEvents, applyToAll);
            fileInput.value = '';
        };
        reader.readAsText(file);
    });
}

function parseICS(icsContent) {
    const events = [];
    const lines = icsContent.split(/\r?\n/);
    let currentEvent = {};
    let inEvent = false;

    for (let line of lines) {
        line = line.trim();
        if (line === 'BEGIN:VEVENT') { inEvent = true; currentEvent = {}; }
        else if (line === 'END:VEVENT') {
            inEvent = false;
            if (currentEvent.startDate) events.push(currentEvent);
        } else if (inEvent) {
            if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
            else if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
            else if (line.startsWith('DTSTART')) {
                const ds = line.split(':')[1];
                if (ds && ds.length >= 8) currentEvent.startDate = `${ds.substring(0,4)}-${ds.substring(4,6)}-${ds.substring(6,8)}`;
            } else if (line.startsWith('DTEND')) {
                const ds = line.split(':')[1];
                if (ds && ds.length >= 8) currentEvent.endDate = `${ds.substring(0,4)}-${ds.substring(4,6)}-${ds.substring(6,8)}`;
            }
        }
    }

    const expanded = [];
    for (const ev of events) {
        if (ev.startDate && ev.endDate) {
            const start = new Date(ev.startDate);
            const end = new Date(ev.endDate);
            const cur = new Date(start);
            while (cur <= end) {
                expanded.push({
                    date: `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`,
                    reason: ev.summary || ev.description || 'Imported'
                });
                cur.setDate(cur.getDate() + 1);
            }
        } else if (ev.startDate) {
            expanded.push({ date: ev.startDate, reason: ev.summary || ev.description || 'Imported' });
        }
    }
    return expanded;
}

async function importICSEvents(events, applyToAll) {
    const auth = await checkTeacherAuth();
    if (!auth) return;

    let classesToUpdate = [];
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes').select('id').eq('teacher_id', auth.teacher.id);
        classesToUpdate = (allClasses || []).map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }

    for (const classId of classesToUpdate) {
        for (const ev of events) {
            const { data: existing } = await window.supabase
                .from('class_schedule_overrides')
                .select('id').eq('class_id', classId).eq('date', ev.date).maybeSingle();

            if (existing) {
                await window.supabase
                    .from('class_schedule_overrides')
                    .update({ is_class_day: false, reason: ev.reason, apply_to_all_classes: applyToAll })
                    .eq('id', existing.id);
            } else {
                await window.supabase
                    .from('class_schedule_overrides')
                    .insert({ class_id: classId, date: ev.date, is_class_day: false, reason: ev.reason, apply_to_all_classes: applyToAll });
            }
        }
    }

    invalidateTabCache('schedule');
    await loadScheduleData();
    alert(`Imported ${events.length} event(s).`);
}


// ==========================================================
// STUB (referenced but not defined elsewhere)
// ==========================================================

async function generateResultsPDF(contestId) {
    // Placeholder — original implementation left empty
    alert("PDF generation coming soon.");
}

// Also referenced in DOMContentLoaded but not defined in original:
async function viewStudentWork(userId, questId) {
    try {
        const { data: work, error } = await window.supabase
            .from('student_works')
            .select('*')
            .eq('user_id', userId)
            .eq('quest_id', questId)
            .maybeSingle();

        if (error || !work) {
            alert("No work found for this quest.");
            return;
        }

        const modal = document.getElementById('teacher-work-modal');
        const content = document.getElementById('teacher-work-content');
        if (!modal || !content) return;

        const allQuests = await getAllQuestsForTeacher();
        const quest = allQuests[questId];
        const questTitle = quest?.title || questId;

        content.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <h3 style="color: #ffd700;">${escapeHtml(work.title || questTitle)}</h3>
                <div class="teacher-work-details">
                    <p><strong>Quest:</strong> ${escapeHtml(questTitle)}</p>
                    <p><strong>Uploaded:</strong> ${work.uploaded_at ? new Date(work.uploaded_at).toLocaleString() : 'Unknown'}</p>
                    <p><strong>Status:</strong> ${work.grading_status === 'graded' ? '✅ Graded' : '⏳ Pending'}</p>
                </div>
                <p><strong>Description:</strong><br>${escapeHtml(work.description || 'No description')}</p>
                ${work.image_url ? `<div class="teacher-work-image" style="margin-top: 15px;"><img src="${work.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;"></div>` : ''}
            </div>
        `;

        modal.style.display = 'flex';

        const closeBtn = modal.querySelector('.teacher-work-close');
        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
    } catch (err) {
        console.error("Error viewing student work:", err);
        alert("Error loading student work.");
    }
}
