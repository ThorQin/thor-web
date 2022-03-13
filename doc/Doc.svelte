<script type="ts">
	import { any, ApiDefine, ApiEntry } from './api';
	import IconStarBox from 'svelte-material-icons/StarBox.svelte';
	import Icon from 'svelte-material-icons/SendCircle.svelte';
	import Subject from './Subject.svelte';
	import Rule from './Rule.svelte';
	export let item: ApiEntry;
	const ORDER = {
		get: 0,
		head: 1,
		post: 2,
		put: 3,
		delete: 4,
		options: 5,
		patch: 6,
		trace: 7,
		default: 8
	};
	function getMethodName(key: string, item: ApiDefine): string {
		let title = item.title ?? (key === 'default' ? '任意方法' : null);
		return title ? title + ' (' + key.toUpperCase() + ')' : key.toUpperCase() + ' 方法';
	}
</script>

<div class="main">
	<h1 style="margin-bottom: 0">
		{item.title ? item.title + ' - ' + item.path : item.path}
	</h1>
	{#each Object.entries(item.methods).sort((a, b) => {
		return (ORDER[a[0]] ?? 100) - (ORDER[b[0]] ?? 100);
	}) as [key, method]}
		<div class="method">
			<IconStarBox color="#f080a8" />
			<span style="margin-left: 10px;flex:1">{getMethodName(key, method)}</span>
			<Icon size={'1.2rem'} /><a style="margin-left:8px;font-size:1.2rem" href="javascript:void(0)">测试一下</a>
		</div>
		{#if method.desc}
		<div>
			<div><Subject title="接口说明"/></div>
			<code>{method.desc}</code>
		</div>
		{/if}
		<div>
			<div><Subject title="查询参数(query)"/></div>
			{#if typeof method.query === 'string'}
			<code>{method.query}</code>
			{:else}
			<div class="code"><Rule rule={any(method.query)} /></div>
			{/if}
		</div>
		{#if key === 'post' || key === 'put' || method.body}
		<div>
			<div><Subject title="请求体(body)"/></div>
			{#if typeof method.body === 'string'}
			<code>{method.body}</code>
			{:else}
			<div class="code"><Rule rule={any(method.body)} /></div>
			{/if}
		</div>
		{/if}
		<div>
			<div><Subject title="返回内容(response)"/></div>
			{#if typeof method.result === 'string'}
			<code>{method.result}</code>
			{:else}
			<div class="code"><Rule rule={any(method.result)} /></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	h1 {
		color: #a080ff;
		border-bottom: 1px solid #a080ff;
		font-size: 2.4rem;
	}
	div.method {
		padding: 20px 0;
		display: flex;
		align-items: center;
		color: #555;
		font-size: 2rem;
		font-family: 'Courier New', Courier, monospace;
		border-bottom: 1px solid #f080a8;
		margin-top: 30px;
	}
	div.main {
		padding: 20px 40px;
		padding-bottom: 60px;
	}
	code,div.code {
		display: block;
		padding: 20px;
		font-size: 1.2rem;
		line-height: 2rem;
		font-family: 'Courier New', Courier, monospace;
		background-color: #f8f8f8;
		border-radius: 5px;
	}
</style>
