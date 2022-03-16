<script type="ts">
	import type { ApiEntry, ApiFolder } from './api';
	import IconMenuRight from 'svelte-material-icons/MenuRight.svelte';
	import IconMenuDown from 'svelte-material-icons/MenuDown.svelte';
	import IconFolder from 'svelte-material-icons/Folder.svelte';
	import IconFile from 'svelte-material-icons/FileOutline.svelte';
	export let item: ApiFolder | ApiEntry;
	export let level: number = 0;
	export let multiLine: boolean = false;
	export let showPath: boolean = false;
	export let setActive: (item: ApiEntry, deactive: (() => void) | undefined) => void;
	let expend = true;
	let active = false;
	function clickRow() {
		expend = !expend;
		if (item.type === 'api' && !active) {
			active = true;
			setActive(item, () => {
				active = false;
			});
		}
	}

</script>
<div>
	<div class="line {item.type === 'api' && active ? "active": ""}" on:click={clickRow} style="padding-left:{20 + level * 20}px">
		{#if item.type === 'folder'}
			{#if expend}
				<IconMenuDown />
			{:else}
				<IconMenuRight />
			{/if}
			<span class="margin"></span>
			<IconFolder color="#f09060"/>
		{:else}
			<svg width="1em" height="1em"></svg>
			<span class="margin"></span>
			<IconFile color="#888"/>
		{/if}

		{#if item.title}
			{#if multiLine}
			<div class="margin two-line" style="flex:1;">
				<div>{item.title}</div>
				<div>{showPath ? item.path : item.name}</div>
			</div>
			{:else}
			<span class="margin" style="flex:1;">{item.title}<span class="common">({showPath ? item.path : item.name})</span></span>
			{/if}
		{:else}
		<span class="margin" style="flex:1;">{showPath ? item.path : item.name}</span>
		{/if}
	</div>
	{#if item.type === 'folder'}
		<div class:hidden={!expend}>
		{#each item.children as child}
			<svelte:self item={child} level={level + 1} setActive={setActive}/>
		{/each}
		</div>
	{/if}
</div>

<style>
	.margin {
		margin-left: 10px;
	}
	div.line {
		display: flex;
		align-items: center;
		padding: 7px 30px;
		font-family:'Courier New', Courier, monospace;
		font-size: 1.2rem;
		cursor: pointer;
		user-select: none;
	}
	div.line.active {
		background-color: #70a0ff;
		color: white;
	}
	div.line div.two-line {
		display: flex;
		flex-direction: column;
	}
	div.line span.common {
		color: #888;
	}
	div.line.active span.common {
		color: #ddf;
	}
	div.line div.two-line > div:nth-child(2) {
		font-size: 0.5rem;
		line-height: 0.4rem;
		color: #888;
	}
	div.hidden {
		display: none;
	}
</style>
