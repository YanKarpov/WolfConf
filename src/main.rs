use axum::{
    extract::{ws::{WebSocketUpgrade, WebSocket, Message}, Path, State},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;
use futures_util::{StreamExt, SinkExt};
use tracing_subscriber;
use tokio::net::TcpListener; 
use tower_http::services::ServeDir;  

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app_state = AppState::default();

    let app = Router::new()
        .route("/ws/:room_id", get(ws_handler))
        .nest_service("/", ServeDir::new("public"))
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Сервер запущен по адресу http://{}", addr); 

    let listener = TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

// Хранилище состояния приложения 

#[derive(Clone, Default)]
struct AppState {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

// Структура комнаты 

struct Room {
    clients: HashMap<String, mpsc::UnboundedSender<String>>,
}

impl Room {
    fn new() -> Self {
        Room {
            clients: HashMap::new(),
        }
    }
}

// WebSocket обработчик 

async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, state))
}

async fn handle_socket(socket: WebSocket, room_id: String, state: AppState) {
    let client_id = Uuid::new_v4().to_string();
    println!("Клиент {} зашёл в комнату {}", &client_id[..8], room_id);

    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Клонируем состояние для работы с асинхронными задачами
    {
        let mut rooms = state.rooms.write().await;
        let room = rooms.entry(room_id.clone()).or_insert_with(Room::new); 
        room.clients.insert(client_id.clone(), tx);
    }

    // Отправка клиенту сообщений из канала
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let rooms_clone = state.rooms.clone();
    let room_id_clone = room_id.clone(); 
    let client_id_clone = client_id.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            let rooms = rooms_clone.read().await;
            if let Some(room) = rooms.get(&room_id_clone) { 
                for (id, tx) in &room.clients {
                    if id != &client_id_clone { 
                        let _ = tx.send(format!("{}: {}", &client_id_clone[..8], text));
                    }
                }
            }
        }
    });

    // Ожидаем завершения одной из задач
    tokio::select! {
        _ = send_task => (),
        _ = recv_task => (),
    }

    // Удаляем клиента из комнаты
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(&room_id) {
            room.clients.remove(&client_id);
            if room.clients.is_empty() {
                rooms.remove(&room_id);
            }
        }
    }

    println!("Клиент {} покинул комнату {}", &client_id[..8], room_id);
}
