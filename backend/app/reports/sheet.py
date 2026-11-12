"""Draws the CSE 3200 weekly progress sheet. Pure functions, no database.
Every position below was measured from the department's own PDF sheet (A4, Times New Roman), so a
printed report looks like the paper form. "top" values are distances from the top edge of the page."""
from dataclasses import dataclass, field
from datetime import date
from io import BytesIO
from reportlab.lib.colors import Color
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
PAGE_W, PAGE_H = 595.4, 842.0
ASCENT = 0.785  # measured on the original sheet: baseline = top + 0.785 x font size
ROMAN, BOLD, ITALIC, BOLD_ITALIC = "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"
BOX_LEFT, BOX_RIGHT = 66.6, 548.4
BOX_TOPS = (153.6, 323.3, 559.1, 697.6)  # top of the box, the two dividers, the bottom of the box
TEXT_LEFT, TEXT_RIGHT = 72.0, 542.0
FOOTER = (
    "*** This document must be presented by the student during Progress defense and "
    "Final defense for evaluation purpose."
)
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
    draft: bool = False  # a draft gets a light DRAFT mark so it is never mistaken for the real sheet
def _text(value: str | None) -> str:
    """The built-in Times fonts only know Western characters. Anything else becomes a question mark."""
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
def _y(top: float, size: float) -> float:
    """Page coordinate of the baseline of a line whose top edge is `top` points from the top of the page."""
    return PAGE_H - (top + ASCENT * size)
def _fit(text: str, font: str, width: float, height: float, sizes: tuple, leading: float = 1.17):
    """The largest font size at which the text fits in the box, and its wrapped lines."""
    text = _text(text)
    lines: list[str] = []
    size = sizes[-1]
    for size in sizes:
        lines = _wrap(text, font, size, width)
        if len(lines) * size * leading <= height:
            return size, lines
    max_lines = max(1, int(height // (size * leading)))  # last resort: cut the text rather than overflow
    shown = lines[:max_lines]
    shown[-1] = shown[-1].rstrip()[: max(0, len(shown[-1]) - 1)] + "..."
    return size, shown
def draw_sheet(c: canvas.Canvas, d: SheetData) -> None:
    # ---- heading
    c.setFont(BOLD, 14)
    c.drawCentredString(PAGE_W / 2, _y(34.8, 14), _text(d.department_line))
    c.setFont(ROMAN, 14)
    c.drawCentredString(PAGE_W / 2, _y(50.9, 14), _text(d.university))
    title = _text(d.title_line)
    c.setFont(BOLD, 14)
    c.drawCentredString(PAGE_W / 2, _y(76.2, 14), title)
    title_w = stringWidth(title, BOLD, 14)
    c.rect((PAGE_W - title_w) / 2, PAGE_H - 90.2, title_w, 1.4, stroke=0, fill=1)  # the underline
    # ---- names and ids
    c.setFont(ROMAN, 12)
    c.drawString(66.6, _y(100.0, 12), "Name of the Student(s):")
    id_label_x = 486.0 - stringWidth("Student ID(s):", ROMAN, 12)
    c.drawString(id_label_x, _y(100.0, 12), "Student ID(s):")
    size, step, first_top = (12, 14.0, 117.0) if len(d.students) <= 3 else (9, 9.5, 114.0)
    c.setFont(ROMAN, size)
    for i, (name, number) in enumerate(d.students[:4]):
        c.drawString(TEXT_LEFT, _y(first_top + i * step, size), _text(name))
        c.drawString(id_label_x, _y(first_top + i * step, size), _text(number))
            # ---- the box with its three sections
    c.setLineWidth(0.4)
    for top in BOX_TOPS:
        c.line(BOX_LEFT, PAGE_H - top, BOX_RIGHT, PAGE_H - top)
    for x in (BOX_LEFT, BOX_RIGHT):
        c.line(x, PAGE_H - BOX_TOPS[0], x, PAGE_H - BOX_TOPS[-1])
    def label(letter: str, text: str, top: float) -> None:
        c.setFont(BOLD_ITALIC, 12)
        c.drawString(TEXT_LEFT, _y(top, 12), letter)
        c.setFont(ITALIC, 12)
        c.drawString(TEXT_LEFT + stringWidth(letter, BOLD_ITALIC, 12), _y(top, 12), text)
    label("A.", " Summary of Works Performed in the Previous Week:", 159.2)
    label("B.", " Description of Current Week\u2019s Activity:", 325.5)
    label("C.", "   Proposed Works for the Next Week:", 561.3)
    def body(text: str, top: float, bottom: float) -> None:
        sizes = (12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8)
        size, lines = _fit(text, ROMAN, TEXT_RIGHT - TEXT_LEFT, bottom - top, sizes)
        c.setFont(ROMAN, size)
        for i, line in enumerate(lines):
            c.drawString(TEXT_LEFT, _y(top + i * size * 1.17, size), line)
    body(d.section_a, 177.0, 319.0)
    body(d.section_b, 343.0, 555.0)
    # ---- the three numbered works for next week
    for i, top in enumerate((575.1, 616.5, 657.9)):
        c.setFont(ITALIC, 12)
        c.drawString(TEXT_LEFT, _y(top, 12), f"{i + 1}.")
        item = d.next_works[i] if i < len(d.next_works) else ""
        size, lines = _fit(item, ROMAN, TEXT_RIGHT - 87.0, 38.0, (12, 11, 10.5, 10, 9.5, 9))
        c.setFont(ROMAN, size)
        for j, line in enumerate(lines):
            c.drawString(87.0, _y(top, 12) - j * size * 1.17, line)
    # ---- signature and comments
    c.setFont(BOLD, 12)
    c.drawString(82.6, _y(743.4, 12), "________________________________")
    c.drawString(335.5, _y(736.6, 12), "____________________________")
    c.drawString(88.2, _y(757.2, 12), "Signature & Date of the Supervisor")
    c.drawString(339.3, _y(750.4, 12), "Comments on Weekly Progress")
    c.drawString(339.3, _y(764.0, 12), "(Poor/Average/Good/Excellent)")
    if d.supervisor_name:  # signed: the name and date go on the signature line
        c.setFont(ITALIC, 11)
        c.drawString(90.0, PAGE_H - 749.2, _text(d.supervisor_name)[:34])
        if d.signed_on:
            c.drawRightString(274.6, PAGE_H - 749.2, d.signed_on.strftime("%d %b %Y"))
    if d.rating:
        c.setFont(BOLD, 12)
        c.drawCentredString(419.5, PAGE_H - 742.7, _text(d.rating))
        if d.comment:
            size, lines = _fit(d.comment, ITALIC, 170.0, 24.0, (9, 8.5, 8, 7.5))
            c.setFont(ITALIC, size)
            for i, line in enumerate(lines[::-1]):  # last line sits just above the rating
                c.drawCentredString(419.5, PAGE_H - (729.7 - i * size * 1.17), line)
    c.setFont(BOLD, 11)
    c.drawString(21.6, _y(795.2, 11), FOOTER)
    if d.draft:
        c.saveState()
        c.setFillColor(Color(0.85, 0.85, 0.85, alpha=0.35))
        c.setFont("Helvetica-Bold", 96)
        c.translate(PAGE_W / 2, PAGE_H / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "DRAFT")
        c.restoreState()
def render(sheets: list[SheetData], title: str = "Weekly Progress Report") -> bytes:
    """One A4 page per sheet, as a PDF."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    c.setTitle(title)
    c.setAuthor("Thesis Management System")
    for sheet in sheets:
        draw_sheet(c, sheet)
        c.showPage()
    c.save()
    return buffer.getvalue()
