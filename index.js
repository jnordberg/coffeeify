'use strict';

var CoffeeScript = require('coffee-script-redux');
var through = require('through2');
var extend = require('util')._extend;

function isCoffee(file) {
    return (/\.((lit)?coffee|coffee\.md)$/).test(file);
}

function isLiterate(file) {
    return (/\.(litcoffee|coffee\.md)$/).test(file);
}

function coffeeify(fileName, globalOptions) {
    if (!isCoffee(fileName)) return through();

    var data = '',
        csAST, jsAST, code;

    return through(function(chunk, encoding, callback) {
        data += chunk;
        callback(null);
    }, function(callback) {
        try {
            var options = extend({}, globalOptions || {});
            csAST = CoffeeScript.parse(data, {
                raw: true,
                literate: isLiterate(fileName),
                inputSource: fileName,
                optimise: options.optimise
            }); //parseOpts
            jsAST = CoffeeScript.compile(csAST, {}); // compileOpts

            if (coffeeify.sourceMap) {
                options.sourceMapFile = fileName; // -> targetName
                options.sourceMapName = 'unknown';
                code = CoffeeScript.js(jsAST, options.sourceMapName, options);
                //console.log(CoffeeScript.sourceMap(jsAST, options.sourceMapName, options));
            } else {
                code = CoffeeScript.js(jsAST, options);
            }
            this.push(code);
            this.push(null);
            callback();
        } catch (ex) {
            this.emit('error', (ex instanceof Error) ? ex : new Error(ex));
        }
    });
}

//coffeeify.compile = compile;
coffeeify.isCoffee = isCoffee;
coffeeify.isLiterate = isLiterate;
coffeeify.sourceMap = true; // use source maps by default

module.exports = coffeeify;