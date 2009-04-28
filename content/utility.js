

function naanExUtils(name) {
  this._exname = name;

  this._pref = Components.classes['@mozilla.org/preferences-service;1']
    .getService(Components.interfaces.nsIPrefService).getBranch("extensions." + name + ".");

  this._observer = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

  this._login = Components.classes["@mozilla.org/login-manager;1"]
    .getService(Components.interfaces.nsILoginManager);
}

naanExUtils.prototype = {

  $: function(id) {
    return document.getElementById(id);
  },

  pref: function () {
    return this._pref;
  },

  notify: function(command) {
    var p = {
      "command": command
    };
    
    if (arguments[1]) {
      for (var i in arguments[1]) {
        p[i] = arguments[1][i];
      }
    }

    this._observer.notifyObservers(null,
                                   this._exname + "-command",
                                   p.toSource());
  },

  getPassword: function(path) {

    if (!path) path = "";

    var result = [];
    var n = 0;

    try {
      var hostname = "chrome://" + this._exname;
      var logins = this._login.findLogins({}, hostname, "", null);
      n = logins.length;

      if (n == 0) {
        logins = this.migrateAccount();
      }

      for (var i = 0; i < logins.length; ++i) {
        result[logins[i].username] = logins[i].password;
      }
    }
    catch(e) {
      dump("Can't retrieve password by Login Manager\n");
    }

    return (n > 0) ? result : null;
  },

  getUserPassword: function(username) {
    try {
      var host = "chrome://" + this._exname;
      var logins = this._login.findLogins({}, host, "", null);
      for (var i = 0; i < logins.length; ++i) 
        if (logins[i].username == username) {
          return logins[i].password;
        }
    }
    catch (e) {}
  },
  
  removePassword: function(user) {
    try {
      var host = "chrome://" + this._exname;
      var logins = this._login.findLogins({}, host, "", null);
      for (var i = 0; i < logins.length; ++i) 
        if (logins[i].username == user) {
          this._login.removeLogin(logins[i]);
        }
    }
    catch (e) {}
  },
  
  log: function(msg) {
    if (!this._console) {
      this._console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    }
    this._console.logStringMessage(msg);
  },

  migrateAccount: function() {
    var logins = this._login.getAllLogins({});
    var host = "chrome://" + this._exname;

    for (var i = 0; i < logins.length; ++i) {
      if (logins[i].hostname == host + "/") {
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                     Components.interfaces.nsILoginInfo,
                                                     "init");

        var loginInfo = new nsLoginInfo(host, 
                                        host + "/" + logins[i].username, 
                                        null,
                                        logins[i].username,
                                        logins[i].password,
                                        "username",
                                        "password");
        this._login.modifyLogin(logins[i], loginInfo);
      }
    }
  },

  savePassword: function(user, pass) {
    var host = "chrome://" + this._exname;

    this.removePassword(user);
    try {
      var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                   Components.interfaces.nsILoginInfo,
                                                   "init");

      var loginInfo = new nsLoginInfo(host, host + "/" + user, null, user, pass, "username", "password");
      this._login.addLogin(loginInfo);
    }
    catch (e) {}
  },

  getAccountInfo: function() {

    this.accounts = this.getPassword();
    if (this.accounts == null) {
      return null;
    }

    var currentUser = this.pref().getCharPref("currentUser");
    var password = null;

    if (!this.accounts[currentUser]) {
      currentUser = null;
    }
    for (var user in this.accounts) {
      if (this.accounts.hasOwnProperty(user)) {
        if (currentUser == null) {
          currentUser = user;
        }
        if (user == currentUser) {
          password = this.accounts[user];
        }
      }
    }

    this.pref().setCharPref("currentUser", currentUser);

    return {user:currentUser, pass:this.accounts[currentUser]};
  }
};
