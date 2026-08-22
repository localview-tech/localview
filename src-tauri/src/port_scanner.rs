use crate::models::PortCandidate;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

const MAX_PORTS: u16 = 128;
const DEFAULT_TIMEOUT_MS: u64 = 180;

pub async fn scan_local_ports(
    start_port: Option<u16>,
    end_port: Option<u16>,
    timeout_ms: Option<u64>,
) -> Result<Vec<PortCandidate>, String> {
    let start = start_port.unwrap_or(3000);
    let end = end_port.unwrap_or(start.saturating_add(99));
    if start == 0 || end < start || end - start + 1 > MAX_PORTS {
        return Err("PORT_SCAN_RANGE_INVALID".into());
    }
    let timeout_duration =
        Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).min(1500));
    let mut candidates = Vec::new();
    for port in start..=end {
        if let Some(candidate) = probe_port(port, timeout_duration).await {
            candidates.push(candidate);
        }
    }
    Ok(candidates)
}

async fn probe_port(port: u16, timeout_duration: Duration) -> Option<PortCandidate> {
    let stream = timeout(timeout_duration, TcpStream::connect(("127.0.0.1", port)))
        .await
        .ok()?
        .ok()?;
    let (title, server, hmr) = inspect_http(stream, timeout_duration).await;
    Some(PortCandidate {
        port,
        url: format!("http://127.0.0.1:{port}"),
        title,
        server,
        hmr,
    })
}

async fn inspect_http(
    mut stream: TcpStream,
    timeout_duration: Duration,
) -> (Option<String>, Option<String>, bool) {
    let request = b"HEAD / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    if timeout(timeout_duration, stream.write_all(request))
        .await
        .is_err()
    {
        return (None, None, false);
    }
    let mut buffer = vec![0; 2048];
    let size = timeout(timeout_duration, stream.read(&mut buffer))
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or(0);
    if size == 0 {
        return (None, None, false);
    }
    let response = String::from_utf8_lossy(&buffer[..size]);
    let lower = response.to_lowercase();
    let server = response.lines().find_map(|line| {
        line.strip_prefix("Server:")
            .or_else(|| line.strip_prefix("server:"))
            .map(|value| value.trim().to_string())
    });
    let hmr = lower.contains("vite") || lower.contains("webpack") || lower.contains("hmr");
    (None, server, hmr)
}

#[cfg(test)]
mod tests {
    use super::scan_local_ports;

    #[tokio::test]
    async fn rejects_unbounded_port_ranges() {
        assert!(scan_local_ports(Some(3000), Some(3300), Some(10))
            .await
            .is_err());
    }
}
