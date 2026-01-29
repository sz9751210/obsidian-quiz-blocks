<script lang="ts">
	import type { Quiz } from "../schemas";
	import InlineMarkdown from "./InlineMarkdown.svelte";
	import type { AppContext } from "../markdown";

	interface Props {
		ctx: AppContext,
		quiz: Extract<Quiz, { type: "prompt" }>;
		onFinish: () => void;
		onReset: () => void;
	}

	let { ctx, quiz, onFinish, onReset }: Props = $props();
	let checked = $state(false);

	function onCheck() {
		if (checked) return;
		checked = true;
		onFinish();
	}

	function reset() {
		checked = false;
		onReset();
	}
</script>

{#if checked && quiz.feedback && quiz.feedback.trim().length > 0}
	<div class="quiz-prompt-feedback">
		<InlineMarkdown {ctx} markdown={quiz.feedback}/>
	</div>
{/if}

<div class="quiz-actions">
	{#if !checked}
		<button class="quiz-check" type="button" onclick={onCheck}>
			Check
		</button>
	{:else}
		<button class="quiz-reset" type="button" onclick={reset} aria-label="Reset quiz" title="Reset quiz">
			↻
		</button>
	{/if}
</div>
