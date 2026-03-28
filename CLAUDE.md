# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**分數星際大作戰** — 國小四年級學生的分數卡牌對戰遊戲。
單一 HTML 檔案，無框架、無後端、無建置步驟，直接用瀏覽器開啟即可。

**GitHub Pages：** https://alvicss.github.io/fraction-star-battle/

## 執行方式

直接用瀏覽器開啟 `index.html`，無需任何建置或伺服器。

## 檔案結構

```
index.html          # 主遊戲（所有 CSS + HTML + JS 全在一個檔案）
SPEC.md             # 功能規格文件（詳細設計說明）
README.md           # 專案說明（GitHub 用）
audio/              # 所有音效（英文檔名，避免 URL 編碼問題）
  intro-bgm.mp3     # 開場三畫面 BGM（loop）
  battle-bgm.mp3    # 對戰畫面 BGM（loop）
  stage-clear.mp3   # 勝利結算 BGM（loop）
  stage-fail.mp3    # 失敗結算 BGM（loop）
  correct.mp3       # 每題答對音效
  wrong.mp3         # 每題答錯音效
  card-play.mp3     # 點擊互動音效
picture/            # 所有圖片（英文檔名）
  monster.png
  swordsman.png
  mage.png
  archer.png
```

> **注意：** 所有 audio/ 與 picture/ 檔名必須使用英文，避免 GitHub Pages URL 編碼問題。

## 架構說明

### HTML 五個畫面（screen）

| ID | 說明 |
|---|---|
| `screenIntro` | 開場，按鈕進入腳色選擇 |
| `screenCharSelect` | 腳色選擇（劍士 / 魔法師 / 弓箭手）|
| `screenLevelSelect` | 關卡選擇（5個關卡） |
| `screenBattle` | 對戰主畫面 |
| `screenResult` | 結算 |

以 `.screen.active` 控制顯示，`showScreen(id)` 切換。

### JS 模組區段（以 `// ====` 分隔）

| 區段 | 關鍵函式 |
|---|---|
| SOUND | `playSound(type)`, `toggleSound()`, `toggleBGM()`, `playBGM()`, `playBattleBGM()`, `playResultSound(stars)` |
| UTILITY | `gcd`, `reduceFrac`, `toMixed`, `mixedToImproper`, `addFrac`, `subFrac`, `mulFrac` |
| FRACTION RENDERER | `fracHTML`, `mixedHTML`, `cardDisplayHTML`, `formatAns` |
| CARD GENERATOR | `genProperCard`, `genImproperCard`, `genMixedCard`, `genIntegerCard`, `genFracCard`, `genPlayerCards`, `genLevel5Cards`, `genLevel5MulCards` |
| GAME STATE | `const state = { ... }` — 所有執行期狀態，含 `selectedChar` |
| STORAGE | `saveStars`, `getStars`, `loadStarDisplay`（localStorage key: `fractionBattle`）|
| UI CONTROLLER | `showScreen`, `updateHP`, `updateRoundLabel`, `showFeedback` |
| MONSTER DIALOG | `DIALOGS` 物件 + `showMonsterDialog(type)` |
| RENDER HANDS | `renderCardInner`, `renderPlayerHand(slotsUsed)` |
| BATTLE FLOW | `startBattle(level)`, `nextRound()`, `onPlayerCardClick(idx)` |
| 關卡 1/2/3 | `setupCalcUI`, `onCalcCardPick`, `checkCalcAnswer`, `showCalcHint` |
| 關卡 4 | `setupLevel4UI`, `onLevel4CardPick`, `checkLevel4(sym)` |
| 關卡 5 | `setupLevel5UI`, `onLevel5CardClick`, `onLv5SlotClear`, `refreshLv5Slot`, `checkLevel5` |
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
  怪獸牌揭曉（自動）
        ↓
  玩家輸入答案 / 選符號 → check 函式 → 更新 HP → nextRound()
```

### 答案驗證（關卡1/2/3）

允許等值約分，禁止假分數作答：

```javascript
const sameValue   = (userTotal * ans.d === ansTotal * d);
const hasImproper = (n > 0 && n >= d);
const isCorrect   = sameValue && !hasImproper;
```

### localStorage 格式

```json
{ "lv1": 3, "lv2": 2, "lv3": 0, "lv4": 1, "lv5": 0 }
```

## GitHub Pages 注意事項

- 所有資源檔名必須使用**英文**（無中文、無空格）
- 主入口為 `index.html`（GitHub Pages 預設）
- 部署分支：`master`，目錄：根目錄（`/`）
