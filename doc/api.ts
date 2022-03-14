import type {
	AllRule,
	AnyRule,
	BetweenRule,
	CheckRule,
	DateRule,
	EqualRule,
	NeedRule,
	PatternRule,
	PrimitiveRule,
	RangeRule,
	Rule,
	UnionRule,
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
	rules: (AnyRule | AllRule | ValueRule | DateRule | EqualRule | RangeRule | BetweenRule | PatternRule)[],
	valueType: string
): string {
	const text = getChecks(rules, valueType);
	if (text.length > 1) {
		return text.join(' 且 ');
	} else if (text.length === 1) {
		return text[0];
	} else {
		return '无';
	}
}

export function getRuleCheckDesc(r: PrimitiveRule | NeedRule | UnionRule): string {
	if (r.type === 'need') {
		if (r.rule) {
			return getRuleCheckDesc(r.rule);
		} else {
			return '无';
		}
	} else if (r.type === 'union') {
		return '';
	} else {
		return getCheckDesc(any(r.rules), r.type);
	}
}

export function getRuleTypeName(r: Rule): string {
	if (r.type === 'need') {
		return (r as NeedRule).rule ? getRuleTypeName(any((r as NeedRule).rule)) : '未指定类型';
	} else if (r.type === 'union') {
		let txt = (r as UnionRule).rules
			.filter((sr) => sr.type !== 'mismatch')
			.map((sr) => typeToName(sr.type))
			.join(',');
		if (!txt) {
			txt = '未指定类型';
		}
		return txt;
	} else {
		return typeToName(r.type);
	}
}

function getAnyDesc(r: AnyRule, valueType: string): string {
	return '(' + getChecks(any(r.rules), valueType).join(' 或 ') + ')';
}

function getChecks(
	rules: (AnyRule | AllRule | ValueRule | DateRule | EqualRule | RangeRule | BetweenRule | PatternRule)[],
	valueType: string
): string[] {
	function getPrefix(type: string): string {
		if (valueType !== 'string' || type === 'pattern') {
			return '';
		} else {
			return '长度';
		}
	}
	const text = rules
		.map((r) => {
			if (r.type === 'all') {
				return getCheckDesc(any(r.rules), valueType);
			} else if (r.type === 'any') {
				return getAnyDesc(r, valueType);
			} else if (r.type === 'after') {
				return `${getPrefix(r.type)}在[${r.value}]之后`;
			} else if (r.type === 'before') {
				return `${getPrefix(r.type)}在[${r.value}]之前`;
			} else if (r.type === 'between') {
				return `${getPrefix(r.type)}在[${r.begin}]和[${r.end}]之间`;
			} else if (r.type === 'begin') {
				return `${getPrefix(r.type)}开始于[${r.value}]`;
			} else if (r.type === 'end') {
				return `${getPrefix(r.type)}结束于[${r.value}]`;
			} else if (r.type === 'equal') {
				return `${getPrefix(r.type)}等于[${r.value}]`;
			} else if (r.type === 'less') {
				return `${getPrefix(r.type)}小于[${r.value}]`;
			} else if (r.type === 'more') {
				return `${getPrefix(r.type)}大于[${r.value}]`;
			} else if (r.type === 'min') {
				return `${getPrefix(r.type)}大于等于[${r.value}]`;
			} else if (r.type === 'max') {
				return `${getPrefix(r.type)}小于等于[${r.value}]`;
			} else if (r.type === 'range') {
				return `${getPrefix(r.type)}介于[${r.min}]和[${r.max}]之间`;
			} else if (r.type === 'pattern') {
				return `匹配表达式：${r.regex}`;
			} else {
				return '';
			}
		})
		.filter((t) => !!t);
	return text;
}
