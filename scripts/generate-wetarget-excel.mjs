import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from("wetarget_leads_staging")
    .select("*")
    .order("job_created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }

  console.log(`Fetched ${data.length} leads total`);

  const sectors = {
    LOGISTIEK: [],
    TRANSPORT: [],
    TECHNIEK: [],
  };

  for (const row of data) {
    const sectorData = {
      "Voornaam": row.first_name || "",
      "Achternaam": row.last_name || "",
      "Email": row.email,
      "Bedrijf": row.company_name || "",
      "Stad": row.city || "",
      "Provincie": row.state || "",
      "Postcode": row.postal_code || "",
      "Vacature": row.job_title || "",
      "Vacature Datum": row.job_created_at
        ? new Date(row.job_created_at).toLocaleDateString("nl-NL")
        : "",
    };
    if (sectors[row.sector]) {
      sectors[row.sector].push(sectorData);
    }
  }

  const wb = XLSX.utils.book_new();

  for (const [sector, rows] of Object.entries(sectors)) {
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...rows.map((r) => String(r[key] || "").length)
      ),
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sector);
    console.log(`${sector}: ${rows.length} leads`);
  }

  const outputPath = "wetarget-leads.xlsx";
  XLSX.writeFile(wb, outputPath);
  console.log(`\nExcel saved to: ${outputPath}`);
}

main().catch(console.error);
