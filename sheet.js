export async function handler(event, context) {
  // REPLACE with your sheet ID:
  const SHEET_ID = 'your_sheet_id_here';
  const CSV_URL = `https://docs.google.com/spreadsheets/d/1UInMmMBWA5zvcy4vwSf2XwtxpBqXASiNDkZ-S6Bv_Cg/export?format=csv`;

  try {
    const resp = await fetch(CSV_URL);
    if (!resp.ok) throw new Error(`Fetch error: ${resp.status}`);
    const csv = await resp.text();

    // Simple CSV to array parsing (no quoted commas supported)
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",");
    const rows = lines.slice(1).map(row =>
      row.split(",").reduce((acc, cell, i) => {
        acc[headers[i]] = cell;
        return acc;
      }, {})
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message || "Unknown error" }),
    };
  }
}