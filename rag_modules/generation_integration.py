"""
生成集成模块
"""

import logging
import os

from typing import List

from openai import OpenAI
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

class GenerationIntegrationModule:
    """生成集成模块 - 负责答案生成"""

    def __init__(self,
                 model_name: str = "deepseek-ai/DeepSeek-V4-Pro",
                 temperature: float = 0.1,
                 max_tokens: int = 2048,
                 neo4j_driver=None):  # 🌟 新增可选 Neo4j 驱动
        """
        初始化生成集成模块
        :param neo4j_driver: Neo4j 数据库驱动实例（用于验证菜谱是否存在）
        """
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.neo4j_driver = neo4j_driver  # 🌟 保存驱动
        try:
            # 局部导入防止循环引用
            from rag_modules.recipe_recommendation import RecipeRecommendationManager
            # 实例化并绑定到 self.recipe_manager，这样下面的流式生成方法就能直接调用了！
            self.recipe_manager = RecipeRecommendationManager()
            logger.info("成功在生成模块中绑定 RecipeRecommendationManager")
        except Exception as e:
            self.recipe_manager = None
            logger.error(f"绑定 RecipeRecommendationManager 失败: {e}")
        # 统一的LLM客户端配置（支持所有兼容OpenAI格式的供应商）
        api_key = "你的api密码"
        if not api_key:
            raise ValueError("请设置 OPENAI_API_KEY 环境变量")

        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.siliconflow.cn/v1")

        self.client = OpenAI(
            api_key=api_key,
            base_url=self.base_url
        )

        logger.info(f"生成模块初始化完成，模型: {model_name}, API地址: {self.base_url}")

    def _build_prompt(self, question: str, context: str, allowed_names: list = None) -> str:
        """构建统一的提示词（动态白名单强力防幻觉版）"""

        # 将当前检索到的真实菜名拼接成字符串
        names_str = "、".join(allowed_names) if allowed_names else "无"

        # 如果连数据库都没有查到任何东西，真正执行道歉
        if not context.strip() or not allowed_names:
            return f"""
            用户问题：{question}
            系统指令：本地知识库未检索到相关菜谱。请直接回复：“抱歉，当前的本地食谱库中暂未收录满足您要求的菜品，您可以换个食材或菜名试试。”
            """

        return f"""
        作为一位专业、严谨的本地食谱助手，请根据以下【检索到的本地菜谱信息】回答用户问题。

        【检索到的本地菜谱信息】：
        {context}

        【核心铁律】（最高优先级，必须严格遵守！）：
        1. **绝对白名单限制**：本次系统为你匹配到的候选菜品只有：【{names_str}】。你向用户推荐的菜品**必须且只能**从这个列表中选择！
        2. **严禁凭空捏造**：绝对不允许推荐上述列表之外的任何菜名！（比如千万不要习惯性地输出“清炒时蔬”、“西红柿炒鸡蛋”等默认菜）。
        3. **智能补全做法**：从上述列表中挑好菜品后，如果检索信息中包含具体做法，请严格照抄；如果检索信息中只有菜名没有做法，特批你调用预训练知识为其补全美味的家常做法。

        【强制排版规则】：
        1. 菜品名称必须使用三级标题（如：`### 🍲 菜名`）。
        2. 食材用无序列表（`- 食材`），步骤用有序列表（`1. 步骤`）。
        3. 核心食材、时间或火候必须**加粗**（如：**大火**、**10分钟**）。
        4. 段落之间必须保留空行（双回车）。

        用户问题：{question}
        回答：
        """

    def generate_adaptive_answer(self, question: str, documents: List[Document]) -> str:
        """
        智能统一答案生成（非流式后备方案）
        """
        context_parts = []

        for doc in documents:
            meta = doc.metadata or {}
            content = doc.page_content.strip()

            if not content:
                continue

            # 💡 注入边界标识，防大模型幻觉
            if meta.get('node_type') == 'Recipe':
                context_parts.append(f"[RECIPE_START]\n{content}\n[RECIPE_END]")
            else:
                level = meta.get('retrieval_level', '')
                if level:
                    context_parts.append(f"[{level.upper()}] {content}")
                else:
                    context_parts.append(content)

        context = "\n\n".join(context_parts)

        # 🌟 修复点：移除 allowed_recipe_names，适配最新无白名单版的 _build_prompt
        prompt = self._build_prompt(question, context)

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            return response.choices[0].message.content.strip()

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"LightRAG答案生成失败: {e}")
            return f"抱歉，生成回答时出现错误：{str(e)}"

    def generate_adaptive_answer_stream(self, question: str, documents: List[Document], max_retries: int = 3):
        """
        LightRAG风格的流式答案生成（图文彻底解耦 + 指标元数据高强清洗过滤版）
        """
        import json
        import time
        import re
        from urllib.parse import quote

        retrieved_recipes = []
        seen_ids = set()
        safe_documents = []
        context_parts = []

        for doc in documents:
            meta = doc.metadata or {}
            content = doc.page_content.strip()

            if not content:
                continue

            # 💡 如果不是菜谱（如食材节点），直接放行
            if meta.get('node_type') != 'Recipe':
                safe_documents.append(doc)
                context_parts.append(content)
                continue

            recipe_id = meta.get('node_id') or meta.get('id')
            recipe_name = meta.get('recipe_name') or meta.get('name')

            if recipe_id and recipe_name and recipe_id not in seen_ids:
                seen_ids.add(recipe_id)
                safe_documents.append(doc)

                # 为上下文注入边界标识
                context_parts.append(f"[RECIPE_START]\n{content}\n[RECIPE_END]")

                final_recipe_name = str(recipe_name)
                search_target = final_recipe_name

                full_info = None
                try:
                    from rag_modules.recipe_recommendation import RecipeRecommendationManager
                    temp_manager = RecipeRecommendationManager()
                    if hasattr(self, 'neo4j_driver'):
                        temp_manager.neo4j_driver = getattr(self, 'neo4j_driver')
                    full_info = temp_manager.get_recipe_by_id(search_target)
                except Exception as e:
                    pass

                # ==========================================
                # 🌟 核心修复 1：图文彻底解耦，文字绝对优先信任本地解析
                # ==========================================
                if full_info:
                    # 🚀 核心关键：即便图片是占位图，文字参数也死死咬定 full_info 提炼出的优质内容！
                    description = full_info.get('description')
                    safe_diff = full_info.get('difficulty', 'easy')
                    safe_tags = full_info.get('tags', [])
                    cooking_time = full_info.get('cookingTime', 30)
                    standardized_id = full_info.get('id', final_recipe_name)

                    # 仅仅针对图片做独立的分离判断
                    if full_info.get('imageUrl') and "placehold.co" not in full_info.get('imageUrl', ''):
                        perfect_image_url = full_info.get('imageUrl')
                    else:
                        perfect_image_url = "https://placehold.co/400x300/e2e8f0/64748b?text=Delicious+Food"
                else:
                    # 只有本地和图谱完全没有该项时，才走 RAG 原始 meta 兜底
                    description = meta.get('description')
                    safe_diff = meta.get('difficulty') or 'easy'
                    tags = meta.get('tags')
                    if not tags and meta.get('category'):
                        tags = [meta.get('category')]
                    safe_tags = tags if isinstance(tags, list) else []
                    cooking_time = meta.get('cookingTime') or meta.get('totalTime') or 30
                    perfect_image_url = "https://placehold.co/400x300/e2e8f0/64748b?text=Delicious+Food"
                    standardized_id = final_recipe_name

                # ==========================================
                # 🌟 核心修复 2：RAG 切片及已有简介的强化过滤 (同步最新清洗标准)
                # ==========================================
                description_str = str(description or '').strip()

                # 🚨 同步判定：拦截包含技术参数指标、星号或者生硬提示的脏数据
                if (not description_str or
                        "详细做法请参考" in description_str or
                        "暂无详细" in description_str or
                        description_str == "美味可口的经典菜谱" or
                        "预估" in description_str or
                        "★" in description_str or
                        "卡路里" in description_str or
                        "难度" in description_str):

                    if content:
                        # 按行切分进行深度过滤
                        lines = [l.strip() for l in content.split('\n') if l.strip()]
                        clean_lines = []
                        for l in lines:
                            if l.startswith('#'):
                                continue

                            # 🚨 拦截技术指标：跳过任何包含统计指标和星号的行
                            if any(k in l for k in
                                   ['预估烹饪难度', '预估卡路里', '烹饪难度', '★', '难度：', '卡路里：', '预估难度',
                                    '难度值']):
                                continue

                            # 过滤任何列表标识和纯数字序号开头的行
                            if l.startswith(
                                    ('-', '*', '+', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')) or re.match(
                                    r'^\d+', l):
                                continue

                            # 过滤任何包含区块导向的标题行
                            if any(k in l for k in
                                   ['所需食材', '必备原料', '计算', '操作', '步骤', '清单', '配料', '用料', '工具']):
                                continue

                            clean_lines.append(l)

                        if clean_lines:
                            clean_content = ' '.join(clean_lines)
                        else:
                            clean_content = content.replace('\n', ' ').replace('#', '').replace('*', '')

                        clean_content = clean_content.replace('[RECIPE_START]', '').replace('[RECIPE_END]', '').strip()
                        description = clean_content[:65] + "..." if len(clean_content) > 65 else clean_content
                    else:
                        description = f"为您精心推荐的精品佳肴【{final_recipe_name}】，点击查看详细的完整食材清单与烹饪步骤。"

                retrieved_recipes.append({
                    "id": str(standardized_id),
                    "name": final_recipe_name,
                    "description": description,  # 👈 传入无污染、剔除指标后的自然语言摘要
                    "imageUrl": perfect_image_url,
                    "cookingTime": cooking_time,
                    "difficulty": safe_diff,
                    "tags": safe_tags
                })

        # ==========================================
        # 🌟 收集名字作为白名单传入提示词，防止大模型幻觉
        # ==========================================
        context = "\n\n".join(context_parts)
        allowed_names = [recipe["name"] for recipe in retrieved_recipes]
        prompt = self._build_prompt(question, context, allowed_names)

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    stream=True,
                    timeout=60
                )

                if attempt == 0:
                    print("开始流式生成回答...\n")
                else:
                    print(f"第{attempt + 1}次尝试流式生成...\n")

                full_response = ""
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        payload = json.dumps({"chunk": content}, ensure_ascii=False)
                        yield f"data: {payload}\n\n"

                # 数据流完成后，统一推送装配好的卡片
                if retrieved_recipes:
                    recipes_payload = json.dumps({"chunk": "", "recipes": retrieved_recipes}, ensure_ascii=False)
                    yield f"data: {recipes_payload}\n\n"

                yield "data: [DONE]\n\n"
                return

            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"流式生成第{attempt + 1}次尝试失败: {e}")

                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"⚠️ 连接中断，{wait_time}秒后重试...")
                    time.sleep(wait_time)
                    continue
                else:
                    logging.getLogger(__name__).error(f"流式生成完全失败，尝试非流式后备方案")
                    print("⚠️ 流式生成失败，切换到标准模式...")

                    try:
                        fallback_response = self.generate_adaptive_answer(question, safe_documents)
                        payload = json.dumps({"chunk": fallback_response}, ensure_ascii=False)
                        yield f"data: {payload}\n\n"

                        if retrieved_recipes:
                            recipes_payload = json.dumps({"chunk": "", "recipes": retrieved_recipes},
                                                         ensure_ascii=False)
                            yield f"data: {recipes_payload}\n\n"

                        yield "data: [DONE]\n\n"
                        return
                    except Exception as fallback_error:
                        logging.getLogger(__name__).error(f"后备生成也失败: {fallback_error}")
                        error_msg = f"抱歉，生成回答时出现网络错误，请稍后重试。错误信息：{str(e)}"
                        payload = json.dumps({"chunk": error_msg}, ensure_ascii=False)
                        yield f"data: {payload}\n\n"
                        yield "data: [DONE]\n\n"
                        return