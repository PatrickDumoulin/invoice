/**
 * One-time script to get a Gmail OAuth2 refresh token for Invoice Genius.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use an existing one)
 *   3. Enable "Gmail API"
 *   4. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
 *      - Application type: "Web application"
 *      - Authorized redirect URIs: http://localhost:3000/oauth2callback
 *   5. Copy the Client ID and Client Secret below (or pass as env vars)
 *
 * Run:
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/gmail-auth.js
 *
 * After completion, add these secrets to Supabase:
 *   supabase secrets set GMAIL_CLIENT_ID=...
 *   supabase secrets set GMAIL_CLIENT_SECRET=...
 *   supabase secrets set GMAIL_REFRESH_TOKEN=...
 *   supabase secrets set GMAIL_USER_EMAIL=patrick@sonoria.ca
 *   supabase secrets set INVOICE_GENIUS_USER_ID=<your Supabase user UUID>
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET env vars.");
  console.error("Run: GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/gmail-auth.js");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent"); // Force refresh token issuance

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl.toString());
console.log("\nWaiting for authorization on http://localhost:3000 ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");

  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400);
    res.end(`<h1>Authorization denied: ${error}</h1>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end("<h1>No authorization code received.</h1>");
    server.close();
    return;
  }

  // Exchange authorization code for tokens
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString();

  const tokens = await new Promise((resolve, reject) => {
    const options = {
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => resolve(JSON.parse(data)));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Authorization successful! You can close this tab.</h1>");
  server.close();

  if (!tokens.refresh_token) {
    console.error("\nNo refresh token received. Make sure you passed prompt=consent.");
    console.error("Response:", JSON.stringify(tokens, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Success! Run these commands to add secrets to Supabase:\n");
  console.log(`supabase secrets set GMAIL_CLIENT_ID="${CLIENT_ID}"`);
  console.log(`supabase secrets set GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`);
  console.log(`supabase secrets set GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
  console.log(`supabase secrets set GMAIL_USER_EMAIL="patrick@sonoria.ca"`);
  console.log(`supabase secrets set INVOICE_GENIUS_USER_ID="<votre UUID Supabase>"`);
  console.log("\nKeep the refresh token secure — it grants read/label access to your Gmail.");
});

server.listen(3000, () => {});
