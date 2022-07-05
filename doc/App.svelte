<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApiDefine, ApiEntry, ApiFolder } from './api';
	import ListItem from './ListItem.svelte';
	import IconDoc from 'svelte-material-icons/FileDocument.svelte';
	import IconSearch from 'svelte-material-icons/Magnify.svelte';
	import IconClose from 'svelte-material-icons/Close.svelte';
	import Doc from './Doc.svelte';
import Test from './Test.svelte';
	let api: (ApiFolder | ApiEntry)[] = [];
	let isFocused: boolean = false;
	let entryList: ApiEntry[] = [];
	let searchText: string = '';
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
	function searchFocus() {
		isFocused = true;
	}
	function searchBlur() {
		isFocused = false;
	}
	function keypress(e) {
		if (e.keyCode === 13) {
			searchText = keyword;
			doSearch();
		}
	}
	function clear() {
		keyword='';
		searchText = keyword;
		doSearch();
	}
	let keyword = '';
	function doSearch() {
		if (activeItem) {
			activeItem.active = false;
		}
		typeof previousDeactive === 'function' && previousDeactive();
		activeItem = null;
		function getSubEntries(folder: ApiFolder): ApiEntry[] {
			return folder.children.flatMap(item => item.type === 'folder' ? getSubEntries(item) : [item]);
		}
		entryList = api.flatMap(item => item.type === 'folder' ? getSubEntries(item) : [item])
		.filter(item => {
			return ((item.name + '').toLowerCase().indexOf(searchText.trim().toLowerCase()) >= 0 ) ||
			(item.title && (item.title + '').toLowerCase().indexOf(searchText.trim().toLowerCase()) >= 0 )
		});
	}
	let testMethod: (ApiDefine & {path: string, method: string}) | undefined;
	function onTest(method: ApiDefine & {path: string, method: string}) {
		testMethod = method;
	}
	function onCloseTest() {
		testMethod = undefined;
	}
	let listDiv: HTMLDivElement;
	function onDragStart(ev: PointerEvent) {
		let listWidth = listDiv.offsetWidth;
		let mask = document.createElement('div');
		mask.className = 'drag-mask';
		document.body.appendChild(mask);
		let activeId = ev.pointerId;
		mask.setPointerCapture(activeId);
		let x = ev.clientX;
		mask.onpointerup = (ev: PointerEvent) => {
			ev.preventDefault();
			mask.releasePointerCapture(activeId);
			document.body.removeChild(mask);
		}
		mask.onpointerdown = mask.onpointerup;
		mask.oncontextmenu = mask.onpointerdown;
		mask.onmousedown = mask.onpointerdown;
		mask.onpointermove = (ev: PointerEvent) => {
			if (ev.pointerId !== activeId) {
				return;
			}
			let offsetX = ev.clientX - x;
			listDiv.style.width = (listWidth + offsetX) + 'px';
		}
	}
</script>

<main>
	<div class="title">
		<IconDoc/> <span style="margin-left:20px">API document</span>
		<span style="flex:1"></span>
		<div class="search {isFocused?'focused':''}">
			<IconSearch size="1rem"/>
			<input on:focus={searchFocus} on:blur={searchBlur} on:keypress={keypress} bind:value={keyword}>
			<div class="icon" on:click={clear}><IconClose size="1rem" color={keyword?'':'transparent'}/></div>
		</div>
	</div>
	<div class="doc">
		<div class="list" bind:this={listDiv}>
			{#if searchText}
				{#each entryList as item}
				<ListItem item={item} showPath={true} setActive={setActive}/>
				{/each}
			{:else}
				{#each api as item}
				<ListItem item={item} setActive={setActive}/>
				{/each}
			{/if}
		</div>
		<div class="drag" on:pointerdown|preventDefault={onDragStart}></div>
		<div class="content">
			{#if activeItem}
				<Doc item={activeItem} {onTest}/>
			{:else}
				<div class="doc-free"><span>Welcome</span></div>
			{/if}
		</div>
	</div>
	{#if testMethod }
	<Test {testMethod} onClose={onCloseTest} />
	{/if}
</main>

<style>
	main {
		height: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	main>div.doc>div.drag {
		width: 10px;
		cursor: ew-resize;
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
		display: grid;
		grid-auto-rows: 40px;
		padding: 20px 0px;
		background-color: #f8f8f8;
	}
	div.content {
		flex:1;
		overflow: auto;
	}

	div.content div.doc-free {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #ddd;
	}
	div.content div.doc-free span {
		font-style: italic;
    font-weight: bold;
    color: #fff;
    text-shadow: 0px 0px 4px #ccc;
    font-size: 8rem;
		user-select: none;
	}

	div.search {
		display: flex;
		flex-direction: row;
		align-items: center;
		background-color: #a0c0ff;
		transition: background-color 0.5s;
		border-radius: 50px;
		padding:0 10px;
		color: #555;
		overflow: hidden;
	}

	div.search.focused {
		background-color: white;
	}
	div.search>input {
		border: none;
		outline: none;
		background-color: transparent;
	}
	div.search>div.icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

</style>
