/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var winston = require("winston");
var nconf = require('../utils/config');
var middleware = require('../web/middleware');
var request = require('request');
var uriContextResolverMiddleware = require('../web/uri-context-resolver-middleware');

var serviceDisplayNames = {
  github: 'GitHub',
  bitbucket: 'BitBucket',
  jenkins: 'Jenkins',
  travis: 'Travis',
};

module.exports = {
    install: function(app) {

      app.get('/:appUri/integrations',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        function (req, res) {
          request.get({
            url: nconf.get('webhooks:basepath')+'/troupes/'+req.troupe._id+'/hooks',
            json: true
          }, function(err, resp, hooks) {
            if(err) {
              winston.error('failed to fetch hooks for troupe', { exception: err });
              res.send(502, 'Unable to perform request. Please try again later.');
              return;
            }
            hooks.forEach(function(hook) {
              hook.serviceDisplayName = serviceDisplayNames[hook.service];
            });
            res.render('integrations', {
              hooks: hooks,
              troupe: req.troupe,
            });
          });
        });

      app.del('/:appUri/integrations',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        function (req, res) {
          request.del({
            url: nconf.get('webhooks:basepath')+'/troupes/'+req.troupe._id+'/hooks/'+req.body.id,
            json: true
          },
          function(err) {
            if(err) {
              winston.error('failed to delete hook for troupe', { exception: err });
              res.send(502, 'Unable to perform request. Please try again later.');
              return;
            }
            res.redirect('/'+req.troupe.uri+'/integrations');
          });
        });

      app.post('/:appUri/integrations',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        function(req, res) {
          request.post({
            url: nconf.get('webhooks:basepath')+'/troupes/'+req.troupe._id+'/hooks',
            json: {
              service: req.body.service,
            }
          },
          function(err, resp, body) {
            if(err || !body) {
              winston.error('failed to create hook for troupe', { exception: err });
              res.send("Unable to perform request. Please try again later.");
              return;
            }
            // TODO: Make sure this is properly encoded
            res.redirect(body.configurationURL + "&returnTo=" + nconf.get('web:basepath') + req.url);
          });
        });

    }
};
