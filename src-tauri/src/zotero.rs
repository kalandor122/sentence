use serde::Serialize;
use std::time::Duration;

/// Zotero 7's local API. It is read-only and, like every desktop app talking to
/// Zotero, has to go through Rust: Zotero sends no CORS headers, so a webview
/// fetch is blocked before it reaches the network.
const ZOTERO_ORIGIN: &str = "http://127.0.0.1:23119";

#[derive(Serialize)]
pub struct ZoteroItem {
    pub key: String,
    pub item_type: String,
    pub title: String,
    pub creators: Vec<String>,
    pub date: String,
    pub container: String,
    pub extra: Vec<(String, String)>,
}

fn text(value: &serde_json::Value, name: &str) -> String {
    value.get(name).and_then(|it| it.as_str()).unwrap_or("").trim().to_string()
}

/// Creator names as BibTeX wants them: "Last, First", institutions as-is.
fn creator_name(creator: &serde_json::Value) -> Option<String> {
    if let Some(name) = creator.get("name").and_then(|it| it.as_str()) {
        let name = name.trim();
        return if name.is_empty() { None } else { Some(name.to_string()) };
    }
    let last = creator.get("lastName").and_then(|it| it.as_str()).unwrap_or("").trim();
    let first = creator.get("firstName").and_then(|it| it.as_str()).unwrap_or("").trim();
    match (last.is_empty(), first.is_empty()) {
        (true, _) => None,
        (false, true) => Some(last.to_string()),
        (false, false) => Some(format!("{last}, {first}")),
    }
}

#[tauri::command]
pub async fn zotero_search(query: String, limit: Option<u32>) -> Result<Vec<ZoteroItem>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("Could not start the Zotero request: {error}"))?;

    let mut url = reqwest::Url::parse(&format!("{ZOTERO_ORIGIN}/api/users/0/items"))
        .map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("limit", &limit.unwrap_or(25).min(100).to_string())
        .append_pair("sort", "dateModified")
        .append_pair("direction", "desc")
        .append_pair("q", query.trim())
        .append_pair("qmode", "everything");

    let response = client.get(url).send().await.map_err(|error| {
        format!(
            "Zotero is not answering on 127.0.0.1:23119 ({error}). Open Zotero, then Settings → Advanced → \
             \"Allow other applications on this computer to communicate with Zotero\"."
        )
    })?;

    if !response.status().is_success() {
        return Err(format!(
            "Zotero answered {} — check that the local API is enabled in Settings → Advanced.",
            response.status()
        ));
    }

    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Zotero sent something unreadable: {error}"))?;

    Ok(items_from_payload(&payload))
}

/// Zotero's JSON → the flat rows the dialog renders. Kept separate from the
/// request so it can be checked against a recorded payload.
fn items_from_payload(payload: &serde_json::Value) -> Vec<ZoteroItem> {
    let rows = payload.as_array().cloned().unwrap_or_default();

    let mut items = Vec::new();
    for row in rows {
        let data = row.get("data").cloned().unwrap_or_default();
        let item_type = text(&data, "itemType");
        // Attachments, notes and annotations are not citable.
        if matches!(item_type.as_str(), "attachment" | "note" | "annotation") {
            continue;
        }
        let creators = data
            .get("creators")
            .and_then(|it| it.as_array())
            .map(|list| list.iter().filter_map(creator_name).collect::<Vec<_>>())
            .unwrap_or_default();

        let mut extra = Vec::new();
        for (field, name) in [
            ("publicationTitle", "journal"),
            ("bookTitle", "booktitle"),
            ("proceedingsTitle", "booktitle"),
            ("volume", "volume"),
            ("issue", "number"),
            ("pages", "pages"),
            ("DOI", "doi"),
            ("url", "url"),
            ("publisher", "publisher"),
            ("place", "address"),
            ("edition", "edition"),
            ("ISBN", "isbn"),
            ("ISSN", "issn"),
            ("abstractNote", "abstract"),
            ("language", "language"),
        ] {
            let value = text(&data, field);
            if !value.is_empty() {
                extra.push((name.to_string(), value.replace('–', "--")));
            }
        }

        items.push(ZoteroItem {
            key: text(&data, "key"),
            item_type,
            title: text(&data, "title"),
            creators,
            date: text(&data, "date"),
            container: text(&data, "publicationTitle"),
            extra,
        });
    }

    items
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_zotero_items_and_skips_attachments() {
        let payload = serde_json::json!([
            {
                "key": "Q1",
                "data": {
                    "key": "Q1",
                    "itemType": "journalArticle",
                    "title": "The quiet architecture of a sentence",
                    "creators": [
                        { "firstName": "Ada", "lastName": "Lovelace" },
                        { "name": "TUG Press" }
                    ],
                    "date": "2026-05-01 2026-05-01",
                    "publicationTitle": "Journal of Writing Tools",
                    "pages": "41\u{2013}58",
                    "DOI": "10.1000/jwt.2026.1"
                }
            },
            { "data": { "key": "Q3", "itemType": "attachment", "title": "full text.pdf" } }
        ]);

        let items = items_from_payload(&payload);
        assert_eq!(items.len(), 1, "attachments are not citable");
        let item = &items[0];
        assert_eq!(item.item_type, "journalArticle");
        assert_eq!(item.creators, vec!["Lovelace, Ada", "TUG Press"]);
        assert_eq!(item.date, "2026-05-01 2026-05-01");
        let pages = item.extra.iter().find(|(name, _)| name == "pages").unwrap();
        assert_eq!(pages.1, "41--58");
        assert!(item.extra.iter().any(|(name, value)| name == "doi" && value == "10.1000/jwt.2026.1"));
    }

    /// Real round trip against whatever answers on 127.0.0.1:23119 (Zotero, or
    /// `node qa/mock-zotero.mjs`). Skipped unless ZOTERO_LIVE=1, so the suite
    /// stays offline by default.
    #[test]
    fn searches_a_live_local_api_when_asked() {
        if std::env::var("ZOTERO_LIVE").is_err() {
            return;
        }
        let items = tauri::async_runtime::block_on(zotero_search("quiet".to_string(), Some(5)))
            .expect("search against 127.0.0.1:23119");
        assert!(!items.is_empty(), "expected at least one item");
        assert!(items.iter().all(|item| item.item_type != "attachment"));
    }

    #[test]
    fn an_empty_payload_is_not_an_error() {
        assert!(items_from_payload(&serde_json::json!({})).is_empty());
    }
}
