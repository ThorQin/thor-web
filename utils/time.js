const shortWeeks = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weeks = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function hasProp(obj, propName) {
	return Object.prototype.hasOwnProperty.call(obj, propName);
}

function paddingNumber(v, min, max, alignLeft = false) {
	var result = Math.abs(v) + '';
	while (result.length < min) {
		result = '0' + result;
	}
	if (typeof max === 'number' && result.length > max) {
		if (alignLeft)
			result = result.substr(0, max);
		else
			result = result.substr(result.length - max, max);
	}
	if (v < 0)
		result = '-' + result;
	return result;
}


function now() {
	return new Date();
}

/**
 * Input seconds and get a time description
 * @param {number} seconds Tims distance of seconds
 */
function timespan(seconds) {
	var desc = ['day', 'hour', 'minute', 'second'];
	var val = [];
	var beg = '', end = '';
	var d = Math.floor(seconds / 86400);
	val.push(d);
	seconds = seconds % 86400;
	var h = Math.floor(seconds / 3600);
	val.push(h);
	seconds = seconds % 3600;
	var m = Math.floor(seconds / 60);
	val.push(m);
	val.push(seconds % 60);
	var i = 0, j = 3;
	while (i < 4) {
		if (val[i] > 0) {
			beg.length && (beg += ' ');
			beg += val[i] + ' ' + (val[i] > 1 ? desc[i] + 's' : desc[i]);
			break;
		}
		i++;
	}
	while (i < j) {
		if (val[j] > 0) {
			end.length && (end += ' ');
			end += val[j] + ' ' + (val[j] > 1 ? desc[j] + 's' : desc[j]);
			break;
		}
		j--;
	}
	i++;
	while (i < j) {
		beg.length && (beg += ' ');
		beg += val[i] + ' ' + (val[i] > 1 ? desc[i] + 's' : desc[i]);
		i++;
	}
	return beg + (beg.length ? ' ' : '') + end;
}

/**
 * Get the distance of dt2 compare to dt1 (dt2 - dt1) return in specified unit (d: day, h: hours, m: minutes, s: seconds, ms: milliseconds)
 * @param {string|number|Date} dt1
 * @param {string|number|Date} dt2
 * @param unit "d", "h", "m", "s" or "ms"
 */
function dateDiff(dt1, dt2, unit = 'd') {
	var d1 = parseDate(dt1).getTime();
	var d2 = parseDate(dt2).getTime();
	var diff = d2 - d1;
	var symbol = diff < 0 ? -1 : 1;
	diff = Math.abs(diff);
	unit = unit.toLocaleLowerCase();
	if (unit === 'd') {
		return Math.floor(diff / 86400000) * symbol;
	} else if (unit === 'h') {
		return Math.floor(diff / 3600000) * symbol;
	} else if (unit === 'm') {
		return Math.floor(diff / 60000) * symbol;
	} else if (unit === 's') {
		return Math.floor(diff / 1000) * symbol;
	} else if (unit === 'ms') {
		return diff * symbol;
	} else
		return NaN;
}

/**
 * Get new date of dt add specified unit of values.
 * @param {string|number|Date} dt The day of the target
 * @param {number} val Increased value
 * @param unit "y", "M", "d", "h", "m", "s" or "ms"
 */
function dateAdd(dt, val, unit = 'd') {
	if (!(dt instanceof Date)) {
		dt = parseDate(dt);
	}
	var tm = dt.getTime();
	if (isNaN(tm)) {
		return dt;
	}
	if (unit === 'y') {
		let y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
		let h = dt.getHours(), mi = dt.getMinutes(), s = dt.getSeconds(), ms = dt.getMilliseconds();
		let totalMonth = y * 12 + m + (val * 12);
		y = Math.floor(totalMonth / 12);
		m = totalMonth % 12;
		let newDate = new Date(y, m, 1);
		if (d > totalDaysOfMonth(newDate))
			d = totalDaysOfMonth(newDate);
		return new Date(y, m, d, h, mi, s, ms);
	} else if (unit === 'M') {
		let y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
		let h = dt.getHours(), mi = dt.getMinutes(), s = dt.getSeconds(), ms = dt.getMilliseconds();
		let totalMonth = y * 12 + m + val;
		y = Math.floor(totalMonth / 12);
		m = totalMonth % 12;
		let newDate = new Date(y, m, 1);
		if (d > totalDaysOfMonth(newDate))
			d = totalDaysOfMonth(newDate);
		return new Date(y, m, d, h, mi, s, ms);
	} else if (unit === 'd') {
		return new Date(tm + val * 86400000);
	} else if (unit === 'h') {
		return new Date(tm + val * 3600000);
	} else if (unit === 'm') {
		return new Date(tm + val * 60000);
	} else if (unit === 's') {
		return new Date(tm + val * 1000);
	} else if (unit === 'ms') {
		return new Date(tm + val);
	} else
		return null;
}

/**
 * Get day in year
 * @param {Date} dt The day of the target
 */
function dayOfYear(dt) {
	var y = dt.getFullYear();
	var d1 = new Date(y, 0, 1);
	return dateDiff(d1, dt, 'd');
}

/**
 * Get total days of month
 * @param {Date} dt The day of the target
 */
function totalDaysOfMonth(dt) {
	var y = dt.getFullYear();
	var m = dt.getMonth();
	var d1 = new Date(y, m, 1);
	if (m === 11) {
		y++;
		m = 0;
	} else {
		m++;
	}
	var d2 = new Date(y, m, 1);
	return dateDiff(d1, d2, 'd');
}

function parseDateInternal(dtStr, format) {
	if (!dtStr || !format)
		return null;
	var mapping = {};
	var gcount = 0;
	var isUTC = false;

	var values = {};
	function matchEnum(v, key, enumArray) {
		var m = dtStr.match(new RegExp('^' + enumArray.join('|'), 'i'));
		if (m === null)
			return false;
		v = m[0].toLowerCase();
		v = v.substr(0, 1).toUpperCase() + v.substr(1);
		values[key] = enumArray.indexOf(v);
		dtStr = dtStr.substr(v.length);
		return true;
	}
	function matchNumber(v, key, min, max) {
		var len = v.length;
		if (len == 0)
			return false;
		var m = dtStr.match('^[0-9]{1,' + len + '}');
		if (m === null)
			return false;
		v = m[0];
		var num = parseInt(v);
		if (num < min || num > max)
			return false;
		key && (values[key] = num);
		dtStr = dtStr.substr(v.length);
		return true;
	}
	var rule = {
		'y+': function (v) {
			if (!matchNumber(v, 'year'))
				return false;
			if (values['year'] < 100)
				values['year'] += 1900;
			return true;
		},
		'M+': function (v) {
			var len = v.length;
			if (len < 3) {
				if (!matchNumber(v, 'month', 1, 12))
					return false;
				values['month'] -= 1;
				return true;
			} else if (len === 3) {
				return matchEnum(v, 'month', shortMonths);
			} else {
				return matchEnum(v, 'month', months);
			}
		},
		'd+': function (v) {
			return matchNumber(v, 'date', 1, 31);
		},
		'D+': matchNumber,
		'h+': function (v) {
			return matchNumber(v, '12hour', 1, 12);
		},
		'H+': function (v) {
			return matchNumber(v, 'hour', 0, 24);
		},
		'm+': function (v) {
			return matchNumber(v, 'minute', 0, 59);
		},
		's+': function (v) {
			return matchNumber(v, 'second', 0, 59);
		},
		'[qQ]+': function (v) {
			return matchNumber(v, null, 1, 4);
		}, //quarter
		'S+': function (v) {
			return matchNumber(v, 'millisecond', 0, 999);
		},
		'E+': function (v) {
			var len = v.length;
			if (len < 3) {
				if (!matchNumber(v, null, 0, 6))
					return false;
				return true;
			} else if (len === 3) {
				return matchEnum(v, null, shortWeeks);
			} else {
				return matchEnum(v, null, weeks);
			}
		},
		'a|A': function (v) {
			// var len = v.length;
			var m = dtStr.match(/^(am|pm)/i);
			if (m === null)
				return false;
			v = m[0];
			values['ampm'] = v.toLowerCase();
			dtStr = dtStr.substr(v.length);
			return true;
		},
		'z+': function (v) {
			var len = v.length;
			var m;
			if (len <= 2)
				m = dtStr.match(/^([-+][0-9]{2})/i);
			else if (len === 3)
				m = dtStr.match(/^([-+][0-9]{2})([0-9]{2})/i);
			else
				m = dtStr.match(/^([-+][0-9]{2}):([0-9]{2})/i);
			if (m === null)
				return false;
			v = m[0];
			var tz = parseInt(m[1]);
			if (Math.abs(tz) < -11 || Math.abs(tz) > 11)
				return false;
			tz *= 60;
			if (typeof m[2] !== 'undefined') {
				if (tz > 0)
					tz += parseInt(m[2]);
				else
					tz -= parseInt(m[2]);
			}
			values['tz'] = -tz;
			dtStr = dtStr.substr(v.length);
			return true;
		},
		'Z': function (/* v */) {
			if (dtStr.substr(0, 1) !== 'Z')
				return false;
			isUTC = true;
			dtStr = dtStr.substr(1);
			return true;
		},
		'"[^"]*"|\'[^\']*\'': function (v) {
			v = v.substr(1, v.length - 2);
			if (dtStr.substr(0, v.length).toLowerCase() !== v.toLowerCase())
				return false;
			dtStr = dtStr.substr(v.length);
			return true;
		},
		'[^yMmdDhHsSqEaAzZ\'"]+': function (v) {
			v = v.replace(/(.)/g, '\\$1');
			var m = dtStr.match(new RegExp('^' + v));
			if (m === null)
				return false;
			v = m[0];
			dtStr = dtStr.substr(v.length);
			return true;
		}
	};
	var regex = '';
	for (let k in rule) {
		if (!hasProp(rule, k))
			continue;
		if (regex.length > 0)
			regex += '|';
		regex += '(^' + k + ')';
		mapping[k] = ++gcount;
	}

	var result;
	while ((result = format.match(regex)) !== null) {
		for (let k in mapping) {
			var v = result[mapping[k]];
			if (typeof v == 'string' && v) {
				if (rule[k](v) === false)
					return null;
				break;
			}
		}
		format = format.substr(result[0].length);
	}
	if (format.length > 0 || dtStr.length > 0)
		return null;
	var parseCount = 0;
	for (let k in values) {
		if (!hasProp(values, k))
			continue;
		parseCount++;
	}
	if (parseCount <= 0)
		return null;
	var now = new Date();
	var year = hasProp(values, 'year') ? values['year'] : (isUTC ? now.getUTCFullYear() : now.getFullYear());
	var month = hasProp(values, 'month') ? values['month'] : (isUTC ? now.getUTCMonth() : now.getMonth());
	var date = hasProp(values, 'date') ? values['date'] : (isUTC ? now.getUTCDate() : now.getDate());
	var ampm = hasProp(values, 'ampm') ? values['ampm'] : 'am';
	var hour;
	if (hasProp(values, 'hour'))
		hour = values['hour'];
	else if (hasProp(values, '12hour')) {
		var h12 = values['12hour'];
		if (ampm === 'am') {
			if (h12 >= 1 && h12 <= 11) {
				hour = h12;
			} else if (h12 === 12) {
				hour = h12 - 12;
			} else
				return null;
		} else {
			if (h12 === 12)
				hour = h12;
			else if (h12 >= 1 && h12 <= 11)
				hour = h12 + 12;
			else
				return null;
		}
	} else
		hour = 0;
	var minute = hasProp(values, 'minute') ? values['minute'] : 0;
	var second = hasProp(values, 'second') ? values['second'] : 0;
	var millisecond = hasProp(values, 'millisecond') ? values['millisecond'] : 0;
	var tz = hasProp(values, 'tz') ? values['tz'] : now.getTimezoneOffset();
	now.setUTCFullYear(year);
	now.setUTCDate(1); // Fix IE bug
	now.setUTCMonth(month);
	now.setUTCDate(date);
	now.setUTCHours(hour);
	now.setUTCMinutes(minute);
	now.setUTCSeconds(second);
	now.setUTCMilliseconds(millisecond);
	if (!isUTC) {
		now.setTime(now.getTime() + tz * 60 * 1000);
	}
	return now;
}

/**
 * Parse string get date instance (
 * try to parse format:
 *		yyyy-MM-dd HH:mm:ss，
 *		yyyy-MM-dd,
 *		dd MMM yyyy,
 *		MMM dd, yyyy,
 *		ISO8601 format)
 * @param {string|number|Date} dtStr Date string
 * @param {string} format Date time format string
 */
function parseDate(dtStr, format = null) {
	if (dtStr instanceof Date) {
		return dtStr;
	} else if (typeof dtStr === 'number') {
		return new Date(dtStr);
	} else if (typeof format === 'string')
		return parseDateInternal(dtStr, format);
	else if (typeof format === 'undefined' || format === null) {
		for (let f of [
			'yyyy-MM-dd HH:mm:ss.SSS',
			'yyyy-MM-ddTHH:mm:sszzz',
			'yyyy-MM-dd',
			'yyyy-MM-dd HH:mm:ss',
			'MMM dd, yyyy HH:mm:ss',
			'MMM dd, yyyy',
			'dd MMM yyyy HH:mm:ss',
			'dd MMM yyyy',
			'HH:mm:ss'
		]) {
			let dt = parseDateInternal(dtStr, f);
			if (dt !== null)
				return dt;
		}
		let dt = new Date(dtStr);
		if (!isNaN(dt.getTime()))
			return dt;
	}
	return null;
}

/**
 * Convert date to string and output can be formated to ISO8601, RFC2822, RFC3339 or other customized format
 * @param {Date} dt  Date object to be convert
 * @param {string} dateFmt which format should be apply, default use ISO8601 standard format
 */
function formatDate(dt, dateFmt = 'yyyy-MM-ddTHH:mm:sszzz') {
	var isUTC = (dateFmt.indexOf('Z') >= 0 ? true : false);
	var fullYear = isUTC ? dt.getUTCFullYear() : dt.getFullYear();
	var month = isUTC ? dt.getUTCMonth() : dt.getMonth();
	var date = isUTC ? dt.getUTCDate() : dt.getDate();
	var hours = isUTC ? dt.getUTCHours() : dt.getHours();
	var minutes = isUTC ? dt.getUTCMinutes() : dt.getMinutes();
	var seconds = isUTC ? dt.getUTCSeconds() : dt.getSeconds();
	var milliseconds = isUTC ? dt.getUTCMilliseconds() : dt.getMilliseconds();
	var day = isUTC ? dt.getUTCDay() : dt.getDay();

	var rule  = {
		'y+': fullYear,
		'M+': month + 1,
		'd+': date,
		'D+': dayOfYear(dt) + 1,
		'h+': (function (h) {
			if (h === 0)
				return h + 12;
			else if (h >= 1 && h <= 12)
				return h;
			else if (h >= 13 && h <= 23)
				return h - 12;
		})(hours),
		'H+': hours,
		'm+': minutes,
		's+': seconds,
		'q+': Math.floor((month + 3) / 3), //quarter
		'S+': milliseconds,
		'E+': day,
		'a': (function (h) {
			if (h >= 0 && h <= 11)
				return 'am';
			else
				return 'pm';
		})(isUTC ? dt.getUTCHours() : dt.getHours()),
		'A': (function (h) {
			if (h >= 0 && h <= 11)
				return 'AM';
			else
				return 'PM';
		})(hours),
		'z+': dt.getTimezoneOffset()
	};
	var regex = '';
	for (let k in rule) {
		if (!hasProp(rule, k))
			continue;
		if (regex.length > 0)
			regex += '|';
		regex += k;
	}
	var regexp = new RegExp(regex, 'g');
	return dateFmt.replace(regexp, function (str/*, pos, source*/) {
		for (let k in rule) {
			if (str.match(k) !== null) {
				if (k === 'y+') {
					return paddingNumber(rule[k], str.length, str.length);
				} else if (k === 'a' || k === 'A') {
					return rule[k];
				} else if (k === 'z+') {
					var z = '';
					if (rule[k] >= 0) {
						z += '-';
					} else {
						z += '+';
					}
					if (str.length < 2)
						z += Math.abs(Math.floor(rule[k] / 60));
					else
						z += paddingNumber(Math.abs(Math.floor(rule[k] / 60)), 2);
					if (str.length === 3)
						z += paddingNumber(Math.abs(Math.floor(rule[k] % 60)), 2);
					else if (str.length > 3)
						z += (':' + paddingNumber(Math.abs(Math.floor(rule[k] % 60)), 2));
					return z;
				} else if (k === 'E+') {
					if (str.length < 3)
						return paddingNumber(rule[k], str.length);
					else if (str.length === 3)
						return shortWeeks[rule[k]];
					else
						return weeks[rule[k]];
				} else if (k === 'M+') {
					if (str.length < 3)
						return paddingNumber(rule[k], str.length);
					else if (str.length === 3)
						return shortMonths[rule[k] - 1];
					else
						return months[rule[k] - 1];
				} else if (k === 'S+') {
					return paddingNumber(rule[k], str.length, str.length, true);
				} else {
					return paddingNumber(rule[k], str.length);
				}
			}
		}
		return str;
	});
}

module.exports = {
	now: now,
	timespan: timespan,
	dateDiff: dateDiff,
	dateAdd: dateAdd,
	dayOfYear: dayOfYear,
	totalDaysOfMonth: totalDaysOfMonth,
	parseDate: parseDate,
	formatDate: formatDate
};
