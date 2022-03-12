import type {
	AllRule,
	AnyRule,
	BetweenRule,
	CheckRule,
	DateRule,
	EqualRule,
	PatternRule,
	RangeRule,
	Rule,
	ValueRule,
} from 'thor-validation';

export interface ApiDefine {
	body?: Rule;
	query?: Rule;
	result?: Rule;
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
	active: boolean;
}

export interface ApiFolder extends ApiBase {
	type: 'folder';
	path: string;
	methods: {
		[key: string]: ApiDefine;
	};
	children: (ApiEntry | ApiFolder)[];
	expend: boolean;
}

export function any<T, R>(input: T): R {
	return input as unknown as R;
}

export function typeToName(type: string): string {
	if (type === 'object') {
		return '对象';
	} else if (type === 'array') {
		return '数组';
	} else if (type === 'string') {
		return '文本';
	} else if (type === 'number') {
		return '数字';
	} else if (type === 'boolean') {
		return '布尔';
	} else if (type === 'date') {
		return '日期';
	} else {
		return '未知类型';
	}
}

export function getCheckDesc(
	rules: (AnyRule | AllRule | ValueRule | DateRule | EqualRule | RangeRule | BetweenRule | PatternRule)[]
): string {
	const text = getChecks(rules);
	if (text.length > 1) {
		return text.join(' 且 ');
	} else if (text.length === 1) {
		return text[0];
	} else {
		return '无';
	}
}

function getAnyDesc(r: AnyRule): string {
	return '(' + getChecks(any(r.rules)).join(' 或 ') + ')';
}

function getChecks(
	rules: (AnyRule | AllRule | ValueRule | DateRule | EqualRule | RangeRule | BetweenRule | PatternRule)[]
): string[] {
	const text = rules
		.map((r) => {
			if (r.type === 'all') {
				return getCheckDesc(any(r.rules));
			} else if (r.type === 'any') {
				return getAnyDesc(r);
			} else if (r.type === 'after') {
				return `在[${r.value}]之后`;
			} else if (r.type === 'before') {
				return `在[${r.value}]之前`;
			} else if (r.type === 'between') {
				return `在[${r.begin}]和[${r.end}]之间`;
			} else if (r.type === 'begin') {
				return `开始于[${r.value}]`;
			} else if (r.type === 'end') {
				return `结束于[${r.value}]`;
			} else if (r.type === 'equal') {
				return `等于[${r.value}]`;
			} else if (r.type === 'less') {
				return `小于[${r.value}]`;
			} else if (r.type === 'more') {
				return `大于[${r.value}]`;
			} else if (r.type === 'min') {
				return `大于等于[${r.value}]`;
			} else if (r.type === 'max') {
				return `小于等于[${r.value}]`;
			} else if (r.type === 'range') {
				return `介于[${r.min}]和[${r.max}]之间`;
			} else if (r.type === 'pattern') {
				return `匹配表达式：${r.regex}`;
			} else {
				return '';
			}
		})
		.filter((t) => !!t);
	return text;
}
