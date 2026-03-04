#!/usr/bin/env .venv/bin/python3
"""
TopDiff Analytics — AI API usage dashboard
Usage: python analytics.py  (or ./.venv/bin/python3 analytics.py)
Output: data/analytics_report.html (auto-opens in browser)
"""

import json
import os
import sys
import webbrowser
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "analytics.ndjson"
OUTPUT_FILE = Path(__file__).parent / "data" / "analytics_report.html"


def load_data():
    if not DATA_FILE.exists():
        print(f"No data file found at {DATA_FILE}")
        print("Run the app and make some API calls first.")
        sys.exit(1)

    call_records = []
    feedback_records = []

    with open(DATA_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
                if r.get("type") == "accuracy_feedback":
                    feedback_records.append(r)
                else:
                    # Flatten meta fields
                    meta = r.pop("meta", {}) or {}
                    r["meta_detectedCount"] = meta.get("detectedCount")
                    r["meta_scene"] = meta.get("scene")
                    r["meta_myChampion"] = meta.get("myChampion")
                    r["meta_myRole"] = meta.get("myRole")
                    r["meta_enemyLaner"] = meta.get("enemyLaner")
                    call_records.append(r)
            except json.JSONDecodeError:
                pass

    if not call_records:
        print("Data file exists but has no call records yet.")
        sys.exit(1)

    return call_records, feedback_records


def build_report(call_records, feedback_records):
    try:
        import pandas as pd
        import plotly.graph_objects as go
        import plotly.io as pio
        from plotly.subplots import make_subplots
    except ImportError:
        print("Missing dependencies. Run: .venv/bin/pip install pandas plotly")
        sys.exit(1)

    df = pd.DataFrame(call_records)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    df["totalTokens"] = df["inputTokens"] + df["outputTokens"]

    # Merge accuracy feedback
    has_feedback = len(feedback_records) > 0
    if has_feedback:
        fb = pd.DataFrame(feedback_records)
        fb = fb.rename(columns={"refTimestamp": "ts_ref"})
        df["ts_str"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S.%f").str[:-3] + "Z"
        df = df.merge(
            fb[["ts_ref", "correctCount", "totalDetected", "accuracyPct"]],
            left_on="ts_str", right_on="ts_ref", how="left"
        )
        df["userAccuracy"] = df["accuracyPct"]
    else:
        df["correctCount"] = None
        df["totalDetected"] = None
        df["userAccuracy"] = None

    models = sorted(df["model"].unique().tolist())

    # ── Per-model stats ───────────────────────────────────────────────────────
    agg = df.groupby("model").agg(
        total_calls=("costUsd", "count"),
        successes=("success", "sum"),
        total_cost=("costUsd", "sum"),
        avg_latency=("latencyMs", "mean"),
        p95_latency=("latencyMs", lambda x: x.quantile(0.95)),
        avg_input=("inputTokens", "mean"),
        avg_output=("outputTokens", "mean"),
    ).reset_index()
    agg["success_rate"] = agg["successes"] / agg["total_calls"] * 100
    agg["avg_cost"] = agg["total_cost"] / agg["total_calls"]
    agg["cost_per_success"] = agg.apply(
        lambda r: r["total_cost"] / r["successes"] if r["successes"] > 0 else None, axis=1
    )

    if has_feedback:
        acc_by_model = df.groupby("model")["userAccuracy"].mean().reset_index()
        acc_by_model.columns = ["model", "avg_accuracy"]
        agg = agg.merge(acc_by_model, on="model", how="left")
        agg["value_score"] = agg.apply(
            lambda r: (r["avg_accuracy"] / 100 * r["success_rate"] / 100) / r["avg_cost"] * 1000
            if r["avg_cost"] > 0 and pd.notna(r.get("avg_accuracy")) else None,
            axis=1
        )
    else:
        agg["avg_accuracy"] = None
        agg["value_score"] = agg.apply(
            lambda r: (r["success_rate"] / 100) / r["avg_cost"] * 1000
            if r["avg_cost"] > 0 else None,
            axis=1
        )

    # Phase-level stats
    phase_stats = df.groupby("phase").agg(
        calls=("costUsd", "count"),
        avg_cost=("costUsd", "mean"),
        total_cost=("costUsd", "sum"),
    ).reset_index()

    total_calls = len(df)
    total_spend = df["costUsd"].sum()
    success_rate = df["success"].mean() * 100
    best_model = agg.loc[agg["value_score"].idxmax(), "model"] if agg["value_score"].notna().any() else "N/A"

    # ── Colour palette ────────────────────────────────────────────────────────
    COLORS = ["#C8AA6E", "#0BC4E3", "#E84057", "#4ade80", "#a78bfa",
              "#fb923c", "#38bdf8", "#f472b6", "#facc15", "#86efac"]
    model_color = {m: COLORS[i % len(COLORS)] for i, m in enumerate(models)}

    sections = []

    # ── Auto-generated insights ───────────────────────────────────────────────
    insights = []
    if len(agg) > 1:
        sorted_cost = agg.dropna(subset=["cost_per_success"]).sort_values("cost_per_success")
        if len(sorted_cost) >= 2:
            cheapest = sorted_cost.iloc[0]
            priciest = sorted_cost.iloc[-1]
            if cheapest["avg_cost"] > 0:
                ratio = priciest["cost_per_success"] / cheapest["cost_per_success"]
                insights.append(f"<b>{cheapest['model']}</b> is <b>{ratio:.1f}×</b> cheaper per successful call than <b>{priciest['model']}</b>")

    if len(phase_stats) == 2:
        phase_sorted = phase_stats.sort_values("avg_cost")
        cheap_phase = phase_sorted.iloc[0]
        exp_phase = phase_sorted.iloc[-1]
        if cheap_phase["avg_cost"] > 0:
            ratio = exp_phase["avg_cost"] / cheap_phase["avg_cost"]
            insights.append(f"<b>{exp_phase['phase']}</b> costs <b>{ratio:.1f}×</b> more per call than <b>{cheap_phase['phase']}</b> on average")

    if has_feedback and agg["avg_accuracy"].notna().any():
        best_acc = agg.dropna(subset=["avg_accuracy"]).sort_values("avg_accuracy", ascending=False).iloc[0]
        insights.append(f"Most accurate model: <b>{best_acc['model']}</b> with <b>{best_acc['avg_accuracy']:.1f}%</b> avg user-verified accuracy")

    if agg["value_score"].notna().any():
        best_val = agg.dropna(subset=["value_score"]).sort_values("value_score", ascending=False).iloc[0]
        insights.append(f"Best overall value: <b>{best_val['model']}</b> (value score: {best_val['value_score']:.1f})")

    # ── Section 1: Summary cards ──────────────────────────────────────────────
    phase_card_html = ""
    for _, row in phase_stats.iterrows():
        phase_card_html += f"""
      <div class="card">
        <div class="card-value">${row['avg_cost']:.4f}</div>
        <div class="card-label">Avg cost / {row['phase']} call</div>
      </div>"""

    insights_html = ""
    if insights:
        bullets = "".join(f"<li>{i}</li>" for i in insights)
        insights_html = f'<div class="insights"><ul>{bullets}</ul></div>'

    summary_html = f"""
    <div class="summary-cards">
      <div class="card">
        <div class="card-value">{total_calls}</div>
        <div class="card-label">Total API Calls</div>
      </div>
      <div class="card">
        <div class="card-value">${total_spend:.4f}</div>
        <div class="card-label">Total Spend</div>
      </div>
      <div class="card">
        <div class="card-value">{success_rate:.1f}%</div>
        <div class="card-label">Overall Success Rate</div>
      </div>
      <div class="card highlight">
        <div class="card-value">{best_model}</div>
        <div class="card-label">Best Value Model</div>
      </div>
      {phase_card_html}
    </div>
    {insights_html}
    """
    sections.append(("summary", summary_html))

    # ── Section 2: Model Comparison ───────────────────────────────────────────
    fig2 = make_subplots(
        rows=1, cols=2,
        subplot_titles=("Cost per Call vs Cost per Successful Call", "Latency vs Success Rate"),
        column_widths=[0.5, 0.5],
    )

    for col_key, col_name, opacity in [
        ("avg_cost", "Avg Cost / Call", 1.0),
        ("cost_per_success", "Cost / Successful Call", 0.6),
    ]:
        fig2.add_trace(go.Bar(
            name=col_name,
            x=agg["model"],
            y=agg[col_key],
            text=[f"${v:.5f}" if pd.notna(v) else "N/A" for v in agg[col_key]],
            textposition="outside",
            marker_color=[model_color.get(m, "#888") for m in agg["model"]],
            opacity=opacity,
        ), row=1, col=1)

    fig2.add_trace(go.Scatter(
        mode="markers+text",
        x=agg["avg_latency"],
        y=agg["success_rate"],
        text=agg["model"],
        textposition="top center",
        marker=dict(
            size=agg["total_calls"].apply(lambda v: max(14, min(v * 5, 44))),
            color=[model_color.get(m, "#888") for m in agg["model"]],
            line=dict(width=1, color="rgba(255,255,255,0.3)"),
        ),
        hovertemplate="<b>%{text}</b><br>Latency: %{x:.0f}ms<br>Success: %{y:.1f}%<extra></extra>",
        showlegend=False,
    ), row=1, col=2)

    fig2.update_xaxes(title_text="Avg Latency (ms)", row=1, col=2)
    fig2.update_yaxes(title_text="Success Rate (%)", row=1, col=2)
    fig2.update_layout(title="Model Comparison", barmode="group", height=400, **dark_layout())
    sections.append(("Model Comparison", fig2.to_html(full_html=False, include_plotlyjs=False)))

    # ── Model stats table ─────────────────────────────────────────────────────
    table_headers = ["Model", "Calls", "Success %", "Avg Cost", "Cost/Success", "Latency p50", "Latency p95", "Value Score"]
    table_vals = [
        agg["model"].tolist(),
        agg["total_calls"].tolist(),
        [f"{v:.1f}%" for v in agg["success_rate"]],
        [f"${v:.5f}" for v in agg["avg_cost"]],
        [f"${v:.5f}" if pd.notna(v) else "—" for v in agg["cost_per_success"]],
        [f"{v:.0f}ms" for v in agg["avg_latency"]],
        [f"{v:.0f}ms" for v in agg["p95_latency"]],
        [f"{v:.1f}" if pd.notna(v) else "—" for v in agg["value_score"]],
    ]
    if has_feedback and agg["avg_accuracy"].notna().any():
        table_headers.insert(-1, "Accuracy")
        table_vals.insert(-1, [f"{v:.1f}%" if pd.notna(v) else "—" for v in agg["avg_accuracy"]])

    fig_table = go.Figure(go.Table(
        header=dict(values=table_headers, fill_color="#1a1f2e", font=dict(color="#C8AA6E", size=11), height=28),
        cells=dict(values=table_vals, fill_color="#0d1117", font=dict(color="#c9d1d9", size=11), height=26),
    ))
    fig_table.update_layout(title="All Metrics", height=max(180, 60 + len(agg) * 30), **dark_layout())
    sections.append(("All Metrics", fig_table.to_html(full_html=False, include_plotlyjs=False)))

    # ── Section 3: Phase Breakdown ────────────────────────────────────────────
    phase_model = df.groupby(["model", "phase"]).agg(
        total_cost=("costUsd", "sum"),
        success_rate=("success", lambda x: x.mean() * 100),
        calls=("costUsd", "count"),
    ).reset_index()

    fig3 = make_subplots(
        rows=1, cols=2,
        subplot_titles=("Total Spend by Phase", "Success Rate by Phase"),
    )
    for phase in sorted(df["phase"].unique()):
        sub = phase_model[phase_model["phase"] == phase]
        fig3.add_trace(go.Bar(
            name=phase, x=sub["model"], y=sub["total_cost"],
            text=[f"${v:.5f}" for v in sub["total_cost"]], textposition="outside",
        ), row=1, col=1)
        fig3.add_trace(go.Bar(
            name=phase, x=sub["model"], y=sub["success_rate"],
            text=[f"{v:.1f}%" for v in sub["success_rate"]], textposition="outside",
            showlegend=False,
        ), row=1, col=2)

    fig3.update_yaxes(ticksuffix="%", row=1, col=2)
    fig3.update_layout(title="Phase Breakdown", barmode="group", height=380, **dark_layout())
    sections.append(("Phase Breakdown", fig3.to_html(full_html=False, include_plotlyjs=False)))

    # ── Section 4: Auto-Detect Quality ───────────────────────────────────────
    ad = df[df["phase"] == "Auto-Detect"].copy()
    if not ad.empty:
        ncols = 2 if (has_feedback and df["userAccuracy"].notna().any()) else 1
        subtitles = ["Avg Picks Detected (out of 5)"]
        if ncols == 2:
            subtitles.append("User-Verified Accuracy (%)")

        fig4 = make_subplots(rows=1, cols=ncols, subplot_titles=subtitles)

        ad_model = ad.groupby("model")["meta_detectedCount"].mean().reset_index()
        fig4.add_trace(go.Bar(
            x=ad_model["model"], y=ad_model["meta_detectedCount"],
            text=[f"{v:.1f}/5" if pd.notna(v) else "—" for v in ad_model["meta_detectedCount"]],
            textposition="outside",
            marker_color=[model_color.get(m, "#888") for m in ad_model["model"]],
            showlegend=False,
        ), row=1, col=1)
        fig4.update_yaxes(range=[0, 5.8], row=1, col=1)

        if ncols == 2:
            acc_ad = ad.groupby("model")["userAccuracy"].mean().reset_index()
            fig4.add_trace(go.Bar(
                x=acc_ad["model"], y=acc_ad["userAccuracy"],
                text=[f"{v:.1f}%" if pd.notna(v) else "—" for v in acc_ad["userAccuracy"]],
                textposition="outside",
                marker_color=[model_color.get(m, "#888") for m in acc_ad["model"]],
                showlegend=False,
            ), row=1, col=2)
            fig4.update_yaxes(range=[0, 110], ticksuffix="%", row=1, col=2)

        fig4.update_layout(title="Auto-Detect Quality", height=360, **dark_layout())
        sections.append(("Auto-Detect Quality", fig4.to_html(full_html=False, include_plotlyjs=False)))

    # ── Section 5: Errors ─────────────────────────────────────────────────────
    errors = df[df["success"] == False].copy()
    if not errors.empty:
        fig5 = make_subplots(
            rows=1, cols=2,
            subplot_titles=("Error Count by Model", "Error Details"),
            specs=[[{"type": "bar"}, {"type": "table"}]],
            column_widths=[0.35, 0.65],
        )
        err_by_model = errors.groupby("model").size().reset_index(name="errors")
        fig5.add_trace(go.Bar(
            x=err_by_model["model"], y=err_by_model["errors"],
            marker_color="#E84057",
            text=err_by_model["errors"], textposition="outside",
            showlegend=False,
        ), row=1, col=1)

        err_detail = errors.groupby(["model", "phase", "error"]).size().reset_index(name="count")
        err_detail = err_detail.sort_values("count", ascending=False).head(20)
        fig5.add_trace(go.Table(
            header=dict(values=["Model", "Phase", "Error", "Count"],
                        fill_color="#1a1f2e", font=dict(color="#E84057", size=11)),
            cells=dict(values=[
                err_detail["model"].tolist(),
                err_detail["phase"].tolist(),
                [str(e)[:70] + "…" if len(str(e)) > 70 else str(e) for e in err_detail["error"]],
                err_detail["count"].tolist(),
            ], fill_color="#0d1117", font=dict(color="#c9d1d9", size=10), height=22),
        ), row=1, col=2)

        fig5.update_layout(title="Error Analysis", height=360, **dark_layout())
        sections.append(("Error Analysis", fig5.to_html(full_html=False, include_plotlyjs=False)))

    # ── Section 6: Time Series (multi-day only) ───────────────────────────────
    if df["date"].nunique() > 1:
        fig6 = make_subplots(
            rows=2, cols=1,
            subplot_titles=("Cumulative Spend Over Time", "Calls Per Day (Success vs Failure)"),
            row_heights=[0.55, 0.45],
        )
        for model in models:
            sub = df[df["model"] == model].sort_values("timestamp")
            cum = sub.set_index("timestamp")["costUsd"].cumsum().reset_index()
            fig6.add_trace(go.Scatter(
                x=cum["timestamp"], y=cum["costUsd"],
                name=model, mode="lines",
                line=dict(color=model_color.get(model, "#888"), width=2),
            ), row=1, col=1)

        daily = df.groupby(["date", "success"]).size().reset_index(name="count")
        for success, color, label in [(True, "#4ade80", "Success"), (False, "#E84057", "Failure")]:
            sub = daily[daily["success"] == success]
            fig6.add_trace(go.Bar(
                x=sub["date"], y=sub["count"],
                name=label, marker_color=color,
            ), row=2, col=1)

        fig6.update_yaxes(tickprefix="$", row=1, col=1)
        fig6.update_layout(title="Usage Over Time", barmode="stack", height=520, **dark_layout())
        sections.append(("Usage Over Time", fig6.to_html(full_html=False, include_plotlyjs=False)))

    # ── Assemble HTML ─────────────────────────────────────────────────────────
    plotly_cdn = '<script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>'
    nav_links = "".join(
        f'<a href="#{s[0].lower().replace(" ", "-")}">{s[0]}</a>'
        for s in sections if s[0] != "summary"
    )
    body_parts = []
    for name, content in sections:
        if name == "summary":
            body_parts.append(content)
        else:
            anchor = name.lower().replace(" ", "-")
            body_parts.append(f'<section id="{anchor}"><h2>{name}</h2>{content}</section>')

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TopDiff — Analytics</title>
{plotly_cdn}
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #080C14; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; }}
  nav {{ position: sticky; top: 0; z-index: 100; background: rgba(8,12,20,0.95); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(200,170,110,0.15); padding: 10px 32px; display: flex; align-items: center; gap: 24px; }}
  nav .brand {{ font-size: 14px; font-weight: 800; letter-spacing: 0.2em; color: #C8AA6E; text-transform: uppercase; }}
  nav a {{ font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: rgba(255,255,255,0.35);
    text-decoration: none; text-transform: uppercase; transition: color 0.15s; }}
  nav a:hover {{ color: #C8AA6E; }}
  main {{ max-width: 1400px; margin: 0 auto; padding: 32px 24px 64px; }}
  .summary-cards {{ display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }}
  .card {{ flex: 1; min-width: 150px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 18px 22px; }}
  .card.highlight {{ border-color: rgba(200,170,110,0.3); background: rgba(200,170,110,0.05); }}
  .card-value {{ font-size: 24px; font-weight: 700; color: #F0E6D3; margin-bottom: 5px; }}
  .card.highlight .card-value {{ color: #C8AA6E; }}
  .card-label {{ font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); }}
  .insights {{ margin-bottom: 36px; background: rgba(200,170,110,0.04); border: 1px solid rgba(200,170,110,0.12);
    border-radius: 10px; padding: 14px 20px; }}
  .insights ul {{ list-style: none; display: flex; flex-direction: column; gap: 6px; }}
  .insights li {{ font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5; }}
  .insights li::before {{ content: "→ "; color: rgba(200,170,110,0.5); }}
  .insights b {{ color: #C8AA6E; }}
  section {{ margin-bottom: 48px; }}
  h2 {{ font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(200,170,110,0.6); margin-bottom: 16px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06); }}
</style>
</head>
<body>
<nav>
  <span class="brand">TopDiff Analytics</span>
  {nav_links}
</nav>
<main>
{"".join(body_parts)}
</main>
</body>
</html>"""

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(html, encoding="utf-8")
    print(f"Report written to {OUTPUT_FILE}")
    webbrowser.open(OUTPUT_FILE.as_uri())


def dark_layout():
    return dict(
        paper_bgcolor="#0d1117",
        plot_bgcolor="#0d1117",
        font=dict(color="#c9d1d9", family="-apple-system, BlinkMacSystemFont, sans-serif", size=11),
        title_font=dict(color="#C8AA6E", size=13),
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="rgba(255,255,255,0.1)", borderwidth=1),
        margin=dict(t=60, b=20, l=20, r=20),
        xaxis=dict(gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(255,255,255,0.08)"),
        yaxis=dict(gridcolor="rgba(255,255,255,0.05)", linecolor="rgba(255,255,255,0.08)"),
    )


if __name__ == "__main__":
    records, feedback = load_data()
    print(f"Loaded {len(records)} call records + {len(feedback)} accuracy feedback records")
    build_report(records, feedback)
