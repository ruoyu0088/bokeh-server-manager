"""Interactive Panel demo for the Bokeh/Panel Server Manager."""

import numpy as np
import panel as pn
from bokeh.plotting import figure

pn.extension()

amplitude = pn.widgets.FloatSlider(
    name="Amplitude",
    start=0.2,
    end=2.0,
    value=1.0,
    step=0.1,
)
frequency = pn.widgets.FloatSlider(
    name="Frequency",
    start=0.5,
    end=4.0,
    value=1.0,
    step=0.1,
)
phase = pn.widgets.FloatSlider(
    name="Phase",
    start=0.0,
    end=2.0 * np.pi,
    value=0.0,
    step=0.05,
)
waveform = pn.widgets.Select(
    name="Waveform",
    options=["Sine", "Cosine", "Damped sine"],
    value="Sine",
)


@pn.depends(
    amplitude.param.value,
    frequency.param.value,
    phase.param.value,
    waveform.param.value,
)
def wave_plot(amp, freq, shift, kind):
    x = np.linspace(0.0, 4.0 * np.pi, 500)
    if kind == "Cosine":
        y = amp * np.cos(freq * x + shift)
    elif kind == "Damped sine":
        y = amp * np.exp(-0.16 * x) * np.sin(freq * x + shift)
    else:
        y = amp * np.sin(freq * x + shift)

    plot = figure(
        height=430,
        sizing_mode="stretch_width",
        title="Panel + Bokeh",
        x_axis_label="x",
        y_axis_label="y",
        tools="pan,wheel_zoom,box_zoom,reset,save",
        active_scroll="wheel_zoom",
    )
    plot.line(x, y, line_width=3, color="#0ea5e9")
    plot.y_range.start = -2.2
    plot.y_range.end = 2.2
    plot.toolbar.logo = None
    return plot


intro = pn.pane.Markdown(
    """
    ## Panel Demo

    This app is served by Panel and embedded through the same server manager.

    Adjust the sidebar controls to update the Bokeh plot. The manager passes
    the current light/dark theme as a URL parameter, so standard Panel
    templates follow the selected theme when the server is started or reloaded.
    """
)

template = pn.template.FastListTemplate(
    title="Panel Demo",
    sidebar=[waveform, amplitude, frequency, phase],
    main=[intro, wave_plot],
    accent_base_color="#0ea5e9",
)
template.servable()
