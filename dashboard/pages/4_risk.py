import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(page_title="风控状态", page_icon="⚠️", layout="wide")

st.title("⚠️ 风控状态监控")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 配置参数
TOTAL_CAPITAL = 1000
MAX_DAILY_LOSS = 0.05  # 5%
MAX_SINGLE_TRADE = 0.20  # 20%
MAX_DAILY_TRADES = 3

# 当前风控状态
st.subheader("📊 当前风控状态")

col1, col2, col3 = st.columns(3)

try:
    today = datetime.now().strftime("%Y-%m-%d")
    
    # 日亏损检查
    loss_query = f"""
        SELECT COALESCE(SUM(pnl), 0) as total_pnl
        FROM trades
        WHERE DATE(created_at) = '{today}'
    """
    loss_df = pd.read_sql_query(loss_query, conn)
    current_pnl = loss_df['total_pnl'].iloc[0] or 0
    current_loss = abs(min(0, current_pnl))
    daily_loss_limit = TOTAL_CAPITAL * MAX_DAILY_LOSS
    daily_loss_pct = (current_loss / daily_loss_limit) * 100
    
    with col1:
        st.metric(
            "日亏损限额",
            f"${current_loss:.2f} / ${daily_loss_limit:.2f}",
            f"{daily_loss_pct:.1f}%"
        )
        
        if daily_loss_pct >= 100:
            st.error("🚨 **已触发熔断！** 今日暂停新交易")
        elif daily_loss_pct >= 80:
            st.warning("⚠️ **接近限额**，谨慎操作")
        else:
            st.success("✅ 安全范围内")
        
        # 进度条
        st.progress(min(daily_loss_pct / 100, 1.0), 
                   text=f"已使用 {daily_loss_pct:.1f}%")
    
    # 交易次数检查
    trades_query = f"""
        SELECT COUNT(*) as count
        FROM signals
        WHERE DATE(created_at) = '{today}' AND status IN ('confirmed', 'executed')
    """
    trades_df = pd.read_sql_query(trades_query, conn)
    current_trades = trades_df['count'].iloc[0] or 0
    trades_pct = (current_trades / MAX_DAILY_TRADES) * 100
    
    with col2:
        st.metric(
            "日交易次数",
            f"{current_trades} / {MAX_DAILY_TRADES}",
            f"剩余 {MAX_DAILY_TRADES - current_trades} 次"
        )
        
        if current_trades >= MAX_DAILY_TRADES:
            st.error("🚫 **次数已满**，今日暂停新交易")
        elif current_trades >= 2:
            st.warning("⚠️ **接近上限**，请谨慎")
        else:
            st.success("✅ 充足")
        
        st.progress(trades_pct / 100, text=f"已使用 {trades_pct:.1f}%")
    
    # 单笔限额
    with col3:
        single_limit = TOTAL_CAPITAL * MAX_SINGLE_TRADE
        st.metric("单笔限额", f"${single_limit:.2f}", "20% 资金")
        st.info(f"💡 建议单笔不超过 **${single_limit:.2f}**")
        
        # 当前敞口
        exposure_query = f"""
            SELECT COALESCE(SUM(amount), 0) as exposure
            FROM trades
            WHERE DATE(created_at) = '{today}' AND status IN ('pending', 'confirmed')
        """
        exposure_df = pd.read_sql_query(exposure_query, conn)
        current_exposure = exposure_df['exposure'].iloc[0] or 0
        st.metric("当前敞口", f"${current_exposure:.2f}")
        
except Exception as e:
    st.error(f"加载风控数据失败: {e}")

st.divider()

# 风控日志
st.subheader("📝 风控日志")

try:
    logs_query = """
        SELECT 
            created_at as 时间,
            log_type as 类型,
            message as 消息,
            current_exposure as 当前暴露,
            limit_value as 限制值
        FROM risk_logs
        ORDER BY created_at DESC
        LIMIT 20
    """
    logs_df = pd.read_sql_query(logs_query, conn)
    
    if not logs_df.empty:
        def color_type(val):
            if val == 'limit_warning':
                return 'background-color: #ffebee; color: #c62828; font-weight: bold'
            elif val == 'trade_blocked':
                return 'background-color: #fff3e0; color: #e65100'
            return ''
        
        styled_df = logs_df.style.applymap(color_type, subset=['类型'])
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
    else:
        st.info("暂无风控日志，系统运行正常")
        
except Exception as e:
    st.error(f"加载日志失败: {e}")

# 今日交易记录
st.divider()
st.subheader("📋 今日交易记录")

try:
    today_trades_query = f"""
        SELECT 
            t.id,
            m.question as 事件,
            t.side as 方向,
            t.amount as 金额,
            t.price as 价格,
            t.pnl as 盈亏,
            t.status as 状态,
            t.created_at as 时间
        FROM trades t
        JOIN markets m ON t.market_id = m.id
        WHERE DATE(t.created_at) = '{today}'
        ORDER BY t.created_at DESC
    """
    trades_df = pd.read_sql_query(today_trades_query, conn)
    
    if not trades_df.empty:
        def color_pnl(val):
            if pd.isna(val):
                return ''
            val = float(val)
            if val > 0:
                return 'color: #2e7d32; font-weight: bold'
            elif val < 0:
                return 'color: #c62828; font-weight: bold'
            return ''
        
        styled_df = trades_df.style.applymap(color_pnl, subset=['盈亏'])
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
        
        # 盈亏汇总
        total_pnl = trades_df['盈亏'].sum()
        st.metric("今日总盈亏", f"${total_pnl:+.2f}")
    else:
        st.info("今日暂无交易")
        
except Exception as e:
    st.error(f"加载交易记录失败: {e}")

# 风控规则说明
st.divider()
st.subheader("📖 风控规则说明")

with st.expander("查看详细规则"):
    st.markdown("""
    ### 风控规则配置
    
    | 规则 | 阈值 | 说明 |
    |------|------|------|
    | **日亏损限额** | 5% ($50) | 单日累计亏损达到50元时，暂停当日新交易 |
    | **单笔限额** | 20% ($200) | 单笔交易金额不超过200元 |
    | **日交易次数** | 3次 | 每日最多执行3笔交易 |
    | **最小套利空间** | 1.5% | 偏离度低于1.5%时不触发信号 |
    
    ### 信号分级处理
    
    | 偏离度 | 等级 | 有效期 | 说明 |
    |--------|------|--------|------|
    | 1.5% - 3% | 保守 | 3分钟 | 收益空间有限，需确认gas费 |
    | 3% - 5% | 激进 | 5分钟 | 合理套利空间，正常执行 |
    | >5% | 高风险 | 10分钟 | 可能存在隐藏风险，谨慎评估 |
    
    ### 止盈策略
    
    - **50%回归**：偏离度恢复50%时，考虑减仓
    - **完全回归**：偏离度<0.5%时，全部平仓
    - **时间限制**：持仓超过24小时，重新评估
    """)

if st.button("🔄 刷新状态"):
    st.rerun()
