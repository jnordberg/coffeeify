var fs = require('fs');
var path = require('path');
var coffee = require('coffee-script');
var through = require('through');
var convert = require('convert-source-map');
var falafel = require('falafel');

function isCoffee (file) {
    return (/\.((lit)?coffee|coffee\.md)$/).test(file);
}

function isLiterate (file) {
    return (/\.(litcoffee|coffee\.md)$/).test(file);
}

function isPath (file) {
    return (/^(\.|\/)/).test(file);
}

function getExtension (file) {
  var matches = /(\.[^\.\/\\]+)$/.exec(file);
  return matches ? matches[1] : null;
}

function makeCoffeeRequiresExplicit (file, jsData) {

    // Look for `require()` statements in the AST without file extensions.
    // These will need to be resolved to find CoffeeScript files.
    return falafel(jsData, function (node) {
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
            var requireArgNode = node.arguments[0];
            var requireArg = requireArgNode.value;
            if (typeof requireArg === 'string' && !getExtension(requireArg) && isPath(requireArg)) {

                // Try to resolve the actual file to see if it is CoffeeScript.
                var fullPath = path.resolve(path.join(path.dirname(file), requireArg));
                var modulePath = require.resolve(fullPath);
                var extra = modulePath.replace(fullPath, '');

                // If this was requiring a CoffeeScript file, update the require
                // to explicitly include the extension so that browserify
                // will pick it up in its dependency graph.
                if (isCoffee(modulePath)) {
                    requireArgNode.update(JSON.stringify(requireArg + extra));
                }

            }
        }

    }).toString();
}

function ParseError(error, src, file) {
    /* Creates a ParseError from a CoffeeScript SyntaxError
       modeled after substack's syntax-error module */
    SyntaxError.call(this);

    this.message = error.message;

    this.line = error.location.first_line + 1; // cs linenums are 0-indexed
    this.column = error.location.first_column + 1; // same with columns

    var markerLen = 2;
    if(error.location.first_line === error.location.last_line) {
        markerLen += error.location.last_column - error.location.first_column;
    }
    this.annotated = [
        file + ':' + this.line,
        src.split('\n')[this.line - 1],
        Array(this.column).join(' ') + Array(markerLen).join('^'),
        'ParseError: ' + this.message
    ].join('\n');
}

ParseError.prototype = Object.create(SyntaxError.prototype);

ParseError.prototype.toString = function () {
    return this.annotated;
};

ParseError.prototype.inspect = function () {
    return this.annotated;
};

function compile(file, data, callback) {
    var compiled;
    try {
        compiled = coffee.compile(data, {
            sourceMap: true,
            generatedFile: file,
            inline: true,
            bare: true,
            literate: isLiterate(file)
        });
    } catch (e) {
        var error = e;
        if (e.location) {
            error = new ParseError(e, data, file);
        }
        callback(error);
        return;
    }

    var map = convert.fromJSON(compiled.v3SourceMap);
    map.setProperty('sources', [file]);

    callback(null, compiled.js + '\n' + map.toComment());
}

function Cache(filepath) {
    this.mtime = null;
    this.contents = null;
    this.filepath = filepath;
}

Cache.prototype.set = function (contents) {
    this.mtime = null;
    this.contents = contents;
    fs.stat(this.filepath, function (error, fileStats) {
        if (!error) {
            this.mtime = +fileStats.mtime;
        }
    }.bind(this));
}

Cache.prototype.get = function (callback) {
    fs.stat(this.filepath, function (error, fileStats) {
        if (error) return callback(error);
        if (this.mtime !== +fileStats.mtime) {
            this.contents = null;
        }
        callback(null, this.contents);
    }.bind(this));
}

var caches = {};
function coffeeify(file) {

    var data = '', stream = through(write, end), cache;
    cache = caches[file] = caches[file] || new Cache(file);

    return stream;

    function write(buf) {
        data += buf;
    }

    function end() {

        // Try cached output first.
        cache.get(function (error, cachedResult) {
            if (error) return stream.emit('error', error);
            if (cachedResult) {
                stream.queue(cachedResult);
                stream.queue(null);

            // Otherwise, generate cacheable Javascript output that has all
            // require() calls transformed with explicit .coffee extensions.
            } else {

                function finalize (code) {
                    try {
                        var finalCode = makeCoffeeRequiresExplicit(file, code);
                        cache.set(finalCode);
                        stream.queue(finalCode);
                        stream.queue(null);
                    } catch (e) {
                        stream.emit('error', e);
                    }
                }

                // Compile CoffeeScript before transforming require() calls.
                if (isCoffee(file)) {
                    coffeeify.compile(file, data, function (error, result) {
                        if (error) return stream.emit('error', error);
                        finalize(result);
                    });

                // Assume all other files are Javascript and can transform
                // calls to require() immediately.
                } else {
                    finalize(data);
                }

            }

        });
    }
}

coffeeify.compile = compile;
coffeeify.isCoffee = isCoffee;
coffeeify.isLiterate = isLiterate;

module.exports = coffeeify;
