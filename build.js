import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import CleanCSS from 'clean-css'
import Terser from "terser";
import fs from 'fs';

const { NODE_ENV } = process.env

console.log("Running Build Phase...")

/* <---- CSS Files Merged Into SheetParrot.min.css ----> */

let cssoutput = ''
const cleaner = new CleanCSS({})
const css_files = [
    './public/src/css/palette.css',
    './public/src/css/bulma.css',
    './public/src/css/SheetParrot.css',
]

css_files.forEach((f,i) => {
    let c = cleaner.minify( fs.readFileSync(f, "utf8") )
    cssoutput += c.styles; 
    //console.log(`Minified: ${f.substring(f.lastIndexOf('/')+1)} SAVED ${c.stats.originalSize - c.stats.minifiedSize} BYTES : Efficiency = [${parseInt(c.stats.efficiency * 100)}%]`)
})

fs.writeFileSync("./public/css/SheetParrot.min.css", cssoutput, "utf8");


/* <---- JS Files Merged Into SheetParrot.min.js ----> */

let jsfiles = [
        './public/src/js/vendor/jquery.min.js',
        './public/src/js/vendor/bulma-calendar.min.js',
        './public/src/js/vendor/chart.min.js',
        './public/src/js/vendor/confetti.browser.min.js',
        './public/src/js/vendor/progressbar.min.js',
        './public/src/js/vendor/moment.min.js',
        './public/src/js/vendor/vanilla-picker.min.js',

        './public/src/js/core.js',

        './public/src/js/objects/VerificationInputs.js',
        './public/src/js/objects/DynamicCache.js',
        './public/src/js/objects/InvisibleEditor.js',
        './public/src/js/objects/FolderPicker.js',
        './public/src/js/objects/PhotoLibrary.js',
        './public/src/js/objects/Pricing.js',
        './public/src/js/objects/VideoParser.js',
        './public/src/js/objects/Paper.js',
        './public/src/js/objects/Card.js',
        './public/src/js/objects/Editor.js',
    ];

let files_obj = {},
    jsoutput = '',
    options = { mangle:false },
    counter = 0;

jsfiles.forEach((f) => {
    if(!f.endsWith('.min.js') && NODE_ENV == 'production'){ files_obj[`file${counter += 1}.js`] = fs.readFileSync(f, "utf8"); }
    else{ jsoutput += fs.readFileSync(f, "utf8") }
})

if(NODE_ENV == 'production'){
    jsoutput += '\n'
    jsoutput += Terser.minify(files_obj, options).code
}

fs.writeFileSync("./public/js/SheetParrot.min.js", jsoutput, "utf8");