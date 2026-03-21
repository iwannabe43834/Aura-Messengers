let currentCall = null;
let localStream = null;
let isVideoCall = false;
let isRemoteMuted = false;
let callStartTime = null;
let callTimerInterval = null;
let callInitiator = false;

function formatCallDuration(ms) {
    if (!ms || ms < 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60); 
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function initPeerJS() {
    peer = new Peer(currentUser.username, { 
        host: window.location.hostname, 
        port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80), 
        path: '/peerjs' 
    });
    
    peer.on('call', (incomingCall) => {
        currentCall = incomingCall; 
        callInitiator = false; 
        isVideoCall = incomingCall.metadata ? incomingCall.metadata.isVideo : true;
        
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-ui-content').classList.remove('hidden');
        document.getElementById('incoming-call-actions').classList.remove('hidden');
        document.getElementById('incoming-call-actions').style.display = 'flex';
        document.getElementById('active-call-actions').classList.add('hidden');
        document.getElementById('video-container').classList.add('hidden');
        document.getElementById('call-name').textContent = incomingCall.peer;
        document.getElementById('call-status-text').textContent = isVideoCall ? 'Входящий видеозвонок...' : 'Входящий аудиозвонок...';
        
        fetch(`/api/entity/${incomingCall.peer}`)
            .then(r => r.json())
            .then(d => {
                const av = document.getElementById('call-avatar');
                if (d.avatar) { 
                    av.style.backgroundImage = `url(${d.avatar})`; 
                    av.textContent = ''; 
                } else { 
                    av.style.backgroundImage = 'none'; 
                    av.style.background = d.profileColor || 'var(--primary)'; 
                    av.textContent = (d.displayName || incomingCall.peer)[0].toUpperCase(); 
                }
            }).catch(()=>{});
    });
}

async function makeCall(video) {
    if (!selectedChatId || selectedChatId === 'me' || isCurrentChatGroup) {
        return showToast("Звонки доступны только один на один");
    }
    document.getElementById('chat-header-dropdown').classList.add('hidden');
    isVideoCall = video; 
    callInitiator = true; 
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideoCall, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        currentCall = peer.call(selectedChatId, localStream, { metadata: { isVideo: isVideoCall } });
        
        showCallActiveUI(selectedChatId, "Звоним...");
        currentCall.on('stream', remoteStream => {
            callStartTime = Date.now();
            callTimerInterval = setInterval(() => {
                const dur = formatCallDuration(Date.now() - callStartTime);
                document.getElementById('call-status-text').textContent = `В разговоре: ${dur}`;
            }, 1000);
            document.getElementById('remote-video').srcObject = remoteStream;
        });
        currentCall.on('close', closeCallUI);
    } catch(err) { 
        showToast("Нет доступа к микрофону/камере"); 
    }
}

async function startScreenShare() {
    if (!selectedChatId || selectedChatId === 'me' || isCurrentChatGroup) {
        return showToast("Демонстрация доступна только в личных чатах");
    }
    document.getElementById('chat-header-dropdown').classList.add('hidden');
    isVideoCall = true; 
    callInitiator = true;
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const combinedTracks = [...screenStream.getVideoTracks(), ...voiceStream.getAudioTracks()];
        localStream = new MediaStream(combinedTracks);
        
        document.getElementById('local-video').srcObject = localStream;
        currentCall = peer.call(selectedChatId, localStream, { metadata: { isVideo: true } });
        
        showCallActiveUI(selectedChatId, "Демонстрация экрана...");
        currentCall.on('stream', remoteStream => {
            callStartTime = Date.now();
            callTimerInterval = setInterval(() => {
                const dur = formatCallDuration(Date.now() - callStartTime);
                document.getElementById('call-status-text').textContent = `Зритель подключился: ${dur}`;
            }, 1000);
            document.getElementById('remote-video').srcObject = remoteStream;
        });
        currentCall.on('close', closeCallUI);
        screenStream.getVideoTracks()[0].onended = () => { 
            endCall(); 
            showToast("Демонстрация завершена"); 
        };
    } catch(err) { 
        showToast("Доступ к экрану отменен"); 
    }
}

async function acceptCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideoCall, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        currentCall.answer(localStream);
        showCallActiveUI(currentCall.peer, "Соединение установлено");
        
        currentCall.on('stream', remoteStream => {
            callStartTime = Date.now();
            callTimerInterval = setInterval(() => {
                const dur = formatCallDuration(Date.now() - callStartTime);
                document.getElementById('call-status-text').textContent = `В разговоре: ${dur}`;
            }, 1000);
            document.getElementById('remote-video').srcObject = remoteStream;
        });
        currentCall.on('close', closeCallUI);
    } catch(err) { 
        showToast("Нет доступа к микрофону/камере"); 
        rejectCall(); 
    }
}

function rejectCall() { 
    if (currentCall) currentCall.close(); 
    closeCallUI(); 
}

function endCall() { 
    if (currentCall) currentCall.close(); 
    closeCallUI(); 
}

function showCallActiveUI(name, status) {
    document.getElementById('call-overlay').classList.remove('hidden');
    document.getElementById('incoming-call-actions').style.display = 'none';
    document.getElementById('incoming-call-actions').classList.add('hidden');
    document.getElementById('active-call-actions').style.display = 'flex';
    document.getElementById('active-call-actions').classList.remove('hidden');
    document.getElementById('call-name').textContent = name;
    document.getElementById('call-status-text').textContent = status;
    
    if (isVideoCall) {
        document.getElementById('video-container').classList.remove('hidden');
    } else {
        document.getElementById('video-container').classList.add('hidden');
    }
}

function closeCallUI() {
    clearInterval(callTimerInterval);
    let durationStr = "00:00"; 
    if (callStartTime) {
        durationStr = formatCallDuration(Date.now() - callStartTime);
    }
    document.getElementById('call-overlay').classList.add('hidden');
    document.getElementById('incoming-call-actions').classList.add('hidden');
    document.getElementById('active-call-actions').classList.add('hidden');
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (callInitiator && selectedChatId && currentCall) {
        let textMsg = `<span class="system-call-msg"><i class="fas fa-phone-slash"></i> Звонок отменен / пропущен</span>`;
        if (callStartTime) {
            textMsg = `<span class="system-call-msg"><i class="fas fa-phone-alt"></i> Звонок завершен.<br><span>Длительность: ${durationStr}</span></span>`; 
        }
        socket.emit('private_msg', { to: selectedChatId, text: textMsg });
    }
    currentCall = null; 
    localStream = null; 
    callStartTime = null; 
    callInitiator = false;
    document.getElementById('local-video').srcObject = null; 
    document.getElementById('remote-video').srcObject = null;
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('audio-toggle-btn');
            btn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : '#ff3b30';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('video-toggle-btn');
            btn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            btn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.2)' : '#ff3b30';
        }
    }
}

function toggleRemoteAudio() {
    const remoteVid = document.getElementById('remote-video');
    isRemoteMuted = !isRemoteMuted; 
    remoteVid.muted = isRemoteMuted;
    const btn = document.getElementById('remote-audio-toggle-btn');
    btn.innerHTML = isRemoteMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    btn.style.background = isRemoteMuted ? '#ff3b30' : 'rgba(255,255,255,0.2)';
}