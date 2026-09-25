<script lang="ts">
	import "./__variables.css";
	import type { AppContext } from "../markdown";
	import type { Quiz } from "../schemas";

	import InlineMarkdown from "./InlineMarkdown.svelte";
	import QuizGate from "./QuizGate.svelte";
	import QuizChoice from "./QuizChoice.svelte";
	import QuizRadio from "./QuizRadio.svelte";
	import QuizCheckbox from "./QuizCheckbox.svelte";
	import QuizNoodle from "./QuizNoodle.svelte";
	import QuizText from "./QuizText.svelte";
	import QuizPrompt from "./QuizPrompt.svelte";

	interface Props {
		ctx: AppContext;
		stableId: string;
		quiz: Quiz;
		onResult?: (result: boolean | null | undefined) => void;
	}

	let { ctx, stableId, quiz, onResult }: Props = $props();

	let gate: { disable: () => void; };

	let quizInProgress = $derived(quiz.gated === false);

	function onFinish(result: boolean | null) {
		quizInProgress = false;
		gate?.disable();
		onResult?.(result);
	}

	function onReset() {
		quizInProgress = true;
		onResult?.(undefined);
	}
</script>

<QuizGate bind:this={gate} {ctx} {stableId} {quiz}>
	{#snippet children()}
		<div class="quiz-title">
			<InlineMarkdown {ctx} markdown={quiz.content} class={
				quiz.type === "prompt" && quizInProgress ? "mark-spoilers" : ""
			}/>
		</div>

		{#if quiz.type === "prompt"}
			<QuizPrompt {ctx} {quiz} {onFinish} {onReset}/>
		{:else if quiz.type === "choice"}
			<QuizChoice {ctx} {quiz} {onFinish} {onReset}/>
		{:else if quiz.type === "noodle"}
			<QuizNoodle {ctx} {quiz} {onFinish} {onReset}/>
		{:else if quiz.type === "text"}
			<QuizText {ctx} {stableId} {quiz} {onFinish} {onReset}/>
		{:else if quiz.type === "radio"}
			<QuizRadio {ctx} {stableId} {quiz} {onFinish} {onReset}/>
		{:else if quiz.type === "checkbox"}
			<QuizCheckbox {ctx} {stableId} {quiz} {onFinish} {onReset}/>
		{/if}
	{/snippet}
</QuizGate>

<style>
	:global(.quiz-block) {
		border: 1px solid var(--quiz-block-border-color);
		border-radius: 10px;
		padding: 12px;
		margin: 2px; /* offset from in-editor outline */
	}

	:global(.quiz-block .quiz-form) {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.quiz-title {
		&:not(:empty) {
			padding: 0 4px 24px;
		}

		:global(p) {
			margin-top: 0;

			&:last-of-type {
				margin-bottom: 0;
			}
		}

		:global(.mark-spoilers mark) {
			color: transparent;
			background: none;
			box-shadow: none;
			text-shadow: none;
			display: inline-flex;
			--quiz-prompt-blank-width: 8ch;
			width: var(--quiz-prompt-blank-width);
			min-width: var(--quiz-prompt-blank-width);
			max-width: var(--quiz-prompt-blank-width);
			box-sizing: border-box;
			border-bottom: 1.5px solid var(--text-muted);
			white-space: nowrap;
			overflow: hidden;
			vertical-align: baseline;
		}
	}

    :global(.quiz-block .quiz-actions) {
		display: flex;
		gap: 8px;
		padding-top: 30px;
	}
</style>
