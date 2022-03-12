<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	import type { NeedRule, PrimitiveRule, Rule, UnionRule } from 'thor-validation';
	import RArray from './rules/RArray.svelte';
	import RNeed from './rules/RNeed.svelte';
	import RObject from './rules/RObject.svelte';
	import RUnion from './rules/RUnion.svelte';
	import RValue from './rules/RValue.svelte';
	export let rule: NeedRule | PrimitiveRule | UnionRule | undefined | null;
</script>
{#if rule}
	{#if rule.type === 'need'}
	<RNeed rule={rule} />
	{:else if rule.type === 'union'}
	<RUnion rule={rule} need={false} />
	{:else if rule.type === 'object'}
	<RObject rule={rule} need={false} />
	{:else if rule.type === 'array'}
	<RArray rule={rule} need={false} />
	{:else if rule.type === 'string'}
	<RValue rule={rule} need={false} />
	{:else if rule.type === 'number'}
	<RValue rule={rule} need={false} />
	{:else if rule.type === 'boolean'}
	<RValue rule={rule} need={false} />
	{:else if rule.type === 'date'}
	<RValue rule={rule} need={false} />
	{:else}
	<span class="error">未知规则，请联系开发人员报告这个错误。</span>
	{/if}
{:else}
	<span class="undefined">未定义</span>
{/if}
<style>
	span.undefined {
		color: #888;
	}
	span.error {
		color: red;
	}
</style>
