// --- PWA Setup ---
function setupPWA() {
    const manifest = {
        "name": "Absensi Pembimbing",
        "short_name": "Absen",
        "start_url": ".",
        "display": "standalone",
        "background_color": "#020617",
        "theme_color": "#020617",
        "description": "Aplikasi untuk mencatat absensi pembimbing.",
        "icons": [
            { "src": "https://placehold.co/192x192/3b82f6/ffffff?text=Absen", "type": "image/png", "sizes": "192x192" },
            { "src": "https://placehold.co/512x512/3b82f6/ffffff?text=Absen", "type": "image/png", "sizes": "512x512" }
        ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);
    const manifestEl = document.querySelector('#manifest');
    if (manifestEl) manifestEl.setAttribute('href', manifestURL);

    let deferredPrompt;
    const installBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.classList.remove('hidden');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            installBtn.classList.add('hidden');
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
        });
    }
}

// --- Firebase Configuration ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyBzvOsp5EVnzTI8Kbew9nXSXXLpakBD6Ec",
    authDomain: "ltq-hn.firebaseapp.com",
    projectId: "ltq-hn",
    storageBucket: "ltq-hn.appspot.com",
    messagingSenderId: "542731528480",
    appId: "1:542731528480:web:15203f68716ed2e3dacf45"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const Timestamp = firebase.firestore.Timestamp;

// --- Global State ---
let allMentors = [];
let currentUserId = null;
let unsubscribes = {};

// --- DOM Elements ---
const dom = {
    attendanceForm: document.getElementById('attendanceForm'),
    attendanceDate: document.getElementById('attendanceDate'),
    attendanceMentorList: document.getElementById('attendanceMentorList'),
    saveAttendanceBtn: document.getElementById('saveAttendanceBtn'),
    mentorSearchInput: document.getElementById('mentorSearchInput'),
    mentorSearchEmpty: document.getElementById('mentorSearchEmpty'),
    statTotal: document.getElementById('statTotal'),
    statPresent: document.getElementById('statPresent'),
    statAbsent: document.getElementById('statAbsent'),
};

// --- Authentication ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUserId = user.uid;
        fetchInitialData();
    } else {
        try { 
            if (initialAuthToken) await auth.signInWithCustomToken(initialAuthToken);
            else await auth.signInAnonymously();
        } catch (error) { console.error("Authentication error:", error); }
    }
});

// --- Data Fetching ---
async function fetchInitialData() {
    const mentorsCollection = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('mentors');
    unsubscribes.mentors = mentorsCollection.onSnapshot((snapshot) => {
        allMentors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMentorAttendanceList();
    });
}

// --- UI Rendering ---
function renderMentorAttendanceList() {
    const container = dom.attendanceMentorList;
    if (!container) return;
    container.innerHTML = '';
    
    if (allMentors.length > 0) {
        const sortedMentors = [...allMentors].sort((a, b) => a.name.localeCompare(b.name));
        sortedMentors.forEach(mentor => {
            const div = document.createElement('div');
            div.className = 'mentor-row group';
            div.dataset.mentorName = mentor.name.toLowerCase();
            
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="mentor-avatar">
                        ${mentor.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <span class="block text-white font-semibold leading-none mb-1">${mentor.name}</span>
                        <span class="text-[10px] text-gray-500 uppercase tracking-tight">Pembimbing</span>
                    </div>
                </div>
                <label class="checkbox-wrapper">
                    <input type="checkbox" data-mentor-id="${mentor.id}" data-mentor-name="${mentor.name}" class="attendance-checkbox">
                    <span class="checkmark"></span>
                </label>
            `;

            // Click row to toggle checkbox
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            };

            const checkbox = div.querySelector('input');
            checkbox.onchange = () => {
                div.classList.toggle('is-absent', checkbox.checked);
                updateStats();
            };

            container.appendChild(div);
        });

        filterMentorList(dom.mentorSearchInput.value);
        updateStats();
        if (window.lucide) lucide.createIcons();
    } else {
        container.innerHTML = '<div class="text-center py-12 text-gray-500 animate-pulse">Memuat data pembimbing...</div>';
    }
}

function updateStats() {
    const total = allMentors.length;
    const checkboxes = dom.attendanceMentorList.querySelectorAll('.attendance-checkbox');
    const absentCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const presentCount = total - absentCount;

    if (dom.statTotal) dom.statTotal.textContent = total;
    if (dom.statPresent) dom.statPresent.textContent = presentCount;
    if (dom.statAbsent) dom.statAbsent.textContent = absentCount;
}

// --- Search / Filter Logic ---
function filterMentorList(query) {
    const keyword = query.toLowerCase().trim();
    const items = dom.attendanceMentorList?.querySelectorAll('.mentor-row');
    if (!items) return;
    let visibleCount = 0;

    items.forEach(item => {
        const name = item.dataset.mentorName || '';
        const match = name.includes(keyword);
        item.style.display = match ? 'flex' : 'none';
        if (match) visibleCount++;
    });

    if (dom.mentorSearchEmpty) dom.mentorSearchEmpty.classList.toggle('hidden', visibleCount > 0 || items.length === 0);
}

// --- Core Logic ---
async function handleSaveAttendance(e) {
    e.preventDefault();
    const date = dom.attendanceDate.value;
    const sessionInput = dom.attendanceForm.querySelector('input[name="session"]:checked');
    if (!date || !sessionInput) { showToast("Harap isi tanggal dan pilih sesi.", true); return; }
    const session = sessionInput.value;

    const button = dom.saveAttendanceBtn;
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Menyimpan...</span>`;
    lucide.createIcons();

    const presentMentors = [];
    const absentMentors = [];

    dom.attendanceMentorList.querySelectorAll('.attendance-checkbox').forEach(cb => {
        const name = cb.dataset.mentorName;
        if (cb.checked) absentMentors.push(name);
        else presentMentors.push(name);
    });

    const docId = `${date}_${session}`;
    const attendanceDocRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('dailyAttendance').doc(docId);
    const dataToSave = { date, session, absentMentors, presentMentors, timestamp: Timestamp.now(), recordedBy: currentUserId };

    try {
        await attendanceDocRef.set(dataToSave);
        showToast("Absensi berhasil disimpan!");
        // We don't reset the date, but we can clear the search
        if (dom.mentorSearchInput) dom.mentorSearchInput.value = '';
        renderMentorAttendanceList();
    } catch (error) {
        console.error("Save Error: ", error);
        showToast("Gagal menyimpan absensi.", true);
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
        lucide.createIcons();
    }
}

// --- UI Helpers ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.remove('success', 'error');
    toast.classList.add(isError ? 'error' : 'success');
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// --- Event Listeners ---
dom.attendanceForm?.addEventListener('submit', handleSaveAttendance);
dom.mentorSearchInput?.addEventListener('input', (e) => { filterMentorList(e.target.value); });

// --- Initial Setup ---
function initializePage() {
    if (dom.attendanceDate) dom.attendanceDate.value = new Date().toISOString().split('T')[0];
    lucide.createIcons();
    setupPWA();
    dom.attendanceForm?.addEventListener('reset', () => {
        if (dom.mentorSearchInput) dom.mentorSearchInput.value = '';
        filterMentorList('');
    });
}

initializePage();
window.addEventListener('beforeunload', () => {
    Object.values(unsubscribes).forEach(unsub => unsub && unsub());
});

