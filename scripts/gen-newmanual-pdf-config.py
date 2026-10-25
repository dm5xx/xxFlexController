#!/usr/bin/env python3
"""Generate public/newmanual.pdf-config.js with embedded D4C logo (from rh.pdf)."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parents[1]
pub = root / "public"
b64 = base64.b64encode((pub / "d4c-logo.png").read_bytes()).decode("ascii")

header = (
    '<div style="width:100%;padding:4px 14mm 0 14mm;box-sizing:border-box;">'
    f'<img src="data:image/png;base64,{b64}" style="height:28px;width:auto;opacity:0.92;" />'
    "</div>"
)
footer = (
    '<div style="width:100%;font-size:8px;color:#666;text-align:center;'
    'padding:0 14mm;box-sizing:border-box;">'
    "<span>Hercules Handbuch · D4C / DM5XX</span> · "
    '<span class="pageNumber"></span>/<span class="totalPages"></span></div>'
)

# Escape for JS single-quoted strings
def jq(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")

css_path = str(pub / "newmanual.css").replace("\\", "/")
js = f"""const path = require('path');
module.exports = {{
  stylesheet: [path.join(__dirname, 'newmanual.css')],
  basedir: __dirname,
  pdf_options: {{
    format: 'A4',
    printBackground: true,
    margin: {{ top: '22mm', bottom: '16mm', left: '14mm', right: '14mm' }},
    displayHeaderFooter: true,
    headerTemplate: '{jq(header)}',
    footerTemplate: '{jq(footer)}'
  }}
}};
"""
(pub / "newmanual.pdf-config.js").write_text(js, encoding="utf-8")
print("wrote", pub / "newmanual.pdf-config.js")
