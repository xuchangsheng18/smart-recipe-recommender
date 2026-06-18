"""
菜谱推荐模块
负责处理菜谱推荐逻辑和菜谱详情获取
"""

import logging
import json
import random
import os
import re
from typing import List, Dict, Any, Optional
from urllib.parse import unquote, quote

logger = logging.getLogger(__name__)


class RecipeRecommendationManager:
    """
    菜谱推荐管理器

    功能：
    1. 随机菜谱推荐
    2. 菜谱详情获取
    3. 备用推荐数据
    4. 图片URL处理
    """

    def __init__(self):
        """初始化推荐管理器"""
        self.index_file = "data/recipes_with_images.json"
        self.dishes_dir = "data/dishes"

    def get_random_recipes_with_images(self, limit: int = 3) -> List[Dict[str, Any]]:
        """从预生成的索引文件获取随机的有图片的菜谱推荐"""
        try:
            if not os.path.exists(self.index_file):
                logger.warning(f"菜谱索引文件不存在: {self.index_file}")
                return self._get_fallback_recommendations(limit)

            with open(self.index_file, 'r', encoding='utf-8') as f:
                recipes_data = json.load(f)

            if not recipes_data:
                logger.warning("菜谱索引文件为空")
                return self._get_fallback_recommendations(limit)

            if len(recipes_data) >= limit:
                sampled_data = random.sample(list(enumerate(recipes_data)), limit)
            else:
                sampled_data = list(enumerate(recipes_data))

            selected_recipes = []
            for original_index, recipe_data in sampled_data:
                difficulties = ['easy', 'medium', 'hard']
                difficulty = random.choice(difficulties)

                image_url = self._process_image_url(recipe_data)
                detailed_content = self._read_recipe_markdown(recipe_data.get('name', ''))

                formatted_ingredients = [
                    {"name": item, "amount": ""}
                    for item in detailed_content.get('ingredients', [])
                ]

                formatted_steps = [
                    {
                        "id": f"step_{idx + 1}",
                        "stepNumber": idx + 1,
                        "title": f"步骤 {idx + 1}",
                        "description": step_text
                    }
                    for idx, step_text in enumerate(detailed_content.get('steps', []))
                ]

                recipe = {
                    "id": f"recipe_{original_index + 1}",
                    "name": recipe_data.get('name', '未知菜谱'),
                    "description": recipe_data.get('description', '美味可口的经典菜谱'),
                    "category": recipe_data.get('category', '家常菜'),
                    "imageUrl": image_url or f"https://placehold.co/400x300/e2e8f0/64748b?text={quote(recipe_data.get('name', 'Recipe'))}",
                    "cookingTime": recipe_data.get('cooking_time', 30),
                    "prepTime": 15,
                    "servings": 2,
                    "difficulty": difficulty,
                    "rating": round(random.uniform(4.0, 5.0), 1),
                    "tags": recipe_data.get('tags', []),
                    "ingredients": formatted_ingredients,
                    "steps": formatted_steps,
                    "markdownPath": recipe_data.get('file_path', ''),
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z"
                }
                selected_recipes.append(recipe)

            if len(selected_recipes) < limit:
                fallback = self._get_fallback_recommendations(limit - len(selected_recipes))
                selected_recipes.extend(fallback)

            logger.info(f"从索引文件加载并返回 {len(selected_recipes)} 个随机推荐")
            return selected_recipes

        except Exception as e:
            logger.error(f"从索引文件获取菜谱失败: {e}")
            return self._get_fallback_recommendations(limit)

    def _process_image_url(self, recipe_data: Dict[str, Any]) -> Optional[str]:
        """处理菜谱图片URL（适配本地 data/dishes 结构）"""
        try:
            image_url = recipe_data.get('image_url', '')
            file_path = recipe_data.get('file_path', '')

            if image_url and image_url.startswith('http'):
                return image_url

            if image_url and file_path:
                if image_url.startswith('./'):
                    image_url = image_url[2:]

                file_path = file_path.replace('\\', '/')
                dishes_index = file_path.find('dishes')

                if dishes_index != -1:
                    dir_path = '/'.join(file_path[dishes_index:].split('/')[:-1])
                    local_url = f"/static/{dir_path}/{image_url}"
                    return local_url

            return None

        except Exception as e:
            logger.warning(f"处理本地图片URL失败: {e}")
            return None

    def _get_fallback_recommendations(self, limit: int = 6) -> List[Dict[str, Any]]:
        """备用推荐菜谱（当数据库查询失败时使用）"""
        fallback_recipes = [
            {
                "id": "fallback_001",
                "name": "红烧肉",
                "description": "肥瘦相间，入口即化的经典家常菜",
                "category": "家常菜",
                "imageUrl": "https://placehold.co/400x300/e2e8f0/64748b?text=" + quote("红烧肉"),
                "cookingTime": 60,
                "prepTime": 15,
                "servings": 4,
                "difficulty": "medium",
                "rating": 4.8,
                "tags": ["家常菜", "下饭", "经典"],
                "ingredients": [],
                "steps": [],
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z"
            }
        ]
        # 补齐不足的数量
        while len(fallback_recipes) < limit:
            fallback_recipes.append(fallback_recipes[0])
        return fallback_recipes[:limit]

    def get_recipe_by_id(self, recipe_id: str):
        """根据ID获取菜谱详情：优先 JSON -> 其次 Neo4j -> 全局高级提纯"""
        import os
        import json
        import random
        import re
        from urllib.parse import unquote, quote
        import logging

        # 💡 核心修改 1：导入全局高级提纯器
        from rag_modules.recipe_utils import extract_desc_from_md

        logger = logging.getLogger(__name__)

        try:
            recipes_data = []
            if os.path.exists(self.index_file):
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    recipes_data = json.load(f)
            else:
                logger.warning(f"菜谱索引文件不存在: {self.index_file}")

            recipe_data = None
            clean_target = unquote(str(recipe_id)).strip().lower()
            standardized_id = str(recipe_id)

            # ==========================================
            # 🌟 1. 从本地 JSON 文件中查找
            # ==========================================
            if clean_target.startswith('recipe_'):
                try:
                    idx = int(clean_target.split('_')[1]) - 1
                    if 0 <= idx < len(recipes_data):
                        recipe_data = recipes_data[idx]
                        standardized_id = f"recipe_{idx + 1}"
                except (ValueError, IndexError):
                    pass

            if not recipe_data:
                for idx, item in enumerate(recipes_data):
                    item_node_id = str(item.get('node_id', '')).strip().lower()
                    item_id = str(item.get('id', '')).strip().lower()
                    item_name = str(item.get('name', '')).strip().lower()

                    if (clean_target == item_node_id or
                            clean_target == item_id or
                            clean_target == item_name or
                            (clean_target and clean_target in item_name) or
                            (item_name and item_name in clean_target)):
                        recipe_data = item
                        standardized_id = f"recipe_{idx + 1}"
                        break

            # ==========================================
            # 🌟 2. JSON 中没有，去 Neo4j 数据库里取
            # ==========================================
            if not recipe_data:
                if not hasattr(self, 'neo4j_driver') or not self.neo4j_driver:
                    logger.error("🚨 neo4j_driver 未绑定，已跳过图谱查询！")
                else:
                    try:
                        with self.neo4j_driver.session() as session:
                            query = """
                            MATCH (r:Recipe)
                            WHERE r.nodeId = $id OR r.nodeId = toInteger($id) OR r.id = $id OR r.id = toInteger($id) OR r.name = $name
                            RETURN r
                            """
                            result = session.run(query, id=str(recipe_id), name=unquote(str(recipe_id)))
                            record = result.single()

                            if record:
                                node = record['r']
                                recipe_data = {
                                    "name": node.get("name", unquote(str(recipe_id))),
                                    "description": node.get("description", ""),
                                    "category": node.get("category", "图谱推荐"),
                                    "cooking_time": node.get("cookingTime", node.get("totalTime", 30)),
                                    "difficulty": node.get("difficulty", "medium"),
                                    "tags": node.get("tags", ["AI推荐"])
                                }
                    except Exception as e:
                        logger.warning(f"尝试从 Neo4j 读取节点失败: {e}")

            # ==========================================
            # 🌟 3. 终极兜底
            # ==========================================
            if not recipe_data:
                fallback_name = unquote(str(recipe_id)).strip()
                if fallback_name.isdigit() or fallback_name.startswith('recipe_'):
                    fallback_name = "AI 推荐美食"

                recipe_data = {
                    "name": fallback_name,
                    "category": "特色推荐",
                    "cooking_time": 30,
                    "difficulty": "medium",
                }
                standardized_id = str(recipe_id)

            # ==========================================
            # 🌟 4. 图片处理 (修复跨域前缀)
            # ==========================================
            base_url = os.getenv('STATIC_BASE_URL', 'http://localhost:8000').rstrip('/')
            raw_image = None

            if hasattr(self, '_process_image_url'):
                try:
                    raw_image = self._process_image_url(recipe_data)
                except:
                    pass

            if not raw_image:
                img = recipe_data.get('image_url') or recipe_data.get('imageUrl') or recipe_data.get('image') or ''
                if img:
                    if img.startswith(('http://', 'https://')):
                        raw_image = img
                    else:
                        cleaned_img = img.lstrip('./').replace('\\', '/')
                        raw_image = f"{base_url}/static/{cleaned_img}"
                else:
                    file_path = recipe_data.get('file_path', '')
                    if file_path and hasattr(self, 'dishes_dir'):
                        base_dir = os.path.dirname(file_path)
                        base_name = os.path.splitext(os.path.basename(file_path))[0]
                        for ext in ['.webp', '.jpg', '.png', '.jpeg']:
                            candidate = os.path.join(base_dir, base_name + ext)
                            if os.path.exists(candidate):
                                rel_path = os.path.relpath(candidate, self.dishes_dir).replace('\\', '/')
                                # 💡 核心修改 2：加入 base_url 防止 404
                                raw_image = f"{base_url}/static/dishes/{rel_path}"
                                break

            if not raw_image or "fallback.jpg" in raw_image:
                safe_name = quote(recipe_data.get('name', 'Recipe'))
                raw_image = f"https://placehold.co/600x400/e2e8f0/64748b?text={safe_name}"

            detail_link = f"/recipe/{standardized_id}"

            # ==========================================
            # 🌟 5. 获取 Markdown 与全局提纯简介
            # ==========================================
            detailed_content = {}
            if hasattr(self, '_read_recipe_markdown'):
                try:
                    detailed_content = self._read_recipe_markdown(recipe_data.get('name', '')) or {}
                except Exception as e:
                    logger.error(f"调用 _read_recipe_markdown 失败: {e}")

            markdown_text = detailed_content.get('content', '') or recipe_data.get('markdownContent', '')
            recipe_name = recipe_data.get('name', '未知菜谱')
            raw_desc = recipe_data.get('description', '')

            # 💡 核心修改 3：一行代码完成所有提纯，删除旧的几十行循环！
            final_desc = extract_desc_from_md(recipe_name, markdown_text, raw_desc)

            # ==========================================
            # 🌟 6. 装载数据
            # ==========================================
            ingredients_list = detailed_content.get('ingredients', [])
            steps_list = detailed_content.get('steps', [])
            nutrition_data = detailed_content.get('nutrition', {})

            if not ingredients_list:
                ingredients_list = recipe_data.get('ingredients', [])
            if not steps_list:
                steps_list = recipe_data.get('steps', [])

            formatted_ingredients = [{"name": item, "amount": ""} for item in ingredients_list]
            formatted_steps = [
                {
                    "id": f"step_{idx + 1}",
                    "stepNumber": idx + 1,
                    "title": f"步骤 {idx + 1}",
                    "description": step_text
                }
                for idx, step_text in enumerate(steps_list)
            ]

            if not nutrition_data.get('卡路里') and markdown_text:
                cal_match = re.search(r'(\d+\s*(?:大卡|kcal))', markdown_text, re.IGNORECASE)
                if cal_match:
                    nutrition_data['卡路里'] = cal_match.group(1)

            # ==========================================
            # 🌟 7. 返回组装完毕的实体
            # ==========================================
            recipe_detail = {
                "id": standardized_id,
                "name": recipe_name,
                "description": final_desc,  # 👈 注入完美的简介
                "category": recipe_data.get('category', '特色推荐'),
                "imageUrl": raw_image,
                "link": detail_link,
                "cookingTime": recipe_data.get('cooking_time', 30),
                "prepTime": 15,
                "servings": 2,
                "difficulty": recipe_data.get('difficulty', 'medium'),
                "rating": round(random.uniform(4.0, 5.0), 1),
                "tags": recipe_data.get('tags', []),
                "ingredients": formatted_ingredients,
                "steps": formatted_steps,
                "nutrition": nutrition_data,
                "markdownPath": recipe_data.get('file_path', ''),
                "markdownContent": markdown_text or final_desc,
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z"
            }

            print("\n" + "=" * 50)
            print(f"🍽️  后端即将输出的菜谱详情元数据 (ID: {recipe_id}):")
            print(f"🌟  最终提纯简介: {final_desc}")
            print("=" * 50 + "\n")

            return recipe_detail

        except Exception as e:
            logger.error(f"获取菜谱详情失败: {e}")
            return {
                "id": str(recipe_id),
                "name": "系统开小差了",
                "description": "读取数据时发生错误",
                "imageUrl": "https://placehold.co/600x400/e2e8f0/64748b?text=Error",
                "link": "#",
                "ingredients": [],
                "steps": []
            }

    def _read_recipe_markdown(self, recipe_name: str) -> Dict[str, Any]:
        """增强版 Markdown 解析：修复三级标题干扰 + 严格只取列表项"""
        try:
            if not os.path.exists(self.dishes_dir):
                logger.warning(f"菜谱目录不存在: {self.dishes_dir}")
                return {"ingredients": [], "steps": [], "nutrition": {}, "content": ""}

            for root, dirs, files in os.walk(self.dishes_dir):
                for file in files:
                    if file.endswith('.md') and recipe_name in file:
                        file_path = os.path.join(root, file)
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        ingredients, steps = [], []
                        nutrition_data = {}
                        lines = content.split('\n')
                        current_section = None

                        for line in lines:
                            line = line.strip()
                            if not line:
                                continue

                            # 营养提取
                            clean_line = line.replace('*', '').replace('_', '').replace('|', '').replace('`', '')
                            for match in re.finditer(
                                    r'(卡路里|热量|蛋白质|碳水化合物|碳水|脂肪|膳食纤维)[:：\s]*(?:约|大约|大概)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:克|g|毫克|mg|大卡|千卡|kcal|卡|千焦|kj|%)?)',
                                    clean_line, re.IGNORECASE
                            ):
                                key = match.group(1).replace('热量', '卡路里').replace('碳水', '碳水化合物')
                                value = match.group(2).strip()
                                if value:
                                    nutrition_data[key] = value

                            # 标题处理
                            if line.startswith('#'):
                                # 跳过三级标题，不改变区域
                                if line.startswith('###'):
                                    continue
                                if line.startswith('##'):
                                    header_text = line.replace(' ', '').replace('#', '').lower()
                                    if any(k in header_text for k in
                                           ['食材', '原料', '用料', '配料', '材料', '计算', '准备']):
                                        current_section = 'ingredients'
                                    elif any(k in header_text for k in
                                             ['步骤', '做法', '制作', '流程', '怎么做', '过程', '操作', '烹饪']):
                                        current_section = 'steps'
                                    elif any(k in header_text for k in
                                             ['贴士', '注意', '提示', '参考', '链接', '来源', '附加内容', '小结']):
                                        current_section = 'tips'
                                    else:
                                        current_section = None
                                continue

                            # 判断是否为列表项
                            is_list_item = re.match(r'^(\d+[.、]|[-*+])\s+', line)

                            # 食材：仅列表
                            if current_section == 'ingredients' and is_list_item:
                                item = re.sub(r'^(\d+[.、]|[-*+])\s*', '', line).strip()
                                if item and item not in ['工具', '原料', '主料', '辅料', '配料', '材料', '调料', '食材',
                                                         '厨具']:
                                    ingredients.append(item)

                            # 步骤：仅列表，忽略普通文本
                            elif current_section == 'steps':
                                if line.startswith('!['):
                                    continue
                                if is_list_item:
                                    step_text = re.sub(r'^(\d+[.、]|[-*+])\s*', '', line).strip()
                                    if step_text:
                                        steps.append(step_text)

                        # 食材去重
                        unique_ingredients = []
                        for item in ingredients:
                            is_dup = False
                            for other in ingredients:
                                if item != other and item in other:
                                    is_dup = True
                                    break
                            if not is_dup:
                                unique_ingredients.append(item)
                        final_ingredients = list(dict.fromkeys(unique_ingredients))

                        return {
                            "ingredients": final_ingredients,
                            "steps": steps,
                            "nutrition": nutrition_data,
                            "content": content
                        }

            logger.warning(f"未找到菜谱文件: {recipe_name}")
            return {"ingredients": [], "steps": [], "nutrition": {}, "content": ""}

        except Exception as e:
            logger.error(f"读取菜谱文件失败: {e}")
            return {"ingredients": [], "steps": [], "nutrition": {}, "content": ""}