<script lang="ts">
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
	}

	let { ctx, stableId, quiz }: Props = $props();

	let gate: { disable: () => void; };

	let quizInProgress = $derived(quiz.gated === false);

	function onFinish() {
		quizInProgress = false;
		gate?.disable();
	}

	function onReset() {
		quizInProgress = true;
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
