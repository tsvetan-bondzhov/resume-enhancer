# Resume Enhancer

## Developer Setup

After cloning the repository, run the hook installer once to register the shared Git hooks:

```powershell
.\scripts\install-hooks.ps1
```

This sets `core.hooksPath` to `.githooks/`, activating the following hooks:

| Hook | Trigger | Effect |
|---|---|---|
| `pre-push` | `git push` | Runs SonarQube scan; blocks push if quality gate fails |

### SonarQube

The quality gate check requires a running SonarQube instance (default: `http://localhost:9000`).
Start it with Docker Compose:

```powershell
docker compose up -d
```

If your instance requires authentication, set the `SONAR_TOKEN` environment variable before pushing:

```powershell
$env:SONAR_TOKEN = "your-token-here"
git push
```

To run the scan manually without pushing:

```powershell
.\scripts\sonar-check.ps1
```
