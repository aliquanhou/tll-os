# 部署说明

## 本地开发

### 环境要求
- Node.js >= 18
- npm >= 9

### 快速开始

```bash
# 进入商城目录
cd examples/commerce

# 安装依赖（零依赖，此步可选）
npm install

# 运行 Agent 端到端验证（创建 Application → 种子数据 → 注册模块 → Agent 工作流 → 测试）
node agent.js

# 运行测试套件
npm test

# 启动 HTTP 服务器（前台 + 后台 + API）
node server.js
```

启动后访问：
- 前台商城: http://localhost:3000/
- 后台管理: http://localhost:3000/admin.html
- API 文档: http://localhost:3000/api/storefront/home

### 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@tllcommerce.com | admin123 |
| 普通客户 | customer@example.com | customer123 |
| B2B 客户 | b2b@company.com | b2b123 |

## Docker 部署

### 构建镜像

```bash
cd examples/commerce
docker build -t tll-commerce:0.1.0 .
```

### 运行容器

```bash
docker run -d \
  --name tll-commerce \
  -p 3000:3000 \
  --restart unless-stopped \
  tll-commerce:0.1.0
```

### Docker Compose

```bash
cd examples/commerce
docker-compose up -d
```

查看日志:
```bash
docker-compose logs -f
```

停止服务:
```bash
docker-compose down
```

## 生产部署建议

> ⚠️ 当前版本基于 Runtime 0.1 内存实现，**不建议直接用于生产环境**。以下为未来生产部署的参考方案。

### 1. 持久化（需 TEP-002）

当前数据存储在内存中，重启后丢失。生产环境需接入数据库：
- 小型部署: SQLite
- 中型部署: PostgreSQL / MySQL
- 大型部署: 分布式数据库 + 缓存（Redis）

### 2. 反向代理

建议使用 Nginx 作为反向代理：
- HTTPS 终止（Let's Encrypt）
- 静态资源缓存
- 负载均衡（多实例部署）
- Gzip/Brotli 压缩

```nginx
server {
    listen 443 ssl http2;
    server_name shop.example.com;

    ssl_certificate /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 进程管理

使用 PM2 或 systemd 管理 Node 进程：

```bash
# PM2
npm install -g pm2
pm2 start server.js --name tll-commerce -i max
pm2 save
pm2 startup
```

### 4. 监控

- 健康检查: 需 TEP-009（Health Check & Metrics）
- 日志: 需 TEP-008（Logging Framework），接入 ELK/Loki
- 性能: APM 工具（New Relic / Datadog / 阿里云 ARMS）

### 5. 安全

- 权限系统: 需 TEP-006（RBAC）
- 中间件: 需 TEP-005（CORS、限流、鉴权）
- HTTPS: 全站加密
- 输入校验: 防止 SQL 注入、XSS
- 依赖审计: `npm audit`

## 项目结构

```
examples/commerce/
├── agent.js              # 主入口：创建 Application + Agent 工作流 + 测试
├── server.js             # HTTP 服务器：静态文件 + API 代理
├── package.json          # 项目配置
├── Dockerfile            # Docker 镜像构建
├── docker-compose.yml    # Docker Compose 编排
├── .dockerignore
├── docs/
│   ├── ARCHITECTURE.md   # 架构决策文档
│   ├── DEPLOYMENT.md     # 本文件
│   ├── FINAL-REPORT.md   # 最终报告
│   └── application-graph.json  # Application Graph 导出
├── proposals/            # TEP 提案（10 个）
├── tests/
│   └── run-tests.js      # 测试运行器
└── src/
    ├── data/
    │   ├── database.js   # 内存数据库（21 个 Map 集合）
    │   └── seed.js       # 种子数据
    ├── modules/          # 12 个业务 Module
    │   ├── catalog.js
    │   ├── customer.js
    │   ├── cart.js
    │   ├── order.js
    │   ├── payment.js
    │   ├── marketing.js
    │   ├── locale.js
    │   ├── b2b.js
    │   ├── file.js
    │   ├── admin.js
    │   ├── agent.js
    │   └── storefront.js
    ├── frontend/         # H5 前端
    │   ├── index.html
    │   ├── product.html
    │   ├── cart.html
    │   ├── checkout.html
    │   ├── orders.html
    │   ├── admin.html
    │   ├── css/style.css
    │   └── js/api.js
    └── utils.js          # 工具函数
```
