
$filePath = "c:\Users\Duy Tan\Desktop\Thanh Tai\DHSP-HK1-25-26\web_app_hoc_tieng_trung\frontend-nextjs\src\components\common\WordPopover.tsx"
$content = Get-Content $filePath

# 1. Sync Pinyin (using 1-indexed lines from view_file: lines 1324-1332)
# In 0-indexed array, this is 1323..1331
$pinyinTargetStart = 1325 # index in 0-indexed array (line 1326)
$pinyinTargetEnd = 1328 # index in 0-indexed array (line 1329)
$content[$pinyinTargetStart..$pinyinTargetEnd] = "                                                                    const val = e.target.value;`n                                                                    const newTokens = [...editingTokens];`n                                                                    newTokens[selectedTokenIndex].pinyin = val;`n                                                                    setEditingTokens(newTokens);`n                                                                    if (newTokens[selectedTokenIndex].hanzi === word) {`n                                                                        setEditPinyin(val);`n                                                                    }"

# 2. Sync Meaning (lines 1338-1342 in 0-indexed array)
# Line 1339 is index 1338
$meaningTargetStart = 1338 # index in 0-indexed array (line 1339)
$meaningTargetEnd = 1341 # index in 0-indexed array (line 1342)
$content[$meaningTargetStart..$meaningTargetEnd] = "                                                                    const val = e.target.value;`n                                                                    const newTokens = [...editingTokens];`n                                                                    newTokens[selectedTokenIndex].meaning = val;`n                                                                    setEditingTokens(newTokens);`n                                                                    if (newTokens[selectedTokenIndex].hanzi === word) {`n                                                                        setEditMeaning(val);`n                                                                    }"

# 3. Add checkbox before button
$newContent = @()
$checkbox = "                                            <div `n                                                className=`"flex items-center gap-2 p-2 px-3 bg-primary/5 border border-primary/20 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors mb-2`"`n                                                onClick={() => setSaveToGlobal(!saveToGlobal)}`n                                            >`n                                                <div className={`size-4 rounded border flex items-center justify-center transition-colors ${saveToGlobal ? 'bg-primary border-primary' : 'border-border-color bg-surface-dark'}`}>`n                                                    {saveToGlobal && <Icon name=`"check`" size=`"xs`" className=`"text-black`" />}`n                                                </div>`n                                                <span className=`"text-xs font-bold text-primary`">Cập nhật vào Từ điển chung (Global)</span>`n                                            </div>"

foreach ($line in $content) {
    if ($line -match "variant=`"primary`"" -and $line -match "onClick={handleSaveSubtitle}") {
        $newContent += $checkbox
    }
    $newContent += $line
}

$newContent | Set-Content $filePath -Encoding UTF8
