#!/usr/bin/env python3
import os
import re
import sys


def scan_sql_injection(directory: str) -> list:
    patterns = [
        (r"f?[\"'].*SELECT.*\{.*\}.*[\"']", "字符串拼接 SELECT"),
        (r"f?[\"'].*INSERT.*\{.*\}.*[\"']", "字符串拼接 INSERT"),
        (r"f?[\"'].*UPDATE.*\{.*\}.*[\"']", "字符串拼接 UPDATE"),
        (r"f?[\"'].*DELETE.*\{.*\}.*[\"']", "字符串拼接 DELETE"),
        (r"\+.*[\"'].*WHERE.*[\"']", "加号拼接 WHERE"),
        (r"%s.*%", "格式化字符串拼接"),
    ]

    findings = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py') or file.endswith('.sql'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for pattern, desc in patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            findings.append({
                                'file': filepath,
                                'pattern': desc,
                                'matches': matches[:3]
                            })
    return findings


if __name__ == '__main__':
    directory = sys.argv[1] if len(sys.argv) > 1 else 'api'
    results = scan_sql_injection(directory)
    if not results:
        print(f"✅ 在 {directory} 中未发现 SQL 注入风险")
    else:
        for r in results:
            print(f"[WARN] {r['file']}: {r['pattern']}")
            for m in r['matches']:
                print(f"  -> {m[:100]}")
        sys.exit(1)