"""
Web服务处理模块
负责处理Web API和静态文件服务
"""

import logging
import json
import time
import os
import concurrent.futures
from datetime import datetime
from typing import Dict, Any, Optional

from flask import jsonify
from neo4j import GraphDatabase

from rag_modules.UserManager import UserManager

logger = logging.getLogger(__name__)

class WebServiceHandler:
    """
    Web服务处理器

    功能：
    1. API路由处理
    2. 静态文件服务
    3. 错误处理
    4. 响应格式化
    """

    def __init__(self, rag_system):
        """初始化Web服务处理器"""
        self.rag_system = rag_system
        self.app = None
        self.index_file="E:\\新建文件夹\\基于Neo4js和milvus的智能推荐系统\\基于Neo4js和milvus的智能推荐系统\\data\\recipes_with_images.json"
        # 🌟 实例化数据库管理器 (数据会自动保存在项目的 data/users.db 中)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)
        db_path = os.path.join(project_root, "data", "users.db")
        self.neo4j_driver = None
        # 1️⃣ Neo4j数据库配置 (注意这里的密码！)
        neo4j_uri: str = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
        neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
        # 👇 请务必将下面单引号里的密码，改成你刚才在Neo4j Desktop里设置的密码！
        neo4j_password: str = os.getenv("NEO4J_PASSWORD", '12345678')
        try:
            # 尝试建立连接
            self.neo4j_driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user,  neo4j_password))
            # 验证连接是否通畅
            self.neo4j_driver.verify_connectivity()
            print("🟢 Neo4j 图谱数据库连接成功！")
        except Exception as e:
            logger.error(f"🔴 Neo4j 连接失败，系统将降级为仅使用本地 JSON: {e}")
            # 如果连接失败，确保 driver 设为 None，这样后面的搜索逻辑就会自动跳过图谱查询
            self.neo4j_driver = None

        print(f"📂 系统初始化完毕！本地索引路径: {self.index_file}")
        self.user_db = UserManager(db_path)

    def setup_flask_app(self):
        """设置Flask应用和路由"""
        try:
            from flask import Flask, request, jsonify, Response
            from flask_cors import CORS

            # 💡 核心修改：动态获取项目的绝对路径，彻底解决路径报错问题
            # 当前文件所在目录: rag_modules
            current_dir = os.path.dirname(os.path.abspath(__file__))
            # 项目根目录: 基于Neo4js和milvus的智能推荐系统
            project_root = os.path.dirname(current_dir)
            # 拼接出真实的本地图片存放路径: .../data/dishes
            dishes_path = os.path.join(project_root, "data", "dishes")

            logger.info(f"配置静态文件(图片)真实路径: {dishes_path}")

            # 💡 核心修改：让Flask直接接管 /static/dishes 的请求，指向本地真实的 dishes_path
            self.app = Flask(__name__, static_url_path='/static/dishes', static_folder=dishes_path)

            CORS(self.app)
            self._setup_routes()
            return self.app
        except ImportError as e:
            logger.error(f"Flask导入失败: {e}")
            return None

    def _setup_routes(self):
        """设置所有API路由"""
        from flask import request, jsonify, Response, send_from_directory

        @self.app.route('/')
        def serve_index():
            """提供主页"""
            return self._serve_static_file('index.html')

        @self.app.route('/<path:filename>')
        def serve_static(filename):
            """提供静态文件服务"""
            # 注意：图片请求 (/static/dishes/xxx) 已经被 Flask 在初始化时接管了，不会走到这里。
            return self._serve_static_file(filename)

        @self.app.route('/health', methods=['GET'])
        def health_check():
            """健康检查端点"""
            return jsonify({
                "status": "healthy",
                "timestamp": str(datetime.now()),
                "service": "RAG System"
            })

        @self.app.route('/api/chat', methods=['POST'])
        def chat():
            """聊天API - 普通响应"""
            return self._handle_chat_request()

        @self.app.route('/api/chat/stream', methods=['POST'])
        def chat_stream():
            """聊天API - 流式响应"""
            return self._handle_stream_request()

        @self.app.route('/api/recipes/recommendations', methods=['POST'])
        def get_recommendations():
            """获取菜谱推荐"""
            return self._handle_recommendations_request()

        @self.app.route('/api/recipes/<recipe_id>', methods=['GET'])
        def get_recipe_detail(recipe_id):
            """获取菜谱详情"""
            return self._handle_recipe_detail_request(recipe_id)

        @self.app.route('/api/stats', methods=['GET'])
        def get_stats():
            """获取系统统计信息"""
            return self._handle_stats_request()

        @self.app.route('/api/recipes/search', methods=['GET','POST'])
        def search_recipes():
            """搜索菜谱"""
            return self._handle_search_recipes_request()

        @self.app.route('/api/recipes/category/<category>', methods=['GET'])
        def get_category_recipes(category):
            """按分类获取菜谱"""
            return self._handle_category_recipes_request(category)

        @self.app.route('/api/user/favorites', methods=['GET', 'POST', 'DELETE'])
        def manage_favorites():
            """管理用户收藏 (获取/添加/取消)"""
            return self._handle_favorites_request()

        @self.app.route('/api/user/rating', methods=['POST'])
        def submit_rating():
            """提交菜谱评分"""
            return self._handle_rating_request()

    def _serve_static_file(self, filename):
        """提供静态文件服务"""
        import os
        from flask import send_from_directory

        # 安全检查，防止路径遍历攻击
        if '..' in filename or filename.startswith('/'):
            return "Forbidden", 403

        # 💡 同步修改：动态获取前端构建产物(dist)的绝对路径
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)
        frontend_path = os.path.join(project_root, 'frontend', 'dist')

        try:
            if filename == 'index.html' or filename == '':
                return send_from_directory(frontend_path, 'index.html')
            else:
                return send_from_directory(frontend_path, filename)
        except FileNotFoundError:
            # 如果文件不存在，返回index.html（用于SPA路由）
            return send_from_directory(frontend_path, 'index.html')

    def _handle_chat_request(self):
        """处理普通聊天请求"""
        from flask import request, jsonify

        try:
            data = request.get_json()
            query = data.get('message', '')
            session_id = data.get('session_id', '')

            if not query:
                return jsonify({"error": "消息不能为空"}), 400

            # 🚀 并行执行缓存检查和预处理
            cached_response = None
            enhanced_query = query

            def check_cache():
                nonlocal cached_response
                cached_response = self.rag_system.cache_manager.check_semantic_cache(query, session_id)

            def prepare_query():
                nonlocal enhanced_query
                enhanced_query = self.rag_system.cache_manager.get_context_for_query(session_id, query)

            # 并行执行缓存检查和查询预处理
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                future_cache = executor.submit(check_cache)
                future_query = executor.submit(prepare_query)

                # 等待缓存检查完成
                concurrent.futures.wait([future_cache], timeout=1)

                if cached_response:
                    # 缓存命中，取消查询预处理
                    future_query.cancel()
                    self.rag_system.cache_manager.add_to_context(session_id, query, cached_response)
                    return jsonify({
                        "response": cached_response,
                        "query": query,
                        "session_id": session_id,
                        "timestamp": str(datetime.now()),
                        "from_cache": True
                    })

                # 缓存未命中，等待查询预处理完成
                concurrent.futures.wait([future_query], timeout=2)

            # 缓存未命中，执行完整的RAG流程
            documents, analysis = self.rag_system.query_router.route_query(
                query=enhanced_query,
                top_k=self.rag_system.config.top_k
            )
            # 使用生成模块生成最终答案
            response = self.rag_system.generation_module.generate_adaptive_answer(enhanced_query, documents)

            # 将结果添加到会话缓存和上下文
            self.rag_system.cache_manager.add_to_semantic_cache(query, response, session_id)
            self.rag_system.cache_manager.add_to_context(session_id, query, response)

            return jsonify({
                "response": response,
                "query": query,
                "timestamp": str(datetime.now())
            })

        except Exception as e:
            logger.error(f"Chat API错误: {e}")
            return jsonify({"error": str(e)}), 500

    def _handle_stream_request(self):
        """处理流式聊天请求"""
        from flask import request, Response

        try:
            data = request.get_json()
            query = data.get('message', '')
            session_id = data.get('session_id', '')

            if not query:
                return jsonify({"error": "消息不能为空"}), 400

            def generate():
                try:
                    # 🚀 并行执行缓存检查和预处理
                    cached_response = None
                    enhanced_query = query

                    def check_cache():
                        nonlocal cached_response
                        cached_response = self.rag_system.cache_manager.check_semantic_cache(query, session_id)

                    def prepare_query():
                        nonlocal enhanced_query
                        enhanced_query = self.rag_system.cache_manager.get_context_for_query(session_id, query)

                    # 并行执行缓存检查和查询预处理
                    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                        future_cache = executor.submit(check_cache)
                        future_query = executor.submit(prepare_query)

                        # 等待缓存检查完成
                        concurrent.futures.wait([future_cache], timeout=1)

                        if cached_response:
                            # 缓存命中，快速返回
                            future_query.cancel()
                            self.rag_system.cache_manager.add_to_context(session_id, query, cached_response)
                            chunk_size = 3
                            for i in range(0, len(cached_response), chunk_size):
                                chunk = cached_response[i:i+chunk_size]
                                data_obj = {"chunk": chunk, "from_cache": True}
                                yield f"data: {json.dumps(data_obj)}\n\n"
                                time.sleep(0.02)  # 更快的流式响应
                            yield f"data: [DONE]\n\n"
                            return

                        # 缓存未命中，等待查询预处理完成
                        concurrent.futures.wait([future_query], timeout=2)

                    # 缓存未命中，执行完整的RAG流程
                    documents, analysis = self.rag_system.query_router.route_query(
                        query=enhanced_query,
                        top_k=self.rag_system.config.top_k
                    )

                    # 流式生成答案
                    full_response = ""
                    for chunk in self.rag_system.generation_module.generate_adaptive_answer_stream(enhanced_query, documents):
                        full_response += chunk
                        data_obj = {"chunk": chunk}
                        yield f"data: {json.dumps(data_obj)}\n\n"

                    # 将完整结果添加到会话缓存和上下文
                    self.rag_system.cache_manager.add_to_semantic_cache(query, full_response, session_id)
                    self.rag_system.cache_manager.add_to_context(session_id, query, full_response)

                    # 发送结束标记
                    yield f"data: [DONE]\n\n"

                except Exception as e:
                    logger.error(f"Stream API错误: {e}")
                    error_msg = f"抱歉，处理您的问题时出现错误：{str(e)}"
                    data_obj = {"chunk": error_msg}
                    yield f"data: {json.dumps(data_obj)}\n\n"
                    yield f"data: [DONE]\n\n"

            response = Response(generate(), mimetype='text/event-stream')
            response.headers['Cache-Control'] = 'no-cache'
            response.headers['Connection'] = 'keep-alive'
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response

        except Exception as e:
            logger.error(f"Stream API错误: {e}")
            return jsonify({"error": str(e)}), 500

    def _handle_recommendations_request(self):
        """处理菜谱推荐请求"""
        from flask import request, jsonify

        try:
            data = request.get_json() or {}
            preferences = data.get('preferences', {})

            # 获取推荐菜谱
            recipes = self.rag_system.recipe_manager.get_random_recipes_with_images(limit=3)

            return jsonify({
                "success": True,
                "data": recipes,
                "message": "推荐获取成功"
            })

        except Exception as e:
            logger.error(f"推荐API错误: {e}")
            return jsonify({"error": str(e)}), 500

    def _handle_recipe_detail_request(self, recipe_id):
        """处理菜谱详情请求"""
        from flask import jsonify

        try:
            recipe = self.rag_system.recipe_manager.get_recipe_by_id(recipe_id)
            if recipe:
                return jsonify({
                    "success": True,
                    "data": recipe
                })
            else:
                return jsonify({"error": "菜谱不存在"}), 404

        except Exception as e:
            logger.error(f"菜谱详情API错误: {e}")
            return jsonify({"error": str(e)}), 500

    def _handle_stats_request(self):
        """处理统计信息请求"""
        from flask import jsonify

        try:
            # 获取系统统计信息
            stats = {
                "cache_stats": self.rag_system.cache_manager.get_session_stats(),
                "route_stats": self.rag_system.query_router.get_route_statistics(),
                "system_info": {
                    "timestamp": str(datetime.now()),
                    "status": "running"
                }
            }
            return jsonify(stats)

        except Exception as e:
            logger.error(f"统计API错误: {e}")
            return jsonify({"error": str(e)}), 500

    def _handle_search_recipes_request(self):
        """处理菜谱搜索请求：无视数据库缺漏，开启硬盘雷达深度寻图+提取简介"""
        from flask import request, jsonify
        import logging
        import os
        import json
        from urllib.parse import quote

        # 💡 导入提纯器
        from rag_modules.recipe_utils import extract_desc_from_md

        logger = logging.getLogger(__name__)

        try:
            data = request.get_json(silent=True) or {} if request.method == 'POST' else request.args
            query = data.get('query') or data.get('q') or ''
            query = query.strip()

            try:
                page, page_size = int(data.get('page', 1)), int(data.get('page_size', 20))
            except ValueError:
                page, page_size = 1, 20

            if not query:
                return jsonify({"success": False, "error": "搜索关键词不能为空"}), 400

            results_dict = {}
            base_url = os.getenv('STATIC_BASE_URL', 'http://localhost:8000').rstrip('/')

            # ==========================================
            # 🌟 1. 搜索本地 JSON
            # ==========================================
            if hasattr(self, 'index_file') and os.path.exists(self.index_file):
                try:
                    with open(self.index_file, 'r', encoding='utf-8') as f:
                        recipes_data = json.load(f)
                    for idx, item in enumerate(recipes_data):
                        name = str(item.get('name') or item.get('title') or '')
                        raw_desc = str(item.get('description') or '').strip()
                        md_content = item.get('markdownContent') or item.get('content') or ''

                        if query in name or query in raw_desc or query in md_content:
                            if name not in results_dict:
                                results_dict[name] = {
                                    "id": item.get('id') or f"recipe_{idx + 1}",
                                    "name": name,
                                    "description": raw_desc,
                                    "markdownContent": md_content,
                                    "imageUrl": item.get('image_url') or item.get('imageUrl') or item.get(
                                        'image') or '',
                                    "file_path": item.get('file_path', ''),
                                    "source": "json"
                                }
                except Exception as e:
                    logger.warning(f"JSON读取失败: {e}")

            # ==========================================
            # 🌟 2. 搜索 Neo4j 图谱
            # ==========================================
            if hasattr(self, 'neo4j_driver') and self.neo4j_driver:
                try:
                    with self.neo4j_driver.session() as session:
                        cypher_query = """
                            MATCH (r:Recipe) 
                            WHERE r.name CONTAINS $s OR r.description CONTAINS $s OR r.markdownContent CONTAINS $s
                            RETURN r LIMIT 30
                        """
                        records = session.run(cypher_query, s=query)
                        for record in records:
                            node = record['r']
                            name = node.get("name")
                            if name and name not in results_dict:
                                results_dict[name] = {
                                    "id": node.get("id", name),
                                    "name": name,
                                    "description": node.get("description") or "",
                                    "markdownContent": node.get("markdownContent") or node.get("content") or "",
                                    "imageUrl": node.get("image_url") or node.get("imageUrl") or "",
                                    "file_path": node.get("file_path") or "",
                                    "source": "neo4j"
                                }
                except Exception as e:
                    logger.warning(f"Neo4j搜索失败: {e}")

            # ==========================================
            # 🌟 3. 后处理：硬盘雷达自动补全 (专治 Neo4j 缺数据)
            # ==========================================
            formatted_items = []
            # 确定硬盘菜谱目录
            dishes_dir = getattr(self, 'dishes_dir', 'data/dishes')
            if not os.path.exists(dishes_dir) and os.path.exists('data/dishes'):
                dishes_dir = 'data/dishes'

            for item in results_dict.values():
                name = item['name']
                file_path = item.get('file_path', '')
                md_content = item.get('markdownContent', '')
                raw_image = None
                img_val = item.get('imageUrl', '')

                # 3.1 【路径雷达】如果数据库没存 file_path，去硬盘里地毯式搜索同名 .md 文件！
                if not file_path and os.path.exists(dishes_dir):
                    for root, dirs, files in os.walk(dishes_dir):
                        if f"{name}.md" in files:
                            file_path = os.path.join(root, f"{name}.md").replace('\\', '/')
                            item['file_path'] = file_path
                            break

                # 3.2 【内容雷达】如果找到了文件路径，但是没正文，当场打开文件读取！
                if file_path and not md_content and os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as mf:
                            md_content = mf.read()
                    except:
                        pass

                # 3.3 【提取简介】现在万事俱备，呼叫最强大脑提取真实简介！
                raw_desc = item.get('description', '')
                item['description'] = extract_desc_from_md(name, md_content, raw_desc)

                # 3.4 【图片雷达】推断图片网络地址
                if img_val and img_val.startswith(('http://', 'https://')):
                    raw_image = img_val
                elif img_val and file_path:
                    # JSON 里配了相对路径，进行拼接
                    clean_path = file_path.replace('data/dishes/', '').replace('data\\dishes\\', '')
                    dir_name = os.path.dirname(clean_path)
                    img_name = img_val.lstrip('./').lstrip('\\')
                    raw_image = f"{base_url}/static/dishes/{dir_name}/{img_name}".replace('\\', '/')
                elif file_path:
                    # 连图片名都没配？直接在 .md 文件同级目录下找同名的 jpg/png！
                    base_dir = os.path.dirname(file_path)
                    base_name = os.path.splitext(os.path.basename(file_path))[0]
                    for ext in ['.webp', '.jpg', '.png', '.jpeg']:
                        candidate = os.path.join(base_dir, base_name + ext)
                        if os.path.exists(candidate):
                            rel_path = candidate.replace('\\', '/').split('data/dishes/')[-1]
                            raw_image = f"{base_url}/static/dishes/{rel_path}"
                            break

                # 3.5 最终图片保底
                if not raw_image:
                    safe_name = quote(name)
                    raw_image = f"https://placehold.co/600x400/e2e8f0/64748b?text={safe_name}"

                item['imageUrl'] = raw_image

                # 清理多余的大体积正文，不传给前端
                item.pop('markdownContent', None)
                formatted_items.append(item)

            return jsonify({"success": True, "data": {"items": formatted_items, "total": len(formatted_items)}})

        except Exception as e:
            logger.error(f"搜索API严重错误: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
    def _handle_category_recipes_request(self, category):
        """处理按分类获取菜谱请求"""
        from flask import jsonify, request

        try:
            page = request.args.get('page', 1, type=int)

            # 💡 调用实际的分类查询方法
            # recipes = self.rag_system.recipe_manager.get_recipes_by_category(category, page)
            recipes = []

            return jsonify({
                "success": True,
                "data": recipes
            })

        except Exception as e:
            logger.error(f"分类获取API错误: {e}")
            return jsonify({"success": False, "error": str(e)}), 500

    def _handle_favorites_request(self):
        """处理用户收藏请求 (真实数据库版 - 强壮兼容版)"""
        from flask import request, jsonify
        import logging

        logger = logging.getLogger(__name__)

        try:
            # 1. 获取收藏列表
            if request.method == 'GET':
                favorite_ids = self.user_db.get_favorites()

                favorite_recipes = []
                for rid in favorite_ids:
                    recipe = self.rag_system.recipe_manager.get_recipe_by_id(rid)
                    if recipe:
                        favorite_recipes.append(recipe)

                return jsonify({
                    "success": True,
                    "data": favorite_recipes
                })

            # 2. 添加收藏
            elif request.method == 'POST':
                # 🌟 修复 1：加上 silent=True，防止前端没传 JSON 格式导致 Flask 抛错
                # 如果解析失败，默认给一个空字典 {}
                data = request.get_json(silent=True) or {}

                # 🌟 修复 2：兼容多种字段名，无论前端传 recipeId, recipe_id 还是 id 都能接住！
                recipe_id = data.get('recipeId') or data.get('recipe_id') or data.get('id')

                if not recipe_id:
                    # 在后端打印一下前端到底传了什么过来，方便以后排错
                    logger.warning(f"添加收藏失败，缺少参数！前端传来的数据是: {data}")
                    return jsonify({"success": False, "error": "缺少菜谱ID参数"}), 400

                # 写入数据库
                success = self.user_db.add_favorite(recipe_id)
                if success:
                    return jsonify({"success": True, "message": "收藏成功"})
                else:
                    return jsonify({"success": False, "error": "数据库写入失败"}), 500

            # 3. 取消收藏
            elif request.method == 'DELETE':
                # 🌟 修复 3：安全获取 DELETE 请求的参数（可能在 URL 里，也可能在 Body 里）
                data = request.get_json(silent=True) or {}

                # 全方位拦截参数
                recipe_id = (request.args.get('recipeId') or
                             request.args.get('recipe_id') or
                             request.args.get('id') or
                             data.get('recipeId') or
                             data.get('recipe_id') or
                             data.get('id'))

                if not recipe_id:
                    logger.warning(f"取消收藏失败，前端参数是: args={request.args}, data={data}")
                    return jsonify({"success": False, "error": "缺少菜谱ID参数"}), 400

                # 从数据库删除
                success = self.user_db.remove_favorite(recipe_id)
                if success:
                    return jsonify({"success": True, "message": "已取消收藏"})
                else:
                    return jsonify({"success": False, "error": "数据库删除失败"}), 500

        except Exception as e:
            logger.error(f"收藏API发生严重错误: {e}")
            return jsonify({"success": False, "error": str(e)}), 500

    def _handle_rating_request(self):
        """处理用户评分请求"""
        from flask import request, jsonify

        try:
            data = request.get_json()
            recipe_id = data.get('recipeId')
            rating = data.get('rating')
            review = data.get('review', '')

            if not recipe_id or rating is None:
                return jsonify({"success": False, "error": "参数不完整"}), 400

            # 💡 执行保存评分逻辑
            # self.rag_system.user_manager.save_rating(recipe_id, rating, review)

            return jsonify({
                "success": True,
                "message": "评分提交成功"
            })

        except Exception as e:
            logger.error(f"评分API错误: {e}")
            return jsonify({"success": False, "error": str(e)}), 500