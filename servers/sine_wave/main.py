"""Interactive sine-wave demo for the Bokeh Server Manager."""

from __future__ import annotations

import numpy as np
from bokeh.io import curdoc
from bokeh.layouts import column, row
from bokeh.models import Button, ColumnDataSource, Div, Select, Slider
from bokeh.plotting import figure

TITLE = "Sine Wave Lab"
X = np.linspace(0.0, 4.0 * np.pi, 500)
PHASE_STEP = 0.045

source = ColumnDataSource(data={"x": X, "y": np.sin(X)})
plot = figure(
    title=TITLE,
    height=560,
    sizing_mode="stretch_both",
    tools="pan,wheel_zoom,box_zoom,reset,save",
    active_scroll="wheel_zoom",
    x_axis_label="x",
    y_axis_label="y",
)
plot.line("x", "y", source=source, line_width=3, color="#3b82f6")
plot.x_range.range_padding = 0.02
plot.y_range.start = -2.2
plot.y_range.end = 2.2
plot.toolbar.logo = None

waveform = Select(
    title="Waveform",
    value="Sine",
    options=["Sine", "Cosine", "Damped sine"],
)
frequency = Slider(
    title="Frequency",
    start=0.5,
    end=4.0,
    value=1.0,
    step=0.1,
)
amplitude = Slider(
    title="Amplitude",
    start=0.2,
    end=2.0,
    value=1.0,
    step=0.1,
)
speed = Slider(
    title="Animation speed",
    start=0.2,
    end=2.0,
    value=1.0,
    step=0.1,
)
phase = Slider(
    title="Phase",
    start=0.0,
    end=2.0 * np.pi,
    value=0.0,
    step=0.05,
)
play = Button(label="Pause", button_type="primary")
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

running = True
callbacks_enabled = True


def waveform_values() -> np.ndarray:
    omega = float(frequency.value)
    amp = float(amplitude.value)
    shift = float(phase.value)
    if waveform.value == "Cosine":
        return amp * np.cos(omega * X + shift)
    if waveform.value == "Damped sine":
        return amp * np.exp(-0.16 * X) * np.sin(omega * X + shift)
    return amp * np.sin(omega * X + shift)


def render() -> None:
    if not callbacks_enabled:
        return
    source.data = {"x": X, "y": waveform_values()}
    status.text = (
        f"<b>{waveform.value}</b> &nbsp;·&nbsp; "
        f"f = {frequency.value:.1f} &nbsp;·&nbsp; "
        f"A = {amplitude.value:.1f} &nbsp;·&nbsp; "
        f"phase = {phase.value:.2f}"
    )


def on_control_change(attr, old, new) -> None:
    render()


def toggle_animation() -> None:
    global running
    running = not running
    play.label = "Pause" if running else "Play"


def tick() -> None:
    if not running:
        return
    phase.value = (float(phase.value) + PHASE_STEP * float(speed.value)) % (
        2.0 * np.pi
    )


waveform.on_change("value", on_control_change)
frequency.on_change("value", on_control_change)
amplitude.on_change("value", on_control_change)
phase.on_change("value", on_control_change)
play.on_click(toggle_animation)

controls = column(
    waveform,
    frequency,
    amplitude,
    speed,
    phase,
    play,
    status,
    width=270,
    sizing_mode="fixed",
)
layout = row(controls, plot, sizing_mode="stretch_both")
layout.styles = {"padding": "18px", "box-sizing": "border-box"}

render()
curdoc().title = TITLE
curdoc().add_root(layout)
curdoc().add_periodic_callback(tick, 55)
