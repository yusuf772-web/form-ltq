        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, onSnapshot, query, where, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        let unsubscribes = {};
        let allStudents = [];
        let allMentors = [];
        let allHalaqohGroups = [];
        let allClasses = [];
        let compiledRecapData = [];
        let activeClassFilter = null;
        let activeRecapFilter = 'perkembangan';

        // --- DOM Elements ---
        const dom = {
            filterTypeContainer: document.getElementById('filterTypeContainer'),
            monthFilter: document.getElementById('monthFilter'),
            startDateFilter: document.getElementById('startDateFilter'),
            endDateFilter: document.getElementById('endDateFilter'),
            dateFilterLabel: document.getElementById('dateFilterLabel'),
            exportBtn: document.getElementById('exportBtn'),
            rekapTable: document.getElementById('rekapTable'),
            rekapTableHead: document.getElementById('rekapTableHead'),
            rekapTableBody: document.getElementById('rekapTableBody'),
            rekapLoader: document.getElementById('rekapLoader'),
            emptyState: document.getElementById('emptyState'),
            classFilterContainer: document.getElementById('classFilterContainer'),
            recapFilterContainer: document.getElementById('recapFilterContainer'),
        };
        
        // --- Recap View Configuration ---
        const recapViews = {
            perkembangan: {
                title: "Rekap Perkembangan",
                columns: ["No", "Nama Santri", "Kelas", "Nama Pembimbing", "Total Hafalan", "Hafalan Terakhir", "Jml Halaman Ziyadah", "Jml Halaman Murojaah", "Nilai Itqon", "Nilai Tajwid", "Alfa", "Izin", "Sakit", "Jumlah Hafalan Tasmi", "Hasil Terakhir Tasmi", "Tanggal Terakhir Tasmi"],
                dataKeys: ["namaSantri", "kelas", "namaPembimbing", "totalHafalan", "hafalanTerakhir", "ziyadah", "murojaah", "nilaiItqon", "nilaiTajwid", "alfa", "izin", "sakit", "jumlahHafalanTasmi", "hasilTasmi", "tanggalTasmi"]
            },
            absen: {
                title: "Rekap Absen",
                columns: ["No", "Nama Santri", "Kelas", "Nama Pembimbing", "Alfa", "Izin", "Sakit"],
                dataKeys: ["namaSantri", "kelas", "namaPembimbing", "alfa", "izin", "sakit"]
            },
            nilai: {
                title: "Rekap Nilai",
                columns: ["No", "Nama Santri", "Kelas", "Nama Pembimbing", "Rata-rata Itqon", "Rata-rata Tajwid"],
                dataKeys: ["namaSantri", "kelas", "namaPembimbing", "avgItqon", "avgTajwid"]
            },
            tasmi: {
                title: "Rekap Tasmi",
                columns: ["No", "Nama Santri", "Kelas", "Nama Pembimbing", "Menyimak", "Tanggal Tasmi", "Jumlah Hafalan", "Keterangan"],
                dataKeys: ["namaSantri", "kelas", "namaPembimbing", "namaPembimbingMenyimak", "tanggalTasmi", "jumlahHafalanTasmi", "hasilTasmi"]
            }
        };

        // --- Authentication ---
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                preloadData();
            } else {
                try {
                    await (initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth));
                } catch (error) {
                    console.error("Authentication error:", error);
                }
            }
        });

        // --- Data Fetching and Processing ---
        function preloadData() {
            const collectionsToLoad = {
                students: 'students',
                mentors: 'mentors',
                halaqohGroups: 'halaqohGroups',
                classes: 'classes',
            };

            let dataLoadedCount = 0;
            const totalCollections = Object.keys(collectionsToLoad).length;

            Object.entries(collectionsToLoad).forEach(([stateKey, collectionName]) => {
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
                unsubscribes[stateKey] = onSnapshot(q, (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (stateKey === 'students') allStudents = data;
                    if (stateKey === 'mentors') allMentors = data;
                    if (stateKey === 'halaqohGroups') allHalaqohGroups = data;
                    if (stateKey === 'classes') {
                        allClasses = data;
                        populateClassFilterButtons();
                    }
                    dataLoadedCount++;
                    if (dataLoadedCount === totalCollections) {
                        populateMonthFilter();
                        dom.rekapTable.classList.add('hidden');
                        dom.rekapLoader.style.display = 'none';
                        dom.emptyState.classList.remove('hidden');
                    }
                });
            });
        }

        function fetchRecapData() {
            if (activeClassFilter === null) {
                dom.rekapLoader.style.display = 'none';
                dom.emptyState.classList.remove('hidden');
                dom.rekapTable.classList.add('hidden');
                dom.exportBtn.disabled = true;
                return;
            }

            let startDate, endDate;
            const filterType = document.querySelector('#filterTypeContainer .filter-btn.active').dataset.value;

            if (filterType === 'month') {
                const [year, month] = dom.monthFilter.value.split('-').map(Number);
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0, 23, 59, 59);
            } else { // 'range'
                startDate = new Date(dom.startDateFilter.value + 'T00:00:00');
                endDate = new Date(dom.endDateFilter.value + 'T23:59:59');
            }
            
            dom.rekapTable.classList.add('hidden');
            dom.emptyState.classList.add('hidden');
            dom.rekapLoader.style.display = 'block';
            dom.exportBtn.disabled = true;

            const startTimestamp = Timestamp.fromDate(startDate);
            const endTimestamp = Timestamp.fromDate(endDate);

            const submissionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'formSubmissions');
            const q = query(submissionsRef, where('timestamp', '>=', startTimestamp), where('timestamp', '<=', endTimestamp));

            if (unsubscribes.submissions) unsubscribes.submissions();
            unsubscribes.submissions = onSnapshot(q, (snapshot) => {
                const submissions = snapshot.docs.map(doc => doc.data());
                compileData(submissions);
            }, (error) => {
                console.error("Error fetching submissions:", error);
                compileData([]);
            });
        }
        
        // --- Data Compilation ---
        function compileData(submissions) {
            if (activeRecapFilter === 'tasmi') {
                compileTasmiData(submissions);
            } else {
                compileStandardData(submissions);
            }
            renderTable();
        }

        function compileTasmiData(submissions) {
            compiledRecapData = [];
            const tasmiSubmissions = submissions.filter(s => s.formType === 'form2');

            for (const submission of tasmiSubmissions) {
                const student = allStudents.find(s => s.name === submission.namaSantri2);
                if (!student) continue;

                if (activeClassFilter !== 'all' && student.class !== activeClassFilter) {
                    continue;
                }

                const group = allHalaqohGroups.find(g => g.studentIds?.includes(student.id));
                const mentor = allMentors.find(m => m.id === group?.mentorId);

                compiledRecapData.push({
                    namaSantri: student.name,
                    kelas: student.class || '-',
                    namaPembimbing: mentor?.name || submission.namaPembimbing2 || '-',
                    namaPembimbingMenyimak: submission.namaPembimbingMenyimak || '-',
                    jumlahHafalanTasmi: submission.jumlahHafalanTasmi || '-',
                    hasilTasmi: submission.keteranganTasmi?.replace(/_/g, ' ') || '-',
                    tanggalTasmi: submission.timestamp?.toDate().toLocaleDateString('id-ID') || '-',
                    timestamp: submission.timestamp?.toDate() || new Date(0)
                });
            }

            compiledRecapData.sort((a, b) => {
                if (a.namaSantri < b.namaSantri) return -1;
                if (a.namaSantri > b.namaSantri) return 1;
                return a.timestamp - b.timestamp;
            });
        }

        function compileStandardData(submissions) {
            compiledRecapData = [];
            const studentsToProcess = activeClassFilter === 'all' 
                ? allStudents
                : allStudents.filter(s => s.class === activeClassFilter);

            for (const student of studentsToProcess) {
                const studentSubmissions = submissions.filter(s => s.namaSantri1 === student.name || s.namaSantri2 === student.name || s.namaSantri3 === student.name);

                const form1Submissions = studentSubmissions.filter(s => s.formType === 'form1').sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
                const latestForm1 = form1Submissions[0] || {};
                
                const form2Submissions = studentSubmissions.filter(s => s.formType === 'form2').sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
                const latestForm2 = form2Submissions[0] || {};
                
                const form3Submissions = studentSubmissions.filter(s => s.formType === 'form3');
                const attendance = {
                    alfa: form3Submissions.filter(s => s.kehadiranHalaqoh === 'alpha').length,
                    izin: form3Submissions.filter(s => s.kehadiranHalaqoh === 'izin').length,
                    sakit: form3Submissions.filter(s => s.kehadiranHalaqoh === 'sakit').length,
                };
                
                const itqonScores = form1Submissions.map(s => parseFloat(s.nilaiItqon1)).filter(n => !isNaN(n));
                const tajwidScores = form1Submissions.map(s => parseFloat(s.nilaiTajwid1)).filter(n => !isNaN(n));

                const group = allHalaqohGroups.find(g => g.studentIds?.includes(student.id));
                const mentor = allMentors.find(m => m.id === group?.mentorId);

                compiledRecapData.push({
                    namaSantri: student.name,
                    kelas: student.class || '-',
                    namaPembimbing: mentor?.name || latestForm1.namaPembimbing1 || '-',
                    totalHafalan: latestForm1.totalHafalan1 || '-',
                    hafalanTerakhir: latestForm1.hafalanTerakhir1 || '-',
                    ziyadah: latestForm1.ziyadahPages1 ? `${latestForm1.ziyadahPages1} Halaman` : '-',
                    murojaah: latestForm1.murojaahPages1 ? `${latestForm1.murojaahPages1} Halaman` : '-',
                    nilaiItqon: latestForm1.nilaiItqon1 || '-',
                    nilaiTajwid: latestForm1.nilaiTajwid1 || '-',
                    alfa: attendance.alfa || 0,
                    izin: attendance.izin || 0,
                    sakit: attendance.sakit || 0,
                    jumlahHafalanTasmi: latestForm2.jumlahHafalanTasmi || '-',
                    hasilTasmi: latestForm2.keteranganTasmi?.replace(/_/g, ' ') || '-',
                    tanggalTasmi: latestForm2.timestamp?.toDate().toLocaleDateString('id-ID') || '-',
                    avgItqon: itqonScores.length > 0 ? (itqonScores.reduce((a, b) => a + b, 0) / itqonScores.length).toFixed(2) : '-',
                    avgTajwid: tajwidScores.length > 0 ? (tajwidScores.reduce((a, b) => a + b, 0) / tajwidScores.length).toFixed(2) : '-',
                });
            }
        }

        // --- Table Rendering ---
        function renderTable() {
            dom.rekapLoader.style.display = 'none';
            const view = recapViews[activeRecapFilter];
            if (!view) return;

            dom.rekapTableHead.innerHTML = `<tr>${view.columns.map(col => `<th>${col}</th>`).join('')}</tr>`;
            dom.rekapTableBody.innerHTML = '';

            if (compiledRecapData.length === 0) {
                dom.emptyState.classList.remove('hidden');
                dom.rekapTable.classList.add('hidden');
                dom.exportBtn.disabled = true;
                return;
            }

            dom.emptyState.classList.add('hidden');
            dom.rekapTable.classList.remove('hidden');
            dom.exportBtn.disabled = false;

            if (activeRecapFilter === 'tasmi') {
                const groupedByStudent = compiledRecapData.reduce((acc, data) => {
                    if (!acc[data.namaSantri]) {
                        acc[data.namaSantri] = [];
                    }
                    acc[data.namaSantri].push(data);
                    return acc;
                }, {});

                let studentCounter = 0;
                for (const studentName in groupedByStudent) {
                    const tasmiEntries = groupedByStudent[studentName];
                    const rowspan = tasmiEntries.length;
                    studentCounter++;

                    tasmiEntries.forEach((entry, index) => {
                        const row = document.createElement('tr');
                        if (index === 0) {
                            row.innerHTML = `
                                <td rowspan="${rowspan}">${studentCounter}</td>
                                <td rowspan="${rowspan}">${entry.namaSantri}</td>
                                <td rowspan="${rowspan}">${entry.kelas}</td>
                                <td rowspan="${rowspan}">${entry.namaPembimbing}</td>
                                <td rowspan="${rowspan}">${entry.namaPembimbingMenyimak}</td>
                                <td>${entry.tanggalTasmi}</td>
                                <td>${entry.jumlahHafalanTasmi}</td>
                                <td class="capitalize">${entry.hasilTasmi}</td>
                            `;
                        } else {
                            row.innerHTML = `
                                <td>${entry.tanggalTasmi}</td>
                                <td>${entry.jumlahHafalanTasmi}</td>
                                <td class="capitalize">${entry.hasilTasmi}</td>
                            `;
                        }
                        dom.rekapTableBody.appendChild(row);
                    });
                }
            } else {
                compiledRecapData.sort((a, b) => a.namaSantri.localeCompare(b.namaSantri));
                compiledRecapData.forEach((data, index) => {
                    const row = document.createElement('tr');
                    let rowHTML = `<td>${index + 1}</td>`;
                    view.dataKeys.forEach(key => {
                        rowHTML += `<td class="${key === 'hasilTasmi' ? 'capitalize' : ''}">${data[key] ?? '-'}</td>`;
                    });
                    row.innerHTML = rowHTML;
                    dom.rekapTableBody.appendChild(row);
                });
            }
        }


        // --- UI Helpers and Event Listeners ---
        function populateMonthFilter() {
            const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            const now = new Date();
            dom.monthFilter.innerHTML = '';
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const year = date.getFullYear();
                const month = date.getMonth();
                const option = document.createElement('option');
                option.value = `${year}-${month + 1}`;
                option.textContent = `${months[month]} ${year}`;
                dom.monthFilter.appendChild(option);
            }
            dom.monthFilter.value = `${now.getFullYear()}-${now.getMonth() + 1}`;
        }
        
        function populateClassFilterButtons() {
            const container = dom.classFilterContainer;
            container.innerHTML = '<p class="text-gray-400 mr-2">Semua Kelas:</p>';
            
            const allBtn = document.createElement('button');
            allBtn.className = 'btn btn-secondary class-filter-btn';
            allBtn.textContent = 'Semua';
            allBtn.dataset.className = 'all';
            container.appendChild(allBtn);

            allClasses.sort((a, b) => a.name.localeCompare(b.name)).forEach(cls => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary class-filter-btn';
                btn.textContent = cls.name;
                btn.dataset.className = cls.name;
                container.appendChild(btn);
            });
        }

        function exportToExcel() {
            const view = recapViews[activeRecapFilter];
            if (!view || compiledRecapData.length === 0) {
                console.log("Tidak ada data untuk diekspor.");
                return;
            }

            const wb = XLSX.utils.book_new();
            
            const dataByClass = {};
            for (const studentData of compiledRecapData) {
                const className = studentData.kelas || 'Tanpa Kelas';
                if (!dataByClass[className]) {
                    dataByClass[className] = [];
                }
                dataByClass[className].push(studentData);
            }

            const sortedClasses = Object.keys(dataByClass).sort();

            for (const className of sortedClasses) {
                const classData = dataByClass[className];
                const headers = view.columns;
                let rows = [];

                if (activeRecapFilter === 'tasmi') {
                    let studentCounter = 0;
                    const groupedByStudent = classData.reduce((acc, data) => {
                        if (!acc[data.namaSantri]) {
                            acc[data.namaSantri] = [];
                        }
                        acc[data.namaSantri].push(data);
                        return acc;
                    }, {});

                    for (const studentName in groupedByStudent) {
                        const tasmiEntries = groupedByStudent[studentName];
                        studentCounter++;
                        tasmiEntries.forEach((entry, index) => {
                            rows.push([
                                index === 0 ? studentCounter : '',
                                index === 0 ? entry.namaSantri : '',
                                index === 0 ? entry.kelas : '',
                                index === 0 ? entry.namaPembimbing : '',
                                index === 0 ? entry.namaPembimbingMenyimak : '',
                                entry.tanggalTasmi,
                                entry.jumlahHafalanTasmi,
                                entry.hasilTasmi
                            ]);
                        });
                    }
                } else {
                    rows = classData.map((data, index) => {
                        return [index + 1, ...view.dataKeys.map(key => data[key] ?? '-')];
                    });
                }
                
                const sheetData = [headers, ...rows];
                const ws = XLSX.utils.aoa_to_sheet(sheetData);
                XLSX.utils.book_append_sheet(wb, ws, className.replace(/[/\\?*:[\]]/g, ''));
            }
            
            let datePart;
            const filterType = document.querySelector('#filterTypeContainer .filter-btn.active').dataset.value;
            if (filterType === 'month') {
                const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                const [year, monthIndex] = dom.monthFilter.value.split('-');
                const monthName = months[parseInt(monthIndex) - 1];
                datePart = `${monthName} ${year}`;
            } else {
                datePart = `${dom.startDateFilter.value} s.d ${dom.endDateFilter.value}`;
            }
            const fileName = `${view.title} - ${datePart}.xlsx`;

            XLSX.writeFile(wb, fileName);
        }
        
        // --- Event Listeners ---
        dom.filterTypeContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.filter-btn');
            if (!target) return;
            
            dom.filterTypeContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            
            const filterType = target.dataset.value;

            if (filterType === 'month') {
                dom.dateFilterLabel.textContent = 'Pilih Bulan & Tahun';
                dom.monthFilter.classList.remove('hidden');
                dom.startDateFilter.classList.add('hidden');
                dom.endDateFilter.classList.add('hidden');
            } else {
                dom.dateFilterLabel.textContent = 'Pilih Rentang Tanggal';
                dom.monthFilter.classList.add('hidden');
                dom.startDateFilter.classList.remove('hidden');
                dom.endDateFilter.classList.remove('hidden');
            }
            if (activeClassFilter !== null) fetchRecapData();
        });

        [dom.monthFilter, dom.startDateFilter, dom.endDateFilter].forEach(el => {
            el.addEventListener('change', () => {
                if (activeClassFilter !== null) fetchRecapData();
            });
        });

        dom.exportBtn.addEventListener('click', exportToExcel);
        
        dom.classFilterContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.class-filter-btn');
            if (!target) return;

            dom.classFilterContainer.querySelectorAll('.class-filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');

            activeClassFilter = target.dataset.className;
            fetchRecapData();
        });
        
        dom.recapFilterContainer.addEventListener('click', (e) => {
             const target = e.target.closest('.tab-btn');
            if (!target) return;
            
            dom.recapFilterContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            
            activeRecapFilter = target.dataset.recap;
            if (activeClassFilter !== null) {
                fetchRecapData();
            } else {
                renderTable();
            }
        });

        // --- Initial Setup ---
        function initializePage() {
            lucide.createIcons();
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 29);
            dom.startDateFilter.value = thirtyDaysAgo.toISOString().split('T')[0];
            dom.endDateFilter.value = today.toISOString().split('T')[0];
            dom.rekapLoader.style.display = 'none';
            dom.emptyState.classList.remove('hidden');
        }

initializePage();
window.addEventListener('beforeunload', () => {
    Object.values(unsubscribes).forEach(unsub => unsub && unsub());
});
