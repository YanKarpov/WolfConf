use tokio::sync::mpsc;
use std::collections::HashMap;
use crate::signal::WebrtcSignal;

pub struct Room {
    pub clients: HashMap<String, mpsc::UnboundedSender<String>>,
    pub webrtc_signals: HashMap<String, WebrtcSignal>,  // Храним WebRTC сигналы
}

impl Room {
    pub fn new() -> Self {
        Room {
            clients: HashMap::new(),
            webrtc_signals: HashMap::new(), // Инициализируем новый хранилище сигналов
        }
    }
}
