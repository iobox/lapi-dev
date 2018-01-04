require('babel-register');
const gulp = require('gulp');
const path = require('path');
const babel = require('gulp-babel');
const clean = require('gulp-clean');
const mocha = require('gulp-mocha');
const concat = require('gulp-concat');
const clc = require('cli-color');
const nodemon = require('gulp-nodemon');
const fs = require('fs');

const buildDir = 'build';
const srcDir = 'src';
const testDir = 'test';
const distDir = 'dist';
const sources = [path.join(srcDir, '**', '*.js')];
const tests = [path.join(testDir, '**', '*.js')];
const buildTests = tests.map(v => path.join(buildDir, v));
const buildFiles = path.join(buildDir, '**', '*.*');
const dists = [path.join(distDir, '**', '*.js')];

var $exports = {};
$exports.registerGulpTasks = function (mochaOptions) {
  gulp.task('default', ['build']);

  gulp.task('clean', ['clean:src', 'clean:test']);
  gulp.task('clean:src', function () {
    return gulp.src(path.join(buildDir, srcDir), {read: false})
      .pipe(clean());
  });
  gulp.task('clean:test', function () {
    return gulp.src(path.join(buildDir, testDir), {read: false})
      .pipe(clean());
  });

  gulp.task('build', ['build:src', 'build:test']);
  gulp.task('build:src', ['clean:src'], function () {
    return gulp.src(sources)
      .pipe(babel())
      .pipe(gulp.dest(path.join(buildDir, srcDir)))
      .pipe(gulp.dest(path.join(distDir)));
  });
  gulp.task('build:test', ['clean:test'], function () {
    return gulp.src(tests)
      .pipe(babel())
      .pipe(gulp.dest(path.join(buildDir, testDir)));
  });

  var setUpTests = function (paths, options) {
    if (options === undefined) {
      options = {};
    }
    var def = {
      reporter: 'landing'
    };
    def = Object.assign(def, mochaOptions || {});
    gulp.src(paths)
      .pipe(mocha(Object.assign(def, options)))
      .on('error', function (e) {
        if (typeof e.stack === 'undefined') return;
        console.log(clc.red(`[ERROR] ${e.stack}`));
        this.emit(e);
      });
  };
  gulp.task('test', ['build'], function () {
    setUpTests(buildTests, {
      reporter: 'dot'
    });
  });
  gulp.task('test:quick', [], function () {
    setUpTests(tests.map(v => path.join('', v)));
  });
  gulp.task('watch:test', ['test:quick'], function () {
    gulp.watch([].concat(sources, tests), ['test:quick']);
  });
  gulp.task('watch:build', ['build'], function () {
    gulp.watch([].concat(sources, tests), ['build']);
  });
  gulp.task('indexing', function () {
    var indexes = {}, stats, ignore = [path.join(srcDir, 'index.js')];
    const readDir = function (dir) {
      fs.readdirSync(path.join(dir)).forEach(function (file) {
        if (ignore.indexOf(path.join(dir, file)) >= 0) {
          return false;
        }
        stats = fs.statSync(path.join(dir, file));
        if (stats.isDirectory()) {
          readDir(path.join(dir, file));
        } else if (stats.isFile()) {
          if (file.match(/^_/)) {
            return false;
          }
          parseFile(`${dir}/${file}`);
        }
      });
    };
    const parseFile = function (file) {
      var parts = file.split('/'), node = indexes;
      parts.forEach(function (part) {
        if (part === srcDir) {
          return false;
        }

        if (part.match(/(\.js)$/)) {
          part = require('../../' + path.join.apply(null, parts)).default.name;
          parts[0] = '';
          node[part] = path.join.apply(null, parts);
        } else if (node[part.toLowerCase()] === undefined) {
          node[part.toLowerCase()] = {};
        }
        node = node[part.toLowerCase()];
      })
    };
    readDir(srcDir);

    const scripts = `
const publish = function ($object) {
  Object.keys($object).forEach(function($key) {
    if (typeof $object[$key] === 'string') {
      let pkg = require('./dist/' + $object[$key]);
      $object[$key] = typeof pkg.default !== 'undefined' ? pkg.default : pkg;
    } else if (typeof $object[$key] === 'object') {
      $object[$key] = publish($object[$key])
    }
  });
  
  return $object;
};
module.exports = publish($module);`
    const content = 'let $module = ' + JSON.stringify(indexes, null, ' ') + ';' + scripts;
    fs.writeFileSync(path.join('index.js'), content, {encoding: 'utf8'});
  });

  gulp.task('deploy', ['build', 'indexing']);
};

module.exports = $exports;
