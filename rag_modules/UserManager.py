import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class UserManager:
    """
    用户数据管理器 (使用 SQLite 持久化存储)
    负责处理用户的收藏、评分等个性化数据
    """
    def __init__(self, db_path="data/users.db"):
        # 确保数据存放的目录存在
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        """获取数据库连接"""
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        """初始化数据库表结构"""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                # 创建收藏表 (PRIMARY KEY 保证同一个用户不会重复收藏同一道菜)
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS favorites (
                        user_id TEXT DEFAULT 'default_user',
                        recipe_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, recipe_id)
                    )
                ''')
                conn.commit()
                logger.info("✅ 用户数据库(SQLite)初始化成功")
        except Exception as e:
            logger.error(f"数据库初始化失败: {e}")

    def get_favorites(self, user_id='default_user') -> list:
        """从数据库读取该用户的所有收藏 ID"""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT recipe_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
                # 提取出所有的 recipe_id 组成一个列表
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"获取收藏失败: {e}")
            return []

    def add_favorite(self, recipe_id: str, user_id='default_user'):
        """将收藏写入数据库"""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                # INSERT OR IGNORE 防止重复插入报错
                cursor.execute('INSERT OR IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)',
                             (user_id, recipe_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"添加收藏失败: {e}")
            return False

    def remove_favorite(self, recipe_id: str, user_id='default_user'):
        """从数据库中删除收藏"""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?',
                             (user_id, recipe_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"取消收藏失败: {e}")
            return False