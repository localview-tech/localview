use crate::models::{ProjectDetection, ScriptSuggestion};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub fn detect_project(root_path: &str) -> Result<ProjectDetection, String> {
    let root = Path::new(root_path);
    if !root.is_dir() {
        return Err("INVALID_ROOT_PATH".into());
    }
    let package_path = root.join("package.json");
    let package = if package_path.is_file() {
        let raw = fs::read_to_string(package_path).map_err(|_| "CONFIG_READ")?;
        Some(serde_json::from_str::<Value>(&raw).map_err(|_| "CONFIG_PARSE")?)
    } else {
        None
    };
    let package_manager = if root.join("pnpm-lock.yaml").exists() {
        Some("pnpm".into())
    } else if root.join("yarn.lock").exists() {
        Some("yarn".into())
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        Some("bun".into())
    } else if package.is_some() {
        Some("npm".into())
    } else {
        None
    };
    let name = package
        .as_ref()
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let scripts = package
        .as_ref()
        .and_then(|value| value.get("scripts"))
        .and_then(Value::as_object)
        .map(|scripts| {
            let mut values: Vec<ScriptSuggestion> = scripts
                .iter()
                .filter_map(|(name, command)| {
                    command.as_str().map(|command| ScriptSuggestion {
                        name: name.clone(),
                        command: command.to_string(),
                        recommended: name == "dev" || name == "start",
                    })
                })
                .collect();
            values.sort_by_key(|item| (!item.recommended, item.name.clone()));
            values.truncate(20);
            values
        })
        .unwrap_or_default();
    let framework = detect_framework(root, package.as_ref());
    let suggested_port = framework.as_deref().and_then(default_port);
    Ok(ProjectDetection {
        root_path: root.to_string_lossy().to_string(),
        name,
        package_manager,
        framework,
        suggested_port,
        scripts,
    })
}

fn detect_framework(root: &Path, package: Option<&Value>) -> Option<String> {
    let dependencies = package?.get("dependencies")?.as_object()?;
    for (dependency, label) in [
        ("next", "Next.js"),
        ("vite", "Vite"),
        ("astro", "Astro"),
        ("@angular/core", "Angular"),
        ("react-scripts", "Create React App"),
    ] {
        if dependencies.contains_key(dependency)
            || root.join("vite.config.ts").exists() && dependency == "vite"
        {
            return Some(label.into());
        }
    }
    None
}

fn default_port(framework: &str) -> Option<u16> {
    match framework {
        "Vite" => Some(5173),
        "Next.js" => Some(3000),
        "Astro" => Some(4321),
        "Angular" => Some(4200),
        "Create React App" => Some(3000),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::detect_project;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn detects_scripts_package_manager_and_framework() {
        let directory = tempdir().expect("temp dir");
        fs::write(
            directory.path().join("package.json"),
            r#"{"name":"demo","dependencies":{"vite":"latest"},"scripts":{"build":"vite build","dev":"vite"}}"#,
        )
        .expect("package json");
        fs::write(
            directory.path().join("pnpm-lock.yaml"),
            "lockfileVersion: 9",
        )
        .expect("lockfile");
        let detection = detect_project(directory.path().to_str().expect("path")).expect("detect");
        assert_eq!(detection.package_manager.as_deref(), Some("pnpm"));
        assert_eq!(detection.framework.as_deref(), Some("Vite"));
        assert_eq!(detection.scripts[0].name, "dev");
    }
}
