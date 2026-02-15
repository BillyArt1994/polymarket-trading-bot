# 🌐 Dashboard 外网访问指南

## 快速开始（3步搞定）

### 第 1 步：首次运行（配置 ngrok）

```bash
cd polymarket-trading-bot
./scripts/start-ngrok.sh
```

脚本会自动：
1. 安装 ngrok（如果没有）
2. 提示你输入 ngrok authtoken
3. 启动 Dashboard
4. 生成外网访问链接

### 第 2 步：获取 authtoken

1. 访问 https://dashboard.ngrok.com/signup
2. 用 GitHub 或邮箱注册
3. 复制 authtoken（格式：ngrok_auth_token_xxxxx）
4. 粘贴到脚本提示中

### 第 3 步：访问 Dashboard

脚本会输出类似：
```
🎉 外网访问地址:
   https://xxxx-xxxxx.ngrok-free.app
```

把这个链接复制到手机浏览器或发给朋友，就能随时随地查看！

---

## 日常使用

### 启动外网访问
```bash
cd polymarket-trading-bot
./scripts/start-ngrok.sh
```

### 停止服务
```bash
./scripts/start-ngrok.sh --stop
```

### 或者直接按 Ctrl+C

---

## ⚠️ 注意事项

| 限制 | 说明 |
|------|------|
| **链接变化** | 每次重启 ngrok，链接都会变 |
| **免费限制** | 40连接/分钟，适合个人使用 |
| **服务时长** | 关闭终端后服务停止 |
| **安全性** | 链接是随机的，但建议不要分享敏感信息 |

---

## 🔧 进阶配置

### 固定域名（付费功能）

如果需要固定链接，可以：
1. 升级 ngrok 付费版
2. 配置自定义域名
3. 或使用自己的服务器部署

### 长期运行方案

**方案 A：服务器部署**
- 购买云服务器（阿里云/腾讯云/AWS）
- 部署 Dashboard 到服务器
- 配置域名 + SSL

**方案 B：内网穿透工具**
- 花生壳
- FRP
- Cloudflare Tunnel

---

## 📱 使用场景

- ✅ 手机随时查看交易状态
- ✅ 出门在外监控市场
- ✅ 分享给朋友看演示
- ✅ 多设备同时访问

---

## 🆘 常见问题

**Q: 链接打不开？**
A: 检查电脑是否联网，防火墙是否放行 8501 端口

**Q: 提示 "ngrok 限制 exceeded"？**
A: 免费版有速率限制，等待1分钟后重试

**Q: 想固定链接怎么办？**
A: 升级 ngrok Pro，或使用自己的服务器

**Q: 安全吗？**
A: 链接随机生成，有效期内可访问。建议仅供个人使用。
