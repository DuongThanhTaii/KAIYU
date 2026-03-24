
import os

path = r"c:\Users\Duy Tan\Desktop\Thanh Tai\DHSP-HK1-25-26\web_app_hoc_tieng_trung\frontend-nextjs\src\components\common\WordPopover.tsx"

with open(path, 'rb') as f:
    raw = f.read()

# We know the file is UTF-8 with BOM. If we see "corrupted" characters in a UTF-8 viewer,
# it means someone wrote UTF-8 bytes but THEY WERE INTERPRETED AS ISO-8859-1 during the write process.
# This results in "Double UTF-8 encoding" or similar.

# Let's try to just replace the known corrupted sequences.
# Example: 'Nghĩa' in UTF-8 is 'Ngh\xc4\xa9a'
# If it shows as 'NghÄ©a', it means \xc4\xa9 was written as individual characters.

replacements = {
    'NghÄ©a': 'Nghĩa',
    'tiáº¿ng': 'tiếng',
    'Viá»‡t': 'Việt',
    'Ä‘á»•i': 'đổi',
    'á»Ÿ': 'ở',
    'chá»‰': 'chỉ',
    'Ã¡p': 'áp',
    'dá»¥ng': 'dụng',
    'nÃ y': 'này',
    'Há»‡': 'Hệ',
    'thá»‘ng': 'thống',
    'sáº½': 'sẽ',
    'bá» ': 'bỏ',
    'phÃ¢n': 'phân',
    'Ä‘oáº¡n': 'đoạn',
    'tá»±': 'tự',
    'Ä‘á»™ng': 'động',
    'nÇ ': 'nǐ',
    'hÇŽo': 'hǎo',
    'Danh tá»«': 'Danh từ',
    'Ä á»™ng tá»«': 'Động từ',
    'tá»«': 'từ'
}

# Actually, the most robust way is to read it as UTF-8, 
# then if it contains these weird patterns, we fix them.
# But wait, if I read it as UTF-8 and it shows 'Ä©', it means the bytes are \xc3\x84\xc2\xa9.
# The original 'ĩ' was \xc4\xa9.
# So \xc4 was turned into \xc3\x84 and \xa9 was turned into \xc2\xa9.

# Let's just do bulk string replacement on the UTF-8 content.
content = raw.decode('utf-8-sig')

for old, new in replacements.items():
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("Successfully repaired encoding and characters in WordPopover.tsx")
