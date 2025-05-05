use serde::{Deserialize, Serialize};
use serde_json;
use futures_util::{SinkExt, StreamExt};
use axum::extract::ws::{Message, WebSocket};
use tokio::sync::mpsc;
use crate::app_state::AppState;


#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebrtcSignal {
    Offer(String),
    Answer(String),
    IceCandidate(String),
}



// Обработка сообщений для обмена сигналами WebRTC (SDP, ICE кандидаты)
pub async fn handle_webrtc_signals(socket: WebSocket, room_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let (_tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Отправка сообщений через WebSocket (например, сигналы WebRTC)
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Обработка сообщений от клиентов
    let rooms_clone = state.rooms.clone();
    let room_id_clone = room_id.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            // Попробуем распарсить как WebRTC сигнал
            if let Ok(signal) = serde_json::from_str::<WebrtcSignal>(&text) {
                let rooms = rooms_clone.read().await;
                if let Some(room) = rooms.get(&room_id_clone) {
                    for (id, tx) in &room.clients {
                        if id != &room_id_clone {
                            // Отправим исходное сообщение как есть (в JSON)
                            let _ = tx.send(text.clone());
                        }
                    }
                }
            } else {
                eprintln!("Неверный формат WebRTC сигнала: {}", text);
            }
        }
    });
    

    // Ожидаем завершения задач
    tokio::select! {
        _ = send_task => (),
        _ = recv_task => (),
    }
}
