# TLL OS Commerce - Dockerfile
# 基于 Node.js 20 Alpine，轻量级镜像

FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 复制 package.json
COPY package.json ./

# 安装依赖（本项目零依赖，仅保留步骤以兼容未来）
RUN npm install --production || true

# 复制源码
COPY . .

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/storefront/home').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 启动服务
CMD ["node", "server.js"]
