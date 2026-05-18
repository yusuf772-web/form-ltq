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

// --- Export Logic ---
const exportReportForm = document.getElementById('exportReportForm');
if (exportReportForm) {
    exportReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUserId) {
            showToast("Autentikasi diperlukan.", true);
            return;
        }

        const startDate = document.getElementById('exportStartDate').value;
        const endDate = document.getElementById('exportEndDate').value;
        
        if (!startDate || !endDate) {
            showToast("Silakan pilih tanggal mulai dan selesai.", true);
            return;
        }

        if (startDate > endDate) {
            showToast("Tanggal mulai tidak boleh lebih dari tanggal selesai.", true);
            return;
        }

        const btnExport = document.getElementById('btnExport');
        const originalBtnContent = btnExport.innerHTML;
        btnExport.disabled = true;
        btnExport.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Mengekspor...`;
        lucide.createIcons();

        try {
            // Fetch form submissions first for student metrics
            const startParts = startDate.split('-');
            const startTimestamp = firebase.firestore.Timestamp.fromDate(new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0));
            const endParts = endDate.split('-');
            const endTimestamp = firebase.firestore.Timestamp.fromDate(new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59));

            const submissionsSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('formSubmissions')
                .where('timestamp', '>=', startTimestamp)
                .where('timestamp', '<=', endTimestamp)
                .get();
            const submissions = submissionsSnap.docs.map(doc => doc.data());

            // Fetch Students
            const studentsSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('students').get();
            const studentsList = studentsSnap.docs.map(doc => doc.data());
            
            // Format Student Data
            const studentSheetData = studentsList.map((s, index) => {
                const studentSubs = submissions.filter(sub => 
                    sub.namaSantri1 === s.name || 
                    sub.namaSantri2 === s.name || 
                    sub.namaSantri3 === s.name
                );

                let totalAlpha = 0, totalIzin = 0, totalSakit = 0, totalHadir = 0;
                let sumItqon = 0, countItqon = 0;
                let sumTajwid = 0, countTajwid = 0;
                let hafalanTerakhir = "-";
                let latestTimestamp = 0;
                let listTasmi = [];

                studentSubs.forEach(sub => {
                    if (sub.formType === 'form3') {
                        if (sub.kehadiranHalaqoh === 'alpha' || sub.kehadiranHalaqoh === 'alfa') totalAlpha++;
                        else if (sub.kehadiranHalaqoh === 'izin') totalIzin++;
                        else if (sub.kehadiranHalaqoh === 'sakit') totalSakit++;
                        else if (sub.kehadiranHalaqoh === 'hadir') totalHadir++;
                    }
                    else if (sub.formType === 'form1') {
                        if (sub.nilaiItqon1) { sumItqon += Number(sub.nilaiItqon1); countItqon++; }
                        if (sub.nilaiTajwid1) { sumTajwid += Number(sub.nilaiTajwid1); countTajwid++; }
                        
                        const ts = sub.timestamp ? sub.timestamp.toMillis() : 0;
                        if (ts > latestTimestamp) {
                            latestTimestamp = ts;
                            hafalanTerakhir = sub.hafalanTerakhir1 || sub.totalHafalan1 || hafalanTerakhir;
                        }
                    }
                    else if (sub.formType === 'form2') {
                        if (sub.jumlahHafalanTasmi) {
                            listTasmi.push(sub.jumlahHafalanTasmi + (sub.keteranganTasmi ? ` (${sub.keteranganTasmi})` : ''));
                        }
                    }
                });

                return {
                    'No': index + 1,
                    'Nama Santri': s.name || '',
                    'Kelas': s.class || '',
                    'Hadir (Khusus yg Diabsen)': totalHadir,
                    'Izin': totalIzin,
                    'Sakit': totalSakit,
                    'Alpha': totalAlpha,
                    'Rata-Rata Itqon': countItqon > 0 ? (sumItqon / countItqon).toFixed(1) : '-',
                    'Rata-Rata Tajwid': countTajwid > 0 ? (sumTajwid / countTajwid).toFixed(1) : '-',
                    'Hafalan Terakhir': hafalanTerakhir,
                    'Data Tasmi\'': listTasmi.length > 0 ? listTasmi.join(' | ') : '-'
                };
            }).sort((a, b) => a.Kelas.localeCompare(b.Kelas) || a['Nama Santri'].localeCompare(b['Nama Santri']));

            // Recalculate No after sorting
            studentSheetData.forEach((row, idx) => row['No'] = idx + 1);

            // Fetch Mentors
            const mentorsSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('mentors').get();
            const mentorsList = mentorsSnap.docs.map(doc => doc.data());

            // Fetch Mentor Attendance
            const attendanceSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('dailyAttendance')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();

            const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());

            // Format Mentor Attendance Data
            const mentorSheetData = mentorsList.map((m, index) => {
                let presentCount = 0;
                let absentCount = 0;
                
                attendanceRecords.forEach(record => {
                    if (record.presentMentors && record.presentMentors.includes(m.name)) {
                        presentCount++;
                    } else if (record.absentMentors && record.absentMentors.includes(m.name)) {
                        absentCount++;
                    }
                });

                return {
                    'No': index + 1,
                    'Nama Pembimbing': m.name || '',
                    'Total Hadir': presentCount,
                    'Total Alfa / Izin': absentCount,
                    'Persentase Kehadiran': (presentCount + absentCount) > 0 ? Math.round((presentCount / (presentCount + absentCount)) * 100) + '%' : '0%'
                };
            }).sort((a, b) => a['Nama Pembimbing'].localeCompare(b['Nama Pembimbing']));

            // Create Excel workbook
            const wb = XLSX.utils.book_new();
            
            // Add Student Sheet
            const wsStudents = XLSX.utils.json_to_sheet(studentSheetData);
            XLSX.utils.book_append_sheet(wb, wsStudents, "Data Santri");
            
            // Add Mentor Attendance Sheet
            const wsMentors = XLSX.utils.json_to_sheet(mentorSheetData);
            XLSX.utils.book_append_sheet(wb, wsMentors, "Kehadiran Pembimbing");

            // Write and Download
            XLSX.writeFile(wb, `Laporan_Tahunan_LTQ_${startDate}_to_${endDate}.xlsx`);
            
            showToast("Laporan Excel berhasil diekspor!");

        } catch (error) {
            console.error("Export Error:", error);
            showToast("Gagal mengekspor laporan: " + error.message, true);
        } finally {
            btnExport.disabled = false;
            btnExport.innerHTML = originalBtnContent;
            lucide.createIcons();
        }
    });
}

// --- Initial Setup ---
lucide.createIcons();
if (dom.mentorFile) setupFileInput(dom.mentorFile, dom.mentorFile.previousElementSibling, dom.mentorFileName);
if (dom.classFile) setupFileInput(dom.classFile, dom.classFile.previousElementSibling, dom.className);
if (dom.studentFile) setupFileInput(dom.studentFile, dom.studentFile.previousElementSibling, dom.studentFileName);
