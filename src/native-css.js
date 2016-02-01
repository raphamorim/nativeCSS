'use strict';
var packageJson = require('../package.json'),
	lib = require('../lib'),
	cssParser = require('css'),
	fetchUrl = require('fetch').fetchUrl,
	Promise = require('bluebird');

var nativeCSS = function () {
	this.isUrl = function (str) {
		// feel free to use a better pattern
		var pattern = new RegExp('^(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$', 'i');
		if (!pattern.test(str)) {
			return false;
		}
		return true;
	}
	this.version = function () {
		return ('native-css version: ' + packageJson.version)
	}
	this.help = function () {
		return lib.readFile(__dirname + '/../docs/help.md')
	}
	this.indentObject = function (obj, indent) {
		var self = this,
			result = '';
		return JSON.stringify(obj, null, indent || 0);
	}
	this.nameGenerator = function (name) {
		name = name.replace(/\s\s+/g, ' ');
		name = name.replace(/[^a-zA-Z0-9]/g, '_');
		name = name.replace(/^_+/g, '');
		name = name.replace(/_+$/g, '');
		return name;
	}
	this.mediaNameGenerator = function (name) {
		return '@media ' + name;
	}
	this.transformRules = function (self, rules, result) {
		var that = this;
		rules.forEach(function (rule) {
			var obj = {};
			if (rule.type === 'media') {
				var name = self.mediaNameGenerator(rule.media);
				var media = result[name] = result[name] || {
					"__expression__": rule.media
				};
				that.transformRules(self, rule.rules, media)
			} else if (rule.type === 'rule') {
				rule.declarations.forEach(function (declaration) {
					if (declaration.type === 'declaration') {
						obj[declaration.property] = declaration.value;
					}
				});
				rule.selectors.forEach(function (selector) {
					var name = self.nameGenerator(selector.trim());
					result[name] = obj;
				});
			}
		});
	}

	this.transform = function (css) {
		// console.log('[transform] css.stylesheet.rules', css.stylesheet.rules);
		var result = {};
		this.transformRules(this, css.stylesheet.rules, result);
		return result;
	}


	this.fetchUrlAsync = function (cssFile) {
		return new Promise(function (resolve, reject) {
			fetchUrl(cssFile, function (err, meta, body) {
				if (err) throw err;
				try {
					resolve(body.toString());
				} catch (err) {
					reject(err);
				}
			});
		});
	}

	this.convertAsync = function(cssFile) {
		 var self = this,
              path = process.cwd() + '/' + cssFile,
              error;

		return new Promise(function(resolve, reject) {
			if (!self.isUrl(cssFile)) {
				if ((require('fs').existsSync(path))) {
					var css = lib.readFile(path);
					css = cssParser.parse(css, {
						silent: false,
						source: path
					});
					return resolve(self.transform.apply(self, css));
				} else {
					reject(new Error('Ooops!\nError: CSS file not found!'));
				}
			}
			else {
				return self.fetchUrlAsync(cssFile)
					.catch(function(err) {
						reject(err);
					})
					.then(function (css) {
						var css = cssParser.parse(css, {
							silent: false,
							source: path
						});
						resolve(self.transform(css));
					});
			}
		});
	};

	this.convert = function (cssFile) {
		var path = process.cwd() + '/' + cssFile;
		if (!(require('fs').existsSync(path))) return 'Ooops!\nError: CSS file not found!';
		var self = this,
			css = lib.readFile(path);
		css = cssParser.parse(css, {
			silent: false,
			source: path
		});
		return self.transform(css);
	}

	this.generateFile = function (obj, where, react) {
		if (!where || where.indexOf('--') > -1) return console.log('Please, set a output path!');
		var self = this,
			body;
		where = process.cwd() + '/' + where;
		if (react) {
			lib.writeFile(where, 'var styles = StyleSheet.create({\n');
			body = self.indentObject(obj, 2);
			lib.appendFile(where, body + '\n});');
			return;
		}
		body = self.indentObject({
			'styles': obj
		}, 2);
		lib.writeFile(where, body);
	}
};
module.exports = new nativeCSS();
