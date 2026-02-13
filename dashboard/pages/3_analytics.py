import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

st.set_page_config(page_title="数据分析", page_icon="📉")

st.title("📉 数据分析")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 时间范围选择
period = st.selectbox("时间范围", ["最近7天", "最近30天", "全部"])
days = {"最近7天": 7, "最近30天": 30, "全部": 365}[period]
start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

# 盈亏曲线
try:
    pnl_query = f"""
        SELECT 
            DATE(created_at) as 日期,
            COALESCE(SUM(pnl), 0) as 盈亏
        FROM trades
        WHERE DATE(created_at) >= '{start_date}'
        GROUP BY DATE(created_at)
        ORDER BY 日期
    """
    pnl_df = pd.read_sql_query(pnl_query, conn)
    
    if not pnl_df.empty:
        pnl_df['累计盈亏'] = pnl_df['盈亏'].cumsum()
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=pnl_df['日期'], 
            y=pnl_df['累计盈亏'],
            mode='lines+markers',
            name='累计盈亏',
            line=dict(color='#4d96ff', width=2)
        ))
        fig.update_layout(
            title="盈亏曲线",
            xaxis_title="日期",
            yaxis_title="盈亏 (USD)",
            hovermode='x unified'
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("暂无交易数据")
except Exception as e:
    st.error(f"加载盈亏数据失败: {e}")

# 套利机会统计
try:
    opp_query = f"""
        SELECT 
            DATE(detected_at) as 日期,
            COUNT(*) as 机会数,
            AVG(deviation_percent) * 100 as 平均偏离度
        FROM arbitrage_opportunities
        WHERE DATE(detected_at) >= '{start_date}'
        GROUP BY DATE(detected_at)
        ORDER BY 日期
    """
    opp_df = pd.read_sql_query(opp_query, conn)
    
    if not opp_df.empty:
        fig = px.bar(
            opp_df, 
            x='日期', 
            y='机会数',
            title='每日套利机会数',
            color='平均偏离度',
            color_continuous_scale='RdYlGn'
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("暂无套利机会数据")
except Exception as e:
    st.error(f"加载套利数据失败: {e}")

# 关键指标
st.divider()
st.subheader("📊 关键指标")

col1, col2, col3 = st.columns(3)

try:
    # 胜率
    win_query = f"""
        SELECT 
            COUNT(CASE WHEN pnl > 0 THEN 1 END) as 盈利次数,
            COUNT(CASE WHEN pnl < 0 THEN 1 END) as 亏损次数,
            COUNT(*) as 总次数,
            AVG(pnl) as 平均盈亏
        FROM trades
        WHERE DATE(created_at) >= '{start_date}' AND status = 'settled'
    """
    win_df = pd.read_sql_query(win_query, conn)
    
    if win_df['总次数'].iloc[0] > 0:
        win_rate = win_df['盈利次数'].iloc[0] / win_df['总次数'].iloc[0] * 100
        col1.metric("胜率", f"{win_rate:.1f}%")
        col2.metric("总交易", int(win_df['总次数'].iloc[0]))
        col3.metric("平均盈亏", f"${win_df['平均盈亏'].iloc[0]:.2f}")
    else:
        col1.metric("胜率", "N/A")
        col2.metric("总交易", 0)
        col3.metric("平均盈亏", "$0")
except Exception as e:
    st.error(f"加载指标失败: {e}")
