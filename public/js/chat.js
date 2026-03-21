// =========================================
//   AURA MESSENGER — CHAT.JS (FULL VERSION)
//   + Кастомные папки, Стикеры, Спойлеры, Глобальный поиск
// =========================================

// ---- Инъекция стилей ----
(function injectChatStyles() {
    const oldStyle = document.getElementById('injected-chat-styles');
    if(oldStyle) oldStyle.remove();
    const s = document.createElement('style'); s.id = 'injected-chat-styles';
    s.textContent = `
        .settings-drawer { height: 100dvh !important; overflow: hidden !important; }
        .drawer-content { display: flex; flex-direction: column; height: 100%; flex: 1; overflow: hidden; }
        .settings-list-container { flex: 1 1 auto; overflow-y: auto !important; -webkit-overflow-scrolling: touch; padding-bottom: 80px; }
        .user-profile-preview, .settings-tabs { flex-shrink: 0 !important; }
        .header-top-buttons { display: flex !important; align-items: center; }
        #btn-edit-chats-main { display: inline-flex !important; margin-right: 5px; }

        .chat-select-checkbox { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--text-dim); display: flex; align-items: center; justify-content: center; color: transparent; transition: 0.2s; margin-right: 10px; flex-shrink: 0; }
        .chat-select-checkbox.selected { background: var(--primary); border-color: var(--primary); color: white; }
        .contact-item.edit-mode-active { padding-left: 10px; }
        #chat-action-bar { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 20px; padding: 10px 20px; display: flex; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2500; animation: popIn 0.3s var(--spring-bouncy); backdrop-filter: blur(10px); }
        #chat-action-bar button { background: none; border: none; color: var(--text-main); font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; }
        #chat-action-bar button.danger { color: #ff3b30; }

        .message-row { position: relative; user-select: none; }
        .bubble { overflow: visible !important; }

        .swipe-reply-hint { position: absolute; top: 50%; transform: translateY(-50%) scale(0); opacity: 0; width: 36px; height: 36px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.9rem; pointer-events: none; z-index: 50; box-shadow: 0 4px 18px rgba(0,0,0,0.45); will-change: transform, opacity; transition: background 0.15s; }
        .message-row.other .swipe-reply-hint { left: -48px; }
        .message-row.mine .swipe-reply-hint  { right: -48px; left: auto; }
        .swipe-reply-hint.triggered { background: #22c55e !important; }

        .msg-reply-info { position: relative; border-left: 3px solid var(--primary) !important; padding: 4px 10px 4px 12px !important; margin: 2px 0 8px 0 !important; border-radius: 4px 10px 10px 4px !important; background: rgba(135, 116, 225, 0.1) !important; cursor: pointer; display: flex !important; flex-direction: column; overflow: hidden; transition: background 0.2s; }
        .mine .msg-reply-info { background: rgba(255, 255, 255, 0.15) !important; border-left-color: #fff !important; }
        .msg-reply-info:hover { background: rgba(135, 116, 225, 0.2) !important; }
        .mine .msg-reply-info:hover { background: rgba(255, 255, 255, 0.25) !important; }
        .reply-sender { color: var(--primary); font-weight: 600; font-size: 0.85rem; margin-bottom: 2px; }
        .mine .reply-sender { color: #fff; }
        .reply-preview, .reply-preview-media { font-size: 0.85rem; color: var(--text-main); opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }

        .fwd-msg-header { display: flex; align-items: center; gap: 7px; color: var(--primary); font-size: 0.8rem; font-style: italic; font-weight: 700; margin-bottom: 7px; padding-bottom: 6px; border-bottom: 1px solid rgba(135,116,225,0.22); }
        .fwd-icon-wrap { width: 22px; height: 22px; border-radius: 50%; background: var(--primary-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .fwd-icon-wrap i { font-size: 0.7rem; color: var(--primary); }
        .fwd-from-link { cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fwd-from-link:hover { text-decoration: underline; }

        /* ПАНЕЛЬ ЭМОДЗИ И СТИКЕРОВ */
        .emoji-panel { position: absolute; bottom: 80px; left: 20px; width: 320px; height: 380px; background: var(--bg-sidebar); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 2000; border: 1px solid var(--border); display: flex; flex-direction: column; transition: 0.2s; transform-origin: bottom left; }
        .emoji-panel.hidden { opacity: 0; transform: scale(0.5); pointer-events: none; }
        .emoji-search { padding: 10px; border-bottom: 1px solid var(--border); background: var(--bg-secondary); }
        .emoji-search input { width: 100%; padding: 8px 15px; border-radius: 12px; border: none; background: var(--bg-main); color: white; outline: none; }
        .emoji-grid { display: flex; flex-wrap: wrap; gap: 5px; padding: 10px; overflow-y: auto; flex: 1; align-content: flex-start; }
        .emoji-item { font-size: 1.6rem; cursor: pointer; padding: 5px; border-radius: 8px; transition: 0.2s; }
        .emoji-item:hover { background: var(--bg-hover); transform: scale(1.2); }
    `;
    document.head.appendChild(s);
})();

// ---- Состояние ----
let forwardMsgData = null;
const knownChatIds = new Set();
let isEditMode = false;
let selectedChatsForEdit = new Set();
let archivedChats = new Set(JSON.parse(localStorage.getItem('aura-archived-chats') || '[]'));
const hiddenChats = new Set(JSON.parse(localStorage.getItem('aura-hidden-chats') || '[]'));
window.isViewingArchive = false;
window.currentFolder = 'all'; 

window.addEventListener('load', () => {
    // Контекстное меню "Переслать"
    const ctxActions = document.querySelector('.context-actions');
    if (ctxActions && !document.getElementById('ctx-forward-btn')) {
        const btn = document.createElement('button');
        btn.id = 'ctx-forward-btn'; btn.innerHTML = '<i class="fas fa-share"></i> Переслать'; btn.onclick = contextForward;
        const replyBtn = Array.from(ctxActions.querySelectorAll('button')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes('Reply'));
        if (replyBtn) replyBtn.insertAdjacentElement('afterend', btn); else ctxActions.appendChild(btn);
    }

    // Кнопка "Изм."
    const headerBtns = document.querySelector('.header-top-buttons');
    if (headerBtns && !document.getElementById('btn-edit-chats-main')) {
        const btn = document.createElement('button');
        btn.id = 'btn-edit-chats-main'; btn.className = 'menu-btn';
        btn.style.cssText = 'display: inline-flex !important; align-items: center; justify-content: center; padding: 5px 10px; background: rgba(135,116,225,0.1); border-radius: 12px; margin-right: 5px;';
        btn.innerHTML = '<span style="font-size:0.9rem; font-weight:bold; color:var(--primary);">Изм.</span>';
        btn.onclick = toggleEditModeChats;
        headerBtns.insertBefore(btn, headerBtns.firstChild);
    }

    // ===== ВНЕДРЕНИЕ ПАПОК ЧАТОВ И МОДАЛОК =====
    const tabContentChats = document.getElementById('tab-content-chats');
    const storiesCont = document.getElementById('stories-container');
    if (tabContentChats && storiesCont && !document.getElementById('chat-folders-bar')) {
        const foldersBar = document.createElement('div');
        foldersBar.id = 'chat-folders-bar';
        foldersBar.className = 'chat-folders-bar';
        storiesCont.insertAdjacentElement('afterend', foldersBar);
        
        // Инжектим модалки для управления папками
        const modalsHtml = `
        <div id="folder-manager-modal" class="modal hidden" style="z-index: 3000;">
            <div class="modal-content tg-style-profile" style="padding: 20px 0; max-height: 80vh; display:flex; flex-direction:column;">
                <div class="profile-header-actions"><button class="close-profile-btn" onclick="closeFolderManager()"><i class="fas fa-times"></i></button></div>
                <div class="profile-main-info"><h2>Папки с чатами</h2><p style="color:var(--text-dim); font-size:0.85rem;">Организуйте свои чаты</p></div>
                <div id="folders-list" style="padding: 0 20px; overflow-y:auto; flex:1;"></div>
                <div style="padding: 15px 20px;"><button class="primary-btn-small" style="margin:0; width:100%;" onclick="openFolderEditor()">Создать папку</button></div>
            </div>
        </div>
        <div id="folder-editor-modal" class="modal hidden" style="z-index: 3100;">
            <div class="modal-content tg-style-profile" style="padding: 20px 0; max-height: 80vh; display:flex; flex-direction:column;">
                <div class="profile-header-actions"><button class="close-profile-btn" onclick="closeFolderEditor()"><i class="fas fa-times"></i></button></div>
                <div class="profile-main-info"><h2 id="folder-editor-title">Новая папка</h2></div>
                <div class="modal-form-group"><label>НАЗВАНИЕ ПАПКИ</label><input type="text" id="folder-name-input" placeholder="Например: Работа"></div>
                <div class="modal-form-group" style="flex:1; overflow-y:auto; margin-bottom:0;"><label>ДОБАВИТЬ ЧАТЫ</label><div class="members-select-list" id="folder-chats-select"></div></div>
                <div style="padding: 15px 20px;"><button class="primary-btn-small" id="folder-save-btn" style="margin:0; width:100%;" onclick="saveFolder()">Сохранить</button></div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHtml);
        
        // Загружаем кастомные папки
        setTimeout(() => {
            window.customFolders = JSON.parse(localStorage.getItem('aura-folders-' + (currentUser ? currentUser.username : '')) || '[]');
            renderFoldersBar();
        }, 500);
    }

    // ===== ВНЕДРЕНИЕ ПАНЕЛИ СТИКЕРОВ И ЭМОДЗИ =====
    const inputCont = document.getElementById('input-container');
    if (inputCont && !document.getElementById('btn-emoji-toggle')) {
        const emojiBtn = document.createElement('button');
        emojiBtn.id = 'btn-emoji-toggle';
        emojiBtn.className = 'attach-btn';
        emojiBtn.innerHTML = '<i class="far fa-smile"></i>';
        inputCont.insertBefore(emojiBtn, document.getElementById('msgInput'));

        const panel = document.createElement('div');
        panel.id = 'emoji-panel';
        panel.className = 'emoji-panel hidden';
        panel.innerHTML = `
            <div class="emoji-panel-header">
                <button class="emoji-panel-tab active" onclick="switchEmojiTab('emoji')"><i class="far fa-smile"></i></button>
                <button class="emoji-panel-tab" onclick="switchEmojiTab('stickers')"><i class="far fa-sticky-note"></i></button>
            </div>
            <div id="tab-emoji-content" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
                <div class="emoji-search"><input type="text" id="emoji-search-input" placeholder="Поиск эмодзи..."></div>
                <div class="emoji-grid" id="emoji-grid-container"></div>
            </div>
            <div id="tab-stickers-content" class="sticker-grid hidden"></div>
        `;
        inputCont.appendChild(panel);

        const emojis = [
            { char: '😀', name: 'smile' }, { char: '😂', name: 'laugh' }, { char: '😍', name: 'love' },
            { char: '😎', name: 'cool' }, { char: '😭', name: 'cry' }, { char: '😡', name: 'angry' },
            { char: '👍', name: 'ok' }, { char: '👎', name: 'bad' }, { char: '❤️', name: 'heart' },
            { char: '🔥', name: 'fire' }, { char: '💯', name: '100' }, { char: '🎉', name: 'party' },
            { char: '🐱', name: 'cat' }, { char: '🐶', name: 'dog' }, { char: '👽', name: 'alien' },
            { char: '👀', name: 'eyes' }, { char: '💀', name: 'skull' }, { char: '🤡', name: 'clown' }
        ];

        // Используем Google Noto Emojis как стикеры (WebP, прозрачный фон)
        const stickers = [
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.webp', // Крутой
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.webp', // Пати
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.webp', // Плачет
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.webp', // Взрыв мозга
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f977/512.webp', // Ниндзя
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.webp', // Инопланетянин
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f631/512.webp', // Шок
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f608/512.webp'  // Дьявол
        ];

        const renderEmojis = (filter = '') => {
            const grid = document.getElementById('emoji-grid-container');
            grid.innerHTML = '';
            emojis.filter(e => e.name.includes(filter.toLowerCase())).forEach(e => {
                const span = document.createElement('span');
                span.className = 'emoji-item'; span.textContent = e.char;
                span.onclick = () => {
                    const msgInp = document.getElementById('msgInput');
                    msgInp.value += e.char; msgInp.focus();
                    toggleInputButtons(); panel.classList.add('hidden');
                };
                grid.appendChild(span);
            });
        };
        renderEmojis();

        const renderStickers = () => {
            const grid = document.getElementById('tab-stickers-content');
            grid.innerHTML = '';
            stickers.forEach(url => {
                const img = document.createElement('img');
                img.src = url; img.className = 'sticker-item';
                img.onclick = () => {
                    socket.emit('private_msg', { to: selectedChatId, text: '', media: { type: 'sticker', data: url, name: 'Sticker' }, reply: replyData });
                    cancelReply(); panel.classList.add('hidden');
                };
                grid.appendChild(img);
            });
        }
        renderStickers();

        emojiBtn.onclick = (e) => { e.stopPropagation(); panel.classList.toggle('hidden'); };
        document.getElementById('emoji-search-input').addEventListener('input', (e) => renderEmojis(e.target.value));
        document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== emojiBtn) panel.classList.add('hidden'); });
    }
    
    // ==== ВНЕДРЕНИЕ И ИСПРАВЛЕНИЕ ГЛОБАЛЬНОГО ПОИСКА ====
    const searchInputEl = document.getElementById('searchUser');
    if (searchInputEl) {
        searchInputEl.oninput = (e) => {
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
                socket.emit('search_messages_global', { query }); // Ищем сообщения
                mainList.classList.add('hidden');
                document.getElementById('chat-folders-bar')?.classList.add('hidden');
                container.classList.remove('hidden');
                container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Ищем...</span></div>';
            } else {
                socket.emit('search_users_v2', { query: '' });
                mainList.classList.add('hidden');
                document.getElementById('chat-folders-bar')?.classList.add('hidden');
                container.classList.remove('hidden');
                container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Загрузка рекомендаций...</span></div>';
                
                if(e.target.value === '') {
                    mainList.classList.remove('hidden');
                    document.getElementById('chat-folders-bar')?.classList.remove('hidden');
                    container.classList.add('hidden');
                }
            }
        };
    }
});


// ==== ЛОГИКА КАСТОМНЫХ ПАПОК ====
window.renderFoldersBar = function() {
    const bar = document.getElementById('chat-folders-bar');
    if (!bar) return;
    
    let html = `<button class="folder-tab ${window.currentFolder === 'all' ? 'active' : ''}" onclick="switchChatFolder('all')">Все чаты</button>`;
    
    if (window.customFolders) {
        window.customFolders.forEach(f => {
            html += `<button class="folder-tab ${window.currentFolder === f.id ? 'active' : ''}" onclick="switchChatFolder('${f.id}')">${f.name}</button>`;
        });
    }
    
    html += `<button class="folder-tab" onclick="openFolderManager()"><i class="fas fa-cog"></i></button>`;
    bar.innerHTML = html;
};

window.openFolderManager = function() {
    document.getElementById('folder-manager-modal').classList.remove('hidden');
    const list = document.getElementById('folders-list');
    list.innerHTML = '';
    if (!window.customFolders || window.customFolders.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:20px;">У вас пока нет папок</div>';
    } else {
        window.customFolders.forEach(f => {
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-secondary); border-radius:12px; margin-bottom:10px; border:1px solid var(--border);">
                    <strong style="color:var(--text-main);">${f.name} <span style="color:var(--text-dim); font-size:0.8rem; font-weight:normal;">(${f.chats.length} чатов)</span></strong>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openFolderEditor('${f.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteFolder('${f.id}')" style="background:none; border:none; color:#ff3b30; cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    }
};

window.closeFolderManager = function() { document.getElementById('folder-manager-modal').classList.add('hidden'); };
window.closeFolderEditor = function() { document.getElementById('folder-editor-modal').classList.add('hidden'); };

window.openFolderEditor = function(folderId = null) {
    window.editingFolderId = folderId;
    document.getElementById('folder-editor-modal').classList.remove('hidden');
    const nameInput = document.getElementById('folder-name-input');
    const chatsList = document.getElementById('folder-chats-select');
    document.getElementById('folder-editor-title').textContent = folderId ? 'Редактировать папку' : 'Новая папка';
    
    let selectedChats = [];
    if (folderId) {
        const f = window.customFolders.find(x => x.id === folderId);
        if (f) { nameInput.value = f.name; selectedChats = f.chats; }
    } else { nameInput.value = ''; }
    
    chatsList.innerHTML = '';
    Array.from(knownChatIds).forEach(cid => {
        if (cid === 'me') return;
        const nameEl = document.getElementById(`contact-name-${cid}`);
        const name = nameEl ? nameEl.textContent : cid;
        const isChecked = selectedChats.includes(cid) ? 'checked' : '';
        chatsList.innerHTML += `
            <label class="member-option" style="display:flex; justify-content:space-between; padding:10px; cursor:pointer;">
                <span>${name}</span>
                <input type="checkbox" value="${cid}" class="folder-chat-cb" ${isChecked}>
            </label>
        `;
    });
};

window.saveFolder = function() {
    const name = document.getElementById('folder-name-input').value.trim();
    if (!name) return showToast('Введите название папки');
    
    const cbs = document.querySelectorAll('.folder-chat-cb:checked');
    const chats = Array.from(cbs).map(cb => cb.value);
    
    if (window.editingFolderId) {
        const f = window.customFolders.find(x => x.id === window.editingFolderId);
        if (f) { f.name = name; f.chats = chats; }
    } else {
        window.customFolders.push({ id: 'f_' + Date.now(), name, chats });
    }
    
    localStorage.setItem('aura-folders-' + (currentUser ? currentUser.username : ''), JSON.stringify(window.customFolders));
    renderFoldersBar();
    closeFolderEditor();
    openFolderManager();
    switchChatFolder(window.currentFolder);
};

window.deleteFolder = function(folderId) {
    if (!confirm('Удалить эту папку?')) return;
    window.customFolders = window.customFolders.filter(x => x.id !== folderId);
    localStorage.setItem('aura-folders-' + (currentUser ? currentUser.username : ''), JSON.stringify(window.customFolders));
    if (window.currentFolder === folderId) switchChatFolder('all');
    renderFoldersBar();
    openFolderManager();
};

window.switchChatFolder = function(folderId) {
    window.currentFolder = folderId;
    renderFoldersBar(); // Обновляем выделение вкладки
    
    document.querySelectorAll('.contact-item').forEach(el => {
        const cid = el.id.replace('contact-', '');
        
        // Уважаем архив и скрытые чаты
        if (hiddenChats.has(cid) || (archivedChats.has(cid) && !window.isViewingArchive) || (!archivedChats.has(cid) && window.isViewingArchive && cid !== 'me')) {
            el.style.display = 'none';
            return;
        }

        if (folderId === 'all') {
            el.style.display = 'flex';
        } else {
            const f = window.customFolders.find(x => x.id === folderId);
            if (f && f.chats.includes(cid)) {
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }
        }
    });
};

window.switchEmojiTab = function(tab) {
    document.querySelectorAll('.emoji-panel-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.emoji-panel-tab[onclick="switchEmojiTab('${tab}')"]`).classList.add('active');
    
    if (tab === 'emoji') {
        document.getElementById('tab-emoji-content').style.display = 'flex';
        document.getElementById('tab-stickers-content').classList.add('hidden');
    } else {
        document.getElementById('tab-emoji-content').style.display = 'none';
        document.getElementById('tab-stickers-content').classList.remove('hidden');
    }
};

// =========================================
//   БАЗОВЫЕ ФУНКЦИИ
// =========================================
function updateUnreadBadge(chatId) {
    const badge = document.getElementById(`unread-${chatId}`);
    if (badge) {
        const count = unreadCounts[chatId] || 0;
        if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }
}

async function updateChatStatus(chatId, isGroup, forceOnline = null, forceLastSeen = null, membersCount = 0) {
    if (chatId === 'me') { chatStatusEl.textContent = dict[currentLang].savedMessages; chatStatusEl.classList.remove('typing'); return; }
    chatStatusEl.classList.remove('typing');
    if (isGroup) { chatStatusEl.textContent = `${membersCount} ${dict[currentLang].membersCount.toLowerCase()}`; return; }
    if (forceOnline !== null) { chatStatusEl.textContent = forceOnline ? dict[currentLang].online : formatLastSeen(forceLastSeen); return; }
    try {
        const res = await fetch(`/api/entity/${chatId}`);
        const data = await res.json();
        if (data.isBlocked) chatStatusEl.textContent = dict[currentLang].blockedStatus;
        else if (data.isOnline) chatStatusEl.textContent = dict[currentLang].online;
        else chatStatusEl.textContent = formatLastSeen(data.lastSeen);
    } catch (err) { chatStatusEl.textContent = ''; }
}

function closeChatMobile() {
    const chatUi = document.getElementById('chat-ui');
    chatUi.classList.add('chat-closing');
    setTimeout(() => { mainContainer.classList.remove('chat-open'); chatUi.classList.remove('chat-closing'); }, 300);
}

function renderArchiveFolder() {
    let folder = document.getElementById('archive-folder');
    if (archivedChats.size === 0) { if (folder) folder.remove(); return; }
    if (!folder) {
        folder = document.createElement('div');
        folder.id = 'archive-folder'; folder.className = 'saved-messages-item';
        folder.innerHTML = `<div class="saved-icon" style="background: var(--bg-secondary); border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-archive" style="color: var(--text-dim);"></i></div><div class="contact-info"><strong>Архив</strong><div class="contact-subtext" id="archive-count">Скрытые чаты (${archivedChats.size})</div></div>`;
        folder.onclick = () => {
            window.isViewingArchive = !window.isViewingArchive;
            folder.querySelector('strong').textContent = window.isViewingArchive ? '🔙 Назад к чатам' : 'Архив';
            switchChatFolder(window.currentFolder); 
        };
        contactsDiv.prepend(folder); 
    } else {
        const countEl = document.getElementById('archive-count');
        if (countEl) countEl.textContent = `Скрытые чаты (${archivedChats.size})`;
    }
}

function toggleEditModeChats() {
    isEditMode = !isEditMode;
    selectedChatsForEdit.clear();
    document.querySelectorAll('.chat-select-checkbox').forEach(cb => { cb.classList.toggle('hidden', !isEditMode); cb.classList.remove('selected'); });
    document.querySelectorAll('.contact-item').forEach(el => { el.classList.toggle('edit-mode-active', isEditMode); });
    
    let actionBar = document.getElementById('chat-action-bar');
    if (!actionBar) {
        actionBar = document.createElement('div'); actionBar.id = 'chat-action-bar';
        actionBar.innerHTML = `<button onclick="massArchiveChats()"><i class="fas fa-archive"></i> <span id="archive-btn-text">В архив</span></button><button class="danger" onclick="massDeleteChats()"><i class="fas fa-trash"></i> Удалить</button><button onclick="toggleEditModeChats()"><i class="fas fa-times"></i> Отмена</button>`;
        document.getElementById('tab-content-chats').appendChild(actionBar);
    }
    actionBar.style.display = isEditMode ? 'flex' : 'none';
    document.getElementById('archive-btn-text').textContent = window.isViewingArchive ? "Из архива" : "В архив";
}

function toggleSelectChat(e, chatId) {
    e.stopPropagation(); if (!isEditMode) return;
    if (selectedChatsForEdit.has(chatId)) selectedChatsForEdit.delete(chatId); else selectedChatsForEdit.add(chatId);
    const cb = document.querySelector(`#contact-${chatId} .chat-select-checkbox`);
    if (cb) cb.classList.toggle('selected', selectedChatsForEdit.has(chatId));
}

function massDeleteChats() {
    if (selectedChatsForEdit.size === 0) return;
    if (confirm(`Удалить ${selectedChatsForEdit.size} чатов навсегда?`)) {
        selectedChatsForEdit.forEach(id => {
            archivedChats.delete(id);
            hiddenChats.add(id); 
            const el = document.getElementById(`contact-${id}`);
            if (el) el.remove();
            if (selectedChatId === id) {
                document.getElementById('chat-ui').classList.add('hidden');
                document.getElementById('welcome-screen').classList.remove('hidden');
                selectedChatId = null;
            }
        });
        localStorage.setItem('aura-hidden-chats', JSON.stringify([...hiddenChats]));
        localStorage.setItem('aura-archived-chats', JSON.stringify([...archivedChats]));
        toggleEditModeChats();
        renderArchiveFolder();
        showToast('Чаты успешно удалены');
    }
}

function massArchiveChats() {
    if (selectedChatsForEdit.size === 0) return;
    selectedChatsForEdit.forEach(id => { if (window.isViewingArchive) archivedChats.delete(id); else archivedChats.add(id); });
    localStorage.setItem('aura-archived-chats', JSON.stringify([...archivedChats]));
    showToast(window.isViewingArchive ? 'Чаты возвращены' : 'Чаты добавлены в архив');
    toggleEditModeChats();
    window.isViewingArchive = false;
    switchChatFolder(window.currentFolder);
    renderArchiveFolder();
}

function deleteChat(chatId) {
    if (!chatId) return;
    const name = document.getElementById(`contact-name-${chatId}`)?.textContent || chatId;
    if (!confirm(`Удалить чат с «${name}»?\n\nСообщения останутся на сервере, но чат исчезнет из списка.`)) return;
    hiddenChats.add(chatId);
    localStorage.setItem('aura-hidden-chats', JSON.stringify([...hiddenChats]));
    const el = document.getElementById(`contact-${chatId}`);
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(-20px)'; setTimeout(() => el.remove(), 300); }
    if (selectedChatId === chatId) {
        document.getElementById('chat-ui').classList.add('hidden'); document.getElementById('welcome-screen').classList.remove('hidden');
        mainContainer.classList.remove('chat-open'); selectedChatId = null;
    }
    const dd = document.getElementById('chat-header-dropdown');
    if (dd) { dd.classList.remove('show'); setTimeout(() => dd.classList.add('hidden'), 200); }
    showToast('Чат удалён из списка');
}

async function updateContactsUI(chatId) {
    if (hiddenChats.has(chatId)) return;
    knownChatIds.add(chatId);
    if (chatId === currentUser.username) return;

    let el = document.getElementById(`contact-${chatId}`);
    if (!el) {
        el = document.createElement('div'); el.id = `contact-${chatId}`; el.className = 'contact-item';
        el.innerHTML = `<div class="chat-select-checkbox hidden" onclick="toggleSelectChat(event, '${chatId}')"><i class="fas fa-check"></i></div><div class="avatar-wrapper"><div class="avatar" id="avatar-list-${chatId}"></div><div class="online-dot" id="online-dot-${chatId}"></div></div><div class="contact-info"><strong id="contact-name-${chatId}">${chatId}</strong><div class="contact-subtext" id="contact-sub-${chatId}"></div></div><div class="unread-badge hidden" id="unread-${chatId}">0</div>`;
        el.onclick = (e) => { if (isEditMode) toggleSelectChat(e, chatId); else openChat(chatId); };
        contactsDiv.prepend(el);
    } else {
        contactsDiv.prepend(el);
    }

    updateUnreadBadge(chatId);
    renderArchiveFolder(); 

    const res  = await fetch(`/api/entity/${chatId}`);
    const data = await res.json();
    
    switchChatFolder(window.currentFolder); // Применяем фильтр папок
    
    const nameEl = document.getElementById(`contact-name-${chatId}`);
    if (nameEl) nameEl.textContent = data.displayName || data.name || chatId;
    
    const avEl = document.getElementById(`avatar-list-${chatId}`);
    if (avEl) {
        if (data.isBlocked) { avEl.style.backgroundImage = 'none'; avEl.style.background = 'var(--bg-hover)'; avEl.innerHTML = '<i class="fas fa-user-slash" style="color:var(--text-dim)"></i>'; } 
        else if (data.avatar) { avEl.style.backgroundImage = `url(${data.avatar})`; avEl.innerHTML = ''; } 
        else { avEl.textContent = (data.displayName || data.name || chatId)[0].toUpperCase(); avEl.style.backgroundImage = 'none'; avEl.style.background = data.profileColor || 'var(--primary)'; avEl.innerHTML = ''; }
    }
    const dot = document.getElementById(`online-dot-${chatId}`);
    if (dot) dot.style.display = (data.type === 'user' && data.isOnline && !data.isBlocked) ? 'block' : 'none';
}

async function openChat(chatId) {
    if (isEditMode) return;
    closeContextMenu(); selectedChatId = chatId; unreadCounts[chatId] = 0; updateUnreadBadge(chatId);
    currentOffset = 0; hasMoreHistory = true; viewerHasInteracted = false;
 
    document.getElementById('pinned-banner').classList.add('hidden'); messagesDiv.innerHTML = '';
    document.getElementById('welcome-screen').classList.add('hidden'); document.getElementById('chat-ui').classList.remove('hidden'); mainContainer.classList.add('chat-open');
 
    const headerAvatar = document.getElementById('chat-header-avatar');
    applyChatWallpaper(localStorage.getItem('chatBg_' + chatId));
 
    if (chatId === 'me') {
        isCurrentChatGroup = false;
        document.getElementById('chat-with-title').innerHTML = dict[currentLang].savedMessages; document.getElementById('chat-header-info').onclick = null;
        headerAvatar.style.backgroundImage = 'none'; headerAvatar.innerHTML = '<i class="fas fa-bookmark"></i>'; headerAvatar.style.background = 'var(--primary)';
        updateChatStatus('me', false); inputContainer.classList.remove('hidden'); readonlyBanner.classList.add('hidden');
        document.getElementById('btn-call-audio').style.display = 'none'; document.getElementById('btn-call-video').style.display = 'none'; document.getElementById('btn-call-screen').style.display = 'none';
        document.getElementById('rave-container').classList.add('hidden');
    } else {
        const res = await fetch(`/api/entity/${chatId}`); const data = await res.json();
        isCurrentChatGroup = (data.type === 'group' || data.type === 'channel' || data.type === 'rave');
        let emojiHtml = data.emojiStatus ? `<span class="emoji-status-badge">${data.emojiStatus}</span>` : '';
        document.getElementById('chat-with-title').innerHTML = `${data.displayName || data.name || chatId} ${emojiHtml}`;
        document.getElementById('chat-header-info').onclick = () => viewUserProfile(chatId);
 
        headerAvatar.innerHTML = '';
        if (data.isBlocked) { headerAvatar.style.backgroundImage = 'none'; headerAvatar.style.background = 'var(--bg-hover)'; headerAvatar.innerHTML = '<i class="fas fa-user-slash" style="color:var(--text-dim)"></i>'; } 
        else if (data.avatar) { headerAvatar.style.backgroundImage = `url(${data.avatar})`; headerAvatar.style.backgroundSize = 'cover'; } 
        else { headerAvatar.style.backgroundImage = 'none'; headerAvatar.style.background = data.profileColor || 'var(--primary)'; headerAvatar.textContent = (data.displayName || data.name || chatId)[0].toUpperCase(); }
 
        if (data.type === 'rave') { document.getElementById('rave-container').classList.remove('hidden'); if (data.raveState) applyRaveState(data.raveState); if (data.raveState && data.raveState.host !== currentUser.username) socket.emit('rave_update_state', { action: 'sync_request', groupId: chatId }); } 
        else { document.getElementById('rave-container').classList.add('hidden'); document.getElementById('rave-html-player').pause(); document.getElementById('rave-html-player').src = ''; }
 
        if (data.type === 'channel' && data.myRole === 'member') { inputContainer.classList.add('hidden'); readonlyBanner.classList.remove('hidden'); } 
        else { inputContainer.classList.remove('hidden'); readonlyBanner.classList.add('hidden'); }
 
        if (isCurrentChatGroup || !data.canCall) { document.getElementById('btn-call-audio').style.display = 'none'; document.getElementById('btn-call-video').style.display = 'none'; document.getElementById('btn-call-screen').style.display = 'none'; } 
        else { document.getElementById('btn-call-audio').style.display = 'flex'; document.getElementById('btn-call-video').style.display = 'flex'; document.getElementById('btn-call-screen').style.display = 'flex'; }
 
        document.getElementById('chat-main-header').style.borderBottom = `2px solid ${data.profileColor || 'var(--border)'}`;
        updateContactsUI(chatId);
        updateChatStatus(chatId, isCurrentChatGroup, data.isOnline, data.lastSeen, data.membersCount);
    }
    socket.emit('mark_read', { chatWith: chatId }); socket.emit('get_history', { chatWith: chatId, offset: 0 });
}

messagesDiv.addEventListener('scroll', () => { if (messagesDiv.scrollTop === 0 && !isLoadingHistory && hasMoreHistory) { isLoadingHistory = true; currentOffset += 40; socket.emit('get_history', { chatWith: selectedChatId, offset: currentOffset }); } });

let ctxTarget = null; let longPressTimer;
function openContextMenu(e, id, isMine, from, text, media) {
    e.preventDefault(); ctxTarget = { id, isMine, from, text, media };
    document.getElementById('ctx-edit-btn').style.display = isMine ? 'flex' : 'none';
    document.getElementById('ctx-pin-btn').style.display = isCurrentChatGroup ? 'flex' : 'none';
    const fwdBtn = document.getElementById('ctx-forward-btn'); if (fwdBtn) fwdBtn.style.display = 'flex';
    contextMenuEl.classList.remove('hidden'); contextMenuEl.style.display = 'flex';
    let x = e.pageX || (e.touches ? e.touches[0].pageX : 0); let y = e.pageY || (e.touches ? e.touches[0].pageY : 0);
    const menuW = 230, menuH = 260;
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
    if (x < 5) x = 5; if (y < 5) y = 5;
    contextMenuEl.style.left = `${x}px`; contextMenuEl.style.top = `${y}px`; setTimeout(() => contextMenuEl.classList.add('show'), 10);
}
function closeContextMenu() { contextMenuEl.classList.remove('show'); setTimeout(() => contextMenuEl.classList.add('hidden'), 200); }
function contextReact(emoji) { if (ctxTarget) socket.emit('add_reaction', { id: ctxTarget.id, emoji }); closeContextMenu(); }
function contextReply() { if (ctxTarget) startReply(ctxTarget.from, ctxTarget.text || 'Медиа', ctxTarget.id); closeContextMenu(); }
function contextEdit() { if (!ctxTarget || !ctxTarget.isMine) return; editData = { id: ctxTarget.id }; msgInput.value = ctxTarget.text || ''; msgInput.focus(); sendBtn.innerHTML = '<i class="fas fa-check"></i>'; sendBtn.classList.remove('hidden'); micBtn.classList.add('hidden'); closeContextMenu(); }
function contextPin() { if (!ctxTarget) return; socket.emit('pin_msg', { id: ctxTarget.id, text: ctxTarget.text, chatId: selectedChatId }); closeContextMenu(); }
function contextDelete() { if (!ctxTarget) return; if (ctxTarget.isMine && selectedChatId !== 'me') { if (confirm('Удалить для ВСЕХ?')) socket.emit('delete_msg', { id: ctxTarget.id, forEveryone: true }); else socket.emit('delete_msg', { id: ctxTarget.id, forEveryone: false }); } else { if (confirm('Удалить у себя?')) socket.emit('delete_msg', { id: ctxTarget.id, forEveryone: false }); } closeContextMenu(); }
function contextForward() { if (!ctxTarget) return; forwardMsgData = { from: ctxTarget.from, text: ctxTarget.text || '', media: ctxTarget.media || null }; openForwardModal(); closeContextMenu(); }

function openForwardModal() {
    const old = document.getElementById('forward-modal'); if (old) old.remove();
    const modal = document.createElement('div'); modal.id = 'forward-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:3000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeForwardModal(); });
    const inner = document.createElement('div'); inner.className = 'fwd-modal-inner';
    const header = document.createElement('div'); header.className = 'fwd-modal-header'; header.innerHTML = `<button class="fwd-close-btn" onclick="closeForwardModal()"><i class="fas fa-times"></i></button><h3>Переслать сообщение</h3>`;
    const searchWrap = document.createElement('div'); searchWrap.className = 'fwd-modal-search'; const searchInput = document.createElement('input'); searchInput.placeholder = 'Поиск чата...'; searchWrap.appendChild(searchInput);
    const list = document.createElement('div'); list.className = 'fwd-list';
    inner.appendChild(header); inner.appendChild(searchWrap); inner.appendChild(list); modal.appendChild(inner); document.body.appendChild(modal);
 
    const chatIds = Array.from(knownChatIds).filter(id => id !== 'me');
    const renderItems = (filter = '') => {
        list.innerHTML = '';
        const filtered = filter ? chatIds.filter(id => { const nameEl = document.getElementById(`contact-name-${id}`); const name = nameEl ? nameEl.textContent.toLowerCase() : id.toLowerCase(); return name.includes(filter.toLowerCase()) || id.toLowerCase().includes(filter.toLowerCase()); }) : chatIds;
        if (filtered.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-dim);">Ничего не найдено</div>'; return; }
        filtered.forEach(chatId => {
            const nameEl = document.getElementById(`contact-name-${chatId}`); const avEl = document.getElementById(`avatar-list-${chatId}`);
            const name = nameEl ? nameEl.textContent.trim() : chatId; const avStyle = avEl ? (avEl.getAttribute('style') || '') : ''; const avText = avEl ? avEl.textContent.trim() : chatId[0].toUpperCase();
            const item = document.createElement('div'); item.className = 'fwd-item';
            item.innerHTML = `<div class="fwd-av" style="${avStyle}">${avText}</div><div class="fwd-item-info"><div class="fwd-item-name">${name}</div><div class="fwd-item-sub">@${chatId}</div><div class="fwd-sent-mark"></div></div>`;
            item.onclick = () => forwardMessage(chatId, item); list.appendChild(item);
        });
    };
    if (chatIds.length === 0) list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-dim);">Нет доступных чатов</div>';
    else { renderItems(); searchInput.addEventListener('input', () => renderItems(searchInput.value)); setTimeout(() => searchInput.focus(), 300); }
}
function closeForwardModal() { const modal = document.getElementById('forward-modal'); if (modal) modal.remove(); forwardMsgData = null; }

function forwardMessage(toChatId, itemEl) {
    if (!forwardMsgData) return;
    const from = forwardMsgData.from; let cleanText = forwardMsgData.text || '';
    if (cleanText.includes('fwd-msg-header')) { const tmp = document.createElement('div'); tmp.innerHTML = cleanText; const hdr = tmp.querySelector('.fwd-msg-header'); if (hdr) hdr.remove(); cleanText = tmp.innerHTML; }
    const displayName = (() => { const el = document.getElementById(`contact-name-${from}`); return el ? el.textContent.trim() : from; })();
    const fwdHeader = `<span class="fwd-msg-header"><span class="fwd-icon-wrap"><i class="fas fa-share"></i></span><span class="fwd-from-link" onclick="viewUserProfile('${from}');event.stopPropagation()">Переслано от ${displayName}</span></span>`;
    socket.emit('private_msg', { to: toChatId, text: fwdHeader + cleanText, media: forwardMsgData.media || null });
    if (itemEl) { const mark = itemEl.querySelector('.fwd-sent-mark'); if (mark) { mark.classList.add('visible'); mark.textContent = '✓ Отправлено'; } itemEl.style.opacity = '0.6'; itemEl.onclick = null; }
    showToast('Сообщение переслано'); setTimeout(() => { closeForwardModal(); if (toChatId !== selectedChatId) openChat(toChatId); }, 600);
}

function generateReactionsHtml(msgId, reactionsObj) { if (!reactionsObj) return ''; let html = ''; for (const [emoji, users] of Object.entries(reactionsObj)) { if (users.length > 0) { const reacted = users.includes(currentUser.username); html += `<div class="reaction-badge ${reacted ? 'reacted' : ''}" onclick="socket.emit('add_reaction',{id:'${msgId}',emoji:'${emoji}'})">${emoji} <small>${users.length}</small></div>`; } } return html; }

// ===== 3. МАРКДАУН И СПОЙЛЕРЫ =====
function formatText(text) { 
    if (!text) return ''; 
    if (text.includes('<span class="system-call-msg">')) return text; 
    if (text.includes('fwd-msg-header')) return text; 
    
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
    s = s.replace(/(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+)/g, '<a href="$1" target="_blank" class="chat-link" onclick="event.stopPropagation()">$1</a>'); 
    s = s.replace(/@([a-zA-Z0-9_]+)/g, '<span class="chat-mention" onclick="viewUserProfile(\'$1\'); event.stopPropagation();">@$1</span>'); 
    
    s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); // Жирный
    s = s.replace(/\*(.*?)\*/g, '<i>$1</i>'); // Курсив
    s = s.replace(/~~(.*?)~~/g, '<s>$1</s>'); // Зачеркнутый
    s = s.replace(/`(.*?)`/g, '<code>$1</code>'); // Код
    s = s.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'); // Спойлер

    return `<span class="msg-formatted">${s}</span>`; 
}

function buildReplyMarkup(reply, msgId) {
    if (!reply) return ''; let previewContent = '';
    if (reply.media) { 
        const icons = { image: 'fa-image', video: 'fa-video', audio: 'fa-microphone', voice: 'fa-microphone', file: 'fa-file', sticker: 'fa-sticky-note' }; 
        const icon = icons[reply.media.type] || 'fa-file'; 
        previewContent = `<span class="reply-preview-media"><i class="fas ${icon}"></i>${reply.media.name || 'Медиа'}</span>`; 
    } else if (reply.text) { 
        const tmp = document.createElement('div'); tmp.innerHTML = reply.text; 
        previewContent = `<span class="reply-preview">${tmp.textContent.slice(0, 80)}</span>`; 
    } else { previewContent = `<span class="reply-preview">Сообщение</span>`; }
    return `<div class="msg-reply-info" onclick="scrollToMsg('${reply.id || ''}')"><span class="reply-sender">${reply.username}</span>${previewContent}</div>`;
}
function scrollToMsg(msgId) { if (!msgId) return; const el = document.querySelector(`[data-id="${msgId}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('.bubble').style.transition = 'background 0.3s'; el.querySelector('.bubble').style.background = 'rgba(135,116,225,0.35)'; setTimeout(() => { if (el.querySelector('.bubble')) el.querySelector('.bubble').style.background = ''; }, 900); } }

function renderMsg(msg, isPrepend = false) {
    if (msg.isSystem) {
        const sysDiv = document.createElement('div'); sysDiv.style.cssText = 'text-align:center;margin:10px 0;'; sysDiv.setAttribute('data-id', msg.id);
        sysDiv.innerHTML = `<span style="background:rgba(0,0,0,0.3);padding:4px 12px;border-radius:12px;font-size:0.8rem;color:var(--text-dim);backdrop-filter:blur(5px)"><b>${msg.from}</b> ${msg.text}</span>`;
        if (isPrepend) messagesDiv.insertBefore(sysDiv, messagesDiv.firstChild); else messagesDiv.appendChild(sysDiv); return;
    }
 
    const isMine = (msg.from || '').toLowerCase() === (currentUser.username || '').toLowerCase();
    const isSaved = selectedChatId === 'me';
    const div = document.createElement('div'); div.className = `message-row ${isMine ? 'mine' : 'other'}`; div.setAttribute('data-id', msg.id);
 
    let contentHtml = '';
    let isSticker = false;

    if (msg.media) {
        const m = msg.media;
        if (m.type === 'image') contentHtml = `<img src="${m.data}" class="media-content" onclick="window.open(this.src)">`;
        else if (m.type === 'video') contentHtml = `<video src="${m.data}" controls class="media-video"></video>`;
        else if (m.type === 'sticker') { isSticker = true; contentHtml = `<img src="${m.data}" class="sticker-msg-img">`; }
        else if (m.type === 'audio' || m.type === 'voice') { const aId = 'audio-' + msg.id; contentHtml = `<div class="custom-voice-player"><button class="voice-play-btn" onclick="toggleCustomAudio('${aId}')"><i class="fas fa-play" id="icon-${aId}"></i></button><div class="voice-waveform-container" onclick="seekCustomAudio(event,'${aId}')"><div class="voice-waveform-progress" id="progress-${aId}"></div></div><span class="voice-time" id="time-${aId}">0:00</span><audio id="${aId}" src="${m.data}" ontimeupdate="updateAudioProgress('${aId}')" onloadedmetadata="setAudioDuration('${aId}')" onended="resetAudio('${aId}')" class="hidden"></audio></div>`; }
    }
 
    let senderNameHtml = '';
    if (!isMine && !isSaved && isCurrentChatGroup) {
        const roleBadge = msg.customTitle ? `<span style="background:var(--primary-soft);color:var(--primary);font-size:0.6rem;padding:2px 4px;border-radius:4px;margin-left:5px;">${msg.customTitle}</span>` : '';
        const emoji = msg.emojiStatus ? `<span class="emoji-status-badge" style="font-size:0.7rem">${msg.emojiStatus}</span>` : '';
        senderNameHtml = `<div class="msg-sender-name" onclick="viewUserProfile('${msg.from}')">${msg.fromDisplayName || msg.from} ${emoji} ${roleBadge}</div>`;
    }
 
    if (msg.text) {
        let displayedText = (msg.text.includes('system-call-msg') || msg.text.includes('fwd-msg-header')) ? msg.text : formatText(msg.text);
        const editedMark = msg.isEdited ? '<small style="opacity:0.6;font-size:0.75rem;">(изм.)</small>' : '';
        contentHtml += `<div class="text">${displayedText} ${editedMark}</div>`;
    }
 
    const replyMarkup = buildReplyMarkup(msg.reply, msg.id);
    const ticksHtml = isMine ? `<span class="status-ticks ${msg.read ? 'read' : ''}"><i class="fas fa-check"></i>${msg.read ? '<i class="fas fa-check" style="margin-left:-4px"></i>' : ''}</span>` : '';
    let viewsHtml = '';
    if (msg.isChannelPost) {
        viewsHtml = `<span style="font-size:0.75rem;opacity:0.6;margin-right:5px;"><i class="fas fa-eye"></i> <span id="views-${msg.id}">${msg.views.length}</span></span>`;
        if (!msg.views.includes(currentUser.username)) socket.emit('view_channel_msg', { id: msg.id });
    }
 
    const avId = 'msg-av-' + Math.random().toString(36).substr(2, 9);
    const avatarMarkup = (!isMine && !isSaved) ? `<div class="avatar msg-avatar" id="${avId}" onclick="viewUserProfile('${msg.from}')"></div>` : '';
 
    const bubbleClass = isSticker ? "bubble sticker-bubble" : "bubble";

    div.innerHTML = `${avatarMarkup}<div class="${bubbleClass}"><div class="swipe-reply-hint"><i class="fas fa-reply"></i></div>${senderNameHtml}${replyMarkup}${contentHtml}<div class="msg-footer">${viewsHtml}<span class="time">${msg.time || ''}</span>${ticksHtml}</div><div class="msg-reactions" id="reactions-${msg.id}">${generateReactionsHtml(msg.id, msg.reactions)}</div></div>`;
 
    if (isPrepend) messagesDiv.insertBefore(div, messagesDiv.firstChild); else messagesDiv.appendChild(div);
 
    const bubbleEl = div.querySelector('.bubble');
    bubbleEl.oncontextmenu = (e) => openContextMenu(e, msg.id, isMine, msg.from, msg.text, msg.media);
    bubbleEl.ontouchstart  = (e) => { longPressTimer = setTimeout(() => openContextMenu(e, msg.id, isMine, msg.from, msg.text, msg.media), 500); };
    bubbleEl.ontouchend    = () => clearTimeout(longPressTimer); bubbleEl.ontouchmove = () => clearTimeout(longPressTimer);
    _attachSwipeToReply(div, bubbleEl, msg);
 
    if (!isMine && !isSaved) {
        fetch(`/api/entity/${msg.from}`).then(r => r.json()).then(data => {
            const avEl = document.getElementById(avId); if (!avEl) return;
            if (data.isBlocked) { avEl.style.backgroundImage = 'none'; avEl.style.background = 'var(--bg-hover)'; avEl.innerHTML = '<i class="fas fa-user-slash" style="color:var(--text-dim)"></i>'; } 
            else if (data.avatar) { avEl.style.backgroundImage = `url(${data.avatar})`; avEl.textContent = ''; } 
            else { avEl.style.background = data.profileColor || 'var(--primary)'; avEl.textContent = (data.displayName || data.name || msg.from)[0].toUpperCase(); }
        }).catch(() => {});
    }
}

function _attachSwipeToReply(rowEl, bubbleEl, msg) {
    const hint = bubbleEl.querySelector('.swipe-reply-hint'); const isMine = rowEl.classList.contains('mine');
    let startX = 0, startY = 0, currentDx = 0, dirLocked = null; const THRESHOLD = 60, MAX_SWIPE = 78;
    rowEl.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; currentDx = 0; dirLocked = null; }, { passive: true });
    rowEl.addEventListener('touchmove', (e) => {
        const rawDx = e.touches[0].clientX - startX; const dy = e.touches[0].clientY - startY;
        if (!dirLocked) { if (Math.abs(rawDx) > 6 || Math.abs(dy) > 6) dirLocked = Math.abs(rawDx) > Math.abs(dy) ? 'h' : 'v'; }
        if (dirLocked !== 'h') return; const validSwipe = isMine ? rawDx < 0 : rawDx > 0; if (!validSwipe) return;
        currentDx = Math.abs(rawDx); const clamped = Math.min(currentDx, MAX_SWIPE); const progress = clamped / MAX_SWIPE; const translateX = isMine ? -clamped : clamped;
        bubbleEl.style.transition = 'none'; bubbleEl.style.transform  = `translateX(${translateX}px)`; hint.style.transition = 'none'; hint.style.transform  = `translateY(-50%) scale(${Math.min(progress * 1.3, 1)})`; hint.style.opacity = Math.min(progress * 1.6, 1);
        if (clamped >= THRESHOLD) hint.classList.add('triggered'); else hint.classList.remove('triggered');
    }, { passive: true });
    rowEl.addEventListener('touchend', () => {
        if (dirLocked !== 'h') return; const triggered = currentDx >= THRESHOLD;
        bubbleEl.style.transition = 'transform 0.38s cubic-bezier(0.25, 1, 0.5, 1)'; bubbleEl.style.transform  = 'translateX(0)'; hint.style.transition = 'transform 0.3s ease, opacity 0.3s ease'; hint.style.transform = 'translateY(-50%) scale(0)'; hint.style.opacity = '0'; hint.classList.remove('triggered');
        if (triggered) { if (navigator.vibrate) navigator.vibrate(35); startReply(msg.from, msg.text || null, msg.id, msg.media); }
        currentDx = 0; dirLocked = null;
    }, { passive: true });
}

function send() {
    const text = msgInput.value.trim();
    if (editData && text) { socket.emit('edit_msg', { id: editData.id, text }); editData = null; msgInput.value = ''; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; toggleInputButtons(); } 
    else if ((text || replyData) && selectedChatId) { socket.emit('private_msg', { to: selectedChatId, text, reply: replyData }); msgInput.value = ''; toggleInputButtons(); cancelReply(); socket.emit('chat_action', { to: selectedChatId, action: 'clear' }); }
}
function toggleInputButtons() { if (msgInput.value.trim().length > 0) { sendBtn.classList.remove('hidden'); micBtn.classList.add('hidden'); } else { sendBtn.classList.add('hidden'); micBtn.classList.remove('hidden'); } }

let typingTimer; 
msgInput.addEventListener('input', () => { 
    toggleInputButtons(); 
    if (selectedChatId && selectedChatId !== 'me') { 
        socket.emit('chat_action', { to: selectedChatId, action: 'typing' }); 
        clearTimeout(typingTimer); 
        typingTimer = setTimeout(() => socket.emit('chat_action', { to: selectedChatId, action: 'clear' }), 2000); 
    } 
});

function toggleChatSearch() { const bar = document.getElementById('chat-search-bar'); bar.classList.toggle('hidden'); if (!bar.classList.contains('hidden')) document.getElementById('chat-search-input').focus(); else { document.getElementById('chat-search-input').value = ''; openChat(selectedChatId); } }
function performChatSearch() { const query = document.getElementById('chat-search-input').value.trim(); if (query) socket.emit('search_chat', { chatWith: selectedChatId, query }); }

let mediaRecorder, audioChunks = [], isRecording = false, isCancelled = false, recordingTimerId, recordingStartTime, startX;
async function startRecording(e) {
    if (!selectedChatId || isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(stream); audioChunks = []; isCancelled = false;
        mediaRecorder.ondataavailable = ev => { if (ev.data.size > 0) audioChunks.push(ev.data); };
        mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(recordingTimerId); resetRecordingUI(); if (!isCancelled && audioChunks.length > 0) sendVoiceMessage(new Blob(audioChunks, { type: 'audio/webm' })); isRecording = false; if (selectedChatId !== 'me') socket.emit('chat_action', { to: selectedChatId, action: 'clear' }); };
        mediaRecorder.start(); isRecording = true; if (selectedChatId !== 'me') socket.emit('chat_action', { to: selectedChatId, action: 'recording' }); startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; showRecordingUI();
    } catch (err) { showToast('Нет доступа к микрофону'); }
}
function stopRecording() { if (mediaRecorder && isRecording) mediaRecorder.stop(); }
function cancelRecording() { if (isRecording) { isCancelled = true; mediaRecorder.stop(); } }
function showRecordingUI() { msgInput.classList.add('hidden'); attachBtn.classList.add('hidden'); recordUI.classList.remove('hidden'); micBtn.classList.add('recording-active'); recordingStartTime = Date.now(); document.getElementById('record-time').textContent = '0:00'; recordingTimerId = setInterval(() => { const diff = Math.floor((Date.now() - recordingStartTime) / 1000); document.getElementById('record-time').textContent = `${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`; }, 1000); }
function resetRecordingUI() { msgInput.classList.remove('hidden'); attachBtn.classList.remove('hidden'); recordUI.classList.add('hidden'); micBtn.classList.remove('recording-active'); micBtn.style.transform = 'translateX(0px)'; }
function sendVoiceMessage(blob) { const reader = new FileReader(); reader.onloadend = () => { socket.emit('private_msg', { to: selectedChatId, text: '', media: { type: 'voice', data: reader.result, name: 'Voice.webm' }, reply: replyData }); cancelReply(); }; reader.readAsDataURL(blob); }
micBtn.addEventListener('mousedown', startRecording); micBtn.addEventListener('touchstart', startRecording, { passive: true });
window.addEventListener('mouseup', () => { if (isRecording) stopRecording(); }); window.addEventListener('touchend', () => { if (isRecording) stopRecording(); }); window.addEventListener('mousemove', (e) => { if (isRecording) handleSwipe(e.clientX); }); window.addEventListener('touchmove', (e) => { if (isRecording) handleSwipe(e.touches[0].clientX); }, { passive: true });
function handleSwipe(currentX) { const diffX = startX - currentX; if (diffX > 10) micBtn.style.transform = `translateX(-${Math.min(diffX, 150)}px)`; if (diffX > 120) cancelRecording(); }

let currentPlayingAudio = null;
function toggleCustomAudio(audioId) { const audio = document.getElementById(audioId); const icon = document.getElementById('icon-' + audioId); if (!audio) return; if (audio.paused) { if (currentPlayingAudio && currentPlayingAudio !== audio) { currentPlayingAudio.pause(); const oldIcon = document.getElementById('icon-' + currentPlayingAudio.id); if (oldIcon) oldIcon.className = 'fas fa-play'; } audio.play(); icon.className = 'fas fa-pause'; currentPlayingAudio = audio; } else { audio.pause(); icon.className = 'fas fa-play'; currentPlayingAudio = null; } }
function updateAudioProgress(audioId) { const audio = document.getElementById(audioId); const progress = document.getElementById('progress-' + audioId); const timeEl = document.getElementById('time-' + audioId); if (audio && audio.duration && audio.duration !== Infinity) { if (progress) progress.style.width = ((audio.currentTime / audio.duration) * 100) + '%'; if (timeEl) timeEl.textContent = `${Math.floor(audio.currentTime / 60)}:${Math.floor(audio.currentTime % 60).toString().padStart(2, '0')}`; } }
function setAudioDuration(audioId) { const audio = document.getElementById(audioId); const timeEl = document.getElementById('time-' + audioId); if (audio && audio.duration && audio.duration !== Infinity) { if (timeEl) timeEl.textContent = `${Math.floor(audio.duration / 60)}:${Math.floor(audio.duration % 60).toString().padStart(2, '0')}`; } }
function resetAudio(audioId) { const icon = document.getElementById('icon-' + audioId); const progress = document.getElementById('progress-' + audioId); if (icon) icon.className = 'fas fa-play'; if (progress) progress.style.width = '0%'; setAudioDuration(audioId); if (currentPlayingAudio && currentPlayingAudio.id === audioId) currentPlayingAudio = null; }
function seekCustomAudio(e, audioId) { const audio = document.getElementById(audioId); if (!audio) return; const rect = e.currentTarget.getBoundingClientRect(); if (audio.duration && audio.duration !== Infinity) { audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration; updateAudioProgress(audioId); } }
function sendMediaFile(input) { 
    const file = input.files[0]; if (!file) return; 
    if (selectedChatId && selectedChatId !== 'me') socket.emit('chat_action', { to: selectedChatId, action: 'uploading' });
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        socket.emit('private_msg', { to: selectedChatId, text: '', media: { type: file.type.split('/')[0], data: e.target.result, name: file.name }, reply: replyData }); 
        cancelReply(); 
        if (selectedChatId && selectedChatId !== 'me') socket.emit('chat_action', { to: selectedChatId, action: 'clear' });
    }; 
    reader.readAsDataURL(file); 
    input.value = ''; 
}

function startReply(username, text, msgId, media) {
    replyData = { username, text: text || null, id: msgId || null, media: media || null };
    const previewBar = document.getElementById('reply-preview'); document.getElementById('reply-user').innerText = '↩ ' + username;
    if (media) { const icons = { image: '🖼 ', video: '📹 ', audio: '🎵 ', voice: '🎤 ', file: '📎 ', sticker: '⭐️ ' }; document.getElementById('reply-text').textContent = (icons[media.type] || '') + (media.name || 'Медиа'); } 
    else { const tmp = document.createElement('div'); tmp.innerHTML = text || ''; document.getElementById('reply-text').textContent = tmp.textContent.slice(0, 80); }
    previewBar.classList.remove('hidden'); msgInput.focus();
}
function cancelReply() { replyData = null; document.getElementById('reply-preview').classList.add('hidden'); }
function toggleChatHeaderMenu(e) { e.stopPropagation(); const menu = document.getElementById('chat-header-dropdown'); menu.classList.toggle('hidden'); if (!menu.classList.contains('hidden')) { menu.style.display = 'flex'; setTimeout(() => menu.classList.add('show'), 10); } else { menu.classList.remove('show'); } }

function setChatWallpaper(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const url = e.target.result; localStorage.setItem('chatBg_' + selectedChatId, url); applyChatWallpaper(url); document.getElementById('chat-header-dropdown').classList.add('hidden'); }; reader.readAsDataURL(file); input.value = ''; }
function resetChatWallpaper() { localStorage.removeItem('chatBg_' + selectedChatId); applyChatWallpaper(null); document.getElementById('chat-header-dropdown').classList.add('hidden'); }
function applyChatWallpaper(url) {
    const bgLayer = document.getElementById('chat-bg-layer'); const chatArea = document.getElementById('chat-area-main');
    if (url) { bgLayer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(${url})`; bgLayer.classList.add('active'); chatArea.classList.add('has-wallpaper'); document.documentElement.style.setProperty('--chat-tint', 'rgba(255,255,255,0.1)'); } 
    else { bgLayer.classList.remove('active'); chatArea.classList.remove('has-wallpaper'); setTimeout(() => bgLayer.style.backgroundImage = 'none', 600); document.documentElement.style.setProperty('--chat-tint', 'transparent'); }
}

// =========================================
//   SOCKET СОБЫТИЯ
// =========================================

// ИНДИКАТОРЫ ДЕЙСТВИЙ (ПЕЧАТАЕТ, ГРУЗИТ)
socket.on('user_chat_action', (data) => {
    if (data.to === selectedChatId) {
        if (data.action === 'typing') { chatStatusEl.textContent = dict[currentLang].typing; chatStatusEl.classList.add('typing'); }
        else if (data.action === 'recording') { chatStatusEl.innerHTML = '<i class="fas fa-microphone"></i> записывает голосовое...'; chatStatusEl.classList.add('typing'); }
        else if (data.action === 'uploading') { chatStatusEl.innerHTML = '<i class="fas fa-file-upload"></i> отправляет файл...'; chatStatusEl.classList.add('typing'); }
        else { updateChatStatus(selectedChatId, isCurrentChatGroup); }
    }
    
    const sub = document.getElementById(`contact-sub-${data.from}`);
    if (sub) { 
        if (data.action === 'typing') { sub.textContent = dict[currentLang].typing; sub.classList.add('typing'); }
        else if (data.action === 'recording') { sub.innerHTML = '<i class="fas fa-microphone"></i> голосовое...'; sub.classList.add('typing'); }
        else if (data.action === 'uploading') { sub.innerHTML = '<i class="fas fa-file-upload"></i> файл...'; sub.classList.add('typing'); }
        else { sub.textContent = ''; sub.classList.remove('typing'); }
    }
});


socket.on('user_status_change', (data) => {
    if (data.username === selectedChatId && !isCurrentChatGroup) updateChatStatus(data.username, false, data.online, data.lastSeen);
    if (viewingUserProfile === data.username && viewingEntityData && viewingEntityData.type === 'user') {
        if (data.lastSeen === 'blocked') document.getElementById('p-status').textContent = dict[currentLang].blockedStatus;
        else if (data.online) document.getElementById('p-status').textContent = dict[currentLang].online;
        else document.getElementById('p-status').textContent = formatLastSeen(data.lastSeen);
    }
    const dot = document.getElementById(`online-dot-${data.username}`); if (dot) dot.style.display = (data.online && data.lastSeen !== 'blocked') ? 'block' : 'none';
    const sub = document.getElementById(`contact-sub-${data.username}`); if (sub && !data.online && sub.textContent === dict[currentLang].typing) sub.textContent = '';
});

socket.on('user_typing', (data) => {}); // Оставлено заглушкой для совместимости
socket.on('user_stop_typing', (data) => {}); // Оставлено заглушкой для совместимости

socket.on('user_updated', (data) => { if (data.username === currentUser.username) { currentUser = data.user; updateHeaderUI(); } if (selectedChatId === data.username) openChat(data.username); updateContactsUI(data.username); });
socket.on('msg_receive', (msg) => {
    const isCurrentChat = (msg.to === selectedChatId || (msg.from === selectedChatId && msg.to === currentUser.username) || (selectedChatId === 'me' && msg.to === 'me'));
    if (isCurrentChat) { renderMsg(msg, false); messagesDiv.scrollTop = messagesDiv.scrollHeight; if (msg.from !== currentUser.username) { document.getElementById('snd-notify').play().catch(() => {}); socket.emit('mark_read', { chatWith: msg.to === currentUser.username ? msg.from : msg.to }); socket.emit('chat_action', { to: selectedChatId, action: 'clear' }); } else { document.getElementById('snd-send').play().catch(() => {}); } } 
    else {
        document.getElementById('snd-notify').play().catch(() => {}); const chatIdForUnread = msg.to === currentUser.username ? msg.from : msg.to;
        if (msg.from !== currentUser.username) {
            if (hiddenChats.has(chatIdForUnread)) { hiddenChats.delete(chatIdForUnread); localStorage.setItem('aura-hidden-chats', JSON.stringify([...hiddenChats])); }
            unreadCounts[chatIdForUnread] = (unreadCounts[chatIdForUnread] || 0) + 1; updateContactsUI(chatIdForUnread);
            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Новое сообщение', { body: msg.text || 'Медиафайл', icon: '/icon.png' });
        }
    }
});
socket.on('messages_read', (data) => { if (selectedChatId === data.by || selectedChatId === data.chatId) { document.querySelectorAll('.mine .status-ticks').forEach(el => { el.classList.add('read'); el.innerHTML = '<i class="fas fa-check"></i><i class="fas fa-check" style="margin-left:-4px"></i>'; }); } });
socket.on('msg_deleted', (data) => { const el = document.querySelector(`[data-id="${data.id}"]`); if (el) el.remove(); });
socket.on('msg_edited', (data) => { const row = document.querySelector(`.message-row[data-id="${data.id}"]`); if (row) { let textDiv = row.querySelector('.text'); if (!textDiv) { textDiv = document.createElement('div'); textDiv.className = 'text'; row.querySelector('.bubble').insertBefore(textDiv, row.querySelector('.msg-footer')); } textDiv.innerHTML = `${formatText(data.text)} <small style="opacity:0.6;font-size:0.75rem;">(изм.)</small>`; } });
socket.on('msg_pinned', (data) => { if (selectedChatId === data.chatId) { document.getElementById('pinned-banner').classList.remove('hidden'); document.getElementById('pinned-text').textContent = data.text || 'Медиафайл'; } });
socket.on('msg_reaction_update', (data) => { const container = document.getElementById(`reactions-${data.id}`); if (container) container.innerHTML = generateReactionsHtml(data.id, data.reactions); });
socket.on('msg_views_update', (data) => { const el = document.getElementById(`views-${data.id}`); if (el) el.textContent = data.views; });
socket.on('chat_history', (data) => {
    let history, offset, isSearch; if (Array.isArray(data)) { history = data; offset = 0; isSearch = false; } else { history = data.history; offset = data.offset; isSearch = data.isSearch; }
    if (history.length < 40) hasMoreHistory = false;
    const oldScrollHeight = messagesDiv.scrollHeight;
    if (offset === 0 || isSearch) messagesDiv.innerHTML = '';
    if (offset === 0 || isSearch) { history.forEach(msg => renderMsg(msg, false)); messagesDiv.scrollTop = messagesDiv.scrollHeight; } else { for (let i = history.length - 1; i >= 0; i--) renderMsg(history[i], true); messagesDiv.scrollTop = messagesDiv.scrollHeight - oldScrollHeight; }
    isLoadingHistory = false;
});
socket.on('contact_toggled', (data) => { if (viewingUserProfile === data.username) updateProfileContactBtn(data.inContacts); socket.emit('get_my_chats'); if (!document.getElementById('tab-content-contacts').classList.contains('hidden')) renderContactsTab(); });
socket.on('block_toggled', (data) => { if (viewingUserProfile === data.username) updateProfileBlockBtn(data.isBlocked); if (selectedChatId === data.username) openChat(data.username); });
socket.on('group_created', (data) => { showToast(dict[currentLang].groupCreated); toggleCreateGroupModal(false); toggleCreateRaveModal(false); socket.emit('get_my_chats'); openChat(data.groupId); });
socket.on('group_updated', (data) => { if (selectedChatId === data.groupId) openChat(data.groupId); if (viewingUserProfile === data.groupId) viewUserProfile(data.groupId); updateContactsUI(data.groupId); });
socket.on('kicked_from_group', (data) => { showToast('Вы были исключены из чата'); if (selectedChatId === data.groupId) { document.getElementById('chat-ui').classList.add('hidden'); document.getElementById('welcome-screen').classList.remove('hidden'); } socket.emit('get_my_chats'); });

socket.on('my_chats_list', (chats) => {
    contactsDiv.querySelectorAll('.contact-item').forEach(e => e.remove());
    knownChatIds.clear();
    chats.forEach(chatId => { 
        if (!hiddenChats.has(chatId)) {
            knownChatIds.add(chatId); 
            updateContactsUI(chatId); 
        }
    });
});
socket.on('invite_link_generated', (data) => { showToast('Ссылка сгенерирована!'); viewUserProfile(data.groupId); });

// ==== РЕЗУЛЬТАТЫ ГЛОБАЛЬНОГО ПОИСКА (ДЛЯ ВСТРОЕННОГО ИНПУТА) ====
socket.on('search_results_v2', (data) => {
    let container = document.getElementById('search-results-container');
    if (!container) return;

    let html = '';
    if (!document.getElementById('search-style-inject')) {
        const s = document.createElement('style'); s.id = 'search-style-inject';
        s.innerHTML = `.search-section-title { padding: 10px 15px; font-size: 0.75rem; font-weight: bold; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; } .search-divider { height: 1px; background: var(--border); margin: 5px 15px; } #search-results-container { flex: 1; overflow-y: auto; padding-bottom: 80px; }`;
        document.head.appendChild(s);
    }

    if (data.query.length > 0) {
        html += '<div class="search-section-title">Контакты и Чаты</div>';
        if (data.exactMatches.length > 0) {
            data.exactMatches.forEach(item => {
                const avatarHtml = item.avatar ? `background-image: url(${item.avatar})` : `background-color: ${item.profileColor || 'var(--primary)'}`;
                const initial = !item.avatar ? (item.name || item.username)[0].toUpperCase() : '';
                html += `<div class="contact-item" onclick="openChatFromSearch('${item.username}')"><div class="avatar" style="${avatarHtml}; background-size: cover; background-position: center;">${initial}</div><div class="contact-info"><strong>${item.name || item.username}</strong><div class="contact-subtext">@${item.username}</div></div></div>`;
            });
        } else { html += '<div class="empty-state" style="padding: 20px;"><span>Пользователи не найдены</span></div>'; }
    }

    if (data.recommendations.length > 0) {
        if (data.query.length > 0) html += '<div class="search-divider"></div>';
        html += '<div class="search-section-title">Рекомендации для вас</div>';
        data.recommendations.forEach(item => {
            const avatarHtml = item.avatar ? `background-image: url(${item.avatar})` : `background-color: ${item.profileColor || 'var(--primary)'}`;
            const initial = !item.avatar ? (item.name || item.username)[0].toUpperCase() : '';
            html += `<div class="contact-item" onclick="openChatFromSearch('${item.username}')"><div class="avatar" style="${avatarHtml}; background-size: cover; background-position: center;">${initial}</div><div class="contact-info"><strong>${item.name || item.username}</strong><div class="contact-subtext">@${item.username}</div></div></div>`;
        });
    }
    
    container.innerHTML = `<div id="search-users-part">${html}</div><div id="search-msgs-part"></div>`;
});

socket.on('search_messages_global_results', (msgs) => {
    let container = document.getElementById('search-msgs-part');
    if (!container) {
        const mainCont = document.getElementById('search-results-container');
        if (mainCont) { container = document.createElement('div'); container.id = 'search-msgs-part'; mainCont.appendChild(container); } else return;
    }
    if (msgs.length === 0) return;
    let html = '<div class="search-divider"></div><div class="search-section-title">Сообщения</div>';
    msgs.forEach(msg => {
        html += `<div class="contact-item" onclick="openChatFromSearch('${msg.chatId}')" style="align-items: flex-start;"><div class="avatar" style="background: var(--bg-hover); color: var(--primary);"><i class="fas fa-comment-dots"></i></div><div class="contact-info"><strong style="font-size: 0.9rem;">${msg.chatName} <span style="font-size:0.75rem; color:var(--text-dim); margin-left:auto; font-weight:normal;">${msg.time}</span></strong><div class="contact-subtext" style="color: var(--text-main); white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"><span style="color:var(--primary); font-weight:bold;">${msg.from}:</span> ${msg.text}</div></div></div>`;
    });
    container.innerHTML = html;
});

window.openChatFromSearch = function(username) {
    const searchInput = document.getElementById('searchUser');
    if (searchInput) searchInput.value = '';
    const container = document.getElementById('search-results-container');
    if (container) container.classList.add('hidden');
    const mainList = document.querySelector('#tab-content-chats .contacts-list');
    if (mainList) mainList.classList.remove('hidden');
    document.getElementById('chat-folders-bar')?.classList.remove('hidden');
    
    knownChatIds.add(username);
    updateContactsUI(username);
    openChat(username);
};