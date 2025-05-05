const roomId = "room1"; 
const socket = new WebSocket(`ws://127.0.0.1:3000/ws/${roomId}`);

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const callButton = document.getElementById("callButton");

let localStream;
let peerConnection;

const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// === UI ===
function addMessage(message, isSelf = false) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.classList.add(isSelf ? "self" : "other");
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// === WebSocket ===
socket.onopen = () => {
    console.log("Подключено к WebSocket");
};

socket.onmessage = async (event) => {
    try {
        let messageData = event.data;

        // Убираем префикс перед JSON (если он есть)
        const jsonStartIndex = messageData.indexOf("{");
        if (jsonStartIndex !== -1) {
            messageData = messageData.substring(jsonStartIndex);
        }

        // Логируем очищенное сообщение от WebSocket
        console.log("Получено сообщение от WebSocket:", messageData);

        // Пробуем парсить как JSON
        let signal;
        try {
            signal = JSON.parse(messageData);
        } catch (error) {
            // Если ошибка парсинга JSON, то это текстовое сообщение
            addMessage(messageData, false); // Просто выводим в чат
            console.error("Ошибка при парсинге JSON:", error);
            return; // Выход из функции, если это не видео-сигнал
        }

        // Обработка сообщений только по видео-сигналам
        if (signal.IceCandidate) {
            try {
                const iceCandidate = JSON.parse(signal.IceCandidate);
                console.log("Парсинг IceCandidate успешен:", iceCandidate);

                const candidate = new RTCIceCandidate(iceCandidate);
                await peerConnection.addIceCandidate(candidate);
                console.log("IceCandidate добавлен в peerConnection");
            } catch (err) {
                console.error("Ошибка при парсинге IceCandidate:", err);
            }
        }

        if (signal.Offer) {
            console.log("Получен Offer, создаём peerConnection...");
            await createPeer();
            console.log("Устанавливаем remoteDescription для Offer...");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.Offer)));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log("Отправляем Answer...");
            socket.send(JSON.stringify({ Answer: JSON.stringify(answer) }));
        } else if (signal.Answer) {
            console.log("Получен Answer, устанавливаем remoteDescription...");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.Answer)));
        }

    } catch (error) {
        console.error("Ошибка при обработке сообщения WebSocket:", error);
    }
};


socket.onclose = () => console.log("WebSocket закрыт");
socket.onerror = (error) => console.error("WebSocket ошибка:", error);

// === Чат ===
sendButton.addEventListener("click", () => {
    const message = messageInput.value;
    if (message.trim() !== "") {
        console.log("Отправляем сообщение через WebSocket:", message);
        socket.send(message);
        addMessage(message, true);
        messageInput.value = "";
    }
});

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendButton.click();
});

// === WebRTC ===
async function createPeer() {
    if (peerConnection) return;

    console.log("Создаём новый RTCPeerConnection...");
    peerConnection = new RTCPeerConnection(config);

    // Обработка кандидатов ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE Candidate найден, отправляем через WebSocket...");
            socket.send(JSON.stringify({ IceCandidate: JSON.stringify(event.candidate) }));
        }
    };

    // Обработка потока с удаленной стороны
    peerConnection.ontrack = (event) => {
        console.log("Получен поток для remoteVideo:", event.streams);
        // Если поток с удаленной стороны, показываем его в remoteVideo
        remoteVideo.srcObject = event.streams[0]; 
        remoteVideo.play().catch(err => {
            console.error("Не удалось воспроизвести remoteVideo:", err);
        });
    };

    // Получение и настройка локального потока
    if (!localStream) {
        console.log("Запрашиваем доступ к камере и микрофону...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream; // Отображаем локальное видео на текущей вкладке
            localVideo.play().catch(err => {
                console.error("Не удалось воспроизвести localVideo:", err);
            });
        } catch (err) {
            console.error("Ошибка получения медиа потока:", err);
            alert("Не удалось получить доступ к камере и микрофону.");
        }
    } else {
        console.log("Локальный поток уже существует, пропускаем запрос...");
    }

    localStream.getTracks().forEach(track => {
        console.log("Добавляем трек в peerConnection:", track);
        peerConnection.addTrack(track, localStream);
    });
}

// === Вызов ===
callButton.addEventListener("click", async () => {
    console.log("Нажата кнопка вызова, создаём offer...");
    await createPeer();
    const offer = await peerConnection.createOffer();
    console.log("Offer создан, устанавливаем localDescription...");
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ Offer: JSON.stringify(offer) }));

    // На первой вкладке показываем только локальное видео
    remoteVideo.srcObject = null; // Убираем отображение удаленного видео на первой вкладке
});

