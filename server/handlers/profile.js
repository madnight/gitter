"use strict";

var form = require("express-form"),
    filter = form.filter,
    validate = form.validate,
    signupService = require("../services/signup-service"),
    userService = require("../services/user-service"),
    passport = require('passport');

module.exports = {
    install: function(app) {
      app.get('/profile', 
        function(req, res) {
          var displayName;
          if(req.form && "displayName" in req.form) { 
            displayName = req.form.displayName;
          } else {
            displayName = req.user.displayName
          }
        
          res.render('profile', {
            flash: req.flash,
            displayName: req.user.displayName
          });
      });   

      app.post(
          '/updateprofile',

          // Form filter and validation middleware
          form(
            filter("displayName").trim(),
            validate("displayName").required().is(/^[a-zA-Z \-\']+$/),
            filter("password").trim()
          ),

          // Express request-handler now receives filtered and validated data
          function(req, res, next) {
            if(!req.user) {
              return next("Not signed in")
            }
            
            if (!req.form.isValid) {
              res.render('profile', {
                flash: req.flash,
                errors: req.form.errors,
                displayName: req.form.displayName
              });
              
              return;
            }
            
            signupService.updateProfile({
              user: req.user,
              displayName: req.form.displayName,
              password: req.form.password,
            }, function(err) {
              if(err) {
                res.render('profile', {
                  flash: req.flash,
                  displayName: req.form.displayName
                });
                return;
              } 
              
              userService.findDefaultTroupeForUser(req.user.id, function(err, troupe) {
                if(err) return next(err);
                if(!troupe) return next("Unable to determine default troupe for user");

                res.redirect("/" + troupe.uri);
              });
            });
          }
        );
      
    }
};