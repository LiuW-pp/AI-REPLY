# 🚀 AI 互联网嘴替系统 — 阿里云 ECS 部署指南

## 前置条件

- 阿里云 ECS（建议 2 核 4G，CentOS 7+ 或 Ubuntu 20.04+）
- 已安装 Docker & Docker Compose
- 已安装 Git

```bash
# 一键安装 Docker（CentOS 示例）
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker
```

## 部署步骤

### 1. 拉取代码

```bash
git clone https://github.com/LiuW-pp/AI-REPLY.git /opt/ai-reply
cd /opt/ai-reply
```

### 2. 配置 API 密钥

```bash
cp .env.example .env
vim .env
```

填入你的真实凭据：

```
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-your-real-key-here
AI_MODEL=deepseek-chat
```

### 3. 构建并启动

```bash
docker compose up -d --build
```

### 4. 验证

```bash
curl http://localhost:3000
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `docker compose up -d --build` | 构建并后台启动 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose restart` | 重启服务 |
| `docker compose down` | 停止并删除容器 |
| `docker compose pull` | 拉取最新镜像 |

## 配置 Nginx 反向代理（可选）

如需绑定域名 + HTTPS：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

使用 Certbot 自动获取 SSL 证书：

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

## 架构说明

- **纯前端 + 无状态 API**，无需数据库
- Next.js `standalone` 模式，镜像体积约 ~150MB
- 单容器运行，端口 3000
- API 密钥通过环境变量注入，不写入镜像
