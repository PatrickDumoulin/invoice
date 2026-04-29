import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAIL_LABEL_NAME = "Invoice Genius";
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// ─── Gmail helpers ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Gmail token refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

async function getOrCreateLabel(token: string): Promise<string> {
  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { labels } = await listRes.json();
  const existing = labels?.find((l: { name: string; id: string }) => l.name === GMAIL_LABEL_NAME);
  if (existing) return existing.id;

  const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: GMAIL_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error("Failed to create Gmail label: " + JSON.stringify(created));
  return created.id;
}

async function searchMessages(token: string, labelId: string): Promise<string[]> {
  // Attachments only, excluding already-processed emails
  const query = `has:attachment -label:${GMAIL_LABEL_NAME}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

async function getMessage(token: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function downloadAttachment(
  token: string,
  messageId: string,
  part: { body: { attachmentId?: string; data?: string; size: number } }
): Promise<Uint8Array> {
  // Large attachments: fetch by ID. Small ones: already inline as base64url.
  let base64url: string;

  if (part.body.attachmentId) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    base64url = data.data;
  } else {
    base64url = part.body.data ?? "";
  }

  // base64url → Uint8Array
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function markAsProcessed(token: string, messageId: string, labelId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

// Recursively collect all MIME parts that have an attachment
function collectAttachmentParts(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const parts: unknown[] = [];

  if (Array.isArray(p.parts)) {
    for (const child of p.parts) {
      parts.push(...collectAttachmentParts(child));
    }
  }

  const body = p.body as Record<string, unknown> | undefined;
  if (body && (body.attachmentId || body.data) && (body.size as number) > 0) {
    parts.push(payload);
  }

  return parts;
}

// ─── SHA-256 hash ─────────────────────────────────────────────────────────────

async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userId = Deno.env.get("INVOICE_GENIUS_USER_ID")!;
  if (!userId) {
    return new Response(JSON.stringify({ error: "INVOICE_GENIUS_USER_ID not configured" }), { status: 500 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const gmailToken = await getAccessToken();
    const labelId = await getOrCreateLabel(gmailToken);
    const messageIds = await searchMessages(gmailToken, labelId);

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const messageId of messageIds) {
      try {
        const message = await getMessage(gmailToken, messageId);
        const allParts = collectAttachmentParts(message.payload) as Array<{
          mimeType: string;
          filename: string;
          body: { attachmentId?: string; data?: string; size: number };
        }>;

        const invoiceParts = allParts.filter(
          (p) => ACCEPTED_MIME_TYPES.includes(p.mimeType) && p.filename
        );

        if (invoiceParts.length === 0) {
          await markAsProcessed(gmailToken, messageId, labelId);
          skipped++;
          continue;
        }

        for (const part of invoiceParts) {
          const bytes = await downloadAttachment(gmailToken, messageId, part);
          const hash = await sha256hex(bytes);

          // Duplicate check
          const { data: existing } = await supabase
            .from("invoices")
            .select("id")
            .eq("file_hash", hash)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // Upload to Supabase Storage
          const safeName = part.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${userId}/${Date.now()}_${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("invoices")
            .upload(filePath, bytes, { contentType: part.mimeType, upsert: false });

          if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

          // Insert invoice with pending_review
          const { data: invoice, error: dbError } = await supabase
            .from("invoices")
            .insert({
              user_id: userId,
              type: "expense",
              file_name: part.filename,
              file_path: filePath,
              file_hash: hash,
              status: "pending_review",
              currency: "CAD",
              is_partnership: false,
              partnership_reimbursed: 0,
              expense_owner: "Patrick",
            })
            .select()
            .single();

          if (dbError) throw new Error(`DB insert: ${dbError.message}`);

          // Trigger Claude analysis asynchronously — status stays pending_review
          supabase.functions
            .invoke("analyze-invoice", {
              body: { invoiceId: invoice.id, userId },
            })
            .catch((e) => console.error(`analyze-invoice error for ${invoice.id}:`, e));

          processed++;
        }

        await markAsProcessed(gmailToken, messageId, labelId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Message ${messageId} error:`, msg);
        errors.push(`${messageId}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, skipped, errors, total: messageIds.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-email-invoices fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
