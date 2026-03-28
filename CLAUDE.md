# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**分數星際大作戰** — 國小四年級學生的分數卡牌對戰遊戲。
單一 HTML 檔案，無框架、無後端、無建置步驟，直接用瀏覽器開啟即可。

## 執行方式

直接用瀏覽器開啟 `cld_fraction-battle.html`，無需任何建置或伺服器。
音效依賴相對路徑 `../4下分數/audio/ok.mp3` 與 `../4下分數/audio/what.mp3`（不影響遊戲邏輯，只影響音效）。

## 檔案結構

```
cld_fraction-battle.html   # 主遊戲（所有 CSS + HTML + JS 全在一個檔案）
SPEC.md                    # 功能規格文件（詳細設計說明）
click-sound-util.js        # 音效輔助工具（目前未整合入主檔）
fraction-bgm.js            # 背景音樂工具（目前未整合入主檔）
```

## 架構說明

### HTML 四個畫面（screen）

| ID | 說明 |
|---|---|
| `screenIntro` | 開場，按鈕進入關卡選擇 |
| `screenLevelSelect` | 關卡選擇（5個關卡） |
| `screenBattle` | 對戰主畫面 |
| `screenResult` | 結算 |

以 `.screen.active` 控制顯示，`showScreen(id)` 切換。

### JS 模組區段（以 `// ====` 分隔）

| 區段 | 關鍵函式 |
|---|---|
| SOUND | `playSound(type)`, `toggleSound()` |
| UTILITY | `gcd`, `reduceFrac`, `toMixed`, `mixedToImproper`, `addFrac`, `subFrac`, `mulFrac` |
| FRACTION RENDERER | `fracHTML`, `mixedHTML`, `cardDisplayHTML`, `formatAns` |
| CARD GENERATOR | `genProperCard`, `genImproperCard`, `genMixedCard`, `genIntegerCard`, `genFracCard`, `genPlayerCards`, `genLevel5Cards` |
| GAME STATE | `const state = { ... }` — 所有執行期狀態 |
| STORAGE | `saveStars`, `getStars`, `loadStarDisplay`（使用 localStorage key `fractionBattle`）|
| UI CONTROLLER | `showScreen`, `updateHP`, `updateRoundLabel`, `showFeedback` |
| MONSTER DIALOG | `DIALOGS` 物件 + `showMonsterDialog(type)` |
| RENDER HANDS | `renderCardInner`, `renderPlayerHand(slotsUsed)` |
| BATTLE FLOW | `startBattle(level)`, `nextRound()`, `onPlayerCardClick(idx)` |
| 關卡 1/2/3 | `setupCalcUI`, `onCalcCardPick`, `checkCalcAnswer`, `showCalcHint` |
| 關卡 4 | `setupLevel4UI`, `onLevel4CardPick`, `checkLevel4(sym)` |
| 關卡 5 | `setupLevel5UI`, `onLevel5CardClick`, `refreshLv5Slot`, `checkLevel5` |
| END BATTLE | `endBattle`, `restartBattle` |

### 遊戲流程（每局）

```
nextRound()
  ├─ 生成 state.d（分母 2~9）
  ├─ genPlayerCards(d) → state.playerCards（4張）
  ├─ genFracCard(d) 或 genIntegerCard() → state.monsterPlayedCard
  └─ setupXxxUI() → 填入 #battleCenter 的動態 HTML
        ↓
  玩家點手牌 → onPlayerCardClick(idx) → 分派到各關卡處理函式
        ↓
  怪獸牌揭曉（自動，非玩家操作）
        ↓
  玩家輸入答案 / 選符號 → check 函式 → 更新 HP → nextRound()
```

### 各關卡機制重點

| 關卡 | 說明 |
|---|---|
| 1（加法）| 玩家選牌 → 怪獸牌自動出 → `[玩家] + [怪獸] = ?` → 輸入帶分數答案 |
| 2（減法）| 同上，較大的牌自動放左側 → `[大] - [小] = ?` |
| 3（乘法）| 玩家有4張分數牌，怪獸出整數牌 → `[分數] × [整數] = ?`；答錯不扣玩家血（鼓勵模式）|
| 4（比大小）| 玩家先選牌（鎖定），怪獸後出 → 玩家按 `＞` `＝` `＜` 判斷 |
| 5（雙星）| 怪獸先亮牌；玩家4張牌個別都 < 怪獸；隨機 + 或 × 符號；選兩張讓結果 > 怪獸 |

### 答案驗證（關卡1/2/3）

允許等值約分，禁止假分數作答：

```javascript
const userTotal   = w * d + n;          // 使用者輸入轉假分數分子
const ansTotal    = ans.whole * ans.d + ans.n;
const sameValue   = (userTotal * ans.d === ansTotal * d);  // 交叉相乘避免浮點誤差
const hasImproper = (n > 0 && n >= d);
const isCorrect   = sameValue && !hasImproper;
```

### 同分母保證

關卡1/2/3的加減法 `addFrac`/`subFrac` 假設 `f1.d === f2.d`（同局分母相同）。
`addFrac(f1, f2)` = `reduceFrac(f1.n + f2.n, f1.d)`，不做通分。

### CSS 佈局

對戰畫面採橫向三欄：
```
battle-top（血量列）
battle-mid:
  monster-panel（左，固定寬 90px）| battle-center（中，flex:1，動態填入題目）
battle-bottom（玩家手牌，橫向排列）
```

`#battleCenter` 的內容由各 `setupXxxUI()` 動態生成，不同關卡結構不同。

### localStorage 格式

```json
{ "lv1": 3, "lv2": 2, "lv3": 0, "lv4": 1, "lv5": 0 }
```

值 0~3 代表星星數，只在突破最高紀錄時更新。
