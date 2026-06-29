# 🚀 AI 互联网嘴替系统 — 阿里云 ECS 部署指南

> 目标服务器：**root@119.23.57.195** | Ubuntu 24.04

---

## 第一步：登录服务器 + 安装 Docker

在本地终端执行：

```bash
ssh root@119.23.57.195
```

登录后，一键安装 Docker 和 Docker Compose：

```bash
curl -fsSL https://get.docker.com | bash

# 安装 docker compose 插件（如果上面没带上）
apt install docker-compose-v2 -y

# 验证
docker --version && docker compose version
```

---

## 第二步：上传项目代码

在本地 **Windows PowerShell** 中执行（不要用 cmd）：

```powershell
scp -r -o StrictHostKeyChecking=no D:\ai-reply-system\ root@119.23.57.195:/root/
```

> 如果 scp 报文件过多或速度慢，先打包再传：
>
> ```powershell
> cd D:\ai-reply-system
> tar --exclude=node_modules --exclude=.git --exclude=.next -czf ..\ai-reply.tar.gz .
> scp D:\ai-reply.tar.gz root@119.23.57.195:/root/
> ```
>
> 然后回到服务器 SSH 里解压：
> ```bash
> mkdir -p /root/ai-reply-system
> tar -xzf /root/ai-reply.tar.gz -C /root/ai-reply-system/
> ```

---

## 第三步：配置 API 密钥

回到服务器 SSH 终端：

```bash
cd /root/ai-reply-system
cp .env.example .env
vim .env
```

按 `i` 进入编辑模式，填入真实凭据，然后 `Esc` `:wq` 保存：

```
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-your-real-key-here
AI_MODEL=deepseek-chat
```

---

## 第四步：启动服务

```bash
cd /root/ai-reply-system
docker compose up -d --build
```

构建需要 2-3 分钟。完成后验证：

```bash
# 本地测试
curl http://localhost

# 浏览器访问
# http://119.23.57.195
```

---

## 常用管理命令

| 命令 | 说明 |
|------|------|
| `docker compose logs -f` | 查看实时日志 |
| `docker compose restart` | 重启服务 |
| `docker compose down` | 停止并删除容器 |
| `docker compose up -d --build` | 重新构建并启动 |
| `docker compose ps` | 查看运行状态 |

---

## 阿里云安全组配置（重要）

请到阿里云控制台 → ECS → 安全组 → 入方向规则，添加入站规则：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 22 | TCP | 0.0.0.0/0 | SSH |

如果没有开放 80 端口，外部无法访问 `http://119.23.57.195`。

---

## 更新代码

以后本地改了代码想更新服务器：

```powershell
# 本地 PowerShell：打包上传
cd D:\ai-reply-system
tar --exclude=node_modules --exclude=.git --exclude=.next -czf ..\ai-reply.tar.gz .
scp D:\ai-reply.tar.gz root@119.23.57.195:/root/
```

```bash
# 服务器 SSH：解压并重启
cd /root/ai-reply-system
tar -xzf /root/ai-reply.tar.gz
docker compose up -d --build
```
