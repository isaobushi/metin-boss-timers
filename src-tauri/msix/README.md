# MSIX packaging (Microsoft Store)

The Store build is produced **only in CI** by `.github/workflows/release-windows.yml`
on a Windows runner. The dev machine is macOS, so the `.msix` never exists on a
laptop — provenance is tied to a tagged public commit → workflow run → artifact.

## How it works

1. `tauri build --no-bundle` compiles the release binary (`app.exe`).
2. The workflow lays out a package directory:
   - the binary, renamed to `DungeonAid.exe`
   - `Assets/` — the Store logos copied from `src-tauri/icons/`
   - `AppxManifest.xml` — [`AppxManifest.template.xml`](./AppxManifest.template.xml)
     with its `__PLACEHOLDER__` tokens substituted
3. `makeappx pack` produces `DungeonAid_<version>_x64.msix`.
4. The `.msix` gets a signed SLSA provenance attestation and is uploaded as a
   **CI artifact** — it is *not* published to GitHub Releases. A human downloads
   it and submits it to Partner Center, where **Microsoft re-signs it** for the
   Store (so there is no Authenticode/EV cert to buy).

## Identity values (set after Partner Center reservation — #16)

Partner Center assigns identity values that differ from the Tauri bundle
identifier. Supply them as **repository variables** (Settings → Secrets and
variables → Actions → Variables); until then CI uses dev placeholders so the
workflow stays green.

| Repo variable                  | Manifest field            | Example (Partner Center)        | Dev placeholder fallback        |
| ------------------------------ | ------------------------- | ------------------------------- | ------------------------------- |
| `MSIX_IDENTITY_NAME`           | `Identity/@Name`          | `12345Isaobushi.DungeonAid`     | `DungeonAid.Dev`                |
| `MSIX_PUBLISHER`               | `Identity/@Publisher`     | `CN=ABCD1234-...`               | `CN=DungeonAid-Dev-Placeholder` |
| `MSIX_PUBLISHER_DISPLAY_NAME`  | `PublisherDisplayName`    | `isaobushi`                     | `isaobushi`                     |

Find the exact strings in Partner Center under **Product → Product identity**.

## Capabilities

The manifest declares only `runFullTrust` — the single capability an
unvirtualised Win32 desktop app (global hotkeys, always-on-top overlay) needs.
No network/device/broad UWP capabilities are declared, preserving the
verifiable **no network calls** property.
