console.log("Módulo de Transmisión WebRTC: CARGADO (v7.0)");

// BLINDAJE: Envolvemos todo el código en un bloque Try/Catch.
// Así, si algo falla, no "rompe" los botones de la interfaz.
try {
    const statusText = document.getElementById('connection-status');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    const broadcastBtn = document.getElementById('broadcastBtn');

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
    // LÓGICA MANUAL: Cargamos esto PRIMERO para que jamás se bloquee
    // -------------------------------------------------------------
    document.getElementById('toggleManualBtn').onclick = () => {
        document.getElementById('manual-ui').classList.toggle('hidden');
    };

    if (document.getElementById('manualCopyOfferBtn')) {
        document.getElementById('manualCopyOfferBtn').onclick = async () => {
            if(!window.currentStream) return alert("Enciende la cámara primero.");
            
            document.getElementById('manualCopyOfferBtn').innerText = "Generando código seguro...";
            manualPC = new RTCPeerConnection(iceServersConfig);
            
            window.currentStream.getTracks().forEach(track => manualPC.addTrack(track, window.currentStream));
            
            const offer = await manualPC.createOffer();
            await manualPC.setLocalDescription(offer);

            manualPC.onicegatheringstatechange = () => {
                if (manualPC.iceGatheringState === 'complete') {
                    const offerBase64 = encodeSDP(manualPC.localDescription);
                    navigator.clipboard.writeText(offerBase64).then(() => {
                        document.getElementById('manualCopyOfferBtn').innerText = "¡Copiado! Envíalo al PC";
                        document.getElementById('manualCopyOfferBtn').style.background = "#34c759";
                    }).catch(err => {
                        // Respaldo si el celular bloquea el portapapeles
                        prompt("Copia este código manualmente:", offerBase64);
                    });
                }
            };
        };
    }

    if (document.getElementById('manualConnectBtn')) {
        document.getElementById('manualConnectBtn').onclick = async () => {
            const answerStr = document.getElementById('manualAnswerInput').value;
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
            } catch(e) { 
                alert("Error crítico al procesar la respuesta: " + e.message); 
            }
        };
    }

    // -------------------------------------------------------------
    // RECEPTOR ESTUDIO
    // -------------------------------------------------------------
    if (isManualReceptor) {
        document.body.classList.add('receiver-mode'); 
        const manualUI = document.getElementById('receptor-manual-ui');
        manualUI.classList.remove('hidden');

        manualPC = new RTCPeerConnection(iceServersConfig);
        manualPC.ontrack = (event) => {
            const videoElement = document.getElementById('localVideo');
            videoElement.srcObject = event.streams[0];
            videoElement.muted = false;
            manualUI.classList.add('hidden'); 
        };

        document.getElementById('recProcessBtn').onclick = async () => {
            const offerStr = document.getElementById('recOfferInput').value;
            if(!offerStr) return alert("Pega el código del celular.");
            try {
                document.getElementById('recStatus').innerText = "Procesando...";
                const offerDesc = decodeSDP(offerStr);
                await manualPC.setRemoteDescription(new RTCSessionDescription(offerDesc));
                
                const answer = await manualPC.createAnswer();
                await manualPC.setLocalDescription(answer);

                manualPC.onicegatheringstatechange = () => {
                    if (manualPC.iceGatheringState === 'complete') {
                        const answerBase64 = encodeSDP(manualPC.localDescription);
                        navigator.clipboard.writeText(answerBase64).then(() => {
                            document.getElementById('recStatus').innerText = "¡Respuesta Copiada! Envíala al celular.";
                            document.getElementById('recProcessBtn').innerText = "Copiado ✔";
                            document.getElementById('recProcessBtn').style.background = "#34c759";
                        });
                    }
                };
            } catch(e) { alert("Error al procesar: " + e.message); }
        };

    } else if (roomToJoin) {
        // Receptor Automático
        document.body.classList.add('receiver-mode'); 
        if (typeof Peer !== 'undefined') {
            peer = new Peer({ debug: 2, config: iceServersConfig }); 
            peer.on('open', () => {
                const call = peer.call(roomToJoin, createEmptyStream());
                call.on('stream', (remoteStream) => {
                    const videoElement = document.getElementById('localVideo');
                    videoElement.srcObject = remoteStream;
                    videoElement.muted = false; 
                });
            });
        }

    } else {
        // -------------------------------------------------------------
        // LÓGICA AUTOMÁTICA (EMISOR) - CON DETECCIÓN DE BLOQUEO
        // -------------------------------------------------------------
        if (typeof Peer === 'undefined') {
            // El celular bloqueó el script de PeerJS (adblocker, ahorro de datos, etc)
            console.warn("Librería de red bloqueada por el navegador.");
            statusText.innerText = "Servidor Bloqueado. Usa MODO MANUAL.";
            statusText.style.color = "#ff3b30";
            roomIdDisplay.innerText = "---";
        } else {
            // Intentamos conexión normal
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
                statusText.innerText = "Error Servidor Automático"; 
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
    // Si la aplicación se estrella en algo no previsto, nos avisa en lugar de congelarse
    alert("Error de Sistema detectado: " + error.message);
    console.error(error);
}