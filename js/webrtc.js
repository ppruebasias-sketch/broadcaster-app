console.log("Módulo de Transmisión WebRTC: CARGADO (v3.0)");

const statusText = document.getElementById('connection-status');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const broadcastBtn = document.getElementById('broadcastBtn');

let peer = null;
window.activePeerConnection = null; // Guardamos la conexión activa para actualizarla
let myRoomId = '';

// 1. Detección de Modo: ¿Somos el Celular (Emisor) o el vMix (Receptor)?
const urlParams = new URLSearchParams(window.location.search);
const roomToJoin = urlParams.get('room');

if (roomToJoin) {
    // ---- MODO RECEPTOR (El PC de Producción / vMix) ----
    console.log("Iniciando en Modo Señal Limpia para vMix");
    document.body.classList.add('receiver-mode'); // Oculta toda la interfaz
    
    // El receptor se conecta con un ID aleatorio y busca la Sala del celular
    peer = new Peer(); 
    
    peer.on('open', () => {
        // Llamamos al celular (roomToJoin) pasándole un stream vacío
        const call = peer.call(roomToJoin, createEmptyStream());
        
        call.on('stream', (remoteStream) => {
            // Recibimos el video limpio y lo ponemos a pantalla completa
            const videoElement = document.getElementById('localVideo');
            videoElement.srcObject = remoteStream;
            videoElement.muted = false; // El estudio SÍ debe escuchar el audio
        });
    });

} else {
    // ---- MODO EMISOR (El Celular de Terreno) ----
    
    // Creamos un ID corto y fácil de leer (Ej: mr2-4582)
    myRoomId = 'mr2-' + Math.floor(1000 + Math.random() * 9000);
    
    peer = new Peer(myRoomId);

    peer.on('open', (id) => {
        statusText.innerText = "En Red (Esperando conexión)";
        statusText.style.color = "#34c759";
        
        // Mostramos el enlace exacto que debes pegar en vMix
        const cleanLink = `${window.location.origin}${window.location.pathname}?room=${id}`;
        roomIdDisplay.innerHTML = `<a href="${cleanLink}" target="_blank" style="color: #007aff; text-decoration: none;">${cleanLink}</a>`;
    });

    // 2. Escuchar cuando el vMix nos llame
    peer.on('call', (call) => {
        if (window.currentStream) {
            call.answer(window.currentStream); // Enviamos nuestro video
            window.activePeerConnection = call;
            
            // Efectos visuales de EN VIVO
            statusText.innerText = "TRANSMITIENDO AL ESTUDIO";
            statusText.style.color = "#ff3b30";
            broadcastBtn.innerText = "AL AIRE";
            broadcastBtn.classList.add('pulse-live');
        } else {
            console.log("El estudio intentó conectar, pero la cámara está apagada.");
        }
    });

    // 3. Acción del Botón Transmitir
    broadcastBtn.addEventListener('click', () => {
        // En esta fase, el botón sirve para forzar la reconexión o avisar que estamos listos
        alert(`Para recibir la señal, abre este enlace en tu vMix:\n\n${window.location.origin}${window.location.pathname}?room=${myRoomId}`);
    });
}

// Función auxiliar: Crea un stream de audio mudo para iniciar la llamada desde el receptor
function createEmptyStream() {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    return dest.stream;
}

// 4. NUEVO: Función para cambiar de lente sin cortar la transmisión WebRTC
window.updateWebRTCStream = function() {
    if(window.activePeerConnection && window.activePeerConnection.peerConnection) {
        const sender = window.activePeerConnection.peerConnection.getSenders().find(s => s.track.kind === 'video');
        const videoTrack = window.currentStream.getVideoTracks()[0];
        
        if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
            console.log("Lente actualizado en vivo sin cortar transmisión");
        }
    }
};