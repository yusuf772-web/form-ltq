// ============================================
//   Formulir Perkembangan LTQ - Script (Module)
// ============================================

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- PWA Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create Manifest File Dynamically
    const manifest = {
        "short_name": "Data Santri",
        "name": "Formulir Data Santri",
        "icons": [
            {
                "src": "https://www.hidayatunnajah.or.id/wp-content/uploads/2025/07/WhatsApp-Image-2025-07-19-at-15.53.05.jpeg",
                "type": "image/jpeg",
                "sizes": "192x192"
            },
            {
                "src": "https://www.hidayatunnajah.or.id/wp-content/uploads/2025/07/WhatsApp-Image-2025-07-19-at-15.53.05.jpeg",
                "type": "image/jpeg",
                "sizes": "512x512"
            }
        ],
        "scope": ".",
        "start_url": ".",
        "display_override": ["standalone"],
        "display": "standalone",
        "theme_color": "#111827",
        "background_color": "#1f2937"
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);
    document.querySelector('link[rel="manifest"]').setAttribute('href', manifestURL);

    // 2. Register Service Worker
    if ('serviceWorker' in navigator) {
        const swContent = `
            const CACHE_NAME = 'santri-form-cache-v4';
            const urlsToCache = [ '.', ];

            self.addEventListener('install', event => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            console.log('Opened cache');
                            return cache.addAll(urlsToCache);
                        })
                );
            });

            self.addEventListener('fetch', event => {
                event.respondWith(
                    caches.match(event.request)
                        .then(response => {
                            return response || fetch(event.request);
                        })
                );
            });

            self.addEventListener('activate', event => {
              const cacheWhitelist = [CACHE_NAME];
              event.waitUntil(
                caches.keys().then(cacheNames => {
                  return Promise.all(
                    cacheNames.map(cacheName => {
                      if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                      }
                    })
                  );
                })
              );
            });
        `;
        const swBlob = new Blob([swContent], { type: 'application/javascript' });
        const swURL = URL.createObjectURL(swBlob);

        navigator.serviceWorker.register(swURL)
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    }
});


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
let currentUserId = null;
let activeFormId = 'form1';
let unsubscribes = [];
let allMentors = [];
let allStudents = [];
let allHalaqohGroups = [];

// --- DOM Elements ---
const dom = {
    forms: {
        form1: document.getElementById('form1'),
        form2: document.getElementById('form2'),
        form3: document.getElementById('form3'),
    },
    buttons: {
        showForm1Btn: document.getElementById('showForm1Btn'),
        showForm2Btn: document.getElementById('showForm2Btn'),
        showForm3Btn: document.getElementById('showForm3Btn'),
        submitBtn: document.getElementById('submitBtn'),
        resetBtn: document.getElementById('resetBtn'),
    },
    selects: {
        namaPembimbing1: document.getElementById('namaPembimbing1'),
        namaSantri1: document.getElementById('namaSantri1'),
        namaPembimbing2: document.getElementById('namaPembimbing2'),
        namaSantri2: document.getElementById('namaSantri2'),
        namaPembimbingHalaqoh: document.getElementById('namaPembimbingHalaqoh'),
        namaSantri3: document.getElementById('namaSantri3'),
    },
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
};

// --- UI Logic ---
const showToast = (message, isError = false) => {
    dom.toastMessage.textContent = message;
    dom.toast.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transform translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
    setTimeout(() => {
        dom.toast.className = dom.toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 3000);
};

const switchForm = (formId) => {
    activeFormId = formId;
    Object.values(dom.forms).forEach(form => form.classList.add('hidden'));

    const buttons = [dom.buttons.showForm1Btn, dom.buttons.showForm2Btn, dom.buttons.showForm3Btn];
    buttons.forEach(btn => btn.classList.remove('active'));

    dom.forms[formId].classList.remove('hidden');
    const activeBtnId = `show${formId.charAt(0).toUpperCase() + formId.slice(1)}Btn`;
    if (dom.buttons[activeBtnId]) {
        dom.buttons[activeBtnId].classList.add('active');
    }
};

// --- Data Fetching & Population ---
const populateSelect = (selectElement, items, placeholder, valueKey = 'id', textKey = 'name') => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    items.sort((a, b) => a[textKey].localeCompare(b[textKey])).forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        selectElement.appendChild(option);
    });
    selectElement.value = currentValue;
};

const createDataListener = (collectionName, callback) => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(items);
    }, (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
        showToast(`Gagal memuat data ${collectionName}.`, true);
    });
    unsubscribes.push(unsubscribe);
};

const populateStudentsByMentor = (mentorId, formNumber) => {
    const studentSelect = dom.selects[`namaSantri${formNumber}`];
    if (!studentSelect) return;

    if (!mentorId) {
        populateSelect(studentSelect, [], 'Pilih pembimbing dulu', 'name', 'name');
        return;
    }

    const group = allHalaqohGroups.find(g => g.mentorId === mentorId);
    if (!group || !group.studentIds) {
        populateSelect(studentSelect, [], 'Tidak ada santri di grup ini', 'name', 'name');
        return;
    }

    const studentsInGroup = allStudents.filter(s => group.studentIds.includes(s.id));
    populateSelect(studentSelect, studentsInGroup, 'Pilih Santri', 'name', 'name');
};

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        unsubscribes.forEach(unsub => unsub());
        unsubscribes = [];

        createDataListener('students', (items) => { allStudents = items; });
        createDataListener('halaqohGroups', (items) => { allHalaqohGroups = items; });
        createDataListener('mentors', (items) => {
            allMentors = items;
            populateSelect(dom.selects.namaPembimbing1, allMentors, 'Pilih Pembimbing');
            populateSelect(dom.selects.namaPembimbing2, allMentors, 'Pilih Pembimbing');
            populateSelect(dom.selects.namaPembimbingHalaqoh, allMentors, 'Pilih Pembimbing');
        });
    } else {
        try {
            await (initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth));
        } catch (error) {
            console.error("Authentication error:", error);
            showToast("Error autentikasi: " + error.message, true);
        }
    }
});

// --- Event Listeners ---
dom.buttons.showForm1Btn.addEventListener('click', () => switchForm('form1'));
dom.buttons.showForm2Btn.addEventListener('click', () => switchForm('form2'));
dom.buttons.showForm3Btn.addEventListener('click', () => switchForm('form3'));

dom.selects.namaPembimbing1.addEventListener('change', (e) => populateStudentsByMentor(e.target.value, 1));
dom.selects.namaPembimbing2.addEventListener('change', (e) => populateStudentsByMentor(e.target.value, 2));
dom.selects.namaPembimbingHalaqoh.addEventListener('change', (e) => populateStudentsByMentor(e.target.value, 3));

dom.buttons.resetBtn.addEventListener('click', () => {
    dom.forms[activeFormId].reset();
    const formNumber = activeFormId.replace('form', '');
    populateSelect(dom.selects[`namaSantri${formNumber}`], [], 'Pilih pembimbing dulu', 'name', 'name');
    showToast('Formulir dibersihkan.');
});

dom.buttons.submitBtn.addEventListener('click', async () => {
    if (!currentUserId) {
        showToast("Autentikasi diperlukan. Harap tunggu.", true);
        return;
    }

    const form = dom.forms[activeFormId];
    const formData = new FormData(form);
    const data = {
        formType: activeFormId,
        userId: currentUserId,
        timestamp: serverTimestamp(),
    };

    let isValid = true;
    form.querySelectorAll('[required]').forEach(input => {
        if (input.type === 'radio') {
            const radioGroup = form.querySelectorAll(`input[name="${input.name}"]`);
            if (![...radioGroup].some(r => r.checked)) {
                isValid = false;
            }
        } else if (!input.value.trim()) {
            isValid = false;
        }
    });

    if (!isValid) {
        showToast("mohon isi dengan benar", true);
        return;
    }

    for (let [key, value] of formData.entries()) {
        if (key.startsWith('namaPembimbing')) {
            const selectedMentor = allMentors.find(m => m.id === value);
            data[key] = selectedMentor ? selectedMentor.name : '';
        } else {
            data[key] = value;
        }
    }

    dom.buttons.submitBtn.disabled = true;
    dom.buttons.submitBtn.innerHTML = '<i class="w-4 h-4 mr-2 animate-spin" data-lucide="loader"></i> Mengirim...';
    lucide.createIcons();

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'formSubmissions'), data);
        showToast("Data berhasil dikirim!", false);
        form.reset();
        const formNumber = activeFormId.replace('form', '');
        populateSelect(dom.selects[`namaSantri${formNumber}`], [], 'Pilih pembimbing dulu', 'name', 'name');
    } catch (e) {
        console.error("Error adding document: ", e);
        showToast("Gagal mengirim data: " + e.message, true);
    } finally {
        dom.buttons.submitBtn.disabled = false;
        dom.buttons.submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4 mr-2"></i>Kirim Data';
        lucide.createIcons();
    }
});

// --- Initial Setup ---
switchForm('form1');
lucide.createIcons();

window.addEventListener('beforeunload', () => {
    unsubscribes.forEach(unsub => unsub());
});
