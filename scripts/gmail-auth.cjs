/**
 * One-time script to get a Gmail OAuth2 refresh token for Invoice Genius.
 * Run: node scripts/gmail-auth.cjs
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
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOuvre cette URL dans ton navigateur :\n");
console.log(authUrl.toString());
console.log("\nEn attente de l'autorisation sur http://localhost:3000 ...\n");

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
    res.end(`<h1>Autorisation refusée : ${error}</h1>`);
    server.close();
    process.exit(1);
  }

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
  res.end("<h1>Autorisation réussie ! Tu peux fermer cet onglet.</h1>");
  server.close();

  if (!tokens.refresh_token) {
    console.error("\nPas de refresh token reçu :", JSON.stringify(tokens, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Succès ! Lance ces commandes dans ton terminal :\n");
  console.log(`supabase secrets set GMAIL_CLIENT_ID="${CLIENT_ID}"`);
  console.log(`supabase secrets set GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`);
  console.log(`supabase secrets set GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
  console.log(`supabase secrets set GMAIL_USER_EMAIL="patrick@sonoria.ca"`);
  console.log(`supabase secrets set INVOICE_GENIUS_USER_ID="c8bc9be8-e38a-4cbf-8da4-8e1631d55349"`);
  console.log("\nGarde le refresh token secret — il donne accès à ton Gmail.");
  process.exit(0);
});

server.listen(3000, () => {});
