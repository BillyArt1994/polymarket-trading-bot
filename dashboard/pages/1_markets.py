import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(page_title="市场监控", page_icon="📈")

st.title("📈 市场监控")

conn = sqlite3.connect('../data/trading_bot.db', check_same_thread=False)

# 筛选条件
col1, col2 = st.columns(2)
with col1:
    category = st.selectbox("分类筛选", ["全部", "政治", "体育", "加密货币", "其他"])
with col2:
    min_volume = st.slider("最小24h交易量", 0, 1000000, 10000, step=10000)

# 市场列表
try:
    query = """
        SELECT 
            m.question as 事件,
            m.category as 分类,
            p.yes_price as Yes价格,
            p.no_price as No价格,
            (p.yes_price + p.no_price) as 价格总和,
            ROUND((1 - (p.yes_price + p.no_price)) * 100, 2) as 偏离度,
            p.yes_liquidity as Yes流动性,
            p.no_liquidity as No流动性,
            p.volume_24h as 交易量,
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
    
    markets_df = pd.read_sql_query(query, conn)
    
    if not markets_df.empty:
        # 筛选
        if category != "全部":
            markets_df = markets_df[markets_df['分类'] == category]
        markets_df = markets_df[markets_df['交易量'] >= min_volume]
        
        # 排序：偏离度高的在前
        markets_df = markets_df.sort_values('偏离度', ascending=False)
        
        # 高亮偏离度
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
        st.dataframe(styled_df, use_container_width=True, height=600)
        
        st.caption(f"共 {len(markets_df)} 个市场")
    else:
        st.info("暂无市场数据")
except Exception as e:
    st.error(f"加载失败: {e}")
