module.exports = {
	'sourceType': 'module',
	'env': {
		'commonjs': true,
		'es6': true,
		'node': true
	},
	'extends': 'eslint:recommended',
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	'parserOptions': {
		'ecmaVersion': 2018
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		"no-unused-vars": [
			"warn",
			{
				"vars": "all",
				"args": "after-used",
				"argsIgnorePattern": "^_$",
				"varsIgnorePattern": "^_$"
			}
		]
	}
};
