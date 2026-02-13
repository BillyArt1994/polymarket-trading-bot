import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(
    page_title="Polymarket 交易监控",
    page_icon="🤖",
    layout="wide",
)

st.title("🤖 Polymarket 套利交易监控面板")

# 数据库连接
@st.cache_resource
def get_connection():
    return sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

conn = get_connection()

# 侧边栏
def render_sidebar():
    st.sidebar.title("导航")
    st.sidebar.page_link("app.py", label="📊 总览", icon="🏠")
    st.sidebar.page_link("pages/1_markets.py", label="📈 市场监控")
    st.sidebar.page_link("pages/2_signals.py", label="🎯 交易信号")
    st.sidebar.page_link("pages/3_analytics.py", label="📉 数据分析")
    
    st.sidebar.divider()
    st.sidebar.metric("最后更新", datetime.now().strftime("%H:%M:%S"))

render_sidebar()

# 主面板 - 关键指标
col1, col2, col3, col4 = st.columns(4)

# 总资产（模拟，后期从实际数据计算）
total_capital = 1000
col1.metric("💰 总资产", f"${total_capital}", "+0%")

# 今日盈亏
try:
    today = datetime.now().strftime("%Y-%m-%d")
    pnl_df = pd.read_sql_query(
        f"SELECT COALESCE(SUM(pnl), 0) as pnl FROM trades WHERE DATE(created_at) = '{today}'",
        conn
    )
    today_pnl = pnl_df['pnl'].iloc[0] or 0
    col2.metric("📈 今日盈亏", f"${today_pnl:+.2f}", f"{today_pnl/total_capital*100:+.2f}%")
except:
    col2.metric("📈 今日盈亏", "$0.00", "0%")

# 活跃信号
try:
    signals_df = pd.read_sql_query(
        "SELECT COUNT(*) as count FROM signals WHERE status = 'pending'",
        conn
    )
    pending_signals = signals_df['count'].iloc[0]
    col3.metric("🎯 待确认信号", pending_signals)
except:
    col3.metric("🎯 待确认信号", 0)

# 今日交易数
try:
    trades_df = pd.read_sql_query(
        f"SELECT COUNT(*) as count FROM trades WHERE DATE(created_at) = '{today}'",
        conn
    )
    today_trades = trades_df['count'].iloc[0]
    col4.metric("⚡ 今日交易", f"{today_trades}/3")
except:
    col4.metric("⚡ 今日交易", "0/3")

st.divider()

# 活跃市场列表
st.subheader("🔥 活跃市场")

try:
    markets_df = pd.read_sql_query("""
        SELECT 
            m.question as 事件,
            m.category as 分类,
            p.yes_price as Yes价格,
            p.no_price as No价格,
            (p.yes_price + p.no_price) as 价格总和,
            ROUND((1 - (p.yes_price + p.no_price)) * 100, 2) as 偏离度,
            p.timestamp as 更新时间
        FROM markets m
        LEFT JOIN (
            SELECT market_id, yes_price, no_price, timestamp
            FROM price_snapshots
            WHERE (market_id, timestamp) IN (
                SELECT market_id, MAX(timestamp)
                FROM price_snapshots
                GROUP BY market_id
            )
        ) p ON m.id = p.market_id
        WHERE m.active = 1 AND m.resolved = 0
        ORDER BY p.timestamp DESC
        LIMIT 10
    """, conn)
    
    if not markets_df.empty:
        # 高亮偏离度列
        def highlight_deviation(val):
            if pd.isna(val):
                return ''
            val = float(val)
            if val > 1.5:
                return 'background-color: #ff6b6b; color: white'
            elif val > 1.0:
                return 'background-color: #ffd93d'
            return ''
        
        styled_df = markets_df.style.applymap(highlight_deviation, subset=['偏离度'])
        st.dataframe(styled_df, use_container_width=True)
    else:
        st.info("暂无市场数据，请等待数据抓取...")
except Exception as e:
    st.error(f"加载市场数据失败: {e}")
    st.info("请确保数据库已初始化并有数据")

# 最近信号
st.subheader("📢 最近信号")

try:
    signals_df = pd.read_sql_query("""
        SELECT 
            s.id,
            m.question as 事件,
            s.signal_type as 类型,
            ROUND(s.confidence * 100, 0) as 置信度,
            s.suggested_amount as 建议金额,
            s.status as 状态,
            s.created_at as 创建时间
        FROM signals s
        JOIN markets m ON s.market_id = m.id
        ORDER BY s.created_at DESC
        LIMIT 10
    """, conn)
    
    if not signals_df.empty:
        st.dataframe(signals_df, use_container_width=True)
    else:
        st.info("暂无交易信号")
except Exception as e:
    st.error(f"加载信号数据失败: {e}")

# 底部说明
st.divider()
st.caption("🤖 Polymarket 交易机器人 | 风险自控，谨慎投资")
