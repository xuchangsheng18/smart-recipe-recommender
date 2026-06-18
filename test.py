import json
import os

# 使用原始字符串，避免转义
FILE_PATH = r"E:\新建文件夹\What-to-eat-today-main\What-to-eat-today-main\data\recipes_with_images.json"

def check_recipe_exists(file_path, target_name):
    """检查指定名称的菜谱是否存在"""
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return False, None

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            recipes = json.load(f)

        for recipe in recipes:
            if recipe.get('name') == target_name:
                return True, recipe
        return False, None
    except Exception as e:
        print(f"读取文件失败: {e}")
        return False, None

# 查询“白灼虾”
exists, recipe_data = check_recipe_exists(FILE_PATH, "青椒土豆炒肉")

if exists:
    print("✅ 存在！菜谱信息如下：")
    print(json.dumps(recipe_data, ensure_ascii=False, indent=2))
else:
    print("❌ 未找到名为 '腊八粥' 的菜谱")