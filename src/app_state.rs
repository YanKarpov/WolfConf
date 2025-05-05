use tokio::sync::RwLock;
use std::{collections::HashMap, sync::Arc};
use crate::room::Room;

// Структура состояния приложения
#[derive(Clone, Default)]
pub struct AppState {
    pub rooms: Arc<RwLock<HashMap<String, Room>>>,
}

