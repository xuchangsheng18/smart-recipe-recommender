## 技术栈与本地启动


###注意事项 
对于有些地方需要修改地址 :web_service_hadnler中init方法中的index_file
前端本地运行需要下载node.js
需要下载Neo4js-Desktop
### 前端
- **框架**：Next.js 14
- **样式**：Tailwind CSS
- **状态管理**：Zustand
- **动画**：Framer Motion
- **开发服务器端口**：3000

### 后端
- **框架**：Flask（Python 3.11）
- **端口**：8000
- **核心依赖**：
  - `neo4j-driver`：连接 Neo4j 图数据库
  - `pymilvus`：操作 Milvus Lite 向量数据库
  - `sentence-transformers`：加载本地嵌入模型 `bge-small-zh-v1.5`
  - `openai`：调用 DeepSeek-V4-Pro API（兼容 OpenAI 接口）

### 本地启动步骤
1. **启动 Neo4j 本地服务**  
   确保 Neo4j 社区版已安装并运行，默认监听 `bolt://localhost:7687`

2. **启动 Flask 后端**  
   ```bash
   python main.py
2. **启动 本地前端**
   cd frontend
   npm run dev 
