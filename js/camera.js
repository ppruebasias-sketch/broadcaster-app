console.log("Módulo de Cámara y Hardware: CARGADO");

// 1. Vinculamos los elementos del HTML
const videoElement = document.getElementById('localVideo');
const videoSelect = document.getElementById('videoSource');
const audioSelect = document.getElementById('audioSource');
const startBtn = document.getElementById('startBtn');
const startupText = document.getElementById('startup-text');

let currentStream = null;

// 2. Función para leer todo el hardware del celular
async function initHardware() {
    try {
        // Permiso temporal rápido para revelar nombres reales de las cámaras
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Leemos todos los dispositivos conectados
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Limpiamos los menús
        videoSelect.innerHTML = '';
        audioSelect.innerHTML = '';

        // Llenamos los menús con lo que encontró el celular
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

        // Apagamos la cámara temporal silenciosamente
        tempStream.getTracks().forEach(track => track.stop());
        
        // Actualizamos el texto en pantalla
        startupText.innerText = "Hardware Detectado.";
        startupText.style.fontSize = "14px";

    } catch (error) {
        console.error("Error de permisos: ", error);
        startupText.innerText = "Acepta los permisos de cámara.";
    }
}

// 3. Encender la cámara con máxima calidad (Estilo Blackmagic)
async function startCamera() {
    // Si ya había una cámara encendida, la apagamos para cambiar de lente
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;

    // PARÁMETROS PROFESIONALES DE TRANSMISIÓN
    const constraints = {
        video: {
            deviceId: videoSource ? { exact: videoSource } : undefined,
            width: { ideal: 1920 },  // Forzamos la petición a Full HD
            height: { ideal: 1080 },
            frameRate: { ideal: 60 } // Intentamos pedir 60fps
        },
        audio: {
            deviceId: audioSource ? { exact: audioSource } : undefined,
            echoCancellation: false,   // APAGADO para no distorsionar el ambiente
            noiseSuppression: false,   // APAGADO para máxima pureza del micrófono
            autoGainControl: false     // APAGADO para que el volumen no fluctúe solo
        }
    };

    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = currentStream;
        
        // Ocultamos el texto inicial y cambiamos el botón a verde
        startupText.style.display = 'none';
        startBtn.innerText = "Cámara Activa";
        startBtn.style.background = "#34c759"; 
        
    } catch (error) {
        console.error("Error al arrancar la cámara:", error);
        alert("Tu dispositivo no soporta esta resolución o faltan permisos.");
    }
}

// 4. Activamos los eventos de los botones y menús
startBtn.addEventListener('click', startCamera);
videoSelect.addEventListener('change', startCamera); // Cambiar lente en vivo
audioSelect.addEventListener('change', startCamera); // Cambiar micrófono en vivo

// Iniciar lectura de hardware al cargar la web
initHardware();