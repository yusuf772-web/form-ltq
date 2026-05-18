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

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();
const { Timestamp } = firebase.firestore;

// --- DOM Element References ---
const dom = {
    adminDataTable: document.getElementById('adminDataTable'),
    adminDataTableLoader: document.getElementById('adminDataTableLoader'),
    submissionMonthFilter: document.getElementById('submissionMonthFilter'),
    formTypeFilter: document.getElementById('formTypeFilter'),
    submissionSearchInput: document.getElementById('submissionSearchInput'),
    itemsPerPageSelect: document.getElementById('itemsPerPageSelect'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageNumbers: document.getElementById('pageNumbers'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationControls: document.getElementById('paginationControls'),
    editSubmissionModal: document.getElementById('editSubmissionModal'),
    editSubmissionId: document.getElementById('editSubmissionId'),
    saveEditSubmissionBtn: document.getElementById('saveEditSubmissionBtn'),
    cancelEditSubmissionBtn: document.getElementById('cancelEditSubmissionBtn'),
    deleteModal: document.getElementById('deleteModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// --- State Variables ---
let currentUserId = null;
let allFilteredDocs = [];
let allStudents = [];
let allMentors = [];
let currentPage = 1;
let itemsPerPage = 10;
let unsubscribeFormSubmissions = null;
let deleteInfo = { docId: null, collectionName: null };

// --- Helper Functions ---
function showToast(message, isError = false) {
    if (!dom.toast) return;
    dom.toastMessage.textContent = message;
    dom.toast.classList.remove('success', 'error');
    dom.toast.classList.add(isError ? 'error' : 'success');
    dom.toast.classList.add('show');
    setTimeout(() => { dom.toast.classList.remove('show'); }, 3000);
}

function openDeleteModal(docId, collectionName) {
    deleteInfo = { docId, collectionName };
    dom.deleteModal.classList.add('show');
}

function closeDeleteModal() { dom.deleteModal.classList.remove('show'); }

function populateSubmissionMonthFilter() {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const now = new Date();
    dom.submissionMonthFilter.innerHTML = '<option value="">Semua Bulan</option>';
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        const option = document.createElement('option');
        option.value = `${year}-${month + 1}`;
        option.textContent = `${months[month]} ${year}`;
        dom.submissionMonthFilter.appendChild(option);
    }
}

async function preloadSubmissionsData() {
    // We need students and mentors for names lookup if needed
    const studentSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('students').get();
    allStudents = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const mentorSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('mentors').get();
    allMentors = mentorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    fetchAdminData();
}

function fetchAdminData() {
    const formTypeFilter = dom.formTypeFilter.value;
    const monthFilter = dom.submissionMonthFilter.value;
    const searchTerm = dom.submissionSearchInput.value.toLowerCase();

    if (unsubscribeFormSubmissions) unsubscribeFormSubmissions();
    dom.adminDataTableLoader.style.display = 'block';
    dom.adminDataTable.innerHTML = '';

    const submissionsRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('formSubmissions');
    let q = submissionsRef;

    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        const startDate = firebase.firestore.Timestamp.fromDate(new Date(year, month - 1, 1));
        const endDate = firebase.firestore.Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));
        q = q.where('timestamp', '>=', startDate).where('timestamp', '<=', endDate);
    }
    if (formTypeFilter) { q = q.where('formType', '==', formTypeFilter); }

    unsubscribeFormSubmissions = q.onSnapshot((snapshot) => {
        dom.adminDataTableLoader.style.display = 'none';
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

        if (searchTerm) {
            docs = docs.filter(doc => {
                const mentorName = doc.namaPembimbing1 || doc.namaPembimbing2 || doc.namaPembimbingHalaqoh || '';
                const studentName = doc.namaSantri1 || doc.namaSantri2 || doc.namaSantri3 || '';
                return mentorName.toLowerCase().includes(searchTerm) || studentName.toLowerCase().includes(searchTerm);
            });
        }

        allFilteredDocs = docs;
        currentPage = 1;
        renderSubmissionPage();
    }, (error) => {
        console.error("Error:", error);
        dom.adminDataTableLoader.style.display = 'none';
        showToast("Gagal memuat data.", true);
    });
}

function renderSubmissionPage() {
    const total = allFilteredDocs.length;
    const totalPages = Math.ceil(total / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, total);
    const pageDocs = allFilteredDocs.slice(start, end);

    if (total === 0) {
        dom.adminDataTable.innerHTML = `<p class="text-center text-gray-400 py-12">Tidak ada data ditemukan.</p>`;
        dom.paginationControls.classList.add('hidden');
        return;
    }

    dom.paginationControls.classList.remove('hidden');
    dom.paginationInfo.textContent = `Menampilkan ${start + 1}–${end} dari ${total}`;
    dom.prevPageBtn.disabled = currentPage === 1;
    dom.nextPageBtn.disabled = currentPage === totalPages;

    dom.pageNumbers.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 5 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) continue;
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `px-3 py-1 text-xs rounded-lg font-bold ${i === currentPage ? 'bg-blue-500 text-white' : 'bg-slate-800 text-gray-400'}`;
        btn.onclick = () => { currentPage = i; renderSubmissionPage(); };
        dom.pageNumbers.appendChild(btn);
    }

    const formTypeNames = { 'form1': 'Perkembangan', 'form2': "Tasmi'", 'form3': 'Absensi' };
    let tableHTML = `<table class="admin-table"><thead><tr>
        <th>Tipe</th><th>Santri</th><th>Pembimbing</th><th>Waktu</th><th>Ket</th><th>Aksi</th>
    </tr></thead><tbody>`;

    pageDocs.forEach(data => {
        const studentName = data.namaSantri1 || data.namaSantri2 || data.namaSantri3 || '-';
        const mentorName = data.namaPembimbing1 || data.namaPembimbing2 || data.namaPembimbingHalaqoh || '-';
        const time = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        let ket = '-';
        if (data.formType === 'form1') ket = data.catatanPerkembangan1 || '-';
        else if (data.formType === 'form3') ket = data.kehadiranHalaqoh || '-';
        else if (data.formType === 'form2') ket = data.keteranganTasmi || '-';

        tableHTML += `<tr>
            <td class="font-bold text-blue-400">${formTypeNames[data.formType] || data.formType}</td>
            <td>${studentName}</td>
            <td class="text-xs text-gray-400">${mentorName}</td>
            <td class="text-xs">${time}</td>
            <td class="text-xs italic">${ket}</td>
            <td>
                <div class="flex gap-1">
                    <button class="btn-icon !p-2 btn-edit-submission" data-id="${data.id}" data-submission='${JSON.stringify(data)}'><i data-lucide="edit-3" class="w-4 h-4 text-blue-400"></i></button>
                    <button class="btn-icon !p-2 btn-delete" data-id="${data.id}" data-collection="formSubmissions"><i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i></button>
                </div>
            </td>
        </tr>`;
    });

    dom.adminDataTable.innerHTML = tableHTML + '</tbody></table>';
    lucide.createIcons();
}

function openEditSubmissionModal(id, data) {
    dom.editSubmissionId.value = id;
    document.getElementById('edit-common-namaSantri').value = data.namaSantri1 || data.namaSantri2 || data.namaSantri3 || '';

    ['edit-form1-fields', 'edit-form2-fields', 'edit-form3-fields'].forEach(id => document.getElementById(id).classList.add('hidden'));

    if (data.formType === 'form1') {
        const f = document.getElementById('edit-form1-fields');
        f.classList.remove('hidden');
        f.querySelector('#edit-f1-totalHafalan1').value = data.totalHafalan1 || '';
        f.querySelector('#edit-f1-nilaiItqon1').value = data.nilaiItqon1 || '';
        f.querySelector('#edit-f1-nilaiTajwid1').value = data.nilaiTajwid1 || '';
        f.querySelector('#edit-f1-catatanPerkembangan1').value = data.catatanPerkembangan1 || '';
    } else if (data.formType === 'form2') {
        const f = document.getElementById('edit-form2-fields');
        f.classList.remove('hidden');
        const sel = f.querySelector('#edit-f2-namaPembimbingMenyimak');
        sel.innerHTML = '<option value="">Pilih</option>' + allMentors.map(m => `<option value="${m.name}" ${m.name === data.namaPembimbingMenyimak ? 'selected' : ''}>${m.name}</option>`).join('');
        f.querySelector('#edit-f2-jumlahHafalanTasmi').value = data.jumlahHafalanTasmi || '';
        f.querySelector('#edit-f2-keteranganTasmi').value = data.keteranganTasmi || '';
    } else if (data.formType === 'form3') {
        const f = document.getElementById('edit-form3-fields');
        f.classList.remove('hidden');
        const rads = f.querySelectorAll('input[name="edit-f3-kehadiranHalaqoh"]');
        rads.forEach(r => r.checked = r.value === data.kehadiranHalaqoh);
        f.querySelector('#edit-f3-keteranganTambahan').value = data.keteranganTambahan || '';
    }
    dom.editSubmissionModal.classList.add('show');
}

// --- Events ---
document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-submission');
    if (editBtn) openEditSubmissionModal(editBtn.dataset.id, JSON.parse(editBtn.dataset.submission));

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) openDeleteModal(delBtn.dataset.id, delBtn.dataset.collection);
});

dom.saveEditSubmissionBtn.onclick = async () => {
    const id = dom.editSubmissionId.value;
    const formType = allFilteredDocs.find(d => d.id === id)?.formType;
    let update = {};

    if (formType === 'form1') {
        update = {
            totalHafalan1: document.getElementById('edit-f1-totalHafalan1').value,
            nilaiItqon1: parseFloat(document.getElementById('edit-f1-nilaiItqon1').value) || 0,
            nilaiTajwid1: parseFloat(document.getElementById('edit-f1-nilaiTajwid1').value) || 0,
            catatanPerkembangan1: document.getElementById('edit-f1-catatanPerkembangan1').value
        };
    } else if (formType === 'form2') {
        update = {
            namaPembimbingMenyimak: document.getElementById('edit-f2-namaPembimbingMenyimak').value,
            jumlahHafalanTasmi: document.getElementById('edit-f2-jumlahHafalanTasmi').value,
            keteranganTasmi: document.getElementById('edit-f2-keteranganTasmi').value
        };
    } else if (formType === 'form3') {
        const rad = document.querySelector('input[name="edit-f3-kehadiranHalaqoh"]:checked');
        update = {
            kehadiranHalaqoh: rad ? rad.value : '',
            keteranganTambahan: document.getElementById('edit-f3-keteranganTambahan').value
        };
    }

    try {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('formSubmissions').doc(id).update(update);
        showToast("Berhasil diperbarui.");
        dom.editSubmissionModal.classList.remove('show');
    } catch (e) { showToast("Gagal!", true); }
};

dom.confirmDeleteBtn.onclick = async () => {
    try {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(deleteInfo.collectionName).doc(deleteInfo.docId).delete();
        showToast("Data dihapus.");
        closeDeleteModal();
    } catch (e) { showToast("Gagal!", true); }
};

dom.formTypeFilter.onchange = fetchAdminData;
dom.submissionMonthFilter.onchange = fetchAdminData;
dom.submissionSearchInput.oninput = fetchAdminData;
dom.itemsPerPageSelect.onchange = (e) => { itemsPerPage = parseInt(e.target.value); renderSubmissionPage(); };
dom.cancelEditSubmissionBtn.onclick = () => dom.editSubmissionModal.classList.remove('show');
dom.cancelDeleteBtn.onclick = closeDeleteModal;

auth.onAuthStateChanged(user => {
    if (user) { currentUserId = user.uid; populateSubmissionMonthFilter(); preloadSubmissionsData(); }
    else { auth.signInAnonymously().catch(console.error); }
});
