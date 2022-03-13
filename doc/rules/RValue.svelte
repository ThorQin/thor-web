<script type="ts">
	import IconText from 'svelte-material-icons/Text.svelte';
	import IconNumber from 'svelte-material-icons/Numeric.svelte';
	import IconBool from 'svelte-material-icons/Check.svelte';
	import IconDate from 'svelte-material-icons/CalendarClock.svelte';
	import Icon from 'svelte-material-icons/CodeTags.svelte';
	import type { PrimitiveRule } from 'thor-validation';
	import { getRuleCheckDesc, getRuleTypeName } from '../api';
	export let rule: PrimitiveRule;
	export let need: boolean;
	export let level: number;
</script>
<div style="margin-left: {level * 40}px">
	<div class="type">
		{#if rule.type === 'string'}
		<IconText />
		{:else if rule.type === 'number'}
		<IconNumber />
		{:else if rule.type === 'boolean'}
		<IconBool />
		{:else if rule.type === 'date'}
		<IconDate />
		{:else}
		<Icon />
		{/if}
		<span style="margin-left:10px">{getRuleTypeName(rule)}</span>{@html need ? ' <span style="color:red">(必须)</span>' : ''}
	</div>
	{#if rule.rules.length > 0}
	<div class="line">{getRuleCheckDesc(rule)}</div>
	{:else}
	<div class="line">无校验规则</div>
	{/if}
</div>
<style>
	div.line {
		display: flex;
		border-bottom: 1px solid #888;
		padding: 4px 10px;
	}
</style>
