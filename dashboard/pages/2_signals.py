import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(page_title="交易信号", page_icon="🎯", layout="wide")

st.title("🎯 交易信号历史")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 筛选条件
st.sidebar.header("🔍 筛选")

with st.sidebar:
    status_filter = st.selectbox("状态", ["全部", "pending", "confirmed", "rejected", "executed", "expired"])
    level_filter = st.selectbox("信号等级", ["全部", "CONSERVATIVE", "AGGRESSIVE", "RISKY"])
    date_range = st.selectbox("时间范围", ["今天", "最近7天", "最近30天", "全部"])

# 计算日期范围
date_map = {
    "今天": 0,
    "最近7天": 7,
    "最近30天": 30,
    "全部": 365
}
days = date_map[date_range]
start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

# 统计卡片
try:
    stats_query = f"""
        SELECT 
            status,
            COUNT(*) as count,
            AVG(confidence) as avg_confidence
        FROM signals
        WHERE DATE(created_at) >= '{start_date}'
        GROUP BY status
    """
    stats_df = pd.read_sql_query(stats_query, conn)
    
    col1, col2, col3, col4, col5 = st.columns(5)
    
    status_counts = dict(zip(stats_df['status'], stats_df['count'])) if not stats_df.empty else {}
    
    col1.metric("⏳ 待确认", status_counts.get('pending', 0))
    col2.metric("✅ 已确认", status_counts.get('confirmed', 0))
    col3.metric("❌ 已拒绝", status_counts.get('rejected', 0))
    col4.metric("🚀 已执行", status_counts.get('executed', 0))
    col5.metric("⏰ 已过期", status_counts.get('expired', 0))
    
except Exception as e:
    st.error(f"统计失败: {e}")

st.divider()

# 信号列表
try:
    query = f"""
        SELECT 
            s.id,
            m.question as 事件,
            m.category as 分类,
            s.signal_type as 类型,
            ROUND(s.confidence * 100, 0) || '%' as 置信度,
            s.suggested_amount as 建议金额,
            s.reason as 原因,
            s.status as 状态,
            s.level as 等级,
            s.expiry_minutes as 有效期,
            s.created_at as 创建时间,
            s.confirmed_at as 确认时间,
            s.executed_at as 执行时间
        FROM signals s
        JOIN markets m ON s.market_id = m.id
        WHERE DATE(s.created_at) >= '{start_date}'
    """
    
    if status_filter != "全部":
        query += f" AND s.status = '{status_filter}'"
    if level_filter != "全部":
        query += f" AND s.level = '{level_filter}'"
    
    query += " ORDER BY s.created_at DESC"
    
    signals_df = pd.read_sql_query(query, conn)
    
    if not signals_df.empty:
        # 状态颜色映射
        def color_status(val):
            colors = {
                'pending': 'background-color: #fff3e0; color: #e65100; font-weight: bold',
                'confirmed': 'background-color: #e8f5e9; color: #2e7d32; font-weight: bold',
                'rejected': 'background-color: #ffebee; color: #c62828',
                'executed': 'background-color: #e3f2fd; color: #1565c0; font-weight: bold',
                'expired': 'background-color: #f5f5f5; color: #616161',
            }
            return colors.get(val, '')
        
        def color_level(val):
            colors = {
                'CONSERVATIVE': 'background-color: #e3f2fd; color: #1565c0',
                'AGGRESSIVE': 'background-color: #fff3e0; color: #ef6c00',
                'RISKY': 'background-color: #ffebee; color: #c62828; font-weight: bold',
            }
            return colors.get(val, '')
        
        styled_df = signals_df.style\
            .applymap(color_status, subset=['状态'])\
            .applymap(color_level, subset=['等级'])
        
        st.dataframe(
            styled_df,
            use_container_width=True,
            height=500,
            column_config={
                '事件': st.column_config.TextColumn(width='large'),
                '建议金额': st.column_config.NumberColumn(format="$%d"),
            }
        )
        
        # 信号详情
        st.divider()
        st.subheader("📋 信号详情")
        
        selected_id = st.selectbox(
            "选择信号ID查看详情",
            signals_df['id'].tolist()
        )
        
        if selected_id:
            signal = signals_df[signals_df['id'] == selected_id].iloc[0]
            
            with st.container():
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.write(f"**事件**: {signal['事件']}")
                    st.write(f"**类型**: {signal['类型']}")
                    st.write(f"**分类**: {signal['分类']}")
                
                with col2:
                    st.write(f"**置信度**: {signal['置信度']}")
                    st.write(f"**建议金额**: ${signal['建议金额']}")
                    st.write(f"**有效期**: {signal['有效期']}分钟")
                
                with col3:
                    st.write(f"**状态**: {signal['状态']}")
                    st.write(f"**等级**: {signal['等级']}")
                    st.write(f"**创建时间**: {signal['创建时间']}")
                
                st.write(f"**原因**: {signal['原因']}")
                
                # 操作按钮（仅对pending信号）
                if signal['状态'] == 'pending':
                    st.warning("⏳ 此信号待确认")
                    col1, col2 = st.columns(2)
                    with col1:
                        if st.button(f"✅ 确认执行 #{selected_id}"):
                            st.success(f"信号 #{selected_id} 已确认！请在 Telegram 或 MetaMask 中执行")
                    with col2:
                        if st.button(f"❌ 忽略 #{selected_id}"):
                            st.info(f"信号 #{selected_id} 已忽略")
    else:
        st.info("暂无符合条件的信号")
        
except Exception as e:
    st.error(f"加载信号失败: {e}")

# 信号统计图表
st.divider()
st.subheader("📊 信号统计")

try:
    # 每日信号数
    daily_query = f"""
        SELECT 
            DATE(created_at) as 日期,
            COUNT(*) as 信号数,
            SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as 执行数
        FROM signals
        WHERE DATE(created_at) >= '{start_date}'
        GROUP BY DATE(created_at)
        ORDER BY 日期
    """
    daily_df = pd.read_sql_query(daily_query, conn)
    
    if not daily_df.empty:
        import plotly.graph_objects as go
        
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=daily_df['日期'],
            y=daily_df['信号数'],
            name='总信号数',
            marker_color='#4d96ff'
        ))
        fig.add_trace(go.Bar(
            x=daily_df['日期'],
            y=daily_df['执行数'],
            name='已执行',
            marker_color='#6bcf7f'
        ))
        fig.update_layout(
            barmode='group',
            title='每日信号统计',
            xaxis_title='日期',
            yaxis_title='数量'
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("暂无统计数据")
        
except Exception as e:
    st.error(f"统计图表失败: {e}")

if st.button("🔄 刷新"):
    st.rerun()
