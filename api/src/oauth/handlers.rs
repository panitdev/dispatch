use axum::{
    extract::{Form, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Redirect, Response},
};
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    models::user::{NewUser, User},
    oauth::hydra,
    schema::users,
    state::AppState,
};

#[derive(Deserialize)]
pub struct LoginParams {
    login_challenge: String,
}

#[derive(Deserialize)]
pub struct ConsentParams {
    consent_challenge: String,
}

#[derive(Deserialize)]
pub struct ConsentSubmit {
    consent_challenge: String,
    grant_scopes: String,
    action: String,
}

#[derive(Deserialize)]
pub struct ErrorParams {
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct KratosWhoami {
    identity: KratosIdentityPayload,
}

#[derive(Deserialize)]
struct KratosIdentityPayload {
    id: Uuid,
    traits: KratosTraits,
}

#[derive(Deserialize)]
struct KratosTraits {
    username: String,
}

pub async fn oauth_metadata(State(state): State<AppState>) -> Result<Response, StatusCode> {
    let url = format!(
        "{}/.well-known/oauth-authorization-server",
        state.config.hydra_public_url.trim_end_matches('/')
    );
    let resp = state
        .http
        .get(url)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| "application/json".parse().expect("valid content-type"));
    let body = resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok((status, [(header::CONTENT_TYPE, content_type)], body).into_response())
}

pub async fn oauth_login(
    State(state): State<AppState>,
    Query(params): Query<LoginParams>,
    headers: HeaderMap,
) -> Result<Redirect, StatusCode> {
    let challenge = params.login_challenge;
    let login_req = hydra::get_login_request(&state, &challenge)
        .await
        .map_err(|err| err.as_gateway_status())?;

    if login_req.skip {
        let subject = login_req.subject.ok_or(StatusCode::BAD_GATEWAY)?;
        let redirect = hydra::accept_login(&state, &challenge, &subject)
            .await
            .map_err(|err| err.as_gateway_status())?;
        return Ok(Redirect::to(&redirect.redirect_to));
    }

    let cookie = headers.get(header::COOKIE).cloned();
    match kratos_whoami(&state, cookie).await {
        Ok(session) => {
            ensure_local_user(&state, &session).await?;
            let subject = session.identity.id.to_string();
            let redirect = hydra::accept_login(&state, &challenge, &subject)
                .await
                .map_err(|err| err.as_gateway_status())?;
            Ok(Redirect::to(&redirect.redirect_to))
        }
        Err(_) => {
            let return_to = format!(
                "{}/oauth/login?login_challenge={}",
                state.config.dispatch_public_url.trim_end_matches('/'),
                urlencoding::encode(&challenge)
            );
            let kratos_login = format!(
                "{}/self-service/login/browser?return_to={}",
                state.config.kratos_browser_url.trim_end_matches('/'),
                urlencoding::encode(&return_to)
            );
            Ok(Redirect::to(&kratos_login))
        }
    }
}

pub async fn oauth_consent_show(
    State(state): State<AppState>,
    Query(params): Query<ConsentParams>,
) -> Result<Response, StatusCode> {
    let challenge = params.consent_challenge;
    let consent_req = hydra::get_consent_request(&state, &challenge)
        .await
        .map_err(|err| err.as_gateway_status())?;

    if consent_req.skip {
        let redirect = hydra::accept_consent(&state, &challenge, &consent_req.requested_scope)
            .await
            .map_err(|err| err.as_gateway_status())?;
        return Ok(Redirect::to(&redirect.redirect_to).into_response());
    }

    Ok(Html(render_consent_page(
        &challenge,
        consent_req.client.display_name(),
        &consent_req.requested_scope,
    ))
    .into_response())
}

pub async fn oauth_consent_submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(body): Form<ConsentSubmit>,
) -> Result<Redirect, StatusCode> {
    // Verify the current Kratos session owns this consent challenge to prevent CSRF.
    let cookie = headers.get(header::COOKIE).cloned();
    let session = kratos_whoami(&state, cookie)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    let consent_req = hydra::get_consent_request(&state, &body.consent_challenge)
        .await
        .map_err(|err| err.as_gateway_status())?;
    let subject = consent_req.subject.ok_or(StatusCode::BAD_GATEWAY)?;
    if subject != session.identity.id.to_string() {
        return Err(StatusCode::FORBIDDEN);
    }

    match body.action.as_str() {
        "accept" => {
            let redirect =
                hydra::accept_consent(&state, &body.consent_challenge, &consent_req.requested_scope)
                    .await
                    .map_err(|err| err.as_gateway_status())?;
            Ok(Redirect::to(&redirect.redirect_to))
        }
        "reject" => {
            let redirect = hydra::reject_consent(&state, &body.consent_challenge)
                .await
                .map_err(|err| err.as_gateway_status())?;
            Ok(Redirect::to(&redirect.redirect_to))
        }
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

pub async fn oauth_error(Query(params): Query<ErrorParams>) -> Html<String> {
    let error = params.error.unwrap_or_else(|| "oauth_error".to_owned());
    let description = params
        .error_description
        .unwrap_or_else(|| "The OAuth authorization flow could not be completed.".to_owned());

    Html(format!(
        concat!(
            "<!doctype html><html><head><meta charset=\"utf-8\">",
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
            "<title>OAuth error</title>",
            "<style>body{{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#171717}}",
            "h1{{font-size:24px}}code{{background:#f4f4f5;padding:2px 4px;border-radius:4px}}</style>",
            "</head><body><h1>OAuth error</h1><p><code>{}</code></p><p>{}</p></body></html>"
        ),
        escape_html(&error),
        escape_html(&description)
    ))
}

async fn kratos_whoami(
    state: &AppState,
    cookie: Option<axum::http::HeaderValue>,
) -> Result<KratosWhoami, StatusCode> {
    let whoami_url = format!(
        "{}/sessions/whoami",
        state.config.kratos_public_url.trim_end_matches('/')
    );
    let mut req = state.http.get(whoami_url);
    if let Some(cookie) = cookie {
        req = req.header(header::COOKIE, cookie);
    }

    let resp = req.send().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    if resp.status().as_u16() == StatusCode::UNAUTHORIZED.as_u16()
        || resp.status().as_u16() == StatusCode::FORBIDDEN.as_u16()
    {
        return Err(StatusCode::UNAUTHORIZED);
    }
    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    resp.json::<KratosWhoami>()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)
}

async fn ensure_local_user(state: &AppState, session: &KratosWhoami) -> Result<User, StatusCode> {
    let mut conn = state
        .db
        .get()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let existing: Option<User> = users::table
        .filter(users::kratos_id.eq(session.identity.id))
        .select(User::as_select())
        .first(&mut conn)
        .await
        .optional()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(user) = existing {
        return Ok(user);
    }

    let new_user = NewUser {
        id: state.next_id(),
        kratos_id: session.identity.id,
        username: session.identity.traits.username.clone(),
    };

    // ON CONFLICT DO NOTHING makes this atomic: concurrent first-time logins for
    // the same Kratos identity won't cause a unique-constraint failure.
    diesel::insert_into(users::table)
        .values(&new_user)
        .on_conflict(users::kratos_id)
        .do_nothing()
        .execute(&mut conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    users::table
        .filter(users::kratos_id.eq(session.identity.id))
        .select(User::as_select())
        .first(&mut conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn render_consent_page(challenge: &str, client_name: &str, scopes: &[String]) -> String {
    let scopes_html = scopes
        .iter()
        .map(|scope| {
            format!(
                "<li><strong>{}</strong><span>{}</span></li>",
                escape_html(scope),
                escape_html(scope_description(scope))
            )
        })
        .collect::<Vec<_>>()
        .join("");
    let grant_scopes = scopes.join(" ");

    format!(
        concat!(
            "<!doctype html><html><head><meta charset=\"utf-8\">",
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
            "<title>Authorize Dispatch</title>",
            "<style>",
            ":root{{color-scheme:light dark}}",
            "body{{font-family:system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;margin:0;color:#18181b;background:#fafafa}}",
            "main{{max-width:560px;margin:48px auto;padding:0 24px}}",
            "h1{{font-size:24px;line-height:1.2;margin:0 0 12px}}",
            "p{{line-height:1.5;color:#52525b}}",
            "ul{{list-style:none;padding:0;margin:24px 0;display:grid;gap:12px}}",
            "li{{border:1px solid #d4d4d8;background:white;border-radius:8px;padding:14px 16px}}",
            "li strong{{display:block;font-size:14px}}",
            "li span{{display:block;margin-top:4px;color:#52525b;font-size:14px}}",
            ".actions{{display:flex;gap:12px;flex-wrap:wrap}}",
            "button{{appearance:none;border:1px solid #18181b;border-radius:6px;padding:10px 14px;font:inherit;cursor:pointer}}",
            "button[value=accept]{{background:#18181b;color:white}}",
            "button[value=reject]{{background:white;color:#18181b}}",
            "@media (prefers-color-scheme:dark){{body{{background:#18181b;color:#f4f4f5}}p,li span{{color:#a1a1aa}}li{{background:#27272a;border-color:#3f3f46}}button[value=reject]{{background:#27272a;color:#f4f4f5;border-color:#71717a}}}}",
            "</style></head><body><main>",
            "<h1>Authorize Dispatch</h1>",
            "<p><strong>{}</strong> is requesting access to your Dispatch workspace.</p>",
            "<ul>{}</ul>",
            "<form method=\"POST\" action=\"/oauth/consent\">",
            "<input type=\"hidden\" name=\"consent_challenge\" value=\"{}\">",
            "<input type=\"hidden\" name=\"grant_scopes\" value=\"{}\">",
            "<div class=\"actions\">",
            "<button type=\"submit\" name=\"action\" value=\"accept\">Allow</button>",
            "<button type=\"submit\" name=\"action\" value=\"reject\">Deny</button>",
            "</div></form></main></body></html>"
        ),
        escape_html(client_name),
        scopes_html,
        escape_html(challenge),
        escape_html(&grant_scopes)
    )
}

fn scope_description(scope: &str) -> &str {
    match scope {
        "dispatch:read" => "Read issues (queries and listing)",
        "dispatch:write" => "Modify issues (status and content changes)",
        _ => scope,
    }
}

fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
