var NGMakeLib = require('ngmakelib').NGMakeLib;

// Initialize NGMakeLib with entry point source file and module name
var ngMakeLib = new NGMakeLib('src/app/lib.module.ts', 'fintechneo-angulartemplates');
ngMakeLib.packageJSONConfig.dependencies = {};
ngMakeLib.packageJSONConfig.devDependencies = {};

// Create the library and watch for changes
if(process.argv[process.argv.length-1] === '--watch') {
    ngMakeLib.watch();
} else {
    ngMakeLib.build();
}