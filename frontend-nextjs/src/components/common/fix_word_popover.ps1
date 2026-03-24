
$path = "c:\Users\Duy Tan\Desktop\Thanh Tai\DHSP-HK1-25-26\web_app_hoc_tieng_trung\frontend-nextjs\src\components\common\WordPopover.tsx"

# Read with UTF8 encoding to handle BOM correctly
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Fix the corrupted strings if any (optional, but let's just do the new replacements)

# 2. Sync Pinyin in subtitle editor
$oldPinyin = 'newTokens\[selectedTokenIndex\]\.pinyin = e\.target\.value;'
$newPinyin = 'const val = e.target.value; newTokens[selectedTokenIndex].pinyin = val; if (newTokens[selectedTokenIndex].hanzi === word) { setEditPinyin(val); }'
$content = $content -replace $oldPinyin, $newPinyin

# 3. Sync Meaning in subtitle editor
$oldMeaning = 'newTokens\[selectedTokenIndex\]\.meaning = e\.target\.value;'
$newMeaning = 'const val = e.target.value; newTokens[selectedTokenIndex].meaning = val; if (newTokens[selectedTokenIndex].hanzi === word) { setEditMeaning(val); }'
$content = $content -replace $oldMeaning, $newMeaning

# 4. Add checkbox before the button
# We search for the button's unique pattern
$btnPattern = '(<Button\s+variant="primary"\s+className="w-full py-3"\s+onClick={handleSaveSubtitle})'
$checkboxHtml = '                                            <div 
                                                className="flex items-center gap-2 p-2 px-3 bg-primary/5 border border-primary/20 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors mb-2"
                                                onClick={() => setSaveToGlobal(!saveToGlobal)}
                                            >
                                                <div className={`size-4 rounded border flex items-center justify-center transition-colors ${saveToGlobal ? "bg-primary border-primary" : "border-border-color bg-surface-dark"}`}>
                                                    {saveToGlobal && <Icon name="check" size="xs" className="text-black" />}
                                                </div>
                                                <span className="text-xs font-bold text-primary">Cập nhật vào Từ điển chung (Global)</span>
                                            </div>

                                            $1'

$content = $content -replace $btnPattern, $checkboxHtml

# Write back as UTF8 with BOM to maintain compatibility
$utf8WithBom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($path, $content, $utf8WithBom)
