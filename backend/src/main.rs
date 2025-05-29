mod models;
mod handlers;

use actix_web::{web, App, HttpServer};
use handlers::calculate_handler;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/api/bill-split/calculate", web::post().to(calculate_handler))
    })
    .bind(("0.0.0.0", 8000))?
    .run()
    .await
}
