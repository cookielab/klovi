# Separate Onboarding from Security Warning

## Problem

The onboarding wizard and security warning are conflated into a single flow controlled by one `showSecurityWarning` boolean. Completing onboarding sets `showSecurityWarning: false`, so the security warning never appears again. The settings toggle is mislabeled "Show on-boarding on startup."

The intended behavior:
- **Onboarding** (2-step wizard): shown only on first launch, never again
- **Security warning**: shown on every launch unless the user opts out

## Design

### First-launch detection

Use settings file existence as the signal. `loadSettings()` already returns defaults when the file is missing. The file is created when `saveSettings()` is called (during onboarding completion). No new flags needed.

Add an `isFirstLaunch` RPC method that checks `existsSync(settingsPath)` and returns `{ firstLaunch: boolean }`.

### Startup flow

```
App Launch → AppGate
  ├─ First launch (no settings file):
  │    Full Onboarding (Step 1: Security Notice → Step 2: Plugins)
  │    On complete: acceptRisks() + updateGeneralSettings({showSecurityWarning: false})
  │
  ├─ Not first launch + showSecurityWarning=true:
  │    SecurityWarning screen (same content as Step 1)
  │    "Accept & Continue" button + "Don't show this again" checkbox
  │    On accept: acceptRisks() + optionally set showSecurityWarning=false
  │
  └─ Not first launch + showSecurityWarning=false:
       Auto acceptRisks() → straight to App
```

### Components

- **Onboarding** (`Onboarding.tsx`): unchanged, 2-step wizard for first launch
- **SecurityWarning** (new): standalone screen reusing Step 1 content, adds "Don't show this again" checkbox and "Accept & Continue" button
- **AppGate** (`App.tsx`): calls `isFirstLaunch()` + `getGeneralSettings()`, branches on both results
- **Settings**: rename toggle to "Show security warning on startup", update hint

### Backend

- New RPC: `isFirstLaunch` — `{ params: {}; response: { firstLaunch: boolean } }`
- Existing RPCs unchanged

### Settings label

"Show security warning on startup" with hint: "When enabled, the security warning is shown each time Klovi launches."

No way to re-trigger the full onboarding wizard.
