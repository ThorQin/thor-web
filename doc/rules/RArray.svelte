<script type="ts">
	import Icon from 'svelte-material-icons/CodeBrackets.svelte';
	import type {  ItemRule, PrimitiveRule, Rule } from 'thor-validation';
	import RObject from './RObject.svelte';
	import RArray from './RArray.svelte';
	import RUnion from './RUnion.svelte';
	import RValue from './RValue.svelte';
	import RNeed from './RNeed.svelte';
	import { getRuleCheckDesc, getRuleTypeName } from '../api';
	export let rule: PrimitiveRule;
	export let need: boolean;
	export let level: number;

	function getSubType(r: ItemRule): string {
		if (r.rule) {
			return getRuleTypeName(r.rule);
		} else {
			return '未指定类型';
		}
	}

	let itemRule = rule.rules.filter(r => r.type === 'item')[0] as ItemRule | undefined;
	let subType = itemRule ? getSubType(itemRule) : '未指定';
</script>

<div style="margin-left: {level * 40}px;border-left:1px solid #ccc">
	<div class="type">
		<Icon />
		<span style="margin-left:10px">数组</span>
		{@html need ? ' <span style="color:red">(必须)</span>' : ''}，元素数量规则：{getRuleCheckDesc(rule)}，元素类型：{subType}
	</div>
	{#if itemRule}
		{#if itemRule.rule.type === 'object'}
			<RObject rule={itemRule.rule} need={false} level={1} />
		{:else if itemRule.rule.type === 'array'}
			<RArray rule={itemRule.rule} need={false} level={1} />
		{:else if itemRule.rule.type === 'union'}
			<RUnion rule={itemRule.rule} need={false} level={1}/>
		{:else if itemRule.rule.type === 'need'}
			<RNeed rule={itemRule.rule} level={1} />
		{:else if itemRule.rule.type === 'string'}
			<RValue rule={itemRule.rule} need={false} level={1}/>
		{:else if itemRule.rule.type === 'number'}
			<RValue rule={itemRule.rule} need={false} level={1}/>
		{:else if itemRule.rule.type === 'boolean'}
			<RValue rule={itemRule.rule} need={false} level={1}/>
		{:else if itemRule.rule.type === 'date'}
			<RValue rule={itemRule.rule} need={false} level={1}/>
		{:else}
			<div class="error">未知规则，请联系开发人员报告这个错误。</div>
		{/if}
	{:else}
	<div class="undefined">未指定元素类型。</div>
	{/if}
</div>

<style>
	div.undefined {
		color: #888;
	}
	div.error {
		color: red;
	}
</style>
