use keyring::Entry;
use reqwest::header::{ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

use crate::git;

const GITHUB_API: &str = "https://api.github.com";
const GITHUB_DEVICE_CODE: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN: &str = "https://github.com/login/oauth/access_token";
const KEYRING_SERVICE: &str = "com.sentence.editor";
const KEYRING_USER: &str = "github-oauth";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAccount {
    login: String,
    name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowStart {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResult {
    status: String,
    account: Option<GitHubAccount>,
    token: Option<String>,
    message: Option<String>,
}

fn resolve_client_id(client_id: Option<String>) -> Result<String, String> {
    let value = client_id
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("SENTENCE_GITHUB_CLIENT_ID").ok())
        .or_else(|| option_env!("SENTENCE_GITHUB_CLIENT_ID").map(str::to_string))
        .ok_or_else(|| {
            "Add a GitHub OAuth Client ID in Sentence before using browser sign-in.".to_string()
        })?;
    Ok(value.trim().to_string())
}

fn token_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|error| error.to_string())
}

async fn account_for_token(token: &str) -> Result<GitHubAccount, String> {
    let response = reqwest::Client::new()
        .get(format!("{GITHUB_API}/user"))
        .header(USER_AGENT, "Sentence/0.1")
        .header(ACCEPT, "application/vnd.github+json")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("GitHub could not be reached: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub account request failed ({status}): {body}"));
    }
    let value: Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(GitHubAccount {
        login: value
            .get("login")
            .and_then(Value::as_str)
            .unwrap_or("github-user")
            .to_string(),
        name: value
            .get("name")
            .and_then(Value::as_str)
            .map(str::to_string),
        avatar_url: value
            .get("avatar_url")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

#[tauri::command]
pub async fn github_start_device_flow(
    client_id: Option<String>,
) -> Result<DeviceFlowStart, String> {
    let client_id = resolve_client_id(client_id)?;
    let response = reqwest::Client::new()
        .post(GITHUB_DEVICE_CODE)
        .header(USER_AGENT, "Sentence/0.1")
        .header(ACCEPT, "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", "repo read:user"),
        ])
        .send()
        .await
        .map_err(|error| format!("Could not start GitHub sign-in: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub sign-in failed ({status}): {body}"));
    }
    let device: DeviceCodeResponse = response.json().await.map_err(|error| error.to_string())?;
    open::that(&device.verification_uri)
        .map_err(|error| format!("Could not open the browser: {error}"))?;
    Ok(DeviceFlowStart {
        device_code: device.device_code,
        user_code: device.user_code,
        verification_uri: device.verification_uri,
        expires_in: device.expires_in,
        interval: device.interval,
    })
}

#[tauri::command]
pub async fn github_poll_device_flow(
    client_id: Option<String>,
    device_code: String,
) -> Result<PollResult, String> {
    let client_id = resolve_client_id(client_id)?;
    let response = reqwest::Client::new()
        .post(GITHUB_ACCESS_TOKEN)
        .header(USER_AGENT, "Sentence/0.1")
        .header(ACCEPT, "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|error| format!("Could not check GitHub sign-in: {error}"))?;
    let value: Value = response.json().await.map_err(|error| error.to_string())?;
    if let Some(error) = value.get("error").and_then(Value::as_str) {
        let message = value
            .get("error_description")
            .and_then(Value::as_str)
            .unwrap_or(error);
        return Ok(PollResult {
            status: if error == "authorization_pending" || error == "slow_down" {
                "pending".to_string()
            } else {
                "error".to_string()
            },
            account: None,
            token: None,
            message: Some(message.to_string()),
        });
    }
    let token = value
        .get("access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| "GitHub returned no access token.".to_string())?
        .to_string();
    token_entry()
        .and_then(|entry| {
            entry
                .set_password(&token)
                .map_err(|error| error.to_string())
        })
        .map_err(|error| format!("GitHub connected, but the token could not be saved: {error}"))?;
    let account = account_for_token(&token).await?;
    Ok(PollResult {
        status: "connected".to_string(),
        account: Some(account),
        token: Some(token),
        message: None,
    })
}

#[tauri::command]
pub async fn github_session() -> Result<Option<PollResult>, String> {
    let token = match token_entry()
        .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
    {
        Ok(token) => token,
        Err(_) => return Ok(None),
    };
    let account = account_for_token(&token).await?;
    Ok(Some(PollResult {
        status: "connected".to_string(),
        account: Some(account),
        token: Some(token),
        message: None,
    }))
}

#[tauri::command]
pub fn github_disconnect() -> Result<(), String> {
    match token_entry() {
        Ok(entry) => match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        },
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn github_publish_repository(
    path: String,
    token: String,
    name: String,
    private: bool,
) -> Result<serde_json::Value, String> {
    let repo_path = Path::new(&path);
    if !repo_path.join("sentence.json").exists() {
        return Err("Save the Sentence project before publishing it.".to_string());
    }
    let response = reqwest::Client::new()
        .post(format!("{GITHUB_API}/user/repos"))
        .header(USER_AGENT, "Sentence/0.1")
        .header(ACCEPT, "application/vnd.github+json")
        .bearer_auth(&token)
        .json(&json!({
            "name": name,
            "private": private,
            "auto_init": false,
            "description": "A Sentence document project"
        }))
        .send()
        .await
        .map_err(|error| format!("GitHub could not create the repository: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub repository creation failed ({status}): {body}"
        ));
    }
    let repository_value: Value = response.json().await.map_err(|error| error.to_string())?;
    let clone_url = repository_value
        .get("clone_url")
        .and_then(Value::as_str)
        .ok_or_else(|| "GitHub created the repository without a clone URL.".to_string())?;
    git::ensure_repository(repo_path)?;
    git::set_remote_url(repo_path, clone_url)?;
    Ok(json!({
        "url": clone_url,
        "htmlUrl": repository_value.get("html_url").and_then(Value::as_str),
        "name": repository_value.get("name").and_then(Value::as_str)
    }))
}
