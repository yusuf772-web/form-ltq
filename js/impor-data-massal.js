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
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

// --- Global State ---
let currentUserId = null;

// --- DOM Elements ---
const dom = {
    importMentorForm: document.getElementById('importMentorForm'),
    mentorFile: document.getElementById('mentorFile'),
    mentorFileName: document.getElementById('mentorFileName'),
    importClassForm: document.getElementById('importClassForm'),
    classFile: document.getElementById('classFile'),
    className: document.getElementById('className'),
    importStudentForm: document.getElementById('importStudentForm'),
    studentFile: document.getElementById('studentFile'),
    studentFileName: document.getElementById('studentFileName'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
};

// --- UI Logic ---
const showToast = (message, isError = false) => {
    if (!dom.toastMessage || !dom.toast) return;
    dom.toastMessage.textContent = message;
    dom.toast.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transform translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
    setTimeout(() => {
        dom.toast.className = dom.toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 5000);
};

const setupFileInput = (inputEl, labelEl, textEl) => {
    if (!inputEl || !labelEl || !textEl) return;
    inputEl.addEventListener('change', () => {
        if (inputEl.files.length > 0) {
            textEl.textContent = inputEl.files[0].name;
            labelEl.classList.add('has-file');
        } else {
            textEl.textContent = 'Klik atau seret file CSV';
            labelEl.classList.remove('has-file');
        }
    });
};

// --- Authentication ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUserId = user.uid;
    } else {
        try {
            if (initialAuthToken) await auth.signInWithCustomToken(initialAuthToken);
            else await auth.signInAnonymously();
        } catch (error) {
            console.error("Authentication error:", error);
            showToast("Error autentikasi: " + error.message, true);
        }
    }
});

// --- Import Logic ---
const handleImport = async (e, fileInput, collectionName, expectedHeaders) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    if (!currentUserId) {
        showToast("Autentikasi diperlukan. Silakan muat ulang halaman.", true);
        return;
    }
    if (fileInput.files.length === 0) {
        showToast("Silakan pilih file CSV terlebih dahulu.", true);
        return;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = `<i data-lucide="loader" class="w-4 h-4 mr-2 animate-spin"></i> Memproses...`;
    lucide.createIcons();

    const file = fileInput.files[0];
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const headers = results.meta.fields;
            const isValid = expectedHeaders.every(h => headers.includes(h));

            if (!isValid) {
                showToast(`Format CSV salah. Pastikan header adalah: ${expectedHeaders.join(', ')}`, true);
                submitButton.disabled = false;
                submitButton.innerHTML = `<i data-lucide="upload" class="w-4 h-4 mr-2"></i>Impor`;
                lucide.createIcons();
                return;
            }

            const dataToImport = results.data;
            let successCount = 0;
            let errorCount = 0;

            for (const item of dataToImport) {
                try {
                    if (Object.values(item).every(x => x === null || x === '')) continue;
                    
                    const docData = { ...item, timestamp: serverTimestamp(), addedBy: currentUserId };
                    await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(collectionName).add(docData);
                    successCount++;
                } catch (err) {
                    console.error("Error adding document:", err, item);
                    errorCount++;
                }
            }

            showToast(`Impor selesai. Berhasil: ${successCount}, Gagal: ${errorCount}.`, errorCount > 0);
            e.target.reset();
            fileInput.dispatchEvent(new Event('change')); 
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="upload" class="w-4 h-4 mr-2"></i>Impor ${collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1)}`;
            lucide.createIcons();
        },
        error: (error) => {
            showToast(`Gagal mem-parsing file CSV: ${error.message}`, true);
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="upload" class="w-4 h-4 mr-2"></i>Impor ${collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1)}`;
            lucide.createIcons();
        }
    });
};

// --- Event Listeners ---
dom.importMentorForm?.addEventListener('submit', (e) => handleImport(e, dom.mentorFile, 'mentors', ['name']));
dom.importClassForm?.addEventListener('submit', (e) => handleImport(e, dom.classFile, 'classes', ['name']));
dom.importStudentForm?.addEventListener('submit', (e) => handleImport(e, dom.studentFile, 'students', ['name', 'class']));

// --- Initial Setup ---
lucide.createIcons();
if (dom.mentorFile) setupFileInput(dom.mentorFile, dom.mentorFile.previousElementSibling, dom.mentorFileName);
if (dom.classFile) setupFileInput(dom.classFile, dom.classFile.previousElementSibling, dom.className);
if (dom.studentFile) setupFileInput(dom.studentFile, dom.studentFile.previousElementSibling, dom.studentFileName);
