console.log("Módulo de Cámara y Hardware: CARGADO (v5.0)");

const videoElement = document.getElementById('localVideo');
const videoSelect = document.getElementById('videoSource');
const audioSelect = document.getElementById('audioSource');
const startBtn = document.getElementById('startBtn');
const startupText = document.getElementById('startup-text');
const audioLevel = document.getElementById('audio-level'); 
const broadcastBtn = document.getElementById('broadcastBtn'); 

window.currentStream = null; 
let audioContext = null; 
let audioMeterInterval = null; 

let currentVideoId = null;
let currentAudioId = null;

async function initHardware() {
    try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        videoSelect.innerHTML = '';
        audioSelect.innerHTML = '';

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            if (device.kind === 'videoinput') {
                option.text = device.label || `Cámara ${videoSelect.length + 1}`;
                videoSelect.appendChild(option);
            } else if (device.kind === 'audioinput') {
                option.text = device.label || `Micrófono ${audioSelect.length + 1}`;
                audioSelect.appendChild(option);
            }
        });

        tempStream.getTracks().forEach(track => track.stop());
        startupText.innerText = "Hardware Listo. (v5.0)";
        startupText.style.fontSize = "14px";
    } catch (error) {
        startupText.innerText = "Acepta los permisos de cámara.";
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
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
            let average = sum / dataArray.length;
            let volumeLevel = Math.min(100, Math.round((average / 128) * 100));
            
            audioLevel.style.width = volumeLevel + '%';
            audioLevel.style.background = volumeLevel > 85 ? '#ff3b30' : '#34c759'; 
        }, 50);
    } catch (e) {
        console.warn("Vúmetro no compatible", e);
    }
}

async function startCamera(isHardwareChange = false) {
    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;

    if (isHardwareChange && window.currentStream && currentVideoId === videoSource && currentAudioId !== audioSource) {
        console.log("Cambiando SOLO el audio en caliente...");
        try {
            const audioConstraints = {
                audio: { deviceId: audioSource ? { exact: audioSource } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            };
            const newAudioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            
            const oldAudioTrack = window.currentStream.getAudioTracks()[0];
            if (oldAudioTrack) {
                window.currentStream.removeTrack(oldAudioTrack);
                oldAudioTrack.stop();
            }
            
            const newAudioTrack = newAudioStream.getAudioTracks()[0];
            window.currentStream.addTrack(newAudioTrack);
            currentAudioId = audioSource;
            
            startAudioMeter(window.currentStream);
            if(window.activePeerConnection) window.updateWebRTCStream('audio');
            return; 
        } catch (e) {
            console.error("Error al inyectar el nuevo audio", e);
        }
    }

    const constraints = {
        video: {
            deviceId: videoSource ? { exact: videoSource } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 }
        },
        audio: {
            deviceId: audioSource ? { exact: audioSource } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    };

    try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        videoElement.srcObject = newStream;
        
        if (window.currentStream) {
            window.currentStream.getTracks().forEach(track => track.stop());
        }
        
        window.currentStream = newStream;
        currentVideoId = videoSource;
        currentAudioId = audioSource;
        
        startAudioMeter(window.currentStream);
        startupText.style.display = 'none';
        
        // Verificamos si la red ya generó el enlace antes de habilitar el botón
        if (window.cleanLinkReady) {
            broadcastBtn.disabled = false;
            broadcastBtn.innerText = "Copiar Enlace para Estudio";
            broadcastBtn.style.background = "#007aff";
        } else {
            broadcastBtn.innerText = "Cámara lista. Esperando Red...";
        }
        
        if(window.activePeerConnection && window.currentStream) {
            window.updateWebRTCStream('video'); 
        }
        
    } catch (error) {
        alert("El dispositivo no soporta esta resolución o faltan permisos.");
    }
}

function toggleCamera() {
    if (window.currentStream) {
        window.currentStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        window.currentStream = null;
        currentVideoId = null;
        currentAudioId = null;
        
        startBtn.innerText = "Encender Cámara";
        startBtn.style.background = "#007aff";
        if(audioMeterInterval) clearInterval(audioMeterInterval);
        audioLevel.style.width = '0%';
        
        broadcastBtn.disabled = true;
        broadcastBtn.innerText = "Esperando Cámara...";
        broadcastBtn.classList.remove('pulse-live');
    } else {
        startCamera(false);
        startBtn.innerText = "Apagar Cámara";
        startBtn.style.background = "#ff3b30";
    }
}

startBtn.addEventListener('click', toggleCamera);

videoSelect.addEventListener('change', () => { if(window.currentStream) startCamera(true); });
audioSelect.addEventListener('change', () => { if(window.currentStream) startCamera(true); });

initHardware();