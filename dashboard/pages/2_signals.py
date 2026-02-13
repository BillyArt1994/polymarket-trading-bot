import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="交易信号", page_icon="🎯")

st.title("🎯 交易信号历史")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 状态筛选
status_filter = st.selectbox("状态筛选", ["全部", "pending", "confirmed", "rejected", "executed"])

# 信号列表
try:
    query = """
        SELECT 
            s.id,
            m.question as 事件,
            s.signal_type as 类型,
            ROUND(s.confidence * 100, 0) || '%' as 置信度,
            '$' || s.suggested_amount as 建议金额,
            s.reason as 原因,
            s.status as 状态,
            s.created_at as 创建时间,
            s.confirmed_at as 确认时间,
            s.executed_at as 执行时间
        FROM signals s
        JOIN markets m ON s.market_id = m.id
        ORDER BY s.created_at DESC
    """
    
    if status_filter != "全部":
        query += f" WHERE s.status = '{status_filter}'"
    
    signals_df = pd.read_sql_query(query, conn)
    
    if not signals_df.empty:
        # 状态颜色映射
        def highlight_status(val):
            colors = {
                'pending': 'background-color: #ffd93d',
                'confirmed': 'background-color: #6bcf7f',
                'rejected': 'background-color: #ff6b6b',
                'executed': 'background-color: #4d96ff'
            }
            return colors.get(val, '')
        
        styled_df = signals_df.style.applymap(highlight_status, subset=['状态'])
        st.dataframe(styled_df, use_container_width=True)
        
        # 统计
        st.divider()
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("总信号数", len(signals_df))
        col2.metric("已执行", len(signals_df[signals_df['状态'] == 'executed']))
        col3.metric("已确认", len(signals_df[signals_df['状态'] == 'confirmed']))
        col4.metric("已忽略", len(signals_df[signals_df['状态'] == 'rejected']))
    else:
        st.info("暂无信号数据")
except Exception as e:
    st.error(f"加载失败: {e}")
