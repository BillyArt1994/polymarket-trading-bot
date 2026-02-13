# Polymarket 套利交易机器人

基于 TypeScript + Node.js 的 Polymarket 预测市场套利交易机器人。

## 功能特性

- 🤖 **Telegram Bot**：实时推送交易信号，支持手动确认
- 📊 **Web Dashboard**：Streamlit 数据可视化面板
- 🎯 **套利策略**：自动检测 Yes/No 价格偏离机会
- ⚡ **风险控制**：日亏损限额、单笔限额、熔断机制
- 💾 **本地存储**：SQLite 数据库，轻量高效
- 🔄 **信号分级**：1.5%/3%/5% 三级偏离度策略

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/BillyArt1994/polymarket-trading-bot.git
cd polymarket-trading-bot
```

### 2. 安装依赖

**Node.js 依赖：**
```bash
npm install
```

**Python 依赖（Dashboard）：**
```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# Telegram Bot（从 @BotFather 获取）
BOT_TOKEN=your_bot_token_here
ALLOWED_CHAT_ID=your_telegram_chat_id

# 钱包地址（只读监控）
WALLET_ADDRESS=0xYourWalletAddress

# 运行模式: SIMULATION 或 LIVE
MODE=SIMULATION

# 可选：数据库路径
DB_PATH=./data/trading_bot.db
```

**获取 Telegram Chat ID：**
1. 给 @userinfobot 发送任意消息
2. 它会回复你的 Chat ID

### 4. 初始化数据库

```bash
npm run init-db
```

### 5. 启动机器人

**方式一：同时启动机器人和 Dashboard**

终端1 - 启动交易机器人：
```bash
npm run dev
```

终端2 - 启动 Dashboard：
```bash
cd dashboard
streamlit run app.py
```

然后浏览器访问：`http://localhost:8501`

## 项目结构

```
polymarket-trading-bot/
├── src/                       # 核心代码
│   ├── config/               # 配置文件
│   ├── database/             # 数据库操作
│   │   ├── connection.ts     # 数据库连接
│   │   └── repositories/     # 数据访问层
│   ├── services/             # 业务逻辑
│   │   ├── data/            # 数据抓取 (Polymarket API)
│   │   ├── strategy/        # 策略引擎
│   │   │   ├── arbitrage.ts           # 套利检测
│   │   │   ├── signalGenerator.ts     # 信号生成
│   │   │   └── positionManager.ts     # 持仓管理
│   │   ├── risk/            # 风控模块
│   │   │   └── riskManager.ts         # 风险管理
│   │   └── execution/       # 交易执行
│   ├── bot/                 # Telegram Bot
│   │   └── index.ts         # Bot 实现
│   ├── types/               # 类型定义
│   └── index.ts             # 入口文件
├── dashboard/                # Streamlit 面板
│   ├── app.py               # 主应用
│   └── pages/               # 子页面
│       ├── 1_markets.py     # 市场监控
│       ├── 2_signals.py     # 交易信号
│       ├── 3_analytics.py   # 数据分析
│       └── 4_risk.py        # 风控状态
├── scripts/                  # 工具脚本
│   ├── schema.sql           # 数据库表结构
│   └── init-db.ts           # 初始化数据库
├── data/                     # 本地数据库（不提交）
├── .env.example              # 环境变量模板
├── .gitignore               # Git忽略规则
├── package.json             # Node.js 依赖
├── requirements.txt         # Python 依赖
└── tsconfig.json            # TypeScript 配置
```

## 策略说明

### 套利策略

检测 Yes + No 价格偏离（理论上应 = 1）：

| 偏离度 | 等级 | 有效期 | 处理方式 |
|--------|------|--------|----------|
| 1.5% - 3% | 保守 | 3分钟 | 收益有限，需确认 gas |
| 3% - 5% | 激进 | 5分钟 | 标准套利 |
| >5% | 高风险 | 10分钟 | 可能存在隐藏风险 |

### 风控规则

- ✅ **日亏损限额**：5%（50元）触发熔断
- ✅ **单笔限额**：20%（200元）
- ✅ **日交易次数**：最多3次
- ✅ **最小套利空间**：1.5%

### 止盈策略

- 50% 回归 → 减仓
- 完全回归（<0.5%）→ 全部平仓
- 持仓超24小时 → 重新评估

## 使用流程

### 模拟模式（推荐起步）

```bash
MODE=SIMULATION npm run dev
```

1. 机器人每5分钟抓取市场价格
2. 检测到套利机会 → 记录信号
3. Telegram 推送通知
4. 你在 Dashboard 查看详情
5. 观察1周，记录信号质量
6. 根据数据调整阈值

### 实盘模式

```bash
MODE=LIVE npm run dev
```

**手动确认流程：**
1. Telegram 收到信号推送
2. 点击"确认执行"按钮
3. 在 MetaMask 中手动执行交易
4. 回复 `/done {signal_id}` 记录交易

## Dashboard 功能

| 页面 | 功能 |
|------|------|
| **总览看板** | 实时盈亏、待确认信号、最新套利机会 |
| **市场监控** | 筛选排序、偏离度高亮、套利分析 |
| **交易信号** | 状态筛选、确认/忽略、历史统计 |
| **数据分析** | 盈亏曲线、套利机会趋势、信号质量 |
| **风控状态** | 限额进度、熔断提醒、交易日志 |

## 测试

```bash
# 运行单元测试
npm test

# 运行特定测试
npm test -- arbitrage.test.ts
```

## 常见问题

### better-sqlite3 安装失败

**原因**：Node.js 版本兼容性问题

**解决**：
```bash
# 方法1：使用预构建版本
npm install better-sqlite3@latest --build-from-source

# 方法2：降级 Node.js 到 LTS 版本
nvm use 20
npm install
```

### Telegram Bot 不推送

**检查：**
1. `.env` 中 `BOT_TOKEN` 是否正确
2. `ALLOWED_CHAT_ID` 是否是你的数字ID（不是用户名）
3. 是否给 Bot 发送了 `/start`

### Dashboard 显示"数据库连接失败"

**检查：**
1. 是否运行了 `npm run init-db`
2. `data/trading_bot.db` 文件是否存在
3. Dashboard 是否在正确目录运行

## 开发计划

- [x] 项目架构设计
- [x] 数据库设计
- [x] Polymarket 数据抓取
- [x] 套利策略实现
- [x] Telegram Bot
- [x] 风控系统
- [x] Streamlit Dashboard
- [x] 单元测试
- [ ] 回测系统（后续迭代）
- [ ] 自动交易执行（后续迭代）

## 免责声明

⚠️ **风险提示**：

1. 本项目仅供学习研究使用，不构成投资建议
2. 加密货币交易存在高风险，可能损失全部本金
3. 请仅用可承受损失的资金进行测试
4. Polymarket 在某些地区可能受限，请遵守当地法规

## License

MIT

---

**作者**：Billy  
**GitHub**：https://github.com/BillyArt1994/polymarket-trading-bot
