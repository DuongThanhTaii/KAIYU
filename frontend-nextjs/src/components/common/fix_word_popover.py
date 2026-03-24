
import os
import re

path = r"c:\Users\Duy Tan\Desktop\Thanh Tai\DHSP-HK1-25-26\web_app_hoc_tieng_trung\frontend-nextjs\src\components\common\WordPopover.tsx"

with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# 1. Sync Pinyin in subtitle editor
# Old: newTokens[selectedTokenIndex].pinyin = e.target.value;
# New: const val = e.target.value; newTokens[selectedTokenIndex].pinyin = val; if (newTokens[selectedTokenIndex].hanzi === word) { setEditPinyin(val); }
old_pinyin = r'newTokens\[selectedTokenIndex\]\.pinyin = e\.target\.value;'
new_pinyin = 'const val = e.target.value; newTokens[selectedTokenIndex].pinyin = val; if (newTokens[selectedTokenIndex].hanzi === word) { setEditPinyin(val); }'
content = re.sub(old_pinyin, new_pinyin, content)

# 2. Sync Meaning in subtitle editor
old_meaning = r'newTokens\[selectedTokenIndex\]\.meaning = e\.target\.value;'
new_meaning = 'const val = e.target.value; newTokens[selectedTokenIndex].meaning = val; if (newTokens[selectedTokenIndex].hanzi === word) { setEditMeaning(val); }'
content = re.sub(old_meaning, new_meaning, content)

# 3. Add checkbox before the button
checkbox_html = '''                                            <div 
                                                className="flex items-center gap-2 p-2 px-3 bg-primary/5 border border-primary/20 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors mb-2"
                                                onClick={() => setSaveToGlobal(!saveToGlobal)}
                                            >
                                                <div className={`size-4 rounded border flex items-center justify-center transition-colors ${saveToGlobal ? "bg-primary border-primary" : "border-border-color bg-surface-dark"}`}>
                                                    {saveToGlobal && <Icon name="check" size="xs" className="text-black" />}
                                                </div>
                                                <span className="text-xs font-bold text-primary">Cập nhật vào Từ điển chung (Global)</span>
                                            </div>

'''
# Find the button and insert before it
pattern = r'(\s+<Button\s+variant="primary"\s+className="w-full py-3"\s+onClick=\{handleSaveSubtitle\})'
content = re.sub(pattern, lambda m: checkbox_html + m.group(1), content)

with open(path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("Successfully updated WordPopover.tsx")
