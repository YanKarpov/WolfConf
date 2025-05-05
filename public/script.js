const roomId = "room1"; 
const socket = new WebSocket(`ws://127.0.0.1:3000/ws/${roomId}`);

// Получаем элементы на странице
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// Функция для добавления сообщения в чат
function addMessage(message, isSelf = false) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    if (isSelf) {
        messageElement.classList.add("self");
    } else {
        messageElement.classList.add("other");
    }
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

// Обработчик события подключения
socket.onopen = () => {
    console.log("Подключено к серверу WebSocket");
};

// Обработчик получения сообщения от сервера
socket.onmessage = (event) => {
    addMessage(event.data);
};

// Обработчик закрытия соединения
socket.onclose = () => {
    console.log("Соединение закрыто");
};

// Обработчик ошибок
socket.onerror = (error) => {
    console.error("Ошибка WebSocket:", error);
};

// Функция отправки сообщения
sendButton.addEventListener("click", () => {
    const message = messageInput.value;
    if (message.trim() !== "") {
        socket.send(message);
        addMessage(message, true); // Добавляем сообщение как своё
        messageInput.value = ""; // Очищаем поле ввода
    }
});

// Поддержка отправки сообщений при нажатии Enter
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendButton.click();
    }
});
