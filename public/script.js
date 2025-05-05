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
        const signal = JSON.parse(event.data);
        console.log("Получено сообщение от WebSocket:", signal);  // Отладочное сообщение

        if (signal.Offer) {
            console.log("Получен Offer, создаём peerConnection...");  // Отладочное сообщение
            await createPeer();
            console.log("Устанавливаем remoteDescription для Offer...");  // Отладочное сообщение
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.Offer)));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log("Отправляем Answer...");  // Отладочное сообщение
            socket.send(JSON.stringify({ Answer: JSON.stringify(answer) }));

        } else if (signal.Answer) {
            console.log("Получен Answer, устанавливаем remoteDescription...");  // Отладочное сообщение
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.Answer)));

        } else if (signal.IceCandidate) {
            console.log("Получен IceCandidate, добавляем его в peerConnection...");  // Отладочное сообщение
            const candidate = new RTCIceCandidate(JSON.parse(signal.IceCandidate));
            await peerConnection.addIceCandidate(candidate);
        }
    } catch (error) {
        console.error("Ошибка обработки сообщения WebSocket:", error);
        addMessage(event.data);
    }
};

socket.onclose = () => console.log("WebSocket закрыт");
socket.onerror = (error) => console.error("WebSocket ошибка:", error);

// === Чат ===
sendButton.addEventListener("click", () => {
    const message = messageInput.value;
    if (message.trim() !== "") {
        console.log("Отправляем сообщение через WebSocket:", message);  // Отладочное сообщение
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

    console.log("Создаём новый RTCPeerConnection...");  // Отладочное сообщение
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE Candidate найден, отправляем через WebSocket...");  // Отладочное сообщение
            socket.send(JSON.stringify({ IceCandidate: JSON.stringify(event.candidate) }));
        }
    };

    peerConnection.ontrack = (event) => {
        console.log("Получен поток для remoteVideo:", event.streams);  // Отладочное сообщение
        remoteVideo.srcObject = event.streams[0];
    };

    if (!localStream) {
        console.log("Запрашиваем доступ к камере и микрофону...");  // Отладочное сообщение
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } else {
        console.log("Локальный поток уже существует, пропускаем запрос...");  // Отладочное сообщение
    }

    localStream.getTracks().forEach(track => {
        console.log("Добавляем трек в peerConnection:", track);  // Отладочное сообщение
        peerConnection.addTrack(track, localStream);
    });
}

// === Вызов ===
callButton.addEventListener("click", async () => {
    console.log("Нажата кнопка вызова, создаём offer...");  // Отладочное сообщение
    await createPeer();
    const offer = await peerConnection.createOffer();
    console.log("Offer создан, устанавливаем localDescription...");  // Отладочное сообщение
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ Offer: JSON.stringify(offer) }));
});
