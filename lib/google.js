// Google OAuth + Gmail (read/modify) + Calendar (write), both accounts.
import { google } from "googleapis";
import { getDb } from "./db.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** Consent URL; state carries which account ('personal'|'work') is being connected. */
export function getAuthUrl(account) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: SCOPES,
    state: account,
    include_granted_scopes: true,
  });
}

function saveTokens(account, email, tokens) {
  const db = getDb();
  const existing = db.prepare("SELECT refresh_token, email FROM google_tokens WHERE account=?").get(account);
  const refresh = tokens.refresh_token || (existing && existing.refresh_token) || null;
  db.prepare(
    `INSERT INTO google_tokens (account,email,access_token,refresh_token,expiry,scope,updated_at)
     VALUES (@account,@email,@access_token,@refresh_token,@expiry,@scope,datetime('now'))
     ON CONFLICT(account) DO UPDATE SET
       email=excluded.email, access_token=excluded.access_token,
       refresh_token=excluded.refresh_token, expiry=excluded.expiry,
       scope=excluded.scope, updated_at=datetime('now')`
  ).run({
    account,
    email: email || (existing && existing.email) || null,
    access_token: tokens.access_token || null,
    refresh_token: refresh,
    expiry: tokens.expiry_date || null,
    scope: tokens.scope || SCOPES.join(" "),
  });
}

/** Exchange the OAuth code, look up the email, persist tokens. */
export async function handleCallback(code, account) {
  const c = oauthClient();
  const { tokens } = await c.getToken(code);
  c.setCredentials(tokens);
  let email = null;
  try {
    const oa = google.oauth2({ version: "v2", auth: c });
    email = (await oa.userinfo.get()).data.email;
  } catch {}
  saveTokens(account, email, tokens);
  return { email };
}

export function getTokenRow(account) {
  return getDb().prepare("SELECT * FROM google_tokens WHERE account=?").get(account);
}
export function connectionStatus() {
  return ["personal", "work"].map((a) => {
    const r = getTokenRow(a);
    return { account: a, connected: !!(r && r.refresh_token), email: r && r.email, updated_at: r && r.updated_at };
  });
}

/** Authenticated client that auto-refreshes and persists new tokens. */
export function getAuthedClient(account) {
  const row = getTokenRow(account);
  if (!row || !row.refresh_token) throw new Error(`Account "${account}" not connected`);
  const c = oauthClient();
  c.setCredentials({ access_token: row.access_token, refresh_token: row.refresh_token, expiry_date: row.expiry });
  c.on("tokens", (t) => {
    const cur = getTokenRow(account) || {};
    saveTokens(account, cur.email, { ...t, refresh_token: t.refresh_token || cur.refresh_token });
  });
  return c;
}

export function gmail(account) { return google.gmail({ version: "v1", auth: getAuthedClient(account) }); }
export function calendar(account) { return google.calendar({ version: "v3", auth: getAuthedClient(account) }); }

// ---------- Gmail ----------
function header(payload, name) {
  const h = (payload.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}
function decodeBody(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body && payload.body.data)
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  for (const p of payload.parts || []) {
    const t = decodeBody(p);
    if (t) return t;
  }
  if (payload.body && payload.body.data) return Buffer.from(payload.body.data, "base64").toString("utf8");
  return "";
}

/** List inbox messages with key headers. */
export async function listInbox(account, max = 120) {
  const g = gmail(account);
  const list = await g.users.messages.list({ userId: "me", q: "in:inbox", maxResults: max });
  const ids = (list.data.messages || []).map((m) => m.id);
  const out = [];
  for (const id of ids) {
    const m = await g.users.messages.get({
      userId: "me", id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"],
    });
    out.push({
      id, threadId: m.data.threadId, account,
      sender: header(m.data.payload, "From"),
      subject: header(m.data.payload, "Subject"),
      snippet: m.data.snippet || "",
      date: header(m.data.payload, "Date"),
      labelIds: m.data.labelIds || [],
    });
  }
  return out;
}

export async function getBody(account, id) {
  const m = await gmail(account).users.messages.get({ userId: "me", id, format: "full" });
  return (decodeBody(m.data.payload) || m.data.snippet || "").slice(0, 4000);
}

/** Reversible inbox actions (real Gmail). */
export async function modifyMessage(account, id, { add = [], remove = [] }) {
  await gmail(account).users.messages.modify({ userId: "me", id, requestBody: { addLabelIds: add, removeLabelIds: remove } });
}
export const archiveMsg = (a, id) => modifyMessage(a, id, { remove: ["INBOX"] });
export const doneMsg = (a, id) => modifyMessage(a, id, { remove: ["INBOX", "UNREAD"] });
export const spamMsg = (a, id) => modifyMessage(a, id, { add: ["SPAM"], remove: ["INBOX"] });
export const restoreMsg = (a, id) => modifyMessage(a, id, { add: ["INBOX"], remove: ["SPAM"] });

// ---------- Calendar ----------
export async function createEvent(account, { summary, location, description, start, end, timeZone = "America/New_York" }) {
  const res = await calendar(account).events.insert({
    calendarId: "primary",
    requestBody: { summary, location, description, start: { dateTime: start, timeZone }, end: { dateTime: end, timeZone } },
  });
  return res.data; // has .id (gcal_event_id)
}
export async function listEvents(account, timeMin, timeMax) {
  const res = await calendar(account).events.list({
    calendarId: "primary", timeMin, timeMax, singleEvents: true, orderBy: "startTime", maxResults: 50,
  });
  return res.data.items || [];
}
