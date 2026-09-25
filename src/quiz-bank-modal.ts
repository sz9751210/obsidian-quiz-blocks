import { Component, FuzzySuggestModal, Modal, Setting, getAllTags, type App, type TFile } from "obsidian";
import { parseQuizBlock } from "./parse";
import { matchesTag, quizSources } from "./question-bank";
import { QuizSvelteChild } from "./renderer";
import type { Quiz } from "./schemas";
import { shuffleOptions } from "./shuffle";

class BankPicker<T> extends FuzzySuggestModal<T> {
	constructor(app: App, private items: T[], private label: (item: T) => string, private select: (item: T) => void) {
		super(app);
	}
	getItems() { return this.items; }
	getItemText(item: T) { return this.label(item); }
	onChooseItem(item: T) { this.select(item); }
}

type Question = { quiz: Quiz; path: string; line: number };

export class QuizBankModal extends Modal {
	private lifecycle = new Component();
	private questionChild?: QuizSvelteChild;
	private closed = false;

	onOpen() {
		this.closed = false;
		this.lifecycle.load();
		this.setTitle("Start quiz from a question bank");
		this.contentEl.createEl("p", { text: "Choose a note or tag. Each quiz block is one question." });
		new Setting(this.contentEl).setName("Note").setDesc("Use quiz blocks from one note.")
			.addButton(button => button.setButtonText("Choose note").onClick(() => {
				const picker = new BankPicker(this.app, this.app.vault.getMarkdownFiles(), file => file.path,
					file => { void this.start([file], file.basename); });
				picker.setPlaceholder("Search notes");
				picker.open();
			}));
		new Setting(this.contentEl).setName("Tag").setDesc("Include matching notes and nested tags.")
			.addButton(button => button.setButtonText("Choose tag").onClick(() => {
				const tags = new Set<string>();
				for (const file of this.app.vault.getMarkdownFiles()) {
					for (const tag of this.tags(file)) {
						const parts = tag.split("/");
						while (parts.length) { tags.add(parts.join("/")); parts.pop(); }
					}
				}
				const picker = new BankPicker(this.app, [...tags].sort(), tag => tag, tag => {
					const files = this.app.vault.getMarkdownFiles().filter(file => matchesTag(this.tags(file), tag));
					void this.start(files, tag);
				});
				picker.setPlaceholder("Search tags");
				picker.open();
			}));
	}

	private tags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache ? getAllTags(cache) ?? [] : [];
	}

	private async start(files: TFile[], label: string) {
		if (this.closed) return;
		this.setTitle(label);
		this.contentEl.empty();
		this.contentEl.createEl("p", { text: "Loading questions…" });
		const questions: Question[] = [];
		const errors: string[] = [];
		for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
			try {
				const markdown = await this.app.vault.cachedRead(file);
				if (this.closed) return;
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache) { errors.push(`${file.path}: metadata is not ready. Try again shortly.`); continue; }
				for (const { source, line } of quizSources(markdown, cache.sections ?? [])) {
					try {
						const quiz = parseQuizBlock(source, Number(this.app.vault.getConfig("tabSize") ?? 4));
						questions.push({ quiz: { ...quiz, gated: false }, path: file.path, line });
					} catch (error) {
						errors.push(`${file.path}:${line + 1}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			} catch (error) {
				errors.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (this.closed) return;
		this.contentEl.empty();
		this.contentEl.createEl("p", { text: `${questions.length} quiz blocks found in ${files.length} notes.` });
		if (errors.length) {
			const details = this.contentEl.createEl("details");
			details.createEl("summary", { text: `${errors.length} blocks or notes could not be loaded` });
			details.createEl("pre", { text: errors.join("\n\n") });
		}
		if (!questions.length) this.contentEl.createEl("p", { text: "Add a quiz code block to a matching note, then try again." });
		let shuffleQuestions = false;
		new Setting(this.contentEl).setName("Shuffle questions")
			.addToggle(toggle => toggle.onChange(value => { shuffleQuestions = value; }));
		new Setting(this.contentEl)
			.addButton(button => button.setButtonText("Choose another bank").onClick(() => { this.contentEl.empty(); this.onOpen(); }))
			.addButton(button => button.setButtonText("Start quiz").setCta().setDisabled(!questions.length)
				.onClick(() => {
					if (shuffleQuestions) {
						for (let i = questions.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[questions[i], questions[j]] = [questions[j]!, questions[i]!];
						}
					}
					this.showQuestion(questions, 0, new Array<boolean | null | undefined>(questions.length));
				}));
	}

	private showQuestion(questions: Question[], index: number, results: (boolean | null | undefined)[]) {
		if (this.questionChild) this.lifecycle.removeChild(this.questionChild);
		this.questionChild = undefined;
		this.contentEl.empty();
		const question = questions[index];
		if (!question) {
			const correct = results.filter(result => result === true).length;
			const incorrect = results.filter(result => result === false).length;
			const reviewed = results.filter(result => result === null).length;
			const skipped = questions.length - correct - incorrect - reviewed;
			this.contentEl.createEl("h3", { text: "Quiz complete" });
			this.contentEl.createEl("p", { text: `${correct} correct · ${incorrect} incorrect · ${reviewed} reviewed · ${skipped} skipped` });
			this.contentEl.createEl("p", { text: "Text and prompt questions are reviewed without automatic grading." });
			const retry = questions.filter((_, i) => results[i] === false || results[i] === undefined);
			new Setting(this.contentEl)
				.addButton(button => button.setButtonText("Retry incorrect or skipped").setDisabled(!retry.length)
						.onClick(() => this.showQuestion(retry, 0, new Array<boolean | null | undefined>(retry.length))))
				.addButton(button => button.setButtonText("Close").onClick(() => this.close()));
			return;
		}
		this.contentEl.createEl("p", { text: `Question ${index + 1} of ${questions.length} · ${question.path}` });
		const target = this.contentEl.createDiv();
		if (question.quiz.shuffle) shuffleOptions(question.quiz, target);
		this.questionChild = this.lifecycle.addChild(new QuizSvelteChild(target, {
			ctx: { app: this.app, component: this.lifecycle, sourcePath: question.path },
			quiz: question.quiz,
			stableId: `bank-${index}-${question.line}`,
			onResult: result => { results[index] = result; },
		}));
		new Setting(this.contentEl).addButton(button => button
			.setButtonText(index === questions.length - 1 ? "Finish / skip" : "Next / skip")
			.onClick(() => this.showQuestion(questions, index + 1, results)));
	}

	onClose() {
		this.closed = true;
		this.lifecycle.unload();
		this.contentEl.empty();
	}
}
