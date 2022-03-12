<script type="ts">
	import Icon from 'svelte-material-icons/CodeBraces.svelte';
	import type { NeedRule, PrimitiveRule, PropRule, Rule, UnionRule } from 'thor-validation';
import { any, getCheckDesc, typeToName } from '../api';
	export let rule: PrimitiveRule;
	export let need: boolean;

	function getName(r: Rule): string {
		return (r as PropRule).name + '';
	}

	function getRuleCheckDesc(r: PrimitiveRule | NeedRule | UnionRule): string {
		if (r.type === 'need') {
			if (r.rule) {
				return getRuleCheckDesc(r.rule);
			} else {
				return '无';
			}
		} else if (r.type === 'union') {
			return '';
		} else {
			return getCheckDesc(any(r.rules));
		}
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

	function getRuleType(r: Rule): string {
		if (r.type === 'need') {
			return (r as NeedRule).rule ? getRuleType(any((r as NeedRule).rule)) : '未指定类型';
		} else if (r.type === 'union') {
			let txt =  (r as UnionRule).rules.filter(sr => sr.type !== 'mismatch').map(sr => typeToName(sr.type)).join(',');
			if (!txt) {
				txt = '未指定类型'
			}
			return txt;
		} else {
			return typeToName(r.type);
		}
	}

	function getSubType(r: PropRule): string {
		if (r.rule) {
			return getRuleType(r.rule);
		} else {
			return '未指定类型';
		}
	}
</script>
<div class="subject">
	<div class="type"><Icon /><span style="margin-left:10px">对象</span>{@html need ? ' <span style="color:red">(必须)</span>' : ''}</div>
	{#if rule.type === 'object' && rule.rules.length > 0}
	<div class="table">
		{#each rule.rules.filter(r => r.type === 'prop') as r}
		<div class="line">
			<span>{getName(r)}</span>
			<span>{getSubType(any(r))}{@html isNeed(any(r)) ? '<span style="color:red">(必须)</span>' : ''}</span>
			<span class="desc">{getDesc(any(r))}</span>
		</div>
		{/each}
	</div>
	{:else}
	<div class="undefined">未指定字段规则。</div>
	{/if}
</div>
<style>
	div.type {
		display: flex;
		align-items: center;
		background-color: #ddd;
		padding: 0px 10px;
		font-size: 1rem;
		height: 2.5rem;
	}
	div.type span {
		display: inline-block;
	}
	div.subject {
		display: block;
		padding: 20px;
	}
	div.undefined {
		color: #888;
	}
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
