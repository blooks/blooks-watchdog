var Watchdog = require('./index');

var watchdog = new Watchdog();

watchdog.start(function(err, result) {
    console.log(result);
});