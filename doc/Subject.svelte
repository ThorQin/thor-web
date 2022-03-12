<script type="ts">
	import Icon from 'svelte-material-icons/Anchor.svelte';
	export let title: string;
</script>
<div><Icon /><span style="margin-left:10px;vertical-align: middle;">{title}</span><span style="flex:1"></span></div>
<style>
	div {
		user-select: none;
		padding: 10px 20px;
		display: inline-flex;
		align-items: center;
		background-color: #aaa;
		color: white;
		border-radius: 5px;
		margin: 10px 0;
		margin-top: 20px;
		font-size: 1rem;
		font-family: 'Courier New', Courier, monospace;
	}
</style>
