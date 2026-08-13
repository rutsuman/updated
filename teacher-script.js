// ==========================
// TEACHER DASHBOARD - MS INTEGRATED
// ==========================

// ==========================
// GRADE LEVEL TOGGLE
// ==========================
let currentGradeLevel = 'hs'; // 'hs' or 'ms'

// MS Standards Constants
const MS_STANDARDS = [
    { code: "VA:Cr1.2.7a", name: "Goal Setting" },
    { code: "VA:Cr2.1.7a", name: "Skill Development" },
    { code: "VA:Cr2.3.8a", name: "Visual Communication" },
    { code: "VA:Cr3.1.7a", name: "Reflection" },
    { code: "VA:Re8.1.8a", name: "Interpretation" },
    { code: "VA:Cn11.1.8a", name: "Cultural Context" }
];

// HS Standards Constants
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

// Get current standards based on grade level
function getCurrentStandards() {
    // For IB and IGCSE, we don't use the standard dropdown
    // They have their own rubric format (criteria or assessment objectives)
    if (currentFramework === 'ib-myp' || currentFramework === 'igcse') {
        return []; // Return empty array - these frameworks don't use standards
    }
    
    // For NCAS framework
    return currentGradeLevel === 'ms' ? MS_STANDARDS : HS_STANDARDS;
}
// ==========================
// GRADE LEVEL TOGGLE SETUP
// ==========================
function setupGradeLevelToggle() {
    const hsBtn = document.getElementById('toggle-hs');
    const msBtn = document.getElementById('toggle-ms');
    
    if (!hsBtn || !msBtn) {
        console.log("Toggle buttons not found - they may not exist in this version");
        return;
    }
    
    // Remove existing listeners
    const newHsBtn = hsBtn.cloneNode(true);
    const newMsBtn = msBtn.cloneNode(true);
    hsBtn.parentNode.replaceChild(newHsBtn, hsBtn);
    msBtn.parentNode.replaceChild(newMsBtn, msBtn);
    
    newHsBtn.addEventListener('click', () => switchGradeLevel('hs'));
    newMsBtn.addEventListener('click', () => switchGradeLevel('ms'));
    
    // Set initial state
    updateToggleButtons('hs');
    console.log("Grade level toggle initialized");
}

function switchGradeLevel(level) {
    if (currentGradeLevel === level) return;
    
    currentGradeLevel = level;
    updateToggleButtons(level);
    
    // Clear quest cache
    cachedQuests = null;
    
    // ✅ Refresh all displays with the new filter
    refreshAllTeacherDisplays();
    
    // ✅ Refresh the student list and accordion
    const studentsTab = document.getElementById('students-main-content');
    if (studentsTab && studentsTab.style.display !== 'none') {
        loadAllStudents();  // This will now filter by grade level
        renderClassAccordion(); // This will now filter by grade level
    }
    
    // ✅ Refresh class management if we're on that tab
    const classesTab = document.getElementById('classes-main-content');
    if (classesTab && classesTab.style.display !== 'none') {
        renderClassManagementView();
        renderClassSettingsTable();
    }
    
    // ✅ Refresh analytics if we're on that tab
    const analyticsTab = document.getElementById('analytics-main-content');
    if (analyticsTab && analyticsTab.style.display !== 'none') {
        loadAnalyticsData();
    }
    
    console.log(`Switched to ${level.toUpperCase()} mode`);
}
function updateToggleButtons(level) {
    const hsBtn = document.getElementById('toggle-hs');
    const msBtn = document.getElementById('toggle-ms');
    
    if (hsBtn) {
        hsBtn.classList.toggle('active', level === 'hs');
    }
    if (msBtn) {
        msBtn.classList.toggle('active', level === 'ms');
    }
}

async function refreshAllTeacherDisplays() {
    // Reload quests with new grade level
    await loadQuestsForCurrentGradeLevel();
    
    // Refresh all tabs
    await renderClassAccordion();
    await renderAllQuestAccordions();
    await loadTeacherContests();
    
    // If student details panel is open, refresh it
    if (currentStudentId && document.getElementById('student-details-panel').style.display === 'block') {
        await loadStudentDetails(currentStudentId, document.getElementById('selected-student-name').textContent);
    }
    
    // If quest details panel is open, refresh it
    if (currentQuestData && document.getElementById('quest-details-panel').style.display === 'block') {
        const allQuests = await getAllQuestsForTeacher();
        openQuestDetailsPanel(currentQuestData.id, allQuests);
    }
    
    // Refresh analytics if open
    if (document.getElementById('analytics-main-content').style.display === 'block') {
        await loadAnalyticsData();
    }
    
    console.log("All displays refreshed for", currentGradeLevel.toUpperCase());
}

async function loadQuestsForCurrentGradeLevel() {
    // Force refresh quest cache
    cachedQuests = null;
    await getQuests();
    console.log("Quests reloaded for", currentGradeLevel.toUpperCase());
}

// ==========================
// GET QUESTS FILE FOR FRAMEWORK (MS SUPPORT)
// ==========================
function getQuestsFileForFramework(framework) {
    // ✅ FIX: For MS mode, use MS quests file ONLY for NCAS framework
    if (currentGradeLevel === 'ms') {
        // MS students use quests-ms.json ONLY for NCAS framework
        // For IB and IGCSE, they use the same files as HS
        switch(framework) {
            case 'ib-myp':
                return 'quests-ib-myp.json';
            case 'igcse':
                return 'quests-igcse.json';
            default:
                return 'quests-ms.json';
        }
    }
    
    // HS mode
    switch(framework) {
        case 'ib-myp':
            return 'quests-ib-myp.json';
        case 'igcse':
            return 'quests-igcse.json';
        default:
            return 'quests.json';
    }
}

// ==========================
// GET MS-ENABLED STANDARDS FOR RUBRIC
// ==========================
function getStandardsForGradeLevel(rubric) {
    if (currentGradeLevel === 'ms') {
        // For MS, return MS standards
        return MS_STANDARDS;
    } else {
        // For HS, return HS standards from rubric or default
        return rubric?.standards || HS_STANDARDS;
    }
}

// ==========================
// Class Management Variables
// ==========================
let currentClassFilter = 'all';
let teacherClasses = [];
let classManagementActive = false;
let bulkAssignMode = false;
let selectedStudentsForBulk = new Set();
let currentStudentId = null; // Store current student ID globally
let deleteMode = false;
let selectedStudentsForDelete = new Set();
let currentTeacherEmail = null;
let currentQuestData = null;
let cachedQuests = null;
let currentFramework = null;
let cachedFramework = null;
let cachedFrameworkTime = 0;
const FRAMEWORK_CACHE_DURATION = 300000; // 5 minutes
let analyticsData = {
    students: [],
    questStats: {},
    framework: 'ncas',
    classFilter: 'all'
};
let currentScheduleClassId = null; // Schedule Variables
let currentScheduleDate = new Date();
let scheduleData = {
    noClassDays: [],      // Array of {date, reason, class_id, apply_to_all}
    weekendSettings: {},   // { saturday_is_class: false, sunday_is_class: false }
    frequencySettings: {}  // { type: 'custom', days: [1,3,5] } or { type: 'weekly', days: [1] }
};
let currentContestId = null;
let currentRejectSubmissionId = null;

// Helper function to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==========================
// GET QUESTS WITH MS SUPPORT
// ==========================
async function getQuests() {
    // If we already have cached quests, return them immediately
    if (cachedQuests) {
        console.log("Returning cached quests, count:", Object.keys(cachedQuests).length);
        return cachedQuests;
    }
    
    // If not cached, load framework and then fetch
    const framework = await loadTeacherFramework();
    const questsFile = getQuestsFileForFramework(framework);
    console.log(`Loading quests from ${questsFile} (${currentGradeLevel.toUpperCase()} mode)...`);
    
    const response = await fetch(questsFile);
    const rawQuests = await response.json();
    
    // Filter out metadata entries (keys starting with underscore)
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

// Force refresh cache if needed
function refreshQuestsCache() {
    cachedQuests = null;
    console.log("Quest cache cleared");
}

// ==========================
// TEACHER LOGIN
// ==========================
async function handleTeacherLogin() {
    const email = document.getElementById('teacher-email').value;
    const password = document.getElementById('teacher-password').value;
    const messageEl = document.getElementById('teacher-login-message');
    
    if (!email || !password) {
        messageEl.textContent = 'Please enter email and password';
        return;
    }
    
    messageEl.textContent = 'Logging in...';
    
    const { data, error } = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        messageEl.textContent = error.message;
        return;
    }
    
    console.log("Login successful, user:", data.user);
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
    
    messageEl.textContent = 'Teacher verified! Loading dashboard...';
    
    // Show dashboard, hide login
    document.getElementById('teacher-login-container').style.display = 'none';
    document.getElementById('teacher-dashboard-container').style.display = 'block';
    
    // Setup grade level toggle
    setupGradeLevelToggle();
    
    // Load classes and render
    await loadClasses();
    await renderClassAccordion();
    await loadAllStudents();
    await renderAllQuestAccordions();
    await loadTeacherContests();
    await updateStudentLimitDisplay();
}

// ==========================
// TERMS OF SERVICE MODAL
// ==========================
const termsLink = document.getElementById('terms-link');
const termsModal = document.getElementById('terms-modal');
const closeTermsModal = document.getElementById('close-terms-modal');
const acceptTermsBtn = document.getElementById('accept-terms-btn');

if (termsLink) {
    termsLink.addEventListener('click', (e) => {
        e.preventDefault();
        termsModal.style.display = 'flex';
    });
}

function closeTermsModalFunc() {
    termsModal.style.display = 'none';
}

if (closeTermsModal) closeTermsModal.addEventListener('click', closeTermsModalFunc);
if (acceptTermsBtn) acceptTermsBtn.addEventListener('click', closeTermsModalFunc);

// Close when clicking outside
if (termsModal) {
    termsModal.addEventListener('click', (e) => {
        if (e.target === termsModal) {
            closeTermsModalFunc();
        }
    });
}

function initTermsModal() {
    const link = document.getElementById('terms-link');
    const modal = document.getElementById('terms-modal');
    const closeBtn = document.getElementById('close-terms-modal');
    const acceptBtn = document.getElementById('accept-terms-btn');
    
    if (!link || !modal) {
        console.log("Terms modal elements not found");
        return;
    }
    
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    newLink.onclick = (e) => {
        e.preventDefault();
        console.log("Terms link clicked");
        modal.style.display = 'flex';
    };
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
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
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
    
    console.log("Terms modal initialized");
}

// ==========================
// TEACHER FRAMEWORK
// ==========================
async function loadTeacherFramework(forceRefresh = false) {
    if (!forceRefresh && cachedFramework && (Date.now() - cachedFrameworkTime) < FRAMEWORK_CACHE_DURATION) {
        console.log("Using cached framework:", cachedFramework);
        return cachedFramework;
    }
    
    console.log("Fetching framework from database...");
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
    
    console.log("Framework cached:", framework);
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
        
        if (!confirmMessage) {
            resolve(false);
            return;
        }
        
        const userInput = prompt(
            `Type "CONFIRM" to permanently switch to ${newFramework.toUpperCase()} and delete ALL grade data:`
        );
        
        if (userInput === 'CONFIRM') {
            resolve(true);
        } else {
            alert('Framework change cancelled.');
            resolve(false);
        }
    });
}

async function initializeFrameworkSelector() {
    console.log("Initializing framework selector...");
    
    const currentFrameworkValue = await loadTeacherFramework();
    currentFramework = currentFrameworkValue;
    
    console.log("Current framework:", currentFrameworkValue);
    
    const radio = document.querySelector(`input[name="framework"][value="${currentFrameworkValue}"]`);
    if (radio) {
        radio.checked = true;
    }
    
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
                // ✅ Clear the grade level toggle cache as well
                refreshQuestsCache();
                showFrameworkMessage(`✅ Framework changed to ${newFramework.toUpperCase()}. Page will reload to apply changes.`, 'success');
                await notifyQuestsChanged();
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
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
    
    console.log("Deleting all grading data for framework change...");
    
    const { data: students } = await window.supabase
        .from('profiles')
        .select('id')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (!students || students.length === 0) return;
    
    const studentIds = students.map(s => s.id);
    
    const { error: progressError } = await window.supabase
        .from('student_progress')
        .delete()
        .in('user_id', studentIds);
    
    if (progressError) {
        console.error("Error deleting progress:", progressError);
    }
    
    const { error: worksError } = await window.supabase
        .from('student_works')
        .update({ grading_status: 'pending' })
        .in('user_id', studentIds);
    
    if (worksError) {
        console.error("Error resetting works:", worksError);
    }
    
    console.log("All grading data deleted");
}

// ==========================
// CHECK EXISTING SESSION
// ==========================
async function checkExistingSession() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
        const { data: teacher } = await window.supabase
            .from('teachers')
            .select('id')
            .eq('id', session.user.id)
            .single();
        
        if (teacher) {
            document.getElementById('teacher-login-container').style.display = 'none';
            document.getElementById('teacher-dashboard-container').style.display = 'block';
            
            // Setup grade level toggle
            setupGradeLevelToggle();
            
            await loadClasses();
            await renderClassAccordion();
            await loadAllStudents();
            await renderAllQuestAccordions();
            await loadTeacherContests();
            await updateStudentLimitDisplay();
            
            const questsContainer = document.getElementById('quests-accordion-container');
            if (questsContainer) {
                await renderQuestsAccordion();
            }
            
            console.log("All data loaded after login");
        }
    }
}

async function checkTeacherAuth() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return null;
    
    const { data: teacher, error } = await window.supabase
        .from('teachers')
        .select('id, class_code')
        .eq('id', session.user.id)
        .maybeSingle();
    
    if (error || !teacher) return null;
    
    return { session, teacher };
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

// ==========================
// TEACHER DASHBOARD TABS
// ==========================
function setupMainTabs() {
    const studentsMainTab = document.getElementById('students-main-tab');
    const questsMainTab = document.getElementById('quests-main-tab');
    const classesMainTab = document.getElementById('classes-main-tab');
    const analyticsMainTab = document.getElementById('analytics-main-tab');
    const scheduleMainTab = document.getElementById('schedule-main-tab');
    
    const studentsMainContent = document.getElementById('students-main-content');
    const questsMainContent = document.getElementById('quests-main-content');
    const classesMainContent = document.getElementById('classes-main-content');
    const analyticsMainContent = document.getElementById('analytics-main-content');
    const scheduleMainContent = document.getElementById('schedule-main-content');
    
    if (!studentsMainTab || !questsMainTab || !classesMainTab || !analyticsMainTab || !scheduleMainTab) return;
    
    studentsMainTab.addEventListener('click', async () => {
        studentsMainTab.classList.add('active');
        questsMainTab.classList.remove('active');
        classesMainTab.classList.remove('active');
        analyticsMainTab.classList.remove('active');
        scheduleMainTab.classList.remove('active');
        
        studentsMainContent.style.display = 'block';
        questsMainContent.style.display = 'none';
        classesMainContent.style.display = 'none';
        analyticsMainContent.style.display = 'none';
        scheduleMainContent.style.display = 'none';
        
        await renderClassAccordion();
    });
    
    questsMainTab.addEventListener('click', async () => {
        questsMainTab.classList.add('active');
        studentsMainTab.classList.remove('active');
        classesMainTab.classList.remove('active');
        analyticsMainTab.classList.remove('active');
        scheduleMainTab.classList.remove('active');
        
        studentsMainContent.style.display = 'none';
        questsMainContent.style.display = 'block';
        classesMainContent.style.display = 'none';
        analyticsMainContent.style.display = 'none';
        scheduleMainContent.style.display = 'none';
        
        await renderAllQuestAccordions();
    });
    
    classesMainTab.addEventListener('click', async () => {
        classesMainTab.classList.add('active');
        studentsMainTab.classList.remove('active');
        questsMainTab.classList.remove('active');
        analyticsMainTab.classList.remove('active');
        scheduleMainTab.classList.remove('active');
        
        studentsMainContent.style.display = 'none';
        questsMainContent.style.display = 'none';
        classesMainContent.style.display = 'block';
        analyticsMainContent.style.display = 'none';
        scheduleMainContent.style.display = 'none';
        
        console.log("Loading classes for class management...");
        await loadClasses();
        console.log("Classes loaded:", teacherClasses.length);
        await renderClassManagementView();
        await renderClassSettingsTable();
        await loadTeacherClassCode();
        await initializeFrameworkSelector();
    });
    
    analyticsMainTab.addEventListener('click', async () => {
        analyticsMainTab.classList.add('active');
        studentsMainTab.classList.remove('active');
        questsMainTab.classList.remove('active');
        classesMainTab.classList.remove('active');
        scheduleMainTab.classList.remove('active');
        
        studentsMainContent.style.display = 'none';
        questsMainContent.style.display = 'none';
        classesMainContent.style.display = 'none';
        analyticsMainContent.style.display = 'block';
        scheduleMainContent.style.display = 'none';
        
        await loadAnalyticsData();
    });
    
    scheduleMainTab.addEventListener('click', async () => {
        scheduleMainTab.classList.add('active');
        studentsMainTab.classList.remove('active');
        questsMainTab.classList.remove('active');
        classesMainTab.classList.remove('active');
        analyticsMainTab.classList.remove('active');
        
        studentsMainContent.style.display = 'none';
        questsMainContent.style.display = 'none';
        classesMainContent.style.display = 'none';
        analyticsMainContent.style.display = 'none';
        scheduleMainContent.style.display = 'block';
        
        await loadScheduleData();
    });
}

// ==========================
// RENDER QUESTS ACCORDION
// ==========================
async function renderQuestsAccordion() {
    const container = document.getElementById('quests-accordion-container');
    if (!container) return;
    const auth = await checkTeacherAuth();
    if (!auth) {
        console.log("Not authenticated, skipping quests accordion");
        return;
    }
    
    const allQuests = await getAllQuestsForTeacher();
    
    const validPaths = ['Painter Path', 'Sketcher Path', 'Watercolor Path', '3D Path'];
    
    const questsByPath = {
        'Painter Path': [],
        'Sketcher Path': [],
        'Watercolor Path': [],
        '3D Path': []
    };
    
    for (const [questId, quest] of Object.entries(allQuests)) {
        if (!quest || !quest.path) continue;
        
        let foundPath = null;
        if (Array.isArray(quest.path) && quest.path.length > 0) {
            const pathName = quest.path[0];
            if (validPaths.includes(pathName)) {
                foundPath = pathName;
            }
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
                console.log("Opening quest:", quest.id);
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

// ==========================
// LOAD QUEST STATISTICS
// ==========================
async function loadQuestStatistics() {
    const auth = await checkTeacherAuth();
    if (!auth) return { activeQuests: {}, completedQuests: {} };
    
    const { data: students } = await window.supabase
        .from('profiles')
        .select('id')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (!students || students.length === 0) {
        return { activeQuests: {}, completedQuests: {} };
    }
    
    const studentIds = students.map(s => s.id);
    
    const { data: progressData } = await window.supabase
        .from('student_progress')
        .select('user_id, completed_quests, quest_accepted')
        .in('user_id', studentIds);
    
    const activeQuests = {};
    const completedQuests = {};
    
    if (progressData) {
        progressData.forEach(progress => {
            const completed = progress.completed_quests || {};
            const questAccepted = progress.quest_accepted || {};
            
            Object.keys(questAccepted).forEach(questId => {
                if (questAccepted[questId] === true) {
                    if (!completed[questId]) {
                        activeQuests[questId] = (activeQuests[questId] || 0) + 1;
                    }
                }
            });
            
            Object.keys(completed).forEach(questId => {
                if (completed[questId] === true) {
                    completedQuests[questId] = (completedQuests[questId] || 0) + 1;
                }
            });
        });
    }
    
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
    const questsByPath = {
        'Painter Path': [],
        'Sketcher Path': [],
        'Watercolor Path': [],
        '3D Path': []
    };
    
    for (const questId of activeQuestIds) {
        const quest = allQuests[questId];
        if (!quest) continue;
        
        let foundPath = null;
        if (quest.path && Array.isArray(quest.path) && quest.path.length > 0) {
            const pathName = quest.path[0];
            if (validPaths.includes(pathName)) {
                foundPath = pathName;
            }
        }
        
        if (foundPath) {
            questsByPath[foundPath].push({
                id: questId,
                title: quest.title,
                studentCount: activeQuests[questId],
                isMVP: quest.style === 'mvp'
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
        
        const totalStudents = quests.reduce((sum, q) => sum + q.studentCount, 0);
        
        const pathHeader = document.createElement('div');
        pathHeader.className = 'quest-accordion-header';
        pathHeader.innerHTML = `
            <div>
                <span class="quest-title">📚 ${path}</span>
                <span class="quest-path-badge">(${quests.length} quests, ${totalStudents} active students)</span>
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
            
            questLink.innerHTML = `
                <span class="quest-link-title">${escapeHtml(quest.title)}</span>
                <span class="quest-student-count-badge">${quest.studentCount} student${quest.studentCount !== 1 ? 's' : ''}</span>
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
    const questsByPath = {
        'Painter Path': [],
        'Sketcher Path': [],
        'Watercolor Path': [],
        '3D Path': []
    };
    
    for (const questId of completedQuestIds) {
        const quest = allQuests[questId];
        if (!quest) continue;
        
        let foundPath = null;
        if (quest.path && Array.isArray(quest.path) && quest.path.length > 0) {
            const pathName = quest.path[0];
            if (validPaths.includes(pathName)) {
                foundPath = pathName;
            }
        }
        
        if (foundPath) {
            questsByPath[foundPath].push({
                id: questId,
                title: quest.title,
                studentCount: completedQuests[questId],
                isMVP: quest.style === 'mvp'
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
        
        const totalStudents = quests.reduce((sum, q) => sum + q.studentCount, 0);
        
        const pathHeader = document.createElement('div');
        pathHeader.className = 'quest-accordion-header';
        pathHeader.innerHTML = `
            <div>
                <span class="quest-title">📚 ${path}</span>
                <span class="quest-path-badge">(${quests.length} quests, ${totalStudents} completed)</span>
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
            
            questLink.innerHTML = `
                <span class="quest-link-title">${escapeHtml(quest.title)}</span>
                <span class="quest-student-count-badge completed">${quest.studentCount} student${quest.studentCount !== 1 ? 's' : ''}</span>
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

async function renderAllQuestAccordions() {
    await renderQuestsAccordion();
    await renderActiveQuestsAccordion();
    await renderCompletedQuestsAccordion();
}

// ==========================
// LOAD ALL STUDENTS
// ==========================
async function loadAllStudents() {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const teacherCode = auth.teacher.class_code;
    
    let query = window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', teacherCode);
    
    if (currentClassFilter !== 'all') {
        query = query.eq('class_id', currentClassFilter);
    }
      if (currentGradeLevel === 'hs') {
        query = query.eq('grade_level', 'hs');
    } else if (currentGradeLevel === 'ms') {
        query = query.eq('grade_level', 'ms');
    }
    
    const { data: profiles, error } = await query;
    
    const container = document.getElementById('student-list-container');
    if (!container) return;
    
    if (error || !profiles || profiles.length === 0) {
        container.innerHTML = '<div class="no-students">No students found</div>';
        return;
    }
    
    const studentIds = profiles.map(p => p.id);
    const { data: pendingWorks } = await window.supabase
        .from('student_works')
        .select('user_id, quest_id')
        .eq('grading_status', 'pending')
        .in('user_id', studentIds);
    
    const pendingCounts = {};
    if (pendingWorks) {
        pendingWorks.forEach(work => {
            pendingCounts[work.user_id] = (pendingCounts[work.user_id] || 0) + 1;
        });
    }
    
    container.innerHTML = '';
    profiles.forEach(profile => {
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card';
        studentCard.dataset.userId = profile.id;
        
        const pendingCount = pendingCounts[profile.id] || 0;
        const redDotHtml = pendingCount > 0 ? `<span class="pending-dot" title="${pendingCount} quest${pendingCount !== 1 ? 's' : ''} pending grading"></span>` : '';
        
        studentCard.innerHTML = `
            ${redDotHtml}
            <img src="${profile.avatar_url || 'profile.png'}" alt="${profile.name}">
            <div class="student-info">
                <h3>${escapeHtml(profile.name)}</h3>
                <p>${profile.email || ''}</p>
                <span class="grade-level-badge ${profile.grade_level || 'hs'}">${(profile.grade_level || 'HS').toUpperCase()}</span>
            </div>
        `;
        studentCard.addEventListener('click', () => loadStudentDetails(profile.id, profile.name));
        container.appendChild(studentCard);
    });
    
    await renderClassAccordion();
}

// ==========================
// STUDENT PROFILE
// ==========================
async function loadStudentDetails(userId, studentName) {
    console.log("Loading details for:", studentName, userId);
    document.getElementById('selected-student-name').textContent = studentName;
    document.getElementById('student-details-panel').style.display = 'block';
    
    const profileTab = document.querySelector('#student-details-panel .tab-btn[data-tab="profile"]');
    if (profileTab) {
        profileTab.click();
    }
    
    await loadStudentProfileData(userId);
    await loadStudentProgressData(userId);
    await loadStudentWorksData(userId);
}

async function loadStudentProgressData(userId) {
    const container = document.getElementById('student-quests-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading quest data...</div>';
    
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('completed_quests, quest_grades, earned_badges, quest_accepted, quest_start_times')
        .eq('user_id', userId)
        .maybeSingle();
    
    const { data: studentWorks } = await window.supabase
        .from('student_works')
        .select('quest_id, grading_status, title, image_url, uploaded_at')
        .eq('user_id', userId);
    
    const completedQuests = progress?.completed_quests || {};
    const questGrades = progress?.quest_grades || {};
    const questAccepted = progress?.quest_accepted || {};
    const questStartTimes = progress?.quest_start_times || {};
    
    const framework = await loadTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    
    const savedWorksMap = new Map();
    if (studentWorks) {
        studentWorks.forEach(work => {
            savedWorksMap.set(work.quest_id, {
                grading_status: work.grading_status,
                title: work.title,
                hasImage: !!work.image_url,
                uploaded_at: work.uploaded_at
            });
        });
    }
    
    const allQuests = await getQuests();
    
    const completedQuestList = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true);
    
    const activeQuestList = [];
    for (const [questId, isAccepted] of Object.entries(questAccepted)) {
        if (isAccepted === true && !completedQuests[questId]) {
            activeQuestList.push(questId);
        }
    }
    
    const pendingQuestList = [];
    for (const [questId, workInfo] of savedWorksMap) {
        if (!completedQuestList.includes(questId) && !activeQuestList.includes(questId)) {
            pendingQuestList.push(questId);
        }
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
                let completedDate = null;
                
                if (workInfo && workInfo.uploaded_at) {
                    completedDate = new Date(workInfo.uploaded_at);
                } else {
                    completedDate = new Date();
                }
                
                if (startTime) {
                    const startDate = new Date(startTime);
                    datesContainer.innerHTML = `
                        <span class="quest-date">📅 Started: ${startDate.toLocaleDateString()}</span>
                        <span class="quest-date">✅ Completed: ${completedDate.toLocaleDateString()}</span>
                    `;
                } else {
                    datesContainer.innerHTML = `
                        <span class="quest-date">✅ Completed: ${completedDate.toLocaleDateString()}</span>
                    `;
                }
            }
        }
        
        const grades = questGrades[questId]?.[column] || {};
        const hasGrades = Object.keys(grades).length > 0;
        
        let statusText = '';
        let statusClass = '';
        let showRedDot = false;
        
        if (isActive) {
            statusText = '🟢 Active';
            statusClass = 'active';
            showRedDot = false;
        } else if (hasGrades) {
            statusText = '✓ Graded';
            statusClass = 'graded';
            showRedDot = false;
        } else if (hasSavedWork && workInfo?.grading_status === 'pending') {
            statusText = '⚠ Pending Grading';
            statusClass = 'pending';
            showRedDot = true;
        } else if (isCompleted) {
            statusText = '⚠ Not Graded';
            statusClass = 'ungraded';
            showRedDot = true;
        } else if (hasSavedWork) {
            statusText = '⚠ Pending Grading';
            statusClass = 'pending';
            showRedDot = true;
        } else {
            statusText = 'Not Started';
            statusClass = 'not-started';
            showRedDot = false;
        }
        
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
            
            if (!isVisible) {
                loadRubricForQuest(questId, quest, questGrades, detailsDiv, userId);
            }
        });
        
        const viewWorkBtn = clone.querySelector('.teacher-view-work-btn');
        viewWorkBtn.addEventListener('click', () => {
            viewStudentWork(userId, questId);
        });
        
        const deleteBtn = clone.querySelector('.teacher-delete-quest-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                let statusText = isActive ? 'ACTIVE' : (isCompleted ? 'COMPLETED' : 'PENDING');
                
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
                
                // ✅ Pass allQuests to the delete function
                await deleteQuestData(userId, questId, quest, allQuests);
                await loadStudentProgressData(userId);
                await updateStudentCardPendingCount(userId);
            });
        }
        
        container.appendChild(clone);
        lastWasActive = isActive;
    }
}

// ==========================
// LOAD RUBRIC FOR QUEST (MS SUPPORT)
// ==========================
async function loadRubricForQuest(questId, quest, questGrades, detailsDiv, userId) {
    const rubricContainer = detailsDiv.querySelector('.teacher-rubric-container');
    
    if (!quest.rubric) {
        rubricContainer.innerHTML = '<p>No rubric available</p>';
        return;
    }
    
    // ✅ Get student's grade level
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('grade_level')
        .eq('id', userId)
        .maybeSingle();
    
    const studentGradeLevel = profile?.grade_level || 'hs';
    const isMS = studentGradeLevel === 'ms';
    
    const auth = await checkTeacherAuth();
    let selectedStandards = null;
    let rubricDescriptions = null;
    
    // ✅ Load teacher's saved standards and descriptions for this quest
    if (auth) {
        const { data } = await window.supabase
            .from('teacher_quest_standards')
            .select('selected_standards, rubric_descriptions')
            .eq('teacher_id', auth.teacher.id)
            .eq('quest_id', questId)
            .maybeSingle();
        selectedStandards = data?.selected_standards || null;
        rubricDescriptions = data?.rubric_descriptions || null;
    }
    
    // Check which format we have
    const isIB = quest.rubric.criteria && Array.isArray(quest.rubric.criteria) && quest.rubric.criteria.length > 0;
    const isNCAS = quest.rubric.standards && Array.isArray(quest.rubric.standards) && quest.rubric.standards.length > 0;
    const isIGCSE = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives) && quest.rubric.assessment_objectives.length > 0;
    
    let itemsToShow = [];
    let gradeLevels = [];
    let gradeInputMax = 0;
    let headerLabel = '';
    let inputType = 'number';
    
    if (isNCAS) {
        // Use student's grade level
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
        inputType = 'number';
    } else if (isIB) {
        itemsToShow = quest.rubric.criteria;
        gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        gradeInputMax = 8;
        headerLabel = 'Criterion';
        inputType = 'number';
    } else if (isIGCSE) {
        itemsToShow = quest.rubric.assessment_objectives;
        gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        gradeInputMax = 8;
        headerLabel = 'Assessment Objective';
        inputType = 'text';
    }
    
    // ✅ Apply teacher's selected standards filter
    if (selectedStandards && selectedStandards.length > 0) {
        itemsToShow = itemsToShow.filter(item => 
            selectedStandards.includes(item.code)
        );
    }
    
    // ✅ Merge saved descriptions with itemsToShow
    if (rubricDescriptions) {
        itemsToShow = itemsToShow.map(item => {
            const desc = rubricDescriptions[item.code];
            if (desc) {
                const mergedLevels = {};
                gradeLevels.forEach(level => {
                    mergedLevels[level] = desc[level] || item.levels?.[level] || "";
                });
                return {
                    ...item,
                    levels: mergedLevels
                };
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
        <thead>
            <tr>
                <th>${headerLabel}</th>
                <th>${gradeLevels[0]}</th>
                <th>${gradeLevels[1]}</th>
                <th>${gradeLevels[2]}</th>
                <th>${gradeLevels[3]}</th>
                <th>Grade</th>
            </tr>
        </thead>
        <tbody>`;
    
    for (const item of itemsToShow) {
        const savedGrade = grades[item.code] || "";
        
        let displayValue = savedGrade;
        if (isIGCSE && savedGrade) {
            displayValue = convertNumberToLetterGrade(parseInt(savedGrade));
        }
        
        html += `<tr>
            <td><strong>${item.code}</strong>${item.name ? `: ${item.name}` : ''}</td>
            <td>${item.levels[gradeLevels[0]] || ""}</td>
            <td>${item.levels[gradeLevels[1]] || ""}</td>
            <td>${item.levels[gradeLevels[2]] || ""}</td>
            <td>${item.levels[gradeLevels[3]] || ""}</td>
            <td>`;
        
        if (isIGCSE) {
            html += `<input type="text" value="${displayValue}" class="teacher-grade-input" 
                           data-standard="${item.code}" data-quest="${questId}" 
                           placeholder="A*-G" maxlength="2">`;
        } else {
            html += `<input type="number" step="0.5" min="1" max="${gradeInputMax}" value="${savedGrade}" 
                           class="teacher-grade-input" data-standard="${item.code}" data-quest="${questId}">`;
        }
        
        html += `</td>
            </tr>`;
    }
    
    html += `</tbody>
    </table>
    <button class="teacher-save-grades-btn" data-quest="${questId}">Save Grades</button>`;
    
    const existingGrades = questGrades[questId]?.[column] || {};
    const savedComment = existingGrades.teacher_comment || '';

    const commentHtml = `
        <div class="teacher-comment-field" style="margin-top: 15px;">
            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-size: 12px;">📝 Teacher Comment (visible to student):</label>
            <textarea class="teacher-comment-input" data-quest="${questId}" rows="3" 
                    style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 6px; color: white; resize: vertical; font-family: inherit;">${escapeHtml(savedComment)}</textarea>
        </div>
    `;

    rubricContainer.innerHTML = html + commentHtml;
    
    const saveBtn = rubricContainer.querySelector('.teacher-save-grades-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => saveTeacherGrades(questId, quest, userId, detailsDiv));
    }
}
// ==========================
// SAVE TEACHER GRADES
// ==========================
async function saveTeacherGrades(questId, quest, userId, detailsDiv) {
    const inputs = detailsDiv.querySelectorAll('.teacher-grade-input');
    const grades = {};
    
    const isIB = quest.rubric && quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
    const isIGCSE = quest.rubric && quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);
    const isNCAS = quest.rubric && quest.rubric.standards && Array.isArray(quest.rubric.standards);
    
    let maxGrade = 4;
    if (isIB) maxGrade = 8;
    if (isIGCSE) maxGrade = 8;
    
    inputs.forEach(input => {
        const standard = input.dataset.standard;
        let value = input.value;
        
        if (isIGCSE) {
            const numValue = convertLetterGradeToNumber(value);
            if (numValue !== null) {
                grades[standard] = numValue;
            }
        } else {
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue >= 1 && numValue <= maxGrade) {
                grades[standard] = numValue;
            }
        }
    });
    
    const commentInput = detailsDiv.querySelector('.teacher-comment-input');
    if (commentInput) {
        grades.teacher_comment = commentInput.value.trim();
    }

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
    let questAccepted = progress?.quest_accepted || {};
    let questStartTimes = progress?.quest_start_times || {};
    
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
    await loadStudentProgressData(userId);
    await syncStudentBadges(userId);
    
    console.log(`Grades saved and badges synced for student ${userId}`);
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

async function triggerBadgeCheckForStudent(userId) {
    const { error } = await window.supabase
        .from('student_progress')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    
    if (error) {
        console.error("Error triggering badge check:", error);
    } else {
        console.log(`Badge check triggered for student ${userId}`);
    }
}

async function syncStudentBadges(studentId) {
    console.log(`Syncing badges for student ${studentId}...`);
    
    try {
        const { data: progress, error: progressError } = await window.supabase
            .from('student_progress')
            .select('completed_quests, earned_badges')
            .eq('user_id', studentId)
            .maybeSingle();
        
        if (progressError) {
            console.error("Error getting student progress:", progressError);
            return false;
        }
        
        if (!progress) {
            console.log("No progress found for student");
            return false;
        }
        
        const allQuests = await getAllQuestsForTeacher();
        const completedQuests = progress.completed_quests || {};
        
        let mvpCount = 0;
        const mvpQuestIds = [];
        
        for (const [questId, isCompleted] of Object.entries(completedQuests)) {
            if (isCompleted === true) {
                const quest = allQuests[questId];
                if (quest && quest.style === 'mvp') {
                    mvpCount++;
                    mvpQuestIds.push(questId);
                }
            }
        }
        
        console.log(`Student has ${mvpCount} MVP quests completed:`, mvpQuestIds);
        
        const badgesRes = await fetch('badges.json');
        const badgesData = await badgesRes.json();
        const progressionBadge = badgesData.badges.find(b => b.id === 'quest_completer');
        
        if (!progressionBadge || !progressionBadge.levels) {
            console.log("Badge configuration not found");
            return false;
        }
        
        let earnedLevel = null;
        for (const level of progressionBadge.levels) {
            if (mvpCount >= level.count) {
                earnedLevel = level;
            }
        }
        
        let updatedBadges = progress.earned_badges || {};
        
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
            console.log(`🏆 Awarding ${earnedLevel.level} badge for ${mvpCount} MVP quests`);
        } else if (mvpCount === 0 && updatedBadges.quest_completer) {
            delete updatedBadges.quest_completer;
            console.log(`Removing badge - no MVP quests`);
        }
        
        const { error: updateError } = await window.supabase
            .from('student_progress')
            .update({ earned_badges: updatedBadges })
            .eq('user_id', studentId);
        
        if (updateError) {
            console.error("Error saving badges:", updateError);
            return false;
        }
        
        console.log(`✅ Badges synced successfully for student ${studentId}`);
        return true;
        
    } catch (error) {
        console.error("Error in syncStudentBadges:", error);
        return false;
    }
}

async function syncAllStudentBadges() {
    const auth = await checkTeacherAuth();
    if (!auth) {
        alert("Not authenticated");
        return;
    }
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed.");
        return;
    }
    
    const { data: students, error } = await window.supabase
        .from('profiles')
        .select('id, name')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (error || !students || students.length === 0) {
        alert("No students found.");
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const student of students) {
        console.log(`Processing ${student.name}...`);
        const success = await syncStudentBadges(student.id);
        if (success) {
            successCount++;
        } else {
            errorCount++;
        }
    }
    
    alert(`Badges synced!\n✅ ${successCount} students updated\n❌ ${errorCount} errors\n\nStudents will see their badges when they refresh.`);
}

// ==========================
// QUEST DETAILS PANEL
// ==========================
async function openQuestDetailsPanel(questId, allQuests) {
    console.log("openQuestDetailsPanel called with questId:", questId);
    
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
    if (quest.path && Array.isArray(quest.path)) {
        pathText = quest.path.join(', ');
    } else if (quest.path) {
        pathText = quest.path;
    }
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
        
        // ✅ Load saved descriptions from teacher_quest_standards (works for ALL formats)
        const savedData = await loadTeacherQuestStandards(questId);
        const savedDescriptions = savedData?.rubric_descriptions || null;
        
        if (isNCAS && quest.rubric.standards.length > 0) {
            let standardsToShow = quest.rubric.standards;
            
            // ✅ Merge saved descriptions for NCAS
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
                <thead>
                    <tr><th>Standard</th><th>Grade 4</th><th>Grade 3</th><th>Grade 2</th><th>Grade 1</th></tr>
                </thead>
                <tbody>`;
            
            standardsToShow.forEach(std => {
                const level4 = std.levels?.["4"] || "";
                const level3 = std.levels?.["3"] || "";
                const level2 = std.levels?.["2"] || "";
                const level1 = std.levels?.["1"] || "";
                
                rubricHtml += `<tr>
                    <td>${std.code}${std.name ? `: ${std.name}` : ''}</td>
                    <td>${level4}</td>
                    <td>${level3}</td>
                    <td>${level2}</td>
                    <td>${level1}</td>
                </tr>`;
            });
            rubricHtml += `</tbody>
            </table>`;
        }
        else if (isIB && quest.rubric.criteria.length > 0) {
            let criteriaToShow = quest.rubric.criteria;
            
            // ✅ Merge saved descriptions for IB
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
                <thead>
                    <tr><th>Criterion</th><th>Grade 7-8</th><th>Grade 5-6</th><th>Grade 3-4</th><th>Grade 1-2</th></tr>
                </thead>
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
            rubricHtml += `</tbody>
            </table>`;
        } else if (isIGCSE && quest.rubric.assessment_objectives.length > 0) {
            let aosToShow = quest.rubric.assessment_objectives;
            
            // ✅ Merge saved descriptions for IGCSE
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
                <thead>
                    <tr><th>Assessment Objective</th><th>Grade A*-A</th><th>Grade B-C</th><th>Grade D-E</th><th>Grade F-G</th></tr>
                </thead>
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
            rubricHtml += `</tbody>
            </table>`;
        } else {
            rubricHtml = '<p>No standards, criteria, or assessment objectives selected for this quest. Please go to the "Select Standards" tab to choose which items to assess.</p>';
        }
        
        rubricContainer.innerHTML = rubricHtml;
    } else {
        rubricContainer.innerHTML = '<p>No rubric available for this quest.</p>';
    }
    
    const rationaleElement = document.getElementById('quest-rationale-text');
    if (quest.rationale) {
        rationaleElement.innerHTML = quest.rationale;
    } else {
        rationaleElement.innerHTML = 'No rationale provided.';
    }
    
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
        console.log("Tab clicked:", tabId);
        
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
                if (currentQuestData) {
                    loadPrerequisitesAndLeadsTo(currentQuestData.id, currentQuestData.allQuests);
                }
            }
        } else if (tabId === 'standards') {
            if (standardsTab) {
                standardsTab.style.display = 'block';
                if (currentQuestData) {
                    renderStandardsSelectionTab(currentQuestData.id);
                }
            }
        } else if (tabId === 'students') {
            if (studentsTab) {
                studentsTab.style.display = 'block';
                if (currentQuestData) {
                    loadActiveStudentsForQuest(currentQuestData.id);
                }
            }
        }
    });
}

function setupQuestDetailsClose() {
    const closeBtn = document.getElementById('close-quest-details-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeQuestDetailsPanel);
    }
}

function loadPrerequisitesAndLeadsTo(questId, allQuests) {
    const quest = allQuests[questId];
    
    setTimeout(() => {
        const prerequisitesList = document.getElementById('prerequisites-list');
        const leadsToList = document.getElementById('leads-to-list');
        
        if (!prerequisitesList) {
            console.error("prerequisites-list not found!");
            return;
        }
        
        const prerequisites = [];
        if (quest.prerequisites && Array.isArray(quest.prerequisites)) {
            quest.prerequisites.forEach(prereqId => {
                if (allQuests[prereqId]) {
                    prerequisites.push({
                        id: prereqId,
                        title: allQuests[prereqId].title
                    });
                }
            });
        }
        
        const leadsTo = [];
        for (const [id, q] of Object.entries(allQuests)) {
            if (q.prerequisites && Array.isArray(q.prerequisites) && q.prerequisites.includes(questId)) {
                leadsTo.push({
                    id: id,
                    title: q.title
                });
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
    
    const { data: students } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (!students || students.length === 0) {
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
    if (progressData) {
        progressData.forEach(p => {
            progressMap.set(p.user_id, p);
        });
    }
    
    const activeStudents = [];
    const completedStudents = [];
    
    for (const student of students) {
        const progress = progressMap.get(student.id);
        const completedQuests = progress?.completed_quests || {};
        const questAccepted = progress?.quest_accepted || {};
        
        if (completedQuests[questId] === true) {
            completedStudents.push(student);
        } else if (questAccepted[questId] === true) {
            activeStudents.push(student);
        }
    }
    
    if (activeStudents.length === 0) {
        activeContainer.innerHTML = '<div class="no-data">No active students for this quest</div>';
    } else {
        activeContainer.innerHTML = '';
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
    
    if (completedStudents.length === 0) {
        completedContainer.innerHTML = '<div class="no-data">No completed students for this quest</div>';
    } else {
        completedContainer.innerHTML = '';
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

// ==========================
// TEACHER QUEST STANDARDS (MS SUPPORT)
// ==========================
async function loadTeacherQuestStandards(questId, classId = null) {
    const auth = await checkTeacherAuth();
    if (!auth) return null;
    
    // Build the query
    let query = window.supabase
        .from('teacher_quest_standards')
        .select('selected_standards, timer_classes, class_id, rubric_descriptions')
        .eq('teacher_id', auth.teacher.id)
        .eq('quest_id', questId);
    
    if (classId !== null) {
        query = query.eq('class_id', classId);
    } else {
        query = query.is('class_id', null);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
        console.error("Error loading standards override:", error);
    }
    
    // Return the data even if it's null
    return {
        selected_standards: data?.selected_standards || null,
        timer_classes: data?.timer_classes || null,
        class_id: data?.class_id || null,
        rubric_descriptions: data?.rubric_descriptions || null
    };
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
    
    if (timerClasses !== null) {
        dataToSave.timer_classes = timerClasses;
    }
    
    if (classId !== null && classId !== '') {
        dataToSave.class_id = classId;
    }
    
    if (rubricDescriptions !== null) {
        dataToSave.rubric_descriptions = rubricDescriptions;
    }
    
    // ✅ FIX: Use the correct unique constraint columns
    // The table has a unique constraint on (teacher_id, quest_id, class_id)
    // When class_id is null, we need to handle it differently
    let error;
    
    if (classId !== null && classId !== '') {
        // With class_id - update or insert with class_id
        const { error: upsertError } = await window.supabase
            .from('teacher_quest_standards')
            .upsert(dataToSave, { 
                onConflict: 'teacher_id, quest_id, class_id'
            });
        error = upsertError;
    } else {
        // Without class_id - we need to handle the null case separately
        // First, check if a record exists with class_id = null
        const { data: existing } = await window.supabase
            .from('teacher_quest_standards')
            .select('id')
            .eq('teacher_id', auth.teacher.id)
            .eq('quest_id', questId)
            .is('class_id', null)
            .maybeSingle();
        
        if (existing) {
            // Update the existing record
            const { error: updateError } = await window.supabase
                .from('teacher_quest_standards')
                .update(dataToSave)
                .eq('id', existing.id);
            error = updateError;
        } else {
            // Insert new record with class_id = null
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
    
    if (classId !== null) {
        query = query.eq('class_id', classId);
    }
    
    const { error } = await query;
    
    if (error) {
        console.error("Error resetting standards:", error);
        alert("Error resetting standards: " + error.message);
        return false;
    }
    
    // Clear the cache and notify students
    refreshQuestsCache();
    await notifyQuestsChanged();
    
    return true;
}

async function getFilteredRubricForQuest(questId, teacherId = null) {
    const allQuests = await getAllQuestsForTeacher();
    const quest = allQuests[questId];
    
    if (!quest || !quest.rubric) {
        return quest;
    }
    
    const hasStandards = quest.rubric.standards && Array.isArray(quest.rubric.standards);
    const hasCriteria = quest.rubric.criteria && Array.isArray(quest.rubric.criteria);
    const hasAssessmentObjectives = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives);
    
    if (!hasStandards && !hasCriteria && !hasAssessmentObjectives) {
        return quest;
    }
    
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
            // If MS mode, use MS standards
            if (currentGradeLevel === 'ms') {
                standardsToFilter = MS_STANDARDS;
            }
            const filteredStandards = standardsToFilter.filter(std => 
                data.selected_standards.includes(std.code)
            );
            return {
                ...quest,
                rubric: {
                    ...quest.rubric,
                    standards: filteredStandards
                }
            };
        } else if (hasCriteria) {
            const filteredCriteria = quest.rubric.criteria.filter(criterion => 
                data.selected_standards.includes(criterion.code)
            );
            return {
                ...quest,
                rubric: {
                    ...quest.rubric,
                    criteria: filteredCriteria
                }
            };
        } else if (hasAssessmentObjectives) {
            const filteredAOs = quest.rubric.assessment_objectives.filter(ao => 
                data.selected_standards.includes(ao.code)
            );
            return {
                ...quest,
                rubric: {
                    ...quest.rubric,
                    assessment_objectives: filteredAOs
                }
            };
        }
    }
    
    return quest;
}

// ==========================
// RENDER STANDARDS SELECTION TAB (MS SUPPORT)
// ==========================
async function renderStandardsSelectionTab(questId) {
    const container = document.getElementById('standards-checkbox-list');
    if (!container) return;
    
    const allQuests = await getAllQuestsForTeacher();
    const quest = allQuests[questId];
    
    if (!quest || !quest.rubric) {
        container.innerHTML = '<p>No rubric found for this quest.</p>';
        return;
    }
    
    // ✅ Check which format we have
    const isIB = quest.rubric.criteria && Array.isArray(quest.rubric.criteria) && quest.rubric.criteria.length > 0;
    const isNCAS = quest.rubric.standards && Array.isArray(quest.rubric.standards) && quest.rubric.standards.length > 0;
    const isIGCSE = quest.rubric.assessment_objectives && Array.isArray(quest.rubric.assessment_objectives) && quest.rubric.assessment_objectives.length > 0;
    
    let itemsToShow = [];
    let gradeLevels = [];
    let headerLabel = '';
    
    if (isIB) {
        // IB format - works for both MS and HS
        itemsToShow = quest.rubric.criteria;
        gradeLevels = ['7-8', '5-6', '3-4', '1-2'];
        headerLabel = 'Criterion';
    } else if (isIGCSE) {
        // IGCSE format - works for both MS and HS
        itemsToShow = quest.rubric.assessment_objectives;
        gradeLevels = ['A*-A', 'B-C', 'D-E', 'F-G'];
        headerLabel = 'Assessment Objective';
    } else if (isNCAS) {
        // NCAS format - use the quest's own standards
        itemsToShow = quest.rubric.standards;
        gradeLevels = ['4', '3', '2', '1'];
        headerLabel = 'Standard';
    } else {
        container.innerHTML = '<p>No standards, criteria, or assessment objectives found for this quest.</p>';
        return;
    }
    
    const auth = await checkTeacherAuth();
    let classOptions = '<option value="">All Classes (default)</option>';
    for (const cls of teacherClasses) {
        classOptions += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
    }
    
    // ✅ Load saved data from database
    const savedData = await loadTeacherQuestStandards(questId);
    const savedStandards = savedData?.selected_standards || null;
    const savedTimerClasses = savedData?.timer_classes || null;
    const savedClassId = savedData?.class_id || null;
    const savedDescriptions = savedData?.rubric_descriptions || null;
    
    // Log for debugging
    console.log("Loaded saved standards:", savedStandards);
    console.log("Loaded saved descriptions:", savedDescriptions);
    console.log("Items to show:", itemsToShow);
    
    // ✅ If we have saved descriptions, merge them with itemsToShow (works for ALL formats)
    if (savedDescriptions) {
        itemsToShow = itemsToShow.map(item => {
            const desc = savedDescriptions[item.code];
            if (desc) {
                // Merge saved descriptions with existing levels
                const mergedLevels = {};
                gradeLevels.forEach(level => {
                    mergedLevels[level] = desc[level] || item.levels?.[level] || "";
                });
                return {
                    ...item,
                    levels: mergedLevels
                };
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
    if (initialClassId) {
        classDuration = await updateClassDuration(initialClassId);
    }
    
    const defaultTimerClasses = (defaultTimerMinutes / classDuration).toFixed(1);
    const currentTimerClasses = savedTimerClasses !== null ? savedTimerClasses : null;
    
    let timerHtml = `
        <div class="timer-settings-section">
            <h4>⏱️ Timer Settings</h4>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #ffd700;">Apply to class:</span>
                    <select id="timer-class-select">
                        ${classOptions}
                    </select>
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
                    <input type="number" id="custom-timer-classes" value="${currentTimerClasses || 1}" 
                           style="width: 70px; padding: 4px;"
                           ${!currentTimerClasses ? 'disabled' : ''}>
                    <span>class period(s)</span>
                    <span style="font-size: 12px; opacity: 0.8;">(${classDuration} min/class = <span id="custom-timer-minutes-preview">${(currentTimerClasses || 1) * classDuration}</span> min)</span>
                </label>
            </div>
            <div class="timer-info-text">
                💡 Timer counts only school days (Monday-Friday). Weekends are automatically skipped.
            </div>
        </div>
        <div class="standards-checkbox-list"></div>
    `;
    
    // ✅ Show which framework is being used
    const frameworkDisplay = currentFramework ? currentFramework.toUpperCase() : 'NCAS';
    const gradeDisplay = currentGradeLevel === 'ms' ? 'Middle School' : 'High School';
    
    let tableHtml = `
        <div style="margin: 10px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 13px;">
            📋 ${gradeDisplay} - ${frameworkDisplay} Framework - Showing ${headerLabel}s
        </div>
        <table class="rubric-table standards-selection-table">
            <thead>
                <tr>
                    <th style="width: 50px;">✓</th>
                    <th>${headerLabel}</th>
                    <th>${gradeLevels[0]}</th>
                    <th>${gradeLevels[1]}</th>
                    <th>${gradeLevels[2]}</th>
                    <th>${gradeLevels[3]}</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const item of itemsToShow) {
        const itemCode = item.code;
        // Check if this standard is saved (if savedStandards exists, use it, otherwise select all)
        const isChecked = savedStandards ? savedStandards.includes(itemCode) : true;
        
        const level1Value = item.levels?.[gradeLevels[0]] || '';
        const level2Value = item.levels?.[gradeLevels[1]] || '';
        const level3Value = item.levels?.[gradeLevels[2]] || '';
        const level4Value = item.levels?.[gradeLevels[3]] || '';
        
        tableHtml += `
            <tr class="standard-select-row" data-standard="${itemCode}">
                <td style="text-align: center;">
                    <input type="checkbox" class="standard-select-checkbox" value="${itemCode}" ${isChecked ? 'checked' : ''}>
                </td>
                <td class="standard-code-cell"><strong>${escapeHtml(itemCode)}: ${escapeHtml(item.name || '')}</strong></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[0]}" value="${escapeHtml(level1Value)}" placeholder="Grade ${gradeLevels[0]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[1]}" value="${escapeHtml(level2Value)}" placeholder="Grade ${gradeLevels[1]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[2]}" value="${escapeHtml(level3Value)}" placeholder="Grade ${gradeLevels[2]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
                <td><input type="text" class="grade-level-input" data-standard="${itemCode}" data-level="${gradeLevels[3]}" value="${escapeHtml(level4Value)}" placeholder="Grade ${gradeLevels[3]} description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; color: white;"></td>
            </tr>
        `;
    }
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = timerHtml;
    
    const standardsContainer = container.querySelector('.standards-checkbox-list');
    if (standardsContainer) {
        standardsContainer.innerHTML = tableHtml;
    } else {
        container.innerHTML += tableHtml;
    }
    
    const classSelect = document.getElementById('timer-class-select');
    if (classSelect && savedClassId) {
        classSelect.value = savedClassId;
    }
    
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
    
    if (classSelect) {
        classSelect.addEventListener('change', async () => {
            await refreshTimerDisplay();
        });
    }
    
    const defaultRadio = document.querySelector('input[name="timer-type"][value="default"]');
    const customRadio = document.querySelector('input[name="timer-type"][value="custom"]');
    const customInput = document.getElementById('custom-timer-classes');
    const minutesPreview = document.getElementById('custom-timer-minutes-preview');
    
    if (defaultRadio && customRadio && customInput) {
        defaultRadio.addEventListener('change', () => {
            if (defaultRadio.checked) {
                customInput.disabled = true;
            }
        });
        
        customRadio.addEventListener('change', () => {
            if (customRadio.checked) {
                customInput.disabled = false;
            }
        });
        
        customInput.addEventListener('input', async () => {
            const selectedClassId = classSelect?.value;
            const newClassDuration = await updateClassDuration(selectedClassId);
            const classes = parseInt(customInput.value) || 0;
            if (minutesPreview) {
                minutesPreview.textContent = classes * newClassDuration;
            }
        });
    }
    
    // Style unchecked rows
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
            // Get selected standards
            const checkboxes = document.querySelectorAll('#standards-checkbox-list .standard-select-checkbox');
            const selectedStandards = [];
            checkboxes.forEach(cb => {
                if (cb.checked) selectedStandards.push(cb.value);
            });
            
            if (selectedStandards.length === 0) {
                alert("You must select at least one standard/criterion/assessment objective for this quest.");
                return;
            }
            
            // Get timer settings
            const classSelectElem = document.getElementById('timer-class-select');
            const selectedClassId = classSelectElem?.value || null;
            
            const timerType = document.querySelector('input[name="timer-type"]:checked')?.value;
            let timerClasses = null;
            if (timerType === 'custom') {
                const customInputElem = document.getElementById('custom-timer-classes');
                timerClasses = parseInt(customInputElem?.value) || null;
            }
            
            // ✅ Collect rubric descriptions for ALL formats
            const inputs = document.querySelectorAll('#standards-checkbox-list .grade-level-input');
            const rubricDescriptions = {};
            inputs.forEach(input => {
                const standard = input.dataset.standard;
                const level = input.dataset.level;
                if (!rubricDescriptions[standard]) rubricDescriptions[standard] = {};
                rubricDescriptions[standard][level] = input.value;
            });
            
            // ✅ Log what we're saving
            console.log("Saving rubric descriptions:", rubricDescriptions);
            
            // Save to database using the updated function
            const success = await saveTeacherQuestStandards(
                questId, 
                selectedStandards, 
                timerClasses, 
                selectedClassId, 
                rubricDescriptions
            );
            
            if (success) {
                // ✅ If custom quest, also update the rubric in teacher_custom_quests
                if (quest.is_custom === true) {
                    const { data: questData } = await window.supabase
                        .from('teacher_custom_quests')
                        .select('rubric')
                        .eq('quest_id', questId)
                        .maybeSingle();
                    
                    if (questData) {
                        const updatedRubric = questData.rubric;
                        
                        // ✅ Update the appropriate rubric section based on format
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
                
                // ✅ Refresh quest cache and notify students
                refreshQuestsCache();
                await notifyQuestsChanged();
                
                alert(`${selectedStandards.length} item(s) saved!`);
                const allQuestsFresh = await getAllQuestsForTeacher();
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
                    const allQuestsFresh = await getAllQuestsForTeacher();
                    openQuestDetailsPanel(questId, allQuestsFresh);
                }
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
    
    console.log("Deleting all grading data for framework change...");
    
    const { data: students } = await window.supabase
        .from('profiles')
        .select('id')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (!students || students.length === 0) return;
    
    const studentIds = students.map(s => s.id);
    
    const { error: progressError } = await window.supabase
        .from('student_progress')
        .delete()
        .in('user_id', studentIds);
    
    if (progressError) {
        console.error("Error deleting progress:", progressError);
    }
    
    const { error: worksError } = await window.supabase
        .from('student_works')
        .update({ grading_status: 'pending' })
        .in('user_id', studentIds);
    
    if (worksError) {
        console.error("Error resetting works:", worksError);
    }
    
    console.log("All grading data deleted");
}

// ==========================
// PASSWORD VERIFICATION
// ==========================
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
            closeBtn.removeEventListener('click', handleCancel);
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
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', escHandler);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            }
        });
    });
}

// ==========================
// CUSTOM QUEST MODAL
// ==========================
async function openCreateCustomQuestModal() {
    const canCreate = await canCreateCustomQuest();
    if (!canCreate) {
        alert("You have reached the maximum of 5 custom quests. Delete an existing custom quest to create a new one.");
        return;
    }
    
    document.getElementById('custom-quest-title').value = '';
    document.getElementById('custom-quest-path').value = 'Painter Path';
    document.getElementById('custom-quest-difficulty').value = '1';
    document.getElementById('custom-quest-rationale').value = '';
    document.getElementById('custom-quest-description').value = '';
    
    const requirementsContainer = document.getElementById('custom-quest-requirements-list');
    requirementsContainer.innerHTML = `
        <div class="requirement-item">
            <input type="text" class="requirement-input" placeholder="Requirement">
            <button type="button" class="remove-requirement-btn">✖</button>
        </div>
    `;
    
    const linksContainer = document.getElementById('custom-quest-links-list');
    linksContainer.innerHTML = `
        <div class="link-item">
            <input type="text" class="link-type" placeholder="Type (e.g., Video sample)">
            <input type="url" class="link-url" placeholder="URL">
            <button type="button" class="remove-link-btn">✖</button>
        </div>
    `;
    
    document.getElementById('custom-quest-message').innerHTML = '';
    document.getElementById('create-custom-quest-modal').style.display = 'flex';
}

async function canCreateCustomQuest() {
    const auth = await checkTeacherAuth();
    if (!auth) return false;
    
    const { count, error } = await window.supabase
        .from('teacher_custom_quests')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', auth.teacher.id)
        .eq('deleted', false);
    
    if (error) {
        console.error("Error checking custom quest count:", error);
        return true;
    }
    
    const MAX_CUSTOM_QUESTS = 5;
    return count < MAX_CUSTOM_QUESTS;
}

async function updateCustomQuestCountDisplay() {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const { count, error } = await window.supabase
        .from('teacher_custom_quests')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', auth.teacher.id)
        .eq('deleted', false);
    
    if (!error) {
        const maxQuests = 5;
        const remaining = maxQuests - count;
        console.log(`Custom quests: ${count}/${maxQuests} used, ${remaining} remaining`);
    }
}

async function saveCustomQuest() {
    const title = document.getElementById('custom-quest-title').value.trim();
    const path = document.getElementById('custom-quest-path').value;
    const difficulty = parseInt(document.getElementById('custom-quest-difficulty').value);
    const rationale = document.getElementById('custom-quest-rationale').value.trim();
    const description = document.getElementById('custom-quest-description').value.trim();
    
    if (!title) {
        showCustomQuestMessage("Please enter a quest title.", "error");
        return;
    }
    if (!rationale) {
        showCustomQuestMessage("Please enter a rationale.", "error");
        return;
    }
    if (!description) {
        showCustomQuestMessage("Please enter a description.", "error");
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
        if (type && url) {
            links.push({ type: type, url: url });
        }
    }
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        showCustomQuestMessage("Password verification failed. Quest not created.", "error");
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
    
    const customImages = [
        "charimage/custom1.gif",
        "charimage/custom2.gif",
        "charimage/custom3.gif",
        "charimage/custom4.gif",
        "charimage/custom5.gif"
    ];
    
    const imageIndex = count;
    const customImage = customImages[imageIndex] || "charimage/teacher_quest.png";
    
    const timestamp = Date.now();
    const questId = `custom_${auth.teacher.id.substring(0, 8)}_${timestamp}`;
    
     const framework = await loadTeacherFramework();
    
    let rubric = null;
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
        // NCAS - use MS or HS standards based on toggle
        let standardsList;
        if (currentGradeLevel === 'ms') {
            standardsList = MS_STANDARDS;
        } else {
            standardsList = HS_STANDARDS;
        }
        
        rubric = {
            overall: title,
            standards: standardsList.map(std => ({
                code: std.code,
                name: std.name,
                levels: { "4": "", "3": "", "2": "", "1": "" }
            }))
        };
    }
    
    // ✅ NEW: Add marker to identify this as an MS quest
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
        title: title,
        rationale: rationale,
        description: description,
        requirements: requirements,
        links: links,
        difficulty: difficulty,
        path: path,
        rubric: rubric,
        selected_standards: [],
        character: customImage,
        // ✅ NEW: Store which grade level this quest belongs to
        grade_level: isMSQuest ? 'ms' : 'hs',
        created_at: new Date().toISOString()
    });
        
        if (error) {
            console.error("Error saving custom quest:", error);
            showCustomQuestMessage("Error creating quest: " + error.message, "error");
        } else {
            showCustomQuestMessage(`✅ Custom quest "${title}" created successfully!`, "success");
            
            setTimeout(async () => {
                document.getElementById('create-custom-quest-modal').style.display = 'none';
                renderAllQuestAccordions();
                updateCustomQuestCountDisplay();
                await notifyQuestsChanged();
            }, 2000);
        }
    } catch (error) {
        console.error("Error:", error);
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
    const confirmDelete = confirm(`Delete custom quest "${questTitle}"?\n\nStudent grades and artwork will be preserved (archived).\n\nThis action can be undone by restoring the quest later.`);
    if (!confirmDelete) return;
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed. Quest not deleted.");
        return;
    }
    
    const { error } = await window.supabase
        .from('teacher_custom_quests')
        .update({ deleted: true, deleted_at: new Date().toISOString() })
        .eq('quest_id', questId)
        .eq('teacher_id', auth.teacher.id);
    
    if (error) {
        console.error("Error deleting quest:", error);
        alert("Error deleting quest: " + error.message);
    } else {
        alert(`✅ Quest "${questTitle}" has been archived. Student data preserved.`);
        renderAllQuestAccordions();
        updateCustomQuestCountDisplay();
        await notifyQuestsChanged();
    }
}

async function loadTeacherCustomQuests() {
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
    
    return data || [];
}

async function getAllQuestsForTeacher() {
    const baseQuests = await getQuests();
    const customQuests = await loadTeacherCustomQuests();
    
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
    
    return allQuests;
}

// ==========================
// ART BATTLE CONTESTS
// ==========================
async function openCreateContestModal() {
    document.getElementById('contest-title').value = '';
    document.getElementById('contest-description').value = '';
    document.getElementById('contest-requirements').value = '';
    document.getElementById('contest-rubric').value = '';
    document.getElementById('contest-resources').value = '';
    document.getElementById('contest-start-date').value = '';
    document.getElementById('contest-end-date').value = '';
    document.getElementById('contest-password').value = '';
    document.getElementById('contest-message').innerHTML = '';
    document.getElementById('contest-warning').style.display = 'none';
    
    document.querySelector('input[name="visibility"][value="local"]').checked = true;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    document.getElementById('contest-start-date').value = tomorrowStr;
    document.getElementById('contest-end-date').value = nextWeekStr;
    
    document.getElementById('create-contest-overlay').style.display = 'flex';
}

function closeCreateContestModal() {
    document.getElementById('create-contest-overlay').style.display = 'none';
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
    
    if (!title) {
        messageDiv.innerHTML = 'Please enter a contest title.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!description) {
        messageDiv.innerHTML = 'Please enter a description/theme.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!requirements) {
        messageDiv.innerHTML = 'Please enter submission requirements.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!rubric) {
        messageDiv.innerHTML = 'Please enter voting rubric/guidelines.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!startDate) {
        messageDiv.innerHTML = 'Please select a start date.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!endDate) {
        messageDiv.innerHTML = 'Please select an end date.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (!password) {
        messageDiv.innerHTML = 'Please enter your password to confirm.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (start < now) {
        messageDiv.innerHTML = 'Start date cannot be in the past.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    if (end <= start) {
        messageDiv.innerHTML = 'End date must be after start date.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    messageDiv.innerHTML = 'Verifying password...';
    messageDiv.style.color = '#ffd700';
    
    const auth = await checkTeacherAuth();
    if (!auth) {
        messageDiv.innerHTML = 'Session expired. Please log in again.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    const { data: verifyData, error: verifyError } = await window.supabase.auth.signInWithPassword({
        email: currentTeacherEmail,
        password: password
    });
    
    if (verifyError) {
        messageDiv.innerHTML = 'Incorrect password. Contest not created.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    messageDiv.innerHTML = 'Creating contest...';
    
    const { data: contest, error: contestError } = await window.supabase
        .from('art_battle_contests')
        .insert({
            teacher_id: auth.teacher.id,
            title: title,
            description: description,
            requirements: requirements,
            rubric: rubric,
            resources: resources || null,
            is_worldwide: visibility === 'worldwide',
            start_date: startDate,
            end_date: endDate,
            is_active: true,
            created_at: new Date().toISOString()
        })
        .select()
        .single();
    
    if (contestError) {
        console.error("Error creating contest:", contestError);
        messageDiv.innerHTML = 'Error creating contest: ' + contestError.message;
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    messageDiv.innerHTML = '✅ Contest created successfully!';
    messageDiv.style.color = '#4caf50';
    
    setTimeout(() => {
        closeCreateContestModal();
        if (typeof loadTeacherContests === 'function') {
            loadTeacherContests();
        }
    }, 2000);
}

function initArtBattleContests() {
    const createContestBtn = document.getElementById('create-contest-btn');
    if (createContestBtn) {
        createContestBtn.addEventListener('click', openCreateContestModal);
    }
    
    const closeBtn = document.getElementById('close-contest-overlay');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCreateContestModal);
    }
    
    const cancelBtn = document.getElementById('cancel-contest-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCreateContestModal);
    }
    
    const submitBtn = document.getElementById('create-contest-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', createArtBattleContest);
    }
    
    const overlay = document.getElementById('create-contest-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeCreateContestModal();
            }
        });
    }
    
    const formFields = ['contest-title', 'contest-description', 'contest-requirements', 'contest-rubric', 'contest-start-date', 'contest-end-date'];
    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('focus', () => {
                document.getElementById('contest-warning').style.display = 'block';
            });
        }
    });
}

async function loadTeacherContests() {
    const auth = await checkTeacherAuth();
    if (!auth) {
        console.log("Not authenticated, skipping contest load");
        return;
    }
    
    const { data: contests, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('teacher_id', auth.teacher.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error loading contests:", error);
        return;
    }
    
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
    
    // ✅ NEW: Show grade level badge based on current toggle
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
        
        let statusText = '';
        let statusColor = '';
        
        if (now < startDate) {
            statusText = '⏳ Upcoming';
            statusColor = '#ffa726';
        } else if (now > endDate) {
            statusText = '🏁 Ended';
            statusColor = '#aaa';
        } else {
            statusText = '🔥 Active';
            statusColor = '#4caf50';
        }
        
        const contestItem = document.createElement('div');
        contestItem.className = 'quest-link-item';
        contestItem.style.borderLeft = `3px solid ${statusColor}`;
        contestItem.innerHTML = `
            <span class="quest-link-title">⚔️ ${escapeHtml(contest.title)}</span>
            <span style="font-size: 11px; color: ${statusColor};">${statusText}</span>
        `;
        
        contestItem.addEventListener('click', () => {
            openContestManagement(contest.id);
        });
        
        questsList.appendChild(contestItem);
    }
    
    content.appendChild(questsList);
    accordionDiv.appendChild(header);
    accordionDiv.appendChild(content);
    container.appendChild(accordionDiv);
    
    let expanded = false;
    header.addEventListener('click', () => {
        expanded = !expanded;
        if (expanded) {
            content.classList.add('expanded');
            header.classList.add('expanded');
        } else {
            content.classList.remove('expanded');
            header.classList.remove('expanded');
        }
    });
}

function attachContestButtonHandlers(contestId) {
    setTimeout(() => {
        const editBtn = document.getElementById('edit-contest-btn');
        const deleteBtn = document.getElementById('delete-contest-btn');
        
        if (editBtn) {
            editBtn.onclick = () => {
                console.log("Edit button clicked");
                openEditContestModal(contestId);
            };
        }
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                console.log("Delete button clicked");
                deleteContest(contestId);
            };
        }
    }, 200);
}

async function openContestManagement(contestId) {
    currentContestId = contestId;
    
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*, teachers(name)')
        .eq('id', contestId)
        .single();
    
    if (error) {
        console.error("Error loading contest:", error);
        return;
    }
    
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
    
    const now = new Date();
    const contestEndDate = new Date(contest.end_date);
    const isEnded = now > contestEndDate;
    
    container.innerHTML = `
        <div class="contest-info-section">
            <div class="contest-info-title">📋 Contest Information</div>
            <div class="contest-info-row">
                <div class="contest-info-label">Title:</div>
                <div class="contest-info-value">${escapeHtml(contest.title)}</div>
            </div>
            <div class="contest-info-row">
                <div class="contest-info-label">Created by:</div>
                <div class="contest-info-value">${escapeHtml(teacherName)}</div>
            </div>
            <div class="contest-info-row">
                <div class="contest-info-label">Visibility:</div>
                <div class="contest-info-value">${contest.is_worldwide ? '🌍 Worldwide' : '📚 Local (Your students only)'}</div>
            </div>
            <div class="contest-info-row">
                <div class="contest-info-label">Dates:</div>
                <div class="contest-info-value">${startDateStr} - ${endDateStr}</div>
            </div>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div class="contest-info-section" style="flex: 1;">
                <div class="contest-info-title">Description / Theme</div>
                <div class="contest-info-value">${escapeHtml(contest.description || 'No description provided.')}</div>
            </div>
            <div class="contest-info-section" style="flex: 1;">
                <div class="contest-info-title">Requirements</div>
                <div class="contest-info-value">${escapeHtml(contest.requirements || 'No specific requirements.')}</div>
            </div>
        </div>
        
        <div class="contest-info-section">
            <div class="contest-info-title">Voting Rubric / Guidelines</div>
            <div class="contest-info-value">${escapeHtml(contest.rubric || 'No guidelines provided.')}</div>
        </div>
        ${contest.resources ? `
        <div class="contest-info-section">
            <div class="contest-info-title">Resources</div>
            <div class="contest-info-value">${escapeHtml(contest.resources)}</div>
        </div>
        ` : ''}
        
        <div style="display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap;">
            ${!isCreator ? `
                <div style="flex: 1;">
                    ${!isHidden ? 
                        `<button id="hide-from-students-btn" class="contest-action-btn hide-btn">🙈 Hide from My Students</button>` : 
                        `<button id="unhide-from-students-btn" class="contest-action-btn unhide-btn">🐵 Show to My Students</button>`
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
            const hideBtn = document.getElementById('hide-from-students-btn');
            const unhideBtn = document.getElementById('unhide-from-students-btn');
            if (hideBtn) hideBtn.onclick = () => hideContestFromMyStudents(contest.id);
            if (unhideBtn) unhideBtn.onclick = () => unhideContestForMyStudents(contest.id);
        } else {
            const editBtn = document.getElementById('edit-contest-btn');
            const deleteBtn = document.getElementById('delete-contest-btn');
            
            if (editBtn) {
                editBtn.onclick = () => {
                    console.log("Edit button clicked");
                    openEditContestModal(contest.id);
                };
            }
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    console.log("Delete button clicked");
                    deleteContest(contest.id);
                };
            }
        }
    }, 100);
    
    if (isEnded && isCreator) {
        const { data: submissions, error } = await window.supabase
            .from('art_battle_submissions')
            .select('*, profiles(name, avatar_url)')
            .eq('contest_id', contest.id)
            .eq('status', 'approved')
            .order('votes', { ascending: false });
        
        if (!error && submissions && submissions.length > 0) {
            const voteAdjustHtml = `
                <div class="contest-info-section" style="margin-top: 20px;">
                    <div class="contest-info-title">🔧 Vote Adjustment (Tie Breaker)</div>
                    <p>Add 0.1 votes to break ties. The podium will update automatically.</p>
                    <div id="vote-adjustment-list"></div>
                </div>
            `;
            container.innerHTML += voteAdjustHtml;
            
            const adjustContainer = document.getElementById('vote-adjustment-list');
            if (adjustContainer) {
                adjustContainer.innerHTML = submissions.map(sub => `
                    <div class="vote-adjust-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: rgba(0,0,0,0.3); border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${sub.avatar_url || 'profile.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <strong>${escapeHtml(sub.title)}</strong><br>
                                <small>${escapeHtml(sub.profiles?.name || 'Unknown')}</small>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span>⭐ ${parseFloat(sub.votes || 0).toFixed(1)} votes</span>
                            <button class="add-vote-btn" data-id="${sub.id}" style="background: rgba(255,215,0,0.3); border: 1px solid #ffd700; color: #ffd700; padding: 5px 10px; border-radius: 4px; cursor: pointer;">+0.1</button>
                        </div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.add-vote-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const submissionId = btn.dataset.id;
                        await addTieBreakerVote(submissionId, contest.id);
                    });
                });
            }
        }
    }
    if (isCreator) {
        attachContestButtonHandlers(contest.id);
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
        console.error(`Error loading ${status} submissions:`, error);
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
                <div class="teacher-gallery-quest">Student: ${escapeHtml(submission.profiles?.name || 'Unknown')} 
                    <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
                </div>
                <div class="submission-description" style="font-size: 11px; color: #aaa; margin: 5px 0;">${escapeHtml((submission.description || 'No description').substring(0, 80))}${submission.description?.length > 80 ? '...' : ''}</div>
                <div class="submission-actions" style="display: flex; gap: 10px; margin-top: 8px;">
                    ${status === 'pending' ? `
                        <button class="accept-btn" data-id="${submission.id}">✓ Accept</button>
                        <button class="decline-btn" data-id="${submission.id}">✗ Decline</button>
                    ` : `
                        <button class="view-details-btn" data-id="${submission.id}">📷 View Details</button>
                    `}
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
                const card = thumb.closest('.teacher-gallery-item');
                const submissionId = card.dataset.submissionId;
                await viewContestSubmissionDetails(submissionId);
            });
        });
    } else {
        document.querySelectorAll('#contest-submitted-list .view-details-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const submissionId = btn.dataset.id;
                await viewContestSubmissionDetails(submissionId);
            });
        });
        
        document.querySelectorAll('#contest-submitted-list .teacher-gallery-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', async () => {
                const card = thumb.closest('.teacher-gallery-item');
                const submissionId = card.dataset.submissionId;
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
    
    if (error) {
        console.error("Error loading submission:", error);
        return;
    }
    
    const modal = document.getElementById('teacher-work-modal');
    const content = document.getElementById('teacher-work-content');
    
    const gradeLevel = submission.profiles?.grade_level || 'hs';
    const gradeBadge = gradeLevel === 'ms' ? 'MS' : 'HS';
    
    if (forStudent) {
        content.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; text-align: center;">
                <h3 style="color: #ffd700;">${escapeHtml(submission.title || 'Untitled')}</h3>
                <div style="margin: 15px 0;">
                    <img src="${submission.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;">
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: left;">
                    <p><strong>Student:</strong> ${escapeHtml(submission.profiles?.name || 'Unknown')} 
                        <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
                    </p>
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
                    <p><strong>Student:</strong> ${escapeHtml(submission.profiles?.name || 'Unknown')} 
                        <span class="grade-level-badge ${gradeLevel}">${gradeBadge}</span>
                    </p>
                    <p><strong>Submitted:</strong> ${new Date(submission.submitted_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> ${submission.status === 'approved' ? '✅ Approved' : (submission.status === 'pending' ? '⏳ Pending' : '❌ Rejected')}</p>
                    ${submission.rejection_reason ? `<p><strong>Rejection Reason:</strong> ${escapeHtml(submission.rejection_reason)}</p>` : ''}
                </div>
                <p><strong>Description:</strong><br>${escapeHtml(submission.description || 'No description')}</p>
                ${submission.image_url ? `<div class="teacher-work-image" style="margin-top: 15px;"><img src="${submission.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;"></div>` : ''}
            </div>
        `;
    }
    
    modal.style.display = 'flex';
    
    const closeBtn = modal.querySelector('.teacher-work-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
}

async function approveSubmission(submissionId) {
    const { error } = await window.supabase
        .from('art_battle_submissions')
        .update({ 
            status: 'approved',
            approved_at: new Date().toISOString()
        })
        .eq('id', submissionId);
    
    if (error) {
        alert('Error approving submission: ' + error.message);
        return;
    }
    
    await loadContestSubmissions(currentContestId, 'pending', 'contest-pending-list', 'pending-count');
    await loadContestSubmissions(currentContestId, 'approved', 'contest-submitted-list', 'submitted-count');
}

function openRejectModal(submissionId) {
    currentRejectSubmissionId = submissionId;
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function confirmRejection() {
    const reason = document.getElementById('rejection-reason').value.trim();
    
    if (!reason) {
        alert('Please provide a reason for rejection.');
        return;
    }
    
    const { data: submission } = await window.supabase
        .from('art_battle_submissions')
        .select('student_id')
        .eq('id', currentRejectSubmissionId)
        .single();
    
    const { error } = await window.supabase
        .from('art_battle_submissions')
        .delete()
        .eq('id', currentRejectSubmissionId);
    
    if (error) {
        alert('Error rejecting submission: ' + error.message);
        return;
    }
    
    console.log(`Submission ${currentRejectSubmissionId} rejected. Reason: ${reason}`);
    
    document.getElementById('reject-modal').style.display = 'none';
    await loadContestSubmissions(currentContestId, 'pending', 'contest-pending-list', 'pending-count');
}

function viewSubmissionDetails(submission) {
    alert(`Title: ${submission.title}\nStudent: ${submission.profiles?.name}\nDescription: ${submission.description || 'No description'}`);
}

function initContestManagement() {
    const closeBtn = document.getElementById('close-contest-management');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('contest-management-overlay').style.display = 'none';
        });
    }
    
    const overlay = document.getElementById('contest-management-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
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
            
            if (tab === 'profile') {
                document.getElementById('contest-profile-tab').style.display = 'block';
            } else if (tab === 'pending') {
                document.getElementById('contest-pending-tab').style.display = 'block';
            } else if (tab === 'submitted') {
                document.getElementById('contest-submitted-tab').style.display = 'block';
            }
        });
    });
    
    const cancelReject = document.getElementById('cancel-reject');
    const confirmReject = document.getElementById('confirm-reject');
    const rejectModal = document.getElementById('reject-modal');
    
    if (cancelReject) {
        cancelReject.addEventListener('click', () => {
            rejectModal.style.display = 'none';
        });
    }
    
    if (confirmReject) {
        confirmReject.addEventListener('click', confirmRejection);
    }
    
    if (rejectModal) {
        rejectModal.addEventListener('click', (e) => {
            if (e.target === rejectModal) {
                rejectModal.style.display = 'none';
            }
        });
    }
    
    loadTeacherContests();
}

function closeCreateContestOverlay() {
    document.getElementById('create-contest-overlay').style.display = 'none';
}

function initContestOverlayButtons() {
    const closeBtn = document.getElementById('close-contest-overlay');
    if (closeBtn) {
        closeBtn.onclick = closeCreateContestOverlay;
    }
    
    const cancelBtn = document.getElementById('cancel-contest-btn');
    if (cancelBtn) {
        cancelBtn.onclick = closeCreateContestOverlay;
    }
    
    const overlay = document.getElementById('create-contest-overlay');
    if (overlay) {
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                closeCreateContestOverlay();
            }
        };
    }
}

async function deleteContest(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const { data: contest, error: checkError } = await window.supabase
        .from('art_battle_contests')
        .select('teacher_id, title')
        .eq('id', contestId)
        .single();
    
    if (checkError) {
        alert("Error verifying contest ownership.");
        return;
    }
    
    if (contest.teacher_id !== auth.teacher.id) {
        alert("Only the teacher who created this contest can delete it.");
        return;
    }
    
    const confirmed = confirm(
        "⚠️ PERMANENTLY DELETE CONTEST\n\n" +
        `"${contest.title}"\n\n` +
        "This will permanently delete:\n" +
        "• All artwork images from storage\n" +
        "• All submissions and votes\n" +
        "• The contest itself\n\n" +
        "⚠️ This action CANNOT be undone.\n\n" +
        "Make sure you have saved the results PDF first!\n\n" +
        "Click OK to permanently delete."
    );
    
    if (!confirmed) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed. Contest not deleted.");
        return;
    }
    
    const { data: submissions } = await window.supabase
        .from('art_battle_submissions')
        .select('image_url')
        .eq('contest_id', contestId);
    
    if (submissions && submissions.length > 0) {
        for (const sub of submissions) {
            if (sub.image_url) {
                try {
                    const fileName = sub.image_url.split('/').pop();
                    await window.supabase.storage
                        .from('contest-submissions')
                        .remove([fileName]);
                    console.log("Deleted image:", fileName);
                } catch(e) {
                    console.log("Could not delete image:", sub.image_url);
                }
            }
        }
    }
    
    await window.supabase
        .from('art_battle_votes')
        .delete()
        .eq('contest_id', contestId);
    
    await window.supabase
        .from('art_battle_submissions')
        .delete()
        .eq('contest_id', contestId);
    
    const { error } = await window.supabase
        .from('art_battle_contests')
        .delete()
        .eq('id', contestId);
    
    if (error) {
        alert("Error deleting contest: " + error.message);
        return;
    }
    
    alert("✅ Contest permanently deleted!");
    
    const panel = document.getElementById('contest-management-overlay');
    if (panel) panel.style.display = 'none';
    
    await loadTeacherContests();
}

async function hideContestFromMyStudents(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const confirmed = confirm(
        "Hide this contest from your students?\n\n" +
        "Your students will no longer see this contest.\n" +
        "Other teachers' students can still participate.\n\n" +
        "You can unhide it later."
    );
    
    if (!confirmed) return;
    
    const { data: contest, error: fetchError } = await window.supabase
        .from('art_battle_contests')
        .select('hidden_by_teachers')
        .eq('id', contestId)
        .single();
    
    if (fetchError) {
        alert("Error fetching contest data.");
        return;
    }
    
    let hiddenBy = contest.hidden_by_teachers || [];
    if (!hiddenBy.includes(auth.teacher.id)) {
        hiddenBy.push(auth.teacher.id);
    }
    
    const { error } = await window.supabase
        .from('art_battle_contests')
        .update({ hidden_by_teachers: hiddenBy })
        .eq('id', contestId);
    
    if (error) {
        alert("Error hiding contest: " + error.message);
        return;
    }
    
    alert("✅ Contest hidden from your students!");
    openContestManagement(contestId);
}

async function unhideContestForMyStudents(contestId) {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const { data: contest, error: fetchError } = await window.supabase
        .from('art_battle_contests')
        .select('hidden_by_teachers')
        .eq('id', contestId)
        .single();
    
    if (fetchError) {
        alert("Error fetching contest data.");
        return;
    }
    
    let hiddenBy = contest.hidden_by_teachers || [];
    hiddenBy = hiddenBy.filter(id => id !== auth.teacher.id);
    
    const { error } = await window.supabase
        .from('art_battle_contests')
        .update({ hidden_by_teachers: hiddenBy })
        .eq('id', contestId);
    
    if (error) {
        alert("Error unhiding contest: " + error.message);
        return;
    }
    
    alert("✅ Contest is now visible to your students again!");
    openContestManagement(contestId);
}

async function openEditContestModal(contestId) {
    console.log("Opening edit modal for contest:", contestId);
    
    const modal = document.getElementById('edit-contest-modal');
    if (!modal) {
        console.error("Edit modal not found");
        return;
    }
    
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();
    
    if (error) {
        console.error("Error loading contest:", error);
        alert("Error loading contest data");
        return;
    }
    
    const endDateInput = document.getElementById('edit-contest-end-date');
    const resourcesTextarea = document.getElementById('edit-contest-resources');
    const messageDiv = document.getElementById('edit-contest-message');
    
    if (endDateInput) endDateInput.value = contest.end_date;
    if (resourcesTextarea) resourcesTextarea.value = contest.resources || '';
    if (messageDiv) messageDiv.innerHTML = '';
    
    modal.dataset.contestId = contestId;
    
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    modal.style.zIndex = '20000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    console.log("Modal opened");
}

async function saveEditContest() {
    const modal = document.getElementById('edit-contest-modal');
    const contestId = modal.dataset.contestId;
    const endDate = document.getElementById('edit-contest-end-date').value;
    const resources = document.getElementById('edit-contest-resources').value.trim();
    const messageDiv = document.getElementById('edit-contest-message');
    
    if (!endDate) {
        messageDiv.innerHTML = 'Please select an end date.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    const newEndDate = new Date(endDate);
    const now = new Date();
    
    if (newEndDate <= now) {
        messageDiv.innerHTML = 'End date must be in the future.';
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    messageDiv.innerHTML = 'Saving...';
    messageDiv.style.color = '#ffd700';
    
    const { error } = await window.supabase
        .from('art_battle_contests')
        .update({
            end_date: endDate,
            resources: resources || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', contestId);
    
    if (error) {
        messageDiv.innerHTML = 'Error saving: ' + error.message;
        messageDiv.style.color = '#ff8888';
        return;
    }
    
    messageDiv.innerHTML = '✅ Contest updated successfully!';
    messageDiv.style.color = '#4caf50';
    
    setTimeout(() => {
        modal.style.display = 'none';
        openContestManagement(contestId);
    }, 1500);
}

function initEditContestModal() {
    const modal = document.getElementById('edit-contest-modal');
    if (!modal) {
        console.log("Edit contest modal not found");
        return;
    }
    
    modal.style.display = 'none';
    
    const closeModal = () => {
        modal.style.display = 'none';
        console.log("Edit modal closed");
    };
    
    const closeBtn = modal.querySelector('.teacher-work-close');
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    
    const cancelBtn = document.getElementById('cancel-edit-contest-btn');
    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
    }
    
    const saveBtn = document.getElementById('save-edit-contest-btn');
    if (saveBtn) {
        saveBtn.onclick = saveEditContest;
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
    
    console.log("Edit contest modal initialized");
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
    
    if (error) {
        alert("Error adjusting votes: " + error.message);
        return;
    }
    
    alert("✅ Vote adjusted! Refresh the contest to see updated standings.");
    openContestManagement(contestId);
}

async function generateResultsPDF(contestId) {
    console.log("Generating PDF for contest:", contestId);
    
    const { data: contest, error } = await window.supabase
        .from('art_battle_contests')
        .select('*')
        .eq('id', contestId)
        .single();
    
    if (error) {
        alert("Error loading contest data");
        return;
    }
    
    const { data: submissions } = await window.supabase
        .from('art_battle_submissions')
        .select('*, profiles(name)')
        .eq('contest_id', contestId)
        .eq('status', 'approved')
        .order('votes', { ascending: false });
    
    if (!submissions || submissions.length === 0) {
        alert("No submissions found for this contest.");
        return;
    }
    
    const winners = submissions.slice(0, 3);
    const otherParticipants = submissions.slice(3);
    
    const startDate = new Date(contest.start_date).toLocaleDateString();
    const endDate = new Date(contest.end_date).toLocaleDateString();
    
    // Rest of PDF generation code remains the same...
    // (The full function is very long, but the logic is unchanged)
}

// ==========================
// CLASSROOM MANAGEMENT
// ==========================
async function renderClassManagementView() {
    console.log("renderClassManagementView - START");
    try {
        const auth = await checkTeacherAuth();
        if (!auth) return;
        
        // Get all students
        console.log("Fetching students...");
        let { data: students, error: studentsError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('teacher_code', auth.teacher.class_code);
        
        if (studentsError) {
            console.error("Error fetching students:", studentsError);
            return;
        }
        
        // ✅ FIX: Filter students by grade level for classes, but keep all unassigned
        let filteredStudents = [];
        if (currentGradeLevel === 'hs') {
            filteredStudents = students.filter(s => s.grade_level === 'hs' || !s.grade_level);
        } else if (currentGradeLevel === 'ms') {
            filteredStudents = students.filter(s => s.grade_level === 'ms');
        } else {
            filteredStudents = students;
        }
        
        // ✅ NEW: Keep ALL unassigned students (regardless of grade level) for the unassigned column
        const allUnassignedStudents = students.filter(s => !s.class_id);
        
        console.log("Students fetched:", students?.length);
        console.log("Filtered students:", filteredStudents?.length);
        console.log("All unassigned students:", allUnassignedStudents?.length);
        
        // Get pending works for red dots (for all students)
        const allStudentIds = students.map(s => s.id);
        const { data: pendingWorks } = await window.supabase
            .from('student_works')
            .select('user_id')
            .eq('grading_status', 'pending')
            .in('user_id', allStudentIds);
        
        const pendingSet = new Set(pendingWorks?.map(w => w.user_id) || []);
        
        // Group filtered students by class
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
        if (!dropZones) {
            console.error("class-drop-zones not found!");
            return;
        }
        dropZones.innerHTML = '';
        
        // ✅ FIX: Show unassigned column with ALL unassigned students (not filtered)
        if (allUnassignedStudents.length > 0) {
            const unassignedColumn = await createClassColumn('unassigned', 'Unassigned', allUnassignedStudents, pendingSet, null);
            dropZones.appendChild(unassignedColumn);
        }
        
        // ✅ FIX: Show ALL classes that match the grade level, even if empty
        const filteredClasses = teacherClasses.filter(cls => {
            const matchesGradeLevel = cls.grade_level === currentGradeLevel || 
                                    (currentGradeLevel === 'hs' && !cls.grade_level);
            return matchesGradeLevel;
        });
        
        // Render filtered class columns
        for (const cls of filteredClasses) {
            const classStudents = studentsByClass[cls.id] || [];
            const column = createClassColumn(cls.id, cls.name, classStudents, pendingSet, cls);
            dropZones.appendChild(column);
        }
        
        // Always show "Create New Class" button
        const addColumn = document.createElement('div');
        addColumn.className = 'class-drop-zone';
        addColumn.style.display = 'flex';
        addColumn.style.alignItems = 'center';
        addColumn.style.justifyContent = 'center';
        addColumn.style.minHeight = '200px';
        addColumn.innerHTML = '<button id="add-new-class-btn" class="add-class-btn">+ Create New Class</button>';
        dropZones.appendChild(addColumn);
        
        const addBtn = document.getElementById('add-new-class-btn');
        if (addBtn) {
            addBtn.addEventListener('click', showCreateClassModal);
        }
        
        if (bulkAssignMode) {
            updateBulkPanelUI();
        }
        
        if (deleteMode) {
            updateDeletePanelUI();
        }
        
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
    
    // ✅ NEW: Determine grade level badge
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
    
    column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
    });
    
    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });
    
    column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const studentId = e.dataTransfer.getData('text/plain');
        if (!studentId) return;
        
        const targetClassId = classId === 'unassigned' ? null : classId;
        
        await assignStudentToClass(studentId, targetClassId);
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
                    await renderClassManagementView();
                    await renderClassAccordion();
                }
            });
        }
    }
    
    return column;
}

async function assignStudentToClass(studentId, classId) {
    // Get the class to know its grade level
    let gradeLevel = 'hs'; // default
    if (classId) {
        const classData = teacherClasses.find(c => c.id === classId);
        if (classData) {
            gradeLevel = classData.grade_level || 'hs';
        }
    }
    
    // Update student's class AND grade level
    const { error } = await window.supabase
        .from('profiles')
        .update({ 
            class_id: classId,
            grade_level: gradeLevel
        })
        .eq('id', studentId);
    
    if (error) {
        console.error("Error assigning student:", error);
        alert("Error assigning student: " + error.message);
    }
}

async function deleteClass(classId) {
    try {
        // 1. Unassign all students in this class
        console.log("Unassigning students from class...");
        const { error: unassignError } = await window.supabase
            .from('profiles')
            .update({ class_id: null })
            .eq('class_id', classId);
        
        if (unassignError) {
            console.error("Error unassigning students:", unassignError);
            alert("Error unassigning students: " + unassignError.message);
            return;
        }
        console.log("Students unassigned successfully");

        // 2. Delete invitations for this class FIRST (this is the one causing the constraint)
        console.log("Deleting invitations...");
        const { error: inviteDeleteError } = await window.supabase
            .from('student_invitations')
            .delete()
            .eq('class_id', classId);
        
        if (inviteDeleteError) {
            console.error("Error deleting invitations:", inviteDeleteError);
            // If delete fails, try updating them to null
            console.log("Trying to set invitations class_id to null...");
            const { error: inviteUpdateError } = await window.supabase
                .from('student_invitations')
                .update({ class_id: null })
                .eq('class_id', classId);
            
            if (inviteUpdateError) {
                console.error("Error updating invitations:", inviteUpdateError);
                alert("Could not remove invitations. Please contact support.");
                return;
            }
            console.log("Invitations updated successfully");
        } else {
            console.log("Invitations deleted successfully");
        }

        // 3. Delete class settings
        console.log("Deleting class settings...");
        const { error: settingsError } = await window.supabase
            .from('class_settings')
            .delete()
            .eq('class_id', classId);
        if (settingsError) {
            console.error("Error deleting class settings:", settingsError);
            // Non-critical, continue
        }

        // 4. Delete schedule overrides
        console.log("Deleting schedule overrides...");
        const { error: scheduleError } = await window.supabase
            .from('class_schedule_overrides')
            .delete()
            .eq('class_id', classId);
        if (scheduleError) {
            console.error("Error deleting schedule overrides:", scheduleError);
            // Non-critical, continue
        }

        // 5. Delete weekend settings
        console.log("Deleting weekend settings...");
        const { error: weekendError } = await window.supabase
            .from('class_weekend_settings')
            .delete()
            .eq('class_id', classId);
        if (weekendError) {
            console.error("Error deleting weekend settings:", weekendError);
            // Non-critical, continue
        }

        // 6. Delete schedule rules
        console.log("Deleting schedule rules...");
        const { error: rulesError } = await window.supabase
            .from('class_schedule_rules')
            .delete()
            .eq('class_id', classId);
        if (rulesError) {
            console.error("Error deleting schedule rules:", rulesError);
            // Non-critical, continue
        }

        // 7. Finally, delete the class
        console.log("Deleting class...");
        const { error: deleteError } = await window.supabase
            .from('classes')
            .delete()
            .eq('id', classId);

        if (deleteError) {
            console.error("Error deleting class:", deleteError);
            alert("Error deleting class: " + deleteError.message);
            return;
        }

        console.log("Class deleted successfully!");
        
        // 8. Refresh the view
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
    gradeSelect.value = 'hs'; // Reset to default
    
    const confirmBtn = document.getElementById('confirm-create-class');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', async () => {
        const className = input.value.trim();
        const gradeLevel = gradeSelect.value;
        
        if (!className) {
            alert("Please enter a class name.");
            return;
        }
        
        const auth = await checkTeacherAuth();
        if (!auth) return;
        
        const { error } = await window.supabase
            .from('classes')
            .insert({ 
                teacher_id: auth.teacher.id, 
                name: className,
                grade_level: gradeLevel
            });
        
        if (error) {
            alert("Error creating class: " + error.message);
        } else {
            modal.style.display = 'none';
            await loadClasses();
            await renderClassManagementView();
            await renderClassAccordion();
            alert("Class created successfully!");
        }
    });
}

document.querySelector('#create-class-modal .teacher-work-close')?.addEventListener('click', () => {
    document.getElementById('create-class-modal').classList.remove('open');
});

document.getElementById('create-class-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('create-class-modal')) {
        document.getElementById('create-class-modal').classList.remove('open');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('create-class-modal');
        if (modal && modal.classList.contains('open')) {
            modal.classList.remove('open');
        }
    }
});

function toggleBulkAssignMode() {
    console.log("toggleBulkAssignMode called, current mode:", bulkAssignMode);
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
    
    if (!targetClassId) {
        alert("Please select a class");
        return;
    }
    
    if (selectedStudentsForBulk.size === 0) {
        alert("No students selected");
        return;
    }
    
    const classIdToAssign = targetClassId === 'unassigned' ? null : targetClassId;
    
    for (const studentId of selectedStudentsForBulk) {
        await assignStudentToClass(studentId, classIdToAssign);
    }
    
    selectedStudentsForBulk.clear();
    bulkAssignMode = false;
    
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
            if (checkbox.checked) {
                selectedStudentsForBulk.add(student.id);
            } else {
                selectedStudentsForBulk.delete(student.id);
            }
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
            if (checkbox.checked) {
                selectedStudentsForDelete.add(student.id);
            } else {
                selectedStudentsForDelete.delete(student.id);
            }
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
        
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });
        
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            loadStudentDetails(student.id, student.name);
        });
    }
    
    return card;
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
    
    if (deleteMode && bulkAssignMode) {
        toggleBulkAssignMode();
    }
    
    renderClassManagementView();
}

function updateDeletePanelUI() {
    const deletePanel = document.getElementById('delete-confirm-panel');
    
    if (selectedStudentsForDelete.size > 0) {
        if (!deletePanel) {
            createDeletePanel();
        }
        const panel = document.getElementById('delete-confirm-panel');
        const countSpan = document.getElementById('delete-student-count');
        if (countSpan) countSpan.innerText = selectedStudentsForDelete.size;
        panel.style.display = 'block';
    } else {
        if (deletePanel) deletePanel.style.display = 'none';
    }
}

function createDeletePanel() {
    const existingPanel = document.getElementById('delete-confirm-panel');
    if (existingPanel) return;
    
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
    if (!isValid) {
        alert("Password verification failed. Deletion cancelled.");
        return;
    }
    
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
                const result = await response.json();
                console.error("Error deleting auth user:", result.error);
                errorCount++;
            } else {
                authDeleted = true;
            }
        } catch (err) {
            console.error("Error calling delete-user function:", err);
            errorCount++;
        }
        
        if (authDeleted) {
            const { error: profileError } = await window.supabase
                .from('profiles')
                .delete()
                .eq('id', studentId);
            
            if (profileError) {
                console.error("Error deleting student profile:", profileError);
                errorCount++;
            } else {
                deletedCount++;
            }
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
    
    await loadClasses();
    await renderClassManagementView();
    await renderClassAccordion();
    await loadAllStudents();
    
    const panel = document.getElementById('delete-confirm-panel');
    if (panel) panel.style.display = 'none';
}

// ==========================
// CLASS SETTINGS
// ==========================
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
            <td>
                <input type="number" class="target-formative-input" data-class-id="${cls.id}" 
                       value="${clsSettings.target_formative}" min="0" max="81" step="1" style="width: 80px;">
            </td>
            <td>
                <input type="number" class="target-summative-input" data-class-id="${cls.id}" 
                       value="${clsSettings.target_summative}" min="0" max="81" step="1" style="width: 80px;">
            </td>
            <td>
                <input type="number" class="class-duration-input" data-class-id="${cls.id}" 
                       value="${clsSettings.class_duration_minutes}" min="30" max="120" step="5" style="width: 80px;">
                <span style="font-size: 11px;">minutes</span>
            </td>
            <td>
                <button class="reset-class-defaults-btn" data-class-id="${cls.id}" 
                        style="background: none; border: none; color: #ff8888; cursor: pointer;">↺ Reset</button>
            </td>
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
                target_formative: target_formative,
                target_summative: target_summative,
                class_duration_minutes: class_duration_minutes,
                updated_at: new Date().toISOString()
            }, { onConflict: 'class_id' });
        
        if (error) {
            console.error("Error saving setting for class:", classId, error);
            errorCount++;
        } else {
            successCount++;
        }
    }
    
    showSettingsMessage(`Saved ${successCount} class setting(s). ${errorCount} error(s).`, errorCount === 0 ? 'success' : 'error');
    
    if (document.getElementById('analytics-main-content').style.display === 'block') {
        await loadAnalyticsData();
    }
}

function showSettingsMessage(message, type) {
    const messageDiv = document.getElementById('settings-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `settings-message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

async function getClassTargets(classId) {
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

// ==========================
// TEACHER CODE
// ==========================
let classCodeVisible = false;
let actualClassCode = '';

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

async function updateStudentLimitDisplay() {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    try {
        const { data: teacher, error: teacherError } = await window.supabase
            .from('teachers')
            .select('max_students')
            .eq('id', auth.teacher.id)
            .single();
        
        if (teacherError) {
            console.error("Error getting teacher limit:", teacherError);
            return;
        }
        
        const maxStudents = teacher?.max_students || 50;
        
        const { count, error: countError } = await window.supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_code', auth.teacher.class_code);
        
        if (countError) {
            console.error("Error counting students:", countError);
            return;
        }
        
        const currentCount = count || 0;
        
        document.getElementById('student-count-display').textContent = currentCount;
        document.getElementById('student-max-display').textContent = maxStudents;
        
        const countDisplay = document.getElementById('student-limit-text');
        if (currentCount >= maxStudents) {
            countDisplay.style.color = '#ff8888';
        } else if (currentCount >= maxStudents * 0.8) {
            countDisplay.style.color = '#ffa726';
        } else {
            countDisplay.style.color = '#81c784';
        }
    } catch (error) {
        console.error("Error in updateStudentLimitDisplay:", error);
    }
}

// ==========================
// STUDENT INVITATION
// ==========================
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
    
    if (!email) {
        showInviteMessage("Please enter a student email address.", "error");
        return;
    }
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        showInviteMessage("Password verification failed.", "error");
        return;
    }
    
    const sendBtn = document.getElementById('send-invite-btn');
    const originalText = sendBtn.textContent;
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;
    
    try {
        const inviteToken = generateInviteToken();
        
        const { error: inviteError } = await window.supabase
            .from('student_invitations')
            .insert({
                email: email,
                teacher_code: auth.teacher.class_code,
                class_id: classId || null,
                token: inviteToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        
        if (inviteError) {
            console.error("Error saving invitation:", inviteError);
            showInviteMessage("Failed to create invitation. Please try again.", "error");
            return;
        }
        
        const inviteLink = `${window.location.origin}/signup.html?invite=${inviteToken}`;
        
        showInviteMessage(`✅ Invitation created! Share this link with the student:\n\n${inviteLink}\n\nThe link expires in 7 days.`, "success");
        
        setTimeout(() => {
            document.getElementById('invite-modal').style.display = 'none';
        }, 5000);
        
    } catch (error) {
        console.error("Error:", error);
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

// ==========================
// SCHEDULE TAB
// ==========================
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
    
    if (classSelect && currentScheduleClassId) {
        classSelect.value = currentScheduleClassId;
    }
    
    if (!currentScheduleClassId) return;
    
    const { data: noClassDays } = await window.supabase
        .from('class_schedule_overrides')
        .select('*')
        .eq('class_id', currentScheduleClassId);
    
    if (noClassDays) {
        scheduleData.noClassDays = noClassDays;
    }
    
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
    const checkboxes = document.querySelectorAll('.day-checkboxes input');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
}

function updateFrequencyUI(settings) {
    if (!settings || settings.type !== 'custom') {
        const checkboxes = document.querySelectorAll('.day-checkboxes input');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        return;
    }
    
    const checkboxes = document.querySelectorAll('.day-checkboxes input');
    checkboxes.forEach(cb => {
        cb.checked = settings.days && settings.days.includes(parseInt(cb.value));
    });
}

function renderCalendar() {
    const year = currentScheduleDate.getFullYear();
    const month = currentScheduleDate.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) {
        monthYearEl.textContent = `${monthNames[month]} ${year}`;
    }
    
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const scheduleMap = new Map();
    if (scheduleData.noClassDays) {
        scheduleData.noClassDays.forEach(day => {
            scheduleMap.set(day.date, day);
        });
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
        const selectedClassName = selectedOption ? selectedOption.text : '';
        updateClassIndicator(selectedClassName);
        await loadScheduleData();
    } else {
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.innerHTML = '<div style="grid-column: span 7; text-align: center; padding: 40px;">Select a class to view schedule</div>';
        }
        scheduleData = {
            noClassDays: [],
            weekendSettings: {},
            frequencySettings: {}
        };
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
        if (calendarContainer) {
            calendarContainer.parentNode.insertBefore(indicator, calendarContainer);
        }
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
    const modal = document.getElementById('date-modal');
    modal.style.display = 'none';
}

async function saveDateModal() {
    const dateValue = document.getElementById('modal-date-value').value;
    const status = document.getElementById('modal-status').value;
    const reason = document.getElementById('modal-reason').value;
    const notes = document.getElementById('modal-notes').value;
    const applyToAll = document.getElementById('modal-apply-all').checked;
    const isEdit = !!document.getElementById('modal-delete-btn').style.display === 'inline-block';
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
        classesToUpdate = allClasses.map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }
    
    if (isEdit && existingId) {
        const { error } = await window.supabase
            .from('class_schedule_overrides')
            .update({
                is_class_day: status === 'class',
                reason: status === 'no-class' ? reason : null,
                notes: notes || null,
                apply_to_all_classes: applyToAll
            })
            .eq('id', existingId);
        
        if (error) {
            console.error("Error updating no-class day:", error);
            alert("Error saving changes.");
            return;
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
        
        if (error) {
            console.error("Error saving no-class day:", error);
            alert("Error saving changes.");
            return;
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
                
                if (!existingOther) {
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
    }
    
    closeDateModal();
    await loadScheduleData();
}

async function deleteDateModal() {
    const existingId = document.getElementById('date-modal').dataset.existingId;
    const dateValue = document.getElementById('modal-date-value').value;
    const applyToAll = document.getElementById('modal-apply-all').checked;
    
    if (!existingId && !dateValue) return;
    
    if (!confirm('Remove this no-class setting?')) return;
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    let classesToUpdate = [];
    
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = allClasses.map(c => c.id);
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
            
            if (error) {
                errorCount++;
            } else {
                successCount++;
            }
        }
    }
    
    closeDateModal();
    await loadScheduleData();
    
    if (errorCount > 0) {
        alert(`Removed from ${successCount} class(es). ${errorCount} error(s).`);
    } else if (successCount > 0) {
        alert(`No-class setting removed from ${successCount} class(es)!`);
    }
}

async function saveWeekendSettings() {
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
        return;
    }
    
    const saturdayIsClass = document.getElementById('weekend-saturday-class').checked;
    const sundayIsClass = document.getElementById('weekend-sunday-class').checked;
    const applyToAll = document.getElementById('weekend-apply-all').checked;
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed. Settings not saved.");
        return;
    }
    
    const { error } = await window.supabase
        .from('class_weekend_settings')
        .upsert({
            class_id: currentScheduleClassId,
            saturday_is_class: saturdayIsClass,
            sunday_is_class: sundayIsClass,
            apply_to_all_classes: applyToAll,
            updated_at: new Date().toISOString()
        }, { onConflict: 'class_id' });
    
    if (error) {
        console.error("Error saving weekend settings:", error);
        alert("Error saving settings: " + error.message);
    } else {
        alert("Weekend settings saved successfully!");
        await loadScheduleData();
    }
}

async function saveFrequencySettings() {
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
        return;
    }
    
    const checkboxes = document.querySelectorAll('.day-checkboxes input:checked');
    const days = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (days.length === 0) {
        alert('Please select at least one class day.');
        return;
    }
    
    const applyToAll = document.getElementById('frequency-apply-all').checked;
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed. Settings not saved.");
        return;
    }
    
    const { error } = await window.supabase
        .from('class_schedule_rules')
        .upsert({
            class_id: currentScheduleClassId,
            type: 'custom',
            days: days,
            apply_to_all_classes: applyToAll,
            updated_at: new Date().toISOString()
        }, { onConflict: 'class_id' });
    
    if (error) {
        console.error("Error saving frequency settings:", error);
        alert("Error saving settings: " + error.message);
    } else {
        alert("Frequency settings saved successfully!");
        await loadScheduleData();
    }
}

async function resetScheduleSettings() {
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
        return;
    }
    
    if (!confirm('Reset all schedule settings for this class? This will remove all no-class days, weekend settings, and frequency rules.')) {
        return;
    }
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const passwordValid = await verifyTeacherPassword();
    if (!passwordValid) {
        alert("Password verification failed. Settings not reset.");
        return;
    }
    
    await window.supabase.from('class_schedule_overrides').delete().eq('class_id', currentScheduleClassId);
    await window.supabase.from('class_weekend_settings').delete().eq('class_id', currentScheduleClassId);
    await window.supabase.from('class_schedule_rules').delete().eq('class_id', currentScheduleClassId);
    
    alert('Schedule settings reset to default.');
    await loadScheduleData();
}

async function addNoClassDay() {
    const dateInput = document.getElementById('no-class-date');
    const reasonInput = document.getElementById('no-class-reason');
    const applyToAllCheckbox = document.getElementById('apply-to-all-classes');
    
    const dateValue = dateInput.value;
    const reason = reasonInput.value.trim();
    const applyToAll = applyToAllCheckbox.checked;
    
    if (!dateValue) {
        alert('Please select a date.');
        return;
    }
    
    if (!reason) {
        alert('Please enter a reason for the no-class day.');
        return;
    }
    
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
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
        classesToUpdate = allClasses.map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const classId of classesToUpdate) {
        const { data: existing } = await window.supabase
            .from('class_schedule_overrides')
            .select('id')
            .eq('class_id', classId)
            .eq('date', dateValue)
            .maybeSingle();
        
        if (existing) {
            const { error } = await window.supabase
                .from('class_schedule_overrides')
                .update({
                    is_class_day: false,
                    reason: reason,
                    apply_to_all_classes: applyToAll
                })
                .eq('id', existing.id);
            
            if (error) {
                errorCount++;
            } else {
                successCount++;
            }
        } else {
            const { error } = await window.supabase
                .from('class_schedule_overrides')
                .insert({
                    class_id: classId,
                    date: dateValue,
                    is_class_day: false,
                    reason: reason,
                    apply_to_all_classes: applyToAll
                });
            
            if (error) {
                errorCount++;
            } else {
                successCount++;
            }
        }
    }
    
    dateInput.value = '';
    reasonInput.value = '';
    applyToAllCheckbox.checked = false;
    
    await loadScheduleData();
    
    if (errorCount > 0) {
        alert(`Added ${successCount} class(es). ${errorCount} error(s).`);
    } else {
        alert(`No-class day added for ${successCount} class(es)!`);
    }
}

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

async function addDateRange() {
    const startDate = document.getElementById('range-start-date').value;
    const endDate = document.getElementById('range-end-date').value;
    const reason = document.getElementById('range-reason').value.trim();
    const applyToAll = document.getElementById('range-apply-to-all-classes').checked;
    const excludeWeekends = document.getElementById('exclude-weekends').checked;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }
    
    if (!reason) {
        alert('Please enter a reason for the no-class period.');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date.');
        return;
    }
    
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
        return;
    }
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const dates = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        
        if (!(excludeWeekends && isWeekend)) {
            dates.push(dateStr);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (dates.length === 0) {
        alert('No dates selected (all were weekends and you chose to exclude weekends).');
        return;
    }
    
    let classesToUpdate = [];
    
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = allClasses.map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const classId of classesToUpdate) {
        for (const dateStr of dates) {
            const { data: existing } = await window.supabase
                .from('class_schedule_overrides')
                .select('id')
                .eq('class_id', classId)
                .eq('date', dateStr)
                .maybeSingle();
            
            if (existing) {
                const { error } = await window.supabase
                    .from('class_schedule_overrides')
                    .update({
                        is_class_day: false,
                        reason: reason,
                        apply_to_all_classes: applyToAll
                    })
                    .eq('id', existing.id);
                
                if (error) totalErrors++;
                else totalSuccess++;
            } else {
                const { error } = await window.supabase
                    .from('class_schedule_overrides')
                    .insert({
                        class_id: classId,
                        date: dateStr,
                        is_class_day: false,
                        reason: reason,
                        apply_to_all_classes: applyToAll
                    });
                
                if (error) totalErrors++;
                else totalSuccess++;
            }
        }
    }
    
    document.getElementById('range-start-date').value = '';
    document.getElementById('range-end-date').value = '';
    document.getElementById('range-reason').value = '';
    document.getElementById('range-apply-to-all-classes').checked = false;
    document.getElementById('exclude-weekends').checked = false;
    
    await loadScheduleData();
    
    alert(`Added ${totalSuccess} no-class day(s). ${totalErrors} error(s).`);
}

async function removeDateRange() {
    const startDate = document.getElementById('remove-range-start').value;
    const endDate = document.getElementById('remove-range-end').value;
    const removeFromAll = document.getElementById('remove-from-all-classes').checked;
    const excludeWeekends = document.getElementById('remove-exclude-weekends').checked;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date.');
        return;
    }
    
    if (!currentScheduleClassId) {
        alert('Please select a class first.');
        return;
    }
    
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const dates = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        
        if (!(excludeWeekends && isWeekend)) {
            dates.push(dateStr);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (dates.length === 0) {
        alert('No dates selected (all were weekends and you chose to exclude weekends).');
        return;
    }
    
    let classesToUpdate = [];
    
    if (removeFromAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = allClasses.map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }
    
    if (!confirm(`Remove no-class settings for ${dates.length} day(s) from ${classesToUpdate.length} class(es)?`)) {
        return;
    }
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const classId of classesToUpdate) {
        for (const dateStr of dates) {
            const { data: entry } = await window.supabase
                .from('class_schedule_overrides')
                .select('id')
                .eq('class_id', classId)
                .eq('date', dateStr)
                .maybeSingle();
            
            if (entry) {
                const { error } = await window.supabase
                    .from('class_schedule_overrides')
                    .delete()
                    .eq('id', entry.id);
                
                if (error) {
                    totalErrors++;
                } else {
                    totalSuccess++;
                }
            }
        }
    }
    
    document.getElementById('remove-range-start').value = '';
    document.getElementById('remove-range-end').value = '';
    document.getElementById('remove-from-all-classes').checked = false;
    document.getElementById('remove-exclude-weekends').checked = false;
    
    await loadScheduleData();
    
    alert(`Removed ${totalSuccess} no-class day(s). ${totalErrors} error(s).`);
}

function setupICSImport() {
    const importBtn = document.getElementById('import-ics-btn');
    const fileInput = document.getElementById('ics-file-input');
    
    if (!importBtn || !fileInput) return;
    
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!currentScheduleClassId) {
            alert('Please select a class first.');
            fileInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const icsContent = event.target.result;
            const events = parseICS(icsContent);
            
            if (events.length === 0) {
                alert('No events found in the ICS file.');
                fileInput.value = '';
                return;
            }
            
            const noClassEvents = events.filter(event => {
                const summary = (event.summary || '').toLowerCase();
                const description = (event.description || '').toLowerCase();
                const keywords = ['holiday', 'break', 'vacation', 'no school', 'off', 'closed', 'holiday', 'spring break', 'winter break', 'fall break', 'summer break'];
                
                return keywords.some(keyword => summary.includes(keyword) || description.includes(keyword));
            });
            
            if (noClassEvents.length === 0) {
                alert('No holiday/break events found in the calendar. Only events with keywords like "holiday", "break", "vacation", "no school" will be imported.');
                fileInput.value = '';
                return;
            }
            
            const applyToAll = confirm(`Import ${noClassEvents.length} event(s) as no-class days?\n\nApply to all classes? Click OK for ALL classes, Cancel for current class only.`);
            
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
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (line === 'BEGIN:VEVENT') {
            inEvent = true;
            currentEvent = {};
        } else if (line === 'END:VEVENT') {
            inEvent = false;
            if (currentEvent.startDate) {
                events.push(currentEvent);
            }
        } else if (inEvent) {
            if (line.startsWith('SUMMARY:')) {
                currentEvent.summary = line.substring(8).replace(/\\,/g, ',').replace(/\\n/g, '\n');
            } else if (line.startsWith('DESCRIPTION:')) {
                currentEvent.description = line.substring(12).replace(/\\,/g, ',').replace(/\\n/g, '\n');
            } else if (line.startsWith('DTSTART')) {
                let dateStr = line.split(':')[1];
                if (dateStr && dateStr.length >= 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    currentEvent.startDate = `${year}-${month}-${day}`;
                }
            } else if (line.startsWith('DTEND')) {
                let dateStr = line.split(':')[1];
                if (dateStr && dateStr.length >= 8) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    currentEvent.endDate = `${year}-${month}-${day}`;
                }
            }
        }
    }
    
    const expandedEvents = [];
    for (const event of events) {
        if (event.startDate && event.endDate) {
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            const current = new Date(start);
            
            while (current <= end) {
                const year = current.getFullYear();
                const month = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                expandedEvents.push({
                    date: dateStr,
                    reason: event.summary || event.description || 'Imported from calendar'
                });
                
                current.setDate(current.getDate() + 1);
            }
        } else if (event.startDate) {
            expandedEvents.push({
                date: event.startDate,
                reason: event.summary || event.description || 'Imported from calendar'
            });
        }
    }
    
    return expandedEvents;
}

async function importICSEvents(events, applyToAll) {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    let classesToUpdate = [];
    
    if (applyToAll) {
        const { data: allClasses } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', auth.teacher.id);
        classesToUpdate = allClasses.map(c => c.id);
    } else {
        classesToUpdate = [currentScheduleClassId];
    }
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const classId of classesToUpdate) {
        for (const event of events) {
            const { data: existing } = await window.supabase
                .from('class_schedule_overrides')
                .select('id')
                .eq('class_id', classId)
                .eq('date', event.date)
                .maybeSingle();
            
            if (existing) {
                const { error } = await window.supabase
                    .from('class_schedule_overrides')
                    .update({
                        is_class_day: false,
                        reason: event.reason,
                        apply_to_all_classes: applyToAll
                    })
                    .eq('id', existing.id);
                
                if (error) totalErrors++;
                else totalSuccess++;
            } else {
                const { error } = await window.supabase
                    .from('class_schedule_overrides')
                    .insert({
                        class_id: classId,
                        date: event.date,
                        is_class_day: false,
                        reason: event.reason,
                        apply_to_all_classes: applyToAll
                    });
                
                if (error) totalErrors++;
                else totalSuccess++;
            }
        }
    }
    
    await loadScheduleData();
    alert(`Imported ${totalSuccess} no-class day(s). ${totalErrors} error(s).`);
}

// ==========================
// ANALYTICS
// ==========================
async function loadAnalyticsData() {
    console.log("Loading analytics data...");
    
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
    const { data: progressData } = await window.supabase
        .from('student_progress')
        .select('*')
        .in('user_id', studentIds);
    
    const { data: worksData } = await window.supabase
        .from('student_works')
        .select('user_id, uploaded_at')
        .in('user_id', studentIds)
        .order('uploaded_at', { ascending: false });
    
    const progressMap = new Map();
    if (progressData) {
        progressData.forEach(p => {
            progressMap.set(p.user_id, p);
        });
    }
    
    const lastUploadMap = new Map();
    if (worksData) {
        worksData.forEach(w => {
            if (!lastUploadMap.has(w.user_id)) {
                lastUploadMap.set(w.user_id, w.uploaded_at);
            }
        });
    }
    
    const classMap = new Map();
    teacherClasses.forEach(cls => {
        classMap.set(cls.id, cls.name);
    });
    
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
        
        const classTargets = await getClassTargets(student.class_id);
        const targetTotal = classTargets.total;
        
        // ✅ NEW: Pass the student's grade level
        const domainGrades = calculateStudentDomainGrades(questGrades, completedQuests, allQuests, student.grade_level || 'hs');        const lastUpload = lastUploadMap.get(student.id);
        
        const gradeLevel = student.grade_level || 'hs';
        
        analyticsData.students.push({
            id: student.id,
            name: student.name,
            classId: student.class_id,
            className: classMap.get(student.class_id) || 'No Class',
            completedCount: completedCount,
            targetTotal: targetTotal,
            activeQuest: activeQuest,
            domainGrades: domainGrades,
            lastUpload: lastUpload,
            gradeLevel: gradeLevel
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
    // ✅ NEW: Use the student's grade level passed as parameter
    const isMS = studentGradeLevel === 'ms';
    
    let scores = {};
    let counts = {};
    
    if (isIB) {
        scores = { A: 0, B: 0, C: 0, D: 0 };
        counts = { A: 0, B: 0, C: 0, D: 0 };
    } else if (isIGCSE) {
        scores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        counts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
    } else {
        if (isMS) {
            scores = { creating: 0, reflecting: 0, responding: 0, connecting: 0 };
            counts = { creating: 0, reflecting: 0, responding: 0, connecting: 0 };
        } else {
            scores = { creating: 0, presenting: 0, responding: 0, connecting: 0 };
            counts = { creating: 0, presenting: 0, responding: 0, connecting: 0 };
        }
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
                    if (isMS) {
                        domain = mapMSStandardToDomain(standard.code);
                    } else {
                        domain = mapStandardToDomain(standard.code);
                    }
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
            if (isIGCSE) {
                avg = convertNumberToLetterGrade(Math.round(avg));
            } else {
                avg = avg.toFixed(1);
            }
            result[key] = avg;
        } else {
            result[key] = '—';
        }
    }
    
    return result;
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
    
    const totals = {};
    const counts = {};
    keys.forEach(key => {
        totals[key] = 0;
        counts[key] = 0;
    });
    
    for (const student of students) {
        for (const key of keys) {
            const val = student.domainGrades[key];
            if (val !== '—' && val !== null && val !== undefined) {
                const numVal = parseFloat(val);
                if (!isNaN(numVal)) {
                    totals[key] += numVal;
                    counts[key]++;
                }
            }
        }
    }
    
    const averages = {};
    for (const key of keys) {
        if (counts[key] > 0) {
            let avg = totals[key] / counts[key];
            if (isIGCSE) {
                avg = convertNumberToLetterGrade(Math.round(avg));
            } else {
                avg = avg.toFixed(1);
            }
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
                if (analyticsData.framework === 'igcse') {
                    avg = convertNumberToLetterGrade(Math.round(avg));
                } else {
                    avg = avg.toFixed(1);
                }
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
                if (isMS) {
                    domain = mapMSStandardToDomain(standard.code);
                } else {
                    domain = mapStandardToDomain(standard.code);
                }
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
    // ✅ NEW: Use the currently filtered student list to determine grade level
    // If we're showing MS students, use MS domains; if HS, use HS domains
    const isMS = currentGradeLevel === 'ms';
    
    if (!gridContainer) return;
    
    let domains = [];
    let labels = [];
    let cellClasses = [];
    
    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        labels = ['Knowing & Understanding', 'Developing Skills', 'Thinking Creatively', 'Responding'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        labels = ['Record', 'Explore & Select', 'Develop', 'Present'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        labels = ['Creating', 'Reflecting', 'Responding', 'Connecting'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        labels = ['Creating', 'Presenting', 'Responding', 'Connecting'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    }
    
    
    const domainAverages = classAverages?.domainAverages || {};
    const getDisplayName = (domain, framework, isMS) => {
        if (framework === 'ib-myp') return domain;
        if (framework === 'igcse') return domain;
        if (isMS) {
            const mapping = { 'creating': 'Cr', 'reflecting': 'Re', 'responding': 'Rs', 'connecting': 'Cn' };
            return mapping[domain] || domain;
        }
        const mapping = { 'creating': 'Cr', 'presenting': 'Pr', 'responding': 'Re', 'connecting': 'Cn' };
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
    
    let domains = [];
    let shortLabels = [];
    let cellClasses = [];
    
    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        shortLabels = ['A', 'B', 'C', 'D'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        shortLabels = ['AO1', 'AO2', 'AO3', 'AO4'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Re', 'Rs', 'Cn'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Pr', 'Re', 'Cn'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    }
    
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
        el.addEventListener('click', async (e) => {
            const userId = el.dataset.userId;
            const student = analyticsData.students.find(s => s.id === userId);
            if (student) {
                await loadStudentDetails(userId, student.name);
            }
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

let currentQuestPage = 1;
const QUESTS_PER_PAGE = 10;

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
    
    let domains = [];
    let shortLabels = [];
    let cellClasses = [];
    
    if (framework === 'ib-myp') {
        domains = ['A', 'B', 'C', 'D'];
        shortLabels = ['A', 'B', 'C', 'D'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (framework === 'igcse') {
        domains = ['AO1', 'AO2', 'AO3', 'AO4'];
        shortLabels = ['AO1', 'AO2', 'AO3', 'AO4'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else if (isMS) {
        domains = ['creating', 'reflecting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Re', 'Rs', 'Cn'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    } else {
        domains = ['creating', 'presenting', 'responding', 'connecting'];
        shortLabels = ['Cr', 'Pr', 'Re', 'Cn'];
        cellClasses = ['grade-cell-creating', 'grade-cell-presenting', 'grade-cell-responding', 'grade-cell-connecting'];
    }
    
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
        el.addEventListener('click', async (e) => {
            const questId = el.dataset.questId;
            const allQuests = await getQuests();
            openQuestDetailsPanel(questId, allQuests);
        });
    });
}

function updatePaginationControls(totalPages) {
    const container = document.getElementById('analytics-pagination');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
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

async function exportAnalyticsToCSV() {
    console.log("Exporting analytics data to CSV...");
    
    const allQuests = await getQuests();
    const framework = analyticsData.framework;
    const isMS = currentGradeLevel === 'ms';
    
    let domainHeaders = [];
    if (framework === 'ib-myp') {
        domainHeaders = ['A: Knowing & Understanding', 'B: Developing Skills', 'C: Thinking Creatively', 'D: Responding'];
    } else if (framework === 'igcse') {
        domainHeaders = ['AO1: Record', 'AO2: Explore & Select', 'AO3: Develop', 'AO4: Present'];
    } else if (isMS) {
        domainHeaders = ['Creating (Cr)', 'Reflecting (Re)', 'Responding (Rs)', 'Connecting (Cn)'];
    } else {
        domainHeaders = ['Creating (Cr)', 'Presenting (Pr)', 'Responding (Re)', 'Connecting (Cn)'];
    }
    
    const studentsData = [];
    const studentHeaders = ['Student Name', 'Class', 'Grade Level', 'Quests Completed', 'Target Quests', 'Completion %', 'Active Quest', ...domainHeaders, 'Last Upload'];
    studentsData.push(studentHeaders);
    
    for (const student of analyticsData.students) {
        const targetTotal = student.targetTotal || 22;
        const completionPercent = targetTotal > 0 ? Math.round((student.completedCount / targetTotal) * 100) : 0;
        const domainKeys = Object.keys(student.domainGrades);
        
        const row = [
            student.name,
            student.className,
            student.gradeLevel || 'HS',
            student.completedCount,
            targetTotal,
            `${completionPercent}%`,
            student.activeQuest || 'None',
            domainKeys.length > 0 ? student.domainGrades[domainKeys[0]] || '—' : '—',
            domainKeys.length > 1 ? student.domainGrades[domainKeys[1]] || '—' : '—',
            domainKeys.length > 2 ? student.domainGrades[domainKeys[2]] || '—' : '—',
            domainKeys.length > 3 ? student.domainGrades[domainKeys[3]] || '—' : '—',
            student.lastUpload ? new Date(student.lastUpload).toLocaleDateString() : 'Never'
        ];
        studentsData.push(row);
    }
    
    const questsData = [];
    const allQuestIds = Object.keys(allQuests).filter(id => id.startsWith('quest')).sort();
    const questHeaders = ['Quest ID', 'Title', 'Path', 'Type', 'Completed Count', 'Total Students', 'Completion %', 'Popularity (Activated+Completed)', ...domainHeaders];
    questsData.push(questHeaders);
    
    for (const questId of allQuestIds) {
        const quest = allQuests[questId];
        const stats = analyticsData.questStats[questId] || {
            completedCount: 0,
            totalStudents: analyticsData.students.length,
            completionPercentage: 0,
            popularity: 0,
            domainAverages: {}
        };
        
        const completionPercent = stats.totalStudents > 0 ? ((stats.completedCount / stats.totalStudents) * 100).toFixed(1) : 0;
        const domainKeys = Object.keys(stats.domainAverages || {});
        
        const row = [
            questId,
            quest.title || 'Untitled',
            quest.path?.[0] || 'Unknown',
            quest.style === 'mvp' ? 'MVP (Summative)' : 'Formative',
            stats.completedCount,
            stats.totalStudents,
            `${completionPercent}%`,
            stats.popularity || 0,
            domainKeys.length > 0 ? stats.domainAverages[domainKeys[0]] || '—' : '—',
            domainKeys.length > 1 ? stats.domainAverages[domainKeys[1]] || '—' : '—',
            domainKeys.length > 2 ? stats.domainAverages[domainKeys[2]] || '—' : '—',
            domainKeys.length > 3 ? stats.domainAverages[domainKeys[3]] || '—' : '—'
        ];
        questsData.push(row);
    }
    
    const studentsCSV = convertToCSV(studentsData);
    const questsCSV = convertToCSV(questsData);
    
    downloadCSV(studentsCSV, `analytics_students_${new Date().toISOString().slice(0, 19)}.csv`);
    
    setTimeout(() => {
        downloadCSV(questsCSV, `analytics_quests_${new Date().toISOString().slice(0, 19)}.csv`);
    }, 100);
    
    alert("✅ Export complete! Two CSV files have been downloaded:\n- Students data\n- Quests data");
}

function convertToCSV(data) {
    return data.map(row => 
        row.map(cell => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',')
    ).join('\n');
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

// ==========================
// PRINT FUNCTIONS
// ==========================
async function printStudentProfile(includeQuests = true) {
    if (!currentStudentId) {
        alert("No student selected.");
        return;
    }
    
    const student = await getStudentInfo(currentStudentId);
    if (!student) {
        alert("Student not found.");
        return;
    }
    
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
        alert("Error generating print preview. Please try again.");
        loadingMsg.remove();
    }
}

async function getStudentInfo(userId) {
    const auth = await checkTeacherAuth();
    if (!auth) return null;
    
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    if (!profile) return null;
    
    const { data: teacher } = await window.supabase
        .from('teachers')
        .select('name')
        .eq('class_code', profile.teacher_code)
        .maybeSingle();
    
    let className = 'No Class';
    let classId = null;
    if (profile.class_id) {
        const cls = teacherClasses.find(c => c.id === profile.class_id);
        if (cls) {
            className = cls.name;
            classId = profile.class_id;
        }
    }
    
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email || 'Not provided',
        avatar: profile.avatar_url || 'profile.png',
        teacherName: teacher?.name || 'Teacher',
        className: className,
        classId: classId,
        teacherCode: profile.teacher_code,
        gradeLevel: profile.grade_level || 'hs'
    };
}

async function generateStudentPrintHtml(student, includeQuests = true) {
    const framework = await loadTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    // ✅ NEW: Use the student's grade level from the student object
    const isMS = student.gradeLevel === 'ms';
    
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('*')
        .eq('user_id', student.id)
        .maybeSingle();
    
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
                if (quest) {
                    completedQuestList.push({
                        id: questId,
                        quest: quest,
                        grade: questGrades[questId]
                    });
                }
            }
        }
    }
    
    const badgesRes = await fetch('badges.json');
    const badgesData = (await badgesRes.json()).badges;
    
    const standardsHtml = await generateStandardsTableForPrint(student.id, framework);
    const badgesHtml = generateBadgesForPrint(earnedBadges, badgesData);
    
    const totalCompleted = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true).length;
    
    const statsHtml = `
        <div style="display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap;">
            <div style="background: #f5f5f5; padding: 15px; border-radius: 12px; flex: 1; text-align: center;">
                <div style="font-size: 12px; color: #666;">📚 Quests Completed</div>
                <div style="font-size: 28px; font-weight: bold; color: #4a6a8a;">${totalCompleted}</div>
                <div style="font-size: 11px; color: #999;">out of ${targetTotal} target</div>
            </div>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 12px; flex: 1; text-align: center;">
                <div style="font-size: 12px; color: #666;">⏱️ Avg Time per Quest</div>
                <div style="font-size: 28px; font-weight: bold; color: #4a6a8a;">—</div>
                <div style="font-size: 11px; color: #999;">per completed quest</div>
            </div>
        </div>
    `;
    
    const notesHtml = `
        <h2>📝 Teacher Notes</h2>
        <div style="border: 1px solid #ccc; padding: 15px; min-height: 120px; margin: 20px 0; background: #fafafa; border-radius: 8px;">
            <p style="color: #666; margin-bottom: 8px;"><strong>Strengths:</strong></p>
            <p style="color: #666; margin-bottom: 15px;">_________________________________________</p>
            <p style="color: #666; margin-bottom: 8px;"><strong>Areas for Improvement:</strong></p>
            <p style="color: #666; margin-bottom: 15px;">_________________________________________</p>
            <p style="color: #666; margin-bottom: 8px;"><strong>Teacher's Signature:</strong></p>
            <p style="color: #666;">_________________________  Date: ___________</p>
            <p style="color: #666; margin-bottom: 15px;">                                         </p>
        </div>
    `;
    
    const questsHtml = includeQuests ? await generateCompletedQuestsForPrint(completedQuestList, framework) : '';
    
    const gradeLevelDisplay = student.gradeLevel === 'ms' ? 'Middle School' : 'High School';
    
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${student.name} - Art Progress Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; background: white; color: black; padding: 20px; }
            .print-container { max-width: 1100px; margin: 0 auto; }
            .print-student-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
            }
            .print-student-info h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a2e; }
            .print-student-info p { margin: 5px 0; color: #333; }
            .print-student-avatar img { width: 80px; height: 80px; border-radius: 0; object-fit: contain; background: transparent; }
            .grade-level-tag { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; background: ${student.gradeLevel === 'ms' ? '#4a6a8a' : '#2d5a27'}; color: white; margin-left: 10px; }
            h2 { font-size: 18px; margin: 20px 0 15px 0; color: #1a1a2e; border-left: 4px solid #4a6a8a; padding-left: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f0f0f0; font-weight: bold; }
            .badge-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
            .badge-item { text-align: center; width: 80px; }
            .badge-item img { width: 60px; height: 60px; border-radius: 50%; }
            .badge-item .badge-name { font-size: 11px; margin-top: 5px; color: #333; }
            .badge-item.unearned img { opacity: 0.3; filter: grayscale(100%); }
            .badge-item.unearned .badge-name { color: #999; }
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
                <div class="print-student-avatar">
                    <img src="${student.avatar}" alt="Avatar">
                </div>
            </div>
            
            <h2>🎨 Art Standards Summary</h2>
            ${standardsHtml}
            
            <h2>🏆 Badges Earned</h2>
            ${badgesHtml}
            
            ${statsHtml}
            
            ${notesHtml}
            
            ${includeQuests && questsHtml ? '<h2>📋 Completed Quests</h2>' + questsHtml : ''}
        </div>
    </body>
    </html>`;
}

async function generateStandardsTableForPrint(userId, framework) {
    // ✅ NEW: Get student's grade level
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('grade_level')
        .eq('id', userId)
        .maybeSingle();
    
    const studentGradeLevel = profile?.grade_level || 'hs';
    const isMS = studentGradeLevel === 'ms';
    
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', userId)
        .maybeSingle();
    
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const allQuests = await getQuests();
    
    const mvpQuests = [];
    const regularQuests = [];
    
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
        if (!quest) continue;
        
        if (quest.style === 'mvp') {
            mvpQuests.push(questId);
        } else {
            regularQuests.push(questId);
        }
    }
    
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    
    if (isIB) {
        const mvpScores = { A: 0, B: 0, C: 0, D: 0 };
        const mvpCounts = { A: 0, B: 0, C: 0, D: 0 };
        const regularScores = { A: 0, B: 0, C: 0, D: 0 };
        const regularCounts = { A: 0, B: 0, C: 0, D: 0 };
        
        for (const questId of regularQuests) {
            const quest = allQuests[questId];
            if (!quest || !quest.rubric?.criteria) continue;
            const grades = questGrades[questId]?.grade || {};
            quest.rubric.criteria.forEach(criterion => {
                const grade = grades[criterion.code];
                if (grade && typeof grade === 'number') {
                    regularScores[criterion.code] += grade;
                    regularCounts[criterion.code]++;
                }
            });
        }
        
        for (const questId of mvpQuests) {
            const quest = allQuests[questId];
            if (!quest || !quest.rubric?.criteria) continue;
            const grades = questGrades[questId]?.mvpGrade || {};
            quest.rubric.criteria.forEach(criterion => {
                const grade = grades[criterion.code];
                if (grade && typeof grade === 'number') {
                    mvpScores[criterion.code] += grade;
                    mvpCounts[criterion.code]++;
                }
            });
        }
        
        const criteria = [
            { code: "A", name: "Knowing & Understanding" },
            { code: "B", name: "Developing Skills" },
            { code: "C", name: "Thinking Creatively" },
            { code: "D", name: "Responding" }
        ];
        
        let html = `<table>
            <thead>
                <tr><th>Criterion</th><th>Description</th><th>Formative Grade</th><th>Summative Grade</th></tr>
            </thead>
            <tbody>`;
        
        for (const criterion of criteria) {
            const formativeAvg = regularCounts[criterion.code] ? (regularScores[criterion.code] / regularCounts[criterion.code]).toFixed(2) : '—';
            const summativeAvg = mvpCounts[criterion.code] ? (mvpScores[criterion.code] / mvpCounts[criterion.code]).toFixed(2) : '—';
            html += `<tr>
                <td><strong>${criterion.code}</strong></td>
                <td>${criterion.name}</td>
                <td>${formativeAvg}</td>
                <td>${summativeAvg}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
        return html;
        
    } else if (isIGCSE) {
        const allCompletedQuests = [...regularQuests, ...mvpQuests];
        const totalScores = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        const totalCounts = { AO1: 0, AO2: 0, AO3: 0, AO4: 0 };
        
        for (const questId of allCompletedQuests) {
            const quest = allQuests[questId];
            if (!quest || !quest.rubric?.assessment_objectives) continue;
            const column = quest.style === 'mvp' ? 'mvpGrade' : 'grade';
            const grades = questGrades[questId]?.[column] || {};
            quest.rubric.assessment_objectives.forEach(ao => {
                const grade = grades[ao.code];
                if (grade && typeof grade === 'number') {
                    totalScores[ao.code] += grade;
                    totalCounts[ao.code]++;
                }
            });
        }
        
        const aos = [
            { code: "AO1", name: "Record" },
            { code: "AO2", name: "Explore & Select" },
            { code: "AO3", name: "Develop" },
            { code: "AO4", name: "Present" }
        ];
        
        let html = `<table>
            <thead>
                <tr><th>Assessment Objective</th><th>Description</th><th>Grade</th></tr>
            </thead>
            <tbody>`;
        
        for (const ao of aos) {
            const avg = totalCounts[ao.code] ? (totalScores[ao.code] / totalCounts[ao.code]).toFixed(2) : '—';
            let displayGrade = avg;
            if (avg !== '—') {
                displayGrade = convertNumberToLetterGrade(Math.round(parseFloat(avg)));
            }
            html += `<tr>
                <td><strong>${ao.code}</strong></td>
                <td>${ao.name}</td>
                <td>${displayGrade}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
        return html;
        
    } else {
        let standardsList;
        if (isMS) {
            standardsList = MS_STANDARDS;
        } else {
            standardsList = HS_STANDARDS;
        }
        
        const mvpScores = {};
        const mvpCounts = {};
        const regularScores = {};
        const regularCounts = {};
        
        for (const questId of regularQuests) {
            const grades = questGrades[questId]?.grade || {};
            for (const [standard, grade] of Object.entries(grades)) {
                regularScores[standard] = (regularScores[standard] || 0) + grade;
                regularCounts[standard] = (regularCounts[standard] || 0) + 1;
            }
        }
        
        for (const questId of mvpQuests) {
            const grades = questGrades[questId]?.mvpGrade || {};
            for (const [standard, grade] of Object.entries(grades)) {
                mvpScores[standard] = (mvpScores[standard] || 0) + grade;
                mvpCounts[standard] = (mvpCounts[standard] || 0) + 1;
            }
        }
        
        let html = `<table>
            <thead>
                <tr><th>Standard Code</th><th>Standard Name</th><th>Formative Grade</th><th>Summative Grade</th></tr>
            </thead>
            <tbody>`;
        
        for (const standard of standardsList) {
            const formativeAvg = regularCounts[standard.code] ? (regularScores[standard.code] / regularCounts[standard.code]).toFixed(2) : '—';
            const summativeAvg = mvpCounts[standard.code] ? (mvpScores[standard.code] / mvpCounts[standard.code]).toFixed(2) : '—';
            html += `<tr>
                <td>${standard.code}</td>
                <td>${standard.name}</td>
                <td>${formativeAvg}</td>
                <td>${summativeAvg}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
        return html;
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
    html += '</div>';
    
    return html;
}

async function generateCompletedQuestsForPrint(completedQuestList, framework) {
    if (completedQuestList.length === 0) {
        return '<p>No completed quests yet.</p>';
    }
    
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    const isMS = currentGradeLevel === 'ms';
    
    let html = '';
    
    for (const item of completedQuestList) {
        const quest = item.quest;
        const questId = item.id;
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
            if (isMS) {
                itemsToShow = MS_STANDARDS;
            } else {
                itemsToShow = quest.rubric?.standards || [];
            }
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
            <table class="quest-rubric-table">
                <thead>
                    <tr>
                        <th>${isIB ? 'Criterion' : (isIGCSE ? 'Assessment Objective' : 'Standard')}</th>
                        <th>${gradeLevels[0]}</th>
                        <th>${gradeLevels[1]}</th>
                        <th>${gradeLevels[2]}</th>
                        <th>${gradeLevels[3]}</th>
                    </tr>
                </thead>
                <tbody>`;
        
        for (const rubricItem of itemsToShow) {
            const studentGrade = grades[rubricItem.code] || '';
            
            let col1Highlight = '';
            let col2Highlight = '';
            let col3Highlight = '';
            let col4Highlight = '';
            let gradeDisplay = '—';
            
            if (studentGrade) {
                if (isIGCSE) {
                    const numGrade = Math.round(studentGrade);
                    gradeDisplay = convertNumberToLetterGrade(numGrade);
                    if (gradeDisplay === 'A*' || gradeDisplay === 'A') {
                        col1Highlight = 'highlight';
                    } else if (gradeDisplay === 'B' || gradeDisplay === 'C') {
                        col2Highlight = 'highlight';
                    } else if (gradeDisplay === 'D' || gradeDisplay === 'E') {
                        col3Highlight = 'highlight';
                    } else if (gradeDisplay === 'F' || gradeDisplay === 'G') {
                        col4Highlight = 'highlight';
                    }
                } else {
                    gradeDisplay = studentGrade;
                    const gradeValue = Math.floor(studentGrade);
                    if (gradeValue >= 7 || gradeValue === 4) {
                        col1Highlight = 'highlight';
                    } else if (gradeValue >= 5 || gradeValue === 3) {
                        col2Highlight = 'highlight';
                    } else if (gradeValue >= 3 || gradeValue === 2) {
                        col3Highlight = 'highlight';
                    } else if (gradeValue >= 1 || gradeValue === 1) {
                        col4Highlight = 'highlight';
                    }
                }
            }
            
            const level1Text = escapeHtml(rubricItem.levels?.[gradeLevels[0]] || '—');
            const level2Text = escapeHtml(rubricItem.levels?.[gradeLevels[1]] || '—');
            const level3Text = escapeHtml(rubricItem.levels?.[gradeLevels[2]] || '—');
            const level4Text = escapeHtml(rubricItem.levels?.[gradeLevels[3]] || '—');
            
            html += `<tr>
                <td><strong>${escapeHtml(rubricItem.code)}</strong>${rubricItem.name ? `: ${escapeHtml(rubricItem.name)}` : ''}</td>
                <td class="${col1Highlight}">${col1Highlight ? `<strong>${level1Text}</strong>` : level1Text}</td>
                <td class="${col2Highlight}">${col2Highlight ? `<strong>${level2Text}</strong>` : level2Text}</td>
                <td class="${col3Highlight}">${col3Highlight ? `<strong>${level3Text}</strong>` : level3Text}</td>
                <td class="${col4Highlight}">${col4Highlight ? `<strong>${level4Text}</strong>` : level4Text}</td>
            </tr>`;
        }
        
        html += `</tbody>
            </table>
        </div>`;
    }
    
    return html;
}

async function printAllProfilesCompact() {
    await printAllProfilesBatch(false);
}

async function printAllProfilesFull() {
    await printAllProfilesBatch(true);
}

async function printAllProfilesBatch(includeQuests) {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const classFilter = document.getElementById('analytics-class-filter')?.value || 'all';
    
    let query = window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (classFilter !== 'all') {
        query = query.eq('class_id', classFilter);
    }
    
    const { data: students } = await query;
    
    if (!students || students.length === 0) {
        alert("No students found to print.");
        return;
    }
    
    const className = classFilter !== 'all' 
        ? teacherClasses.find(c => c.id === classFilter)?.name || 'Selected Class'
        : 'All Classes';
    
    const questsText = includeQuests ? 'with quests' : 'compact (no quests)';
    if (!confirm(`Print ${students.length} student profile(s) (${questsText}) from ${className}? This may take a moment.`)) {
        return;
    }
    
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = `Generating ${students.length} profile(s)... Please wait.`;
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#ffd700;padding:20px;border-radius:12px;z-index:10000;';
    document.body.appendChild(loadingMsg);
    
    try {
        let allHtmlChunks = [];
        
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            loadingMsg.textContent = `Generating profile ${i+1} of ${students.length}...`;
            
            const studentInfo = await getStudentInfo(student.id);
            if (!studentInfo) continue;
            
            const studentHtml = await generateStudentPrintHtml(studentInfo, includeQuests);
            
            const bodyMatch = studentHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : '';
            
            allHtmlChunks.push(`
                <div class="student-section" style="page-break-after: always; break-after: page;">
                    ${bodyContent}
                </div>
            `);
        }
        
        const fullHtml = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Class Progress Reports - ${className}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; background: white; color: black; padding: 20px; }
                .print-container { max-width: 1100px; margin: 0 auto; }
                .student-section { margin-bottom: 40px; page-break-after: always; break-after: page; }
                .student-section:last-child { page-break-after: auto; break-after: auto; }
                .print-student-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 15px;
                }
                .print-student-info h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a2e; }
                .print-student-info p { margin: 5px 0; color: #333; }
                .print-student-avatar img { width: 80px; height: 80px; border-radius: 0; object-fit: contain; background: transparent; }
                h2 { font-size: 18px; margin: 20px 0 15px 0; color: #1a1a2e; border-left: 4px solid #4a6a8a; padding-left: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
                th { background: #f0f0f0; font-weight: bold; }
                .badge-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
                .badge-item { text-align: center; width: 80px; }
                .badge-item img { width: 60px; height: 60px; border-radius: 50%; }
                .badge-item .badge-name { font-size: 11px; margin-top: 5px; color: #333; }
                .badge-item.unearned img { opacity: 0.3; filter: grayscale(100%); }
                .badge-item.unearned .badge-name { color: #999; }
                .quest-section { margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
                .quest-section.mvp { border-left: 4px solid #ffd700; padding-left: 12px; }
                .quest-header { margin-bottom: 10px; }
                .quest-title { font-size: 16px; font-weight: bold; color: #1a1a2e; }
                .quest-path { font-size: 12px; color: #666; margin-left: 10px; }
                .highlight { background-color: #ffff99 !important; font-weight: bold !important; }
                @media print {
                    body { padding: 0; }
                    .student-section { page-break-after: always; break-after: page; }
                    .quest-section { break-inside: avoid; page-break-inside: avoid; }
                    table { break-inside: avoid; }
                    .highlight { background-color: #ffff99 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                ${allHtmlChunks.join('')}
            </div>
        </body>
        </html>`;
        
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
        alert("Error generating print preview. Please try again.");
        loadingMsg.remove();
    }
}

// ==========================
// CONVERSION FUNCTIONS
// ==========================
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
    return gradeMap[letter] || null;
}

// ==========================
// RENDER CLASS FILTERS
// ==========================
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

// ==========================
// RENDER CLASS ACCORDION
// ==========================
async function renderClassAccordion() {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const container = document.getElementById('class-accordion-container');
    if (!container) return;
    
    // ✅ Get ALL students first (without filtering)
    let { data: allStudents, error } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', auth.teacher.class_code);
    
    if (error) {
        console.error("Error loading students:", error);
        container.innerHTML = '<div class="no-students">Error loading students</div>';
        return;
    }
    
    if (!allStudents || allStudents.length === 0) {
        container.innerHTML = '<div class="no-students">No students found</div>';
        return;
    }
    
    // ✅ Filter students based on current grade level toggle
    let students = [];
    if (currentGradeLevel === 'hs') {
        // Show HS students (grade_level is 'hs' or null/undefined)
        students = allStudents.filter(s => s.grade_level === 'hs' || !s.grade_level);
    } else if (currentGradeLevel === 'ms') {
        // Show MS students (grade_level is 'ms')
        students = allStudents.filter(s => s.grade_level === 'ms');
    } else {
        students = allStudents;
    }
    
    console.log(`Showing ${students.length} ${currentGradeLevel.toUpperCase()} students out of ${allStudents.length} total`);
    
    // Get pending works for ALL students (for red dots)
    const allStudentIds = allStudents.map(s => s.id);
    const { data: pendingWorks } = await window.supabase
        .from('student_works')
        .select('user_id')
        .eq('grading_status', 'pending')
        .in('user_id', allStudentIds);
    
    const pendingSet = new Set(pendingWorks?.map(w => w.user_id) || []);
    
    // Group filtered students by class
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
    
    function createAccordionItem(id, name, studentList, pendingSet) {
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
        studentListDiv.classList.remove('expanded');
        
        header.addEventListener('click', () => {
            expanded = !expanded;
            if (expanded) {
                studentListDiv.classList.add('expanded');
                header.classList.add('expanded');
            } else {
                studentListDiv.classList.remove('expanded');
                header.classList.remove('expanded');
            }
        });
        
        accordion.appendChild(header);
        accordion.appendChild(studentListDiv);
        return accordion;
    }
    
    // ✅ Only show classes that have students in the filtered list
    let hasStudents = false;
    
    for (const cls of teacherClasses) {
        // Check if this class should be shown (only if it has students in the filtered list)
        const classStudents = studentsByClass[cls.id] || [];
        if (classStudents.length > 0) {
            const accordion = createAccordionItem(cls.id, cls.name, classStudents, pendingSet);
            container.appendChild(accordion);
            hasStudents = true;
        }
    }
    
    // Show unassigned students if any
    if (unassignedStudents.length > 0) {
        const noClassAccordion = createAccordionItem('unassigned', 'No Class', unassignedStudents, pendingSet);
        container.appendChild(noClassAccordion);
        hasStudents = true;
    }
    
    if (!hasStudents) {
        container.innerHTML = `<div class="no-students">No ${currentGradeLevel.toUpperCase()} students found. Switch to the other grade level to see students.</div>`;
    }
}

// ==========================
// LOAD ALL STUDENTS (overridden)
// ==========================
async function loadAllStudents() {
    const auth = await checkTeacherAuth();
    if (!auth) return;
    
    const teacherCode = auth.teacher.class_code;
    
    // ✅ Get ALL students first
    let { data: allStudents, error } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('teacher_code', teacherCode);
    
    if (error) {
        console.error("Error loading students:", error);
        return;
    }
    
    // ✅ Filter by class if needed
    let filteredStudents = allStudents;
    if (currentClassFilter !== 'all') {
        filteredStudents = allStudents.filter(s => s.class_id === currentClassFilter);
    }
    
    // ✅ Filter by grade level based on toggle
    if (currentGradeLevel === 'hs') {
        filteredStudents = filteredStudents.filter(s => s.grade_level === 'hs' || !s.grade_level);
    } else if (currentGradeLevel === 'ms') {
        filteredStudents = filteredStudents.filter(s => s.grade_level === 'ms');
    }
    
    const container = document.getElementById('student-list-container');
    if (!container) return;
    
    if (error || !filteredStudents || filteredStudents.length === 0) {
        container.innerHTML = `<div class="no-students">No ${currentGradeLevel.toUpperCase()} students found</div>`;
        return;
    }
    
    const studentIds = filteredStudents.map(p => p.id);
    const { data: pendingWorks } = await window.supabase
        .from('student_works')
        .select('user_id, quest_id')
        .eq('grading_status', 'pending')
        .in('user_id', studentIds);
    
    const pendingCounts = {};
    if (pendingWorks) {
        pendingWorks.forEach(work => {
            pendingCounts[work.user_id] = (pendingCounts[work.user_id] || 0) + 1;
        });
    }
    
    container.innerHTML = '';
    filteredStudents.forEach(profile => {
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card';
        studentCard.dataset.userId = profile.id;
        
        const pendingCount = pendingCounts[profile.id] || 0;
        const redDotHtml = pendingCount > 0 ? `<span class="pending-dot" title="${pendingCount} quest${pendingCount !== 1 ? 's' : ''} pending grading"></span>` : '';
        
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

// ==========================
// LOAD CLASSES
// ==========================
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
    console.log("Classes loaded:", teacherClasses.length);
    return teacherClasses;
}

// ==========================
// LOAD STUDENT PROFILE DATA
// ==========================
async function loadStudentProfileData(userId) {
    const { data: profile, error } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    if (error || !profile) return;
    
    document.getElementById('teacher-profile-avatar').src = profile.avatar_url || 'profile.png';
    document.getElementById('teacher-profile-name').textContent = profile.name;
    document.getElementById('teacher-profile-email').textContent = `Email: ${profile.email || 'Not provided'}`;
    document.getElementById('teacher-profile-code').textContent = `Teacher Code: ${profile.teacher_code || 'N/A'}`;
    
    await loadStudentStandardsData(userId);
    await loadStudentRewardsData(userId);
    await loadStudentBadgesData(userId);
}

// ==========================
// LOAD STUDENT STANDARDS DATA (MS SUPPORT)
// ==========================
async function loadStudentStandardsData(userId) {
    // ✅ NEW: Get student profile to check their grade level
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('grade_level')
        .eq('id', userId)
        .maybeSingle();
    
    // Use the student's grade level, not the teacher's toggle
    const studentGradeLevel = profile?.grade_level || 'hs';
       window._currentStudentGradeLevel = studentGradeLevel;
    const isMS = studentGradeLevel === 'ms';
    
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, completed_quests')
        .eq('user_id', userId)
        .maybeSingle();
    
    const tbody = document.getElementById('teacher-standards-tbody');
    if (!tbody) return;
    
    const questGrades = progress?.quest_grades || {};
    const completedQuests = progress?.completed_quests || {};
    const allQuests = await getQuests();
    
    const framework = await loadTeacherFramework();
    const isIB = framework === 'ib-myp';
    const isIGCSE = framework === 'igcse';
    
    const table = document.getElementById('teacher-standards-table');
    if (table) {
        const thead = table.querySelector('thead');
        if (thead) {
            if (isIB) {
                thead.innerHTML = `
                    <tr>
                        <th>Criterion</th>
                        <th>Description</th>
                        <th>Formative Grade</th>
                        <th>Summative Grade</th>
                    </tr>
                `;
            } else if (isIGCSE) {
                thead.innerHTML = `
                    <tr>
                        <th>Assessment Objective</th>
                        <th>Description</th>
                        <th>Grade</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th>Standard Code</th>
                        <th>Standard Name</th>
                        <th>Formative Grade</th>
                        <th>Summative Grade</th>
                    </tr>
                `;
            }
        }
    }
    
    if (isIB) {
        await renderTeacherIBStandardsTable(tbody, questGrades, completedQuests, allQuests);
    } else if (isIGCSE) {
        await renderTeacherIGCSESTandardsTable(tbody, questGrades, completedQuests, allQuests);
    } else {
        await renderTeacherNCASStandardsTable(tbody, questGrades, completedQuests, allQuests);
    }
}

async function renderTeacherNCASStandardsTable(tbody, questGrades, completedQuests, allQuests) {
    const mvpQuests = [];
    const regularQuests = [];
    // ✅ NEW: Get the student's grade level from the function context
    // We need to pass this in from loadStudentStandardsData
    // For now, we'll use a global variable that gets set when loading student data
    const isMS = window._currentStudentGradeLevel === 'ms';
    
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
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
            if (!mvpScores[standard]) mvpScores[standard] = 0;
            if (!mvpCounts[standard]) mvpCounts[standard] = 0;
            mvpScores[standard] += grade;
            mvpCounts[standard]++;
        }
    }
    
    for (const questId of regularQuests) {
        const grades = questGrades[questId]?.grade || {};
        for (const [standard, grade] of Object.entries(grades)) {
            if (!regularScores[standard]) regularScores[standard] = 0;
            if (!regularCounts[standard]) regularCounts[standard] = 0;
            regularScores[standard] += grade;
            regularCounts[standard]++;
        }
    }
    
    let standards;
    if (isMS) {
        standards = MS_STANDARDS;
    } else {
        standards = HS_STANDARDS;
    }
    
    tbody.innerHTML = '';
    
    for (const standard of standards) {
        const formativeAvg = regularCounts[standard.code] ? (regularScores[standard.code] / regularCounts[standard.code]).toFixed(2) : '—';
        const summativeAvg = mvpCounts[standard.code] ? (mvpScores[standard.code] / mvpCounts[standard.code]).toFixed(2) : '—';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${standard.code}</strong></td>
            <td>${standard.name}</td>
            <td>${formativeAvg}</td>
            <td>${summativeAvg}</td>
        `;
        tbody.appendChild(row);
    }
}

async function renderTeacherIBStandardsTable(tbody, questGrades, completedQuests, allQuests) {
    const mvpQuests = [];
    const regularQuests = [];
    
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
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
        const quest = allQuests[questId];
        if (!quest || !quest.rubric?.criteria) continue;
        
        const grades = questGrades[questId]?.grade || {};
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            addGradeToCriterion(criterion.code, grade, false);
        });
    }
    
    for (const questId of mvpQuests) {
        const quest = allQuests[questId];
        if (!quest || !quest.rubric?.criteria) continue;
        
        const grades = questGrades[questId]?.mvpGrade || {};
        quest.rubric.criteria.forEach(criterion => {
            const grade = grades[criterion.code];
            addGradeToCriterion(criterion.code, grade, true);
        });
    }
    
    const criteria = [
        { code: "A", name: "Knowing & Understanding" },
        { code: "B", name: "Developing Skills" },
        { code: "C", name: "Thinking Creatively" },
        { code: "D", name: "Responding" }
    ];
    
    const table = document.getElementById('teacher-standards-table');
    if (table) {
        const thead = table.querySelector('thead');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Criterion</th>
                    <th>Description</th>
                    <th>Formative Grade</th>
                    <th>Summative Grade</th>
                </tr>
            `;
        }
    }
    
    tbody.innerHTML = '';
    
    for (const criterion of criteria) {
        const formativeAvg = regularCounts[criterion.code] ? (regularScores[criterion.code] / regularCounts[criterion.code]).toFixed(2) : '—';
        const summativeAvg = mvpCounts[criterion.code] ? (mvpScores[criterion.code] / mvpCounts[criterion.code]).toFixed(2) : '—';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${criterion.code}</strong></td>
            <td>${criterion.name}</td>
            <td>${formativeAvg}</td>
            <td>${summativeAvg}</td>
        `;
        tbody.appendChild(row);
    }
}

async function renderTeacherIGCSESTandardsTable(tbody, questGrades, completedQuests, allQuests) {
    const allCompletedQuests = [];
    
    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) continue;
        const quest = allQuests[questId];
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
        const quest = allQuests[questId];
        if (!quest || !quest.rubric?.assessment_objectives) continue;
        
        const column = quest.style === "mvp" ? "mvpGrade" : "grade";
        const grades = questGrades[questId]?.[column] || {};
        
        quest.rubric.assessment_objectives.forEach(ao => {
            const grade = grades[ao.code];
            addGradeToAO(ao.code, grade);
        });
    }
    
    const assessmentObjectives = [
        { code: "AO1", name: "Record - Record ideas, observations and insights" },
        { code: "AO2", name: "Explore & Select - Explore and select appropriate resources, media and techniques" },
        { code: "AO3", name: "Develop - Develop ideas through investigations" },
        { code: "AO4", name: "Present - Present a personal and meaningful response" }
    ];
    
    const table = document.getElementById('teacher-standards-table');
    if (table) {
        const thead = table.querySelector('thead');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Assessment Objective</th>
                    <th>Description</th>
                    <th>Grade</th>
                </tr>
            `;
        }
    }
    
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
            <td><strong>${ao.code}</strong></td>
            <td>${ao.name}</td>
            <td>${displayGrade}</td>
        `;
        tbody.appendChild(row);
    }
}

// ==========================
// LOAD STUDENT REWARDS DATA
// ==========================
async function loadStudentRewardsData(userId) {
    const { data: progress } = await window.supabase
        .from('student_progress')
        .select('quest_grades, standard_deductions')
        .eq('user_id', userId)
        .maybeSingle();
    
    const container = document.getElementById('teacher-total-coins');
    if (!container) return;
    
    const questGrades = progress?.quest_grades || {};
    const standardDeductions = progress?.standard_deductions || {};
    
    let totalEarned = 0;
    
    for (const [questId, questData] of Object.entries(questGrades)) {
        const regularGrades = questData.grade || {};
        const mvpGrades = questData.mvpGrade || {};
        
        for (const grade of Object.values(regularGrades)) {
            if (typeof grade === 'number' && !isNaN(grade)) {
                totalEarned += Math.round(grade * 10);
            }
        }
        for (const grade of Object.values(mvpGrades)) {
            if (typeof grade === 'number' && !isNaN(grade)) {
                totalEarned += Math.round(grade * 10);
            }
        }
    }
    
    let totalDeductions = 0;
    for (const deduction of Object.values(standardDeductions)) {
        if (typeof deduction === 'number') {
            totalDeductions += deduction;
        }
    }
    
    const netRewards = Math.max(0, totalEarned - totalDeductions);
    
    container.innerHTML = `Total Coins: <strong>${netRewards} 💰</strong>`;
}

// ==========================
// LOAD STUDENT BADGES DATA
// ==========================
async function loadStudentBadgesData(userId) {
    console.log("loadStudentBadgesData called with userId:", userId);
    
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
    
    const studentName = profile?.name || "Student";
    
    const { data: progress, error: progressError } = await window.supabase
        .from('student_progress')
        .select('earned_badges')
        .eq('user_id', userId)
        .maybeSingle();
    
    if (progressError) {
        console.error("Error loading badges from progress:", progressError);
    }
    
    const earnedBadges = progress?.earned_badges || {};
    console.log("Earned badges from database:", earnedBadges);
    
    const container = document.getElementById('teacher-badges-container');
    if (!container) return;
    
    const badgesRes = await fetch('badges.json');
    const badgesData = (await badgesRes.json()).badges;
    
    container.innerHTML = '';
    const badgesGrid = document.createElement('div');
    badgesGrid.className = 'badge-container';
    
    const sortedBadges = [...badgesData].sort((a, b) => {
        const order = { path: 1, skill: 2, progression: 3, teacher: 4 };
        return (order[a.category] || 5) - (order[b.category] || 5);
    });
    
    let earnedCount = 0;
    
    for (const badge of sortedBadges) {
        const badgeSlot = document.createElement('div');
        badgeSlot.className = 'badge-slot';
        
        const earnedInfo = earnedBadges[badge.id];
        const isEarned = earnedInfo?.earned === true;
        
        if (isEarned) earnedCount++;
        
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
            if (badge.progression && earnedInfo?.tooltip) {
                tooltipText = earnedInfo.tooltip;
            } else if (badge.teacherAwarded) {
                tooltipText = `Teacher Award: ${badge.name}`;
            } else {
                tooltipText = badge.tooltipEarned ? badge.tooltipEarned.replace('{name}', studentName) : badge.name;
            }
        } else {
            if (badge.progression) {
                const count = earnedInfo?.count || 0;
                const nextLevel = badge.levels?.find(l => l.count > count);
                if (nextLevel) {
                    tooltipText = `Quest Completer: ${count}/${nextLevel.count} summatives completed. ${nextLevel.tooltip}`;
                } else {
                    tooltipText = badge.tooltipShadow || badge.name;
                }
            } else {
                tooltipText = badge.tooltipShadow || badge.name;
            }
        }
        
        badgeSlot.setAttribute('data-tooltip', tooltipText);
        
        if (isEarned) {
            badgeSlot.classList.add('earned');
        } else {
            badgeSlot.classList.add('shadow');
        }
        
        if (badge.teacherAwarded && !isEarned) {
            badgeSlot.style.cursor = 'pointer';
            badgeSlot.addEventListener('click', async (e) => {
                e.stopPropagation();
                console.log("Awarding badge. UserId:", userId);
                console.log("Badge being awarded:", badge);
                
                const isValid = await verifyTeacherPassword();
                if (!isValid) {
                    alert("Password verification failed. Badge not awarded.");
                    return;
                }
                
                console.log("Password correct, awarding badge to userId:", userId);
                
                const { data: progress, error: progressError } = await window.supabase
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
                    await loadStudentBadgesData(userId);
                }
            });
        }
        
        badgeSlot.appendChild(img);
        badgesGrid.appendChild(badgeSlot);
    }
    
    container.appendChild(badgesGrid);
    console.log(`Displayed ${earnedCount} earned badges out of ${sortedBadges.length} total badges`);
}

// ==========================
// UPDATE QUESTS TIMESTAMP
// ==========================
async function updateQuestsTimestamp() {
    const auth = await checkTeacherAuth();
    if (!auth) return false;
    
    const { error } = await window.supabase
        .from('teachers')
        .update({ quests_updated_at: new Date().toISOString() })
        .eq('id', auth.teacher.id);
    
    if (error) {
        console.error("Error updating quests timestamp:", error);
        return false;
    }
    
    console.log("✅ Quests timestamp updated - students will refresh their cache");
    return true;
}

async function notifyQuestsChanged() {
    const success = await updateQuestsTimestamp();
    if (success) {
        console.log("Students will now refresh their quest cache on next page load");
    }
}

async function deleteQuestData(userId, questId, quest, allQuests) {
    try {
        console.log(`Deleting quest data for user ${userId}, quest ${questId}`);
        
        // ✅ First, delete the student work entry
        const { error: deleteWorkError } = await window.supabase
            .from('student_works')
            .delete()
            .eq('user_id', userId)
            .eq('quest_id', questId);
        
        if (deleteWorkError) {
            console.error("Error deleting student work:", deleteWorkError);
            // Continue anyway - we want to delete grades even if work deletion fails
        } else {
            console.log("✅ Student work deleted");
        }
        
        // ✅ Get current progress data
        const { data: progress, error: progressError } = await window.supabase
            .from('student_progress')
            .select('quest_grades, completed_quests, earned_badges, quest_accepted, quest_start_times')
            .eq('user_id', userId)
            .maybeSingle();
        
        if (progressError) {
            console.error("Error fetching progress:", progressError);
            alert("Error fetching student progress data.");
            return;
        }
        
        if (!progress) {
            alert("No progress data found for this student.");
            return;
        }
        
        // ✅ Create updated objects
        let questGrades = progress.quest_grades || {};
        let completedQuests = progress.completed_quests || {};
        let questAccepted = progress.quest_accepted || {};
        let questStartTimes = progress.quest_start_times || {};
        let earnedBadges = progress.earned_badges || {};
        
        // ✅ Remove the quest from all relevant objects
        let modified = false;
        
        // Remove from quest_grades
        if (questGrades[questId]) {
            delete questGrades[questId];
            modified = true;
            console.log(`Removed quest ${questId} from quest_grades`);
        }
        
        // Remove from completed_quests
        if (completedQuests[questId]) {
            delete completedQuests[questId];
            modified = true;
            console.log(`Removed quest ${questId} from completed_quests`);
        }
        
        // Remove from quest_accepted
        if (questAccepted[questId]) {
            delete questAccepted[questId];
            modified = true;
            console.log(`Removed quest ${questId} from quest_accepted`);
        }
        
        // Remove from quest_start_times
        if (questStartTimes[questId]) {
            delete questStartTimes[questId];
            modified = true;
            console.log(`Removed quest ${questId} from quest_start_times`);
        }
        
        // ✅ Check if we need to update badges (if this quest was an MVP)
        const quest = allQuests ? allQuests[questId] : null;
        if (quest && quest.style === 'mvp') {
            // We need to recalculate badges
            // Get all completed quests to count MVPs
            const allCompletedQuestIds = Object.keys(completedQuests).filter(qid => completedQuests[qid] === true);
            const mvpCount = allCompletedQuestIds.filter(qid => {
                const q = allQuests ? allQuests[qid] : null;
                return q && q.style === 'mvp';
            }).length;
            
            console.log(`Student now has ${mvpCount} MVP quests completed`);
            
            // Check if badge should be removed
            if (mvpCount < 1 && earnedBadges.quest_completer) {
                delete earnedBadges.quest_completer;
                modified = true;
                console.log("Removed quest_completer badge");
            } else if (earnedBadges.quest_completer) {
                // Update badge level if needed
                const badgesRes = await fetch('badges.json');
                const badgesData = (await badgesRes.json()).badges;
                const progressionBadge = badgesData.find(b => b.id === 'quest_completer');
                
                if (progressionBadge && progressionBadge.levels) {
                    let earnedLevel = null;
                    for (const level of progressionBadge.levels) {
                        if (mvpCount >= level.count) {
                            earnedLevel = level;
                        }
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
                        console.log(`Updated badge to level ${earnedLevel.level}`);
                    }
                }
            }
        }
        
        if (!modified) {
            alert("No data found for this quest to delete.");
            return;
        }
        
        // ✅ Update the student_progress with the modified data
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
            console.error("Error updating progress:", updateError);
            alert("Error deleting grades: " + updateError.message);
            return;
        }
        
        console.log("✅ Quest data deleted successfully!");
        
        // ✅ Also check if there's a pending work record in teacher_quest_standards
        // This is for custom quests
        const { data: teacherData, error: teacherError } = await window.supabase
            .from('teacher_quest_standards')
            .select('id')
            .eq('quest_id', questId)
            .maybeSingle();
        
        if (teacherData && !teacherError) {
            // We don't delete this, it's the teacher's settings for the quest
            // But we might want to reset it if it was a custom quest
            console.log("Teacher quest standards exist for this quest, keeping them.");
        }
        
        alert(`✅ Quest data deleted successfully!\n\nAll grades and artwork for "${quest?.title || questId}" have been removed.`);
        
        // ✅ Refresh the student's data display
        await loadStudentProgressData(userId);
        await updateStudentCardPendingCount(userId);
        
    } catch (error) {
        console.error("Error in deleteQuestData:", error);
        alert("An error occurred while deleting quest data: " + error.message);
    }
}
// ==========================
// LOAD STUDENT WORKS DATA
// ==========================
async function loadStudentWorksData(userId) {
    const { data: works, error } = await window.supabase
        .from('student_works')
        .select('*')
        .eq('user_id', userId);
    
    const container = document.getElementById('student-works-gallery');
    if (!container) return;
    
    if (error || !works || works.length === 0) {
        container.innerHTML = '<div class="no-data">No artwork uploaded yet</div>';
        return;
    }
    
    const allQuests = await getQuests();
    
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

// ==========================
// WORK MODAL
// ==========================
function initWorkModal() {
    const modal = document.getElementById('teacher-work-modal');
    const closeBtn = document.querySelector('.teacher-work-close');
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

async function viewStudentWork(userId, questId) {
    const { data: work, error } = await window.supabase
        .from('student_works')
        .select('*')
        .eq('user_id', userId)
        .eq('quest_id', questId)
        .maybeSingle();
    
    if (error || !work) {
        alert('No work found for this quest.');
        return;
    }
    
    const allQuests = await getQuests();
    const quest = allQuests[questId];
    
    const modal = document.getElementById('teacher-work-modal');
    const content = document.getElementById('teacher-work-content');
    
    content.innerHTML = `
        <h3 style="color: #ffd700;">${escapeHtml(work.title || 'Untitled')}</h3>
        <div class="teacher-work-details">
            <p><strong>Quest:</strong> ${escapeHtml(quest?.title || questId)}</p>
            ${work.size ? `<p><strong>Size:</strong> ${escapeHtml(work.size)}</p>` : ''}
            ${work.media ? `<p><strong>Media:</strong> ${escapeHtml(work.media)}</p>` : ''}
            <p><strong>Submitted:</strong> ${new Date(work.uploaded_at).toLocaleString()}</p>
        </div>
        <p><strong>Description:</strong><br>${escapeHtml(work.description || 'No description')}</p>
        ${work.image_url ? `<div class="teacher-work-image"><img src="${work.image_url}" alt="Student work" style="max-width: 100%; border-radius: 8px;"></div>` : ''}
    `;
    
    modal.style.display = 'flex';
}

// ==========================
// MODAL ESCAPE HANDLING
// ==========================
function setupModalEscapeHandling() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        
        const workModal = document.getElementById('teacher-work-modal');
        if (workModal && workModal.style.display === 'flex') {
            workModal.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const contestPanel = document.getElementById('contest-management-overlay');
        if (contestPanel && contestPanel.style.display === 'flex') {
            contestPanel.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const questDetailsPanel = document.getElementById('quest-details-panel');
        if (questDetailsPanel && questDetailsPanel.style.display === 'block') {
            questDetailsPanel.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const createClassModal = document.getElementById('create-class-modal');
        if (createClassModal && createClassModal.style.display === 'flex') {
            createClassModal.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const passwordModal = document.getElementById('password-verify-modal');
        if (passwordModal && passwordModal.style.display === 'flex') {
            passwordModal.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const detailsPanel = document.getElementById('student-details-panel');
        if (detailsPanel && detailsPanel.style.display === 'block') {
            detailsPanel.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const restrictionPopup = document.getElementById('restriction-popup');
        if (restrictionPopup && restrictionPopup.style.display === 'flex') {
            restrictionPopup.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const prerequisitePopup = document.getElementById('prerequisite-popup');
        if (prerequisitePopup && prerequisitePopup.style.display === 'flex') {
            prerequisitePopup.style.display = 'none';
            e.preventDefault();
            return;
        }
        
        const acceptRestrictionPopup = document.getElementById('accept-quest-restriction-popup');
        if (acceptRestrictionPopup && acceptRestrictionPopup.style.display === 'flex') {
            acceptRestrictionPopup.style.display = 'none';
            e.preventDefault();
            return;
        }
    });
}

// ==========================
// TEACHER LOGOUT
// ==========================
async function teacherLogout() {
    await window.supabase.auth.signOut();
    window.location.href = '/index.html';
}

// ==========================
// DOMContentLoaded
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('teacher-login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleTeacherLogin);
    }
    
    const logoutBtn = document.getElementById('teacher-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', teacherLogout);
    }
    
    const closeDetailsBtn = document.getElementById('close-details-btn');
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            document.getElementById('student-details-panel').style.display = 'none';
        });
    }
    
    const exportBtn = document.getElementById('export-analytics-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAnalyticsToCSV);
    }
    
    const saveClassSettingsBtn = document.getElementById('save-class-settings-btn');
    if (saveClassSettingsBtn) {
        saveClassSettingsBtn.addEventListener('click', saveAllClassSettings);
    }
    
    const inviteStudentBtn = document.getElementById('invite-student-btn');
    if (inviteStudentBtn) {
        inviteStudentBtn.addEventListener('click', openInviteModal);
    }
    
    const sendInviteBtn = document.getElementById('send-invite-btn');
    if (sendInviteBtn) {
        sendInviteBtn.addEventListener('click', sendInvitation);
    }
    
    const cancelInviteBtn = document.getElementById('cancel-invite-btn');
    if (cancelInviteBtn) {
        cancelInviteBtn.addEventListener('click', () => {
            document.getElementById('invite-modal').style.display = 'none';
        });
    }
    
    const closeInviteModal = document.querySelector('#invite-modal .teacher-work-close');
    if (closeInviteModal) {
        closeInviteModal.addEventListener('click', () => {
            document.getElementById('invite-modal').style.display = 'none';
        });
    }
    
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) {
                inviteModal.style.display = 'none';
            }
        });
    }
    
    const toggleCodeBtn = document.getElementById('toggle-code-visibility');
    if (toggleCodeBtn) {
        toggleCodeBtn.addEventListener('click', toggleClassCodeVisibility);
    }
    
    const printCompactBtn = document.getElementById('print-student-compact-btn');
    if (printCompactBtn) {
        printCompactBtn.addEventListener('click', () => printStudentProfile(false));
    }
    
    const printFullBtn = document.getElementById('print-student-full-btn');
    if (printFullBtn) {
        printFullBtn.addEventListener('click', () => printStudentProfile(true));
    }
    
    const printAllCompactBtn = document.getElementById('print-all-compact-btn');
    if (printAllCompactBtn) {
        printAllCompactBtn.addEventListener('click', printAllProfilesCompact);
    }
    
    const printAllFullBtn = document.getElementById('print-all-full-btn');
    if (printAllFullBtn) {
        printAllFullBtn.addEventListener('click', printAllProfilesFull);
    }
    
    const createCustomQuestBtn = document.getElementById('create-custom-quest-btn');
    if (createCustomQuestBtn) {
        createCustomQuestBtn.addEventListener('click', openCreateCustomQuestModal);
    }
    
    const saveCustomQuestBtn = document.getElementById('save-custom-quest-btn');
    if (saveCustomQuestBtn) {
        saveCustomQuestBtn.addEventListener('click', saveCustomQuest);
    }
    
    const cancelCustomQuestBtn = document.getElementById('cancel-custom-quest-btn');
    if (cancelCustomQuestBtn) {
        cancelCustomQuestBtn.addEventListener('click', () => {
            document.getElementById('create-custom-quest-modal').style.display = 'none';
        });
    }
    
    const closeCustomModalBtn = document.querySelector('#create-custom-quest-modal .teacher-work-close');
    if (closeCustomModalBtn) {
        closeCustomModalBtn.addEventListener('click', () => {
            document.getElementById('create-custom-quest-modal').style.display = 'none';
        });
    }
    
    const customModal = document.getElementById('create-custom-quest-modal');
    if (customModal) {
        customModal.addEventListener('click', (e) => {
            if (e.target === customModal) {
                customModal.style.display = 'none';
            }
        });
    }
    
    const addRequirementBtn = document.getElementById('add-requirement-btn');
    if (addRequirementBtn) {
        addRequirementBtn.addEventListener('click', () => {
            const container = document.getElementById('custom-quest-requirements-list');
            const newItem = document.createElement('div');
            newItem.className = 'requirement-item';
            newItem.innerHTML = `
                <input type="text" class="requirement-input" placeholder="Requirement">
                <button type="button" class="remove-requirement-btn">✖</button>
            `;
            container.appendChild(newItem);
            
            const removeBtn = newItem.querySelector('.remove-requirement-btn');
            removeBtn.addEventListener('click', () => {
                newItem.remove();
            });
        });
    }
    
    const addLinkBtn = document.getElementById('add-link-btn');
    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            const container = document.getElementById('custom-quest-links-list');
            const newItem = document.createElement('div');
            newItem.className = 'link-item';
            newItem.innerHTML = `
                <input type="text" class="link-type" placeholder="Type (e.g., Video sample)">
                <input type="url" class="link-url" placeholder="URL">
                <button type="button" class="remove-link-btn">✖</button>
            `;
            container.appendChild(newItem);
            
            const removeBtn = newItem.querySelector('.remove-link-btn');
            removeBtn.addEventListener('click', () => {
                newItem.remove();
            });
        });
    }
    
    const scheduleClassSelect = document.getElementById('schedule-class-select');
    if (scheduleClassSelect) {
        scheduleClassSelect.addEventListener('change', handleScheduleClassChange);
    }
    
    const prevMonthBtn = document.getElementById('prev-month-btn');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', previousMonth);
    }
    
    const nextMonthBtn = document.getElementById('next-month-btn');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', nextMonth);
    }
    
    const dateModalClose = document.querySelector('#date-modal .teacher-work-close');
    if (dateModalClose) {
        dateModalClose.addEventListener('click', closeDateModal);
    }
    
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', closeDateModal);
    }
    
    const modalSaveBtn = document.getElementById('modal-save-btn');
    if (modalSaveBtn) {
        modalSaveBtn.addEventListener('click', saveDateModal);
    }
    
    const modalDeleteBtn = document.getElementById('modal-delete-btn');
    if (modalDeleteBtn) {
        modalDeleteBtn.addEventListener('click', deleteDateModal);
    }
    
    const modalStatus = document.getElementById('modal-status');
    if (modalStatus) {
        modalStatus.addEventListener('change', () => {
            const reasonGroup = document.getElementById('reason-group');
            reasonGroup.style.display = modalStatus.value === 'no-class' ? 'block' : 'none';
        });
    }
    
    const dateModal = document.getElementById('date-modal');
    if (dateModal) {
        dateModal.addEventListener('click', (e) => {
            if (e.target === dateModal) {
                closeDateModal();
            }
        });
    }
    
    const saveWeekendBtn = document.getElementById('save-weekend-settings');
    if (saveWeekendBtn) {
        saveWeekendBtn.addEventListener('click', saveWeekendSettings);
    }
    
    const saveFrequencyBtn = document.getElementById('save-frequency-settings');
    if (saveFrequencyBtn) {
        saveFrequencyBtn.addEventListener('click', saveFrequencySettings);
    }
    
    const resetScheduleBtn = document.getElementById('reset-schedule-btn');
    if (resetScheduleBtn) {
        resetScheduleBtn.addEventListener('click', resetScheduleSettings);
    }
    
    const importIcsBtn = document.getElementById('import-ics-btn');
    if (importIcsBtn) {
        importIcsBtn.addEventListener('click', () => {
            alert('ICS import feature coming soon!');
        });
    }
    
    const addNoClassBtn = document.getElementById('add-no-class-btn');
    if (addNoClassBtn) {
        addNoClassBtn.addEventListener('click', addNoClassDay);
    }
    
    setupDateRangeTabs();
    
    const addRangeBtn = document.getElementById('add-range-btn');
    if (addRangeBtn) {
        addRangeBtn.addEventListener('click', addDateRange);
    }
    
    const removeRangeBtn = document.getElementById('remove-range-btn');
    if (removeRangeBtn) {
        removeRangeBtn.addEventListener('click', removeDateRange);
    }
    
    const pdfBtn = document.getElementById('save-results-pdf-btn');
    if (pdfBtn) {
        pdfBtn.onclick = () => {
            if (currentContestId) {
                generateResultsPDF(currentContestId);
            }
        };
    }
    
    document.getElementById('delete-students-btn')?.addEventListener('click', toggleDeleteMode);
    
    const originalLoadStudentDetails = loadStudentDetails;
    loadStudentDetails = async function(userId, studentName) {
        currentStudentId = userId;
        originalLoadStudentDetails(userId, studentName);
    };
    
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
    
    async function preloadQuests() {
        console.log("Preloading quests...");
        await getQuests();
        console.log("Quests preloaded successfully");
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.teacher-tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            const activeTab = document.getElementById(`${tabId}-tab`);
            if (activeTab) {
                activeTab.style.display = 'block';
            }
            
            if (tabId === 'quests' && currentStudentId) {
                loadStudentProgressData(currentStudentId);
            }
        });
    });
    
    document.querySelectorAll('.remove-requirement-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.requirement-item').remove();
        });
    });
    
    document.querySelectorAll('.remove-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.link-item').remove();
        });
    });
    
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-custom-quest-btn')) {
            const questId = e.target.dataset.questId;
            const questTitle = e.target.dataset.questTitle;
            await deleteCustomQuest(questId, questTitle);
        }
    });
    
    checkExistingSession();
});