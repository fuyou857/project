#!/usr/bin/env python3
import ast
import os
import sys


class NPlusOneVisitor(ast.NodeVisitor):
    def __init__(self):
        self.findings = []

    def visit_For(self, node):
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and hasattr(child.func, 'attr'):
                if child.func.attr in ['query', 'execute', 'find', 'get']:
                    self.findings.append({
                        'line': node.lineno,
                        'code': ast.unparse(node).split('\n')[0][:100]
                    })
        self.generic_visit(node)


def scan_directory(directory: str) -> list:
    findings = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    try:
                        tree = ast.parse(f.read())
                        visitor = NPlusOneVisitor()
                        visitor.visit(tree)
                        for f_item in visitor.findings:
                            findings.append({
                                'file': filepath,
                                'line': f_item['line'],
                                'code': f_item['code']
                            })
                    except SyntaxError:
                        continue
    return findings


if __name__ == '__main__':
    directory = sys.argv[1] if len(sys.argv) > 1 else 'api'
    results = scan_directory(directory)
    if not results:
        print(f"✅ 在 {directory} 中未发现明显的 N+1 查询模式")
    else:
        for r in results:
            print(f"[WARN] {r['file']}:{r['line']} - 可能存在 N+1 查询")
            print(f"  -> {r['code']}")