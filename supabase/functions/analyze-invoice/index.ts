import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Bank of Canada Valet series codes
const BOC_SERIES: Record<string, string> = {
  USD: "FXUSDCAD",
  EUR: "FXEURCAD",
  GBP: "FXGBPCAD",
  AUD: "FXAUDCAD",
  JPY: "FXJPYCAD",
  CHF: "FXCHFCAD",
  MXN: "FXMXNCAD",
};

async function getForeignToCadRate(
  currency: string,
  invoiceDate?: string
): Promise<{ rate: number; source: string; rateDate: string }> {
  const series = BOC_SERIES[currency];
  if (series) {
    try {
      let url: string;
      if (invoiceDate) {
        const d = new Date(invoiceDate);
        const start = new Date(d);
        start.setDate(start.getDate() - 7);
        const startStr = start.toISOString().split("T")[0];
        url = `https://www.bankofcanada.ca/valet/observations/${series}/json?start_date=${startStr}&end_date=${invoiceDate}`;
      } else {
        url = `https://www.bankofcanada.ca/valet/observations/${series}/json?recent=1`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const obs = data.observations;
        if (obs && obs.length > 0) {
          const last = obs[obs.length - 1];
          const rate = parseFloat(last[series].v);
          if (!isNaN(rate) && rate > 0) {
            return { rate, source: "Banque du Canada", rateDate: last.d };
          }
        }
      }
    } catch (e) {
      console.error(`BdC API error for ${currency}:`, e);
    }
  }

  // Fallback: open.er-api.com
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.CAD;
      if (rate) return { rate, source: "open.er-api.com", rateDate: new Date().toISOString().split("T")[0] };
    }
  } catch (e) {
    console.error("Fallback FX fetch failed:", e);
  }

  const fallbacks: Record<string, number> = {
    USD: 1.44, EUR: 1.55, GBP: 1.80, AUD: 0.95, JPY: 0.0095, CHF: 1.60, MXN: 0.08,
  };
  return { rate: fallbacks[currency] ?? 1.0, source: "fallback", rateDate: "" };
}

function parseSpreadsheetToText(arrayBuffer: ArrayBuffer): string {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    lines.push(`=== Sheet: ${sheetName} ===`);
    lines.push(XLSX.utils.sheet_to_csv(sheet));
    lines.push("");
  }
  return lines.join("\n");
}

function getExt(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "extract_invoice_data",
  description: "Extract structured data from an invoice document",
  input_schema: {
    type: "object" as const,
    properties: {
      company_name: {
        type: "string",
        description:
          "For EXPENSE: vendor/supplier name. For REVENUE: client/customer name (NOT the issuer).",
      },
      invoice_date: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
      amount: {
        type: "number",
        description: "Total amount INCLUDING taxes as a number (no currency symbol)",
      },
      currency: {
        type: "string",
        enum: ["CAD", "USD", "EUR", "GBP", "AUD", "JPY", "CHF", "MXN"],
        description: "Currency code — detect from the invoice, default CAD",
      },
      description: { type: "string", description: "Brief description of what the invoice is for" },
      tps_amount: {
        type: "number",
        description: "TPS/GST amount (5% federal tax). 0 if not present.",
      },
      tvq_amount: {
        type: "number",
        description: "TVQ/QST amount (9.975% Quebec tax). 0 if not present.",
      },
      expense_category: {
        type: ["string", "null"] as unknown as "string",
        enum: [
          "production", "logiciels", "marketing", "hebergement", "automatisation",
          "formation", "equipement", "telecom", "deplacements", "repas", "services_pro",
          "assurances", "frais_financiers", "frais_admin", "bureau", "salaires",
          "taxes_non_recup", null,
        ] as string[],
        description:
          "Expense category for EXPENSE invoices. null for REVENUE invoices. " +
          "production=subcontractors/devs/designers, logiciels=SaaS/APIs/subscriptions, " +
          "marketing=ads/leadgen/coldEmail, hebergement=servers/cloud/domains, " +
          "automatisation=n8n/Make/scripts, formation=courses/books/R&D, " +
          "equipement=computers/hardware, telecom=phone/internet, " +
          "deplacements=transport/travel, repas=meals (50% deductible), " +
          "services_pro=accounting/legal, assurances=business insurance, " +
          "frais_financiers=bank/Stripe/FX fees, frais_admin=office supplies, " +
          "bureau=rent/coworking/electricity, salaires=payroll, taxes_non_recup=foreign taxes",
      },
    },
    required: [
      "company_name", "invoice_date", "amount", "currency",
      "description", "tps_amount", "tvq_amount", "expense_category",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are an expert invoice data extraction assistant for a Quebec-based business.
Extract the required fields precisely from the provided invoice.

Key rules:
- For EXPENSE invoices: company_name = the VENDOR (who you paid).
- For REVENUE invoices: company_name = the CLIENT (who paid you), NOT your own company.
- TPS = GST = 5% federal Canadian tax.
- TVQ = QST = 9.975% Quebec provincial tax.
- If taxes are included in the total but not listed separately, set tps_amount and tvq_amount to 0.
- Detect currency from the invoice ($ signs, explicit "USD/CAD", country context).
- You MUST call the extract_invoice_data function. Do not reply with plain text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse body first — needed before auth for internal server-to-server calls
    const body = await req.json();
    const { invoiceId, userId: requestUserId } = body;

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: user JWT (frontend calls) or service role key (internal Edge Function calls)
    const authToken = authHeader.replace("Bearer ", "");
    let userId: string;

    if (authToken === serviceKey) {
      if (!requestUserId) {
        return new Response(JSON.stringify({ error: "userId required for internal calls" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = requestUserId;
    } else {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user }, error: userError } = await anonClient.auth.getUser(authToken);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("invoices")
      .download(invoice.file_path!);

    if (fileError || !fileData) {
      await supabase.from("invoices").update({ status: "error" }).eq("id", invoiceId);
      return new Response(JSON.stringify({ error: "Could not download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const ext = getExt(invoice.file_name ?? "file.pdf");
    const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext);
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);

    const client = new Anthropic({ apiKey: anthropicKey });

    let userContent: Anthropic.MessageParam["content"];

    if (isSpreadsheet) {
      const text = parseSpreadsheetToText(arrayBuffer);
      userContent = [
        {
          type: "text",
          text: `Extract invoice data from this spreadsheet. Invoice type: ${invoice.type}\n\n${text}`,
        },
      ];
    } else if (isImage) {
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let j = 0; j < bytes.length; j += 8192) {
        binary += String.fromCharCode(...bytes.subarray(j, j + 8192));
      }
      const base64 = btoa(binary);
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", gif: "image/gif",
      };
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: (mimeMap[ext] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        },
        {
          type: "text",
          text: `Extract invoice data from this image. Invoice type: ${invoice.type}`,
        },
      ];
    } else {
      // PDF (default)
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let j = 0; j < bytes.length; j += 8192) {
        binary += String.fromCharCode(...bytes.subarray(j, j + 8192));
      }
      const base64 = btoa(binary);
      userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as unknown as Anthropic.TextBlockParam,
        {
          type: "text",
          text: `Extract invoice data from this PDF. Invoice type: ${invoice.type}`,
        },
      ];
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: "extract_invoice_data" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      await supabase.from("invoices").update({ status: "error" }).eq("id", invoiceId);
      return new Response(JSON.stringify({ error: "AI could not extract data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = toolUse.input as {
      company_name: string;
      invoice_date: string;
      amount: number;
      currency: string;
      description: string;
      tps_amount: number;
      tvq_amount: number;
      expense_category: string | null;
    };

    let amountCad = extracted.amount;
    let exchangeRate = 1.0;
    let exchangeSource = "CAD";
    let exchangeRateDate = "";

    if (extracted.currency && extracted.currency !== "CAD") {
      const rateInfo = await getForeignToCadRate(extracted.currency, extracted.invoice_date);
      exchangeRate = rateInfo.rate;
      exchangeSource = rateInfo.source;
      exchangeRateDate = rateInfo.rateDate;
      amountCad = extracted.amount * exchangeRate;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        company_name: extracted.company_name,
        invoice_date: extracted.invoice_date,
        amount: extracted.amount,
        currency: extracted.currency,
        description: extracted.description,
        amount_cad: amountCad,
        exchange_rate: exchangeRate,
        tps_amount: extracted.tps_amount ?? 0,
        tvq_amount: extracted.tvq_amount ?? 0,
        expense_category: extracted.expense_category ?? null,
        raw_extraction: extracted,
        status: invoice.status === "pending_review" ? "pending_review" : "processed",
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save extraction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...extracted,
          amount_cad: amountCad,
          exchange_rate: exchangeRate,
          exchange_source: exchangeSource,
          exchange_rate_date: exchangeRateDate,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
