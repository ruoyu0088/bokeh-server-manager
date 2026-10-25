"""Interactive scatter and distribution demo for the Bokeh Server Manager."""

from __future__ import annotations

import numpy as np
from bokeh.io import curdoc
from bokeh.layouts import column, row
from bokeh.models import Button, ColumnDataSource, Div, Select, Slider
from bokeh.plotting import figure

TITLE = "Scatter Explorer"
CATEGORIES = ("Alpha", "Beta", "Gamma")
COLORS = {"Alpha": "#38bdf8", "Beta": "#f59e0b", "Gamma": "#a78bfa"}
CATEGORY_CENTERS = {"Alpha": -0.8, "Beta": 0.4, "Gamma": 1.6}


def make_data(seed: int):
    rng = np.random.default_rng(seed)
    count = 360
    categories = rng.choice(CATEGORIES, count)
    x = np.empty(count)
    y = np.empty(count)
    for name, center in CATEGORY_CENTERS.items():
        mask = categories == name
        x[mask] = rng.normal(center, 1.1, mask.sum())
        y[mask] = 0.55 * x[mask] + rng.normal(0.0, 1.0, mask.sum())
    sizes = rng.uniform(7.0, 15.0, count)
    colors = [COLORS[category] for category in categories]
    return rng, categories, x, y, sizes, colors


rng, categories, x, y, sizes, colors = make_data(7)
source = ColumnDataSource(data={"x": x, "y": y, "size": sizes, "color": colors})
fit_source = ColumnDataSource(data={"x": [], "y": []})
hist_source = ColumnDataSource(
    data={"left": [], "top": [], "width": []}
)

category = Select(
    title="Category",
    value="All",
    options=["All", *CATEGORIES],
)
marker_size = Slider(
    title="Marker size",
    start=4.0,
    end=18.0,
    value=10.0,
    step=1.0,
)
regenerate = Button(label="Regenerate data", button_type="primary")
status = Div(
    text="",
    sizing_mode="stretch_width",
    styles={
        "color": "#6b7280",
        "font-size": "12px",
        "line-height": "1.55",
        "padding": "8px 0 0 0",
    },
)

scatter = figure(
    title=TITLE,
    sizing_mode="stretch_both",
    tools="pan,wheel_zoom,box_zoom,reset,save",
    active_scroll="wheel_zoom",
    x_axis_label="x",
    y_axis_label="y",
)
scatter.scatter(
    "x",
    "y",
    source=source,
    size="size",
    color="color",
    alpha=0.78,
    line_color="white",
    line_alpha=0.35,
)
scatter.line(
    "x",
    "y",
    source=fit_source,
    line_width=3,
    color="#ef4444",
    line_dash="dashed",
)
scatter.toolbar.logo = None
scatter.x_range.range_padding = 0.08
scatter.y_range.range_padding = 0.08

hist = figure(
    title="Y distribution",
    width=310,
    sizing_mode="stretch_height",
    tools="pan,wheel_zoom,reset,save",
    active_scroll="wheel_zoom",
    x_axis_label="y",
    y_axis_label="count",
)
hist.vbar(
    top="top",
    x="left",
    width="width",
    source=hist_source,
    fill_color="#60a5fa",
    line_color=None,
    alpha=0.75,
)
hist.toolbar.logo = None


def regenerate_data() -> None:
    global rng, categories, x, y, sizes, colors
    seed = int(rng.integers(1, 1_000_000))
    rng, categories, x, y, sizes, colors = make_data(seed)
    update_views()


def update_views() -> None:
    selected = category.value
    mask = np.ones_like(x, dtype=bool) if selected == "All" else categories == selected
    visible_x = x[mask]
    visible_y = y[mask]
    visible_colors = [color for color, keep in zip(colors, mask) if keep]
    scale = float(marker_size.value) / 10.0
    visible_sizes = sizes[mask] * scale

    source.data = {
        "x": visible_x,
        "y": visible_y,
        "size": visible_sizes,
        "color": visible_colors,
    }

    if len(visible_y) >= 3:
        coefficients = np.polyfit(visible_x, visible_y, 1)
        fit_x = np.linspace(visible_x.min(), visible_x.max(), 100)
        fit_y = np.polyval(coefficients, fit_x)
        fit_source.data = {"x": fit_x, "y": fit_y}
    else:
        fit_source.data = {"x": [], "y": []}

    counts, edges = np.histogram(visible_y, bins=16)
    hist_source.data = {
        "left": edges[:-1],
        "top": counts,
        "width": np.diff(edges),
    }

    if len(visible_x) >= 2:
        correlation = float(np.corrcoef(visible_x, visible_y)[0, 1])
    else:
        correlation = float("nan")
    status.text = (
        f"<b>{len(visible_x)}</b> points &nbsp;·&nbsp; "
        f"mean y = {visible_y.mean():.2f} &nbsp;·&nbsp; "
        f"r = {correlation:.2f}"
    )


def on_control_change(attr, old, new) -> None:
    update_views()


category.on_change("value", on_control_change)
marker_size.on_change("value", on_control_change)
regenerate.on_click(regenerate_data)

controls = column(
    category,
    marker_size,
    regenerate,
    status,
    width=270,
    sizing_mode="fixed",
)
layout = row(controls, scatter, hist, sizing_mode="stretch_both")
layout.styles = {"padding": "18px", "box-sizing": "border-box"}

update_views()
curdoc().title = TITLE
curdoc().add_root(layout)
