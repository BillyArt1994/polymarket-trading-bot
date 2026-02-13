import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

st.set_page_config(page_title="数据分析", page_icon="📉", layout="wide")

st.title("📉 数据分析")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 时间范围选择
period = st.selectbox("时间范围", ["最近7天", "最近30天", "全部"])
days = {"最近7天": 7, "最近30天": 30, "全部": 365}[period]
start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

# 关键指标
try:
    # 总盈亏
    pnl_query = f"""
        SELECT 
            COALESCE(SUM(pnl), 0) as 总盈亏,
            COUNT(*) as 总交易数,
            AVG(pnl) as 平均盈亏,
            MAX(pnl) as 最大盈利,
            MIN(pnl) as 最大亏损
        FROM trades
        WHERE DATE(created_at) >= '{start_date}' AND status = 'settled'
    """
    pnl_df = pd.read_sql_query(pnl_query, conn)
    
    col1, col2, col3, col4 = st.columns(4)
    
    total_pnl = pnl_df['总盈亏'].iloc[0] or 0
    col1.metric("💰 总盈亏", f"${total_pnl:+.2f}", 
                f"{total_pnl/10:.2f}%" if total_pnl != 0 else None)
    
    col2.metric("📊 总交易数", int(pnl_df['总交易数'].iloc[0] or 0))
    col3.metric("📈 平均盈亏", f"${pnl_df['平均盈亏'].iloc[0] or 0:+.2f}")
    
    # 胜率
    win_query = f"""
        SELECT 
            COUNT(CASE WHEN pnl > 0 THEN 1 END) as 盈利次数,
            COUNT(CASE WHEN pnl < 0 THEN 1 END) as 亏损次数,
            COUNT(*) as 总次数
        FROM trades
        WHERE DATE(created_at) >= '{start_date}' AND status = 'settled'
    """
    win_df = pd.read_sql_query(win_query, conn)
    
    if win_df['总次数'].iloc[0] > 0:
        win_rate = (win_df['盈利次数'].iloc[0] / win_df['总次数'].iloc[0]) * 100
        col4.metric("🎯 胜率", f"{win_rate:.1f}%", 
                    f"{win_df['盈利次数'].iloc[0]}胜 {win_df['亏损次数'].iloc[0]}负")
    else:
        col4.metric("🎯 胜率", "N/A")
        
except Exception as e:
    st.error(f"加载指标失败: {e}")

st.divider()

# 盈亏曲线
try:
    daily_pnl_query = f"""
        SELECT 
            DATE(created_at) as 日期,
            COALESCE(SUM(pnl), 0) as 日盈亏
        FROM trades
        WHERE DATE(created_at) >= '{start_date}' AND status = 'settled'
        GROUP BY DATE(created_at)
        ORDER BY 日期
    """
    daily_pnl_df = pd.read_sql_query(daily_pnl_query, conn)
    
    if not daily_pnl_df.empty:
        daily_pnl_df['累计盈亏'] = daily_pnl_df['日盈亏'].cumsum()
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=daily_pnl_df['日期'],
            y=daily_pnl_df['累计盈亏'],
            mode='lines+markers',
            name='累计盈亏',
            line=dict(color='#4d96ff', width=2),
            fill='tonexty'
        ))
        
        # 添加零线
        fig.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
        
        fig.update_layout(
            title="累计盈亏曲线",
            xaxis_title="日期",
            yaxis_title="盈亏 (USD)",
            hovermode='x unified',
            showlegend=False
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("暂无盈亏数据")
        
except Exception as e:
    st.error(f"加载盈亏曲线失败: {e}")

# 套利机会分析
st.subheader("🔍 套利机会分析")

try:
    opp_query = f"""
        SELECT 
            DATE(detected_at) as 日期,
            COUNT(*) as 机会数,
            AVG(deviation_percent) as 平均偏离度,
            MAX(deviation_percent) as 最大偏离度,
            SUM(CASE WHEN deviation_percent >= 3 THEN 1 ELSE 0 END) as 高价值机会
        FROM arbitrage_opportunities
        WHERE DATE(detected_at) >= '{start_date}'
        GROUP BY DATE(detected_at)
        ORDER BY 日期
    """
    opp_df = pd.read_sql_query(opp_query, conn)
    
    if not opp_df.empty:
        col1, col2 = st.columns(2)
        
        with col1:
            # 机会数量趋势
            fig = px.bar(
                opp_df,
                x='日期',
                y='机会数',
                title='每日套利机会数',
                color='平均偏离度',
                color_continuous_scale='RdYlGn',
                text='机会数'
            )
            fig.update_traces(textposition='outside')
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # 偏离度分布
            fig = px.line(
                opp_df,
                x='日期',
                y=['平均偏离度', '最大偏离度'],
                title='偏离度趋势',
                markers=True
            )
            st.plotly_chart(fig, use_container_width=True)
        
        # 统计数据
        st.write(f"**总套利机会**: {opp_df['机会数'].sum()} 次")
        st.write(f"**平均每日机会**: {opp_df['机会数'].mean():.1f} 次")
        st.write(f"**高价值机会** (偏离度>3%): {opp_df['高价值机会'].sum()} 次")
        st.write(f"**最高偏离度**: {opp_df['最大偏离度'].max():.2f}%")
    else:
        st.info("暂无套利机会数据")
        
except Exception as e:
    st.error(f"加载套利分析失败: {e}")

# 信号质量分析
st.subheader("📊 信号质量分析")

try:
    signal_query = f"""
        SELECT 
            level as 等级,
            status as 状态,
            COUNT(*) as 数量,
            AVG(confidence) as 平均置信度
        FROM signals
        WHERE DATE(created_at) >= '{start_date}'
        GROUP BY level, status
        ORDER BY level, status
    """
    signal_df = pd.read_sql_query(signal_query, conn)
    
    if not signal_df.empty:
        # 透视表
        pivot_df = signal_df.pivot_table(
            index='等级',
            columns='状态',
            values='数量',
            fill_value=0
        )
        
        st.write("**各等级信号分布**:")
        st.dataframe(pivot_df, use_container_width=True)
        
        # 执行率
        for level in signal_df['等级'].unique():
            level_data = signal_df[signal_df['等级'] == level]
            total = level_data['数量'].sum()
            executed = level_data[level_data['状态'] == 'executed']['数量'].sum()
            if total > 0:
                rate = (executed / total) * 100
                st.write(f"- {level}: 执行率 {rate:.1f}% ({executed}/{total})")
    else:
        st.info("暂无信号数据")
        
except Exception as e:
    st.error(f"加载信号质量分析失败: {e}")

# 最大回撤估算
st.subheader("⚠️ 风险指标")

try:
    # 简单回撤计算
    if not daily_pnl_df.empty and len(daily_pnl_df) > 1:
        cumulative = daily_pnl_df['累计盈亏'].values
        max_dd = 0
        peak = cumulative[0]
        
        for value in cumulative:
            if value > peak:
                peak = value
            dd = (peak - value) / (1000 + peak) * 100  # 基于初始资金计算百分比
            if dd > max_dd:
                max_dd = dd
        
        col1, col2 = st.columns(2)
        col1.metric("最大回撤", f"{max_dd:.2f}%")
        col2.metric("夏普比率 (估算)", "N/A")  # 需要更完整数据计算
        
except Exception as e:
    st.error(f"计算风险指标失败: {e}")

if st.button("🔄 刷新数据"):
    st.rerun()
