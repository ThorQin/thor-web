<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	import type { UnionRule } from 'thor-validation';
	import RObject from './RObject.svelte';
	import RArray from './RArray.svelte';
	import RValue from './RValue.svelte';
	export let rule: UnionRule;
	export let need: boolean;
	export let level: number;
</script>
<div class="union-box" style="margin-left: {level * 40}px">
	{#if rule.rules.length > 0}
		{#each rule.rules.filter(r => r.type !== 'mismatch') as subRule, index}
			{#if index > 0}
			<div class="or"><span>或</span></div>
			{/if}
			{#if subRule.type === 'object'}
			<RObject rule={subRule} need={need} level={0}/>
			{:else if subRule.type === 'array'}
				<RArray rule={subRule} need={need} level={0}/>
			{:else if subRule.type === 'string'}
				<RValue rule={subRule} need={need} level={0} />
			{:else if subRule.type === 'number'}
				<RValue rule={subRule} need={need} level={0} />
			{:else if subRule.type === 'boolean'}
				<RValue rule={subRule} need={need} level={0} />
			{:else if subRule.type === 'date'}
				<RValue rule={subRule} need={need} level={0} />
			{:else}
				<div class="error">未知规则，请联系开发人员报告这个错误。</div>
			{/if}
		{/each}
	{:else}
	<div class="error">未知规则，请联系开发人员报告这个错误。</div>
	{/if}
</div>
<style>
	div.union-box {
		border-left: 1px dotted #ddd;
	}
	div.error {
		color: red;
	}
	div.or {
		padding:20px 0;
		text-align: left;
	}
	div.or>span {
    display: inline-block;
    font-size: 0.8rem;
		line-height: 0.8rem;
    padding: 8px 20px;
    border-radius: 30px;
    background-color: #faa;
    color: white;
	}
</style>
