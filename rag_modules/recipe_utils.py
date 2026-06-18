# 文件名：rag_modules/recipe_utils.py
import re

def extract_desc_from_md(recipe_name, markdown_text, db_desc=""):
    """全局通用：高级正则 Markdown 简介提纯器（兼容无 # 号的裸标题）"""
    final_desc = ""
    if markdown_text:
        lines = [line.strip() for line in markdown_text.split('\n')]
        intro_lines = []
        for line in lines:
            # 1. 过滤掉图片和空行
            if not line or line.startswith('!['):
                continue

            # 🌟 核心新增：过滤掉没有 # 标记的纯文本标题（例如第一行突兀的 "青椒土豆炒肉的做法"）
            if line == recipe_name or line == f"{recipe_name}的做法" or (line.endswith('的做法') and len(line) < 30):
                continue

            # 2. 精准正则过滤：仅过滤以“预估”开头的指标行或带有星星的行
            if re.match(r'^预估(烹饪难度|卡路里|难度|耗时)[:：]', line) or '★' in line:
                continue

            # 3. 过滤其他特定的统计起始行
            if any(line.startswith(k) for k in ['每次制作前', '份数', '总量', '每份：', '每份:']):
                continue

            # 4. 严格区分一级标题(#)和二级标题(##)
            if line.startswith('##'):
                # 遇到二级标题（如：## 必备原料和工具），并且包含关键字，证明正文开始了，终止提取
                if any(k in line for k in ['原料', '工具', '食材', '清单', '计算', '配料', '用料', '操作', '步骤', '做法', '流程']):
                    break
            elif line.startswith('#'):
                # 如果只是一级标题（如：# 茄子炖土豆的做法），直接跳过不录入简介，继续往下读
                continue

            # 5. 过滤列表格式的行
            if line.startswith(('-', '*', '+')) or re.match(r'^\d+[\.\s]', line):
                continue

            intro_lines.append(line)

        if intro_lines:
            clean_md = ' '.join(intro_lines)
            # 截取 120 个字符，保证前端卡片排版优雅
            final_desc = clean_md[:120] + "..." if len(clean_md) > 120 else clean_md

    # 兜底 1：如果 Markdown 没提炼出文字，去拿传进来的数据库原始数据
    if not final_desc and db_desc:
        final_desc = str(db_desc).strip()
        if re.match(r'^预估(烹饪难度|卡路里)[:：]', final_desc) or '★' in final_desc:
            final_desc = ""

    # 兜底 2：如果彻底没有数据，使用优雅的通用话术
    if not final_desc:
        final_desc = f"为您精心推荐的美味【{recipe_name}】，点击查看详细食材与烹饪步骤。"

    return final_desc