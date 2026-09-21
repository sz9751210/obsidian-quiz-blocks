import { MarkdownView, Notice, PluginSettingTab, Setting } from "obsidian";
import type QuizBlocksPlugin from "./main";
import { insertTemplate } from "./authoring";
import { QUIZ_TEMPLATES, templateSnippet, templateSource, type QuizTemplate } from "./snippets";
import { parseQuizBlock } from "./parse";
import { QuizSvelteChild } from "./renderer";
import { shuffleOptions } from "./shuffle";

export class QuizSettingTab extends PluginSettingTab {
	private preview?: QuizSvelteChild;
	private template: QuizTemplate = QUIZ_TEMPLATES[0];
	private page: "general" | "appearance" | "templates" = "appearance";

	constructor(private quizPlugin: QuizBlocksPlugin) {
		super(quizPlugin.app, quizPlugin);
		quizPlugin.register(() => this.hide());
	}

	display() {
		this.hide();
		const tabs = this.containerEl.createDiv({ cls: "quiz-settings-tabs", attr: { role: "tablist", "aria-label": "測驗設定分類" } });
		const panel = this.containerEl.createDiv({ attr: { role: "tabpanel", id: "quiz-settings-panel", tabindex: "0" } });
		const pages = [{ id: "general", name: "一般設定" }, { id: "appearance", name: "外觀" }, { id: "templates", name: "範本" }] as const;
		const buttons = pages.map(page => {
			const button = tabs.createEl("button", { text: page.name, attr: { type: "button", role: "tab", id: `quiz-settings-${page.id}`, "aria-controls": "quiz-settings-panel" } });
			button.addEventListener("click", () => { this.page = page.id; render(); });
			button.addEventListener("keydown", event => {
				const index = buttons.indexOf(button);
				const next = event.key === "ArrowRight" ? (index + 1) % pages.length
					: event.key === "ArrowLeft" ? (index + pages.length - 1) % pages.length
						: event.key === "Home" ? 0 : event.key === "End" ? pages.length - 1 : -1;
				if (next < 0) return;
				event.preventDefault();
				buttons[next]!.focus();
				buttons[next]!.click();
			});
			return button;
		});
		const render = () => {
			this.clearPreview();
			panel.empty();
			buttons.forEach((button, index) => {
				const selected = pages[index]!.id === this.page;
				button.setAttribute("aria-selected", String(selected));
				button.tabIndex = selected ? 0 : -1;
			});
			panel.setAttribute("aria-labelledby", `quiz-settings-${this.page}`);
			if (this.page === "general") this.renderGeneral(panel);
			else if (this.page === "appearance") this.renderAppearance(panel);
			else this.renderTemplates(panel);
		};
		render();
	}

	private renderGeneral(containerEl: HTMLElement) {
		const { quizPlugin } = this;
		containerEl.createEl("p", { text: "在筆記空白行輸入 quiz:，選擇題型後按確認鍵，即可展開可直接作答的範本。也可使用指令面板的範本插入指令。" });
		new Setting(containerEl).setName("快速語法").setDesc("輸入 quiz:radio 插入單選題；quiz:ratio 也可使用。僅在一般文字的獨立行啟用，不會改寫程式碼區塊。")
			.addToggle(toggle => toggle.setValue(quizPlugin.settings.quickSyntax).onChange(async value => {
				quizPlugin.settings.quickSyntax = value;
				await quizPlugin.saveSettings();
			}));
		new Setting(containerEl).setName("新範本預設").setHeading();
		containerEl.createEl("p", { text: "以下選項只影響之後插入或複製的範本，不會修改既有題目。" });
		new Setting(containerEl).setName("打亂選項").setDesc("在新範本加入 shuffle: true。")
			.addToggle(toggle => toggle.setValue(quizPlugin.settings.shuffle).onChange(async value => {
				quizPlugin.settings.shuffle = value;
				await quizPlugin.saveSettings();
			}));
		new Setting(containerEl).setName("開始前隱藏題目").setDesc("加入 gated: true；閱讀模式點擊開始按鈕後顯示題目，作答時隱藏筆記其餘內容。設定中的預覽直接顯示題目。")
			.addToggle(toggle => toggle.setValue(quizPlugin.settings.gated).onChange(async value => {
				quizPlugin.settings.gated = value;
				await quizPlugin.saveSettings();
			}));
	}

	private renderAppearance(containerEl: HTMLElement) {
		const { quizPlugin } = this;
		new Setting(containerEl).setName("基本樣式").setDesc("選擇後立即更新下方預覽，並套用至筆記與題庫測驗。顏色跟隨 Obsidian 的明暗主題。")
			.addDropdown(dropdown => dropdown.addOptions({ default: "預設", card: "卡片", compact: "精簡" })
				.setValue(quizPlugin.settings.style).onChange(async value => {
					if (value !== "default" && value !== "card" && value !== "compact") return;
					quizPlugin.settings.style = value;
					await quizPlugin.saveSettings();
				}));
		containerEl.createEl("p", { text: "可切換題型、試答及查看答案，比較不同樣式下的呈現。更換樣式會保留目前的試答狀態；切換分頁或題型則重新開始。" });
		this.renderTemplatePreview(containerEl, false);
	}

	private renderTemplates(containerEl: HTMLElement) {
		containerEl.createEl("p", { text: "選擇範本後，可先試答，再複製語法或插入目前筆記。範本會使用「一般設定」中的新範本預設。" });
		this.renderTemplatePreview(containerEl, true);
	}

	private renderTemplatePreview(containerEl: HTMLElement, showSource: boolean) {
		const { quizPlugin } = this;
		new Setting(containerEl).setName("題型").addDropdown(dropdown => {
			for (const template of QUIZ_TEMPLATES) dropdown.addOption(template.type, `${template.name} · quiz:${template.type}`);
			dropdown.setValue(this.template.type).onChange(value => {
				this.template = QUIZ_TEMPLATES.find(template => template.type === value) ?? QUIZ_TEMPLATES[0];
				refresh();
			});
		});
		const description = containerEl.createEl("p");
		if (showSource) new Setting(containerEl).setName("使用範本")
			.addButton(button => button.setButtonText("複製語法").onClick(async () => {
				try {
					await navigator.clipboard.writeText(templateSnippet(this.template, quizPlugin.settings));
					new Notice("已複製，可貼到筆記中修改題目與答案。");
				} catch { new Notice("無法存取剪貼簿，請從下方語法手動複製。"); }
			}))
			.addButton(button => button.setButtonText("插入目前筆記").onClick(() => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || view.getMode() !== "source") { new Notice("請先開啟筆記並切換至編輯模式，再插入範本。"); return; }
				insertTemplate(view.editor, this.template, quizPlugin.settings);
				new Notice("已插入目前筆記，關閉設定即可編輯題目。");
			}));
		const previewEl = containerEl.createDiv({ cls: "quiz-template-preview" });
		let code: HTMLElement | undefined;
		if (showSource) {
			const details = containerEl.createEl("details");
			details.createEl("summary", { text: "查看完整語法" });
			code = details.createEl("pre").createEl("code");
		}
		const refresh = () => {
			if (!containerEl.contains(previewEl)) return;
			this.clearPreview();
			previewEl.empty();
			description.setText(this.template.description);
			code?.setText(templateSnippet(this.template, quizPlugin.settings));
			const quiz = parseQuizBlock(templateSource(this.template, quizPlugin.settings), 4);
			quiz.gated = false;
			if (quiz.shuffle) shuffleOptions(quiz, previewEl);
			this.preview = quizPlugin.addChild(new QuizSvelteChild(previewEl, {
				ctx: { app: this.app, component: quizPlugin, sourcePath: this.app.workspace.getActiveFile()?.path ?? "" },
				quiz,
				stableId: `template-preview-${this.template.type}`,
			}));
		};
		refresh();
	}

	private clearPreview() {
		if (this.preview) this.quizPlugin.removeChild(this.preview);
		this.preview = undefined;
	}

	hide() {
		this.clearPreview();
		this.containerEl.empty();
	}
}
