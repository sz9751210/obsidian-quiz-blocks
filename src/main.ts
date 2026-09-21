import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, QUIZ_TEMPLATES, readSettings, type QuizSettings } from "./snippets";
import { renderQuiz } from "./renderer";
import { yamlSyntaxHighlighter } from "./syntax-highlighter/extension";
import { QuizBankModal } from "./quiz-bank-modal";
import { insertTemplate, QuizTemplateSuggest, TemplatePicker } from "./authoring";
import { QuizSettingTab } from "./settings";
import "./ui/authoring.css";

export default class QuizBlocksPlugin extends Plugin {
	private bankModal?: QuizBankModal;
	settings: QuizSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = readSettings(await this.loadData());
		this.applyStyle();
		this.register(() => delete document.body.dataset.quizBlocksStyle);
		this.addSettingTab(new QuizSettingTab(this));
		this.registerEditorSuggest(new QuizTemplateSuggest(this.app, () => this.settings));
		this.addCommand({
			id: "insert-quiz-template", name: "Insert quiz template",
			editorCallback: editor => new TemplatePicker(this.app, editor, this.settings).open(),
		});
		this.register(() => this.bankModal?.close());
		const openBank = () => {
			this.bankModal?.close();
			this.bankModal = new QuizBankModal(this.app);
			this.bankModal.open();
		};
		this.addCommand({ id: "start-quiz-from-bank", name: "Start quiz from note or tag", callback: openBank });
		this.addRibbonIcon("list-checks", "Start quiz from note or tag", openBank);

		this.registerEditorExtension(yamlSyntaxHighlighter);

		this.registerMarkdownCodeBlockProcessor("quiz", (source, el, ctx) => {
			renderQuiz({
				app: this.app,
				component: this,
				source,
				el,
				ctx,
			});
		});

		for (const template of QUIZ_TEMPLATES) {
			this.addCommand({
				id: `quiz-block-insert-${template.type}`,
				name: `Insert ${template.type}`,
				editorCallback: editor => insertTemplate(editor, template, this.settings),
			});
		}
	}

	private applyStyle() {
		document.body.dataset.quizBlocksStyle = this.settings.style;
	}

	async saveSettings() {
		this.applyStyle();
		await this.saveData(this.settings);
	}
}

declare module "obsidian" {
	interface Vault {
		getConfig(key: string): unknown;
	}
}
