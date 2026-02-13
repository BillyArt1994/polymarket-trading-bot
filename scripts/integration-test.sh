#!/bin/bash

# Polymarket 交易机器人 - 集成测试脚本

echo "🧪 开始集成测试..."
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# 简单测试函数
run_test() {
    local test_name=$1
    local test_cmd=$2
    
    echo -n "Testing: $test_name ... "
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo "✓ PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ FAILED"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# 1. 文件结构测试
echo "📁 1. 文件结构检查"
run_test "项目目录存在" "[ -d /Users/huangxiaoming/clawd/polymarket-trading-bot ]"
run_test "package.json 存在" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/package.json ]"
run_test "README.md 存在" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/README.md ]"
run_test "核心代码目录存在" "[ -d /Users/huangxiaoming/clawd/polymarket-trading-bot/src ]"
run_test "Dashboard 目录存在" "[ -d /Users/huangxiaoming/clawd/polymarket-trading-bot/dashboard ]"
echo ""

# 2. 核心文件测试
echo "📄 2. 核心文件检查"
run_test "套利策略文件" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/src/services/strategy/arbitrage.ts ]"
run_test "风控管理文件" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/src/services/risk/riskManager.ts ]"
run_test "Telegram Bot 文件" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/src/bot/index.ts ]"
run_test "入口文件" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/src/index.ts ]"
echo ""

# 3. Git 测试
echo "📦 3. Git 仓库检查"
run_test "Git 仓库初始化" "[ -d /Users/huangxiaoming/clawd/polymarket-trading-bot/.git ]"
run_test "远程仓库配置" "cd /Users/huangxiaoming/clawd/polymarket-trading-bot && git remote -v | grep -q 'github.com'"
echo ""

# 4. Dashboard 测试
echo "📊 4. Dashboard 检查"
run_test "Dashboard 主文件" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/dashboard/app.py ]"
run_test "Dashboard 市场页面" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/dashboard/pages/1_markets.py ]"
run_test "Dashboard 风控页面" "[ -f /Users/huangxiaoming/clawd/polymarket-trading-bot/dashboard/pages/4_risk.py ]"
echo ""

echo "========================================"
echo "测试完成!"
echo "========================================"
echo "通过: $TESTS_PASSED"
echo "失败: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✓ 所有测试通过！"
    exit 0
else
    echo "⚠ 部分测试未通过"
    exit 1
fi
