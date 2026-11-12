"""Draws the weekly progress report as an A4 PDF page. Pure functions, no database.

The sections follow the department's CSE 3200 progress sheet: names and IDs, A, B and C, then the
supervisor's signature and comments. The look matches the rest of the system: a clear heading, one card
per section, and room that grows with the text. If a report is long, the text size shrinks so that it
always fits on one page."""
from dataclasses import dataclass, field
from datetime import date
from io import BytesIO

from reportlab.lib.colors import Color, HexColor, white
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = 595.4, 842.0
MARGIN = 48.0
LEFT, RIGHT = MARGIN, PAGE_W - MARGIN
CONTENT_W = RIGHT - LEFT

SANS, BOLD, ITALIC = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"
BRAND, INK, MUTED = HexColor("#4F46E5"), HexColor("#0F172A"), HexColor("#64748B")
LINE, TINT = HexColor("#CBD5E1"), HexColor("#F1F5F9")
RATING_COLOR = {"poor": "#DC2626", "average": "#D97706", "good": "#2563EB", "excellent": "#16A34A"}

FOOTER = (
    "*** This document must be presented by the student during Progress defense and "
    "Final defense for evaluation purpose."
)
SIZES = (10.5, 10, 9.5, 9, 8.5, 8, 7.5)  # body text sizes to try, largest first
CARD_HEAD, CARD_PAD, GAP = 26.0, 8.0, 8.0
SIGNATURE_H, FOOTER_H, BRAND_BAR = 84.0, 36.0, 8.0


@dataclass
class SheetData:
    department_line: str  # for example "Department of Computer Science and Engineering"
    university: str
    title_line: str  # for example "CSE 3200: Weekly Progress Report (Summary)"
    students: list[tuple[str, str]]  # (name, student id)
    section_a: str
    section_b: str
    next_works: list[str] = field(default_factory=list)
    supervisor_name: str | None = None  # filled in only when the supervisor has signed
    signed_on: date | None = None
    rating: str | None = None  # Poor, Average, Good or Excellent
    comment: str = ""
    draft: bool = False  # a draft gets a light DRAFT mark so it is never mistaken for a signed report


def _text(value: str | None) -> str:
    """The built-in fonts only know Western characters. Anything else becomes a question mark."""
    return (value or "").replace("\t", " ").encode("cp1252", "replace").decode("cp1252")


def _wrap(text: str, font: str, size: float, width: float) -> list[str]:
    """Break text into lines no wider than `width`. A word that is wider than a whole line, such as a long
    web address, is cut into pieces instead of running off the page."""
    lines: list[str] = []
    for paragraph in text.split("\n"):
        current = ""
        for word in paragraph.split(" "):
            while stringWidth(word, font, size) > width:
                cut = len(word)
                while cut > 1 and stringWidth(word[:cut], font, size) > width:
                    cut -= 1
                if current:
                    lines.append(current)
                    current = ""
                lines.append(word[:cut])
                word = word[cut:]
            trial = word if not current else f"{current} {word}"
            if stringWidth(trial, font, size) <= width:
                current = trial
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def _clip(lines: list[str], max_lines: int) -> list[str]:
    """Last resort for text that cannot fit even at the smallest size: cut it and mark the cut."""
    if len(lines) <= max_lines:
        return lines
    shown = lines[: max(1, max_lines)]
    shown[-1] = shown[-1].rstrip()[:-1] + "..." if shown[-1] else "..."
    return shown


def _put(c: canvas.Canvas, s: str, x: float, top: float, font: str, size: float, color=INK, align="left") -> None:
    """Draw one line of text whose top edge is `top` points from the top of the page."""
    c.setFillColor(color)
    c.setFont(font, size)
    y = PAGE_H - (top + size * 0.8)
    if align == "center":
        c.drawCentredString(x, y, s)
    elif align == "right":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


# ------------------------------------------------------------------------- layout
@dataclass
class _Layout:
    size: float
    leading: float
    a: list[str]
    b: list[str]
    items: list[list[str]]
    h_a: float
    h_b: float
    h_c: float
    info_h: float
    info_top: float
    total: float


def _heading_height() -> float:
    return 38 + 20 + 18 + 12 + 10  # department, university, title, rule, space


def _make_layout(d: SheetData, size: float, budget: dict | None = None) -> _Layout:
    leading = size * 1.35
    inner_w = CONTENT_W - 28
    a = _wrap(_text(d.section_a), SANS, size, inner_w)
    b = _wrap(_text(d.section_b), SANS, size, inner_w)
    items = [
        _wrap(_text(d.next_works[i]) if i < len(d.next_works) else "", SANS, size, inner_w - 20)
        for i in range(3)
    ]
    if budget:
        a, b = _clip(a, budget["a"]), _clip(b, budget["b"])
        items = [_clip(x, budget["item"]) for x in items]
    body_a = max(36.0, len(a) * leading)
    body_b = max(52.0, len(b) * leading)
    body_c = sum(max(18.0, len(x) * leading) + 6 for x in items)
    cards = [CARD_HEAD + CARD_PAD * 2 + body for body in (body_a, body_b, body_c)]
    rows = min(max(len(d.students), 1), 6)
    info_h = 30 + rows * (15 if rows <= 3 else 12)
    info_top = _heading_height()
    total = info_top + info_h + GAP + sum(cards) + 2 * GAP + 12 + SIGNATURE_H + FOOTER_H
    return _Layout(size, leading, a, b, items, *cards, info_h, info_top, total)


def _choose_layout(d: SheetData) -> _Layout:
    for size in SIZES:
        layout = _make_layout(d, size)
        if layout.total <= PAGE_H:
            return layout
    # Even the smallest size is too big. Take lines away one at a time, always from the section that
    # takes the most room, until the page fits. Nothing is cut unless it has to be.
    size = SIZES[-1]
    layout = _make_layout(d, size)
    caps = {"a": len(layout.a), "b": len(layout.b), "item": max(len(x) for x in layout.items)}
    floors = {"a": 2, "b": 3, "item": 1}
    while layout.total > PAGE_H:
        heights = {"a": layout.h_a, "b": layout.h_b, "item": layout.h_c}
        options = [key for key in caps if caps[key] > floors[key]]
        if not options:
            break
        caps[max(options, key=lambda key: heights[key])] -= 1
        layout = _make_layout(d, size, caps)
    return layout


# ------------------------------------------------------------------------ drawing
def _card(c: canvas.Canvas, letter: str, title: str, top: float, height: float) -> float:
    """A bordered section card with a lettered heading. Returns the top of the body area."""
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.setFillColor(white)
    c.roundRect(LEFT, PAGE_H - (top + height), CONTENT_W, height, 6, stroke=1, fill=1)
    c.setFillColor(BRAND)
    c.circle(LEFT + 20, PAGE_H - (top + CARD_HEAD / 2 + 1), 9, stroke=0, fill=1)
    _put(c, letter, LEFT + 20, top + CARD_HEAD / 2 - 5, BOLD, 10, white, "center")
    _put(c, title, LEFT + 36, top + CARD_HEAD / 2 - 6, BOLD, 10.5, INK)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(LEFT, PAGE_H - (top + CARD_HEAD), RIGHT, PAGE_H - (top + CARD_HEAD))
    return top + CARD_HEAD + CARD_PAD


def _lines(c: canvas.Canvas, lines: list[str], x: float, top: float, size: float, leading: float) -> None:
    for i, line in enumerate(lines):
        _put(c, line, x, top + i * leading, SANS, size, INK)


def draw_sheet(c: canvas.Canvas, d: SheetData) -> None:
    lay = _choose_layout(d)

    # ---- heading
    c.setFillColor(BRAND)
    c.rect(0, PAGE_H - BRAND_BAR, PAGE_W, BRAND_BAR, stroke=0, fill=1)
    _put(c, _text(d.department_line), LEFT, 38, BOLD, 16, INK)
    _put(c, _text(d.university), LEFT, 58, SANS, 10.5, MUTED)
    _put(c, _text(d.title_line), LEFT, 76, BOLD, 12.5, BRAND)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(LEFT, PAGE_H - 98, RIGHT, PAGE_H - 98)

    # ---- the students
    top = lay.info_top
    c.setFillColor(TINT)
    c.roundRect(LEFT, PAGE_H - (top + lay.info_h), CONTENT_W, lay.info_h, 6, stroke=0, fill=1)
    id_x = RIGHT - 150
    _put(c, "Name of the Student(s):", LEFT + 14, top + 9, SANS, 8.5, MUTED)
    _put(c, "Student ID(s):", id_x, top + 9, SANS, 8.5, MUTED)
    step = 15 if len(d.students) <= 3 else 12
    size = 11 if len(d.students) <= 3 else 9.5
    for i, (name, number) in enumerate(d.students[:6]):
        _put(c, _text(name), LEFT + 14, top + 24 + i * step, BOLD, size, INK)
        _put(c, _text(number), id_x, top + 24 + i * step, SANS, size, INK)
    top += lay.info_h + GAP

    # ---- A and B
    body = _card(c, "A", "Summary of Works Performed in the Previous Week", top, lay.h_a)
    _lines(c, lay.a, LEFT + 14, body, lay.size, lay.leading)
    top += lay.h_a + GAP
    body = _card(c, "B", "Description of Current Week\u2019s Activity", top, lay.h_b)
    _lines(c, lay.b, LEFT + 14, body, lay.size, lay.leading)
    top += lay.h_b + GAP

    # ---- C: up to three numbered works for next week
    row = _card(c, "C", "Proposed Works for the Next Week", top, lay.h_c)
    for i, item_lines in enumerate(lay.items):
        _put(c, f"{i + 1}.", LEFT + 14, row, BOLD, lay.size, BRAND)
        _lines(c, item_lines, LEFT + 34, row, lay.size, lay.leading)
        row += max(18.0, len(item_lines) * lay.leading) + 6
    top += lay.h_c + GAP + 12

    # ---- signature and comments
    col_w = (CONTENT_W - 24) / 2
    right_x = LEFT + col_w + 24
    line_top = top + 50
    c.setStrokeColor(INK)
    c.setLineWidth(0.7)
    c.line(LEFT, PAGE_H - line_top, LEFT + col_w, PAGE_H - line_top)
    c.line(right_x, PAGE_H - line_top, RIGHT, PAGE_H - line_top)
    _put(c, "Signature & Date of the Supervisor", LEFT, line_top + 6, BOLD, 9, INK)
    _put(c, "Comments on Weekly Progress", right_x, line_top + 6, BOLD, 9, INK)
    _put(c, "(Poor/Average/Good/Excellent)", right_x, line_top + 18, SANS, 8.5, MUTED)

    if d.supervisor_name:  # signed: the name and the date sit on the signature line
        _put(c, _text(d.supervisor_name)[:34], LEFT + 2, line_top - 16, ITALIC, 11, INK)
        if d.signed_on:
            _put(c, d.signed_on.strftime("%d %b %Y"), LEFT + col_w - 2, line_top - 15, SANS, 9.5, MUTED, "right")
    if d.rating:
        color = HexColor(RATING_COLOR.get(d.rating.lower(), "#475569"))
        label = _text(d.rating)
        pill_w = stringWidth(label, BOLD, 9.5) + 18
        c.setFillColor(color)
        c.roundRect(right_x, PAGE_H - (top + 22), pill_w, 18, 9, stroke=0, fill=1)
        _put(c, label, right_x + pill_w / 2, top + 6.5, BOLD, 9.5, white, "center")
        if d.comment:
            text_x = right_x + pill_w + 8
            for size in (9, 8.5, 8, 7.5):
                lines = _wrap(_text(d.comment), ITALIC, size, RIGHT - text_x)
                if len(lines) * size * 1.2 <= 38:
                    break
            lines = _clip(lines, int(38 // (size * 1.2)))
            for i, line in enumerate(lines):
                _put(c, line, text_x, top + 2 + i * size * 1.2, ITALIC, size, MUTED)

    # ---- footer note
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(LEFT, PAGE_H - (PAGE_H - FOOTER_H + 4), RIGHT, PAGE_H - (PAGE_H - FOOTER_H + 4))
    for i, line in enumerate(_wrap(FOOTER, BOLD, 7.5, CONTENT_W)):
        _put(c, line, LEFT, PAGE_H - FOOTER_H + 10 + i * 10, BOLD, 7.5, MUTED)

    if d.draft:
        c.saveState()
        c.setFillColor(Color(0.6, 0.64, 0.7, alpha=0.18))
        c.setFont("Helvetica-Bold", 96)
        c.translate(PAGE_W / 2, PAGE_H / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "DRAFT")
        c.restoreState()


def render(sheets: list[SheetData], title: str = "Weekly Progress Report") -> bytes:
    """One A4 page per report, as a PDF."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    c.setTitle(title)
    c.setAuthor("Thesis Management System")
    for sheet in sheets:
        draw_sheet(c, sheet)
        c.showPage()
    c.save()
    return buffer.getvalue()