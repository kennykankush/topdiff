#!/usr/bin/env .venv/bin/python3
"""
TopDiff Analytics — AI API usage dashboard
Usage: .venv/bin/python3 analytics.py
Output: data/analytics_report.html (auto-opens in browser)
"""

import json, sys, webbrowser
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "analytics.ndjson"
OUTPUT_FILE = Path(__file__).parent / "data" / "analytics_report.html"

BG       = "#080C14"
BG_SIDE  = "#05080F"
BG_CARD  = "rgba(255,255,255,0.03)"
BORDER   = "rgba(255,255,255,0.07)"
GOLD     = "#C8AA6E"
GOLD_DIM = "rgba(200,170,110,0.35)"
TEXT     = "#F0E6D3"
TEXT2    = "rgba(255,255,255,0.38)"
TEXT3    = "rgba(255,255,255,0.18)"
GREEN    = "#4ade80"
RED      = "#E84057"
TEAL     = "#0BC4E3"

CHART_COLORS = ["#C8AA6E","#0BC4E3","#E84057","#4ade80","#a78bfa","#fb923c","#38bdf8","#f472b6"]

def load_data():
    if not DATA_FILE.exists():
        print(f"No data file at {DATA_FILE} — run the app first.")
        sys.exit(1)
    calls, feedback = [], []
    with open(DATA_FILE) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                r = json.loads(line)
                if r.get("type") == "accuracy_feedback":
                    feedback.append(r)
                else:
                    meta = r.pop("meta", {}) or {}
                    for k in ["detectedCount","scene","myChampion","myRole","enemyLaner"]:
                        r[f"meta_{k}"] = meta.get(k)
                    r["meta_roleDedupeApplied"] = meta.get("roleDedupeApplied", False)
                    calls.append(r)
            except: pass
    if not calls:
        print("No call records yet.")
        sys.exit(1)
    return calls, feedback

def build_report(calls, feedback):
    try:
        import pandas as pd
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots
    except ImportError:
        print("Run: .venv/bin/pip install pandas plotly"); sys.exit(1)

    df = pd.DataFrame(calls)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    df["totalTokens"] = df["inputTokens"] + df["outputTokens"]

    # Merge accuracy feedback
    has_fb = len(feedback) > 0
    if has_fb:
        fb = pd.DataFrame(feedback)
        df["ts_str"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S.%f").str[:-3] + "Z"
        df = df.merge(fb[["refTimestamp","correctCount","totalDetected","accuracyPct"]],
                      left_on="ts_str", right_on="refTimestamp", how="left")
        df["userAccuracy"] = df["accuracyPct"]
    else:
        df["userAccuracy"] = None

    models = sorted(df["model"].unique())
    model_color = {m: CHART_COLORS[i % len(CHART_COLORS)] for i, m in enumerate(models)}

    # ── Aggregate stats ───────────────────────────────────────────────────────
    agg = df.groupby("model").agg(
        total_calls=("costUsd","count"),
        successes=("success","sum"),
        total_cost=("costUsd","sum"),
        avg_latency=("latencyMs","mean"),
        p95_latency=("latencyMs", lambda x: x.quantile(0.95)),
        avg_input=("inputTokens","mean"),
        avg_output=("outputTokens","mean"),
    ).reset_index()
    agg["success_rate"]     = agg["successes"] / agg["total_calls"] * 100
    agg["avg_cost"]         = agg["total_cost"] / agg["total_calls"]
    agg["cost_per_success"] = agg.apply(lambda r: r["total_cost"]/r["successes"] if r["successes"]>0 else None, axis=1)

    if has_fb and df["userAccuracy"].notna().any():
        acc = df.groupby("model")["userAccuracy"].mean().reset_index()
        acc.columns = ["model","avg_accuracy"]
        agg = agg.merge(acc, on="model", how="left")
        agg["value_score"] = agg.apply(
            lambda r: (r["avg_accuracy"]/100 * r["success_rate"]/100)/r["avg_cost"]*1000
            if r["avg_cost"]>0 and pd.notna(r.get("avg_accuracy")) else None, axis=1)
    else:
        agg["avg_accuracy"] = None
        agg["value_score"] = agg.apply(
            lambda r: (r["success_rate"]/100)/r["avg_cost"]*1000 if r["avg_cost"]>0 else None, axis=1)

    phase_stats = df.groupby("phase").agg(calls=("costUsd","count"), avg_cost=("costUsd","mean"), total_cost=("costUsd","sum")).reset_index()

    if "sessionId" in df.columns:
        sess = df.groupby("sessionId").agg(calls=("costUsd","count"), cost=("costUsd","sum"))
        total_sessions      = len(sess)
        avg_calls_per_sess  = sess["calls"].mean()
        avg_cost_per_sess   = sess["cost"].mean()
    else:
        total_sessions = avg_calls_per_sess = avg_cost_per_sess = None

    ad_df      = df[df["phase"] == "Auto-Detect"]
    dedup_rate = ad_df["meta_roleDedupeApplied"].mean()*100 if not ad_df.empty else 0

    total_calls  = len(df)
    total_spend  = df["costUsd"].sum()
    success_rate = df["success"].mean()*100
    best_model   = agg.loc[agg["value_score"].idxmax(),"model"] if agg["value_score"].notna().any() else "N/A"

    prompt_ver   = df["promptVersion"].iloc[-1] if "promptVersion" in df.columns else "—"

    # ── Chart helpers ─────────────────────────────────────────────────────────
    def plot_cfg():
        return dict(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color=TEXT2, family="'SF Pro Display',-apple-system,sans-serif", size=11),
            margin=dict(t=32,b=24,l=12,r=12),
            legend=dict(bgcolor="rgba(0,0,0,0)", borderwidth=0, font=dict(size=10, color=TEXT2)),
        )

    AXIS_DEFAULTS = dict(gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(255,255,255,0.06)", tickcolor="rgba(0,0,0,0)")

    def fig_html(fig):
        return fig.to_html(full_html=False, include_plotlyjs=False, config={"displayModeBar":False})

    # ── Chart 1: Donut — phase split ──────────────────────────────────────────
    fig_donut = go.Figure(go.Pie(
        labels=phase_stats["phase"].tolist(),
        values=phase_stats["total_cost"].tolist(),
        hole=0.72,
        marker=dict(colors=[GOLD, TEAL], line=dict(color=BG, width=2)),
        textinfo="none",
        hovertemplate="<b>%{label}</b><br>$%{value:.5f}<extra></extra>",
    ))
    fig_donut.update_layout(**plot_cfg(), height=140, showlegend=False)
    fig_donut.update_layout(margin=dict(t=4,b=4,l=4,r=4))

    # ── Chart 2: Daily cost stacked bar ───────────────────────────────────────
    fig_daily = go.Figure()
    if df["date"].nunique() > 0:
        for model in models:
            sub = df[df["model"]==model].groupby("date")["costUsd"].sum().reset_index()
            fig_daily.add_trace(go.Bar(
                x=sub["date"], y=sub["costUsd"], name=model,
                marker_color=model_color[model],
                hovertemplate=f"<b>{model}</b><br>%{{x}}<br>${{y:.5f}}<extra></extra>",
            ))
    fig_daily.update_layout(**plot_cfg(), barmode="stack", height=220,
        yaxis=dict(tickprefix="$", gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(0,0,0,0)"),
        xaxis=dict(gridcolor="rgba(0,0,0,0)", linecolor="rgba(255,255,255,0.06)"),
    )

    # ── Chart 3: Cost/call vs Cost/success grouped bar ────────────────────────
    fig_cost_bar = go.Figure()
    for key, label, op in [("avg_cost","Avg Cost / Call",1.0),("cost_per_success","Cost / Successful Call",0.55)]:
        fig_cost_bar.add_trace(go.Bar(
            name=label, x=agg["model"], y=agg[key], opacity=op,
            marker_color=[model_color[m] for m in agg["model"]],
            text=[f"${v:.5f}" if pd.notna(v) else "—" for v in agg[key]],
            textposition="outside", textfont=dict(size=10),
            hovertemplate=f"<b>%{{x}}</b><br>{label}<br>${{y:.5f}}<extra></extra>",
        ))
    fig_cost_bar.update_layout(**plot_cfg(), barmode="group", height=240,
        yaxis=dict(tickprefix="$", gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(0,0,0,0)"),
    )

    # ── Chart 4: Latency vs success scatter ───────────────────────────────────
    fig_scatter = go.Figure(go.Scatter(
        mode="markers+text",
        x=agg["avg_latency"], y=agg["success_rate"],
        text=agg["model"], textposition="top center",
        textfont=dict(size=10, color=TEXT2),
        marker=dict(
            size=agg["total_calls"].apply(lambda v: max(14, min(v*5, 44))),
            color=[model_color[m] for m in agg["model"]],
            line=dict(width=1, color="rgba(255,255,255,0.15)"),
        ),
        hovertemplate="<b>%{text}</b><br>Latency: %{x:.0f}ms<br>Success: %{y:.1f}%<extra></extra>",
    ))
    fig_scatter.update_layout(**plot_cfg(), height=240,
        xaxis=dict(title="Avg Latency (ms)", gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(0,0,0,0)"),
        yaxis=dict(title="Success Rate (%)", ticksuffix="%", gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(0,0,0,0)"),
    )

    # ── Chart 5: Phase breakdown ───────────────────────────────────────────────
    fig_phase = make_subplots(rows=1, cols=2, subplot_titles=["Total Spend", "Success Rate"],
                               horizontal_spacing=0.1)
    for phase in sorted(df["phase"].unique()):
        sub = df[df["phase"]==phase].groupby("model").agg(cost=("costUsd","sum"), sr=("success",lambda x: x.mean()*100)).reset_index()
        color = GOLD if phase=="Auto-Detect" else TEAL
        fig_phase.add_trace(go.Bar(name=phase, x=sub["model"], y=sub["cost"], marker_color=color,
            hovertemplate=f"<b>%{{x}}</b><br>{phase}<br>${{y:.5f}}<extra></extra>"), row=1, col=1)
        fig_phase.add_trace(go.Bar(name=phase, x=sub["model"], y=sub["sr"], marker_color=color,
            showlegend=False, hovertemplate=f"<b>%{{x}}</b><br>{phase}<br>%{{y:.1f}}%<extra></extra>"), row=1, col=2)
    fig_phase.update_layout(**plot_cfg(), barmode="group", height=220)
    fig_phase.update_xaxes(**AXIS_DEFAULTS)
    fig_phase.update_yaxes(**AXIS_DEFAULTS)
    fig_phase.update_yaxes(tickprefix="$", row=1, col=1)
    fig_phase.update_yaxes(ticksuffix="%", row=1, col=2)

    # ── Chart 6: Detection quality ────────────────────────────────────────────
    fig_detect = make_subplots(rows=1, cols=2 if (has_fb and df["userAccuracy"].notna().any()) else 1,
                                subplot_titles=["Avg Picks Detected (of 5)"] + (["User-Verified Accuracy"] if has_fb and df["userAccuracy"].notna().any() else []))
    ad = df[df["phase"]=="Auto-Detect"]
    if not ad.empty:
        adm = ad.groupby("model")["meta_detectedCount"].mean().reset_index()
        fig_detect.add_trace(go.Bar(
            x=adm["model"], y=adm["meta_detectedCount"],
            text=[f"{v:.1f}/5" if pd.notna(v) else "—" for v in adm["meta_detectedCount"]],
            textposition="outside", marker_color=[model_color.get(m, GOLD) for m in adm["model"]],
            showlegend=False,
        ), row=1, col=1)
        fig_detect.update_yaxes(range=[0,5.8], row=1, col=1)
        if has_fb and df["userAccuracy"].notna().any():
            acc_ad = ad.groupby("model")["userAccuracy"].mean().reset_index()
            fig_detect.add_trace(go.Bar(
                x=acc_ad["model"], y=acc_ad["userAccuracy"],
                text=[f"{v:.1f}%" if pd.notna(v) else "—" for v in acc_ad["userAccuracy"]],
                textposition="outside", marker_color=[model_color.get(m, TEAL) for m in acc_ad["model"]],
                showlegend=False,
            ), row=1, col=2)
            fig_detect.update_yaxes(range=[0,110], ticksuffix="%", row=1, col=2)
    fig_detect.update_layout(**plot_cfg(), height=220)
    fig_detect.update_xaxes(**AXIS_DEFAULTS)
    fig_detect.update_yaxes(**AXIS_DEFAULTS)

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = []
    if len(agg) > 1:
        s = agg.dropna(subset=["cost_per_success"]).sort_values("cost_per_success")
        if len(s) >= 2:
            ratio = s.iloc[-1]["cost_per_success"] / s.iloc[0]["cost_per_success"]
            insights.append(f'<b>{s.iloc[0]["model"]}</b> is <b>{ratio:.1f}×</b> cheaper per successful call than <b>{s.iloc[-1]["model"]}</b>')
    if len(phase_stats)==2:
        ps = phase_stats.sort_values("avg_cost")
        if ps.iloc[0]["avg_cost"]>0:
            ratio = ps.iloc[-1]["avg_cost"]/ps.iloc[0]["avg_cost"]
            insights.append(f'<b>{ps.iloc[-1]["phase"]}</b> costs <b>{ratio:.1f}×</b> more per call than <b>{ps.iloc[0]["phase"]}</b>')
    if has_fb and agg["avg_accuracy"].notna().any():
        ba = agg.dropna(subset=["avg_accuracy"]).sort_values("avg_accuracy", ascending=False).iloc[0]
        insights.append(f'Best detection accuracy: <b>{ba["model"]}</b> at <b>{ba["avg_accuracy"]:.1f}%</b>')
    if dedup_rate > 0:
        insights.append(f'Role dedup triggered on <b>{dedup_rate:.1f}%</b> of Auto-Detect calls')

    insights_html = "".join(f'<div class="insight-item">→ {i}</div>' for i in insights) if insights else ""

    # ── Error table ───────────────────────────────────────────────────────────
    errors_df = df[df["success"]==False]
    if not errors_df.empty:
        err_rows = errors_df.groupby(["model","phase","error"]).size().reset_index(name="count").sort_values("count", ascending=False).head(15)
        err_table_rows = "".join(
            f'<tr><td>{r["model"]}</td><td><span class="phase-pill phase-{r["phase"].lower().replace(" ","-")}">{r["phase"]}</span></td>'
            f'<td class="err-msg">{str(r["error"])[:80]}</td><td class="count">{r["count"]}</td></tr>'
            for _, r in err_rows.iterrows()
        )
        errors_section = f"""
        <div class="section" id="errors">
          <div class="section-header"><span class="section-title">Errors</span></div>
          <div class="card">
            <table class="data-table">
              <thead><tr><th>Model</th><th>Phase</th><th>Error</th><th>Count</th></tr></thead>
              <tbody>{err_table_rows}</tbody>
            </table>
          </div>
        </div>"""
    else:
        errors_section = ""

    # ── Model table ───────────────────────────────────────────────────────────
    prompt_ver_map = df.groupby("model")["promptVersion"].last().to_dict() if "promptVersion" in df.columns else {}
    model_rows = ""
    for _, r in agg.iterrows():
        acc_cell = f'{r["avg_accuracy"]:.1f}%' if pd.notna(r.get("avg_accuracy")) else "—"
        vs_cell  = f'{r["value_score"]:.1f}' if pd.notna(r.get("value_score")) else "—"
        cps_cell = f'${r["cost_per_success"]:.5f}' if pd.notna(r["cost_per_success"]) else "—"
        color    = model_color.get(r["model"], GOLD)
        model_rows += f"""<tr>
          <td><span class="model-dot" style="background:{color}"></span>{r['model']}</td>
          <td>{prompt_ver_map.get(r['model'],'—')}</td>
          <td>{int(r['total_calls'])}</td>
          <td>{r['success_rate']:.1f}%</td>
          <td>${r['avg_cost']:.5f}</td>
          <td>{cps_cell}</td>
          <td>{r['avg_latency']:.0f}ms</td>
          <td>{r['p95_latency']:.0f}ms</td>
          <td>{acc_cell}</td>
          <td class="value-score">{vs_cell}</td>
        </tr>"""

    phase_card_html = ""
    for _, row in phase_stats.iterrows():
        phase_card_html += f"""
        <div class="hero-card">
          <div class="hero-label">Avg cost · {row['phase']}</div>
          <div class="hero-value">${row['avg_cost']:.4f}</div>
          <div class="hero-sub">{int(row['calls'])} calls · ${row['total_cost']:.4f} total</div>
        </div>"""

    sess_html = ""
    if total_sessions is not None:
        sess_html = f"""
        <div class="hero-card">
          <div class="hero-label">Sessions</div>
          <div class="hero-value">{total_sessions}</div>
          <div class="hero-sub">{avg_calls_per_sess:.1f} calls avg · ${avg_cost_per_sess:.4f} avg cost</div>
        </div>"""

    # ── Assemble ──────────────────────────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TopDiff Analytics</title>
<script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{
  --bg:       {BG};
  --bg-side:  {BG_SIDE};
  --bg-card:  {BG_CARD};
  --border:   {BORDER};
  --gold:     {GOLD};
  --gold-dim: {GOLD_DIM};
  --text:     {TEXT};
  --text2:    {TEXT2};
  --text3:    {TEXT3};
  --green:    {GREEN};
  --red:      {RED};
  --teal:     {TEAL};
}}
html {{ height: 100%; }}
body {{
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  display: flex;
  font-size: 13px;
  line-height: 1.5;
}}

/* ── Sidebar ── */
.sidebar {{
  width: 200px;
  flex-shrink: 0;
  background: var(--bg-side);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  padding: 0 0 24px;
  overflow-y: auto;
  z-index: 10;
}}
.sidebar-logo {{
  padding: 20px 18px 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}}
.nav-group {{ margin-bottom: 6px; }}
.nav-label {{
  padding: 6px 18px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text3);
}}
.nav-link {{
  display: block;
  padding: 6px 18px;
  font-size: 12px;
  color: var(--text2);
  text-decoration: none;
  border-radius: 0;
  transition: color 0.12s, background 0.12s;
  border-left: 2px solid transparent;
}}
.nav-link:hover {{ color: var(--text); background: rgba(255,255,255,0.04); }}
.nav-link.active {{ color: var(--gold); border-left-color: var(--gold); background: rgba(200,170,110,0.06); }}
.nav-divider {{ height: 1px; background: var(--border); margin: 10px 18px; }}

/* ── Main ── */
.main {{
  margin-left: 200px;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}}

/* ── Top bar ── */
.topbar {{
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 5;
}}
.topbar-title {{ font-size: 18px; font-weight: 700; color: var(--text); flex: 1; }}
.filter-pill {{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  letter-spacing: 0.02em;
}}
.filter-pill:hover {{ border-color: var(--gold-dim); color: var(--text); }}
.filter-pill option {{ background: #111; }}
.export-btn {{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--gold-dim);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gold);
  background: rgba(200,170,110,0.06);
  cursor: pointer;
  text-decoration: none;
}}
.export-btn:hover {{ background: rgba(200,170,110,0.12); }}

/* ── Content ── */
.content {{ padding: 24px 28px 56px; display: flex; flex-direction: column; gap: 28px; }}

/* ── Hero cards ── */
.hero-row {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}}
.hero-card {{
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}}
.hero-card.highlight {{ border-color: var(--gold-dim); background: rgba(200,170,110,0.04); }}
.hero-label {{ font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3); }}
.hero-value {{ font-size: 26px; font-weight: 700; color: var(--text); line-height: 1.1; }}
.hero-card.highlight .hero-value {{ color: var(--gold); font-size: 18px; }}
.hero-sub {{ font-size: 10px; color: var(--text3); margin-top: 2px; }}
.hero-card-split {{ display: flex; align-items: center; gap: 14px; }}
.hero-card-split .hero-donut {{ flex-shrink: 0; }}
.hero-card-split .hero-text {{ flex: 1; }}

/* ── Insights ── */
.insights-bar {{
  background: rgba(200,170,110,0.04);
  border: 1px solid rgba(200,170,110,0.12);
  border-radius: 8px;
  padding: 12px 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}}
.insight-item {{
  font-size: 11px;
  color: var(--text2);
  line-height: 1.5;
}}
.insight-item b {{ color: var(--gold); font-weight: 600; }}

/* ── Section ── */
.section {{ display: flex; flex-direction: column; gap: 14px; }}
.section-header {{
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}}
.section-title {{
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(200,170,110,0.55);
}}
.chart-row {{ display: grid; gap: 12px; }}
.chart-row.cols-2 {{ grid-template-columns: 1fr 1fr; }}

/* ── Card ── */
.card {{
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}}
.card-pad {{ padding: 16px 18px; }}
.card-title {{ font-size: 11px; font-weight: 600; color: var(--text3); letter-spacing: 0.06em; margin-bottom: 12px; text-transform: uppercase; }}

/* ── Table ── */
.data-table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
.data-table th {{
  padding: 9px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text3);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}}
.data-table td {{
  padding: 9px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: var(--text2);
  white-space: nowrap;
}}
.data-table tr:last-child td {{ border-bottom: none; }}
.data-table tr:hover td {{ background: rgba(255,255,255,0.02); }}
.model-dot {{ display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; vertical-align: middle; flex-shrink: 0; }}
.value-score {{ color: var(--gold); font-weight: 600; }}
.err-msg {{ color: var(--text3); max-width: 400px; overflow: hidden; text-overflow: ellipsis; }}
.count {{ color: var(--red); font-weight: 600; text-align: right; }}

/* ── Phase pills ── */
.phase-pill {{
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}}
.phase-auto-detect {{ background: rgba(200,170,110,0.12); color: var(--gold); }}
.phase-match-analysis {{ background: rgba(11,196,227,0.12); color: var(--teal); }}

/* ── Plotly overrides ── */
.js-plotly-plot .plotly {{ background: transparent !important; }}
</style>
</head>
<body>

<!-- Sidebar -->
<aside class="sidebar">
  <div class="sidebar-logo">TopDiff</div>
  <nav>
    <div class="nav-group">
      <div class="nav-label">Overview</div>
      <a class="nav-link active" href="#overview">Summary</a>
      <a class="nav-link" href="#daily">Daily Cost</a>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-group">
      <div class="nav-label">Models</div>
      <a class="nav-link" href="#comparison">Comparison</a>
      <a class="nav-link" href="#phases">By Phase</a>
      <a class="nav-link" href="#model-table">All Metrics</a>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-group">
      <div class="nav-label">Detection</div>
      <a class="nav-link" href="#detection">Quality</a>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-group">
      <div class="nav-label">Logs</div>
      <a class="nav-link" href="#errors">Errors</a>
    </div>
  </nav>
</aside>

<!-- Main -->
<div class="main">
  <!-- Top bar -->
  <div class="topbar">
    <div class="topbar-title">Cost &amp; Usage</div>
    <select class="filter-pill" id="phase-filter" onchange="filterPhase(this.value)">
      <option value="all">All Phases</option>
      <option value="Auto-Detect">Auto-Detect</option>
      <option value="Match Analysis">Match Analysis</option>
    </select>
    <select class="filter-pill" id="model-filter">
      <option value="all">All Models</option>
      {"".join(f'<option value="{m}">{m}</option>' for m in models)}
    </select>
    <span class="filter-pill">Prompt: {prompt_ver}</span>
    <a class="export-btn" href="../data/analytics.ndjson" download="analytics.ndjson">↓ Export</a>
  </div>

  <!-- Content -->
  <div class="content">

    <!-- Hero row -->
    <div id="overview">
      <div class="hero-row">
        <div class="hero-card-split hero-card" style="grid-column: span 2;">
          <div class="hero-donut">{fig_html(fig_donut)}</div>
          <div class="hero-text">
            <div class="hero-label">Total Spend</div>
            <div class="hero-value">${total_spend:.4f}</div>
            <div class="hero-sub">{total_calls} calls · {success_rate:.1f}% success</div>
          </div>
        </div>
        <div class="hero-card highlight">
          <div class="hero-label">Best Value Model</div>
          <div class="hero-value">{best_model}</div>
          <div class="hero-sub">by value score</div>
        </div>
        <div class="hero-card">
          <div class="hero-label">Overall Success Rate</div>
          <div class="hero-value">{success_rate:.1f}%</div>
          <div class="hero-sub">{int(df['success'].sum())} of {total_calls} calls</div>
        </div>
        <div class="hero-card">
          <div class="hero-label">Role Dedup Rate</div>
          <div class="hero-value">{dedup_rate:.1f}%</div>
          <div class="hero-sub">of Auto-Detect calls needed fix</div>
        </div>
        {phase_card_html}
        {sess_html}
      </div>

      {"<div class='insights-bar'>" + insights_html + "</div>" if insights_html else ""}
    </div>

    <!-- Daily cost -->
    <div class="section" id="daily">
      <div class="section-header"><span class="section-title">Daily Token Cost</span></div>
      <div class="card card-pad">
        <div class="card-title">Cost by day · stacked by model</div>
        {fig_html(fig_daily)}
      </div>
    </div>

    <!-- Model comparison -->
    <div class="section" id="comparison">
      <div class="section-header"><span class="section-title">Model Comparison</span></div>
      <div class="chart-row cols-2">
        <div class="card card-pad">
          <div class="card-title">Cost per call vs cost per successful call</div>
          {fig_html(fig_cost_bar)}
        </div>
        <div class="card card-pad">
          <div class="card-title">Latency vs success rate · bubble = volume</div>
          {fig_html(fig_scatter)}
        </div>
      </div>
    </div>

    <!-- Phase breakdown -->
    <div class="section" id="phases">
      <div class="section-header"><span class="section-title">Phase Breakdown</span></div>
      <div class="card card-pad">
        <div class="card-title">Spend and success rate by phase per model</div>
        {fig_html(fig_phase)}
      </div>
    </div>

    <!-- Model table -->
    <div class="section" id="model-table">
      <div class="section-header"><span class="section-title">All Metrics</span></div>
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Model</th><th>Prompt</th><th>Calls</th><th>Success %</th>
              <th>Avg Cost</th><th>Cost / Success</th><th>Latency avg</th><th>Latency p95</th>
              {"<th>Accuracy</th>" if has_fb and agg["avg_accuracy"].notna().any() else ""}
              <th>Value ↑</th>
            </tr>
          </thead>
          <tbody>{model_rows}</tbody>
        </table>
      </div>
    </div>

    <!-- Detection quality -->
    <div class="section" id="detection">
      <div class="section-header"><span class="section-title">Auto-Detect Quality</span></div>
      <div class="card card-pad">
        <div class="card-title">Picks detected and user-verified accuracy per model</div>
        {fig_html(fig_detect)}
      </div>
    </div>

    <!-- Errors -->
    {errors_section}

  </div>
</div>

<script>
// Highlight active nav link on scroll
const sections = document.querySelectorAll('[id]');
const navLinks = document.querySelectorAll('.nav-link');
window.addEventListener('scroll', () => {{
  let current = '';
  sections.forEach(s => {{
    if (window.scrollY >= s.offsetTop - 80) current = s.id;
  }});
  navLinks.forEach(l => {{
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  }});
}});

function filterPhase(val) {{
  // Future: dynamically filter plotly charts by phase
  // For now just a visual filter indicator
}}
</script>
</body>
</html>"""

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(html, encoding="utf-8")
    print(f"Report → {OUTPUT_FILE}")
    webbrowser.open(OUTPUT_FILE.as_uri())

if __name__ == "__main__":
    calls, fb = load_data()
    print(f"Loaded {len(calls)} call records + {len(fb)} feedback records")
    build_report(calls, fb)
