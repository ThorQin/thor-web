<script lang="ts">
	import { ApiDefine, getRuleExample } from "./api";
	import { fade, fly } from 'svelte/transition';
import type { NeedRule, PrimitiveRule, PropRule, Rule } from "thor-validation";
	export let testMethod: ApiDefine & {path: string, method: string};
	export let onClose: () => void;
	function closeDialog(e) {
		onClose();
	}

	let m = testMethod.method.toUpperCase();



	function getRealRule(r: Rule): Rule {
		if (r.type === 'need') {
			return (r as NeedRule ).rule;
		} else {
			return r;
		}
	}

	function hasParam(): boolean {
		if (testMethod.query && getRealRule(testMethod.query).type === 'object') {
			return (getRealRule(testMethod.query) as PrimitiveRule).rules.length > 0;
		} else {
			return false;
		}
	}
	function getProps(): string[] {
		return (getRealRule(testMethod.query) as PrimitiveRule).rules.filter(r => r.type === 'prop').map(r => (r as PropRule).name as string);
	}

	$: hasBody = (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE');
	$: postBody = hasBody && testMethod.body && testMethod.body.type ? JSON.stringify(getRuleExample(testMethod.body), null, 2) : '';
	let finalBody: string;
	$: {
		finalBody = postBody;
	}

	function setBody(e) {
		finalBody = e.target.value;
	}

	let result: string = undefined
	let errMsg: string = "";
	let showResult = false;
	let sending = false;

	function doSend() {
		if (m === 'DEFAULT') {
			err('请选择 HTTP 方法！');
			return;
		}
		let params = Array.from(document.querySelectorAll('div.param-content>div.param')).map(div => {
			let key = div.querySelector('span').textContent;
			let value = div.querySelector('input').value;
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
		});

		let url = testMethod.path + (params.length > 0 ? '?' + params.join('&') : '');

		fetch(url, {
			method: m,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			body: finalBody ? finalBody : undefined
		}).then(resp => {
			if (resp.status === 200) {
				resp.text().then(t => {
					result = t;
					errMsg = '';
					showResult = true;
				}).catch(e => {
					errMsg = (e.message || e + '');
				})
			} else {
				if (/^text\/plain(;.+)?$/.test(resp.headers.get('content-type'))) {
					resp.text().then(t => {
						errMsg = ('ERROR: ' + resp.status + ': ' + t);
					}).catch(e => {
						errMsg = ('ERROR: ' + resp.status + ': ' + resp.statusText);
					})
				} else {
					errMsg = ('ERROR: ' + resp.status + ': ' + resp.statusText);
				}
			}
		}).catch(reson => {
			errMsg = (reson.message || reson + '');
		})
	}


	function err(msg: string) {
		errMsg = msg;
	}

</script>

<div class="mask" transition:fade="{{duration: 100 }}" on:mousedown={closeDialog}>
	<div class="test-content" on:mousedown|stopPropagation={() => {}}>

		<div class="tab-bar">
			<span class="{!showResult ? 'active' : ''}" on:click="{() => { showResult = false }}">请求</span>
			<span style="color:#eee;margin:0 10px;"> | </span>
			<span class="{showResult ? 'active' : ''}" on:click="{() => { showResult = true }}">响应</span>
		</div>

		<div name="tab" class="{!showResult ? '' : 'hidden'}">
			<div class="subject">
				<div style="flex:1;padding-right: 10px;">{testMethod.path}</div>
				<div>
					<select disabled={testMethod.method !== 'default'} bind:value={m}>
						<option>GET</option>
						<option>POST</option>
						<option>HEAD</option>
						<option>PUT</option>
						<option>DELETE</option>
						<option>PATCH</option>
						<option>OPTIONS</option>
						<option>TRACE</option>
					</select>
				</div>
			</div>

			{#if hasParam()}
			<div class="section">URL参数</div>
			<div class="param-content">
				{#each getProps() as key}
					<div class="param">
						<span>{key}</span>
						<input>
					</div>
				{/each}
			</div>
			{/if}

			{#if hasBody}
			<div class="section">BODY</div>
			<textarea spellcheck="false" value={postBody} on:change="{setBody}" on:input={setBody} ></textarea>
			{/if}
			<button on:click={doSend}>{#if sending}请求中...{:else}发送{/if}</button>
			{#if errMsg}
			<div class="err">
				{errMsg}
			</div>
			{/if}
		</div>
		<div name="tab" class="{showResult ? '' : 'hidden'}" style="flex:1;height:0;background-color:#f0f0f0;border-radius: 15px;padding:20px">
			<code>{result ? result : ''}</code>
		</div>
	</div>
</div>

<style>
	code {
		height:0;
		flex:1;
		white-space: pre-wrap;
		word-wrap: break-word;
		word-break: break-all;
		overflow:hidden;
		overflow-y: auto;
		font-family: 'Courier New', Courier, monospace;
	}

div.mask {
	user-select: none;
	position: absolute;
	display: flex;
	left:0;
	top:0;
	right: 0;
	bottom: 0;
	background-color: #0005;
	z-index: 10;
	align-items: center;
	justify-content: center;
}
div.tab-bar {
	font-size: 1.2rem;
	padding: 10px;
}
div.tab-bar > span {
	display: inline-block;
	color: #888;
	padding: 10px;
	border-bottom: 2px solid transparent;
	cursor: pointer;
}
div.tab-bar > span.active {
	color: #80a0ff;
	border-bottom: 2px solid #80a0ff;
}
div.test-content {
	display: flex;
	flex-direction: column;
	background-color: #fff;
	padding: 30px;
	border-radius: 8px;
	box-shadow: 2px 2px 15px #0006;
	max-height: 80%;
	max-width: 80%;
	box-sizing: border-box;
	min-width: 600px;
}
div.test-content>div[name=tab] {
	display: flex;
	flex-direction: column;
}
div.param {
	display: flex;
	align-items: center;
	margin-top: 10px;
}
div.param>span {
	flex: 1;
}
div.param>input {
	flex: 2;
}
div.subject {
	display: flex;
	align-items: center;
	font-size: 1.4rem;
	color: #80a0ff;
	padding-bottom: 10px;
	border-bottom: 1px solid #ddd;
}
div.section {
	background-color: #eee;
	font-size: 1rem;
	padding: 10px 10px;
}
div.param-content {
	padding: 10px;
}
select {
	margin: 10px 0;
}
button {
	display: block;
	margin: 20px auto;
	background-color: #5090ff;
	color: white;
	border-radius: 3px;
	border: none;
	width: 100%;
}
button:hover {
	background-color: #4080ff;
}
button:active {
	background-color: #3070ff;
}
textarea {
	display: block;
	resize:vertical;
	min-height: 100px;
	max-height: 400px;
	font-family: 'Courier New', Courier, monospace;
}
input,textarea {
	outline: none;
}
div.err {
	color: red;
	padding: 10px;
}
div.test-content>div[name=tab].hidden {
		display: none;
	}
</style>
