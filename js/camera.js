console.log("Módulo de Cámara y Hardware: CARGADO");

// 1. Vinculamos los elementos del HTML
const videoElement = document.getElementById('localVideo');
const videoSelect = document.getElementById('videoSource');
const audioSelect = document.getElementById('audioSource');
const startBtn = document.getElementById('startBtn');
const startupText = document.getElementById('startup-text');
const audioLevel = document.getElementById('audio-level'); // NUEVO: Elemento del Vúmetro visual

let currentStream = null;
let audioContext = null; // NUEVO: Para procesar el volumen
let audioMeterInterval = null; // NUEVO: Para animar la barra

// 2. Función para leer todo el hardware del celular (Se mantiene intacta)
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
        startupText.innerText = "Hardware Listo. (v2.0)";
        startupText.style.fontSize = "14px";
    } catch (error) {
        console.error("Error de permisos: ", error);
        startupText.innerText = "Acepta los permisos de cámara.";
    }
}

// 3. NUEVA FUNCION: Medir el volumen del micrófono en tiempo real (Vúmetro)
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
            for(let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            let average = sum / dataArray.length;
            let volumeLevel = Math.min(100, Math.round((average / 128) * 100));
            
            audioLevel.style.width = volumeLevel + '%';
            audioLevel.style.background = volumeLevel > 85 ? '#ff3b30' : '#34c759'; // Rojo si satura, Verde si está bien
        }, 50);
    } catch (e) {
        console.warn("El vúmetro no pudo iniciar en este navegador", e);
    }
}

// 4. Encender la cámara (MEJORADA con transición sin pantalla negra)
async function startCamera() {
    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;

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
        // AGREGADO: Enciende la nueva cámara PRIMERO antes de apagar la vieja
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = newStream;
        
        // AGREGADO: Apaga la cámara vieja DESPUÉS para evitar el pestañeo en negro
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        currentStream = newStream;
        
        // AGREGADO: Iniciamos el Vúmetro
        startAudioMeter(currentStream);
        
        // Se mantiene la lógica de la interfaz
        startupText.style.display = 'none';
        
    } catch (error) {
        console.error("Error al arrancar la cámara:", error);
        alert("Tu dispositivo no soporta esta resolución o faltan permisos.");
    }
}

// 5. NUEVA FUNCION: Botón Interruptor (Apagar / Encender)
function toggleCamera() {
    if (currentStream) {
        // SI ESTÁ ENCENDIDA: La apagamos
        currentStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        currentStream = null;
        
        // Reseteamos el botón al estado original
        startBtn.innerText = "Encender Cámara";
        startBtn.style.background = "#007aff";
        
        // Apagamos el vúmetro
        if(audioMeterInterval) clearInterval(audioMeterInterval);
        audioLevel.style.width = '0%';
    } else {
        // SI ESTÁ APAGADA: Ejecutamos nuestra función startCamera original
        startCamera();
        
        // Cambiamos el diseño del botón
        startBtn.innerText = "Apagar Cámara";
        startBtn.style.background = "#ff3b30";
    }
}

// 6. Activamos los eventos de los botones y menús
startBtn.addEventListener('click', toggleCamera); // Reemplazamos startCamera por toggleCamera

// Si cambiamos de lente o mic en el menú, hace el cambio suave si la cámara ya está encendida
videoSelect.addEventListener('change', () => { if(currentStream) startCamera(); });
audioSelect.addEventListener('change', () => { if(currentStream) startCamera(); });

// Iniciar lectura de hardware al cargar la web
initHardware();