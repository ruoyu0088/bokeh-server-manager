"""Render project documentation from Markdown to safe HTML."""

from __future__ import annotations

import bleach
import markdown

_ALLOWED_TAGS = {
    "a",
    "abbr",
    "blockquote",
    "br",
    "caption",
    "code",
    "dd",
    "del",
    "details",
    "dl",
    "dt",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "ins",
    "kbd",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul",
}
_ALLOWED_ATTRIBUTES = {
    "a": ["href", "title"],
    "abbr": ["title"],
    "code": ["class"],
    "img": ["src", "alt", "title", "width", "height"],
    "ol": ["start"],
    "td": ["align"],
    "th": ["align"],
}
_ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def render_markdown(text: str) -> str:
    """Convert Markdown to styled HTML and remove unsafe markup.

    Raw HTML is accepted by Markdown but sanitized with Bleach, so documents
    can contain tables, code blocks, links, and images without allowing
    scripts or event handlers into the manager origin.
    """
    if not isinstance(text, str) or not text.strip():
        return ""
    rendered = markdown.markdown(
        text,
        extensions=["fenced_code", "tables", "sane_lists"],
        output_format="html5",
    )
    return bleach.clean(
        rendered,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        protocols=_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
