//
// Implementation of IdentiFox network client
//

const Cc = Components.classes;
const Ci = Components.interfaces;

const CLASS_ID = Components.ID("A523B838-05C0-11DE-89F0-4C2A56D89593");
const CLASS_NAME = "IdentiFox HTTP Request";
const CONTRACT_ID = "@uncryptic.com/identifox-http-request;1";

//
// Utility functions
//
var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function toUTF8Octets(string) {
  return unescape(encodeURIComponent(string));
}

function btoa(input) {
  var output = "";
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;

  do {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
      keyStr.charAt(enc3) + keyStr.charAt(enc4);
  } while (i < input.length);

  return output;
}

//
// Custom HTTP request
//
function IdentiFoxHttpRequest() {
  this.responseText = "";
  this.status = 0;

  var observer = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  observer.addObserver(this, "http-on-modify-request", false);
  observer.addObserver(this, "http-on-examine-response", false);
}

IdentiFoxHttpRequest.prototype = {

  httpChannel: function() {
    return this.channel.QueryInterface(Ci.nsIHttpChannel);
  },

  setURL: function(url) {
    this.requestURL = url;
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var URI = ioService.newURI(url, null, null);

    this.channel = ioService.newChannelFromURI(URI);
  },

  setRedirectLimitation: function(num) {
    this.httpChannel().redirectionLimit = num;
  },

  setTimeout: function(msec) {
    var target = this;
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer); 
    this._timer.initWithCallback({
      notify: function() {
          target["onTimeout"]();
        }
      },
      msec,
      Ci.nsITimer.TYPE_ONE_SHOT);

  },

  asyncOpen: function() {
    this.channel.notificationCallbacks = this;
    this.channel.asyncOpen(this, null);
  },

  setPostData: function(data) {
    var upStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
    upStream.setData(data, data.length);
    var upChannel = this.channel.QueryInterface(Ci.nsIUploadChannel);
    upChannel.setUploadStream(upStream, "application/x-www-form-urlencoded", -1);

    this.httpChannel().requestMethod = "POST";
  },

  setRequestHeader: function(header, param) {
    this.httpChannel().setRequestHeader(header, param, true);
  },

  getResponseHeader: function(header) {
    this.httpChannel().getResponseHeader(header);
  },

  setBasicAuth: function(user, pass) {
    this.user = user;
    this.pass = pass;
  },

  abort: function() {
    if (this.timer) {
      this.timer.cancel();
    }
    this.channel.cancel(Components.results.NS_BINDING_ABORTED);
    this.cannnel = null;
  },

  onStartRequest: function(request, context) {
    this.responseText = "";
    try {
      this.status = this.httpChannel().responseStatus;
    }
    catch (e) {}
  },

  onDataAvailable: function(request, context, stream, offset, length) {
    var scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    scriptableInputStream.init(stream);

    this.responseText += scriptableInputStream.read(length);
  },
  
  onStopRequest: function(request, context, status) {

    var observer = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

    if (this._timer) {
      this._timer.cancel();
    }

    var event = {};
    if (Components.isSuccessCode(status)) {
      this.onload.handleEvent(event);
    }
    else if (status != Components.results.NS_BINDING_ABORTED) {
      this.onerror.handleEvent(event);
    }

    var observer = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    observer.removeObserver(this, "http-on-modify-request");
    observer.removeObserver(this, "http-on-examine-response");
  },

  onChannelRedirect: function(oldChannel, newChannel, flags) {
    this.channel = newChannel;
  },

  onTimeout: function () {
    if (this.ontimeout) {
      var event = {};
      this.ontimeout.handleEvent(event);
    }
  },

  observe: function(subject, topic, data) {
    // Do not use user cookies
    //
    if (subject == this.channel) {
      if (topic == "http-on-modify-request") {
        this.httpChannel().setRequestHeader("Cookie", "", false);
      }
      else if (topic == "http-on-examine-response") {
        this.httpChannel().setResponseHeader("Set-Cookie", "", false);
      }

      if (topic == "http-on-modify-request" && this.user) {
        this.httpChannel().setRequestHeader("Authorization", "Basic " + btoa(toUTF8Octets(this.user + ":" + this.pass)), false);
      }
    }
  },

  // nsIInterfaceRequestor
  getInterface: function(aIID) {
    try {
      return this.QueryInterface(aIID);
    }
    catch (e) {
      throw Components.results.NS_NOINTERFACE;
    }
  },

  // nsIProgressEventSink (to shut up annoying debug exceptions
  onProgress: function(request, context, progress, progressmax) {},
  onStatus: function(request, context, status, statusArg) {},
  
  // nsIHttpEventSink (to shut up annoying debug exceptions
  onRedirect: function(oldChannel, newChannel) {},

  // nsIAuthPromptProvider (to shut up annoying debug exceptions
  getAuthPrompt: function(reason) {},

  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsISupports) ||
        aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        aIID.equals(Ci.nsIWebProgress) ||
        aIID.equals(Ci.nsIDocShell) ||
        aIID.equals(Ci.nsIDocShellTreeItem) ||
        aIID.equals(Ci.nsIPrompt) ||
        aIID.equals(Ci.nsIAuthPrompt) ||
        aIID.equals(Ci.nsIAuthPromptProvider) ||
        aIID.equals(Ci.nsIInterfaceRequestor) ||
        aIID.equals(Ci.nsIChannelEventSink) ||
        aIID.equals(Ci.nsIProgressEventSink) ||
        aIID.equals(Ci.nsIHttpEventSink) ||
        aIID.equals(Ci.nsIStreamListener) ||
        aIID.equals(Ci.nsIIdentiFoxHttpRequest))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};

//=================================================
// Note: You probably don't want to edit anything
// below this unless you know what you're doing.
//
// Factory
var IdentiFoxHttpRequestFactory = {

  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null) {
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    }
    return (new IdentiFoxHttpRequest()).QueryInterface(aIID);
  }
};

// Module
var IdentiFoxHttpRequestModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME, CONTRACT_ID, aFileSpec, aLocation, aType);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);        
  },
  
  getClassObject: function(aCompMgr, aCID, aIID)  {
    if (!aIID.equals(Ci.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return IdentiFoxHttpRequestFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) { return IdentiFoxHttpRequestModule; }

