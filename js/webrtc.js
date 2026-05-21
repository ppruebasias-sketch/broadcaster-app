console.log("Módulo de Transmisión WebRTC: CARGADO (v5.0)");

const statusText = document.getElementById('connection-status');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const broadcastBtn = document.getElementById('broadcastBtn');

let peer = null;
window.activePeerConnection = null; 
window.cleanLinkReady = null; // Para avisarle a la cámara que ya hay enlace

// 1. NUEVO: Agregamos Servidores STUN gratuitos de Google para perforar cortafuegos de redes 4G/5G
const peerConfig = {
    debug: 2,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
};

const urlParams = new URLSearchParams(window.location.search);
const roomToJoin = urlParams.get('room');

if (roomToJoin) {
    // ---- MODO RECEPTOR (El PC de Producción / vMix) ----
    console.log("Iniciando en Modo Señal Limpia para vMix");
    document.body.classList.add('receiver-mode'); 
    
    peer = new Peer(peerConfig); 
    
    peer.on('open', () => {
        const call = peer.call(roomToJoin, createEmptyStream());
        
        call.on('stream', (remoteStream) => {
            const videoElement = document.getElementById('localVideo');
            videoElement.srcObject = remoteStream;
            videoElement.muted = false; 
        });
    });

} else {
    // ---- MODO EMISOR (El Celular de Terreno) ----
    
    // NUEVO: Forzamos la creación de un ID local instantáneo para no depender de la latencia del servidor en la nube.
    const myRoomId = 'mr2-' + Math.floor(1000 + Math.random() * 9000);
    
    try {
        peer = new Peer(myRoomId, peerConfig);

        peer.on('open', (id) => {
            statusText.innerText = "Conectado a la Red Principal";
            statusText.style.color = "#34c759";
            
            window.cleanLinkReady = `${window.location.origin}${window.location.pathname}?room=${id}`;
            roomIdDisplay.innerHTML = `<span style="color: #007aff; font-size: 11px;">ID Generado: ${id}</span>`;
            
            // Si la cámara ya estaba encendida mientras el servidor cargaba, habilitamos el botón
            if(window.currentStream) {
                broadcastBtn.disabled = false;
                broadcastBtn.innerText = "Copiar Enlace para Estudio";
                broadcastBtn.style.background = "#007aff";
            }
            
            broadcastBtn.onclick = () => {
                if(!window.cleanLinkReady) return;
                navigator.clipboard.writeText(window.cleanLinkReady).then(() => {
                    const textOriginal = broadcastBtn.innerText;
                    broadcastBtn.innerText = "¡Enlace Copiado!";
                    broadcastBtn.style.background = "#34c759";
                    setTimeout(() => {
                        if(!broadcastBtn.classList.contains('pulse-live')){
                            broadcastBtn.innerText = textOriginal;
                            broadcastBtn.style.background = "#007aff";
                        }
                    }, 2000);
                });
            };
        });

        // NUEVO: Si falla, informamos visualmente al usuario
        peer.on('error', (err) => {
            statusText.innerText = "Error: " + err.type;
            statusText.style.color = "#ff3b30";
            roomIdDisplay.innerText = "Fallo de conexión";
            console.error("PeerJS Error:", err);
        });

        peer.on('call', (call) => {
            if (window.currentStream) {
                call.answer(window.currentStream); 
                window.activePeerConnection = call;
                
                statusText.innerText = "TRANSMITIENDO AL ESTUDIO";
                statusText.style.color = "#ff3b30";
                broadcastBtn.innerText = "EN VIVO";
                broadcastBtn.classList.add('pulse-live');
            }
        });
        
    } catch (e) {
        statusText.innerText = "Error crítico de red";
        statusText.style.color = "#ff3b30";
    }
}

function createEmptyStream() {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    return dest.stream;
}

window.updateWebRTCStream = function(type) {
    if(window.activePeerConnection && window.activePeerConnection.peerConnection) {
        if (type === 'video') {
            const sender = window.activePeerConnection.peerConnection.getSenders().find(s => s.track.kind === 'video');
            const videoTrack = window.currentStream.getVideoTracks()[0];
            if (sender && videoTrack) sender.replaceTrack(videoTrack);
        } 
        else if (type === 'audio') {
            const sender = window.activePeerConnection.peerConnection.getSenders().find(s => s.track.kind === 'audio');
            const audioTrack = window.currentStream.getAudioTracks()[0];
            if (sender && audioTrack) sender.replaceTrack(audioTrack);
        }
    }
};