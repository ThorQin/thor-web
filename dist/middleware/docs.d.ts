import Context from '../context';
import { Rule } from 'thor-validation';
import { Middleware } from '../types';
export interface ApiDefine {
	body?: Rule;
	params?: Rule;
	desc?: string;
}
interface ApiBase {
	type: 'api' | 'folder';
	name: string | RegExp;
}
interface ApiEntry extends ApiBase {
	type: 'api';
	methods: {
		[key: string]: ApiDefine;
	};
}
export interface ApiFolder extends ApiBase {
	type: 'folder';
	children: (ApiEntry | ApiFolder)[];
}
export declare function loadApi(apiDir: string, pathName: string): ApiFolder | null;
export declare function renderDoc(
	ctx: Context,
	apiFolder: ApiFolder,
	middleware: Middleware,
	apiDocPath: string
): Promise<void>;
export {};
