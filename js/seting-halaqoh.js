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

// Initialize Firebase (Compat)
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

const auth = firebase.auth();
const db = firebase.firestore();
const { serverTimestamp, arrayUnion, arrayRemove } = firebase.firestore.FieldValue;

// --- DOM Element References ---
const dom = {
    entityList: document.getElementById('entityList'),
    groupSearchInput: document.getElementById('groupSearchInput'),
    studentListClassFilter: document.getElementById('studentListClassFilter'),
    bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
    bulkDeleteCount: document.getElementById('bulkDeleteCount'),
    addMainEntityBtn: document.getElementById('addMainEntityBtn'),
    
    // Modals
    entityModal: document.getElementById('entityModal'),
    entityModalTitle: document.getElementById('entityModalTitle'),
    entityModalFields: document.getElementById('entityModalFields'),
    saveEntityBtn: document.getElementById('saveEntityBtn'),
    cancelEntityBtn: document.getElementById('cancelEntityBtn'),
    
    deleteModal: document.getElementById('deleteModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    
    manageStudentsModal: document.getElementById('manageStudentsModal'),
    manageStudentsModalTitle: document.getElementById('manageStudentsModalTitle'),
    allStudentsListForModal: document.getElementById('allStudentsListForModal'),
    groupStudentsListForModal: document.getElementById('groupStudentsListForModal'),
    modalClassFilter: document.getElementById('modalClassFilter'),
    modalStudentSearch: document.getElementById('modalStudentSearch'),
    closeManageStudentsBtn: document.getElementById('closeManageStudentsBtn'),
    
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// --- State Variables ---
let currentUserId = null;
let activeTab = 'halaqohGroups';
let allMentors = [];
let allStudents = [];
let allClasses = [];
let allHalaqohGroups = [];
let unsubscribes = {};
let deleteInfo = { docId: null, collectionName: null, isBulk: false, ids: [] };

const allTabBtns = document.querySelectorAll('.tab-nav button');

// --- Helper Functions ---
function showToast(message, isError = false) {
    if (!dom.toast) return;
    dom.toastMessage.textContent = message;
    dom.toast.classList.remove('success', 'error');
    dom.toast.classList.add(isError ? 'error' : 'success');
    dom.toast.classList.add('show');
    setTimeout(() => { dom.toast.classList.remove('show'); }, 3000);
}

function openDeleteModal(docId, collectionName, isBulk = false, ids = []) {
    deleteInfo = { docId, collectionName, isBulk, ids };
    dom.deleteModal.classList.add('show');
}

function closeDeleteModal() {
    dom.deleteModal.classList.remove('show');
    deleteInfo = { docId: null, collectionName: null, isBulk: false, ids: [] };
}

function updateTabUI(tabId) {
    activeTab = tabId;
    allTabBtns.forEach(btn => {
        const isMatch = btn.id.includes(tabId.charAt(0).toUpperCase() + tabId.slice(1));
        // Special case for halaqohGroups
        const isHalaqoh = btn.id === 'showHalaqohGroupsTabBtn' && tabId === 'halaqohGroups';
        btn.classList.toggle('active', isMatch || isHalaqoh);
    });

    // Toggle filter visibility
    dom.studentListClassFilter.classList.toggle('hidden', activeTab !== 'students');
    dom.groupSearchInput.placeholder = activeTab === 'students' ? 'Cari santri...' : 
                                      activeTab === 'mentors' ? 'Cari pembimbing...' :
                                      activeTab === 'halaqohGroups' ? 'Cari grup/pembimbing...' : 'Cari...';

    renderActiveTabContent();
}

function renderActiveTabContent() {
    if (activeTab === 'halaqohGroups') fetchHalaqohGroups();
    else if (activeTab === 'students') renderStudentList();
    else renderGenericList(activeTab);
}

function renderGenericList(collectionName) {
    const searchTerm = dom.groupSearchInput.value.toLowerCase();
    let data = [];
    if (collectionName === 'mentors') data = allMentors;
    else if (collectionName === 'classes') data = allClasses;

    if (searchTerm) data = data.filter(item => item.name.toLowerCase().includes(searchTerm));

    if (data.length === 0) {
        dom.entityList.innerHTML = `<p class="text-center text-gray-400 py-12">Belum ada data.</p>`;
        dom.bulkDeleteBtn.classList.add('hidden');
        return;
    }

    dom.entityList.innerHTML = `
        <div class="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-white/5 mb-4">
            <label class="flex items-center gap-3 text-sm font-semibold text-gray-300 cursor-pointer">
                <input type="checkbox" class="select-all-checkbox w-4 h-4 rounded border-gray-600 bg-gray-700">
                Pilih Semua
            </label>
        </div>
        <div class="grid gap-3">
            ${data.map(item => `
                <div class="flex items-center justify-between bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                    <label class="flex items-center gap-4 flex-grow cursor-pointer">
                        <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-600 bg-gray-700" data-id="${item.id}">
                        <span class="text-white font-medium">${item.name}</span>
                    </label>
                    <button class="icon-btn !bg-red-500/10 hover:!bg-red-500/20 text-red-500 btn-delete" data-id="${item.id}" data-collection="${collectionName}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
    attachBulkEvents();
}

function renderStudentList() {
    const classFilter = dom.studentListClassFilter.value;
    const searchTerm = dom.groupSearchInput.value.toLowerCase();

    let data = allStudents;
    if (classFilter) data = data.filter(s => s.class === classFilter);
    if (searchTerm) data = data.filter(s => s.name.toLowerCase().includes(searchTerm));

    if (data.length === 0) {
        dom.entityList.innerHTML = `<p class="text-center text-gray-400 py-12">Tidak ada santri ditemukan.</p>`;
        dom.bulkDeleteBtn.classList.add('hidden');
        return;
    }

    dom.entityList.innerHTML = `
        <div class="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-white/5 mb-4">
            <label class="flex items-center gap-3 text-sm font-semibold text-gray-300 cursor-pointer">
                <input type="checkbox" class="select-all-checkbox w-4 h-4 rounded border-gray-600 bg-gray-700">
                Pilih Semua
            </label>
        </div>
        <div class="grid gap-3">
            ${data.map(item => `
                <div class="flex items-center justify-between bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                    <label class="flex items-center gap-4 flex-grow cursor-pointer">
                        <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-600 bg-gray-700" data-id="${item.id}">
                        <div class="flex flex-col">
                            <span class="text-white font-medium">${item.name}</span>
                            <span class="text-[10px] text-blue-400 font-bold uppercase tracking-wider">${item.class || 'Tanpa Kelas'}</span>
                        </div>
                    </label>
                    <button class="icon-btn !bg-red-500/10 hover:!bg-red-500/20 text-red-500 btn-delete" data-id="${item.id}" data-collection="students">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
    attachBulkEvents();
}

function fetchHalaqohGroups() {
    const searchTerm = dom.groupSearchInput.value.toLowerCase();
    let groups = allHalaqohGroups;

    if (searchTerm) {
        groups = groups.filter(group => {
            const mentor = allMentors.find(m => m.id === group.mentorId);
            return (mentor && mentor.name.toLowerCase().includes(searchTerm)) || group.groupName.toLowerCase().includes(searchTerm);
        });
    }

    if (groups.length === 0) {
        dom.entityList.innerHTML = `<p class="text-center text-gray-400 py-12">Tidak ada grup halaqoh ditemukan.</p>`;
        dom.bulkDeleteBtn.classList.add('hidden');
        return;
    }

    dom.entityList.innerHTML = `
        <div class="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-white/5 mb-4">
            <label class="flex items-center gap-3 text-sm font-semibold text-gray-300 cursor-pointer">
                <input type="checkbox" class="select-all-checkbox w-4 h-4 rounded border-gray-600 bg-gray-700">
                Pilih Semua
            </label>
        </div>
        <div class="grid gap-4">
            ${groups.map(group => {
                const mentor = allMentors.find(m => m.id === group.mentorId);
                return `
                <div class="p-5 bg-slate-800/40 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                    <div class="flex justify-between items-start">
                        <div class="flex items-start gap-4">
                            <input type="checkbox" class="item-checkbox mt-1.5 w-4 h-4 rounded border-gray-600 bg-gray-700" data-id="${group.id}">
                            <div>
                                <h4 class="font-bold text-white text-lg">${mentor?.name || group.groupName}</h4>
                                <div class="flex items-center gap-3 mt-2">
                                    <span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider">Halaqoh</span>
                                    <span class="text-xs text-gray-400">${group.studentIds?.length || 0} Santri Berdaftar</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="icon-btn manage-students-btn" data-group-id="${group.id}" data-group-name="${mentor?.name || group.groupName}">
                                <i data-lucide="users" class="w-4 h-4"></i>
                            </button>
                            <button class="icon-btn !bg-red-500/10 hover:!bg-red-500/20 text-red-500 btn-delete" data-id="${group.id}" data-collection="halaqohGroups">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
    lucide.createIcons();
    attachBulkEvents();
}

function attachBulkEvents() {
    const selectAll = dom.entityList.querySelector('.select-all-checkbox');
    const items = dom.entityList.querySelectorAll('.item-checkbox');
    
    const updateUI = () => {
        const checked = dom.entityList.querySelectorAll('.item-checkbox:checked');
        dom.bulkDeleteCount.textContent = checked.length;
        dom.bulkDeleteBtn.classList.toggle('hidden', checked.length === 0);
        if (selectAll) selectAll.checked = checked.length > 0 && checked.length === items.length;
    };

    selectAll?.addEventListener('change', (e) => {
        items.forEach(i => i.checked = e.target.checked);
        updateUI();
    });

    items.forEach(i => i.addEventListener('change', updateUI));
    updateUI();
}

function populateClassDropdowns() {
    const selects = [dom.studentListClassFilter, dom.modalClassFilter];
    selects.forEach(sel => {
        if (!sel) return;
        const val = sel.value;
        sel.innerHTML = '<option value="">Semua Kelas</option>' + allClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        sel.value = val;
    });
}

async function preloadManagementData() {
    // Snapshots
    db.collection('artifacts').doc(appId).collection('public').doc('data').collection('mentors').orderBy('name').onSnapshot(snap => {
        allMentors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (activeTab === 'mentors' || activeTab === 'halaqohGroups') renderActiveTabContent();
    });

    db.collection('artifacts').doc(appId).collection('public').doc('data').collection('students').orderBy('name').onSnapshot(snap => {
        allStudents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (activeTab === 'students') renderActiveTabContent();
        if (currentGroupId) renderStudentListsForModal();
    });

    db.collection('artifacts').doc(appId).collection('public').doc('data').collection('classes').orderBy('name').onSnapshot(snap => {
        allClasses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateClassDropdowns();
        if (activeTab === 'classes') renderActiveTabContent();
    });

    db.collection('artifacts').doc(appId).collection('public').doc('data').collection('halaqohGroups').onSnapshot(snap => {
        allHalaqohGroups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (activeTab === 'halaqohGroups') renderActiveTabContent();
    });
}

let currentGroupId = null;
function openManageStudentsModal(groupId, groupName) {
    currentGroupId = groupId;
    dom.manageStudentsModalTitle.textContent = `Kelola Anggota: ${groupName}`;
    renderStudentListsForModal();
    dom.manageStudentsModal.classList.add('show');
}

function closeManageStudentsModal() {
    currentGroupId = null;
    dom.manageStudentsModal.classList.remove('show');
}

function renderStudentListsForModal() {
    if (!currentGroupId) return;
    const group = allHalaqohGroups.find(g => g.id === currentGroupId);
    const groupStudentIds = group?.studentIds || [];
    
    const searchTerm = dom.modalStudentSearch.value.toLowerCase();
    const classFilter = dom.modalClassFilter.value;

    const groupStudents = allStudents.filter(s => groupStudentIds.includes(s.id));
    dom.groupStudentsListForModal.innerHTML = groupStudents.map(s => `
        <div class="flex items-center justify-between bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
            <span class="text-sm font-medium text-white">${s.name}</span>
            <button class="icon-btn !w-8 !h-8 !bg-red-500/20 text-red-400 border-none remove-student-btn" data-id="${s.id}"><i data-lucide="minus"></i></button>
        </div>
    `).join('') || '<p class="text-center py-8 text-gray-500 text-xs">Belum ada anggota.</p>';

    const assignedIds = new Set(allHalaqohGroups.flatMap(g => g.studentIds || []));
    let available = allStudents.filter(s => !assignedIds.has(s.id));
    
    if (classFilter) available = available.filter(s => s.class === classFilter);
    if (searchTerm) available = available.filter(s => s.name.toLowerCase().includes(searchTerm));

    dom.allStudentsListForModal.innerHTML = available.map(s => `
        <div class="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <div class="flex flex-col">
                <span class="text-sm font-medium text-gray-300">${s.name}</span>
                <span class="text-[10px] text-gray-500 uppercase">${s.class || ''}</span>
            </div>
            <button class="icon-btn !w-8 !h-8 !bg-green-500/20 text-green-400 border-none add-student-btn" data-id="${s.id}"><i data-lucide="plus"></i></button>
        </div>
    `).join('') || '<p class="text-center py-8 text-gray-500 text-xs">Tidak ada santri tersedia.</p>';

    lucide.createIcons();
}

// --- Auth & Init ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        preloadManagementData();
        updateTabUI('halaqohGroups');
    } else {
        auth.signInAnonymously();
    }
});

// --- Listeners ---
dom.addMainEntityBtn.onclick = () => {
    dom.entityModalFields.innerHTML = '';
    if (activeTab === 'mentors') {
        dom.entityModalTitle.textContent = 'Tambah Pembimbing';
        dom.entityModalFields.innerHTML = `<div><label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Nama Lengkap</label><input type="text" id="mentorName" class="input-glass" placeholder="Masukkan nama..."></div>`;
        dom.saveEntityBtn.onclick = () => addEntity('mentors', { name: document.getElementById('mentorName').value });
    } else if (activeTab === 'students') {
        dom.entityModalTitle.textContent = 'Tambah Santri';
        dom.entityModalFields.innerHTML = `
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Nama Lengkap</label><input type="text" id="studentName" class="input-glass" placeholder="Masukkan nama..."></div>
                <div><label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Kelas</label><select id="studentClass" class="input-glass"></select></div>
            </div>`;
        const sel = document.getElementById('studentClass');
        sel.innerHTML = '<option value="">Pilih Kelas</option>' + allClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        dom.saveEntityBtn.onclick = () => addEntity('students', { name: document.getElementById('studentName').value, class: sel.value });
    } else if (activeTab === 'classes') {
        dom.entityModalTitle.textContent = 'Tambah Kelas';
        dom.entityModalFields.innerHTML = `<div><label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Nama Kelas</label><input type="text" id="className" class="input-glass" placeholder="Contoh: 1A, 2B..."></div>`;
        dom.saveEntityBtn.onclick = () => addEntity('classes', { name: document.getElementById('className').value });
    } else if (activeTab === 'halaqohGroups') {
        dom.entityModalTitle.textContent = 'Buat Grup Halaqoh';
        dom.entityModalFields.innerHTML = `<div><label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Pilih Pembimbing</label><select id="groupMentor" class="input-glass"></select></div>`;
        const sel = document.getElementById('groupMentor');
        sel.innerHTML = '<option value="">Pilih...</option>' + allMentors.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        dom.saveEntityBtn.onclick = () => {
            const mId = sel.value;
            const mName = sel.options[sel.selectedIndex].text;
            if (!mId) return showToast("Pilih pembimbing!", true);
            addEntity('halaqohGroups', { mentorId: mId, groupName: mName, studentIds: [] });
        };
    }
    dom.entityModal.classList.add('show');
};

function addEntity(coll, data) {
    if (!data.name && coll !== 'halaqohGroups') return showToast("Nama diperlukan", true);
    db.collection('artifacts').doc(appId).collection('public').doc('data').collection(coll).add({ ...data, timestamp: serverTimestamp() })
        .then(() => { showToast("Berhasil!"); dom.entityModal.classList.remove('show'); })
        .catch(() => showToast("Gagal!", true));
}

dom.bulkDeleteBtn.onclick = () => {
    const ids = Array.from(dom.entityList.querySelectorAll('.item-checkbox:checked')).map(i => i.dataset.id);
    openDeleteModal(null, activeTab, true, ids);
};

dom.confirmDeleteBtn.onclick = async () => {
    const { isBulk, ids, docId, collectionName } = deleteInfo;
    try {
        if (isBulk) {
            const batch = db.batch();
            ids.forEach(id => batch.delete(db.collection('artifacts').doc(appId).collection('public').doc('data').collection(collectionName).doc(id)));
            await batch.commit();
        } else {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection(collectionName).doc(docId).delete();
        }
        showToast("Berhasil dihapus");
        closeDeleteModal();
    } catch (e) { showToast("Gagal!", true); }
};

document.addEventListener('click', e => {
    const del = e.target.closest('.btn-delete');
    if (del) openDeleteModal(del.dataset.id, del.dataset.collection);

    const manage = e.target.closest('.manage-students-btn');
    if (manage) openManageStudentsModal(manage.dataset.groupId, manage.dataset.groupName);

    const addS = e.target.closest('.add-student-btn');
    if (addS) db.collection('artifacts').doc(appId).collection('public').doc('data').collection('halaqohGroups').doc(currentGroupId).update({ studentIds: arrayUnion(addS.dataset.id) });

    const remS = e.target.closest('.remove-student-btn');
    if (remS) db.collection('artifacts').doc(appId).collection('public').doc('data').collection('halaqohGroups').doc(currentGroupId).update({ studentIds: arrayRemove(remS.dataset.id) });
});

document.getElementById('showHalaqohGroupsTabBtn').onclick = () => updateTabUI('halaqohGroups');
document.getElementById('showMentorsTabBtn').onclick = () => updateTabUI('mentors');
document.getElementById('showStudentsTabBtn').onclick = () => updateTabUI('students');
document.getElementById('showClassesTabBtn').onclick = () => updateTabUI('classes');

dom.groupSearchInput.oninput = renderActiveTabContent;
dom.studentListClassFilter.onchange = renderStudentList;
dom.modalStudentSearch.oninput = renderStudentListsForModal;
dom.modalClassFilter.onchange = renderStudentListsForModal;
dom.cancelEntityBtn.onclick = () => dom.entityModal.classList.remove('show');
dom.cancelDeleteBtn.onclick = closeDeleteModal;
dom.closeManageStudentsBtn.onclick = closeManageStudentsModal;
