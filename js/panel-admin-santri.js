// === Panel Admin Santri (Seting Halaqoh) - JavaScript ===
// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, writeBatch, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Global State & Unsubscribe Listeners ---
let currentUserId = null;
let unsubscribes = {};
let deleteInfo = { docId: null, collectionName: null, isBulk: false, ids: [] };
let allMentors = [];
let allStudents = [];
let allClasses = [];
let allHalaqohGroups = [];
let unsubscribeFormSubmissions = null;
let allFilteredDocs = [];
let currentPage = 1;
let itemsPerPage = 10;

// --- DOM Element References ---
const dom = {
    adminDataTable: document.getElementById('adminDataTable'),
    adminDataTableLoader: document.getElementById('adminDataTableLoader'),
    submissionMonthFilter: document.getElementById('submissionMonthFilter'),
    formTypeFilter: document.getElementById('formTypeFilter'),
    submissionSearchInput: document.getElementById('submissionSearchInput'),
    mentorsList: document.getElementById('mentorsList'),
    studentsList: document.getElementById('studentsList'),
    classesList: document.getElementById('classesList'),
    halaqohGroupsList: document.getElementById('halaqohGroupsList'),
    studentClassSelect: document.getElementById('studentClassSelect'),
    halaqohGroupMentorSelect: document.getElementById('halaqohGroupMentorSelect'),
    addMentorForm: document.getElementById('addMentorForm'),
    addStudentForm: document.getElementById('addStudentForm'),
    addClassForm: document.getElementById('addClassForm'),
    addHalaqohGroupForm: document.getElementById('addHalaqohGroupForm'),
    deleteModal: document.getElementById('deleteModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    manageStudentsModal: document.getElementById('manageStudentsModal'),
    closeManageStudentsModalBtn: document.getElementById('closeManageStudentsModalBtn'),
    manageStudentsModalTitle: document.getElementById('manageStudentsModalTitle'),
    allStudentsListForModal: document.getElementById('allStudentsListForModal'),
    groupStudentsListForModal: document.getElementById('groupStudentsListForModal'),
    modalClassFilter: document.getElementById('modalClassFilter'),
    modalStudentSearch: document.getElementById('modalStudentSearch'),
    studentListClassFilter: document.getElementById('studentListClassFilter'),
    bulkDeleteStudentsBtn: document.getElementById('bulkDeleteStudentsBtn'),
    bulkDeleteCount: document.getElementById('bulkDeleteCount'),
    editStudentModal: document.getElementById('editStudentModal'),
    editStudentForm: document.getElementById('editStudentForm'),
    editStudentId: document.getElementById('editStudentId'),
    editStudentName: document.getElementById('editStudentName'),
    editStudentClass: document.getElementById('editStudentClass'),
    closeEditStudentModalBtn: document.getElementById('closeEditStudentModalBtn'),
    cancelEditStudentBtn: document.getElementById('cancelEditStudentBtn'),
    editSubmissionModal: document.getElementById('editSubmissionModal'),
    editSubmissionForm: document.getElementById('editSubmissionForm'),
    editSubmissionId: document.getElementById('editSubmissionId'),
    closeEditSubmissionModalBtn: document.getElementById('closeEditSubmissionModalBtn'),
    cancelEditSubmissionBtn: document.getElementById('cancelEditSubmissionBtn'),
    editForm1Fields: document.getElementById('edit-form1-fields'),
    editForm2Fields: document.getElementById('edit-form2-fields'),
    editForm3Fields: document.getElementById('edit-form3-fields'),
    groupSearchInput: document.getElementById('groupSearchInput'),
    itemsPerPageSelect: document.getElementById('itemsPerPageSelect'),
    paginationControls: document.getElementById('paginationControls'),
    paginationInfo: document.getElementById('paginationInfo'),
    pageNumbers: document.getElementById('pageNumbers'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
};

const allManagementTabs = document.querySelectorAll('.admin-tab-content');
const allManagementTabBtns = document.querySelectorAll('.tab-btn');

// --- FUNCTION DECLARATIONS ---

function showToast(message, isError = false) {
    dom.toastMessage.textContent = message;
    dom.toast.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transform translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
    setTimeout(() => {
        dom.toast.className = dom.toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0');
    }, 3000);
}

function openDeleteModal(docId, collectionName) {
    deleteInfo = { docId, collectionName, isBulk: false, ids: [] };
    dom.deleteModal.classList.add('visible');
}

function closeDeleteModal() {
    dom.deleteModal.classList.remove('visible');
    deleteInfo = { docId: null, collectionName: null, isBulk: false, ids: [] };
}

function showLoading(element) {
    if (element) element.style.display = 'block';
}

function hideLoading(element) {
    if (element) element.style.display = 'none';
}

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

function fetchAdminData() {
    const formTypeFilter = dom.formTypeFilter.value;
    const monthFilter = dom.submissionMonthFilter.value;
    const searchTerm = dom.submissionSearchInput.value.toLowerCase();

    if (!currentUserId) return;
    if (unsubscribeFormSubmissions) unsubscribeFormSubmissions();

    showLoading(dom.adminDataTableLoader);
    dom.adminDataTable.innerHTML = '';

    const submissionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'formSubmissions');
    let q;

    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        const startDate = Timestamp.fromDate(new Date(year, month - 1, 1));
        const endDate = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));
        if (formTypeFilter) {
            q = query(submissionsRef, where('formType', '==', formTypeFilter), where('timestamp', '>=', startDate), where('timestamp', '<=', endDate));
        } else {
            q = query(submissionsRef, where('timestamp', '>=', startDate), where('timestamp', '<=', endDate));
        }
    } else {
        if (formTypeFilter) {
            q = query(submissionsRef, where('formType', '==', formTypeFilter));
        } else {
            q = query(submissionsRef);
        }
    }

    unsubscribeFormSubmissions = onSnapshot(q, (snapshot) => {
        hideLoading(dom.adminDataTableLoader);

        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

        if (searchTerm) {
            docs = docs.filter(doc => {
                const mentorName = doc.namaPembimbing1 || doc.namaPembimbing2 || doc.namaPembimbingHalaqoh || '';
                const studentName = doc.namaSantri1 || doc.namaSantri2 || doc.namaSantri3 || '';
                const studentClass = allStudents.find(s => s.name === studentName)?.class || '';
                return mentorName.toLowerCase().includes(searchTerm) ||
                       studentName.toLowerCase().includes(searchTerm) ||
                       studentClass.toLowerCase().includes(searchTerm);
            });
        }

        allFilteredDocs = docs;
        currentPage = 1;
        renderSubmissionPage();
    }, (error) => {
        console.error("Error fetching admin data:", error);
        hideLoading(dom.adminDataTableLoader);
        showToast("Gagal memuat data submisi.", true);
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
        dom.adminDataTable.innerHTML = `<p class="text-center text-gray-400 py-8">Tidak ada data untuk filter ini.</p>`;
        dom.paginationControls.classList.add('hidden');
        return;
    }

    dom.paginationControls.classList.remove('hidden');
    dom.paginationInfo.textContent = `${start + 1}–${end} dari ${total} data`;
    dom.prevPageBtn.disabled = currentPage === 1;
    dom.prevPageBtn.style.opacity = currentPage === 1 ? '0.4' : '1';
    dom.nextPageBtn.disabled = currentPage === totalPages;
    dom.nextPageBtn.style.opacity = currentPage === totalPages ? '0.4' : '1';

    dom.pageNumbers.innerHTML = '';
    const maxBtns = 5;
    let startP = Math.max(1, currentPage - 2);
    let endP = Math.min(totalPages, startP + maxBtns - 1);
    if (endP - startP < maxBtns - 1) startP = Math.max(1, endP - maxBtns + 1);
    for (let i = startP; i <= endP; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = `padding:0.25rem 0.6rem;font-size:0.8rem;border-radius:0.375rem;font-weight:600;cursor:pointer;border:1px solid transparent;${
            i === currentPage ? 'background:#3b82f6;color:white;' : 'background:#4b5563;color:#d1d5db;'
        }`;
        btn.addEventListener('click', () => { currentPage = i; renderSubmissionPage(); });
        dom.pageNumbers.appendChild(btn);
    }

    const formTypeNames = { 'form1': 'Data Santri', 'form2': "Tasmi'", 'form3': 'Halaqoh' };
    const headers = [
        { display: 'Tipe', sources: ['formType'] },
        { display: 'Pembimbing', sources: ['namaPembimbing1', 'namaPembimbing2', 'namaPembimbingHalaqoh'] },
        { display: 'Santri', sources: ['namaSantri1', 'namaSantri2', 'namaSantri3'] },
        { display: 'Menyimak', sources: ['namaPembimbingMenyimak'] },
        { display: 'Waktu Kirim', sources: ['timestamp'] },
        { display: 'Status', sources: ['kehadiranHalaqoh'] },
        { display: 'Keterangan', sources: ['keteranganTambahan', 'keteranganTasmi'] },
        { display: 'Aksi', sources: [] }
    ];

    let tableHTML = `<table class="admin-table"><thead><tr>`;
    headers.forEach(h => tableHTML += `<th>${h.display}</th>`);
    tableHTML += `</tr></thead><tbody>`;

    pageDocs.forEach(data => {
        tableHTML += `<tr>`;
        headers.forEach(h => {
            if (h.display === 'Aksi') {
                tableHTML += `<td>
                    <div class="flex items-center gap-1">
                        <button class="btn btn-icon !p-1 btn-edit-submission" data-id="${data.id}" data-submission='${JSON.stringify(data)}'>
                            <i data-lucide="edit" class="w-4 h-4 text-blue-400"></i>
                        </button>
                        <button class="btn btn-icon !p-1 btn-delete" data-id="${data.id}" data-collection="formSubmissions">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                        </button>
                    </div>
                </td>`;
            } else {
                let value = h.sources.map(s => data[s]).find(v => v !== undefined && v !== null && v !== '') || '-';
                if (h.display === 'Waktu Kirim' && value.toDate) value = value.toDate().toLocaleString('id-ID');
                if (h.display === 'Keterangan') {
                    if (data.formType === 'form3') value = data.keteranganTambahan || '-';
                    else if (data.formType === 'form2') value = data.keteranganTasmi ? (data.keteranganTasmi.charAt(0).toUpperCase() + data.keteranganTasmi.slice(1).replace('_', ' ')) : '-';
                    else value = '-';
                }
                if (h.display === 'Tipe') value = formTypeNames[value] || value;
                tableHTML += `<td>${value}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table>`;
    dom.adminDataTable.innerHTML = tableHTML;
    lucide.createIcons();
}

function createListRenderer(config) {
    if (unsubscribes[config.collectionName]) unsubscribes[config.collectionName]();

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', config.collectionName), orderBy('name'));
    unsubscribes[config.collectionName] = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            config.listElement.innerHTML = `<p class="text-center text-gray-400 py-4">Belum ada data.</p>`;
            if (config.onLoad) config.onLoad([]);
            return;
        }

        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        config.listElement.innerHTML = items.map(item => `
            <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                <p class="text-white font-medium">${item.name} ${item.class ? `<span class="text-xs text-gray-400 ml-2">${item.class}</span>` : ''}</p>
                <button class="btn btn-icon btn-delete" data-id="${item.id}" data-collection="${config.collectionName}">
                    <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                </button>
            </div>
        `).join('');

        if (config.onLoad) config.onLoad(items);
        lucide.createIcons();
    }, (error) => {
        console.error(`Error fetching ${config.collectionName}:`, error);
        showToast(`Gagal memuat ${config.collectionName}.`, true);
        config.listElement.innerHTML = `<p class="text-red-400">Gagal memuat data.</p>`;
    });
}

function renderStudentList() {
    const classFilter = dom.studentListClassFilter.value;
    const listElement = dom.studentsList;

    let studentsToRender = allStudents;
    if (classFilter) {
        studentsToRender = allStudents.filter(s => s.class === classFilter);
    }

    if (studentsToRender.length === 0) {
        listElement.innerHTML = `<p class="text-center text-gray-400 py-4">Tidak ada santri di kelas ini.</p>`;
        dom.bulkDeleteStudentsBtn.classList.add('hidden');
        return;
    }

    listElement.innerHTML = `
        <div class="flex items-center justify-between bg-gray-800 p-2 rounded-lg mb-2">
            <label class="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" id="selectAllStudents" class="form-checkbox bg-gray-700 border-gray-600 rounded">
                Pilih Semua
            </label>
        </div>
        <div class="space-y-2">
        ${studentsToRender.map(item => `
            <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                <label class="flex items-center gap-3 flex-grow">
                    <input type="checkbox" class="student-checkbox form-checkbox bg-gray-700 border-gray-600 rounded" data-id="${item.id}">
                    <span class="text-white font-medium">${item.name}</span>
                    <span class="text-xs text-gray-400">${item.class}</span>
                </label>
                <div class="flex items-center">
                    <button class="btn btn-icon !p-1 btn-edit-student" data-id="${item.id}" data-name="${item.name}" data-class="${item.class}">
                        <i data-lucide="edit" class="w-4 h-4 text-blue-400"></i>
                    </button>
                    <button class="btn btn-icon !p-1 btn-delete" data-id="${item.id}" data-collection="students">
                        <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                    </button>
                </div>
            </div>
        `).join('')}
        </div>
    `;
    lucide.createIcons();
    addStudentListEventListeners();
}

function addStudentListEventListeners() {
    const selectAllCheckbox = document.getElementById('selectAllStudents');
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');

    function updateBulkDeleteButton() {
        const selectedCount = document.querySelectorAll('.student-checkbox:checked').length;
        if (selectedCount > 0) {
            dom.bulkDeleteStudentsBtn.classList.remove('hidden');
            dom.bulkDeleteCount.textContent = `Hapus (${selectedCount})`;
        } else {
            dom.bulkDeleteStudentsBtn.classList.add('hidden');
        }
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = selectedCount > 0 && selectedCount === studentCheckboxes.length;
        }
    }

    selectAllCheckbox?.addEventListener('change', (e) => {
        studentCheckboxes.forEach(cb => { cb.checked = e.target.checked; });
        updateBulkDeleteButton();
    });

    studentCheckboxes.forEach(cb => { cb.addEventListener('change', updateBulkDeleteButton); });
    updateBulkDeleteButton();
}

function populateClassDropdowns(classes) {
    const selects = [dom.studentClassSelect, dom.studentListClassFilter];
    selects.forEach(selectElement => {
        if (selectElement) {
            const currentValue = selectElement.value;
            const defaultOptionText = selectElement.id === 'studentListClassFilter' ? 'Semua Kelas' : 'Pilih Kelas';
            selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.name;
                option.textContent = cls.name;
                selectElement.appendChild(option);
            });
            if (classes.some(c => c.name === currentValue)) selectElement.value = currentValue;
        }
    });
}

function preloadManagementData() {
    if (unsubscribes['allMentors']) unsubscribes['allMentors']();
    const mentorsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'mentors'), orderBy('name'));
    unsubscribes['allMentors'] = onSnapshot(mentorsQuery, snapshot => {
        allMentors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mentorOptions = '<option value="">Pilih Pembimbing</option>' + 
            allMentors.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        
        dom.halaqohGroupMentorSelect.innerHTML = mentorOptions;
        const editMentorSelect = document.getElementById('edit-f2-namaPembimbingMenyimak');
        if (editMentorSelect) editMentorSelect.innerHTML = mentorOptions;
    });

    if (unsubscribes['allStudents']) unsubscribes['allStudents']();
    const studentsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'), orderBy('name'));
    unsubscribes['allStudents'] = onSnapshot(studentsQuery, snapshot => {
        allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStudentList();
    });

    if (unsubscribes['allClasses']) unsubscribes['allClasses']();
    const classesQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'classes'), orderBy('name'));
    unsubscribes['allClasses'] = onSnapshot(classesQuery, snapshot => {
        allClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateClassDropdowns(allClasses);
        dom.modalClassFilter.innerHTML = '<option value="">Semua Kelas</option>';
        allClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.name;
            option.textContent = cls.name;
            dom.modalClassFilter.appendChild(option);
        });
    });

    if (unsubscribes['allHalaqohGroups']) unsubscribes['allHalaqohGroups']();
    const groupsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups'));
    unsubscribes['allHalaqohGroups'] = onSnapshot(groupsQuery, snapshot => {
        allHalaqohGroups = snapshot.docs.map(doc => doc.data());
    });
}

function fetchHalaqohGroups() {
    const searchTerm = dom.groupSearchInput.value.toLowerCase();

    if (unsubscribes['halaqohGroups']) unsubscribes['halaqohGroups']();
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups'), orderBy('groupName'));
    unsubscribes['halaqohGroups'] = onSnapshot(q, (snapshot) => {
        let groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (searchTerm) {
            groups = groups.filter(group => {
                const mentor = allMentors.find(m => m.id === group.mentorId);
                return mentor && mentor.name.toLowerCase().includes(searchTerm);
            });
        }

        dom.halaqohGroupsList.innerHTML = '';
        if (groups.length === 0) {
            dom.halaqohGroupsList.innerHTML = `<p class="text-center text-gray-400 py-4">Tidak ada grup yang cocok.</p>`;
            return;
        }
        groups.forEach(group => {
            const mentor = allMentors.find(m => m.id === group.mentorId);
            const groupCard = document.createElement('div');
            groupCard.className = 'p-4 bg-gray-700 rounded-lg';
            groupCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-white">${mentor?.name || group.groupName}</h4>
                        <p class="text-sm text-gray-400 mt-1">${group.studentIds?.length || 0} Santri</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm !px-2 manage-students-btn" data-group-id="${group.id}" data-group-name="${mentor?.name || group.groupName}">
                            <i data-lucide="users" class="w-4 h-4"></i>
                        </button>
                        <button class="btn btn-danger btn-sm !px-2 btn-delete" data-id="${group.id}" data-collection="halaqohGroups">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `;
            dom.halaqohGroupsList.appendChild(groupCard);
        });
        lucide.createIcons();
    });
}

function handleFormSubmit(form, collectionName, data) {
    if (!data.name) { showToast("Nama tidak boleh kosong.", true); return; }
    if (!currentUserId) { showToast("Autentikasi diperlukan.", true); return; }
    addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), {
        ...data, timestamp: serverTimestamp(), addedBy: currentUserId
    }).then(() => {
        showToast(`${collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1)} berhasil ditambahkan!`);
        form.reset();
    }).catch(error => {
        console.error(`Error adding ${collectionName}:`, error);
        showToast(`Gagal menambahkan ${collectionName.slice(0, -1)}.`, true);
    });
}

let currentGroupId = null;
function openManageStudentsModal(groupId, groupName) {
    currentGroupId = groupId;
    dom.manageStudentsModalTitle.textContent = `Kelola Santri: ${groupName}`;
    renderStudentListsForModal();
    dom.manageStudentsModal.classList.add('visible');
}
function closeManageStudentsModal() {
    if (unsubscribes['modalGroup']) unsubscribes['modalGroup']();
    currentGroupId = null;
    dom.manageStudentsModal.classList.remove('visible');
}

function renderStudentListsForModal() {
    if (!currentGroupId) return;
    const classFilter = dom.modalClassFilter.value;
    const searchTerm = dom.modalStudentSearch.value.toLowerCase();
    const groupRef = doc(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups', currentGroupId);

    if (unsubscribes['modalGroup']) unsubscribes['modalGroup']();
    unsubscribes['modalGroup'] = onSnapshot(groupRef, (docSnap) => {
        const groupStudentIds = docSnap.data()?.studentIds || [];

        const groupStudents = allStudents.filter(s => groupStudentIds.includes(s.id));
        dom.groupStudentsListForModal.innerHTML = groupStudents.map(student => `
            <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
                <span>${student.name}</span>
                <button class="btn btn-icon !p-1 remove-student-btn" data-student-id="${student.id}">
                    <i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i>
                </button>
            </div>
        `).join('') || '<p class="text-gray-400 text-sm">Tidak ada santri di grup ini.</p>';

        const allAssignedStudentIds = new Set(allHalaqohGroups.flatMap(g => g.studentIds || []));
        let availableStudents = allStudents.filter(s => !allAssignedStudentIds.has(s.id));

        if (classFilter) availableStudents = availableStudents.filter(s => s.class === classFilter);
        if (searchTerm) availableStudents = availableStudents.filter(s => s.name.toLowerCase().includes(searchTerm));

        dom.allStudentsListForModal.innerHTML = availableStudents.map(student => `
            <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
                <span>${student.name}</span>
                <button class="btn btn-icon !p-1 add-student-btn" data-student-id="${student.id}">
                    <i data-lucide="plus-circle" class="w-4 h-4 text-green-400"></i>
                </button>
            </div>
        `).join('') || '<p class="text-gray-400 text-sm">Tidak ada santri yang tersedia atau semua sudah masuk grup.</p>';

        lucide.createIcons();
    });
}

function openEditStudentModal(id, name, currentClass) {
    dom.editStudentId.value = id;
    dom.editStudentName.value = name;
    dom.editStudentClass.innerHTML = '';
    allClasses.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.name;
        option.textContent = cls.name;
        if (cls.name === currentClass) option.selected = true;
        dom.editStudentClass.appendChild(option);
    });
    dom.editStudentModal.classList.add('visible');
}

function closeEditStudentModal() { dom.editStudentModal.classList.remove('visible'); }

function openEditSubmissionModal(submissionId, submissionData) {
    dom.editSubmissionId.value = submissionId;
    document.getElementById('edit-form1-fields').classList.add('hidden');
    document.getElementById('edit-form2-fields').classList.add('hidden');
    document.getElementById('edit-form3-fields').classList.add('hidden');

    const formType = submissionData.formType;
    if (formType === 'form1') {
        const fields = document.getElementById('edit-form1-fields');
        fields.classList.remove('hidden');
        fields.querySelector('#edit-f1-totalHafalan1').value = submissionData.totalHafalan1 || '';
        fields.querySelector('#edit-f1-hafalanTerakhir1').value = submissionData.hafalanTerakhir1 || '';
        fields.querySelector('#edit-f1-ziyadahPages1').value = submissionData.ziyadahPages1 || '';
        fields.querySelector('#edit-f1-murojaahPages1').value = submissionData.murojaahPages1 || '';
        fields.querySelector('#edit-f1-nilaiItqon1').value = submissionData.nilaiItqon1 || '';
        fields.querySelector('#edit-f1-nilaiTajwid1').value = submissionData.nilaiTajwid1 || '';
    } else if (formType === 'form2') {
        const fields = document.getElementById('edit-form2-fields');
        fields.classList.remove('hidden');
        const mentorSelect = fields.querySelector('#edit-f2-namaPembimbingMenyimak');
        if (mentorSelect) {
            const mentor = allMentors.find(m => m.name === submissionData.namaPembimbingMenyimak);
            mentorSelect.value = mentor ? mentor.id : '';
        }
        fields.querySelector('#edit-f2-jumlahHafalanTasmi').value = submissionData.jumlahHafalanTasmi || '';
        fields.querySelector('#edit-f2-keteranganTasmi').value = submissionData.keteranganTasmi || '';
    } else if (formType === 'form3') {
        const fields = document.getElementById('edit-form3-fields');
        fields.classList.remove('hidden');
        const radioGroup = fields.querySelectorAll('input[name="edit-f3-kehadiranHalaqoh"]');
        radioGroup.forEach(radio => { radio.checked = radio.value === submissionData.kehadiranHalaqoh; });
        fields.querySelector('#edit-f3-keteranganTambahan').value = submissionData.keteranganTambahan || '';
    }

    dom.editSubmissionModal.classList.add('visible');
}

function closeEditSubmissionModal() { dom.editSubmissionModal.classList.remove('visible'); }

function showManagementTab(contentId, buttonId) {
    allManagementTabs.forEach(tab => tab.classList.add('hidden'));
    allManagementTabBtns.forEach(btn => btn.classList.remove('active'));
    document.getElementById(contentId)?.classList.remove('hidden');
    document.getElementById(buttonId)?.classList.add('active');
    Object.keys(unsubscribes).forEach(key => { if (unsubscribes[key]) unsubscribes[key](); });
    preloadManagementData();
    if (contentId === 'mentorsContent') createListRenderer({ listElement: dom.mentorsList, collectionName: 'mentors' });
    if (contentId === 'classesContent') createListRenderer({ listElement: dom.classesList, collectionName: 'classes' });
    if (contentId === 'halaqohGroupsContent') fetchHalaqohGroups();
}

// --- EVENT LISTENERS ---

dom.studentListClassFilter?.addEventListener('change', renderStudentList);
dom.formTypeFilter?.addEventListener('change', fetchAdminData);
dom.submissionMonthFilter?.addEventListener('change', fetchAdminData);
dom.submissionSearchInput?.addEventListener('input', fetchAdminData);
dom.groupSearchInput?.addEventListener('input', fetchHalaqohGroups);
dom.itemsPerPageSelect?.addEventListener('change', () => {
    itemsPerPage = parseInt(dom.itemsPerPageSelect.value);
    currentPage = 1;
    renderSubmissionPage();
});
dom.prevPageBtn?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderSubmissionPage(); } });
dom.nextPageBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(allFilteredDocs.length / itemsPerPage);
    if (currentPage < totalPages) { currentPage++; renderSubmissionPage(); }
});

dom.bulkDeleteStudentsBtn?.addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.dataset.id);
    if (selectedIds.length === 0) return;
    deleteInfo = { docId: null, collectionName: 'students', isBulk: true, ids: selectedIds };
    dom.deleteModal.querySelector('p').textContent = `Apakah Anda yakin ingin menghapus ${selectedIds.length} santri yang dipilih? Tindakan ini tidak dapat dibatalkan.`;
    dom.deleteModal.classList.add('visible');
});

dom.confirmDeleteBtn?.addEventListener('click', async () => {
    const { collectionName, isBulk, ids, docId } = deleteInfo;
    if (isBulk) {
        const batch = writeBatch(db);
        ids.forEach(id => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.delete(docRef); });
        try { await batch.commit(); showToast(`${ids.length} item berhasil dihapus.`); }
        catch (error) { console.error("Error bulk deleting:", error); showToast("Gagal menghapus item secara massal.", true); }
    } else {
        if (!docId || !collectionName) return;
        try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId)); showToast("Item berhasil dihapus."); }
        catch (error) { console.error("Error deleting:", error); showToast("Gagal menghapus item.", true); }
    }
    closeDeleteModal();
    dom.deleteModal.querySelector('p').textContent = `Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.`;
});

document.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.btn-delete');
    if (deleteButton) openDeleteModal(deleteButton.dataset.id, deleteButton.dataset.collection);
    const manageBtn = e.target.closest('.manage-students-btn');
    if (manageBtn) openManageStudentsModal(manageBtn.dataset.groupId, manageBtn.dataset.groupName);
    const editBtn = e.target.closest('.btn-edit-student');
    if (editBtn) openEditStudentModal(editBtn.dataset.id, editBtn.dataset.name, editBtn.dataset.class);
    const editSubmissionBtn = e.target.closest('.btn-edit-submission');
    if (editSubmissionBtn) {
        const submissionData = JSON.parse(editSubmissionBtn.dataset.submission);
        openEditSubmissionModal(editSubmissionBtn.dataset.id, submissionData);
    }
    const addStudentBtn = e.target.closest('.add-student-btn');
    if (addStudentBtn && currentGroupId) {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups', currentGroupId), { studentIds: arrayUnion(addStudentBtn.dataset.studentId) });
    }
    const removeStudentBtn = e.target.closest('.remove-student-btn');
    if (removeStudentBtn && currentGroupId) {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups', currentGroupId), { studentIds: arrayRemove(removeStudentBtn.dataset.studentId) });
    }
});

dom.cancelDeleteBtn?.addEventListener('click', closeDeleteModal);
dom.closeManageStudentsModalBtn?.addEventListener('click', closeManageStudentsModal);
dom.closeEditStudentModalBtn?.addEventListener('click', closeEditStudentModal);
dom.cancelEditStudentBtn?.addEventListener('click', closeEditStudentModal);
dom.closeEditSubmissionModalBtn?.addEventListener('click', closeEditSubmissionModal);
dom.cancelEditSubmissionBtn?.addEventListener('click', closeEditSubmissionModal);

dom.modalClassFilter?.addEventListener('change', renderStudentListsForModal);
dom.modalStudentSearch?.addEventListener('input', renderStudentListsForModal);

dom.addMentorForm?.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(dom.addMentorForm, 'mentors', { name: dom.addMentorForm.querySelector('#mentorName').value.trim() }); });
dom.addClassForm?.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(dom.addClassForm, 'classes', { name: dom.addClassForm.querySelector('#className').value.trim() }); });
dom.addStudentForm?.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(dom.addStudentForm, 'students', { name: dom.addStudentForm.querySelector('#studentName').value.trim(), class: dom.studentClassSelect.value }); });

dom.addHalaqohGroupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = dom.addHalaqohGroupForm.querySelector('#halaqohGroupMentorSelect');
    const mentorId = select.value;
    const mentorName = select.options[select.selectedIndex].text;
    if (!mentorId) { showToast("Pembimbing harus dipilih.", true); return; }
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'halaqohGroups'), {
            mentorId, groupName: mentorName, studentIds: [], timestamp: serverTimestamp()
        });
        showToast("Grup berhasil dibuat.");
        dom.addHalaqohGroupForm.reset();
    } catch (error) { showToast("Gagal membuat grup.", true); }
});

dom.editStudentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = dom.editStudentId.value;
    const name = dom.editStudentName.value.trim();
    const studentClass = dom.editStudentClass.value;
    if (!id || !name) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { name, class: studentClass });
        showToast("Data santri berhasil diperbarui.");
        closeEditStudentModal();
    } catch (error) { showToast("Gagal memperbarui santri.", true); }
});

dom.editSubmissionForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = dom.editSubmissionId.value;
    if (!id) return;
    const form1Fields = document.getElementById('edit-form1-fields');
    const form2Fields = document.getElementById('edit-form2-fields');
    const form3Fields = document.getElementById('edit-form3-fields');
    let dataToUpdate = {};

    if (!form1Fields.classList.contains('hidden')) {
        dataToUpdate = {
            totalHafalan1: document.getElementById('edit-f1-totalHafalan1').value,
            hafalanTerakhir1: document.getElementById('edit-f1-hafalanTerakhir1').value,
            ziyadahPages1: parseFloat(document.getElementById('edit-f1-ziyadahPages1').value) || 0,
            murojaahPages1: parseFloat(document.getElementById('edit-f1-murojaahPages1').value) || 0,
            nilaiItqon1: parseFloat(document.getElementById('edit-f1-nilaiItqon1').value) || 0,
            nilaiTajwid1: parseFloat(document.getElementById('edit-f1-nilaiTajwid1').value) || 0,
        };
    } else if (!form2Fields.classList.contains('hidden')) {
        const mentorSelect = document.getElementById('edit-f2-namaPembimbingMenyimak');
        const mentorName = mentorSelect.options[mentorSelect.selectedIndex]?.text || '';
        dataToUpdate = {
            namaPembimbingMenyimak: mentorName,
            jumlahHafalanTasmi: document.getElementById('edit-f2-jumlahHafalanTasmi').value,
            keteranganTasmi: document.getElementById('edit-f2-keteranganTasmi').value,
        };
    } else if (!form3Fields.classList.contains('hidden')) {
        const checkedRadio = form3Fields.querySelector('input[name="edit-f3-kehadiranHalaqoh"]:checked');
        dataToUpdate = {
            kehadiranHalaqoh: checkedRadio ? checkedRadio.value : '',
            keteranganTambahan: document.getElementById('edit-f3-keteranganTambahan').value,
        };
    }

    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'formSubmissions', id), dataToUpdate);
        showToast("Submisi berhasil diperbarui.");
        closeEditSubmissionModal();
    } catch (error) { console.error("Error updating submission:", error); showToast("Gagal memperbarui submisi.", true); }
});

document.getElementById('showMentorsTabBtn')?.addEventListener('click', () => showManagementTab('mentorsContent', 'showMentorsTabBtn'));
document.getElementById('showStudentsTabBtn')?.addEventListener('click', () => showManagementTab('studentsContent', 'showStudentsTabBtn'));
document.getElementById('showClassesTabBtn')?.addEventListener('click', () => showManagementTab('classesContent', 'showClassesTabBtn'));
document.getElementById('showHalaqohGroupsTabBtn')?.addEventListener('click', () => showManagementTab('halaqohGroupsContent', 'showHalaqohGroupsTabBtn'));

// --- AUTHENTICATION & INITIAL SETUP ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        populateSubmissionMonthFilter();
        fetchAdminData();
        showManagementTab('mentorsContent', 'showMentorsTabBtn');
    } else {
        try { await (initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth)); }
        catch (error) { console.error("Authentication error:", error); }
    }
});
