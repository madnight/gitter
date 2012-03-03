// troupe

// documentation via: haraka -c /Users/mike/Documents/TroupeGit/troupe1/roger/haraka -h plugins/troupe

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin

var persistence = require("./../../server/services/persistence-service.js")

var who; //who is the email TO mapped as a troupe URI
var from;

// let's look for the sender first
exports.hook_mail = function(next,connection,params) {

  var tmp = params[0].toString();
  var loc = tmp.indexOf(">");
  from = tmp.substring(1,loc);
  
  
  // for now we'll just look up to see if the SENDER exists in our user table.
  // we actually want to match them to the Troupe to make sure they are in the Troupe and can send.
  
    persistence.User.findOne({
		email : from
	  }, function(err, user) {
		if (err) {
		  callbackFunction(err, null);
		}
	
		if (user == null) {
		  connection.logdebug("SENDER CHECK: Unknown sender - bounce the message");
		  return next(DENY, "Sorry, I don't know you.");
		  
		} else {
		  connection.logdebug("SENDER CHECK: Valid sender (" + from + ") - so far so good");
		  next();
		  return true;
		  
		}
	  });
    
}

// now let's look for the recipient and match that to a Troupe
exports.hook_rcpt = function(next, connection, params) {
  var rcpt = params[0];
  var tmp;
 

  tmp = rcpt.toString();
  var loc = tmp.indexOf("@");
  who = tmp.substring(1, loc);


  // I don't entirely understand the node queue system, but I guess this is NOT
  // the way to do it as I've seen the output of the Mongo query happen after
  // the entire Haraka script has finished running. I tried using whatTroupe =
  // persistance.Troupe.findOne blah blah but that only returned some fucked up
  // query object rather than the response. Sigh. Almost get it, but not 100%

  persistence.Troupe.findOne({
    uri : who
  }, function(err, whatTroupe) {
    if (err) {
      callbackFunction(err, null);
    }

    if (whatTroupe == null) {
      connection.logdebug("RECIPIENT TROUPE CHECK: Unknown Troupe (" + who + ") - bounce the message");
	  return next(DENY, "Nope, that Troupe doesn't exist.");
	  
    } else {
      connection.logdebug("RECIPIENT TROUPE CHECK: Valid Troupe (" + who + ") - deliver the message");
	  
	  
	  next();
	  return true;
	  
    }
  });

  
}


// now lets move on and deliver the mail to the database

exports.hook_queue = function(next, connection) {
    var lines = connection.transaction.data_lines;
    if (lines.length === 0) {
        return next(DENY);
    }
    
	
	 var storeMail = new persistence.Email();
	  storeMail.from = from.toString();
	  storeMail.troupeURI = who.toString();
	  storeMail.mail = lines.join('');
	  
	
	  storeMail.save(function(err) {
		if(err == null) {
		 
		  connection.logdebug("Stored the email.");
		  //callback(null);
		  return next(OK);
		}
	  });
};
