/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define(['utils/context'], function(context) {
  "use strict";

  /* Poor mans locale */

  var locale = context().locale;

  function format(formatString, args) {
    for(var k = args.shift(); k; k = args.shift()) {
      formatString = formatString.replace('%s', k);
    }

    return formatString;
  }

  return function(key) {
    var args = Array.prototype.slice.call(arguments, 1);

    var formatString = locale && locale[key] || key;
    return format(formatString, args);

  };

});