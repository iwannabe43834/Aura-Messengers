// =========================================
//   AURA MESSENGER - UI.JS (FULL VERSION)
// =========================================
 
function changeLanguage(lang) {
    currentLang = lang; document.documentElement.setAttribute('data-lang', lang); localStorage.setItem('aura-lang', lang); applyTranslations();
}
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (dict[currentLang][key]) el.textContent = dict[currentLang][key]; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.getAttribute('data-i18n-placeholder'); if (dict[currentLang][key]) el.setAttribute('placeholder', dict[currentLang][key]); });
    if (selectedChatId) updateChatStatus(selectedChatId, isCurrentChatGroup);
}
function showToast(message) {
    const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${message}</span>`; c.appendChild(t); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}
function formatLastSeen(timestamp) {
    if (timestamp === 'blocked') return dict[currentLang].blockedStatus; if (!timestamp) return dict[currentLang].wasRecently;
    const date = new Date(timestamp); const now = new Date(); const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${dict[currentLang].wasToday} ${timeString}`; return `${dict[currentLang].wasAt} ${date.toLocaleDateString()} ${timeString}`;
}
function applySavedPreferences() {
    const theme = localStorage.getItem('aura-theme') || 'dark'; const pattern = localStorage.getItem('aura-pattern') || 'none'; const lang = localStorage.getItem('aura-lang') || 'ru'; const glass = localStorage.getItem('aura-glass') || 'off';
    changeTheme(theme); changePattern(pattern); changeLanguage(lang); changeGlassEffect(glass);
    const themeSel = document.getElementById('theme-select'); if (themeSel) themeSel.value = theme;
    const glassSel = document.getElementById('glass-select'); if (glassSel) glassSel.value = glass;
    if (currentUser && currentUser.profilePattern) { const patSel = document.getElementById('profile-pattern-select'); if (patSel) patSel.value = currentUser.profilePattern; }
}
function changeTheme(themeName) { document.documentElement.setAttribute('data-theme', themeName); localStorage.setItem('aura-theme', themeName); }
function changePattern(p) { document.getElementById('app-body').className = `pattern-${p}`; localStorage.setItem('aura-pattern', p); }
function changeGlassEffect(state) {
    if (state === 'on') { document.documentElement.setAttribute('data-glass', 'on'); document.getElementById('liquid-bg').classList.remove('hidden'); } 
    else { document.documentElement.removeAttribute('data-glass'); document.getElementById('liquid-bg').classList.add('hidden'); }
    localStorage.setItem('aura-glass', state);
}
async function changeProfilePattern(p) {
    document.getElementById('settings-cover-preview').className = `user-profile-preview pattern-${p}`;
    await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profilePattern: p }) });
    if (currentUser) currentUser.profilePattern = p;
}
function toggleSettings(show) { document.getElementById('settings-drawer').classList.toggle('active', show); }
function toggleProfileModal(show) {
    const modal = document.getElementById('profile-modal');
    if (show) { modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('show'), 10); } 
    else { modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); }
}
function closeProfile(e) { if (e.target.id === 'profile-modal') toggleProfileModal(false); }
function closeModalOnOuterClick(e, modalId) { if (e.target.id === modalId) { const modal = document.getElementById(modalId); modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); } }
function switchSettingsTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[onclick="switchSettingsTab('${tabId}')"]`); const content = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add('active'); if (content) content.classList.add('active');
}
function switchMobileTab(tabId, btnElement) {
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(b => b.classList.remove('active')); if (btnElement) btnElement.classList.add('active');
    document.getElementById('main-container').classList.remove('chat-open'); toggleSettings(false);
    if (tabId === 'settings') { toggleSettings(true); } 
    else {
        document.querySelectorAll('.mobile-tab-content').forEach(el => el.classList.add('hidden')); document.getElementById('tab-content-' + tabId).classList.remove('hidden');
        if (tabId === 'contacts') renderContactsTab(); if (tabId === 'calls') renderCallsTab();
    }
}
function renderContactsTab() {
    const container = document.getElementById('real-contacts-list'); container.innerHTML = ''; const myContacts = currentUser.contacts || [];
    if (myContacts.length === 0) { container.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><span>Здесь будут ваши контакты</span></div>`; return; }
    myContacts.forEach(c => { const username = typeof c === 'object' ? c.username : c; const name = typeof c === 'object' && c.customName ? c.customName : username; container.innerHTML += `<div class="contact-item" onclick="viewUserProfile('${username}')"><div class="avatar">${name[0].toUpperCase()}</div><div class="contact-info"><strong>${name}</strong><div class="contact-subtext">@${username}</div></div></div>`; });
}
function renderCallsTab() { document.getElementById('calls-list-container').innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><span>Загрузка...</span></div>`; socket.emit('get_call_history'); }
function updateHeaderUI() {
    const name = currentUser.name || currentUser.username;
    document.getElementById('settings-full-name').textContent = name; document.getElementById('settings-username-display').textContent = '@' + currentUser.username;
    const avatarEl = document.getElementById('user-avatar-main');
    if (currentUser.avatar) { avatarEl.style.backgroundImage = `url(${currentUser.avatar})`; avatarEl.textContent = ''; } 
    else { avatarEl.textContent = name[0].toUpperCase(); avatarEl.style.backgroundImage = 'none'; avatarEl.style.background = currentUser.profileColor || 'var(--primary)'; }
    document.getElementById('settings-cover-preview').className = `user-profile-preview pattern-${currentUser.profilePattern || 'none'}`;
    if (currentUser.profileBg) { document.getElementById('settings-cover-preview').style.backgroundImage = `url(${currentUser.profileBg})`; document.getElementById('settings-cover-preview').style.backgroundSize  = 'cover'; } 
    else { document.getElementById('settings-cover-preview').style.backgroundImage = ''; }
}
async function saveProfileGeneral() { const res = await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('edit-display-name').value, bio: document.getElementById('edit-bio').value, birthday: document.getElementById('edit-birthday').value, location: document.getElementById('edit-location').value, website: document.getElementById('edit-website').value }) }); if (res.ok) showToast('Профиль сохранен'); }
async function saveProfileAppearance() { const res = await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileColor: document.getElementById('edit-profile-color').value, emojiStatus: document.getElementById('edit-emoji-status').value }) }); if (res.ok) { if(currentUser) { currentUser.profileColor = document.getElementById('edit-profile-color').value; currentUser.emojiStatus = document.getElementById('edit-emoji-status').value; } updateHeaderUI(); showToast('Внешний вид профиля обновлен!'); } }
async function savePrivacySettings() { const res = await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ privacy: { calls: document.getElementById('priv-calls').value, online: document.getElementById('priv-online').value, groups: document.getElementById('priv-groups').value } }) }); if (res.ok) showToast('Настройки приватности сохранены!'); }
function uploadAvatar(input) {
    const file = input.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Img = e.target.result; const avatarEl = document.getElementById('user-avatar-main'); avatarEl.style.backgroundImage = `url(${base64Img})`; avatarEl.textContent = '';
        const res = await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: base64Img }) });
        if (res.ok) { if (currentUser) currentUser.avatar = base64Img; showToast(dict[currentLang].photoUpdated); }
    };
    reader.readAsDataURL(file);
}

// ==== АВТО-ЦВЕТ ПРОФИЛЯ ПО ОБЛОЖКЕ ====
function getAverageColor(base64Image, callback) {
    const img = new Image(); img.crossOrigin = "Anonymous";
    img.onload = function() {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        canvas.width = 50; canvas.height = 50; ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data; let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) { if (data[i+3] < 128) continue; r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        if(count === 0){ callback('#8774e1'); return; }
        r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
        callback("#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1));
    };
    img.src = base64Image;
}

function uploadProfileBg(input) {
    const file = input.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Img = e.target.result;
        const coverEl = document.getElementById('settings-cover-preview');
        coverEl.style.backgroundImage = `url(${base64Img})`; coverEl.style.backgroundSize = 'cover'; coverEl.style.backgroundPosition = 'center';
 
        getAverageColor(base64Img, async (detectedColor) => {
            document.getElementById('edit-profile-color').value = detectedColor;
            if (currentUser) { currentUser.profileBg = base64Img; currentUser.profileColor = detectedColor; }
            updateHeaderUI();
            const res = await fetch('/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileBg: base64Img, profileColor: detectedColor }) });
            if (res.ok) showToast('Обложка и цвет профиля обновлены!'); else showToast('Ошибка сохранения обложки');
        });
    };
    reader.readAsDataURL(file); input.value = '';
}

// ПРОСМОТР ПРОФИЛЯ И ГРУПП
async function viewUserProfile(chatId) {
    viewingUserProfile = chatId; const res = await fetch(`/api/entity/${chatId}`); const data = await res.json(); viewingEntityData = data;
    const emojiHtml = data.emojiStatus ? `<span class="emoji-status-badge">${data.emojiStatus}</span>` : '';
    document.getElementById('p-name').innerHTML = `${data.displayName || data.name || chatId} ${emojiHtml}`; document.getElementById('p-username').textContent = '@' + chatId;
    document.getElementById('p-bio').textContent = data.bio || data.description || dict[currentLang].notSpecified;
    document.getElementById('p-bio-label').textContent = (data.type === 'group' || data.type === 'channel' || data.type === 'rave') ? dict[currentLang].groupDesc : dict[currentLang].aboutMe;
    const pAvatar = document.getElementById('p-avatar');
    if (data.isBlocked) { pAvatar.style.backgroundImage = 'none'; pAvatar.style.background = 'var(--bg-hover)'; pAvatar.innerHTML = '<i class="fas fa-user-slash" style="color:var(--text-dim)"></i>'; } 
    else if (data.avatar) { pAvatar.style.backgroundImage = `url(${data.avatar})`; pAvatar.innerHTML = ''; } 
    else { pAvatar.style.backgroundImage = 'none'; pAvatar.style.background = data.profileColor || 'var(--primary)'; pAvatar.innerHTML = (data.displayName || data.name || chatId)[0].toUpperCase(); }
    document.getElementById('p-cover').className = `profile-cover pattern-${data.profilePattern || 'none'}`;
    if (data.profileBg) { document.getElementById('p-cover').style.backgroundImage = `url(${data.profileBg})`; document.getElementById('p-cover').style.backgroundSize = 'cover'; } else { document.getElementById('p-cover').style.backgroundImage = ''; }
    document.getElementById('p-btn-message').onclick = () => { toggleProfileModal(false); openChat(chatId); };
    const showField = (id, val) => { const el = document.getElementById(id); if (val) { el.classList.remove('hidden'); el.querySelector('.detail-value').textContent = val; if (id === 'p-row-website') el.querySelector('.detail-value').href = val.startsWith('http') ? val : 'https://' + val; } else { el.classList.add('hidden'); } };
    if (data.type === 'group' || data.type === 'channel' || data.type === 'rave') {
        const typeLabel = data.type === 'channel' ? dict[currentLang].typeChannel : (data.type === 'rave' ? 'Кинозал Rave' : dict[currentLang].typeGroup);
        document.getElementById('p-status').textContent = `${data.membersCount} ${dict[currentLang].membersCount.toLowerCase()} (${typeLabel})`;
        document.getElementById('p-row-birthday').classList.add('hidden'); showField('p-row-location', null); showField('p-row-website', null);
        document.getElementById('p-row-members').classList.remove('hidden'); document.getElementById('p-members-count').textContent = data.membersCount;
        if (data.myRole === 'creator' || data.myRole === 'admin') document.getElementById('p-btn-edit').classList.remove('hidden'); else document.getElementById('p-btn-edit').classList.add('hidden');
        const mList = document.getElementById('p-members-list'); mList.innerHTML = ''; mList.style.display = 'block';
        data.membersList.forEach(m => { const isMe = m.username === currentUser.username; let actions = ''; if ((data.myRole === 'creator' || data.myRole === 'admin') && !isMe && m.role !== 'creator') { actions = `<button class="danger-btn-small" onclick="kickMember('${data.id}','${m.username}')" style="margin-right:5px;">${dict[currentLang].kickBtn}</button>`; } const roleBadge = m.customTitle ? `<span style="background:var(--primary-soft);color:var(--primary);font-size:0.6rem;padding:2px 4px;border-radius:4px;">${m.customTitle}</span>` : ''; mList.innerHTML += `<div class="member-option" style="cursor:default"><div>${m.name} (@${m.username}) ${m.emojiStatus || ''} ${roleBadge}</div><div>${actions}</div></div>`; });
        if (data.myRole === 'creator' && !data.inviteHash) mList.innerHTML = `<button class="primary-btn-small" onclick="socket.emit('generate_invite_link',{groupId:'${data.id}'})" style="margin-bottom:10px;"><i class="fas fa-link"></i> Создать ссылку-приглашение</button>` + mList.innerHTML;
        if (data.inviteHash && data.myRole === 'creator') { const inviteLink = window.location.origin + '/join/' + data.inviteHash; mList.innerHTML = `<div style="background:var(--bg-hover);padding:10px;border-radius:12px;margin-bottom:15px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);"><div style="font-size:0.85rem;word-break:break-all;flex:1;"><span style="color:var(--text-dim);display:block;margin-bottom:4px;font-size:0.75rem;text-transform:uppercase;">Ссылка-приглашение:</span><b>${inviteLink}</b></div><button class="primary-btn-small" style="margin:0;width:44px;height:44px;flex-shrink:0;padding:0;display:flex;align-items:center;justify-content:center;border-radius:12px;" onclick="navigator.clipboard.writeText('${inviteLink}');showToast('Ссылка скопирована!');event.stopPropagation();"><i class="fas fa-copy"></i></button></div>` + mList.innerHTML; }
        document.getElementById('p-btn-contact').classList.add('hidden'); document.getElementById('p-btn-block').classList.add('hidden'); document.getElementById('p-btn-leave').classList.remove('hidden');
    } else {
        if (data.isBlocked) document.getElementById('p-status').textContent = dict[currentLang].blockedStatus; else if (data.isOnline) document.getElementById('p-status').textContent = dict[currentLang].online; else document.getElementById('p-status').textContent = formatLastSeen(data.lastSeen);
        document.getElementById('p-row-members').classList.add('hidden'); document.getElementById('p-members-list').style.display = 'none'; document.getElementById('p-btn-edit').classList.add('hidden');
        showField('p-row-birthday', data.birthday ? new Date(data.birthday).toLocaleDateString() : null); showField('p-row-location', data.location); showField('p-row-website',  data.website);
        document.getElementById('p-btn-contact').classList.remove('hidden'); document.getElementById('p-btn-block').classList.remove('hidden'); document.getElementById('p-btn-leave').classList.add('hidden');
        updateProfileContactBtn(data.inContacts); const myRes = await fetch('/my-full-profile'); const myData = await myRes.json(); updateProfileBlockBtn(myData.blocked && myData.blocked.includes(chatId));
    }
    toggleProfileModal(true);
}
function kickMember(groupId, userId) { if (confirm('Удалить пользователя из сообщества?')) socket.emit('kick_member', { groupId, userId }); }
function toggleContact() { if (!viewingUserProfile || (viewingEntityData && viewingEntityData.type !== 'user')) return; const isContact = document.getElementById('p-icon-contact').className.includes('user-minus'); if (isContact) { socket.emit('toggle_contact', { username: viewingUserProfile, remove: true }); } else { document.getElementById('contact-custom-name').value = document.getElementById('p-name').textContent; const m = document.getElementById('custom-contact-modal'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('show'), 10); } }
function saveContact() { socket.emit('toggle_contact', { username: viewingUserProfile, customName: document.getElementById('contact-custom-name').value.trim() }); closeModalOnOuterClick({ target: { id: 'custom-contact-modal' } }, 'custom-contact-modal'); }
function toggleBlock() { if (viewingUserProfile && viewingEntityData && viewingEntityData.type === 'user') socket.emit('toggle_block', { username: viewingUserProfile }); }
function leaveGroup() { if (viewingUserProfile && viewingEntityData && viewingEntityData.type !== 'user') { if (confirm('Вы уверены, что хотите покинуть?')) { socket.emit('leave_group', { groupId: viewingUserProfile }); toggleProfileModal(false); if (selectedChatId === viewingUserProfile) { document.getElementById('chat-ui').classList.add('hidden'); document.getElementById('welcome-screen').classList.remove('hidden'); } } } }
function updateProfileContactBtn(inContacts) { const icon = document.getElementById('p-icon-contact'); const text = document.getElementById('p-text-contact'); if (inContacts) { icon.className = 'fas fa-user-minus'; text.textContent = dict[currentLang].removeContact; } else { icon.className = 'fas fa-user-plus'; text.textContent = dict[currentLang].addContact; } }
function updateProfileBlockBtn(isBlocked) { const icon = document.querySelector('#p-btn-block i'); const text = document.getElementById('p-text-block'); const btn  = document.getElementById('p-btn-block'); if (isBlocked) { icon.className = 'fas fa-unlock'; text.textContent = dict[currentLang].unblockUser; btn.classList.remove('block-btn'); btn.style.color = '#4CAF50'; } else { icon.className = 'fas fa-ban'; text.textContent = dict[currentLang].blockUser; btn.classList.add('block-btn'); btn.style.color = '#ff3b30'; } }

async function toggleCreateGroupModal(show, editMode = false) {
    const modal = document.getElementById('create-group-modal');
    if (show) {
        editModeGroupId = editMode ? viewingEntityData.id : null; document.getElementById('modal-group-title').textContent = editMode ? 'Редактировать' : dict[currentLang].createGroup; document.getElementById('submit-group-btn').textContent = editMode ? dict[currentLang].saveBtn : dict[currentLang].createGroupBtn;
        if (editMode) { document.getElementById('group-type-selector').style.display = 'none'; document.getElementById('group-id-wrapper').style.display = 'none'; document.getElementById('group-members-wrapper').style.display = 'none'; document.getElementById('group-name-input').value = viewingEntityData.name; document.getElementById('group-desc-input').value = viewingEntityData.description; currentGroupAvatarBase64 = viewingEntityData.avatar; currentGroupBgBase64 = viewingEntityData.profileBg; document.getElementById('group-color-input').value = viewingEntityData.profileColor || '#8774e1'; document.getElementById('group-avatar-preview').style.backgroundImage = currentGroupAvatarBase64 ? `url(${currentGroupAvatarBase64})` : 'none'; document.getElementById('group-bg-preview').style.backgroundImage = currentGroupBgBase64 ? `url(${currentGroupBgBase64})` : 'none'; document.getElementById('group-bg-preview').style.backgroundSize = 'cover'; } 
        else { document.getElementById('group-type-selector').style.display = 'flex'; document.getElementById('group-id-wrapper').style.display = 'flex'; document.getElementById('group-members-wrapper').style.display = 'flex'; document.getElementById('group-id-input').value = ''; document.getElementById('group-name-input').value = ''; document.getElementById('group-desc-input').value = ''; document.getElementById('group-color-input').value = '#8774e1'; document.getElementById('group-avatar-preview').style.backgroundImage = 'none'; document.getElementById('group-bg-preview').style.backgroundImage = 'none'; currentGroupAvatarBase64 = null; currentGroupBgBase64 = null; const list = document.getElementById('group-members-list'); list.innerHTML = ''; const res = await fetch('/my-full-profile'); const data = await res.json(); if (data.contacts && data.contacts.length > 0) { for (const contact of data.contacts) { const cUsername = typeof contact === 'object' ? contact.username : contact; const cName = typeof contact === 'object' && contact.customName ? contact.customName : cUsername; list.innerHTML += `<label class="member-option"><span>${cName} (@${cUsername})</span><input type="checkbox" value="${cUsername}"></label>`; } } else { list.innerHTML = `<div style="padding:10px;color:var(--text-dim);font-size:0.85rem;">Нет контактов для добавления</div>`; } }
        modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('show'), 10);
    } else { modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); }
}
async function toggleCreateRaveModal(show) {
    const modal = document.getElementById('create-rave-modal');
    if (show) { document.getElementById('rave-id-input').value = ''; document.getElementById('rave-name-input').value = ''; document.getElementById('rave-avatar-preview').style.backgroundImage = 'none'; document.getElementById('rave-bg-preview').style.backgroundImage = 'none'; currentGroupAvatarBase64 = null; currentGroupBgBase64 = null; const list = document.getElementById('rave-members-list'); list.innerHTML = ''; const res = await fetch('/my-full-profile'); const data = await res.json(); if (data.contacts && data.contacts.length > 0) { for (const contact of data.contacts) { const cUsername = typeof contact === 'object' ? contact.username : contact; const cName = typeof contact === 'object' && contact.customName ? contact.customName : cUsername; list.innerHTML += `<label class="member-option"><span>${cName} (@${cUsername})</span><input type="checkbox" value="${cUsername}"></label>`; } } else { list.innerHTML = `<div style="padding:10px;color:var(--text-dim);font-size:0.85rem;">Нет контактов для добавления</div>`; } modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('show'), 10); } 
    else { modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); }
}
function openEditGroupModal() { toggleCreateGroupModal(true, true); }
function previewGroupAvatar(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { currentGroupAvatarBase64 = e.target.result; document.getElementById('group-avatar-preview').style.backgroundImage = `url(${currentGroupAvatarBase64})`; }; reader.readAsDataURL(file); }
function previewGroupBg(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { currentGroupBgBase64 = e.target.result; document.getElementById('group-bg-preview').style.backgroundImage = `url(${currentGroupBgBase64})`; document.getElementById('group-bg-preview').style.backgroundSize = 'cover'; }; reader.readAsDataURL(file); }
function previewRaveAvatar(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { currentGroupAvatarBase64 = e.target.result; document.getElementById('rave-avatar-preview').style.backgroundImage = `url(${currentGroupAvatarBase64})`; }; reader.readAsDataURL(file); }
function previewRaveBg(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { currentGroupBgBase64 = e.target.result; document.getElementById('rave-bg-preview').style.backgroundImage = `url(${currentGroupBgBase64})`; document.getElementById('rave-bg-preview').style.backgroundSize = 'cover'; }; reader.readAsDataURL(file); }
function submitCreateGroup() {
    const name = document.getElementById('group-name-input').value.trim(); const desc = document.getElementById('group-desc-input').value.trim(); const color = document.getElementById('group-color-input').value;
    if (editModeGroupId) { if (!name) return showToast('Укажите название'); socket.emit('update_group_info', { id: editModeGroupId, name, description: desc, avatar: currentGroupAvatarBase64, profileBg: currentGroupBgBase64, profileColor: color }); toggleCreateGroupModal(false); showToast('Изменения сохранены'); return; }
    const id = document.getElementById('group-id-input').value.trim(); const type = document.querySelector('input[name="chat-type"]:checked').value; if (!id || !name) return showToast('Укажите ID и Название');
    const checkboxes = document.querySelectorAll('#group-members-list input[type="checkbox"]:checked'); const members = Array.from(checkboxes).map(cb => cb.value);
    if (type === 'rave' && members.length > 9) return showToast('Максимум 10 участников в кинозале (включая вас)'); else if (members.length > 99) return showToast('Максимум 99 участников (плюс вы)');
    socket.emit('create_group', { id, type, name, description: desc, avatar: currentGroupAvatarBase64, profileBg: currentGroupBgBase64, profileColor: color, members });
}
function submitCreateRave() {
    const id = document.getElementById('rave-id-input').value.trim(); const name = document.getElementById('rave-name-input').value.trim(); if (!id || !name) return showToast('Укажите ID и Название');
    const checkboxes = document.querySelectorAll('#rave-members-list input[type="checkbox"]:checked'); const members = Array.from(checkboxes).map(cb => cb.value); if (members.length > 9) return showToast('Максимум 10 участников в кинозале (включая вас)');
    socket.emit('create_group', { id, type: 'rave', name, description: 'Кинозал Rave', avatar: currentGroupAvatarBase64, profileBg: currentGroupBgBase64, profileColor: '#ff0054', members }); toggleCreateRaveModal(false);
}