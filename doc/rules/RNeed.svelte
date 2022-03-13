<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	import type { NeedRule, Rule } from 'thor-validation';
	import RObject from './RObject.svelte';
	import RArray from './RArray.svelte';
	import RUnion from './RUnion.svelte';
	import RValue from './RValue.svelte';
	export let rule: NeedRule;
	export let level: number;
</script>

{#if rule.rule}
	{#if rule.rule.type === 'object'}
		<RObject rule={rule.rule} need={true} level={level}/>
	{:else if rule.rule.type === 'array'}
		<RArray rule={rule.rule} need={true} level={level} />
	{:else if rule.rule.type === 'union'}
		<RUnion rule={rule.rule} need={true} level={level}/>
	{:else if rule.rule.type === 'string'}
		<RValue rule={rule.rule} need={true} level={level}/>
	{:else if rule.rule.type === 'number'}
		<RValue rule={rule.rule} need={true} level={level}/>
	{:else if rule.rule.type === 'boolean'}
		<RValue rule={rule.rule} need={true} level={level}/>
	{:else if rule.rule.type === 'date'}
		<RValue rule={rule.rule} need={true} level={level}/>
	{:else}
		<div class="error">未知规则，请联系开发人员报告这个错误。</div>
	{/if}
{:else}
	<div class="undefined">需要任意非空类型的数据</div>
{/if}

<style>
	div.undefined {
		color: #888;
	}
	div.error {
		color: red;
	}
</style>
