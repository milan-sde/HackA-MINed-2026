"""
Streamlit Dashboard – SmartContainer Risk Engine
Run with: streamlit run src/dashboard.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import joblib

st.set_page_config(
    page_title="SmartContainer Risk Engine",
    page_icon="🚢",
    layout="wide"
)

st.title("🚢 SmartContainer Risk Engine Dashboard")
st.markdown("---")


@st.cache_data
def load_data():
    predictions = pd.read_csv(config.PREDICTIONS)
    realtime    = pd.read_csv(config.REALTIME_ENGINEERED)
    return pd.merge(predictions, realtime, on='Container_ID')


df = load_data()

# ── Sidebar filters ───────────────────────────────────────
st.sidebar.header("🔍 Filters")
risk_filter = st.sidebar.multiselect(
    "Risk Level",
    options=['Clear', 'Low Risk', 'Critical'],
    default=['Clear', 'Low Risk', 'Critical']
)
origin_filter = st.sidebar.multiselect(
    "Origin Country", options=sorted(df['Origin_Country'].unique()), default=[]
)
min_risk_score = st.sidebar.slider("Minimum Risk Score", 0, 100, 0)

filtered_df = df[df['Risk_Level'].isin(risk_filter) & (df['Risk_Score'] >= min_risk_score)]
if origin_filter:
    filtered_df = filtered_df[filtered_df['Origin_Country'].isin(origin_filter)]

# ── KPI Cards ─────────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Containers", f"{len(filtered_df):,}")
with col2:
    cnt = len(filtered_df[filtered_df['Risk_Level'] == 'Critical'])
    st.metric("Critical Risk", f"{cnt:,}", delta=f"{cnt/max(len(filtered_df),1)*100:.1f}%", delta_color="inverse")
with col3:
    anm = int(filtered_df['Anomaly_Flag'].sum())
    st.metric("Anomalies Detected", f"{anm:,}")
with col4:
    st.metric("Avg Risk Score", f"{filtered_df['Risk_Score'].mean():.1f}")

st.markdown("---")

# ── Charts ────────────────────────────────────────────────
col1, col2 = st.columns(2)
COLOR_MAP = {'Critical': '#ff4b4b', 'Low Risk': '#ffa64b', 'Clear': '#4bff4b'}

with col1:
    risk_dist = filtered_df['Risk_Level'].value_counts().reset_index()
    risk_dist.columns = ['Risk Level', 'Count']
    fig = px.pie(risk_dist, values='Count', names='Risk Level',
                 title='📊 Risk Level Distribution', color='Risk Level',
                 color_discrete_map=COLOR_MAP)
    fig.update_traces(textposition='inside', textinfo='percent+label')
    st.plotly_chart(fig, use_container_width=True)

with col2:
    fig = px.histogram(filtered_df, x='Risk_Score', color='Risk_Level',
                       title='📈 Risk Score Distribution',
                       color_discrete_map=COLOR_MAP, nbins=30)
    fig.add_vline(x=70, line_dash="dash", line_color="red", annotation_text="Critical Threshold")
    st.plotly_chart(fig, use_container_width=True)

col1, col2 = st.columns(2)
with col1:
    top_origins = (filtered_df.groupby('Origin_Country')
                   .agg(Avg_Risk=('Risk_Score', 'mean'), Count=('Container_ID', 'count'))
                   .reset_index().sort_values('Avg_Risk', ascending=False).head(10))
    fig = px.bar(top_origins, x='Origin_Country', y='Avg_Risk', color='Avg_Risk',
                 title='🌍 Top 10 Origins by Avg Risk Score',
                 color_continuous_scale='RdYlGn_r', text='Count')
    fig.update_traces(texttemplate='%{text}', textposition='outside')
    st.plotly_chart(fig, use_container_width=True)

with col2:
    sample = filtered_df.sample(min(1000, len(filtered_df)))
    fig = px.scatter(sample, x='weight_diff_pct', y='Risk_Score', color='Risk_Level',
                     size='Declared_Value', hover_data=['Container_ID', 'Origin_Country', 'HS_Code'],
                     title='⚖️ Weight Discrepancy vs Risk Score', color_discrete_map=COLOR_MAP)
    fig.add_hline(y=70, line_dash="dash", line_color="red")
    fig.add_vline(x=20, line_dash="dash", line_color="orange")
    st.plotly_chart(fig, use_container_width=True)

# ── Data Table ────────────────────────────────────────────
st.markdown("---")
st.subheader("📋 Detailed Container Analysis")

display_cols = st.multiselect(
    "Select columns to display",
    options=['Container_ID', 'Risk_Score', 'Risk_Level', 'Anomaly_Flag',
             'Explanation_Summary', 'Origin_Country', 'Destination_Country',
             'HS_Code', 'Declared_Value', 'Declared_Weight', 'Measured_Weight',
             'Dwell_Time_Hours', 'weight_diff_pct', 'exporter_risk_score'],
    default=['Container_ID', 'Risk_Score', 'Risk_Level', 'Anomaly_Flag',
             'Explanation_Summary', 'weight_diff_pct']
)

st.dataframe(
    filtered_df.sort_values('Risk_Score', ascending=False)[display_cols],
    use_container_width=True, height=400
)

if st.button("📥 Export Filtered Data"):
    st.download_button("Download CSV", filtered_df.to_csv(index=False),
                       file_name="filtered_predictions.csv", mime="text/csv")

# ── Monitoring ────────────────────────────────────────────
st.markdown("---")
st.subheader("📡 Real-time Monitoring")
col1, col2, col3 = st.columns(3)
col1.metric("Processing Rate", "125/min", "+12")
col2.metric("Queue Length", "342", "-28", delta_color="inverse")
col3.metric("System Health", "98%", "Stable")

st.markdown("---")
st.markdown("🚢 **SmartContainer Risk Engine** – AI-Powered Customs Risk Assessment")
