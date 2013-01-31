/*jshint unused:true browser:true*/
require([
  'jquery',
  'views/base',
  'views/signup/signupModalView',
  'views/signup/signupModalConfirmView',
  'views/login/loginModalView',
  'views/signup/createTroupeView',
  'jquery_validate' // No ref!
 ],
  function($, TroupeViews, SignupModalView, SignupModalConfirmView, LoginModalView, createTroupeView) {
    //var loginFormVisible = false;

    function createLoginModal() {
      var view = new LoginModalView({ fromSignup:true });
      var modal = new TroupeViews.Modal({ view: view });
      view.on('login.complete', function(data) {
        modal.off('login.complete');

        window.location.href= data.redirectTo;
      });

      view.on('login.close', function(/*data*/) {
        modal.off('login.close');
        modal.hide();
      });
      return modal;
    }

    /*var validationErrors = {};
    function attachTooltipHandlerToItem(index, el) {
      var jel = $(el);
        jel.tooltip({title: function() {
          var v = validationErrors[el.name];
          return v ? v:"";
        }});
    }*/


    if (window.location.href.indexOf("passwordResetFailed") >= 0) {
      var modal = new TroupeViews.ConfirmationModal({
        confirmationTitle: "Reset Failed",
        body: "That password reset link is invalid.",
        buttons: [
          {
            id: "retry-reset",
            text: "Back to login"
          }
        ]
      });

      modal.on('button.click', function() {
        modal.transitionTo(createLoginModal());
      });

      modal.on('close', function() {
        window.location.href = window.location.href.replace("passwordResetFailed","");
      });

      modal.show();
    } else if(window.noValidTroupes) {
      var modal = new TroupeViews.ConfirmationModal({
        title: "No Troupes yet...",
        body: "Click 'Get Started' to create your first Troupe",
        buttons: [{
          id: 'no-troupes-ok', text: 'OK'
        }]
      });

      modal.on('button.click', function(id) {
        if (id == 'no-troupes-ok')
          modal.hide();
      });

      modal.show();
    }

    $('.button-signup').on('click', function() {
      if (window.noValidTroupes) {
        new createTroupeView.Modal({existingUser: true, userId: window.userId }).show();
      } else {
        var view = new SignupModalView({existingUser: false});
        var modal = new TroupeViews.Modal({ view: view });
        view.on('signup.complete', function(data) {
          modal.off('signup.complete');

          modal.transitionTo(new TroupeViews.Modal({ view: new SignupModalConfirmView({ data: data }) }));
        });

        modal.show();
      }
      return false;
    });


    $('.button-existing-users-login').on('click', function() {
      var modal = createLoginModal();
      modal.show();
      return false;
    });
});

