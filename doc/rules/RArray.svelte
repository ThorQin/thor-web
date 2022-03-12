<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	import type { PrimitiveRule } from 'thor-validation';
	import RNeed from './RNeed.svelte';
	export let rule: PrimitiveRule;
	export let need: boolean;
</script>
<div class="subject">
	{#if rule.rules.length > 0}

	{:else}
	<div class="error">未知规则，请联系开发人员报告这个错误。</div>
	{/if}
</div>
<style>
	div.subject {
		display: block;
		padding: 20px;
		font-size: 1.2rem;
		line-height: 2rem;
		font-family: 'Courier New', Courier, monospace;
		background-color: #f8f8f8;
		border-radius: 5px;
	}
	div.undefined {
		color: #888;
	}
	div.error {
		color: red;
	}
</style>
