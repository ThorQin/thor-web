<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	import type { UnionRule } from 'thor-validation';
	import RObject from './RObject.svelte';
	import RArray from './RArray.svelte';
	import RValue from './RValue.svelte';
	export let rule: UnionRule;
	export let need: boolean;
</script>
<div class="subject">
	{#if rule.rules.length > 0}
		{#each rule.rules.filter(r => r.type !== 'mismatch') as subRule}
			{#if subRule.type === 'object'}
			<RObject rule={subRule} need={need}/>
			{:else if subRule.type === 'array'}
				<RArray rule={subRule} need={need} />
			{:else if subRule.type === 'string'}
				<RValue rule={subRule} need={need} />
			{:else if subRule.type === 'number'}
				<RValue rule={subRule} need={need} />
			{:else if subRule.type === 'boolean'}
				<RValue rule={subRule} need={need} />
			{:else if subRule.type === 'date'}
				<RValue rule={subRule} need={need} />
			{:else}
				<div class="error">未知规则，请联系开发人员报告这个错误。</div>
			{/if}
		{/each}
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
