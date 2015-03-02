/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var request = require('request');
var fetchAllPages = require('./fetch-all-pages');
var logFailingRequest = require('./log-failing-request');
var logRateLimit = require('./log-rate-limit');
var httpCache = require('./http-cache');
var requestWithRetry = require('./request-with-retry');
var publicTokenPool = require('./public-token-pool');

module.exports = publicTokenPool(
                    fetchAllPages(
                      logFailingRequest(
                        httpCache(
                        requestWithRetry({ maxRetries: 3 },
                          logRateLimit(
                            request))))));

module.exports.fastRequest = publicTokenPool(
                                logFailingRequest(
                                  httpCache(
                                    logRateLimit(
                                      request))));

module.exports.firstPageOnlyRequest = publicTokenPool(
                                        logFailingRequest(
                                          requestWithRetry({ maxRetries: 3 },
                                            logRateLimit(
                                              httpCache(
                                              request)))));
