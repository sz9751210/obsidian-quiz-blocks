# Quiz blocks [![plugin](https://img.shields.io/github/v/release/xamgore/obsidian-quiz-blocks?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet)](https://obsidian.md/plugins?id=quiz-blocks)

Render ` ```quiz ` code blocks into interactive multiple-choice quizzes directly inside Obsidian notes.


## How it works

You basically describe a quiz with a YAML code block.
The plugin transforms it into a nice interactive form.
Depending on the quiz type, one or multiple `options` can be selected.
There is a **Check** button that highlights right, wrong, and missed answers,
with optional `feedback` commentary. Great for self-education and learning notes.


## 快速建立題目與設定

在筆記編輯模式的**獨立空白行**輸入 `quiz:`，使用方向鍵選擇題型後按 Enter，就會展開完整的 `quiz` YAML 區塊並選取題目文字，讓你直接改題。也可從指令面板執行 **Insert quiz template**，原有的各題型插入指令仍可使用。

| 快速語法 | 題型 |
| --- | --- |
| `quiz:radio`（也接受 `quiz:ratio`） | 單選題 |
| `quiz:checkbox` | 多選題 |
| `quiz:text` | 簡答題 |
| `quiz:prompt` | 填空題，用 `==答案==` 標記空格 |
| `quiz:choice` | 下拉配對題 |
| `quiz:noodle` | 連線配對題 |

這些是**編輯時展開範本的捷徑**，必須選取建議項目才會插入；不是新的 Markdown 區塊格式。在 YAML 屬性、程式碼區塊或一般句子內不會觸發。

開啟 **設定 → Quiz blocks**，可切換快速語法、選擇預設／卡片／精簡樣式，並設定新範本是否打亂選項或隱藏題目。樣式立即套用；範本預設只影響之後插入或複製的題目。設定頁提供六種可直接作答的範本、互動預覽、完整語法、複製及插入目前筆記按鈕。每個範本都已附上有效的範例答案，請依自己的題目修改。

設定分成 **一般設定**、**外觀**、**範本** 三個分頁，首次開啟顯示外觀。「外觀」的樣式選單下方提供即時互動預覽，可切換六種題型並試答；調整樣式時保留試答狀態。「範本」集中提供複製、插入及完整語法。切換分頁或題型會重設預覽作答，分頁可用左右方向鍵切換。

## Start a quiz from a note or tag

1. Run **Quiz blocks: Start quiz from note or tag** from the command palette, or click the checklist ribbon icon.
2. Choose **Note** to search for a single note, or **Tag** to collect quizzes across matching notes.
3. Review the number of quiz blocks found, then click **Start quiz**.
4. Answer and check each quiz as usual, then choose **Next question** or **Finish**. You can also skip a question.

The bank uses existing fenced `quiz` blocks; it does not generate questions from ordinary prose. Tags come from both note properties and inline tags. Selecting `#study` also includes `#study/history`, but not `#study-guide`. Each block is one quiz step, including blocks containing multiple matching questions.

Questions follow note-path and block order. Invalid blocks are reported and skipped. Links and images resolve relative to the original note. Sessions do not save answers or scores; closing the dialog ends the session. Gated blocks open directly during a session.

## Supported quiz types

### `radio` — single correct option

<img src=".github/demo-radio.png" width="430" alt="" />

<details><summary>show code</summary>

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

### `checkbox` — multiple correct options

<img src=".github/demo-checkbox.png" width="430" alt="" />

<details><summary>show code</summary>

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

### `choice` — multiple questions sharing the same options

<img src=".github/demo-choice.png" width="430" alt="" />

<details><summary>show code</summary>

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
  content: Unkonwn.

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

### `noodle` — multiple questions connected with options

<img src=".github/demo-noodle.png" width=430 alt="" />

<details><summary>show code</summary>

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

### `text` — free text without forced validation

<img src=".github/demo-text.png" width=430 alt="" />

<details><summary>show code</summary>

````yaml
```quiz
type: text
content: >-
    Should you believe in God?

# optional reference answer shown after pressing [Check]
correct: >-
    Well, there is no the right answer here, as it's all personal.
```
````

</details>

### `prompt` — fill in the ==gaps==

<img src=".github/demo-prompt.png" width=430 alt="" />

<details><summary>show code</summary>

````yaml
```quiz
type: prompt
content: |-
	The chemical symbol for water is ==H²O==.

	It freezes at ==0°C== under standard atmospheric pressure.

# optional feedback shown after pressing [check]
feedback: >-
  Use ==double equals== to hide text until you reveal the answer.
```
````

</details>

## Installation

### 開發部署至本機 Obsidian Vault

參考 LifeOS 的部署方式，一次完成編譯與複製插件檔案。先安裝專案依賴，再執行：

直接在終端機執行 `./auto-deploy.sh` 或 `npm run deploy`，即可進入中文互動精靈：選擇目前設定或 Obsidian 已登記的 Vault（也可手動輸入）→ 選擇重新編譯／現有產物 → 是否記住路徑 → 確認部署。支援空白與 `~/` 路徑；輸入 `q` 或按 Ctrl+C 可取消。只有部署成功後才儲存選擇。

`npm run deploy:interactive` 可明確啟動互動模式。帶有 `--vault` 等參數，或在沒有互動終端機的環境執行時，沿用下方的非互動部署方式：

```bash
npm run deploy -- --vault "/path/to/your/vault"
# 或使用與 LifeOS 相同的 shell 入口
./auto-deploy.sh --vault "/path/to/your/vault"
```

若要固定部署位置，將 `.quiz-blocks-dev.example.json` 複製為 `.quiz-blocks-dev.json`，修改 `vaultPath`，之後只需執行 `./auto-deploy.sh` 或 `npm run deploy`。本機設定檔不會提交到 Git。

也支援 `DEMO_VAULT="/path/to/vault" npm run deploy:demo`。路徑優先順序為 `--vault` → `DEMO_VAULT` → 本機設定檔；相對路徑以專案根目錄為準，支援 `~/`。目標 Vault 必須已存在。

預設會重新編譯；加上 `--skip-build` 可部署已有產物。腳本只覆蓋 `.obsidian/plugins/quiz-blocks/` 中的 `main.js`、`styles.css`、`manifest.json`，保留 `data.json` 與筆記。完成後，在 Obsidian「設定 → 社群外掛」啟用 Quiz blocks，或關閉後重新開啟以載入新版。

**Quiz Blocks** is currently waiting for approval to appear in the official Obsidian Community Plugins list.
Until then, it can be installed and automatically updated using **BRAT** or manually.

#### Install using BRAT (beta-channel)

<details><summary>show steps</summary>

1. Install the **BRAT** plugin:
	* Using the link: https://obsidian.md/plugins?id=obsidian42-brat
      * Click **Install**, then **Enable**
    * Manually:
      * Open **Settings → Community plugins → Browse**
      * Search for **BRAT**
      * Click **Install**, then **Enable**
2. Open **Settings → BRAT**.
3. Click **Add Beta plugin**.
4. Paste this repository URL:
   ```
   https://github.com/xamgore/obsidian-quiz-blocks
   ```
5. Click **Add plugin**.
6. Go to **Settings → Community plugins** and enable **Quiz Blocks**.

</details>

#### ~~Install by link~~

<details><summary>show steps</summary>

1. Click https://obsidian.md/plugins?id=quiz-blocks
2. Click **Install**, then **Enable**.
</details>

#### ~~Install from Obsidian Community Plugins~~

<details><summary>show steps</summary>

1. Open **Obsidian**.
2. Go to **Settings → Community plugins**.
3. Make sure **Safe mode** is disabled.
4. Click **Browse**, search for **Quiz Blocks**.
5. Click **Install**, then **Enable**.
</details>

#### Install manually (from GitHub)

<details><summary>show steps</summary>

1. Download `obsidian-quiz-blocks.zip` from the
   [GitHub releases page](https://github.com/xamgore/obsidian-quiz-blocks/releases).
2. Extract the downloaded ZIP file.
3. Copy the extracted folder into your vault’s plugin directory:
   `YOUR_VAULT/.obsidian/plugins/`
4. Restart Obsidian or go to **Settings → Community plugins** and click **Reload plugins**.
5. Enable **Quiz Blocks** from the list.
</details>


## Features

#### `shuffle: true`

Quiz options can be **shuffled** to reduce **pattern recognition** and avoid learning answer positions.
Default is false.

#### `gated: true`

Quiz content can be **gated**—encouraging **closed-book testing** and **active recall**.
Note's text becomes hidden until you complete the quiz or stop interacting with the quiz.
Default is false.

#### `instant: true`

Instant feedback after choosing an option. `[Check]` button is hidden.


## Notes & limitations

This is an early-stage plugin, bugs are possible. Feel free to [open an issue](https://github.com/xamgore/obsidian-quiz-blocks/issues/new/choose) and share feedback.

To access an interactive quiz in the preview mode, you have to write some YAML code
in the source mode. Unfortunately, there is no syntax highlighting to assist you
(vote [#3](https://github.com/xamgore/obsidian-quiz-blocks/issues/3)). 
Additionally, errors related to missing fields can be quite cumbersome 
(vote [#4](https://github.com/xamgore/obsidian-quiz-blocks/issues/4)).

- Answers are ephemeral, kept until the tab is closed. If you have a good reason to keep them longer, vote [#2](https://github.com/xamgore/obsidian-quiz-blocks/issues/2).
- `shuffle` and `instant` are not implemented yet.
- More quiz types planned: `cards`.


## Motivation

These are just a few examples of recurring requests and discussions in the Obsidian community around lightweight quiz functionality.

> [@amcasas:](https://forum.obsidian.md/t/quiz-type-plugin/2237) need some type of quiz function that you can add at the end of each note

> [@deleted:](https://www.reddit.com/r/ObsidianMD/comments/1ns1g7z/making_mcq_questions_in_obsidian/)
> in such a way that a maximum of one option is choosable for each question.

> [@30DayThrill:](https://www.reddit.com/r/ObsidianMD/comments/17lcsvf/quizzing_plugin_strategies_for_obsidian/)
> looking for a quizlet-esque solution where I can create more multiple choice or question and answer style tests.

If you find this plugin useful, please consider telling others about it or starring the repository&nbsp;⭐️

<br>
<br>
