import { type App, type Component, type MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { parseQuizBlock } from "./parse";
import type { Quiz } from "./schemas";
import { mount, unmount } from "svelte";
import { type AppContext } from "./markdown";
import QuizRenderer from "./ui/QuizRenderer.svelte";
import { hash } from "./hash";
import { shuffleOptions } from "./shuffle";

type RenderArgs = {
	app: App;
	component: Component;
	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
};

type Props = {
	ctx: AppContext,
	quiz: Quiz;
	stableId: string;
};

export class QuizSvelteChild extends MarkdownRenderChild {
	private instance: unknown;
	readonly props: Props;

	constructor(containerEl: HTMLElement, props: Props) {
		super(containerEl);
		this.props = props;
	}

	onload() {
		this.props.ctx.component = this;
		this.instance = mount(QuizRenderer, {
			target: this.containerEl,
			props: this.props,
		});
	}

	onunload() {
		if (this.instance) {
			void unmount(this.instance);
			this.instance = null;
		}
	}
}

export function renderQuiz({ app, component, source, el, ctx }: RenderArgs) {
	el.empty();

	let quiz: Quiz;
	try {
		const tabSize = Number(app.vault.getConfig("tabSize") ?? 4);
		quiz = parseQuizBlock(source, tabSize);
	} catch (e) {
		const pre = el.createEl("pre", { cls: "quiz-block-error" });
		pre.textContent = e instanceof Error ? e.message : String(e);
		return;
	}

	const section = ctx.getSectionInfo(el);
	const stableId = [quiz.id, ctx.sourcePath, section?.lineStart, section?.lineEnd, quiz.type].join();

	if (quiz.shuffle /* || global.shuffleByDefault */) shuffleOptions(quiz, el);

	const props: Props = {
		ctx: { app, component, sourcePath: ctx.sourcePath },
		stableId: `quiz-${hash(stableId)}`,
		quiz,
	};

	ctx.addChild(new QuizSvelteChild(el, props));
}
