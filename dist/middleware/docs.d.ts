import Context from '../context';
import { Rule } from 'thor-validation';
import { Middleware } from '../types';
export interface ApiDefine {
	body?: Rule | string;
	query?: Rule | string;
	result?: Rule | string;
	title?: string;
	desc?: string;
}
interface ApiBase {
	type: 'api' | 'folder';
	name: string | RegExp;
	title?: string;
}
export interface ApiEntry extends ApiBase {
	type: 'api';
	path: string;
	methods: {
		[key: string]: ApiDefine;
	};
}
export interface ApiFolder extends ApiBase {
	type: 'folder';
	path: string;
	methods: {
		[key: string]: ApiDefine;
	};
	children: (ApiEntry | ApiFolder)[];
}
export declare function loadApi(apiDir: string, fullPath: string): (ApiFolder | ApiEntry)[];
export declare function renderDoc(
	ctx: Context,
	docs: (ApiFolder | ApiEntry)[],
	middleware: Middleware,
	apiDocPath: string
): Promise<void>;
export {};
