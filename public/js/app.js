// =========================================
//   AURA MESSENGER - APP.JS (FULL)
// =========================================
async function init() {
    try {
        const res = await fetch('/my-full-profile'); 
        currentUser = await res.json();
        if (!currentUser || !currentUser.username) return window.location.href = '/auth.html';
        
        socket.emit('identify', currentUser.username); 
        socket.emit('get_my_chats'); 
        socket.emit('get_stories'); 
        
        initPeerJS(); 
        
        document.getElementById('edit-display-name').value = currentUser.name || ''; 
        document.getElementById('edit-bio').value = currentUser.bio || ''; 
        document.getElementById('edit-location').value = currentUser.location || ''; 
        document.getElementById('edit-website').value = currentUser.website || ''; 
        document.getElementById('edit-birthday').value = currentUser.birthday || '';
        document.getElementById('edit-profile-color').value = currentUser.profileColor || '#8774e1';
        document.getElementById('edit-emoji-status').value = currentUser.emojiStatus || '';
        
        if (currentUser.privacy) {
            if (currentUser.privacy.calls) document.getElementById('priv-calls').value = currentUser.privacy.calls;
            if (currentUser.privacy.online) document.getElementById('priv-online').value = currentUser.privacy.online;
            if (currentUser.privacy.groups) document.getElementById('priv-groups').value = currentUser.privacy.groups;
        }

        applySavedPreferences(); 
        updateHeaderUI(); 
        
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            await Notification.requestPermission();
        }

        let targetPath = localStorage.getItem('redirect_after_login') || window.location.pathname;
        localStorage.removeItem('redirect_after_login');

        if (targetPath.length > 1 && !targetPath.startsWith('/join/')) {
            const targetId = targetPath.substring(1);
            const reservedPaths = ['index.html', 'auth.html', 'manifest.json', 'style.css', 'sw.js', 'favicon.ico'];
            if (!reservedPaths.includes(targetId) && !targetId.includes('.')) {
                setTimeout(() => viewUserProfile(targetId), 500);
            }
            window.history.pushState({}, '', '/');
        }

        if (targetPath.startsWith('/join/')) {
            const hash = targetPath.replace('/join/', '');
            socket.emit('join_by_hash', { hash: hash });
            window.history.pushState({}, '', '/');
        }
    } catch (err) { console.error("Ошибка инициализации:", err); }
}

// ==== УМНЫЙ ПОИСК И РЕКОМЕНДАЦИИ ====
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().replace('@', '');
    const mainList = document.querySelector('#tab-content-chats .contacts-list');
    
    let container = document.getElementById('search-results-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'search-results-container';
        container.className = 'contacts-list';
        document.getElementById('tab-content-chats').appendChild(container);
    }

    if (query.length > 0) {
        socket.emit('search_users_v2', { query });
        mainList.classList.add('hidden');
        container.classList.remove('hidden');
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Ищем...</span></div>';
    } else {
        socket.emit('search_users_v2', { query: '' });
        mainList.classList.add('hidden');
        container.classList.remove('hidden');
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Загрузка рекомендаций...</span></div>';
        
        if(e.target.value === '') {
            mainList.classList.remove('hidden');
            container.classList.add('hidden');
        }
    }
});

searchInput.addEventListener('focus', (e) => {
    if (e.target.value.trim() === '') {
        socket.emit('search_users_v2', { query: '' });
        const mainList = document.querySelector('#tab-content-chats .contacts-list');
        let container = document.getElementById('search-results-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'search-results-container';
            container.className = 'contacts-list';
            document.getElementById('tab-content-chats').appendChild(container);
        }
        mainList.classList.add('hidden');
        container.classList.remove('hidden');
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Загрузка рекомендаций...</span></div>';
    }
});

document.addEventListener('click', (e) => {
    const searchWrap = document.querySelector('.sidebar-header .search-wrapper');
    const container = document.getElementById('search-results-container');
    const mainList = document.querySelector('#tab-content-chats .contacts-list');
    
    if (searchWrap && !searchWrap.contains(e.target) && container && !container.classList.contains('hidden')) {
        searchInput.value = '';
        container.classList.add('hidden');
        if (mainList) mainList.classList.remove('hidden');
    }
});

sendBtn.onclick = send; 
msgInput.onkeypress = (e) => { if(e.key === 'Enter') send(); };

document.addEventListener('click', (e) => {
    const menu = document.getElementById('chat-header-dropdown');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#chat-header-dropdown') && !e.target.closest('.header-menu-btn')) {
        menu.classList.remove('show');
        setTimeout(() => menu.classList.add('hidden'), 200);
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log(err));
}

init();