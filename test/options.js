var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var through = require('through');
var convert = require('convert-source-map');
var sinon = require('sinon')
var proxyquire = require('proxyquire');

var spy = sinon.spy();
var transform = proxyquire('..', {
  coffeescript: {
    compile: spy,
  }
});

test('unknown options are passed along', function (t) {

  t.plan(4);
  var data = '';
  var options = { sourceMap: false, myBool: true, myObj: { foo: 123 }, myArr: [], myString: 'bar' };

  var file = path.join(__dirname, '../example/foo.coffee');
  fs.createReadStream(file).pipe(transform(file, options)).pipe(through(write, end));
  function write (buf) { data += buf }
  function end () {
    var calledWith = spy.lastCall.args[1];
    t.equal(options.myBool, calledWith.myBool, "should pass type boolean option");
    t.equal(options.myObj, calledWith.myObj, "should pass type object option");
    t.equal(options.myArr, calledWith.myArr, "should pass type array option");
    t.equal(options.myString, calledWith.myString, "should pass type string option");
  }
});
