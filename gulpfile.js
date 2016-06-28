'use strict'
var gulp = require('gulp');
var merge = require('merge-stream');
var sass = require('gulp-sass');
var minifycss = require('gulp-minify-css');
var concat = require('gulp-concat');
var replace = require('gulp-replace');
var iconfont = require('gulp-iconfont');
var svgmin = require('gulp-svgmin');
var consolidate = require('gulp-consolidate');
var rename = require('gulp-rename');
var foreach = require('gulp-foreach');
var exec = require('child_process').exec;
var babel = require('gulp-babel');
var uglify = require('gulp-uglify');
var del = require('del');
var util = require('gulp-util');
var zip = require('gulp-zip');
var ftp = require('vinyl-ftp');
var minimist = require('minimist');
var deployargs = minimist(process.argv.slice(2));
var conn = ftp.create({
    host: deployargs.host,
    user: deployargs.user,
    password: deployargs.password,
    log: util.log
});
var timestamp = Math.round(Date.now() / 1000);

gulp.task('default', ['cachebust']);

//clean generated files
gulp.task('clean', function() {
    return del(['dist', 'doc/_site', 'doc/files/catfw.zip', 'doc/css/catfw.min.css', 'doc/css/fonts/catif.*', 'doc/js/catfw.min.js','doc/files/*']);
});

//generate icon font from svg files
gulp.task('iconfont', ['clean'], function() {
    var fsiconfont = gulp.src('fonts/svg/*.svg')
        //minify svg source files
        .pipe(foreach(function(stream, file) {
            return stream
                .pipe(svgmin())
                .pipe(concat(file.path))
        }))
        // generate icon font
        .pipe(gulp.dest('fonts/svg'))
        .pipe(iconfont({
            normalize: true,
            fontHeight: 1000,
            descent: 64,
            fontName: 'catif',
            metadata: 'Catenology Icon Font',
            version: 'v1.0',
            appendCodepoints: true,
            fontPath: 'fonts',
            formats: ['ttf', 'eot', 'woff', 'svg'],
            timestamp: timestamp
        }))
        //generate _icons.scss
        .on('glyphs', function(glyphs) {
            var options = {
                fontName: 'catif',
                fontPath: 'fonts/',
                className: 'catif',
                timestamp: timestamp,
                glyphs: glyphs.map(function(glyph) {
                    return {
                        codepoint: glyph.unicode[0].charCodeAt(0).toString(16).toUpperCase(),
                        name: glyph.name
                    }
                })
            };
            glyphs.forEach(function(glyph, idx, arr) {
                arr[idx].glyph = glyph.unicode[0].charCodeAt(0).toString(16).toUpperCase()
            });
            gulp.src('fonts/_template.scss')
                .pipe(consolidate('lodash', options))
                .pipe(rename('_icons.scss'))
                .pipe(gulp.dest('sass/'));
        })
        .pipe(gulp.dest('dist/fonts/'));
    return fsiconfont;
});

//compile stylesheet
gulp.task('styles', ['iconfont'], function() {
    var fsstyles = gulp.src('sass/main.scss')
        //compile sass
        .pipe(sass())
        .pipe(rename('catfw.css'))
        .pipe(gulp.dest('dist'))
        //minify
        .pipe(minifycss())
        .pipe(rename('catfw.min.css'))
        .pipe(gulp.dest('dist'));
    return fsstyles;
});

//compile javascript
gulp.task('scripts', ['styles'], function() {
    var fsscripts = gulp.src('js/main.js')
        //compile babel
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(rename('catfw.js'))
        .pipe(gulp.dest('dist'))
        //minify
        .pipe(uglify())
        .pipe(rename('catfw.min.js'))
        .pipe(gulp.dest('dist'));
    return fsscripts;
});

//just concat a sass file
gulp.task('justsass', function() {
    var fsjustsass = gulp.src(['sass/_variables.scss', 'sass/mixins/*.scss', 'sass/_typography.scss', 'sass/_code.scss', 'sass/_grid.scss', 'sass/_buttons.scss', 'sass/_links.scss', 'sass/_labels.scss', 'sass/_images.scss', 'sass/_dialog.scss', 'sass/_carousel.scss', 'sass/_navbar.scss', 'sass/_modal.scss', 'sass/_pagination.scss', 'sass/_animation.scss', 'sass/_icons.scss', 'sass/_utilities.scss'])
        .pipe(concat('catfw.scss'))
        .pipe(gulp.dest('dist'));
    return fsjustsass;
});

//zip dist folder files
gulp.task('zip', ['scripts'], function() {
    var fszip = gulp.src('dist/**')
        .pipe(zip('catfw.zip'))
        .pipe(gulp.dest('dist'));
    return fszip;
});

//copy files
gulp.task('copyfiles', ['zip'], function() {
    //files for downloading
    var fsdist = gulp.src('dist/**')
        .pipe(gulp.dest('doc/files'));
    //files for documentation site
    var fscss = gulp.src(['dist/*.min.css'])
        .pipe(gulp.dest('doc/css'));
    var fsfonts = gulp.src(['dist/fonts/*.ttf', 'dist/fonts/*.woff', 'dist/fonts/*.svg', 'dist/fonts/*.eot'])
        .pipe(gulp.dest('doc/css/fonts'));
    var fsjs = gulp.src(['dist/*.min.js'])
        .pipe(gulp.dest('doc/js'));
    // merge stream
    var fscopyfiles = merge(fsdist, fscss, fsfonts, fsjs);
    return fscopyfiles;
});

gulp.task('jekyll', ['copyfiles'], function(cb) {
    //jekyll build the site
    exec(['jekyll b --source doc --destination doc/_site'], function(err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    })
});

//add timestamp to static assets to bust cache
gulp.task('cachebust', ['jekyll'], function() {
    var fscachebust = gulp.src(['doc/_site/**/*.html', 'doc/_site/**/*.md'])
        .pipe(replace(/@@hash/g, timestamp))
        .pipe(gulp.dest('doc/_site/'));
    return fscachebust;
});

//ftp deployment
gulp.task('deploy', ['cleanremote'], function() {
    var fsdeploy = gulp.src('doc/_site/**/*.*')
        .pipe(conn.dest('catfw'));
    return fsdeploy;
});

//clean remote folder on ftp server
gulp.task('cleanremote', function(cb) {
    return conn.rmdir('catfw', function(err) {
        cb();
    });
});
