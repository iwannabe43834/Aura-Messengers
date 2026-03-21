// =========================================
//   AURA MESSENGER - RAVE.JS (TABS + MINIMIZE)
// =========================================
let currentRaveState = null;
let viewerHasInteracted = false;
let localPlayerTime = 0; 
let raveSearchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Создаем модальное окно поиска с ВКЛАДКАМИ
    if (!document.getElementById('rave-search-modal')) {
        const modal = document.createElement('div');
        modal.id = 'rave-search-modal';
        modal.className = 'modal hidden';
        modal.style.zIndex = '3500';
        modal.onclick = (e) => { if (e.target === modal) closeRaveModal(); };
        
        modal.innerHTML = `
            <div class="rave-modal-content">
                <div class="rave-modal-header">
                    <button class="fwd-close-btn" onclick="closeRaveModal()"><i class="fas fa-times"></i></button>
                    <h3>Видео для Кинозала</h3>
                    <div style="width: 32px;"></div>
                </div>
                
                <div class="rave-modal-tabs">
                    <button class="rave-tab active" onclick="switchRaveTab('search')">Поиск видео</button>
                    <button class="rave-tab" onclick="switchRaveTab('link')">По ссылке</button>
                </div>

                <div class="rave-modal-tools" id="rave-tab-search">
                    <select id="modal-rave-source-search">
                        <option value="youtube">YouTube</option>
                        <option value="vk">VK Видео</option>
                        <option value="rutube">RuTube</option>
                    </select>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="modal-rave-input-search" placeholder="Введите название..." style="flex: 1;" onkeypress="if(event.key === 'Enter') executeRaveSearch()">
                        <button onclick="executeRaveSearch()" class="primary-btn-small" style="margin: 0; width: auto; padding: 0 20px; border-radius: 12px;"><i class="fas fa-search"></i></button>
                    </div>
                </div>

                <div class="rave-modal-tools hidden" id="rave-tab-link">
                    <select id="modal-rave-source-link">
                        <option value="youtube">YouTube</option>
                        <option value="vk">VK Видео</option>
                        <option value="rutube">RuTube</option>
                        <option value="twitch">Twitch</option>
                        <option value="vimeo">Vimeo</option>
                        <option value="direct">Прямая ссылка (.mp4)</option>
                    </select>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="modal-rave-input-link" placeholder="Вставьте ссылку (http...)" style="flex: 1;" onkeypress="if(event.key === 'Enter') executeRaveLink()">
                        <button onclick="executeRaveLink()" class="primary-btn-small" style="margin: 0; width: auto; padding: 0 20px; border-radius: 12px;"><i class="fas fa-play"></i></button>
                    </div>
                </div>

                <div id="modal-rave-results" class="rave-search-results">
                    <div style="text-align:center; padding:40px 20px; color:var(--text-dim); opacity: 0.6;">
                        <i class="fas fa-film fa-3x" style="margin-bottom: 15px;"></i>
                        <p>Выберите способ добавления видео</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 2. Внедряем кнопки управления для хоста
    const controls = document.querySelector('.rave-playback-controls');
    if (controls && !document.getElementById('btn-rave-rw')) {
        controls.innerHTML = `
            <button onclick="raveHostAction('rw')" id="btn-rave-rw" class="rave-ctrl-btn" title="-10 сек"><i class="fas fa-backward"></i></button>
            <button onclick="raveHostAction('play')" class="rave-ctrl-btn" title="Пауза"><i class="fas fa-play"></i></button>
            <button onclick="raveHostAction('pause')" class="rave-ctrl-btn" title="Плей"><i class="fas fa-pause"></i></button>
            <button onclick="raveHostAction('ff')" id="btn-rave-ff" class="rave-ctrl-btn" title="+10 сек"><i class="fas fa-forward"></i></button>
            <button onclick="raveHostAction('sync')" class="rave-ctrl-btn sync"><i class="fas fa-sync"></i> Синхрон</button>
        `;
    }

    // 3. Внедряем кнопку СВОРАЧИВАНИЯ плеера
    setTimeout(() => {
        const wrapper = document.getElementById('rave-video-wrapper');
        const container = document.getElementById('rave-container');
        
        if (wrapper && !document.getElementById('btn-minimize-rave')) {
            const minBtn = document.createElement('button');
            minBtn.id = 'btn-minimize-rave';
            minBtn.className = 'btn-minimize-rave';
            minBtn.innerHTML = '<i class="fas fa-compress-alt"></i>';
            minBtn.onclick = () => container.classList.add('rave-minimized');
            wrapper.appendChild(minBtn);
        }

        if (container && !document.getElementById('rave-minimized-bar')) {
            const minBar = document.createElement('div');
            minBar.id = 'rave-minimized-bar';
            minBar.className = 'rave-minimized-bar';
            minBar.innerHTML = '<div><i class="fas fa-film"></i> Кинозал активен</div> <i class="fas fa-expand-arrows-alt"></i>';
            minBar.onclick = () => container.classList.remove('rave-minimized');
            container.insertBefore(minBar, container.firstChild);
        }
    }, 500);
});

// ==== ЛОГИКА ВКЛАДОК И ВЫБОРА ====
window.switchRaveTab = function(tab) {
    document.querySelectorAll('.rave-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.rave-tab[onclick="switchRaveTab('${tab}')"]`).classList.add('active');
    
    document.getElementById('rave-tab-search').classList.add('hidden');
    document.getElementById('rave-tab-link').classList.add('hidden');
    document.getElementById(`rave-tab-${tab}`).classList.remove('hidden');
    
    document.getElementById('modal-rave-results').innerHTML = '<div style="text-align:center; padding:40px 20px; color:var(--text-dim); opacity: 0.6;"><i class="fas fa-film fa-3x" style="margin-bottom: 15px;"></i><p>Выберите способ добавления видео</p></div>';
};

window.executeRaveSearch = function() {
    const query = document.getElementById('modal-rave-input-search').value.trim();
    const platform = document.getElementById('modal-rave-source-search').value;
    const resultsContainer = document.getElementById('modal-rave-results');
    
    if (!query) return;

    resultsContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim);"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:15px;">Ищем видео...</p></div>';
    
    clearTimeout(raveSearchTimeout);
    raveSearchTimeout = setTimeout(() => {
        if (resultsContainer.innerHTML.includes('Ищем видео')) {
            resultsContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#ff3b30;"><i class="fas fa-exclamation-triangle fa-2x"></i><p style="margin-top:15px;">Сервер не отвечает или ничего не найдено.</p></div>';
        }
    }, 10000);

    socket.emit('rave_search_video', { platform: platform, query: query });
};

window.executeRaveLink = function() {
    const url = document.getElementById('modal-rave-input-link').value.trim();
    const platform = document.getElementById('modal-rave-source-link').value;
    
    if (!url) return;
    if (!url.startsWith('http')) {
        showToast('Пожалуйста, вставьте корректную ссылку (с http:// или https://)');
        return;
    }
    setRaveVideoDirectModal(url, platform);
};


function joinRaveSync() {
    viewerHasInteracted = true;
    document.getElementById('rave-viewer-overlay').classList.add('hidden');
    if (currentRaveState) {
        const vidIframe = document.getElementById('rave-iframe-container');
        vidIframe.innerHTML = ''; 
        applyRaveState(currentRaveState);
    }
}

function toggleRavePanel() {
    document.getElementById('rave-search-modal').classList.remove('hidden');
    document.getElementById('modal-rave-input-search').focus();
}
function closeRaveModal() {
    document.getElementById('rave-search-modal').classList.add('hidden');
}

socket.on('rave_search_results', (data) => {
    clearTimeout(raveSearchTimeout);
    const container = document.getElementById('modal-rave-results');
    if (!container) return;
    
    container.innerHTML = '';
    if (!data.results || data.results.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim);"><i class="fas fa-search-minus fa-2x"></i><p style="margin-top:15px;">По вашему запросу ничего не найдено</p></div>';
        return;
    }

    let html = '';
    data.results.forEach(v => {
        let embedUrl = data.platform === 'youtube' ? `https://www.youtube.com/embed/${v.id}?autoplay=1&enablejsapi=1` : v.url;
        html += `
            <div class="rave-search-card" onclick="setRaveVideoDirectModal('${embedUrl}', '${data.platform}')">
                <div class="rave-search-thumb">
                    <img src="${v.thumbnail}" alt="Thumbnail">
                    <span class="rave-search-duration">${v.duration}</span>
                </div>
                <div class="rave-search-info">
                    <div class="rave-search-title">${v.title}</div>
                    <div class="rave-search-author">${v.author}</div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
});

function setRaveVideoDirectModal(url, typeSelect) {
    let videoType = 'direct';
    let finalUrl = url;
    
    if (typeSelect === 'youtube') {
        videoType = 'youtube';
        if (url.includes('<iframe') && url.includes('src="')) {
            const match = url.match(/src="([^"]+)"/);
            if (match && match[1]) finalUrl = match[1];
        } else {
            try {
                const videoId = url.includes('youtu.be/') ? url.split('youtu.be/')[1].split('?')[0] : new URLSearchParams(new URL(url).search).get('v');
                if (videoId) finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
            } catch(e) {}
        }
    } else if (typeSelect === 'vk') {
        videoType = 'vk';
        if (url.includes('<iframe') && url.includes('src="')) {
            const match = url.match(/src="([^"]+)"/);
            if (match && match[1]) finalUrl = match[1];
        } else if (!url.includes('video_ext.php')) {
            showToast('Для ВК нужна ссылка для встраивания iframe'); return;
        }
    } else if (typeSelect === 'rutube') {
        videoType = 'rutube';
        if (url.includes('<iframe') && url.includes('src="')) {
            const match = url.match(/src="([^"]+)"/);
            if (match && match[1]) finalUrl = match[1];
        } else if (url.includes('rutube.ru/video/')) {
            const match = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/);
            if (match && match[1]) finalUrl = `https://rutube.ru/play/embed/${match[1]}`;
        }
    } else if (typeSelect === 'twitch') {
        videoType = 'twitch';
        let channel = url.includes('twitch.tv/') ? url.split('twitch.tv/')[1].split('?')[0] : url;
        if (channel) finalUrl = `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
    } else if (typeSelect === 'vimeo') {
        videoType = 'vimeo';
        let vidId = url.includes('vimeo.com/') ? url.split('vimeo.com/')[1].split('?')[0] : url;
        if (vidId) finalUrl = `https://player.vimeo.com/video/${vidId}?api=1`;
    }
    
    socket.emit('rave_update_state', { action: 'set_video', groupId: selectedChatId, videoUrl: finalUrl, videoType: videoType });
    document.getElementById('modal-rave-input-search').value = '';
    document.getElementById('modal-rave-input-link').value = '';
    closeRaveModal();
}

function raveHostAction(action) {
    if (!currentRaveState || currentRaveState.host !== currentUser.username) return;
    
    if (action === 'sync') {
        socket.emit('rave_update_state', { action: 'seek', groupId: selectedChatId, currentTime: localPlayerTime });
        showToast("Синхронизация отправлена зрителям!");
        return;
    }
    
    if (action === 'rw') {
        localPlayerTime = Math.max(0, localPlayerTime - 10);
        socket.emit('rave_update_state', { action: 'seek', groupId: selectedChatId, currentTime: localPlayerTime });
        return;
    }
    if (action === 'ff') {
        localPlayerTime += 10;
        socket.emit('rave_update_state', { action: 'seek', groupId: selectedChatId, currentTime: localPlayerTime });
        return;
    }

    socket.emit('rave_update_state', { action: action, groupId: selectedChatId, currentTime: localPlayerTime });
}

function applyRaveState(state) {
    if (!state) return;
    currentRaveState = state;
    
    const vidHtml = document.getElementById('rave-html-player');
    const vidIframe = document.getElementById('rave-iframe-container');
    const placeholder = document.getElementById('rave-placeholder');
    const raveContainer = document.getElementById('rave-container');
    const viewerOverlay = document.getElementById('rave-viewer-overlay');
    
    if (state.host === currentUser.username) {
        document.getElementById('rave-host-controls').classList.remove('hidden');
        raveContainer.classList.remove('is-viewer');
        if(viewerOverlay) viewerOverlay.classList.add('hidden');
        vidIframe.style.pointerEvents = 'auto';
    } else {
        document.getElementById('rave-host-controls').classList.add('hidden');
        raveContainer.classList.add('is-viewer');
        vidIframe.style.pointerEvents = 'none'; 
        
        if (!viewerHasInteracted && state.videoUrl) {
            if(viewerOverlay) viewerOverlay.classList.remove('hidden'); return;
        } else {
            if(viewerOverlay) viewerOverlay.classList.add('hidden');
        }
    }

    if (!state.videoUrl) {
        vidHtml.classList.add('hidden'); vidIframe.classList.add('hidden'); placeholder.classList.remove('hidden'); return;
    }

    placeholder.classList.add('hidden');

    if (state.videoType === 'direct' || state.videoUrl.endsWith('.mp4')) {
        vidIframe.classList.add('hidden'); vidHtml.classList.remove('hidden');
        if (state.host === currentUser.username) { vidHtml.setAttribute('controls', 'controls'); vidHtml.style.pointerEvents = 'auto'; } 
        else { vidHtml.removeAttribute('controls'); vidHtml.style.pointerEvents = 'none'; }
        
        if (vidHtml.src !== state.videoUrl) vidHtml.src = state.videoUrl;
        if (Math.abs(vidHtml.currentTime - state.currentTime) > 1.5) vidHtml.currentTime = state.currentTime;
        if (state.isPlaying && vidHtml.paused) vidHtml.play().catch(()=>{}); 
        else if (!state.isPlaying && !vidHtml.paused) vidHtml.pause();
    } else {
        vidHtml.classList.add('hidden'); vidIframe.classList.remove('hidden');
        let finalIframeUrl = state.videoUrl;
        
        if (state.videoType === 'vk' && !finalIframeUrl.includes('js_api=1')) finalIframeUrl += finalIframeUrl.includes('?') ? '&js_api=1' : '?js_api=1';
        if (state.videoType === 'youtube' && !finalIframeUrl.includes('enablejsapi=1')) finalIframeUrl += finalIframeUrl.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1';

        let iframe = vidIframe.querySelector('iframe');
        if (!iframe || iframe.getAttribute('data-raw-src') !== state.videoUrl) {
            let startUrl = finalIframeUrl;
            if (state.videoType === 'vk') { startUrl += '&autoplay=1'; if (state.currentTime > 0) startUrl += '&t=' + Math.floor(state.currentTime); } 
            else if (state.videoType === 'rutube') { startUrl += '&autoPlay=1'; if (state.currentTime > 0) startUrl += '&t=' + Math.floor(state.currentTime); } 
            else if (state.videoType === 'youtube') { startUrl += '&autoplay=1'; if (state.currentTime > 0) startUrl += '&start=' + Math.floor(state.currentTime); }
            else if (state.videoType === 'twitch') { startUrl += '&autoplay=true'; }
            else if (state.videoType === 'vimeo') { startUrl += '&autoplay=1'; if (state.currentTime > 0) startUrl += '#t=' + Math.floor(state.currentTime) + 's'; }

            vidIframe.innerHTML = `<iframe data-raw-src="${state.videoUrl}" src="${startUrl}" frameborder="0" allow="autoplay; fullscreen" style="width:100%; height:100%; border:none; pointer-events: inherit;"></iframe>`;
        } else {
            if (iframe.contentWindow && (state.host === currentUser.username || viewerHasInteracted)) {
                let timeDiff = Math.abs(localPlayerTime - state.currentTime);
                let needsSeek = timeDiff > 2.5; 

                try {
                    if (state.videoType === 'youtube') {
                        if (needsSeek) iframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'seekTo', args: [state.currentTime, true]}), '*');
                        const func = state.isPlaying ? 'playVideo' : 'pauseVideo';
                        iframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: func, args: []}), '*');
                    } else if (state.videoType === 'vk') {
                        if (needsSeek) iframe.contentWindow.postMessage(JSON.stringify({method: 'seek', args: [state.currentTime]}), '*');
                        const cmd = state.isPlaying ? 'play' : 'pause';
                        iframe.contentWindow.postMessage(JSON.stringify({method: cmd}), '*');
                    } else if (state.videoType === 'rutube') {
                        if (needsSeek) iframe.contentWindow.postMessage(JSON.stringify({type: 'player:setCurrentTime', data: {time: state.currentTime}}), '*');
                        const type = state.isPlaying ? 'player:play' : 'player:pause';
                        iframe.contentWindow.postMessage(JSON.stringify({type: type, data: {}}), '*');
                    } else if (state.videoType === 'vimeo') {
                        if (needsSeek) iframe.contentWindow.postMessage(JSON.stringify({method: 'seekTo', value: state.currentTime}), '*');
                        const vCmd = state.isPlaying ? 'play' : 'pause';
                        iframe.contentWindow.postMessage(JSON.stringify({method: vCmd}), '*');
                    }
                } catch(e) { console.error("Ошибка команды в плеер:", e); }
            }
        }
    }
}

socket.on('rave_state_updated', (data) => { if (selectedChatId === data.groupId) applyRaveState(data.state); });

const nativePlayer = document.getElementById('rave-html-player');
nativePlayer.addEventListener('timeupdate', () => localPlayerTime = nativePlayer.currentTime);
nativePlayer.addEventListener('play', () => { if (currentRaveState && currentRaveState.host === currentUser.username) socket.emit('rave_update_state', { action: 'play', groupId: selectedChatId, currentTime: nativePlayer.currentTime }); });
nativePlayer.addEventListener('pause', () => { if (currentRaveState && currentRaveState.host === currentUser.username) socket.emit('rave_update_state', { action: 'pause', groupId: selectedChatId, currentTime: nativePlayer.currentTime }); });
nativePlayer.addEventListener('seeked', () => { if (currentRaveState && currentRaveState.host === currentUser.username) socket.emit('rave_update_state', { action: 'seek', groupId: selectedChatId, currentTime: nativePlayer.currentTime }); });

window.addEventListener('message', function(e) {
    try {
        if (typeof e.data === 'string') {
            const data = JSON.parse(e.data);
            if (data.event === 'infoDelivery' && data.info && data.info.currentTime !== undefined) localPlayerTime = data.info.currentTime;
            if (data.event === 'timeUpdate') localPlayerTime = data.time;
        } else if (e.data && e.data.type === 'player:currentTime' && e.data.data) { localPlayerTime = e.data.data.time; } 
        else if (e.data && e.data.event === 'timeUpdate') { localPlayerTime = e.data.time; }
    } catch(err) {}

    if (!currentRaveState || currentRaveState.host !== currentUser.username) return;
    let action = null;
    try {
        if (typeof e.data === 'string') {
            const data = JSON.parse(e.data);
            if (data.event === 'onPlay') action = 'play';
            if (data.event === 'onPause') action = 'pause';
        }
        if (e.data && e.data.type === 'player:changeState') {
            if (e.data.data.state === 'playing') action = 'play';
            if (e.data.data.state === 'paused') action = 'pause';
        }
        if (action) {
            if (currentRaveState.isPlaying && action === 'play') return;
            if (!currentRaveState.isPlaying && action === 'pause') return;
            socket.emit('rave_update_state', { action: action, groupId: selectedChatId, currentTime: localPlayerTime });
        }
    } catch(err) {}
});

setInterval(() => {
    if (selectedChatId && currentRaveState && currentRaveState.host === currentUser.username && currentRaveState.videoType === 'direct') {
        const vid = document.getElementById('rave-html-player');
        if (!vid.classList.contains('hidden') && !vid.paused) socket.emit('rave_update_state', { action: 'play', groupId: selectedChatId, currentTime: vid.currentTime });
    }
}, 5000);