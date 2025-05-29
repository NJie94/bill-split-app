mod models;
mod handlers;

use actix_files::NamedFile;
use actix_web::{middleware, web, App, HttpRequest, HttpServer, Responder};
use include_dir::{include_dir, Dir};
use std::path::PathBuf;

use handlers::calculate_handler;

// Embed the `frontend/dist` folder at compile time:
static DIST_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../frontend/dist/frontend");

// Fallback to `index.html` for any GET (SPA routing)
async fn spa_handler(req: HttpRequest) -> impl Responder {
    let path: PathBuf = req.match_info().query("filename").parse().unwrap_or_default();
    let file = if path.as_os_str().is_empty() {
        "index.html"
    } else {
        path.to_str().unwrap()
    };

    match DIST_DIR.get_file(file) {
        Some(f) => {
            let ct = mime_guess::from_path(file).first_or_octet_stream();
            actix_web::HttpResponse::Ok()
                .content_type(ct.as_ref())
                .body(f.contents())
        }
        None => actix_web::HttpResponse::NotFound().body("Not found"),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting server at http://0.0.0.0:8000");
    HttpServer::new(|| {
        App::new()
            .wrap(middleware::Logger::default())
            // API endpoint
            .route("/api/bill-split/calculate", web::post().to(calculate_handler))
            // Serve static assets & index.html fallback
            .route("/{filename:.*}", web::get().to(spa_handler))
    })
    .bind(("0.0.0.0", 8000))?
    .run()
    .await
}
