import streamlit as st
import json
import pandas as pd
from datetime import datetime
from pathlib import Path

st.set_page_config(page_title="回测报告", page_icon="📈", layout="wide")

st.title("📈 虚拟盘回测报告")

# 查找报告文件
reports_dir = Path("../reports")
if not reports_dir.exists():
    reports_dir = Path("./reports")

if reports_dir.exists():
    report_files = sorted(reports_dir.glob("backtest-*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
else:
    report_files = []

if not report_files:
    st.warning("⚠️ 没有找到回测报告文件")
    st.info("请先运行回测：`npm run backtest`")
    st.stop()

# 选择报告
selected_file = st.selectbox(
    "选择回测报告",
    report_files,
    format_func=lambda x: f"{x.name} ({datetime.fromtimestamp(x.stat().st_mtime).strftime('%Y-%m-%d %H:%M')})"
)

# 加载报告
with open(selected_file, 'r') as f:
    report = json.load(f)

config = report.get('config', {})
options = report.get('options', {})
result = report.get('result', {})

# 基本信息
st.header("📊 测试概览")

col1, col2, col3, col4 = st.columns(4)
col1.metric("测试天数", f"{options.get('days', 'N/A')} 天")
col2.metric("市场数量", options.get('markets', 'N/A'))
col3.metric("最小套利阈值", f"{(config.get('minArbitrageGap', 0) * 100):.2f}%")
col4.metric("初始资金", f"${config.get('initialCapital', 0)}")

st.divider()

# 核心指标
st.header("🎯 核心指标")

col1, col2, col3, col4 = st.columns(4)

total_trades = result.get('totalTrades', 0)
col1.metric("总交易数", total_trades)

win_rate = result.get('winRate', 0)
col2.metric("胜率", f"{win_rate:.2f}%")

total_pnl = result.get('totalPnL', 0)
total_pnl_pct = result.get('totalPnLPercent', 0)
col3.metric("总盈亏", f"${total_pnl:.2f}", f"{total_pnl_pct:.2f}%")

avg_return = result.get('avgReturn', 0)
col4.metric("平均收益", f"{avg_return:.2f}%")

col1, col2, col3 = st.columns(3)

max_drawdown = result.get('maxDrawdown', 0)
col1.metric("最大回撤", f"{max_drawdown:.2f}%", delta_color="inverse")

sharpe = result.get('sharpeRatio', 0)
col2.metric("夏普比率", f"{sharpe:.2f}")

winning = result.get('winningTrades', 0)
losing = result.get('losingTrades', 0)
col3.metric("盈亏次数", f"🟢{winning} / 🔴{losing}")

# 盈亏评估
def get_assessment(pnl_pct, win_rate, sharpe, max_dd):
    if pnl_pct > 50 and win_rate >= 60 and sharpe > 1.5 and max_dd < 10:
        return "🟢 优秀", "策略表现非常出色，值得实盘测试"
    elif pnl_pct > 20 and win_rate >= 55 and sharpe > 1 and max_dd < 15:
        return "🟡 良好", "策略表现不错，可以小资金测试"
    elif pnl_pct > 0:
        return "🟡 一般", "策略有盈利但需优化参数"
    else:
        return "🔴 较差", "策略亏损，需要重新设计"

assessment, advice = get_assessment(total_pnl_pct, win_rate, sharpe, max_drawdown)
st.info(f"**评估**: {assessment} - {advice}")

st.divider()

# 交易明细
trades = result.get('trades', [])
if trades:
    st.header(f"📝 交易明细 ({len(trades)} 笔)")
    
    trades_df = pd.DataFrame(trades)
    
    # 格式化时间
    if 'entryTime' in trades_df.columns:
        trades_df['entryTime'] = pd.to_datetime(trades_df['entryTime']).dt.strftime('%Y-%m-%d %H:%M')
    if 'exitTime' in trades_df.columns:
        trades_df['exitTime'] = pd.to_datetime(trades_df['exitTime']).dt.strftime('%Y-%m-%d %H:%M')
    
    # 选择展示列
    display_cols = ['id', 'marketName', 'side', 'entryPrice', 'exitPrice', 'pnl', 'pnlPercent', 'exitReason']
    available_cols = [c for c in display_cols if c in trades_df.columns]
    
    # 格式化数值
    if 'pnl' in trades_df.columns:
        trades_df['盈亏'] = trades_df['pnl'].apply(lambda x: f"${x:.2f}" if x is not None else "N/A")
    if 'pnlPercent' in trades_df.columns:
        trades_df['收益率'] = trades_df['pnlPercent'].apply(lambda x: f"{x:.2f}%" if x is not None else "N/A")
    
    # 高亮盈亏
    def highlight_pnl(val):
        if isinstance(val, str):
            if val.startswith('$'):
                num = float(val.replace('$', ''))
                if num > 0:
                    return 'color: #2e7d32; font-weight: bold'
                elif num < 0:
                    return 'color: #c62828; font-weight: bold'
        return ''
    
    styled_df = trades_df[available_cols].style.applymap(highlight_pnl, subset=['pnl'] if 'pnl' in trades_df.columns else [])
    
    st.dataframe(styled_df, use_container_width=True, height=400)
    
    # 统计图表
    st.subheader("📊 收益分布")
    
    if 'pnlPercent' in trades_df.columns:
        import plotly.express as px
        
        fig = px.histogram(
            trades_df, 
            x='pnlPercent',
            nbins=20,
            title='单笔收益分布',
            labels={'pnlPercent': '收益率 (%)', 'count': '交易次数'}
        )
        fig.add_vline(x=0, line_dash="dash", line_color="red")
        st.plotly_chart(fig, use_container_width=True)

# 风险提示
st.divider()
st.subheader("⚠️ 重要提示")
st.warning("""
**注意：以上结果基于模拟数据，实际交易会有以下差异：**
- 真实市场存在滑点，成交价格可能与预期不同
- Gas 费波动可能影响小额交易利润
- 流动性限制可能导致无法完全按策略执行
- 过去表现不代表未来收益

**建议先用小资金实盘测试 1-2 周，观察真实表现后再做决定。**
""")

# 刷新按钮
if st.button("🔄 刷新报告列表"):
    st.rerun()
