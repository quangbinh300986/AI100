# -*- coding: utf-8 -*-
import fitz  # PyMuPDF

doc = fitz.open(r"公司及部门客户幸福0-100分标准.pdf")
print(f"PDF页数: {doc.page_count}")
print("=" * 80)

for page_num in range(doc.page_count):
    page = doc[page_num]
    text = page.get_text()
    print(f"\n--- 第 {page_num + 1} 页 ---")
    print(text)
