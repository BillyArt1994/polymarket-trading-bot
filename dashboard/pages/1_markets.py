import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="市场监控", page_icon="📈", layout="wide")

st.title("📈 市场监控")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 筛选条件
st.sidebar.header("🔍 筛选条件")

with st.sidebar:
    # 分类筛选
    try:
        categories = pd.read_sql_query(
            "SELECT DISTINCT category FROM markets WHERE category IS NOT NULL", conn
        )['category'].tolist()
        categories = ['全部'] + categories
    except:
        categories = ['全部']
    
    category = st.selectbox("分类", categories)
    
    # 偏离度筛选
    min_deviation = st.slider("最小偏离度 (%)", 0.0, 10.0, 0.0, 0.1)
    
    # 交易量筛选
    min_volume = st.number_input("最小24h交易量", 0, 10000000, 0, step=10000)
    
    # 排序方式
    sort_by = st.selectbox("排序方式", [
        "偏离度 ↓", "交易量 ↓", "流动性 ↓", "最新更新"
    ])

# 市场数据查询
@st.cache_data(ttl=60)
def load_markets(category, min_deviation, min_volume, sort_by):
    query = """
        SELECT 
            m.id,
            m.question as 事件,
            m.category as 分类,
            ROUND(p.yes_price, 4) as Yes价格,
            ROUND(p.no_price, 4) as No价格,
            ROUND(p.yes_price + p.no_price, 4) as 价格总和,
            ROUND((1 - (p.yes_price + p.no_price)) * 100, 2) as 偏离度,
            p.yes_liquidity as Yes流动性,
            p.no_liquidity as No流动性,
            ROUND(p.volume_24h, 0) as 交易量,
            p.timestamp as 更新时间,
            m.resolution_time as 结算时间
        FROM markets m
        LEFT JOIN (
            SELECT market_id, yes_price, no_price, yes_liquidity, no_liquidity, volume_24h, timestamp
            FROM price_snapshots
            WHERE (market_id, timestamp) IN (
                SELECT market_id, MAX(timestamp)
                FROM price_snapshots
                GROUP BY market_id
            )
        ) p ON m.id = p.market_id
        WHERE m.active = 1 AND m.resolved = 0
    """
    
    conditions = []
    if category != "全部":
        conditions.append(f"m.category = '{category}'")
    if min_deviation > 0:
        conditions.append(f"(1 - (p.yes_price + p.no_price)) * 100 >= {min_deviation}")
    if min_volume > 0:
        conditions.append(f"p.volume_24h >= {min_volume}")
    
    if conditions:
        query += " AND " + " AND ".join(conditions)
    
    # 排序
    sort_map = {
        "偏离度 ↓": "偏离度 DESC",
        "交易量 ↓": "交易量 DESC",
        "流动性 ↓": "(Yes流动性 + No流动性) DESC",
        "最新更新": "更新时间 DESC"
    }
    query += f" ORDER BY {sort_map.get(sort_by, '偏离度 DESC')}"
    
    return pd.read_sql_query(query, conn)

markets_df = load_markets(category, min_deviation, min_volume, sort_by)

# 统计信息
col1, col2, col3, col4 = st.columns(4)
col1.metric("📊 市场总数", len(markets_df))

if not markets_df.empty:
    col2.metric("💰 平均偏离度", f"{markets_df['偏离度'].mean():.2f}%")
    col3.metric("📈 最大偏离度", f"{markets_df['偏离度'].max():.2f}%")
    col4.metric("🔥 高偏离度市场", len(markets_df[markets_df['偏离度'] > 1.5]))
else:
    col2.metric("💰 平均偏离度", "N/A")
    col3.metric("📈 最大偏离度", "N/A")
    col4.metric("🔥 高偏离度市场", 0)

st.divider()

# 显示市场表格
if not markets_df.empty:
    # 高亮偏离度
    def highlight_deviation(val):
        if pd.isna(val):
            return ''
        val = float(val)
        if val >= 5:
            return 'background-color: #ff6b6b; color: white; font-weight: bold'
        elif val >= 3:
            return 'background-color: #ff9800; color: white; font-weight: bold'
        elif val >= 1.5:
            return 'background-color: #ffd93d; font-weight: bold'
        elif val >= 1:
            return 'background-color: #ffeb3b'
        return ''
    
    # 选择显示的列
    display_cols = ['事件', '分类', 'Yes价格', 'No价格', '价格总和', '偏离度', '交易量', '更新时间']
    display_df = markets_df[display_cols].copy()
    
    styled_df = display_df.style.applymap(highlight_deviation, subset=['偏离度'])
    
    st.dataframe(
        styled_df,
        use_container_width=True,
        height=600,
        column_config={
            '事件': st.column_config.TextColumn(width='large'),
            '偏离度': st.column_config.NumberColumn(format="%.2f%%"),
            '交易量': st.column_config.NumberColumn(format="$%d"),
        }
    )
    
    # 详细分析（选中市场）
    st.divider()
    st.subheader("🔍 市场详情分析")
    
    selected_market = st.selectbox(
        "选择市场查看详情",
        markets_df['事件'].tolist(),
        index=0 if len(markets_df) > 0 else None
    )
    
    if selected_market:
        market_data = markets_df[markets_df['事件'] == selected_market].iloc[0]
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Yes 价格", f"${market_data['Yes价格']:.4f}")
            st.metric("Yes 流动性", f"${market_data['Yes流动性']:,.0f}" if pd.notna(market_data['Yes流动性']) else "N/A")
        
        with col2:
            st.metric("No 价格", f"${market_data['No价格']:.4f}")
            st.metric("No 流动性", f"${market_data['No流动性']:,.0f}" if pd.notna(market_data['No流动性']) else "N/A")
        
        with col3:
            st.metric("价格总和", f"${market_data['价格总和']:.4f}")
            st.metric("偏离度", f"{market_data['偏离度']:.2f}%")
        
        # 套利分析
        deviation = market_data['偏离度']
        if deviation >= 1.5:
            st.success(f"🎯 **套利机会 detected!** 偏离度 {deviation:.2f}% > 1.5% 阈值")
            
            if deviation >= 5:
                st.error("⚠️ **高风险信号**：偏离度超过5%，可能存在隐藏风险")
            elif deviation >= 3:
                st.warning("⚡ **激进信号**：偏离度3-5%，合理套利空间")
            else:
                st.info("💡 **保守信号**：偏离度1.5-3%，收益空间有限")
            
            # 建议操作
            yes_price = market_data['Yes价格']
            no_price = market_data['No价格']
            if yes_price < no_price:
                st.info(f"📈 **建议**：买入 Yes (价格更低: ${yes_price:.4f})")
            else:
                st.info(f"📉 **建议**：买入 No (价格更低: ${no_price:.4f})")
            
            # 预期收益估算
            estimated_return = (deviation / 100) - 0.005  # 扣除0.5%费用
            st.metric("估算收益", f"{estimated_return*100:.2f}%", f"基于 ${200} 投入 ≈ ${estimated_return*200:.2f}")
        else:
            st.info(f"⏸️ **无套利机会**：偏离度 {deviation:.2f}% < 1.5% 阈值")
            
else:
    st.info("暂无符合条件的市场数据")

# 底部刷新按钮
if st.button("🔄 刷新数据"):
    st.cache_data.clear()
    st.rerun()
