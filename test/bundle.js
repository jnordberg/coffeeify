var test = require('tap').test;
var browserify = require('browserify');
var vm = require('vm');

function bundle (description, file) {
    test('bundle transform handles ' + description, function (t) {
        t.plan(1);
        var b = browserify();
        b.add(__dirname + file);
        b.transform(__dirname + '/..');
        b.bundle(function (err, src) {
            if (err) t.fail(err);
            vm.runInNewContext(src, {
                console: { log: log }
            });
        });

        function log (msg) {
            t.equal(msg, 555);
        }
    });
}

bundle('coffee root with explicit extensions', '/../example/foo.coffee');
bundle('litcoffee root with explicit extensions', '/../example/foo.litcoffee');

// Test automatic .coffee/.litcoffee extension handling.
bundle('coffee root with resolved js extensions', '/../example/zap1.coffee');
bundle('litcoffee root with resolved coffee extensions', '/../example/zap2.litcoffee');
bundle('js root with resolved litcoffee extensions', '/../example/zap3.js');

bundle('coffee including subfolder with coffee index', '/../example/sub-coffee.coffee');
bundle('js including subfolder with coffee index', '/../example/sub-coffee.js');
bundle('litcoffee including subfolder with coffee index', '/../example/sub-coffee.litcoffee');

bundle('coffee including subfolder with js index', '/../example/sub-js.coffee');
bundle('js including subfolder with js index', '/../example/sub-js.js');
bundle('litcoffee including subfolder with js index', '/../example/sub-js.litcoffee');

bundle('coffee including npm module', '/../example/npm.coffee');
bundle('js including npm module', '/../example/npm.js');
bundle('litcoffee including npm module', '/../example/npm.litcoffee');