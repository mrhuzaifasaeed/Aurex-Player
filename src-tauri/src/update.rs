use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// No signing keypair/`latest.json` exists for this app yet, so this talks
/// to the GitHub Releases REST API directly instead of Tauri's official
/// signed-updater plugin. That's the simpler path today, at the cost of not
/// cryptographically verifying the downloaded installer - the official
/// `tauri-plugin-updater` is the natural upgrade path later if/when a
/// signing setup exists.
///
/// The GitHub account was renamed from `huzzah295` to `mrhuzaifasaeed`.
/// GitHub redirects the old name for now, but it points at the current one
/// directly so update checks don't depend on that redirect staying in place.
const RELEASES_API_URL: &str = "https://api.github.com/repos/mrhuzaifasaeed/Aurex-Player/releases/latest";

/// GitHub's unauthenticated REST API allows only 60 requests/hour per IP -
/// trivial to exhaust with a few manual "Check for Updates" clicks. Serving a
/// cached result within this window avoids that entirely for the common case
/// (a user checking more than once in a short span) while still feeling
/// reasonably fresh.
const CACHE_TTL_MS: u64 = 15 * 60 * 1000;

/// One retry with a short backoff absorbs a single transient network hiccup
/// without noticeably delaying the common "it just works" case.
const MAX_ATTEMPTS: u32 = 2;
const RETRY_DELAY: Duration = Duration::from_millis(800);

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    current_version: String,
    latest_version: String,
    up_to_date: bool,
    download_url: Option<String>,
    release_url: String,
}

#[derive(Serialize, Deserialize)]
struct UpdateCache {
    checked_at_ms: u64,
    info: UpdateInfo,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn cache_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("update-cache.json"))
}

fn load_cache(app: &AppHandle) -> Option<UpdateCache> {
    let path = cache_path(app)?;
    let contents = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn save_cache(app: &AppHandle, info: &UpdateInfo) {
    let Some(path) = cache_path(app) else { return };
    let cache = UpdateCache { checked_at_ms: now_ms(), info: info.clone() };
    if let Ok(json) = serde_json::to_string(&cache) {
        let _ = std::fs::write(path, json);
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Aurex-Player-Updater")
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| "client-build-failed".to_string())
}

/// A separate client (and much longer timeout) for the installer download
/// itself - `reqwest`'s `.timeout()` covers the *entire* request including
/// streaming the response body, not just establishing the connection.
/// `http_client()`'s 10-second timeout is fine for `check_for_update`'s tiny
/// JSON response, but a 30-40MB installer can easily take longer than that
/// on anything short of a fast connection, causing the download to be cut
/// off mid-transfer rather than failing fast the way a genuinely unreachable
/// host would.
fn download_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Aurex-Player-Updater")
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|_| "client-build-failed".to_string())
}

/// Fetches the latest release, retrying once on a transient failure. Never
/// surfaces raw HTTP/network error text - callers only see whether it
/// succeeded, so `check_for_update` can decide on a single, friendly message
/// for every failure mode (rate limit, offline, GitHub outage, etc.) rather
/// than leaking implementation details to the user.
async fn fetch_latest_release() -> Result<GithubRelease, ()> {
    let client = http_client().map_err(|_| ())?;

    for attempt in 1..=MAX_ATTEMPTS {
        let result = client
            .get(RELEASES_API_URL)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await;

        match result {
            Ok(response) if response.status().is_success() => {
                return response.json::<GithubRelease>().await.map_err(|_| ());
            }
            // A rate limit or server-side error won't be fixed by an
            // immediate retry within the same second - only worth retrying
            // genuinely transient failures (the Err(_) branch below).
            Ok(_) => return Err(()),
            Err(_) if attempt < MAX_ATTEMPTS => {
                tokio::time::sleep(RETRY_DELAY).await;
                continue;
            }
            Err(_) => return Err(()),
        }
    }

    Err(())
}

/// Everything about "was this successful" collapses to a single friendly
/// message - rate-limited, offline, or GitHub having a bad day all look the
/// same to a user and all deserve the same non-alarming, actionable text.
const FRIENDLY_CHECK_ERROR: &str = "Unable to check for updates. Please try again later.";

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let cached = load_cache(&app);

    if let Some(cache) = &cached {
        if now_ms().saturating_sub(cache.checked_at_ms) < CACHE_TTL_MS {
            return Ok(cache.info.clone());
        }
    }

    match fetch_latest_release().await {
        Ok(release) => {
            let latest_version = release.tag_name.trim_start_matches('v').to_string();
            let download_url = release
                .assets
                .iter()
                .find(|asset| asset.name.ends_with("-setup.exe"))
                .map(|asset| asset.browser_download_url.clone());

            let info = UpdateInfo {
                up_to_date: latest_version == current_version,
                current_version,
                latest_version,
                download_url,
                release_url: release.html_url,
            };
            save_cache(&app, &info);
            Ok(info)
        }
        // Graceful degradation: a transient rate limit or offline blip
        // shouldn't regress an otherwise-working "up to date" state the user
        // already saw - fall back to it instead of showing an error. Only
        // when there's truly nothing cached does the friendly error surface.
        Err(()) => cached.map(|cache| cache.info).ok_or_else(|| FRIENDLY_CHECK_ERROR.to_string()),
    }
}

/// `download_and_install_update` downloads a URL and then executes it as a
/// program - normally that URL only ever comes from `check_for_update`'s own
/// GitHub API response, but the command is still reachable directly from any
/// script running in the webview (e.g. a future XSS in rendered content).
/// This is the actual security boundary: even though the frontend always
/// passes back a `check_for_update` result, this command must not trust that
/// on its own, since it can execute arbitrary code with the user's own
/// privileges. Restricting it to this repo's own release-asset path turns
/// "download and run any URL" into "download and run an asset this project
/// itself published".
///
/// This must name the repository's *current* owner: the release API returns
/// asset URLs under the current name, so a stale owner here (as in 1.0.0,
/// which still said `huzzah295`) rejects every genuine installer.
const TRUSTED_DOWNLOAD_PREFIX: &str = "https://github.com/mrhuzaifasaeed/Aurex-Player/releases/download/";

fn is_trusted_download_url(url: &str) -> bool {
    url.starts_with(TRUSTED_DOWNLOAD_PREFIX)
}

/// Downloads the release installer to a temp path and launches it
/// interactively (matching how a user would normally run the NSIS
/// installer) - it does not silently elevate or run unattended. The frontend
/// is responsible for quitting Aurex Player right after this succeeds (via
/// `@tauri-apps/plugin-process`'s `exit()`), so the installer isn't left
/// trying to overwrite files a still-running instance holds open - the exact
/// "file locked" failure mode hit repeatedly during this app's own dev
/// builds when a previous instance lingered.
#[tauri::command]
pub async fn download_and_install_update(download_url: String) -> Result<(), String> {
    if !is_trusted_download_url(&download_url) {
        return Err("Refusing to download from an untrusted source.".to_string());
    }

    let client = download_http_client()?;
    let bytes = client
        .get(&download_url)
        .send()
        .await
        .map_err(|_| "Download failed. Please check your internet connection and try again.".to_string())?
        .error_for_status()
        .map_err(|_| "Download failed. Please try again later.".to_string())?
        .bytes()
        .await
        .map_err(|_| "Download failed. Please try again later.".to_string())?;

    let installer_path = std::env::temp_dir().join("aurex-player-update-setup.exe");
    std::fs::write(&installer_path, &bytes)
        .map_err(|_| "Couldn't save the downloaded installer to disk.".to_string())?;

    std::process::Command::new(&installer_path)
        .spawn()
        .map_err(|_| "Couldn't launch the installer.".to_string())?;

    Ok(())
}
