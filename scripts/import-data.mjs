/**
 * Script d'import des données depuis les CSVs de l'export Lovable.
 * Usage: node scripts/import-data.mjs <service_role_key>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const SERVICE_ROLE_KEY = process.argv[2];
const NEW_USER_ID = 'c8bc9be8-e38a-4cbf-8da4-8e1631d55349';
const OLD_USER_ID = 'c8bc9be8-e38a-4cbf-8da4-8e1631d55349';

const SUPABASE_URL = 'https://dsustgewihxibzfaaxte.supabase.co';

const EXPORT_DIR = join(__dirname, '../../claude-code-export/claude-code-export/database');
const INVOICES_DIR = join(__dirname, '../../claude-code-export/claude-code-export/invoices');

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node scripts/import-data.mjs <service_role_key>');
  console.error('Trouve la clé dans Supabase Dashboard → Settings → API → service_role');
  process.exit(1);
}

// service_role bypasse le RLS — nécessaire pour l'import initial
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- CSV Parser minimal (gère les champs entre guillemets) ---
function parseCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null]));
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current === '' ? null : current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current === '' ? null : current);
  return result;
}

// Remplace l'ancien user_id par le nouveau dans tous les champs string
function replaceUserId(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === 'string' ? v.replaceAll(OLD_USER_ID, NEW_USER_ID) : v
    ])
  );
}

// Nettoie les champs vides → null, parse les booleans et numbers
function cleanRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (v === '' || v === 'NULL') return [k, null];
      if (v === 't' || v === 'true') return [k, true];
      if (v === 'f' || v === 'false') return [k, false];
      return [k, v];
    })
  );
}

async function importTable(tableName, filePath, transform = (r) => r) {
  const rows = parseCSV(filePath).map(r => transform(cleanRow(replaceUserId(r))));
  if (rows.length === 0) { console.log(`  ${tableName}: aucune donnée`); return; }

  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`  ❌ ${tableName}: ${error.message}`);
    console.error('     Détail:', error.details || error.hint || '');
  } else {
    console.log(`  ✅ ${tableName}: ${rows.length} lignes importées`);
  }
}

async function uploadInvoices() {
  const files = readdirSync(INVOICES_DIR);
  let ok = 0, skip = 0, fail = 0;

  for (const filename of files) {
    const filePath = join(INVOICES_DIR, filename);
    const storagePath = `${NEW_USER_ID}/${filename}`;

    // Vérifie si déjà présent
    const { data: existing } = await supabase.storage.from('invoices').list(NEW_USER_ID, {
      search: filename
    });
    if (existing && existing.length > 0) { skip++; continue; }

    const fileBuffer = readFileSync(filePath);
    const { error } = await supabase.storage.from('invoices').upload(storagePath, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: false
    });
    if (error) { console.error(`  ❌ ${filename}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`  ✅ Factures uploadées: ${ok} | déjà présentes: ${skip} | erreurs: ${fail}`);
}

async function assignAdminRole() {
  const { error } = await supabase.from('user_roles').upsert(
    { user_id: NEW_USER_ID, role: 'admin' },
    { onConflict: 'user_id,role' }
  );
  if (error) console.error(`  ❌ user_roles: ${error.message}`);
  else console.log(`  ✅ Rôle admin assigné à ${NEW_USER_ID}`);
}

// --- Main ---
console.log(`\n🚀 Import Invoice Genius`);
console.log(`   User ID: ${NEW_USER_ID}\n`);

console.log('📋 Import des tables...');
await importTable('invoices', join(EXPORT_DIR, 'invoices.csv'));
await importTable('assets', join(EXPORT_DIR, 'assets.csv'));
await importTable('partnership_reimbursements', join(EXPORT_DIR, 'partnership_reimbursements.csv'));
await importTable('tax_documents', join(EXPORT_DIR, 'tax_documents.csv'));

console.log('\n📁 Upload des fichiers de factures...');
await uploadInvoices();

console.log('\n🔑 Assignation du rôle admin...');
await assignAdminRole();

console.log('\n✨ Terminé! Lance maintenant: npm run dev');
