import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(
    page_title="Polymarket 交易监控",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# 自定义样式
st.markdown("""
<style>
    .metric-card {
        background-color: #f0f2f6;
        padding: 20px;
        border-radius: 10px;
        border-left: 5px solid #4d96ff;
    }
    .risk-warning {
        background-color: #ffebee;
        padding: 10px;
        border-radius: 5px;
        border-left: 5px solid #f44336;
        color: #c62828;
    }
    .signal-conservative {
        background-color: #e3f2fd;
        padding: 10px;
        border-radius: 5px;
        border-left: 5px solid #2196f3;
    }
    .signal-aggressive {
        background-color: #fff3e0;
        padding: 10px;
        border-radius: 5px;
        border-left: 5px solid #ff9800;
    }
    .signal-risky {
        background-color: #ffebee;
        padding: 10px;
        border-radius: 5px;
        border-left: 5px solid #f44336;
    }
</style>
""", unsafe_allow_html=True)

st.title("🤖 Polymarket 套利交易监控面板")

# 数据库连接
@st.cache_resource
def get_connection():
    return sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

def refresh_connection():
    return sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

conn = refresh_connection()

# 侧边栏导航
def render_sidebar():
    st.sidebar.title("📍 导航")
    st.sidebar.page_link("app.py", label="📊 总览看板", icon="🏠")
    st.sidebar.page_link("pages/1_markets.py", label="📈 市场监控")
    st.sidebar.page_link("pages/2_signals.py", label="🎯 交易信号")
    st.sidebar.page_link("pages/3_analytics.py", label="📉 数据分析")
    st.sidebar.page_link("pages/4_risk.py", label="⚠️ 风控状态")
    
    st.sidebar.divider()
    st.sidebar.metric("⏰ 最后刷新", datetime.now().strftime("%H:%M:%S"))
    
    # 运行模式
    try:
        mode_df = pd.read_sql_query(
            "SELECT COUNT(*) as count FROM signals LIMIT 1", conn
        )
        st.sidebar.success("✅ 数据库连接正常")
    except:
        st.sidebar.error("❌ 数据库连接失败")
    
    if st.sidebar.button("🔄 刷新数据"):
        st.rerun()

render_sidebar()

# 获取风控数据
def get_risk_data():
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        
        # 今日盈亏
        pnl_df = pd.read_sql_query(f"""
            SELECT COALESCE(SUM(pnl), 0) as pnl, COUNT(*) as trades
            FROM trades 
            WHERE DATE(created_at) = '{today}'
        """, conn)
        
        # 今日信号数
        signals_df = pd.read_sql_query(f"""
            SELECT COUNT(*) as count 
            FROM signals 
            WHERE DATE(created_at) = '{today}' AND status IN ('confirmed', 'executed')
        """, conn)
        
        # 待确认信号
        pending_df = pd.read_sql_query(
            "SELECT COUNT(*) as count FROM signals WHERE status = 'pending'", conn
        )
        
        return {
            'today_pnl': pnl_df['pnl'].iloc[0] or 0,
            'today_trades': pnl_df['trades'].iloc[0] or 0,
            'today_signals': signals_df['count'].iloc[0] or 0,
            'pending_signals': pending_df['count'].iloc[0] or 0,
        }
    except Exception as e:
        st.error(f"获取风控数据失败: {e}")
        return {
            'today_pnl': 0,
            'today_trades': 0,
            'today_signals': 0,
            'pending_signals': 0,
        }

risk_data = get_risk_data()
total_capital = 1000

# 关键指标卡片
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("💰 总资产", f"${total_capital}", "+0%")

with col2:
    pnl = risk_data['today_pnl']
    pnl_pct = (pnl / total_capital) * 100
    st.metric("📈 今日盈亏", f"${pnl:+.2f}", f"{pnl_pct:+.2f}%", 
              delta_color="inverse" if pnl < 0 else "normal")

with col3:
    st.metric("🎯 待确认信号", risk_data['pending_signals'])

with col4:
    trades_left = 3 - risk_data['today_signals']
    st.metric("⚡ 今日交易", f"{risk_data['today_signals']}/3", 
              f"剩余 {max(0, trades_left)} 次")

# 风控状态提醒
if risk_data['today_pnl'] <= -50:  # 5% 限额
    st.markdown(
        '<div class="risk-warning">⚠️ <b>风控提醒</b>：今日亏损已达5%限额，暂停新交易</div>',
        unsafe_allow_html=True
    )

st.divider()

# 最新套利机会
st.subheader("🔥 最新套利机会")

try:
    opportunities_df = pd.read_sql_query("""
        SELECT 
            m.question as 事件,
            m.category as 分类,
            ao.yes_price as Yes价格,
            ao.no_price as No价格,
            ao.total_price as 价格总和,
            ROUND(ao.deviation_percent, 2) as 偏离度,
            ao.detected_at as 检测时间,
            CASE 
                WHEN ao.deviation_percent >= 5 THEN 'RISKY'
                WHEN ao.deviation_percent >= 3 THEN 'AGGRESSIVE'
                ELSE 'CONSERVATIVE'
            END as 等级
        FROM arbitrage_opportunities ao
        JOIN markets m ON ao.market_id = m.id
        WHERE ao.status = 'open'
        ORDER BY ao.detected_at DESC
        LIMIT 5
    """, conn)
    
    if not opportunities_df.empty:
        # 高亮显示
        def highlight_level(row):
            level = row['等级']
            if level == 'RISKY':
                return ['background-color: #ffebee'] * len(row)
            elif level == 'AGGRESSIVE':
                return ['background-color: #fff3e0'] * len(row)
            else:
                return ['background-color: #e3f2fd'] * len(row)
        
        styled_df = opportunities_df.style.apply(highlight_level, axis=1)
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
    else:
        st.info("暂无活跃套利机会，等待下一次市场检查...")
except Exception as e:
    st.error(f"加载套利机会失败: {e}")

# 最近信号
st.subheader("📢 最近交易信号")

try:
    signals_df = pd.read_sql_query("""
        SELECT 
            s.id,
            m.question as 事件,
            s.signal_type as 类型,
            ROUND(s.confidence * 100, 0) as 置信度,
            s.suggested_amount as 建议金额,
            s.status as 状态,
            s.level as 等级,
            s.expiry_minutes as 有效期,
            s.created_at as 创建时间
        FROM signals s
        JOIN markets m ON s.market_id = m.id
        ORDER BY s.created_at DESC
        LIMIT 10
    """, conn)
    
    if not signals_df.empty:
        # 状态颜色映射
        def color_status(val):
            colors = {
                'pending': 'color: #ff9800; font-weight: bold',
                'confirmed': 'color: #4caf50; font-weight: bold',
                'rejected': 'color: #f44336',
                'executed': 'color: #2196f3; font-weight: bold',
                'expired': 'color: #9e9e9e',
            }
            return colors.get(val, '')
        
        styled_df = signals_df.style.applymap(color_status, subset=['状态'])
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
    else:
        st.info("暂无交易信号")
except Exception as e:
    st.error(f"加载信号失败: {e}")

# 活跃市场速览
st.subheader("📊 活跃市场速览")

try:
    markets_df = pd.read_sql_query("""
        SELECT 
            m.question as 事件,
            m.category as 分类,
            ROUND(p.yes_price, 3) as Yes价格,
            ROUND(p.no_price, 3) as No价格,
            ROUND(p.yes_price + p.no_price, 3) as 总和,
            ROUND((1 - (p.yes_price + p.no_price)) * 100, 2) as 偏离度,
            ROUND(p.volume_24h, 0) as 交易量
        FROM markets m
        LEFT JOIN (
            SELECT market_id, yes_price, no_price, volume_24h
            FROM price_snapshots
            WHERE (market_id, timestamp) IN (
                SELECT market_id, MAX(timestamp)
                FROM price_snapshots
                GROUP BY market_id
            )
        ) p ON m.id = p.market_id
        WHERE m.active = 1 AND m.resolved = 0
        ORDER BY p.volume_24h DESC
        LIMIT 10
    """, conn)
    
    if not markets_df.empty:
        def highlight_deviation(val):
            if pd.isna(val):
                return ''
            val = float(val)
            if val > 1.5:
                return 'background-color: #ff6b6b; color: white; font-weight: bold'
            elif val > 1.0:
                return 'background-color: #ffd93d'
            return ''
        
        styled_df = markets_df.style.applymap(highlight_deviation, subset=['偏离度'])
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
    else:
        st.info("暂无市场数据")
except Exception as e:
    st.error(f"加载市场数据失败: {e}")

# 底部信息
st.divider()
col1, col2, col3 = st.columns(3)

with col1:
    st.caption("🤖 Polymarket 套利交易机器人")
with col2:
    st.caption("📊 运行模式: 模拟交易")
with col3:
    st.caption("⏱️ 检查间隔: 5分钟")

st.caption("⚠️ 风险提示：本工具仅供学习研究，不构成投资建议。加密货币交易存在高风险。")
