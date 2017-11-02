var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    tslint = require('gulp-tslint'),
    ts = require('gulp-typescript'),
    mapSources = require('gulp-sourcemaps'),
    tsProject = ts.createProject('tsconfig.json', {noImplicitAny: true}),
    nodemon = require('gulp-nodemon'),
    runSequence = require('run-sequence');

// define the default task and add the watch task to it
gulp.task('default', function () {
    runSequence(['buildTs'], 'nodemon');
    // runSequence(['buildTs']);
});

// configure the jshint task
gulp.task('jshint', function () {
    return gulp.src('src/*.ts')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('lint:ts', function () {
    return gulp.src('ts/*.ts')
        .pipe(tslint({
            formatter: 'verbose'
        }))
        .pipe(tslint.report())
});

// configure which files to watch and what tasks to use on file changes
gulp.task('watch', function () {
    gulp.watch('src/*.ts', ['tslint', 'buildTs']);
});


gulp.task('buildHtml', function () {
    // copy any html files in source/ to public/
    return gulp.src('src/*.html')
        .pipe(gulp.dest('public'));
});

gulp.task('buildTs', ['lint:ts'], function () {
    return gulp.src('src/**/*.ts')
        .pipe(mapSources.init())
        //.pipe(ts({
        //	noImplicitAny: true,
        //	outFile: 'output.js'
        //}))
        .pipe(tsProject())
        .pipe(mapSources.write("."))
        .pipe(gulp.dest('public'));
});

gulp.task('nodemon', function () {
    nodemon({script: "public/server", watch: false});
});

