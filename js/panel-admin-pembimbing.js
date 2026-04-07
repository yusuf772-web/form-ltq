        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, onSnapshot, query, where, doc, setDoc, addDoc, deleteDoc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        let allPeriods = [];
        let allHolidays = [];
        let allMentors = [];
        let activePeriod = null;
        let currentUserId = null;
        let unsubscribes = {};

        // --- DOM Elements ---
        const dom = {
            addPeriodForm: document.getElementById('addPeriodForm'),
            periodId: document.getElementById('periodId'),
            periodStartDate: document.getElementById('periodStartDate'),
            periodEndDate: document.getElementById('periodEndDate'),
            addPeriodBtn: document.getElementById('addPeriodBtn'),
            periodsListContainer: document.getElementById('periodsListContainer'),
            monthFilter: document.getElementById('monthFilter'),
            yearFilter: document.getElementById('yearFilter'),
            setFilterBtn: document.getElementById('setFilterBtn'),
            newHolidayDate: document.getElementById('newHolidayDate'),
            holidayMorning: document.getElementById('holidayMorning'),
            holidayAfternoon: document.getElementById('holidayAfternoon'),
            holidaysListContainer: document.getElementById('holidaysListContainer'),
            addHolidayBtn: document.getElementById('addHolidayBtn'),
            saveHolidaysBtn: document.getElementById('saveHolidaysBtn'),
            rekapContainer: document.getElementById('rekapContainer'),
            rekapTitle: document.getElementById('rekapTitle'),
            rekapLoader: document.getElementById('rekapLoader'),
            rekapTableWrapper: document.getElementById('rekapTableWrapper'),
            exportBtn: document.getElementById('exportBtn'),
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
        function fetchInitialData() {
            populateMonthAndYearFilters();

            const periodsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'recapPeriods');
            unsubscribes.periods = onSnapshot(periodsCollection, (snapshot) => {
                allPeriods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderPeriodsList();
                findAndRenderActivePeriodRekap();
            });

            const holidayDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays');
            unsubscribes.holidays = onSnapshot(holidayDocRef, (docSnap) => {
                allHolidays = docSnap.exists() ? docSnap.data().dates || [] : [];
                renderHolidaysList();
                if (activePeriod) showRekapForPeriod(activePeriod);
            });
            
            const mentorsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'mentors');
            unsubscribes.mentors = onSnapshot(mentorsCollection, (snapshot) => {
                allMentors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (activePeriod) showRekapForPeriod(activePeriod);
            });
        }

        // --- UI Rendering ---
        function populateMonthAndYearFilters() {
            const currentYear = new Date().getFullYear();
            const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            
            let monthOptionsHtml = '';
            months.forEach((month, index) => {
                monthOptionsHtml += `<option value="${String(index).padStart(2, '0')}">${month}</option>`;
            });
            dom.monthFilter.innerHTML = monthOptionsHtml;

            let yearOptionsHtml = '';
            for (let yearOffset = -5; yearOffset <= 5; yearOffset++) {
                const year = currentYear + yearOffset;
                yearOptionsHtml += `<option value="${year}">${year}</option>`;
            }
            dom.yearFilter.innerHTML = yearOptionsHtml;

            const savedMonth = localStorage.getItem('selectedMonthFilter') || String(new Date().getMonth()).padStart(2, '0');
            const savedYear = localStorage.getItem('selectedYearFilter') || currentYear.toString();
            
            dom.monthFilter.value = savedMonth;
            dom.yearFilter.value = savedYear;
        }

        function renderPeriodsList() {
            const container = dom.periodsListContainer;
            container.innerHTML = '';
            const { value: selectedMonthValue } = dom.monthFilter;
            const { value: selectedYearValue } = dom.yearFilter;

            const filteredPeriods = allPeriods.filter(period => {
                const displayMonthYear = period.displayMonthYear;
                return displayMonthYear && displayMonthYear === `${selectedYearValue}-${selectedMonthValue}`;
            });

            if (filteredPeriods.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 text-sm">Belum ada periode untuk filter ini.</p>';
                return;
            }
            
            filteredPeriods.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).forEach(period => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center bg-gray-800 p-2 rounded';
                const startDate = new Date(period.startDate + 'T00:00:00').toLocaleDateString('id-ID');
                const endDate = new Date(period.endDate + 'T00:00:00').toLocaleDateString('id-ID');
                item.innerHTML = `
                    <div>
                        <p class="font-semibold">${period.name || 'Periode Rekap'}</p> 
                        <p class="text-xs text-gray-400">${startDate} s/d ${endDate}</p>
                    </div>
                    <button type="button" class="p-2 text-red-500 hover:bg-gray-700 rounded-full delete-period-btn" data-id="${period.id}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                `;
                container.appendChild(item);
            });
            lucide.createIcons();
        }

        function renderHolidaysList() {
            const container = dom.holidaysListContainer;
            container.innerHTML = '';
            const { value: selectedMonth } = dom.monthFilter;
            const { value: selectedYear } = dom.yearFilter;

            const filteredHolidays = allHolidays.filter(holiday => {
                const holidayDate = new Date(holiday.date + 'T00:00:00');
                return holidayDate.getMonth() === parseInt(selectedMonth, 10) && holidayDate.getFullYear() === parseInt(selectedYear, 10);
            });

            if (filteredHolidays.length > 0) {
                filteredHolidays.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(holiday => createHolidayListItem(holiday.date, holiday.time));
            } else {
                 container.innerHTML = '<p class="text-center text-gray-500 text-sm">Tidak ada libur untuk filter ini.</p>';
            }
        }

        function createHolidayListItem(dateString, time = "") {
            if (!dateString) return;
            dom.holidaysListContainer.querySelector('p')?.remove();

            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-gray-700 p-2 rounded holiday-item';
            item.dataset.date = dateString;
            item.dataset.time = time;
            
            const date = new Date(dateString + 'T00:00:00');
            const formattedDate = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            let displayTime = time ? ` (${time})` : '';

            item.innerHTML = `<span class="text-sm">${formattedDate}${displayTime}</span><button type="button" class="p-1 text-red-500 hover:bg-gray-600 rounded-full remove-holiday-btn"><i data-lucide="x" class="w-4 h-4 pointer-events-none"></i></button>`;
            dom.holidaysListContainer.appendChild(item);
            lucide.createIcons();
        }

        // --- Core Logic ---
        async function handleAddPeriod(e) {
            e.preventDefault();
            const { value: startDate } = dom.periodStartDate;
            const { value: endDate } = dom.periodEndDate;
            if (!startDate || !endDate) { showToast("Semua field harus diisi.", true); return; }
            if (new Date(startDate) > new Date(endDate)) { showToast("Tanggal Mulai tidak boleh setelah Tanggal Akhir.", true); return; }
            
            const startMonthName = new Date(startDate + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const name = `Rekap ${startMonthName}`; 
            const displayMonthYear = `${dom.yearFilter.value}-${dom.monthFilter.value}`;

            try {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'recapPeriods'), { name, startDate, endDate, displayMonthYear });
                showToast("Periode berhasil ditambahkan.");
                dom.addPeriodForm.reset();
            } catch (error) { showToast("Gagal menyimpan periode.", true); }
        }
        
        async function handleDeletePeriod(id) {
            showCustomConfirm("Apakah Anda yakin ingin menghapus periode ini?", async () => {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'recapPeriods', id));
                    showToast("Periode berhasil dihapus.");
                } catch (error) { showToast("Gagal menghapus periode.", true); }
            });
        }

        async function handleSaveHolidays() {
            dom.saveHolidaysBtn.disabled = true;
            const holidayDates = Array.from(dom.holidaysListContainer.querySelectorAll('.holiday-item')).map(item => ({
                date: item.dataset.date,
                time: item.dataset.time || ""
            }));

            try {
                const holidayDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays');
                const otherHolidays = allHolidays.filter(h => {
                    const hDate = new Date(h.date + 'T00:00:00');
                    return !(hDate.getMonth() === parseInt(dom.monthFilter.value, 10) && hDate.getFullYear() === parseInt(dom.yearFilter.value, 10));
                });

                await setDoc(holidayDocRef, { dates: [...otherHolidays, ...holidayDates] });
                showToast("Daftar hari libur berhasil disimpan.");
            } catch (error) {
                showToast("Gagal menyimpan hari libur.", true);
            } finally {
                dom.saveHolidaysBtn.disabled = false;
            }
        }

        // --- Rekapitulasi & Ekspor Logic ---
        function findAndRenderActivePeriodRekap() {
            const selectedMonth = dom.monthFilter.value;
            const selectedYear = dom.yearFilter.value;
            const displayMonthYear = `${selectedYear}-${selectedMonth}`;
            
            const matchingPeriod = allPeriods.find(p => p.displayMonthYear === displayMonthYear);

            if (matchingPeriod) {
                activePeriod = matchingPeriod;
                showRekapForPeriod(activePeriod);
            } else {
                activePeriod = null;
                dom.rekapLoader.innerHTML = `Tidak ada periode rekap yang cocok untuk <b>${getMonthName(selectedMonth)} ${selectedYear}</b>. Silakan buat periode terlebih dahulu.`;
                dom.rekapTableWrapper.innerHTML = '';
                dom.exportBtn.classList.add('hidden');
            }
        }

        async function showRekapForPeriod(period) {
            if (!period || allMentors.length === 0) {
                dom.rekapLoader.innerHTML = 'Memuat data pembimbing...';
                dom.exportBtn.classList.add('hidden');
                return;
            }
            dom.rekapLoader.classList.remove('hidden');
            dom.rekapLoader.innerHTML = 'Memuat data kehadiran...';
            dom.rekapTableWrapper.innerHTML = '';
            dom.rekapTitle.textContent = `Rekapitulasi Kehadiran: ${period.name}`;

            try {
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'dailyAttendance'), 
                    where('date', '>=', period.startDate), 
                    where('date', '<=', period.endDate)
                );
                
                // Set up a real-time listener for attendance data
                if (unsubscribes.attendance) unsubscribes.attendance(); // Unsubscribe from previous listener
                
                unsubscribes.attendance = onSnapshot(q, (attendanceSnapshot) => {
                    const attendanceData = new Map();
                    attendanceSnapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        attendanceData.set(`${data.date}_${data.session}`, new Set(data.presentMentors));
                    });

                    const holidaysForPeriod = allHolidays.filter(h => h.date >= period.startDate && h.date <= period.endDate);
                    renderRekapTable(period, attendanceData, holidaysForPeriod);
                    dom.exportBtn.classList.remove('hidden');
                    dom.rekapLoader.classList.add('hidden');
                });

            } catch (error) {
                showToast("Gagal menampilkan rekap.", true);
                dom.exportBtn.classList.add('hidden');
                dom.rekapLoader.classList.add('hidden');
            }
        }

        function renderRekapTable(period, attendanceData, holidays) {
            const startDate = new Date(period.startDate + 'T00:00:00');
            const endDate = new Date(period.endDate + 'T00:00:00');
            
            const datesToDisplay = [];
            for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
                datesToDisplay.push(new Date(dt));
            }

            let tableHTML = `<table class="rekap-table"><thead><tr>`;
            tableHTML += `<th class="mentor-name" rowspan="2" style="min-width: 150px;">Nama Pembimbing</th>`;
            tableHTML += `<th class="waktu" rowspan="2">Sesi</th>`; 
            
            const monthHeaders = {};
            datesToDisplay.forEach(date => {
                const monthYear = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                monthHeaders[monthYear] = (monthHeaders[monthYear] || 0) + 1;
            });

            for (const monthYear in monthHeaders) {
                tableHTML += `<th colspan="${monthHeaders[monthYear]}">${monthYear}</th>`;
            }
            tableHTML += `<th rowspan="2">Total Hadir</th><th rowspan="2">Persentase</th></tr><tr>`;
            datesToDisplay.forEach(date => tableHTML += `<th>${date.getDate()}</th>`);
            tableHTML += `</tr></thead><tbody>`;

            const sortedMentors = [...allMentors].sort((a, b) => a.name.localeCompare(b.name));
            sortedMentors.forEach(mentor => {
                let totalPagi = 0, totalSore = 0, possiblePagi = 0, possibleSore = 0;
                let pagiDateCellsHTML = '';
                let soreDateCellsHTML = '';

                datesToDisplay.forEach(date => {
                    const dateString = toLocalDateString(date);
                    
                    const isHolidayPagi = holidays.some(h => h.date === dateString && (h.time === "Pagi" || h.time === "Pagi & Sore"));
                    if (!isHolidayPagi) possiblePagi++;
                    const isPresentPagi = attendanceData.get(`${dateString}_pagi`)?.has(mentor.name);
                    if (isPresentPagi) totalPagi++;
                    pagiDateCellsHTML += `<td class="attendance-cell ${isHolidayPagi ? 'holiday-cell' : ''}" data-date="${dateString}" data-session="pagi" data-mentor-name="${mentor.name}" data-present="${!!isPresentPagi}">
                        ${isPresentPagi ? '<i data-lucide="check" class="w-4 h-4 mx-auto text-green-400 pointer-events-none"></i>' : ''}
                    </td>`;

                    const isHolidaySore = holidays.some(h => h.date === dateString && (h.time === "Sore" || h.time === "Pagi & Sore"));
                    if (!isHolidaySore) possibleSore++;
                    const isPresentSore = attendanceData.get(`${dateString}_sore`)?.has(mentor.name);
                    if (isPresentSore) totalSore++;
                    soreDateCellsHTML += `<td class="attendance-cell ${isHolidaySore ? 'holiday-cell' : ''}" data-date="${dateString}" data-session="sore" data-mentor-name="${mentor.name}" data-present="${!!isPresentSore}">
                        ${isPresentSore ? '<i data-lucide="check" class="w-4 h-4 mx-auto text-green-400 pointer-events-none"></i>' : ''}
                    </td>`;
                });

                const finalTotalAttendance = totalPagi + totalSore;
                const totalPossible = possiblePagi + possibleSore;
                const finalPercentage = totalPossible > 0 ? ((finalTotalAttendance / totalPossible) * 100).toFixed(0) : '0';

                tableHTML += `<tr><td class="mentor-name" rowspan="2">${mentor.name}</td><td class="waktu">Pagi</td>${pagiDateCellsHTML}<td class="font-semibold">${totalPagi}</td><td class="font-semibold" rowspan="2">${finalPercentage}%</td></tr>`;
                tableHTML += `<tr><td class="waktu">Sore</td>${soreDateCellsHTML}<td class="font-semibold">${totalSore}</td></tr>`;
            });

            tableHTML += `</tbody></table>`;
            dom.rekapTableWrapper.innerHTML = tableHTML;
            lucide.createIcons();
        }

        async function handleAttendanceToggle(e) {
            const cell = e.target.closest('.attendance-cell');
            if (!cell || cell.classList.contains('holiday-cell')) return;

            const { date, session, mentorName, present } = cell.dataset;
            const isPresent = present === 'true';

            cell.innerHTML = '<div class="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto"></div>'; // Loading spinner

            const docId = `${date}_${session}`;
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'dailyAttendance', docId);

            try {
                if (isPresent) {
                    await updateDoc(docRef, { presentMentors: arrayRemove(mentorName) });
                } else {
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        await updateDoc(docRef, { presentMentors: arrayUnion(mentorName) });
                    } else {
                        await setDoc(docRef, { date, session, presentMentors: [mentorName] });
                    }
                }
                // The onSnapshot listener will automatically re-render the table, no need to show toast here.
            } catch (error) {
                console.error("Error updating attendance:", error);
                showToast("Gagal memperbarui kehadiran.", true);
                // Re-render to revert the loading spinner on error
                if (activePeriod) showRekapForPeriod(activePeriod);
            }
        }

        function exportTableToExcel() {
            const table = dom.rekapTableWrapper.querySelector('table');
            if (!table) {
                showToast("Tidak ada data untuk diekspor.", true);
                return;
            }

            const selectedMonthName = dom.monthFilter.options[dom.monthFilter.selectedIndex].text;
            const selectedYear = dom.yearFilter.value;
            const fileName = `Rekap Kehadiran - ${selectedMonthName} ${selectedYear}.xlsx`;

            const wb = XLSX.utils.table_to_book(table, {sheet: "Rekap Kehadiran"});
            XLSX.writeFile(wb, fileName);
        }

        // --- UI Helpers ---
        function toLocalDateString(date) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        function getMonthName(monthIndex) {
            return new Date(2000, monthIndex, 1).toLocaleString('id-ID', { month: 'long' });
        }
        function showToast(message, isError = false) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toastMessage');
            toastMessage.textContent = message;
            toast.className = `toast ${isError ? 'bg-red-600' : 'bg-green-600'}`;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 3000);
        }
        function showCustomConfirm(message, onConfirm) {
            const modalHtml = `<div id="customConfirmModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50"><div class="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full text-center"><p class="text-white text-lg mb-4">${message}</p><div class="flex justify-center gap-4"><button id="confirmYes" class="btn btn-primary">Ya</button><button id="confirmNo" class="btn btn-secondary">Tidak</button></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('customConfirmModal');
            document.getElementById('confirmYes').addEventListener('click', () => { onConfirm(); modal.remove(); });
            document.getElementById('confirmNo').addEventListener('click', () => modal.remove());
        }

        // --- Event Listeners ---
        dom.addPeriodForm.addEventListener('submit', handleAddPeriod);
        dom.periodsListContainer.addEventListener('click', (e) => {
            if (e.target.closest('.delete-period-btn')) handleDeletePeriod(e.target.closest('.delete-period-btn').dataset.id);
        });
        dom.addHolidayBtn.addEventListener('click', () => {
            const dateValue = dom.newHolidayDate.value;
            if (!dateValue) { showToast("Silakan pilih tanggal.", true); return; }
            let time = (dom.holidayMorning.checked && dom.holidayAfternoon.checked) ? "Pagi & Sore" : dom.holidayMorning.checked ? "Pagi" : dom.holidayAfternoon.checked ? "Sore" : "";
            createHolidayListItem(dateValue, time);
            dom.newHolidayDate.value = '';
            dom.holidayMorning.checked = dom.holidayAfternoon.checked = false;
        });
        dom.holidaysListContainer.addEventListener('click', (e) => {
            if (e.target.closest('.remove-holiday-btn')) e.target.closest('.holiday-item').remove();
        });
        dom.saveHolidaysBtn.addEventListener('click', handleSaveHolidays);
        
        dom.setFilterBtn.addEventListener('click', () => {
            localStorage.setItem('selectedMonthFilter', dom.monthFilter.value);
            localStorage.setItem('selectedYearFilter', dom.yearFilter.value);
            renderPeriodsList();
            renderHolidaysList();
            findAndRenderActivePeriodRekap();
        });

        dom.exportBtn.addEventListener('click', exportTableToExcel);
        dom.rekapTableWrapper.addEventListener('click', handleAttendanceToggle);

// --- Initial Setup ---
lucide.createIcons();
window.addEventListener('beforeunload', () => {
    Object.values(unsubscribes).forEach(unsub => unsub && unsub());
});
