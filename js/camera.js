console.log("Módulo de Cámara y Hardware: CARGADO (v9.0)");

const videoElement = document.getElementById('localVideo');
const videoSelect = document.getElementById('videoSource');
const audioSelect = document.getElementById('audioSource');
const startBtn = document.getElementById('startBtn');
const startupText = document.getElementById('startup-text');
const audioLevel = document.getElementById('audio-level'); 
const broadcastBtn = document.getElementById('broadcastBtn'); 
const statusText = document.getElementById('connection-status'); 

window.currentStream = null; 
let audioContext = null; 
let audioMeterInterval = null; 
let currentVideoId = null;
let currentAudioId = null;

async function initHardware() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("API Bloqueada (Verifica HTTPS)");
        }

        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        videoSelect.innerHTML = '';
        audioSelect.innerHTML = '';

        let hasVideo = false;
        let hasAudio = false;

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            if (device.kind === 'videoinput') { 
                option.text = device.label || `Cámara ${videoSelect.length + 1}`; 
                videoSelect.appendChild(option); 
                hasVideo = true;
            } 
            else if (device.kind === 'audioinput') { 
                option.text = device.label || `Micrófono ${audioSelect.length + 1}`; 
                audioSelect.appendChild(option); 
                hasAudio = true;
            }
        });

        if(!hasVideo) videoSelect.innerHTML = '<option>No se detectaron cámaras</option>';
        if(!hasAudio) audioSelect.innerHTML = '<option>No se detectaron micrófonos</option>';

        tempStream.getTracks().forEach(track => track.stop());
        startupText.innerText = "Hardware Listo. (v9.0)";
        startupText.style.fontSize = "14px";
    } catch (error) { 
        startupText.innerText = "Acceso Denegado por el Navegador";
        startupText.style.color = "#ff3b30";
        videoSelect.innerHTML = '<option>⚠️ Permiso de cámara bloqueado</option>';
        audioSelect.innerHTML = '<option>⚠️ Permiso de audio bloqueado</option>';
        console.error("Fallo de hardware:", error); 
    }
}

function startAudioMeter(stream) {
    try {
        if(audioMeterInterval) clearInterval(audioMeterInterval);
        if(!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const microphone = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        microphone.connect(analyser);

        audioMeterInterval = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0; for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            let average = sum / dataArray.length;
            let volumeLevel = Math.min(100, Math.round((average / 128) * 100));
            audioLevel.style.width = volumeLevel + '%';
            audioLevel.style.background = volumeLevel > 85 ? '#ff3b30' : '#34c759'; 
        }, 50);
    } catch (e) { console.warn("Vúmetro omitido"); }
}

async function startCamera(isHardwareChange = false) {
    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;

    if (isHardwareChange && window.currentStream && currentVideoId === videoSource && currentAudioId !== audioSource) {
        try {
            const audioConstraints = { audio: { deviceId: audioSource ? { exact: audioSource } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
            const newAudioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            const oldAudioTrack = window.currentStream.getAudioTracks()[0];
            if (oldAudioTrack) { window.currentStream.removeTrack(oldAudioTrack); oldAudioTrack.stop(); }
            window.currentStream.addTrack(newAudioStream.getAudioTracks()[0]);
            currentAudioId = audioSource;
            startAudioMeter(window.currentStream);
            if(window.updateWebRTCStream) window.updateWebRTCStream('audio');
            return; 
        } catch (e) { console.error("Error cambiando audio", e); }
    }

    const constraints = {
        video: { deviceId: videoSource ? { exact: videoSource } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: { deviceId: audioSource ? { exact: audioSource } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    };

    try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = newStream;
        if (window.currentStream) window.currentStream.getTracks().forEach(track => track.stop());
        window.currentStream = newStream;
        currentVideoId = videoSource; currentAudioId = audioSource;
        
        startAudioMeter(window.currentStream);
        startupText.style.display = 'none';
        
        if (window.cleanLinkReady) {
            broadcastBtn.disabled = false;
            broadcastBtn.innerText = "📋 Copiar Link Automático";
            broadcastBtn.style.background = "#007aff";
            statusText.innerText = "Cámara lista y Conectado";
        } else {
            statusText.innerText = "Cámara Activa (Usa Modo Manual)";
        }

        if(window.updateWebRTCStream) window.updateWebRTCStream('video'); 
    } catch (error) { 
        alert("El navegador bloqueó la cámara. Revisa el candado en la barra de direcciones."); 
    }
}

function toggleCamera() {
    if (window.currentStream) {
        window.currentStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null; window.currentStream = null; currentVideoId = null; currentAudioId = null;
        startBtn.innerText = "Encender Cámara"; startBtn.style.background = "#007aff";
        if(audioMeterInterval) clearInterval(audioMeterInterval); audioLevel.style.width = '0%';
        broadcastBtn.disabled = true; broadcastBtn.innerText = "Esperando Cámara..."; broadcastBtn.classList.remove('pulse-live');
    } else {
        startCamera(false); startBtn.innerText = "Apagar Cámara"; startBtn.style.background = "#ff3b30";
    }
}

startBtn.addEventListener('click', toggleCamera);
videoSelect.addEventListener('change', () => { if(window.currentStream) startCamera(true); });
audioSelect.addEventListener('change', () => { if(window.currentStream) startCamera(true); });

initHardware();