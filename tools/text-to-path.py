#!/usr/bin/env python3
# نص ← مسار SVG بخط Cairo، للكتابة داخل رسومات الفئات (js/category-art.js).
#
# ليش مسار مو <text>: نص بطاقة الفئة لازم يساوي اسمها حرفياً — اختبارات كثيرة
# تقارنه — وأي <text> داخل الرسمة يدخل بالنص ويكسرها. والمسار كمان ما يحتاج الخط
# يكون محمّل.
#
# التشكيل بـHarfBuzz عشان الحروف العربية تتصل صح (أول/وسط/آخر الكلمة).
#
#   pip install uharfbuzz fonttools
#   python3 tools/text-to-path.py <مسار Cairo.ttf> 'مناطق' --size 7 --x 32.4 --y 24.2 [--wght 800] [--align center]
#
# الإحداثيات بشبكة الرسمة (48×48): --y خط القاعدة، و--size حجم الخط بنفس الوحدات.
import argparse, io
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen


def text_path(font_path, text, size, x, baseline, align="center", wght=800):
    # Cairo خط متغيّر: نثبّت الوزن أول عشان يطابق وزن الواجهة
    tt = TTFont(font_path)
    if "fvar" in tt:
        tt = instancer.instantiateVariableFont(tt, {"wght": wght, "slnt": 0})
    buf = io.BytesIO()
    tt.save(buf)
    hf = hb.Font(hb.Face(buf.getvalue()))
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(hf, b, {})

    s = size / tt["head"].unitsPerEm
    total = sum(p.x_advance for p in b.glyph_positions)
    x0 = {"center": x - total * s / 2, "right": x - total * s, "left": x}[align]
    glyphs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    pen = SVGPathPen(glyphs, lambda v: ("%.1f" % v).rstrip("0").rstrip("."))
    cx = 0
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        # محور y بالخط لفوق وبالـSVG لتحت، فنقلبه
        t = TransformPen(pen, (s, 0, 0, -s, x0 + (cx + pos.x_offset) * s, baseline - pos.y_offset * s))
        glyphs[order[info.codepoint]].draw(t)
        cx += pos.x_advance
    return pen.getCommands()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("text")
    ap.add_argument("--size", type=float, required=True)
    ap.add_argument("--x", type=float, required=True)
    ap.add_argument("--y", type=float, required=True)
    ap.add_argument("--wght", type=float, default=800)
    ap.add_argument("--align", default="center", choices=["center", "left", "right"])
    a = ap.parse_args()
    print(text_path(a.font, a.text, a.size, a.x, a.y, a.align, a.wght))
