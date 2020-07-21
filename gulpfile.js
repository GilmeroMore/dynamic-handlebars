'use strict';

/**
 install the latest Gulp 4 CLI tools globally
 $ sudo npm install gulpjs/gulp-cli -g

 install Gulp 4 into your project
 $ sudo npm install gulpjs/gulp.git#4.0 --save-dev

 Install the rest:

 $ sudo npm install gulp-sass gulp-autoprefixer gulp-css-globbing gulp-imagemin imagemin-pngquant gulp-group-css-media-queries gulp-plumber gulp-concat gulp-uglify gulp-clean-css browser-sync --save-dev

 and then you can start the gulp process in the project folder with: $ gulp
 */

const gulp = require('gulp'),
    sass = require('gulp-sass'),
    globbing = require('gulp-css-globbing'),
    autoprefixer = require('gulp-autoprefixer'),
    cmq = require('gulp-group-css-media-queries'),
    plumber = require('gulp-plumber'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify-es').default,
    browserSync = require('browser-sync').create(),
    cleanCSS = require('gulp-clean-css'),
    hb = require('gulp-hb'),
    del = require('del'),
    frontMatter = require('gulp-front-matter'),
    data = require('gulp-data'),
    rename = require("gulp-rename"),
    sourcemaps = require('gulp-sourcemaps'),
    fs = require('fs');

/* Campaign Setting */
const dev_flag = true,
    img_url_dev = './images/',
    img_url_prod = './images/';


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

gulp.task('showcase', function (done) {
    const examplesPath = './dist/examples';
    const errorMessage = 'Error: examples not found';
    let output = '';

    if (fs.existsSync(examplesPath) && fs.lstatSync(examplesPath).isDirectory()) {
        const files = fs.readdirSync(examplesPath);
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            output += '<a href="./' + file + '">';
            output += file;
            output += '</a>';
            output += '<br>';
        }
    } else {
        console.log(errorMessage);
        fs.mkdirSync(examplesPath);
        output = errorMessage;
    }

    fs.writeFileSync('./dist/examples/component-showcase.html', output);

    // We need to finish the task.
    done();
});


gulp.task('copy_images', function () {
    return gulp.src('./app/images/**/*.{png,jpg,svg,gif}')
        .pipe(plumber())
        .pipe(gulp.dest('./dist/images/'));
});

gulp.task('sass', function () {
    return gulp
        .src(['./app/sass/*.scss', './app/third-party/**/*.scss'], {base: './app/sass/'})
        .pipe(sourcemaps.init())
        .pipe(plumber())
        .pipe(globbing({
            extensions: ['.scss']
        }))
        .pipe(sass({
            outputStyle: 'compressed',
            includePaths: ['node_modules/susy/sass']
        }).on('error', sass.logError))
        .pipe(autoprefixer({
            overrideBrowserslist: ['> 1%', 'last 3 versions', 'ie 11']
        }))
        .pipe(cmq())
        .pipe(cleanCSS({processImport: false, advanced: false, mediaMerging: false, restructuring: false}))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/css/'))
        .pipe(browserSync.stream());
});

gulp.task('scripts', function () {
    // getting the scripts by the order, if there are dependencies, order with numbers: 00_dependency, 01_script.
    return gulp.src(['./app/js/custom/**/*.js'])
        .pipe(concat('customs.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./dist/js/'))
        .pipe(browserSync.stream());
});

gulp.task('js_libraries', function () {
    // getting the scripts by the order, if there are dependencies, order with numbers: 00_dependency, 01_script.
    return gulp.src(['./app/js/libraries/**/*.js'])
        .pipe(uglify())
        .pipe(gulp.dest('./dist/js/'))
        .pipe(browserSync.stream());
});

gulp.task('fonts', function () {
    return gulp.src(['./app/third-party/*/fonts/*.*', './app/fonts/**/*.*'])
    // Rename the relative paths of the dependencies to put all fonts
    // at the same level.
        .pipe(rename(function (path) {
            path.dirname = path.dirname.replace(/(.*)?/, '');
        }))
        .pipe(gulp.dest('./dist/fonts/'));
});

gulp.task('hb', function () {
    return gulp.src('./app/hb/**/*.html')
    // Load an associated JSON file per post.
        .pipe(data((file) => {
            return require(file.path.replace('.html', '.json'));
        }))    // Parse front matter from post file.
        .pipe(frontMatter({
            property: 'data.frontMatter'
        }))
        .pipe(hb()
            .data('./app/hb/data/**/*.json')
            .helpers('./app/hb/helpers/**/*.js')
            .helpers({
                img_url: function (img_name) {
                    // If the given image URL includes the protocol, just use it as it comes,
                    // since it is probably not a local image
                    if (/^https?:\/\//i.test(img_name)) {
                        return img_name;
                    } else {
                        if (dev_flag) {
                            return img_url_dev + img_name + "?cachebuster=" + getRandomInt("00000000", "99999999");
                        } else {
                            return img_url_prod + img_name + "?cachebuster=" + getRandomInt("00000000", "99999999");
                        }
                    }

                }
            })
            .helpers({
                cachebuster: function (linkurl) {
                    return linkurl + "?cachebuster=" + getRandomInt("00000000", "99999999");
                }
            })
            .partials('./app/hb/partials/**/*.hbs')
        )
        .pipe(gulp.dest('./dist/'))
        .pipe(browserSync.stream());
});

/**
 * SVG to Handlebars partial parser.
 * 
 * CONFIG:
 * baseFolder: svg source folder.
 * folders: svg source folder subfolders.
 * destination: output folder.
 * 
 * README:
 * !!! this task is not included into main build pipeline !!!
 * !!! and should be executed MANUALLY. !!!
 */
gulp.task('svg-hb', function () {
    const baseFolder = './app/images/assets';
    const folders = [
        'icons',
        'logos',
        'social',
        'stickers',
        'patterns'
    ];
    const destination = './app/hb/partials/svg';
    const errorMessage = 'Error: svg sources not found';
    
    // Remove folder and all of it's contents.
    const rmDir = function (dirPath) {
        try { var files = fs.readdirSync(dirPath); }
        catch (e) { return; }
        if (files.length > 0)
            for (var i = 0; i < files.length; i++) {
                var filePath = dirPath + '/' + files[i];
                if (fs.statSync(filePath).isFile())
                    fs.unlinkSync(filePath);
                else
                    rmDir(filePath);
            }
        fs.rmdirSync(dirPath);
    };

    // Check destination folder existance and empty it.
    if (fs.existsSync(destination)) {
        rmDir(destination);
    }
    fs.mkdirSync(destination);

    for (let i = 0; i < folders.length; i++) {
        const folderName = folders[i];
        const folderPath = `${baseFolder}/${folderName}`;
        const folderDest = `${destination}/${folderName}`;

        // Check destination folder existance and empty it.
        if (fs.existsSync(folderDest)) {
            rmDir(folderDest);
        }
        fs.mkdirSync(folderDest);
        
        /**
         * Each svg file content is enclosed in "<i>" tag
         * and saved into it's destination folder as 
         * hb partial with ".hbs" extension.
         */
        if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath);
            for (let i = 0; i < files.length; i++) {
                let output = '';
                const file = files[i];
                output += '<i class="icon-svg">';
                output += fs.readFileSync(`${folderPath}/${file}`, 'utf8');
                output += '</i>';
                let filename = file.split('.').slice(0, -1) + '.hbs';
                fs.writeFileSync(`${folderDest}/${filename}`, output);
                console.log(`Partial ${filename} created.`, `${folderDest}/${filename}`);
            }
        } else {
            console.log(errorMessage);
            fs.mkdirSync(folderPath);
        }
    }
    // We need to finish the task.
    done();
});

gulp.task('clean', function () {
    return del([
        './dist/**/*.html'
    ]);
});
gulp.task('cleancss', function () {
    return del([
        './dist/css/*.css'
    ]);
});

function watch() {
    browserSync.init({
        server: './dist/'
    });
    gulp.watch('./app/hb/**/*.{html,json,js,hbs}', gulp.series('clean', 'hb'));
    gulp.watch(['./app/sass/**/*.scss', './app/third-party/**/*.scss'], gulp.series('cleancss', 'sass'));
    gulp.watch(['./app/js/**/*.js'], gulp.series('scripts'));
    gulp.watch('./app/**/*.html').on('change', browserSync.reload);
}

gulp.task('build', gulp.series('clean', 'fonts', 'sass', 'hb', 'scripts', 'js_libraries', 'copy_images', 'showcase'));
gulp.task('images', gulp.series('copy_images'));

gulp.task('watch', watch);
gulp.task('default', gulp.series('build', 'watch'));