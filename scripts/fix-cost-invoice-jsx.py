#!/usr/bin/env python3
from pathlib import Path
import re

CD = "</" + "div>"
CM = "</" + "motion.div>"


def fix_workspace(p: Path) -> None:
    t = p.read_text()
    t = t.replace("from '../InvoiceEntry'", "from './types'")
    t = t.replace("INVOICE_OCR_FIELD_ORDER,\n  ", "")
    t = re.sub(r"\n// FormField wrapper[\s\S]*?function FormFieldWrapper[\s\S]*?\}\n\n", "\n", t)

    t = t.replace(
        "onOptimizedFile={(f) => void processFiles([f])}\n          />\n        </motion.div>",
        "onOptimizedFile={(f) => void processFiles([f])}\n          />\n        " + CD,
    )

    stats_new = (
        '          <motion.div className="grid grid-cols-3 gap-2 text-center text-xs">\n'
    )
    stats_new = (
        '          <div className="grid grid-cols-3 gap-2 text-center text-xs">\n'
        '            <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2">\n'
        '              <div className="text-lg font-semibold text-emerald-700 tabular-nums">{stats.success}</div>\n'
        '              <div className="text-emerald-800/80">已识别</div>\n'
        "            </div>\n"
        '            <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">\n'
        '              <div className="text-lg font-semibold text-amber-700 tabular-nums">{stats.missing}</div>\n'
        '              <motion.div className="text-amber-800/80">待补全</motion.div>\n'
        "            </motion.div>\n"
    )
    # fix typo in stats - rewrite clean
    stats_new = (
        '          <div className="grid grid-cols-3 gap-2 text-center text-xs">\n'
        '            <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2">\n'
        '              <div className="text-lg font-semibold text-emerald-700 tabular-nums">{stats.success}</div>\n'
        '              <div className="text-emerald-800/80">已识别</div>\n'
        "            </div>\n"
        '            <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">\n'
        '              <div className="text-lg font-semibold text-amber-700 tabular-nums">{stats.missing}</div>\n'
        '              <div className="text-amber-800/80">待补全</div>\n'
        "            </div>\n"
        '            <div\n'
        '              className={`rounded-lg border py-2 ${\n'
        "                ocrUiStatus === 'failed'\n"
        "                  ? 'bg-red-50 border-red-200 text-red-700'\n"
        "                  : ocrUiStatus === 'success'\n"
        "                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'\n"
        "                    : 'bg-slate-50 border-slate-200 text-slate-600'\n"
        '              }`}\n'
        "            >\n"
        '              <div className="text-sm font-medium">{statusLabel(ocrUiStatus)}</motion.div>\n'
        "              <div>状态</motion.div>\n"
        "            </motion.div>\n"
        "          </motion.div>\n"
    )
    stats_new = stats_new.replace(CM, CD)

    t = re.sub(
        r'          <div className="grid grid-cols-3 gap-2 text-center text-xs">.*?\n\n          \{\(ocrWarnings',
        stats_new + "\n          {(ocrWarnings",
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

    p.write_text(t)


def fix_preview(p: Path) -> None:
    t = p.read_text()
    t = t.replace(
        "            />\n          </motion.div>\n        ) : current ? (",
        "            />\n          " + CD + "\n        ) : current ? (",
        1,
    )
    t = t.replace(
        "            </a>\n          </motion.div>\n        ) : (",
        "            </a>\n          " + CD + "\n        ) : (",
        1,
    )
    p.write_text(t)


if __name__ == "__main__":
    root = Path("/www/wwwroot/ciond/src/pages/finance/costInvoice")
    fix_workspace(root / "CostInvoiceEntryWorkspace.tsx")
    fix_preview(root / "InvoicePreviewPanel.tsx")
    print("done")
