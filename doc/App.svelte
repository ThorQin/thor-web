<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApiEntry, ApiFolder } from './api';
	import ListItem from './ListItem.svelte';
	import IconDoc from 'svelte-material-icons/FileDocument.svelte';
	import Doc from './Doc.svelte';
	let api: (ApiFolder | ApiEntry)[] = [];
	onMount(() => {
		fetch('apis.json').then(r => r.json()).then((r: (ApiFolder | ApiEntry)[]) => {
			api = r ?? [];
		});
	});
	let activeItem: ApiEntry | undefined;
	let previousDeactive: (() => void) | undefined;
	function setActive(item: ApiEntry | undefined, deactive: (() => void) | undefined) {
		if (activeItem) {
			activeItem.active = false;
			previousDeactive();
		}
		activeItem = item;
		previousDeactive = deactive;
	}
</script>

<main>
	<div class="title">
		<IconDoc/> <span style="margin-left:20px">API document</span>
	</div>
	<div class="doc">
		<div class="list">
			{#each api as item}
				<ListItem item={item} setActive={setActive}/>
			{/each}
		</div>
		<div class="drag"></div>
		<div class="content">
			{#if activeItem}
				<Doc item={activeItem} />
			{/if}
		</div>
	</div>
</main>

<style>
	main {
		height: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	div.title {
		display: flex;
		align-items: center;
		padding: 20px;
		font-size: 2rem;
		background-color: #70a0ff;
		color: white;
		font-family:'Courier New', Courier, monospace;
		box-shadow: 0 0px 5px #888;
		z-index: 10;
	}
	div.doc {
		flex:1;
		display: flex;
		flex-direction: row;
		height: 0;
	}
	div.list {
		overflow: auto;
		padding: 20px 0px;
		background-color: #f8f8f8;
	}
	div.content {
		flex:1;
		overflow: auto;
	}
</style>
