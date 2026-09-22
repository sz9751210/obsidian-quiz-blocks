# Quiz Blocks [![plugin](https://img.shields.io/github/v/release/xamgore/obsidian-quiz-blocks?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet)](https://obsidian.md/plugins?id=quiz-blocks)

> 📖 **English version**: [README.md](README.md)

在 Obsidian 筆記中，將 ` ```quiz ` 程式碼區塊渲染為可互動的測驗題。


## 運作方式

以帶有 `quiz` 標籤的 YAML 程式碼區塊描述一道題目，插件會將其轉換為完整的互動表單。依照題型不同，可單選或多選 `options`。按下 **Check** 按鈕後，正確、錯誤與遺漏的答案會以高亮標示，並顯示選填的 `feedback` 解析——非常適合自學與製作學習筆記。


## 快速插入題目

在編輯器中，於**獨立空白行**輸入 `quiz:`，用方向鍵選擇題型後按 **Enter**，完整的 YAML 區塊會自動展開並預選題目文字，讓你直接開始編輯。也可從指令面板執行 **Insert quiz template**。

| 快速語法 | 題型 |
|---|---|
| `quiz:radio`（也接受 `quiz:ratio`） | 單選題 |
| `quiz:checkbox` | 多選題 |
| `quiz:text` | 自由作答 |
| `quiz:prompt` | 填空題（以 `==答案==` 標記空格） |
| `quiz:choice` | 下拉配對 |
| `quiz:noodle` | 連線配對 |

這些捷徑是**編輯時展開範本的觸發詞**，需選取建議項目才會插入，並非新的 Markdown 區塊格式。在 YAML 屬性、程式碼區塊或一般句子中不會觸發。

開啟 **設定 → Quiz Blocks** 可切換快速插入功能、選擇顯示樣式（預設／卡片／精簡），以及設定新範本是否預設打亂選項或隱藏題目。樣式立即套用；範本預設只影響之後插入或複製的題目。設定頁面提供六種可互動的範本預覽、完整語法說明，以及**複製**與**插入至筆記**按鈕。


## 從筆記或標籤開始測驗

1. 從指令面板執行 **Quiz Blocks: Start quiz from note or tag**，或點擊側邊欄的清單圖示。
2. 選擇 **Note（筆記）** 搜尋單一筆記，或選擇 **Tag（標籤）** 跨筆記收集題目。
3. 確認找到的題目數量後，點擊 **Start quiz**。
4. 依序作答並按 Check 確認，然後選擇 **Next question** 或 **Finish**，也可以跳過題目。

題庫以現有的 `quiz` 圍欄區塊為來源，不會從一般文字自動產生題目。標籤同時讀取筆記屬性（properties）與內文標籤。選取 `#study` 也會包含 `#study/history`，但不含 `#study-guide`。每個區塊為一道題目步驟，含多個配對小題的區塊亦同。

題目依筆記路徑與區塊順序排列。格式錯誤的區塊會回報並略過。連結與圖片依原始筆記的相對路徑解析。測驗不儲存作答或分數；關閉對話框即結束。Gated（遮蔽）區塊在測驗中會直接開啟。


## 支援的題型

### `radio` — 單選題

<img src=".github/demo-radio.png" width="430" alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: radio
content: >-
    When you are merging onto the freeway, you should be driving:

options:
- content: 5 to 10 MPH slower than the traffic on the freeway.
  feedback: When merging onto the freeway if you are travelling slower than the traffic around you, other drivers will have to brake or change lanes in order to allow you to enter the flow of traffic. This could cause drivers to make sudden changes which may cause accidents.

- content: The posted speed limit for traffic on the freeway
  feedback: The posted limit for any roadway is a limit and may not be a safe speed for traffic under current conditions. When merging into traffic, the most important thing is to be travelling at approximately the same speed as those around you so that you can join the flow of traffic with the least disruption.

- content: At or near the same speed as the traffic on the freeway.
  feedback: If you are driving at or near the speed of traffic around you, you will be able to merge into the right hand land with minimal disruption to the flow of traffic around you.
  correct: true
```
````

</details>

### `checkbox` — 多選題

<img src=".github/demo-checkbox.png" width="430" alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: checkbox
content: >-
  When do you call the police?

options:
- content: You witnessed a crime.
  correct: true
- content: You got an injury.
- content: Somebody else got an injury.
  correct: true
- content: You need a pizza.
  feedback: Very funny.
- content: You've seen a suspect.
```
````

</details>

### `choice` — 多題共用選項的下拉配對

<img src=".github/demo-choice.png" width="430" alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: choice
content: >-
  Answer the following questions with one of: true, false, unknown.

options:
- id: true
  content: True.
- id: false
  content: False.
- id: unknown
  content: Unknown.

questions:
- content: Coconut may have bisexual flowers.
  correct_option: true
- content: 1970 is the year when George Washington delivered the first State of the Union.
  correct_option: true
- content: The hell exists.
  correct_option: unknown
```
````

</details>

### `noodle` — 連線配對

<img src=".github/demo-noodle.png" width=430 alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: noodle
content: >-
  Connect each country with its capital.

options:
- content: Moscow
- content: Paris
- content: Oslo
- content: Kiev

questions:
- content: France
  correct: Paris

- content: Norway
  correct: Oslo

- content: Ukraine
  correct: Kiev
```
````

</details>

### `text` — 自由作答（無強制驗證）

<img src=".github/demo-text.png" width=430 alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: text
content: >-
    Should you believe in God?

# 按下 [Check] 後顯示的參考答案（選填）
correct: >-
    Well, there is no the right answer here, as it's all personal.
```
````

</details>

### `prompt` — 填空題

<img src=".github/demo-prompt.png" width=430 alt="" />

<details><summary>顯示範例程式碼</summary>

````yaml
```quiz
type: prompt
content: |-
	The chemical symbol for water is ==H²O==.

	It freezes at ==0°C== under standard atmospheric pressure.

# 按下 [Check] 後顯示的解析（選填）
feedback: >-
  Use ==double equals== to hide text until you reveal the answer.
```
````

</details>


## 功能說明

#### `shuffle: true`

每次渲染時**打亂選項順序**，避免記住答案位置。預設值：`false`。

#### `gated: true`

**遮蔽筆記內容**，直到完成或關閉測驗為止，適合閉書測驗與主動回憶練習。預設值：`false`。


## 安裝方式

### 從 Obsidian 社群外掛安裝 *(審核中)*

**Quiz Blocks** 目前正等待加入 Obsidian 官方社群外掛清單。在此之前，可透過 BRAT 或手動方式安裝。

#### 使用 BRAT 安裝（推薦 Beta 測試）

<details><summary>展開步驟</summary>

1. 從社群外掛瀏覽器安裝 **BRAT**，或直接點擊：https://obsidian.md/plugins?id=obsidian42-brat
   - 點擊 **Install**，再點擊 **Enable**。
2. 開啟 **設定 → BRAT**。
3. 點擊 **Add Beta plugin**。
4. 貼上此儲存庫網址：
   ```
   https://github.com/xamgore/obsidian-quiz-blocks
   ```
5. 點擊 **Add plugin**。
6. 前往 **設定 → 社群外掛**，啟用 **Quiz Blocks**。

</details>

#### 手動安裝（從 GitHub）

<details><summary>展開步驟</summary>

1. 從 [GitHub Releases 頁面](https://github.com/xamgore/obsidian-quiz-blocks/releases) 下載 `obsidian-quiz-blocks.zip`。
2. 解壓縮 ZIP 檔。
3. 將解壓縮後的資料夾複製到 Vault 的外掛目錄：`YOUR_VAULT/.obsidian/plugins/`
4. 重新啟動 Obsidian，或前往 **設定 → 社群外掛** 點擊 **Reload plugins**。
5. 從清單中啟用 **Quiz Blocks**。

</details>

#### ~~直接連結安裝~~ / ~~從社群外掛瀏覽器安裝~~

<details><summary>展開步驟</summary>

這兩種方式需等外掛通過審核後才能使用。

1. 點擊 https://obsidian.md/plugins?id=quiz-blocks
2. 點擊 **Install**，再點擊 **Enable**。

</details>

### 本機開發部署

在終端機執行互動式部署精靈：

```bash
./auto-deploy.sh
# 或
npm run deploy
```

精靈流程：
1. **選擇 Vault** — 自動列出所有 Obsidian 已登記的 Vault，用方向鍵選擇，或手動輸入路徑。
2. **選擇建置方式** — 重新編譯（建議）或直接部署現有產物。
3. **記住 Vault 路徑**（選填）— 下次執行時自動選取。
4. **確認摘要** — 顯示目標路徑與方式後才寫入檔案。

按 `↑` / `↓` 導覽，`Enter` 確認，`q` 或 `Ctrl+C` 取消。

非互動／CI 模式：

```bash
./auto-deploy.sh --vault "/path/to/your/vault"
./auto-deploy.sh --vault "/path/to/your/vault" --skip-build
```

若要設定固定的預設 Vault，將 `.quiz-blocks-dev.example.json` 複製為 `.quiz-blocks-dev.json` 並修改 `vaultPath`。此檔案已加入 `.gitignore`。Vault 解析順序：`--vault` 旗標 → `DEMO_VAULT` 環境變數 → `.quiz-blocks-dev.json`。

腳本只會覆蓋 `.obsidian/plugins/quiz-blocks/` 內的 `main.js`、`styles.css`、`manifest.json`，你的 `data.json` 與筆記內容完全不受影響。完成後，在 Obsidian「設定 → 社群外掛」啟用 Quiz Blocks；若已啟用，關閉後重新開啟即可載入新版本。


## 注意事項與限制

本插件仍處於早期階段，可能存在 Bug，歡迎 [提交 Issue](https://github.com/xamgore/obsidian-quiz-blocks/issues/new/choose) 分享回饋。

- YAML 編輯器中無語法高亮（投票支持 [#3](https://github.com/xamgore/obsidian-quiz-blocks/issues/3)）。
- 欄位遺漏時的錯誤提示可能不夠清楚（投票支持 [#4](https://github.com/xamgore/obsidian-quiz-blocks/issues/4)）。
- 作答結果為暫存性質，僅保留至分頁關閉為止。如需持久保存，投票支持 [#2](https://github.com/xamgore/obsidian-quiz-blocks/issues/2)。
- `instant`（即時回饋）模式尚未實作。
- 規劃中的題型：`cards`（卡片式翻閱）。


## 開發動機

以下是 Obsidian 社群中反覆出現的測驗功能需求，也是開發本插件的動機。

> [@amcasas:](https://forum.obsidian.md/t/quiz-type-plugin/2237) need some type of quiz function that you can add at the end of each note

> [@deleted:](https://www.reddit.com/r/ObsidianMD/comments/1ns1g7z/making_mcq_questions_in_obsidian/)
> in such a way that a maximum of one option is choosable for each question.

> [@30DayThrill:](https://www.reddit.com/r/ObsidianMD/comments/17lcsvf/quizzing_plugin_strategies_for_obsidian/)
> looking for a quizlet-esque solution where I can create more multiple choice or question and answer style tests.

如果這個插件對你有幫助，歡迎分享給其他人，或幫 Repository 點個星&nbsp;⭐️

<br>
<br>
