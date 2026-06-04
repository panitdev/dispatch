fn main() {
    let commit_hash =
        std::env::var("GIT_COMMIT_HASH").unwrap_or_else(|_| "unknown".to_string());
    println!("cargo:rustc-env=GIT_COMMIT_HASH={commit_hash}");
    println!("cargo:rerun-if-env-changed=GIT_COMMIT_HASH");
}
