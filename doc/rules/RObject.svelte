<script type="ts">
	import Icon from 'svelte-material-icons/CodeBraces.svelte';
	import type { NeedRule, PrimitiveRule, PropRule, Rule } from 'thor-validation';
	import { any, getCheckDesc, getRuleCheckDesc, getRuleTypeName } from '../api';
	import RNeed from './RNeed.svelte';
	import RArray from './RArray.svelte';
	import RUnion from './RUnion.svelte';
	export let rule: PrimitiveRule;
	export let need: boolean;
	export let level: number;

	function getName(r: Rule): string {
		return (r as PropRule).name + '';
	}

	function getDesc(r: PropRule): string {
		let desc = r.desc ? r.desc + '' : '';
		if (r.rule) {
			let txt = getRuleCheckDesc(r.rule);
			if (txt) {
				return desc + ' 规则：' + txt;
			} else {
				return desc;
			}
		} else {
			return desc;
		}
	}
	function isNeed(r: PropRule): boolean {
		if (r.rule && r.rule.type === 'need') {
			return true;
		} else {
			return false;
		}
	}

	function getSubType(r: PropRule): string {
		if (r.rule) {
			return getRuleTypeName(r.rule);
		} else {
			return '未指定类型';
		}
	}


function getSubTypeNoNeed(r: PropRule): string {
	if (r.rule) {
		if (r.rule.type === 'need') {
			if (r.rule.rule) {
				return r.rule.rule.type;
			} else {
				return 'no';
			}
		} else {
			return r.rule.type;
		}
	} else {
		return 'no';
	}
}

	function toPropRule(r: Rule): PropRule {
		return r as PropRule;
	}
</script>

<div style="margin-left: {level * 40}px">
	<div class="type"><Icon /><span style="margin-left:10px">对象</span>{@html need ? ' <span style="color:red">(必须)</span>' : ''}</div>
	<div class="table">
	{#if rule.type === 'object' && rule.rules.filter(r => r.type === 'prop').length > 0}
		{#each rule.rules.filter(r => r.type === 'prop') as r}
		<div class="line">
			<span>{getName(r)}</span>
			<span>{getSubType(any(r))}{@html isNeed(any(r)) ? '<span style="color:red">(必须)</span>' : ''}</span>
			<span class="desc">{getDesc(any(r))}</span>
		</div>
		{#if getSubTypeNoNeed(any(r)) === 'object'}
			{#if toPropRule(r).rule && toPropRule(r).rule.type === 'need'}
			<RNeed rule={any(toPropRule(r).rule)} level={1} />
			{:else}
			<svelte:self rule={any(toPropRule(r).rule)} need={false} level={1} />
			{/if}
		{:else if getSubTypeNoNeed(any(r)) === 'array'}
			{#if toPropRule(r).rule && toPropRule(r).rule.type === 'need'}
			<RNeed rule={any(toPropRule(r).rule)} level={1} />
			{:else}
			<RArray rule={any(toPropRule(r).rule)} need={false} level={1} />
			{/if}
		{:else if getSubTypeNoNeed(any(r)) === 'union'}
			{#if toPropRule(r).rule && toPropRule(r).rule.type === 'need'}
			<RNeed rule={any(toPropRule(r).rule)} level={1} />
			{:else}
			<RUnion rule={any(toPropRule(r).rule)} need={false} level={1} />
			{/if}
		{/if}
		{/each}
	{:else}
	<div class="line">未指定字段规则。</div>
	{/if}
	</div>
</div>
<style>
	div.table {
		display: flex;
		flex-direction: column;
	}
	div.line {
		display: flex;
		border-bottom: 1px solid #888;
		padding: 4px 10px;
	}
	div.line > span {
		text-align: left;
		flex: 1;
	}
	div.line > span.desc {
		text-align: left;
		flex: 3;
	}
</style>
