mod server;
mod signal; 
mod room;
mod app_state;

use axum::{Router, routing::get};
use tower_http::services::ServeDir;
use std::{net::SocketAddr};
use crate::app_state::AppState;
use server::ws_handler;

use tokio::net::TcpListener; 

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
