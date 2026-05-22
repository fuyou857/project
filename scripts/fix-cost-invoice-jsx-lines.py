#!/usr/bin/env python3
from pathlib import Path

CD = "</" + "div>"
CM = "</" + "motion.div>"

ws = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice/CostInvoiceEntryWorkspace.tsx")
lines = ws.read_text().splitlines()

lines[283] = "        " + CD
lines[290] = "            " + CD
lines[291] = '            <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">'
lines[292] = '              <div className="text-lg font-semibold text-amber-700 tabular-nums">{stats.missing}</div>'
lines[293] = '              <div className="text-amber-800/80">待补全</div>'
lines[294] = "            </div>"
lines[295] = "            <div"
lines[304] = '              <div className="text-sm font-medium">{statusLabel(ocrUiStatus)}</div>'
lines[305] = "              <div>状态</div>"
lines[306] = "            </div>"
lines[307] = "          </div>"
lines[634] = "        " + CM
lines[635] = "      " + CD
lines[666] = "        " + CD
lines[684] = "        " + CD
lines[685] = "      " + CD

ws.write_text("\n".join(lines) + "\n")

pp = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice/InvoicePreviewPanel.tsx")
pt = pp.read_text()
pt = pt.replace("            />\n          </motion.div>\n        ) : current ? (", "            />\n          " + CD + "\n        ) : current ? (", 1)
pt = pt.replace("            </a>\n          </motion.div>\n        ) : (", "            </a>\n          " + CD + "\n        ) : (", 1)
pp.write_text(pt)
print("done")
