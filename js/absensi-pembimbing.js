import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- PWA Setup ---
function setupPWA() {
    // 1. Generate manifest.json dynamically
    const manifest = {
        "name": "Absensi Pembimbing",
        "short_name": "Absen",
        "start_url": ".",
        "display": "standalone",
        "background_color": "#111827",
        "theme_color": "#3b82f6",
        "description": "Aplikasi untuk mencatat absensi pembimbing.",
        "icons": [
            { "src": "https://placehold.co/192x192/3b82f6/ffffff?text=Absen", "type": "image/png", "sizes": "192x192" },
            { "src": "https://placehold.co/512x512/3b82f6/ffffff?text=Absen", "type": "image/png", "sizes": "512x512" }
        ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);
    document.querySelector('#manifest').setAttribute('href', manifestURL);

    // 2. Handle "Add to Home Screen" prompt
    let deferredPrompt;
    const installBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        installBtn.classList.add('hidden');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        }
    });
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
};

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        fetchInitialData();
    } else {
        try { await (initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth)); }
        catch (error) { console.error("Authentication error:", error); }
    }
});

// --- Data Fetching ---
async function fetchInitialData() {
    const mentorsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'mentors');
    unsubscribes.mentors = onSnapshot(mentorsCollection, (snapshot) => {
        allMentors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMentorAttendanceList();
    });
}

// --- UI Rendering ---
function renderMentorAttendanceList() {
    const container = dom.attendanceMentorList;
    container.innerHTML = '';
    if (allMentors.length > 0) {
        const sortedMentors = [...allMentors].sort((a, b) => a.name.localeCompare(b.name));
        sortedMentors.forEach(mentor => {
            const label = document.createElement('label');
            label.className = 'mentor-item flex items-center gap-3 p-2 rounded-md hover:bg-gray-700/50 cursor-pointer transition-colors';
            label.dataset.mentorName = mentor.name.toLowerCase();
            label.innerHTML = `
                <input type="checkbox" data-mentor-name="${mentor.name}" class="form-checkbox absent-checkbox w-4 h-4 flex-shrink-0">
                <span class="text-gray-300">${mentor.name}</span>
            `;
            container.appendChild(label);
        });
        // Apply any active search after re-render
        filterMentorList(dom.mentorSearchInput.value);
    } else {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Memuat data pembimbing...</p>';
    }
}

// --- Search / Filter Logic ---
function filterMentorList(query) {
    const keyword = query.toLowerCase().trim();
    const items = dom.attendanceMentorList.querySelectorAll('.mentor-item');
    let visibleCount = 0;

    items.forEach(item => {
        const name = item.dataset.mentorName || '';
        const match = name.includes(keyword);
        item.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });

    dom.mentorSearchEmpty.classList.toggle('hidden', visibleCount > 0 || items.length === 0);
}

// --- Core Logic ---
async function handleSaveAttendance(e) {
    e.preventDefault();
    const date = dom.attendanceDate.value;
    const sessionInput = dom.attendanceForm.querySelector('input[name="session"]:checked');
    if (!date || !sessionInput) { showToast("Harap isi tanggal dan pilih sesi.", true); return; }
    const session = sessionInput.value;

    const button = dom.saveAttendanceBtn;
    button.disabled = true;
    button.innerHTML = `<span>Menyimpan...</span>`;

    const absentMentors = Array.from(dom.attendanceMentorList.querySelectorAll('.absent-checkbox:checked')).map(cb => cb.dataset.mentorName);
    const presentMentors = allMentors.map(m => m.name).filter(name => !absentMentors.includes(name));
    const docId = `${date}_${session}`;
    const attendanceDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'dailyAttendance', docId);
    const dataToSave = { date, session, absentMentors, presentMentors, timestamp: Timestamp.now(), recordedBy: currentUserId };

    try {
        await setDoc(attendanceDocRef, dataToSave);
        showToast("Absensi berhasil disimpan.");
        dom.attendanceForm.reset();
        dom.attendanceDate.value = new Date().toISOString().split('T')[0];
        renderMentorAttendanceList();
    } catch (error) {
        console.error("Save Error: ", error);
        showToast("Gagal menyimpan absensi.", true);
    } finally {
        button.disabled = false;
        button.innerHTML = `<i data-lucide="save" class="w-4 h-4 mr-2"></i><span>Simpan Absensi</span>`;
        lucide.createIcons();
    }
}

// --- UI Helpers ---
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.className = `toast ${isError ? 'bg-red-600' : 'bg-green-600'}`;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// --- Event Listeners ---
dom.attendanceForm.addEventListener('submit', handleSaveAttendance);

dom.mentorSearchInput.addEventListener('input', (e) => {
    filterMentorList(e.target.value);
});

// --- Initial Setup ---
function initializePage() {
    dom.attendanceDate.value = new Date().toISOString().split('T')[0];
    lucide.createIcons();
    setupPWA();
    // Clear search on form reset
    dom.attendanceForm.addEventListener('reset', () => {
        dom.mentorSearchInput.value = '';
        filterMentorList('');
    });
}

initializePage();
window.addEventListener('beforeunload', () => {
    Object.values(unsubscribes).forEach(unsub => unsub && unsub());
});
