# Notify → Command Center

Android app that reads incoming phone notifications and forwards them to your
Command Center for triage. Captured notifications appear in the **Phone
notifications** widget on the dashboard, where you can dismiss, snooze, or send
one to **Right Now** as a task (routed through the AI capture layer).

## How it works

```
Notification posted → NotificationListenerService → filter (allow/block + master)
   → Room queue (survives offline) → WorkManager → POST /api/notify (Bearer token)
```

- **Capture**: `CaptureListenerService` reads app, title, body, timestamp, and any
  URL found in the text. Ongoing/group-summary notifications are skipped.
- **Filter**: per-app allow/block list + a master on/off, all evaluated on-device
  (`Prefs.shouldCapture`). Two modes — block-list (capture all but X) or allow-list
  (capture only X).
- **Queue**: every capture is written to a local Room DB first, so nothing is lost
  if the network is down. `SyncWorker` flushes it (immediately + every 15 min).
- **Auth**: each request carries `Authorization: Bearer <NOTIFY_TOKEN>`. The server
  exempts `/api/notify` from the site password and checks the token instead.
- **Survives reboot**: the system rebinds the listener after boot; `BootReceiver`
  nudges it and re-schedules the periodic sync.

## One-time setup

### 1. Server side (Command Center)
1. Generate a token: `openssl rand -hex 32`
2. Add it to the VPS `.env`: `NOTIFY_TOKEN=<that value>`
3. Make sure the `Caddyfile` exempts `/api/notify` from `basic_auth` (already done
   in the repo — the `@notify` block). If you'd previously pasted your password
   hash into the old single-block Caddyfile, move it into the `handle { ... }`
   block so the ingest path stays open.
4. Redeploy: `cd /opt/command-center && git pull && docker compose up -d --build`

### 2. Build & install the app
1. Open this `android-notify/` folder in **Android Studio** (it will sync Gradle
   and generate anything missing).
   - Or from the CLI:
     `JAVA_HOME="<Android Studio>/jbr" ./gradlew :app:assembleDebug`
     (APK lands in `app/build/outputs/apk/debug/`).
2. Install on your Pixel / phone (Run ▶, or `adb install -r app-debug.apk`).

### 3. Configure in the app
1. **Command Center URL**: `https://command.lupusvex.com`
2. **Notify token**: paste the same `NOTIFY_TOKEN`.
3. Tap **Save**, then **Test** — you should see "Connected ✓".
4. Tap **Grant notification access** → enable "Notify → Command Center".
5. Tap **Ignore battery optimization** → allow (keeps capture reliable).
6. **Manage apps**: as notifications start arriving, the apps that sent them show
   up here with per-app toggles.

## Notes / known limits
- "Action links" = any `http(s)` URL found in the notification text. Android does
  not expose a notification's tap-target URL to listeners, so deep links inside a
  PendingIntent can't be captured — only URLs present in the visible text.
- Some OEM skins (Samsung, Xiaomi) are aggressive about killing background apps;
  the battery-optimization exemption + the system's listener rebinding handle the
  common cases, but if capture stops after days idle, re-check those settings.
- `local.properties` (your SDK path) is git-ignored; Android Studio creates it.
