var casperJS = require('casper');

var casper = new casperJS.Casper({
  viewportSize: { width: 1280, height: 800 },
  waitTimeout: 60000,
  verbose: true,
  logLevel: 'debug'
});

var baseUrl = "http://localhost:5000/";
var email = "tim@troupe.co";
var troupeName = "New Signup New Troupe";

casper.start(baseUrl + "x", function() {

});

casper.thenClick('#button-signup');


casper.then(function() {
  this.fill('#signup-form', {
    troupeName: troupeName,
    email: email
  }, true);
});

casper.then(function() {
  casper.evaluate(function(baseUrl, forEmail) {
    console.log("Getting confirmation code...");

    $.post(baseUrl + 'confirmationCodeForEmail', { email: forEmail })
      .done(function(response, status, xhr) {
        console.log("status: ", status, " response: ", response, " code: ", xhr.statusCode());
        window.location = '/confirm/' + response.confirmationCode;
      })
      .fail(function(xhr, text, e) {
        console.log("error getting code: ", text, ", e: ", e, " body: ", xhr.responseText);
      });

  }, baseUrl, email);


});

casper.then(function() {
  casper.waitForSelector('.trpLeftMenu');
});

casper.run();