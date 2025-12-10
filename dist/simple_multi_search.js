import fs from "fs";
import axios from "axios";
import readline from "readline";
import { config as dotenvConfig } from "dotenv";
import { Command } from "commander";
// Load .env
dotenvConfig();
const API_KEY = "AIzaSyBLgVWubZePLdM3JhFLmcTqaMqG5ECSbgc";
const CX = "57bee4b33867c41c3";
const URL = "https://www.googleapis.com/customsearch/v1";
const program = new Command();
program
    .option("--query <q>", "Run a single query (non-interactive)")
    .option("--max <n>", "Max results to fetch (non-interactive)", "10");
program.parse(process.argv);
const options = program.opts();
function extractPersonName(title, link, snippet) {
    // Mirror Python logic
    let name = "N/A";
    if (title && link && link.toLowerCase().includes("linkedin")) {
        let cleanTitle = title.replace(/\s*-\s*LinkedIn.*$/i, "");
        cleanTitle = cleanTitle.replace(/\s*\|\s*LinkedIn.*$/i, "");
        cleanTitle = cleanTitle.replace(/\s*on LinkedIn.*$/i, "");
        cleanTitle = cleanTitle.replace(/\s*-.*(?:at|@|,).*$/, "");
        cleanTitle = cleanTitle.replace(/\s*\|.*$/, "");
        if (cleanTitle.trim() && cleanTitle.trim().length > 2) {
            name = cleanTitle.trim();
        }
    }
    if (name === "N/A" && link && link.includes("/in/")) {
        try {
            const urlName = link.split("/in/").pop()?.split("/")[0].split("?")[0] ?? "";
            if (urlName && urlName !== "") {
                const formattedName = urlName.replace(/-/g, " ").replace(/\+/g, " ").replace(/%20/g, " ").replace(/\s+/g, " ").trim();
                const titled = formattedName.split(" ").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
                if (titled.split(/\s+/).length >= 2) {
                    name = titled;
                }
            }
        }
        catch {
            // ignore
        }
    }
    return name;
}
function createSafeFilename(query) {
    let safe = query.replace(/[<>:"/\\|?*]/g, "");
    safe = safe.replace(/\s+/g, "_").replace(/site:/gi, "").replace(/"/g, "");
    return safe.slice(0, 50);
}
async function getSearchResults(query, totalResults = 30) {
    const allResults = [];
    const resultsPerPage = 40;
    if (!API_KEY || !CX) {
        console.error("API key or CX not set. Please check your .env file (variables 'key' and 'cx').");
        return [];
    }
    console.log(`Searching for: '${query}'`);
    for (let startIndex = 1; startIndex <= totalResults; startIndex += resultsPerPage) {
        const remaining = totalResults - allResults.length;
        if (remaining <= 0)
            break;
        const num = Math.min(resultsPerPage, remaining);
        const params = {
            key: API_KEY,
            cx: CX,
            q: query,
            start: startIndex,
            num: num,
        };
        const endIndex = startIndex + num - 1;
        console.log(`Fetching results ${startIndex} to ${endIndex} (num=${num})...`);
        try {
            const resp = await axios.get(URL, { params, timeout: 15000 });
            if (resp.status !== 200) {
                console.error(`HTTP Error ${resp.status}: ${resp.statusText}`);
                break;
            }
            const data = resp.data;
            if (data && Array.isArray(data.items)) {
                allResults.push(...data.items);
            }
            else {
                if (data && typeof data === "object" && data.error) {
                    const msg = typeof data.error === "object" ? data.error.message ?? JSON.stringify(data.error) : String(data.error);
                    console.error(`API Error: ${msg}`);
                }
                else {
                    console.log("No more results found");
                }
                break;
            }
        }
        catch (err) {
            console.error("Error:", err.message ?? err);
            break;
        }
        if (allResults.length >= totalResults)
            break;
    }
    return allResults.slice(0, totalResults);
}
function formatGridTable(rows, headers) {
    // Simple text table similar to tabulate grid (not exact but readable)
    const cols = headers.length;
    const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ? String(r[i]).length : 0))));
    const line = "+" + colWidths.map(w => "-".repeat(w + 2)).join("+") + "+\n";
    const pad = (s, w) => " " + s + " ".repeat(w - s.length + 1);
    let out = line;
    out += "|" + headers.map((h, i) => pad(h, colWidths[i])).join("|") + "|\n";
    out += line;
    for (const r of rows) {
        out += "|" + r.map((c, i) => pad(String(c ?? ""), colWidths[i])).join("|") + "|\n";
    }
    out += line;
    return out;
}
function saveOrganizedResults(query, results) {
    if (!results || results.length === 0) {
        console.log("No results to save");
        return null;
    }
    const safeQuery = createSafeFilename(query);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
    const tableRows = [];
    results.forEach((item, idx) => {
        const title = item.title ?? "N/A";
        const link = item.link ?? item.formattedUrl ?? "N/A";
        const snippet = item.snippet ?? "N/A";
        const personName = extractPersonName(title, link, snippet);
        tableRows.push([String(idx + 1), personName, title, link, snippet]);
    });
    const detailedFile = `${safeQuery}_table_${timestamp}.txt`;
    const header = `Search Query: ${query}\nGenerated: ${new Date().toISOString().replace("T", " ").split(".")[0]}\nTotal Results: ${results.length}\n${"=".repeat(40)}\n\n`;
    const tableStr = formatGridTable(tableRows, ["#", "Name", "Title", "Link", "Snippet"]);
    fs.writeFileSync(detailedFile, header + tableStr, { encoding: "utf-8" });
    console.log(`Saved table format to: ${detailedFile}`);
    return detailedFile;
}
async function runNonInteractive(q, maxResults) {
    const results = await getSearchResults(q, maxResults);
    const out = [];
    for (const item of results) {
        const title = item.title ?? "";
        const link = item.link ?? item.formattedUrl ?? "";
        const snippet = item.snippet ?? "";
        const personName = extractPersonName(title, link, snippet);
        out.push({ name: personName, title, link, snippet });
    }
    process.stdout.write(JSON.stringify({ results: out }, null, 0));
}
async function runInteractive() {
    const institution = '("IIT Ropar" OR "Indian Institute of Technology Ropar")';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (prompt) => new Promise((res) => {
        rl.question(prompt, answer => res(answer));
    });
    const raw = (await question('Enter company names or keywords. Use semicolon/newline to separate companies; within a company use | or / or , to separate synonyms. Press Enter to search only the institute: ')).trim();
    rl.close();
    let queries = [];
    if (raw) {
        const groups = raw.split(/[;\n]+/).map(g => g.trim()).filter(Boolean);
        for (const g of groups) {
            const syns = g.split(/\s*(?:\||\/|,)\s*/).map(s => s.trim()).filter(Boolean);
            const quoted = syns.map(s => `"${s.replace(/"/g, "")}"`);
            if (quoted.length) {
                const companyClause = "(" + quoted.join(" OR ") + ")";
                queries.push(`site:linkedin.com/in ${institution} ${companyClause}`);
            }
        }
    }
    else {
        queries = [`site:linkedin.com/in ${institution}`];
    }
    console.log("Starting LinkedIn Profile Search with Separate File Storage\n");
    let i = 0;
    for (const query of queries) {
        i += 1;
        console.log("\n" + "=".repeat(60));
        console.log(`SEARCH ${i}: ${query}`);
        console.log("=".repeat(60));
        const results = await getSearchResults(query, 40);
        if (results && results.length) {
            const previewTable = [];
            for (let j = 0; j < Math.min(5, results.length); j++) {
                const item = results[j];
                const titleShort = (item.title ?? "N/A").slice(0, 50) + (item.title && item.title.length > 50 ? "..." : "");
                const personName = extractPersonName(item.title ?? "", item.link ?? item.formattedUrl ?? "", item.snippet ?? "");
                previewTable.push([String(j + 1), personName, titleShort]);
            }
            // pretty print preview
            console.log(`\nPreview (showing ${Math.min(5, results.length)}/${results.length} results):`);
            console.log(formatGridTable(previewTable, ["#", "Name", "Title"]));
            // Save to file
            saveOrganizedResults(query, results);
        }
        else {
            console.log("No results found");
        }
    }
    console.log(`\nSearch ${queries.length} completed!\n`);
    console.log("All searches completed! Check your directory for the generated files.");
}
// main
(async () => {
    if (options.query) {
        const q = String(options.query).trim();
        const maxResults = Math.max(1, Math.min(100, Number(options.max ?? 40)));
        await runNonInteractive(q, maxResults);
        process.exit(0);
    }
    else {
        await runInteractive();
    }
})();
