#!/usr/bin/env python3
from pathlib import Path
import re

CD = "</" + "div>"
CM = "</" + "motion.div>"

def main():
    p = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice/CostInvoiceEntryWorkspace.tsx")
    t = p.read_text()

    t = t.replace(
        "onOptimizedFile={(f) => void processFiles([f])}\n          />\n        </motion.div>",
        "onOptimizedFile={(f) => void processFiles([f])}\n          />\n        " + CD,
    )

    stats = "\n".join([
        '          <motion.div className="grid grid-cols-3 gap-2 text-center text-xs">',
    ])
    stats = "\n".join([
        '          <div className="grid grid-cols-3 gap-2 text-center text-xs">',
        '            <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2">',
        '              <div className="text-lg font-semibold text-emerald-700 tabular-nums">{stats.success}</div>',
        '              <div className="text-emerald-800/80">已识别</div>',
        "            </div>",
        '            <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">',
        '              <div className="text-lg font-semibold text-amber-700 tabular-nums">{stats.missing}</div>',
        '              <div className="text-amber-800/80">待补全</motion.div>',
        "            </div>",
        "            <div",
        '              className={`rounded-lg border py-2 ${',
        "                ocrUiStatus === 'failed'",
        "                  ? 'bg-red-50 border-red-200 text-red-700'",
        "                  : ocrUiStatus === 'success'",
        "                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'",
        "                    : 'bg-slate-50 border-slate-200 text-slate-600'",
        "              }`}",
        "            >",
        '              <div className="text-sm font-medium">{statusLabel(ocrUiStatus)}</div>',
        "              <div>状态</div>",
        "            </div>",
        "          </div>",
    ])
    stats = stats.replace(CM, CD)

    t = re.sub(
        r'          <div className="grid grid-cols-3 gap-2 text-center text-xs">.*?\n\n          \{\(ocrWarnings',
        stats + "\n          {(ocrWarnings",
        t,
        count=1,
        flags=re.S,
    )

    t = t.replace(
        "        </motion.div>\n      </motion.div>\n\n      <div className=\"flex flex-wrap items-center justify-between gap-3 pt-4 border-t",
        "        </motion.div>\n      " + CD + "\n\n      <div className=\"flex flex-wrap items-center justify-between gap-3 pt-4 border-t",
    )
    t = t.replace(
        "<FaEraser /> 清空表单\n          </button>\n        </motion.div>\n        <div className=\"flex gap-2\">",
        "<FaEraser /> 清空表单\n          </button>\n        " + CD + "\n        <div className=\"flex gap-2\">",
    )
    t = t.replace(
        "{editing ? '保存入库' : '提交入库'}\n          </button>\n        </motion.div>\n      </motion.div>\n    </form>",
        "{editing ? '保存入库' : '提交入库'}\n          </button>\n        " + CD + "\n      " + CD + "\n    </form>",
    )
    t = t.replace("<motion.details", "<details").replace("</motion.details>", "</details>")
    t = t.replace(
        "key === 'invoice_amount' ? 'subtotal_amount' : key,\n                      key !== 'amount_in_words',",
        "(key === 'invoice_amount' ? 'subtotal_amount' : key) as InvoiceOcrFieldKey,\n                      key !== 'amount_in_words',",
    )

    p.write_text(t)

    a = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice/applyOcrToForm.ts")
    at = a.read_text()
    at = at.replace(
        "  setNum('invoice_amount', data.invoice_amount, 'invoice_amount');\n",
        "  if (data.invoice_amount != null && !Number.isNaN(data.invoice_amount)) {\n"
        "    next.invoice_amount = data.invoice_amount;\n  }\n",
    )
    a.write_text(at)

    pp = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice/InvoicePreviewPanel.tsx")
    pt = pp.read_text()
    pt = pt.replace("            />\n          </motion.div>\n        ) : current ? (", "            />\n          " + CD + "\n        ) : current ? (", 1)
    pt = pt.replace("            </a>\n          </motion.div>\n        ) : (", "            </a>\n          " + CD + "\n        ) : (", 1)
    pp.write_text(pt)
    print("done", len(t.splitlines()))


if __name__ == "__main__":
    main()
