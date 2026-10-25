/**
 * Build public/newmanual.pdf from newmanual.md (rh.pdf-inspired branding).
 * Usage: node scripts/make-newmanual-pdf.js
 */
const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");

async function main()
{
    const pub = path.join(__dirname, "..", "public");
    const md = path.join(pub, "newmanual.md");
    const css = path.join(pub, "newmanual.css");
    const logo = path.join(pub, "d4c-logo.png");
    const out = path.join(pub, "newmanual.pdf");

    const b64 = fs.readFileSync(logo).toString("base64");
    const header =
        '<div style="width:100%;padding:4px 14mm 0 14mm;box-sizing:border-box;">' +
        '<img src="data:image/png;base64,' + b64 + '" style="height:28px;width:auto;opacity:0.92;" />' +
        "</div>";
    const footer =
        '<div style="width:100%;font-size:8px;color:#666;text-align:center;padding:0 14mm;box-sizing:border-box;">' +
        "<span>Hercules Handbuch · D4C / DM5XX</span> · " +
        '<span class="pageNumber"></span>/<span class="totalPages"></span></div>';

    const pdf = await mdToPdf(
        { path: md },
        {
            dest: out,
            stylesheet: [css],
            basedir: pub,
            pdf_options: {
                format: "A4",
                printBackground: true,
                margin: { top: "22mm", bottom: "16mm", left: "14mm", right: "14mm" },
                displayHeaderFooter: true,
                headerTemplate: header,
                footerTemplate: footer
            }
        }
    );

    if(!pdf || !pdf.filename)
        throw new Error("md-to-pdf failed");
    console.log("Wrote " + out + " (" + fs.statSync(out).size + " bytes)");
}

main().catch((err) =>
{
    console.error(err);
    process.exit(1);
});
