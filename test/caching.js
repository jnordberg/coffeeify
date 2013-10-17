var fs = require('fs');
var path = require('path');
var vm = require('vm');
var browserify = require('browserify');
var coffeeify = require('../');
var test = require('tap').test;

function TemporaryFile(options) {
    var name = 'tmp-' + Math.random().toString().slice(2);
    this.path = path.join(__dirname, name + options.extension);
    if (options.contents) {
        this.edit(options.contents)
    }
}

TemporaryFile.prototype.edit = function(contents) {
    fs.writeFileSync(this.path, contents);
}

TemporaryFile.prototype.destroy = function(contents) {
    if (fs.existsSync(this.path)) {
        fs.unlinkSync(this.path);
    }
}

function testCachedBuild(extension, preCode) {
    test('build caching handles updates to ' + extension + ' files', function (t) {
        t.plan(4);

        // Create a temporary file that we can update.
        var file = new TemporaryFile({extension: extension});
        var jsFile = new TemporaryFile({extension: '.js', contents: 'require("' + file.path + '")'});

        // Swap the compiler for one that we can track.
        var originalCompile = coffeeify.compile;
        var stats = {};
        coffeeify.compile = function(file) {
            stats[file] = stats[file] || 0;
            stats[file]++;
            originalCompile.apply(this, arguments);
        };

        // If things go south, we don't want temp files and monkeypatched
        // coffeeify's hanging around.
        function cleanup() {
            coffeeify.compile = originalCompile;
            file.destroy();
            jsFile.destroy();
        }
        process.on('exit', cleanup);
        process.on('uncaughtException', cleanup);
        process.on('SIGINT', cleanup);

        // Create the bundle.
        var b = browserify();
        b.add(jsFile.path);
        b.transform(coffeeify);

        var compileCounts = [];
        var logMessages = [];

        function bundle(next) {
            b.bundle(function(err, src) {
                if (err) {
                    cleanup();
                    t.fail(err);
                }
                vm.runInNewContext(src, {
                    console: {
                        log: function log(msg) {
                            compileCounts.push(stats[file.path]);
                            logMessages.push(msg);
                            next();
                        }
                    }
                });
            });
        }

        // Bundle a few times in a row to ensure that compilation
        // only happens when the file changes.
        preCode = preCode || '';
        file.edit(preCode + 'console.log(777)');
        bundle(function() {
            bundle(function() {

                // Wait 1 second to make sure the mtimes are different.
                setTimeout(function() {
                    file.edit(preCode + 'console.log(888)');
                    bundle(function() {
                        bundle(function() {

                            cleanup();

                            t.equal(compileCounts.length, 4);
                            t.equal(logMessages.length, 4);

                            t.deepEqual(compileCounts, [1, 1, 2, 2]);
                            t.deepEqual(logMessages, [777, 777, 888, 888]);

                        });
                    });

                }, 1000);
            });
        });

    });
}

testCachedBuild('.coffee');
testCachedBuild('.litcoffee', 'this is a litcoffee temp file\n\n    ');