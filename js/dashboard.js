// ============================================
//   Admin LTQ Dashboard - Script (Sidebar Layout)
// ============================================

window.onload = function () {
    const menuLinks = document.querySelectorAll('.top-menu-link');
    const contentFrame = document.getElementById('content-frame');
    const loader = document.getElementById('loader');
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    // --- Sidebar Toggle (Mobile) ---
    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    }

    mobileMenuBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', closeSidebar);

    // --- Tab Switch ---
    function switchTab(linkElement) {
        loader.style.display = 'flex';
        contentFrame.style.opacity = '0';

        // Remove active from all links
        menuLinks.forEach(l => l.classList.remove('active'));

        // Set active on matching links (desktop + mobile duplicates)
        const dataSrc = linkElement.getAttribute('data-src');
        document.querySelectorAll(`.top-menu-link[data-src="${dataSrc}"]`).forEach(el => {
            el.classList.add('active');
        });

        contentFrame.src = dataSrc;
        contentFrame.focus();

        // Close sidebar on mobile after selecting
        closeSidebar();
    }

    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            switchTab(this);
        });
    });

    contentFrame.addEventListener('load', function () {
        loader.style.display = 'none';
        contentFrame.style.opacity = '1';
        contentFrame.focus();
    });

    // --- Load initial active tab ---
    const initialLink = document.querySelector('.top-menu-link.active');
    if (initialLink) {
        switchTab(initialLink);
    }

    lucide.createIcons();
};

// Service Worker not configured for this deployment
