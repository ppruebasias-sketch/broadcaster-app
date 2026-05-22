console.log("Módulo de Transmisión WebRTC: CARGADO (v8.0)");

try {
    const statusText = document.getElementById('connection-status');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    const broadcastBtn = document.getElementById('broadcastBtn');
    const unmuteOverlay = document.getElementById('unmute-overlay');
    const unmuteBtn = document.getElementById('unmuteBtn');

    window.activePeerConnection = null; 
    window.cleanLinkReady = null; 
    let peer = null;
    let manualPC = null;

    const iceServersConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    function encodeSDP(desc) { return btoa(JSON.stringify(desc)); }
    function decodeSDP(str) { return JSON.parse(atob(str)); }

    const urlParams = new URLSearchParams(window.location.search);
    const roomToJoin = urlParams.get('room');
    const isManualReceptor = urlParams.get('mode') === 'receptor';

    // -------------------------------------------------------------
    // INTERFAZ DE CONFIGURACIÓN PREVIA AL EVENTO CLICK (MANUAL)
    // -------------------------------------------------------------
    document.getElementById('toggleManualBtn').onclick = () => {
        document.getElementById('manual-ui').classList.toggle('hidden');
    };

    // Inicializar listeners fijos para el Receptor Manual (PC de Estudio)
    if (isManualReceptor) {
        document.body.classList.add('receiver-mode'); 
        const manualUI = document.getElementById('receptor-manual-ui');
        manualUI.classList.remove('hidden');

        manualPC = new RTCPeerConnection(iceServersConfig);
        
        // El video se conecta desde aquí
        manualPC.ontrack = (event) => {
            const videoElement = document.getElementById('localVideo');
            videoElement.srcObject = event.streams[0];
            
            // CORRECCIÓN OBS: Muted inicial para forzar reproducción inmediata sin pantalla negra
            videoElement.muted = true;
            videoElement.play().catch(err => console.log("Autoplay bloqueado:", err));
            
            // Mostramos botón de desvincular audio
            unmuteOverlay.classList.remove('hidden');
            unmuteBtn.onclick = () => {
                videoElement.muted = false;
                unmuteOverlay.classList.add('hidden');
            };
            manualUI.classList.add('hidden'); 
        };

        // Escucha ininterrumpida de candidatos de red
        manualPC.onicecandidate = (event) => {
            if (!event.candidate) {
                const answerBase64 = encodeSDP(manualPC.localDescription);
                navigator.clipboard.writeText(answerBase64).then(() => {
                    document.getElementById('recStatus').innerText = "¡Respuesta Generada y Copiada! Envíala al celular.";
                    document.getElementById('recProcessBtn').innerText = "Copiado ✔";
                    document.getElementById('recProcessBtn').style.background = "#34c759";
                }).catch(() => {
                    // Si el navegador bloquea el portapapeles, pintamos la caja de texto
                    document.getElementById('recStatus').innerHTML = `Copia este código de respuesta:<br><textarea onclick="this.select()" style="width:100%;height:100px;background:#222;color:white;border:1px solid #444;margin-top:5px;font-family:monospace;font-size:10px;word-break:break-all;">${answerBase64}</textarea>`;
                });
            }
        };

        document.getElementById('recProcessBtn').onclick = async () => {
            const offerStr = document.getElementById('recOfferInput').value.trim();
            if(!offerStr) return alert("Pega el código del celular.");
            try {
                document.getElementById('recStatus').innerText = "Procesando código de cámara...";
                const offerDesc = decodeSDP(offerStr);
                await manualPC.setRemoteDescription(new RTCSessionDescription(offerDesc));
                
                const answer = await manualPC.createAnswer();
                await manualPC.setLocalDescription(answer);
            } catch(e) { alert("Error al descifrar código: " + e.message); }
        };
    }

    // Lógica del Botón del Celular (Emisor Manual)
    if (document.getElementById('manualCopyOfferBtn')) {
        document.getElementById('manualCopyOfferBtn').onclick = async () => {
            if(!window.currentStream) return alert("Enciende la cámara primero.");
            
            document.getElementById('manualCopyOfferBtn').innerText = "Generando código seguro...";
            manualPC = new RTCPeerConnection(iceServersConfig);
            
            manualPC.onicecandidate = (event) => {
                if (!event.candidate) {
                    const offerBase64 = encodeSDP(manualPC.localDescription);
                    navigator.clipboard.writeText(offerBase64).then(() => {
                        document.getElementById('manualCopyOfferBtn').innerText = "¡Copiado! Envíalo al PC";
                        document.getElementById('manualCopyOfferBtn').style.background = "#34c759";
                    }).catch(err => {
                        prompt("Copia este código manualmente:", offerBase64);
                        document.getElementById('manualCopyOfferBtn').innerText = "📋 Copiar Mi Código Base64";
                    });
                }
            };

            window.currentStream.getTracks().forEach(track => manualPC.addTrack(track, window.currentStream));
            
            const offer = await manualPC.createOffer();
            await manualPC.setLocalDescription(offer);
        };
    }

    if (document.getElementById('manualConnectBtn')) {
        document.getElementById('manualConnectBtn').onclick = async () => {
            const answerStr = document.getElementById('manualAnswerInput').value.trim();
            if(!answerStr) return alert("Pega el código del estudio primero.");
            try {
                const answerDesc = decodeSDP(answerStr);
                await manualPC.setRemoteDescription(new RTCSessionDescription(answerDesc));
                
                document.getElementById('manual-ui').classList.add('hidden');
                statusText.innerText = "TRANSMITIENDO (MANUAL)";
                statusText.style.color = "#ff3b30";
                broadcastBtn.innerText = "EN VIVO (SEGURA)";
                broadcastBtn.classList.add('pulse-live');
                window.activePeerConnection = { peerConnection: manualPC };
            } catch(e) { alert("Error crítico al enlazar respuesta: " + e.message); }
        };
    }

    // -------------------------------------------------------------
    // RECEPTOR AUTOMÁTICO (PeerJS)
    // -------------------------------------------------------------
    if (roomToJoin && !isManualReceptor) {
        document.body.classList.add('receiver-mode'); 
        if (typeof Peer !== 'undefined') {
            peer = new Peer({ debug: 2, config: iceServersConfig }); 
            peer.on('open', () => {
                const call = peer.call(roomToJoin, createEmptyStream());
                call.on('stream', (remoteStream) => {
                    const videoElement = document.getElementById('localVideo');
                    videoElement.srcObject = remoteStream;
                    
                    // CORRECCIÓN OBS: Reproducción mutada inicial para reventar la pantalla negra
                    videoElement.muted = true;
                    videoElement.play().catch(err => console.log(err));
                    
                    unmuteOverlay.classList.remove('hidden');
                    unmuteBtn.onclick = () => {
                        videoElement.muted = false;
                        unmuteOverlay.classList.add('hidden');
                    };
                });
            });
        }
    } else if (!isManualReceptor) {
        // -------------------------------------------------------------
        // EMISOR AUTOMÁTICO (CELULAR)
        // -------------------------------------------------------------
        if (typeof Peer === 'undefined') {
            statusText.innerText = "Servidor Bloqueado. Usa MODO MANUAL.";
            statusText.style.color = "#ff3b30";
            roomIdDisplay.innerText = "---";
        } else {
            const myRoomId = 'mr2-' + Math.floor(1000 + Math.random() * 9000);
            peer = new Peer(myRoomId, { debug: 2, config: iceServersConfig });

            peer.on('open', (id) => {
                statusText.innerText = "Conectado a Red";
                statusText.style.color = "#34c759";
                window.cleanLinkReady = `${window.location.origin}${window.location.pathname}?room=${id}`;
                roomIdDisplay.innerHTML = `<span style="color: #007aff; font-size: 11px;">Link Listo</span>`;
                
                if(window.currentStream) {
                    broadcastBtn.disabled = false;
                    broadcastBtn.innerText = "📋 Copiar Link Automático";
                    broadcastBtn.style.background = "#007aff";
                }
                
                broadcastBtn.onclick = () => {
                    if(!window.cleanLinkReady) return;
                    navigator.clipboard.writeText(window.cleanLinkReady).then(() => {
                        broadcastBtn.innerText = "¡Enlace Copiado!";
                        broadcastBtn.style.background = "#34c759";
                        setTimeout(() => { if(!broadcastBtn.classList.contains('pulse-live')) { broadcastBtn.innerText = "📋 Copiar Link Automático"; broadcastBtn.style.background = "#007aff"; } }, 2000);
                    });
                };
            });

            peer.on('error', (err) => {
                statusText.innerText = "Servidor Ocupado"; 
                statusText.style.color = "#ffcc00";
                roomIdDisplay.innerText = "Usa Modo Manual";
            });

            peer.on('call', (call) => {
                if (window.currentStream) {
                    call.answer(window.currentStream); 
                    window.activePeerConnection = call;
                    statusText.innerText = "TRANSMITIENDO (AUTO)"; 
                    statusText.style.color = "#ff3b30";
                    broadcastBtn.innerText = "EN VIVO"; 
                    broadcastBtn.classList.add('pulse-live');
                }
            });
        }
    }

    function createEmptyStream() {
        const ctx = new window.AudioContext();
        const dest = ctx.createMediaStreamDestination();
        return dest.stream;
    }

    window.updateWebRTCStream = function(type) {
        if(window.activePeerConnection && window.activePeerConnection.peerConnection) {
            const pc = window.activePeerConnection.peerConnection;
            if (type === 'video') {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                const videoTrack = window.currentStream.getVideoTracks()[0];
                if (sender && videoTrack) sender.replaceTrack(videoTrack);
            } else if (type === 'audio') {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                const audioTrack = window.currentStream.getAudioTracks()[0];
                if (sender && audioTrack) sender.replaceTrack(audioTrack);
            }
        }
    };

} catch (error) {
    console.error(error);
}