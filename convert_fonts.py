import sys
from pathlib import Path
sys.path.insert(0, str(Path('work/font-tools').resolve()))
from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import WOFF2FlavorData

root = Path('outputs/rinmincho')
for weight in ('Regular', 'Bold'):
    source = root / f'RinMincho-{weight}.ttf'
    target = root / f'TanpenWebMincho-{weight}.woff2'
    font = TTFont(source, recalcTimestamp=False)
    # Rename the web derivative; retain all copyright/license/author records.
    names = {1: 'Tanpen Web Mincho', 2: weight,
             3: f'Tanpen Web Mincho {weight} 1.0',
             4: f'Tanpen Web Mincho {weight}',
             6: f'TanpenWebMincho-{weight}',
             16: 'Tanpen Web Mincho', 17: weight}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.flavor = 'woff2'
    font.flavorData = WOFF2FlavorData(transformedTables=set())
    font.save(target, reorderTables=False)
    original = TTFont(source, recalcTimestamp=False)
    converted = TTFont(target, recalcTimestamp=False)
    assert original.getBestCmap() == converted.getBestCmap()
    assert original.getGlyphOrder() == converted.getGlyphOrder()
    for tag in original.keys():
        if tag not in ('GlyphOrder', 'name', 'head'):
            assert original.getTableData(tag) == converted.getTableData(tag), tag
    for name_id in (0, 7, 8, 9, 11, 13, 14):
        a = [(n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in original['name'].names if n.nameID == name_id]
        b = [(n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in converted['name'].names if n.nameID == name_id]
        assert a == b, name_id
    print(f'{target.name}: {source.stat().st_size} -> {target.stat().st_size} bytes; glyphs and shaping tables verified')
