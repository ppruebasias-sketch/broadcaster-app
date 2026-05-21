console.log("Módulo de Transmisión WebRTC: CARGADO (v4.0)");

const statusText = document.getElementById('connection-status');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const broadcastBtn = document.getElementById('broadcastBtn');

let peer = null;
window.activePeerConnection = null; 
let myRoomId = '';

const urlParams = new URLSearchParams(window.location.search);
const roomToJoin = urlParams.get('room');

if (roomToJoin) {
    // ---- MODO RECEPTOR (El PC de Producción / vMix) ----
    console.log("Iniciando en Modo Señal Limpia para vMix");
    document.body.classList.add('receiver-mode'); 
    
    // Conexión genérica automática
    peer = new Peer({ debug: 2 }); 
    
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
    
    // Dejamos que el servidor nos asigne un ID garantizado para que no se congele
    peer = new Peer({ debug: 2 });

    peer.on('open', (id) => {
        myRoomId = id;
        statusText.innerText = "Conectado a la Red Principal";
        statusText.style.color = "#34c759";
        
        const cleanLink = `${window.location.origin}${window.location.pathname}?room=${id}`;
        roomIdDisplay.innerHTML = `<span style="color: #007aff; font-size: 11px;">ID Listo</span>`;
        
        // El botón ahora copia el enlace al portapapeles
        broadcastBtn.onclick = () => {
            navigator.clipboard.writeText(cleanLink).then(() => {
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

    // Manejo de errores de red
    peer.on('error', (err) => {
        statusText.innerText = "Error de red (" + err.type + ")";
        statusText.style.color = "#ff3b30";
        console.error(err);
    });

    // Escuchar cuando el vMix nos llame
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
}

function createEmptyStream() {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    return dest.stream;
}

// Función para inyectar cambios de lente o micrófono en vivo a la transmisión
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