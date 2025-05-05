use tokio::sync::mpsc;
use std::{collections::HashMap};

pub struct Room {
    pub clients: HashMap<String, mpsc::UnboundedSender<String>>,
}

impl Room {
    pub fn new() -> Self {
        Room {
            clients: HashMap::new(),
        }
    }
}
