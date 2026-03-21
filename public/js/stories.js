// =========================================
//   AURA MESSENGER - STORIES.JS (FULL)
// =========================================
let storiesData = [];
let currentStoryViewerIndex = 0;
let viewingStoriesList = [];
let storyTimeoutId = null;

function uploadStoryFile(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const type = file.type.startsWith('video') ? 'video' : 'image';
        socket.emit('upload_story', { mediaData: e.target.result, mediaType: type });
        showToast("История загружается...");
    };
    reader.readAsDataURL(file); input.value = '';
}

socket.on('stories_data', (data) => { storiesData = data; renderStories(); });
socket.on('new_story', (story) => { storiesData.push(story); renderStories(); });
socket.on('story_deleted', (data) => {
    storiesData = storiesData.filter(s => s.id !== data.id); renderStories();
    if (viewingStoriesList.length > 0 && viewingStoriesList[currentStoryViewerIndex] && viewingStoriesList[currentStoryViewerIndex].id === data.id) closeStory(true);
});

socket.on('story_viewed', (data) => {
    const s = storiesData.find(x => x.id === data.id);
    if (s && !s.views.includes(data.viewer)) {
        s.views.push(data.viewer);
        if (viewingStoriesList[currentStoryViewerIndex] && viewingStoriesList[currentStoryViewerIndex].id === data.id) renderStoryFooter(s);
    }
});

socket.on('story_reaction_received', (data) => {
    const s = storiesData.find(x => x.id === data.id);
    if (s) {
        if(!s.reactions) s.reactions = {}; s.reactions[data.from] = data.emoji;
        if (viewingStoriesList[currentStoryViewerIndex] && viewingStoriesList[currentStoryViewerIndex].id === data.id) renderStoryFooter(s);
    }
});

function renderStories() {
    const container = document.getElementById('stories-container');
    container.innerHTML = '';
    const myAddBtn = document.createElement('div');
    myAddBtn.className = 'story-item';
    myAddBtn.innerHTML = `<div class="story-avatar" style="border-color: var(--text-dim); border-style: dashed; cursor: pointer;" onclick="document.getElementById('story-upload-input').click()"><i class="fas fa-plus"></i></div><span>Моя история</span>`;
    container.appendChild(myAddBtn);

    const grouped = {};
    storiesData.forEach(s => { if (!grouped[s.username]) grouped[s.username] = []; grouped[s.username].push(s); });
    const sortedUsernames = Object.keys(grouped).sort((a, b) => { if (a === currentUser.username) return -1; if (b === currentUser.username) return 1; return 0; });

    sortedUsernames.forEach(uname => {
        const sList = grouped[uname]; const latest = sList[sList.length - 1]; const color = latest.profileColor || 'var(--primary)';
        const el = document.createElement('div'); el.className = 'story-item';
        let bgHtml = latest.userAvatar ? `background-image: url(${latest.userAvatar});` : `background: var(--bg-hover);`;
        el.innerHTML = `<div class="story-avatar" style="border-color: ${color}; ${bgHtml}">${!latest.userAvatar ? uname[0].toUpperCase() : ''}</div><span>${uname}</span>`;
        el.onclick = () => openStoryViewer(sList);
        container.appendChild(el);
    });

    // ===== Рендер мини-историй в шапку =====
    const headerTop = document.querySelector('.header-top');
    const h2Title = headerTop.querySelector('h2');
    if (h2Title && !document.getElementById('mini-stories')) {
        const miniDiv = document.createElement('div');
        miniDiv.id = 'mini-stories'; miniDiv.className = 'mini-stories';
        h2Title.insertAdjacentElement('afterend', miniDiv);
    }
    const miniContainer = document.getElementById('mini-stories');
    if (miniContainer) {
        miniContainer.innerHTML = '';
        const previewStories = sortedUsernames.slice(0, 4);
        previewStories.forEach((uname, index) => {
            const sList = grouped[uname]; const latest = sList[sList.length - 1];
            const bgHtml = latest.userAvatar ? `background-image: url(${latest.userAvatar});` : `background: ${latest.profileColor || 'var(--primary)'};`;
            const text = !latest.userAvatar ? uname[0].toUpperCase() : '';
            miniContainer.innerHTML += `<div class="mini-story-avatar" style="${bgHtml} z-index: ${10 - index};">${text}</div>`;
        });
        if (sortedUsernames.length > 0) {
            miniContainer.onclick = () => {
                const contactsList = document.querySelector('#tab-content-chats .contacts-list');
                if (contactsList) contactsList.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    }
}

function openStoryViewer(sList) { viewingStoriesList = sList; currentStoryViewerIndex = 0; document.getElementById('story-viewer-overlay').classList.add('active'); showCurrentStory(); }
function showCurrentStory() {
    clearTimeout(storyTimeoutId); if (currentStoryViewerIndex >= viewingStoriesList.length) { closeStory(true); return; }
    const story = viewingStoriesList[currentStoryViewerIndex];
    if (story.username !== currentUser.username) socket.emit('view_story', { id: story.id });
    
    document.getElementById('story-viewer-name').textContent = story.username; document.getElementById('story-viewer-time').textContent = new Date(story.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const avImg = document.getElementById('story-viewer-avatar'); const avTxt = document.getElementById('story-viewer-avatar-text');
    if (story.userAvatar) { avImg.src = story.userAvatar; avImg.style.display = 'block'; avTxt.style.display = 'none'; } else { avImg.style.display = 'none'; avTxt.textContent = story.username[0].toUpperCase(); avTxt.style.background = story.profileColor || 'var(--primary)'; avTxt.style.display = 'flex'; }

    const imgEl = document.getElementById('story-viewer-img'); const vidEl = document.getElementById('story-viewer-vid'); const progressFill = document.getElementById('story-progress-fill');
    imgEl.classList.add('hidden'); vidEl.classList.add('hidden'); document.getElementById('story-delete-btn').classList.toggle('hidden', story.username !== currentUser.username);
    renderStoryFooter(story); progressFill.style.transition = 'none'; progressFill.style.width = '0%';
    
    setTimeout(() => {
        let duration = 5000;
        if (story.type === 'video') { vidEl.src = story.media; vidEl.classList.remove('hidden'); vidEl.onloadedmetadata = () => { duration = vidEl.duration * 1000; startProgress(duration); }; } 
        else { imgEl.src = story.media; imgEl.classList.remove('hidden'); startProgress(duration); }
    }, 50);
}

function renderStoryFooter(story) {
    const reactionsBar = document.getElementById('story-reactions-bar'); const viewsBar = document.getElementById('story-views-bar'); const viewsList = document.getElementById('story-views-list');
    if (story.username === currentUser.username) {
        reactionsBar.classList.add('hidden'); viewsBar.classList.remove('hidden');
        const viewsArray = story.views || []; const reactsObj = story.reactions || {}; document.getElementById('story-views-count').textContent = viewsArray.length;
        let listHtml = '';
        viewsArray.forEach(v => { let reactEmoji = reactsObj[v] ? `<span style="font-size:1.2rem;">${reactsObj[v]}</span>` : ''; listHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;"><span>@${v}</span> ${reactEmoji}</div>`; });
        viewsList.innerHTML = viewsArray.length === 0 ? '<div style="opacity:0.5;">Нет просмотров</div>' : listHtml;
    } else { reactionsBar.classList.remove('hidden'); viewsBar.classList.add('hidden'); }
}
function reactToStory(emoji) { const story = viewingStoriesList[currentStoryViewerIndex]; if (story) { socket.emit('react_story', { id: story.id, emoji: emoji }); showToast("Реакция отправлена!"); } }
function startProgress(duration) { const progressFill = document.getElementById('story-progress-fill'); setTimeout(() => { progressFill.style.transition = `width ${duration}ms linear`; progressFill.style.width = '100%'; }, 50); storyTimeoutId = setTimeout(() => { currentStoryViewerIndex++; showCurrentStory(); }, duration); }
function closeStory(force = false, e = null) { if (e && e.target.id !== 'story-viewer-overlay') return; clearTimeout(storyTimeoutId); document.getElementById('story-viewer-overlay').classList.remove('active'); document.getElementById('story-viewer-vid').pause(); }
function deleteCurrentStory() { if (viewingStoriesList[currentStoryViewerIndex] && confirm("Удалить историю?")) { socket.emit('delete_story', { id: viewingStoriesList[currentStoryViewerIndex].id }); } }

// ==== СВОРАЧИВАНИЕ ИСТОРИЙ ПРИ СКРОЛЛЕ ====
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const contactsList = document.querySelector('#tab-content-chats .contacts-list');
        const storiesContainer = document.getElementById('stories-container');
        const miniStories = document.getElementById('mini-stories');
        
        if (contactsList && storiesContainer) {
            contactsList.addEventListener('scroll', () => {
                if (contactsList.scrollTop > 20) {
                    storiesContainer.classList.add('collapsed');
                    if(miniStories) miniStories.classList.add('visible');
                } else if (contactsList.scrollTop === 0) {
                    storiesContainer.classList.remove('collapsed');
                    if(miniStories) miniStories.classList.remove('visible');
                }
            });
        }
    }, 1000);
});