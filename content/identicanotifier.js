//
// Implementation of IdentiFox content JS
//

const IDENTICA_TOP_URL = "http://floss.pro/";
const IDENTIFOX_TINYURL_CREATE_API = "http://tinyurl.com/api-create.php?url=";

function IdenticaNotifier() {
  this._prefWindow = null;
  this._showBalloon = true;
  this._timer = null;
  this._messageQueue = new Array();
  this._util = new naanExUtils("identicanotifier");
  this._onFocus = false;
  this._needToUpdate = false;
  this._tinyURL = /http:\/\/(tinyurl.com|is.gd|bit.ly)/;
  this._inReplyTo = 0;
}

IdenticaNotifier.prototype = {

  $: function(name) {
    return document.getElementById(name);
  },

  load: function() {

    this.initKeyConfig();
    
    // Don't init IdentiFox when the window is popup.
    if (window.toolbar.visible == false) {
      var btn = this.$("identicanotifier-statusbar-button");;
      var parent = btn.parentNode;
      parent.removeChild(btn);
      return;
    }

    this._strings = this.$("identicanotifier-strings");

    var target = this;

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
        .addObserver(gIdenticaNotifier, "identicanotifier-status", false);

    // Setup menuitem
    var menu = this.$("identicanotifier-menuitem-togglepopup");
    this._showBalloon = this._util.pref().getBoolPref("popup");
    menu.setAttribute("checked", this._showBalloon);

    this._popup = this.$("identicanotifier-popup");

    this._unescapeHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
                           .getService(Components.interfaces.nsIScriptableUnescapeHTML);

    // Init session
    var password = this._util.getAccountInfo();
    if (password && this._util.pref().getBoolPref("login")) {
      this._util.notify("initSession", password);
    }
    else {
      this.onLogout();
    }

  },

  unload: function() {
    if (window.toolbar.visible == false) return;

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
          .removeObserver(gIdenticaNotifier, "identicanotifier-status");
  },

  observe: function(subject, topic, data) {
    if (topic != "identicanotifier-status") return;

    var msg = eval('(' + data + ')');
    if (this[msg.state]) {
      this[msg.state](msg.data);
    }
  },

  updateFriendsTimeline: function(data) {
    // Update balloon
    this._messageQueue = data.reverse();
    this.updateBalloon();
    this.updateTooltip();
    this.showMessage();
  },

  updateUsername: function(data) {
    this._username = data.screen_name.toLowerCase();
    this._popup.currentUser = data.screen_name;
    this._popup.currentUserIcon = data.profile_image_url;
    this.showMessage();
  },

  noUpdate: function(data) {
    this.updateTooltip();
    this.showMessage();
  },

  updateTooltip: function() {
    var elem = this.$("identicanotifier-last-update");
    var d = new Date();
    var h = d.getHours();
    if (h < 10) h = '0' + h;
    var m = d.getMinutes();
    if (m < 10) m = '0' + m;
    elem.value = "Last update: " + h + ":" + m;
  },

  accountChanged: function(data) {
    this._util.getAccountInfo();
    if (this._popup.isOpen) {
      this._util.notify("getRecent", {type:this._popup.activeTab});
    }
  },

  authFail: function(data) {
    if (!this._prefWindow) {
      var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);
      var user = this._util.pref().getCharPref("currentUser");
      var msg = this._strings.getFormattedString("AuthFail", [user]);
      prompt.alert(window, "FlossProFox", msg);
      this.logout();
    }
    else {
      this._prefWindow.focus();
    }
    this.showMessage(msg);
  },

  internalError: function(data) {
    this.showMessage(data);
    this.updateTooltip();
  },

  onTimeoutBalloon: function() {

    if (this._onFocus) {
      this._needToUpdate = true;
      return;
    }

    this.removeBalloon();
    if (this._messageQueue.length) {
      this.updateBalloon();
    }
    else {
      this.showUnreadCount(0);
    }
  },

  showMessage: function(message) {
    var elem = this.$("identicanotifier-status-tooltip");
    if (message) {
      this.setButtonState("error");
      elem.setAttribute("value", message);
    }
    else {
      this.setButtonState("active");
      elem.setAttribute("value", "FlossProFox");
    }
  },
  
  showUnreadCount: function(count) {
    var msg = {"state": "setUnreadCount", "data": count};

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
    .notifyObservers(null, "identicanotifier-status", msg.toSource());
  },

  setUnreadCount: function(count) {
    var elem = this.$("identicanotifier-statusbar-text");
    var value;

    var notifier = Components.classes['@uncryptic/identicanotifier;1']
      .getService(Components.interfaces.nsIIdenticaNotifier);

    var unread = notifier.getUnreadCount();
     
    if (count == 0) {
      value = unread || "";
    }
    else if (count > 0) {
      value = count + "/" + unread;
    }
    else {
      value = "";
    }
    elem.setAttribute("value", value);
  },

  setButtonState: function(state) {
    var btn = this.$("identicanotifier-statusbar-button");
    btn.setAttribute("state", state);
  },

  updateBalloon: function() {
    if (!this.isActiveWindow()) {
      this.showUnreadCount(0);
      return;
    }

    if (this._popup.isOpen) {

      // Append message balloon to top of popup menu
      //
      var msgs = this._messageQueue;
      for (var i = 0; i < msgs.length; ++i) {
        var msg = msgs[i];
        var elem = this.createMessageBalloon(msg, true);
        this._popup.addBalloon(elem);
      }
      this.showUnreadCount(0);
      this._popup.recalcScrollbar(false);
      return;
    }

    //
    // Create new balloon
    //
    var unread = 0;
    for (var i = 0; i < this._messageQueue.length; ++i) {
      var msg = this._messageQueue[i];
      var user = msg.user ? msg.user : msg.sender;
      if (user && user.screen_name.toLowerCase() != this._username) {
        unread++;
      }
    }

    if (!this._showBalloon) {
      this.showUnreadCount(0);
      return;
    }
    else {
      this.showUnreadCount(unread);
    }

    var count = this._messageQueue.length;

    if (count == 0) {
      return;
    }

    if (count > 5) {
      this._messageQueue = new Array();
      this.showNotice(this._strings.getFormattedString("MoreThan5Dents", [unread]));
    }
    else {
      this.showBalloon();
    }
  },

  showBalloon: function() {
    var elem = this.createMessageBalloon(this._messageQueue.shift(), false);
    elem.setAttribute("type", "balloon");
    this.popupBalloon(elem);
  },

  showNotice: function(msg) {
    var elem = document.createElement("vbox");
    elem.className = "identicanotifier-notice";
    elem.setAttribute("value", msg);

    this.popupBalloon(elem);
  },

  popupBalloon: function(elem) {
    var box = document.createElement("vbox");
    box.id = "identicanotifier-balloon";

    box.appendChild(elem);
    var panel = this.$("identicanotifier-panel");
    panel.appendChild(box);

    var interval = this._util.pref().getIntPref("popup-interval");
    if (!interval) {
      interval = 3;
    }
    this._timer = setTimeout("gIdenticaNotifier.onTimeoutBalloon()", interval * 1000);

    var statusbar = this.$("status-bar");
    panel.openPopup(statusbar, "before_end", -16, 2, false, true);
  },

  showPopup: function(data) {

    if (!this.isActiveWindow()) {
      return;
    }
    // remove balloon
    this.removeBalloon();

    this.showUnreadCount(0);

    var msgs = data.msgs;
    var type = data.type;

    this._popup.removeStatuses();

    for (var i in msgs) {
      if (msgs.hasOwnProperty(i)) {
        var elem = this.createMessageBalloon(msgs[i], true);
        this._popup.appendChild(elem);
      }
    }

    this._popup.show();

    if (navigator.platform.match("Mac")) {
      this._popup.input.style.padding = "0px";
    }

    this._popup.setActiveTab(data);

  },

  onPopupHidden: function(event) {
    if (event.target.nodeName == "panel") {
      this.closePopup(true);
    }
  },

  closePopup: function(force) {

    if (this._popup.isOpen) {
      this._util.notify("markRead", {type: this._popup.activeTab});
      this.showUnreadCount(0);
      if (force || this._util.pref().getBoolPref("autoClose")) {
        this._popup.hide();
      }
    }
  },

  removeBalloon: function() {
    if (this._timer) {
      clearTimeout(this._timer);
    }

    try {
      var panel = this.$("identicanotifier-panel");
      panel.removeChild(this.$("identicanotifier-balloon"));
      panel.hidePopup();
    }
    catch (e) {}
  },

  createMessageBalloon: function(msg, highlight) {

    var elem = document.createElement("vbox");
    elem.className = "identicanotifier-status";
    elem.id = "tooltip-balloon-" + msg.id;
    elem.setAttribute("attr", "timeline");

    elem.setAttribute("messageId", msg.id);
    elem.setAttribute("favorited", msg.favorited);

    var user = msg.user ? msg.user : msg.sender;
    if (msg.sender) elem.setAttribute("attr", "messages");

    try {
      elem.setAttribute("href", IDENTICA_TOP_URL + user.screen_name);

      elem.setAttribute("screen_name", user.screen_name);
      elem.setAttribute("name", user.name);
      if (highlight) {
        elem.setAttribute("unread", !msg.unread);
      }

      var time_and_source = this.getLocalTimeForDate(msg.created_at);

      if (msg.source) {
        if (msg.source.match(/<a href\=\".*\">(.*)<\/a>/)) {
          time_and_source += " from " + RegExp.$1;
        }
        else {
          time_and_source += " from " + msg.source;
        }
      }

      elem.setAttribute("time", time_and_source);

      var textnode = this.replaceLinkText(msg.text);
      elem.setAttribute("text", msg.text);
      if (textnode.getAttribute("attr") == "replies") {
        elem.setAttribute("attr", "replies");
      }

      textnode.setAttribute("tooltiptext", time_and_source);
      elem.appendChild(textnode);


      elem.setAttribute("profile_image_url", user.profile_image_url);
    }
    catch (e) {
      this.log("Failed to create message balloon: " + e.message);
    }

    return elem;
  },

  setFocusToInput: function() {
    this._popup.input.value = this._popup.text;
    this._popup.input.select();
    var pos = this._popup.input.value.length;
    try {
      this._popup.input.setSelectionRange(pos, pos);
    }
    catch (e) {};
  },

  hideProgress: function() {
    this._popup.showProgress(false);

    var input = this._popup.input;
    input.select();
    input.focus();
  },

  onSendMessage: function() {

    var input = this._popup.input;

    // Ignore autocomplete result
    var re = new RegExp('^@[^ ]+$');
    if (re.test(input.value)) {
  	  return true;
    }

    if (input.value == '') {
      return false;
    }

    // convert URLs to tinyURL if the URLs are longer than 30 characters.
    var result = [];
    var tinyURL = [];
    var text = input.value;
    var pat = /((http(s?))\:\/\/)([0-9a-zA-Z\-]+\.)+[a-zA-Z]{2,6}(\:[0-9]+)?(\/([\w#!:.?+=&%@~*\';,\-\/\$])*)?/g;

    if (text.length > 140) {
      while (pat.exec(text) != null) {
        result.push(RegExp.leftContext);
        var url = RegExp.lastMatch;
        text = RegExp.rightContext;
        pat.lastIndex = 0;

        result.push(url);

        if (url.length > 25 &&
            !url.match(/tinyurl\.com/i)) {
          tinyURL.push(url);
        }
      }
    }
    if (text) {
      result.push(text);
    }

    this._sendText = result.join('').replace(/[\n\r]/, '');

    if (tinyURL.length) {
      this._popup.showProgress(true);

      this._sendMsgs = result;
      this._tinyURLs = tinyURL;
      this.makeTinyURL();
      return false;
    }

    if (this._sendText.length > 140) {
      return false;
    }

    this._popup.showProgress(true);
    this._util.notify("sendMessage", {status: this._sendText, inReplyTo:this._inReplyTo});
    return true;
  },

  makeTinyURL: function() {

    var url = this._tinyURLs[0];

    var req = new XMLHttpRequest;

    req.open('GET', IDENTIFOX_TINYURL_CREATE_API + url, true);
    var target = this;
    req.onload  = function() {target.onloadMakeTinyURL(req, url)};
    req.onerror = function() {target.onerrorMakeTinyURL()};
    req.send(null);

  },

  onloadMakeTinyURL: function(req, url) {
    if (req.status == 200) {
      this._tinyURLs.shift();

      for (var i = 0; i < this._sendMsgs.length; ++i) {
        if (this._sendMsgs[i] == url) {
          this._sendMsgs[i] = req.responseText;
          break;
        }
      }
      this._sendText = this._sendMsgs.join('').replace(/[\n\r]/, '');
    }

    if (this._tinyURLs.length) {
      this.makeTinyURL();
    }
    else {
      if (this._sendText.length > 140) {
        this.retryInput();
      }
      else {
        this._util.notify("sendMessage", {status: this._sendText, inReplyTo:this._inReplyTo});
      }
    }
  },

  onerrorMakeTinyURL: function() {
    this.retryInput();
    this.showMessage(this._strings.getString("SendMessageError"));
  },

  sentMessage: function(msg) {
    this._popup.resetText();
    this.hideProgress();
    this.closePopup(false);

    this._messageQueue = [msg];
    this.showMessage();
    this._inReplyTo = 0;

    // Workaround #110 for firefox 2:
    //   Add delay to open ballon popup to avoid the popup split each word into a line
    //
    setTimeout("gIdenticaNotifier.updateBalloon()", 300);
  },

  errorOnSendMessage: function(msg) {
    this._popup.setAttribute("errorMessage", this._strings.getString("SendMessageError"));
    this._popup.showErrorMessage(true);
    setTimeout("gIdenticaNotifier.retryInput()", 2 * 1000);
    this.showMessage(this._strings.getString("SendMessageError"));
  },

  retryInput: function() {
    this._popup.message = this._sendText;
    this._popup.showErrorMessage(false);

    var input = this._popup.input;
    input.select();
    input.focus();
  },

  onClickStatusbarIcon: function(e) {
    if (e.button == 0) {
      this.onOpenPopup();
    }
  },

  onOpenPopup: function() {
    if (!this._util.accounts) {
      this.onPreference(null);
      return;
    }

    if (this._util.pref().getBoolPref("login") == false) return;

    if (this._popup.isOpen) {
      this.closePopup(true);
    }
    else {
      this._util.notify("getRecent", {type:"timeline"});
    }
  },

  changeTab: function(name) {
    this._util.notify("markRead", {type: this._popup.activeTab});
    this._util.notify("getRecent", {type: name});
  },

  onRevertText: function(text) {
    if (text.value == "") {
      this.closePopup(true);
    }
    else {
      this._popup.resetText();
      text.select();
    }
    return true;
  },

  onInsertURL: function() {
    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);

    clipboard.copyString(content.document.location.toString());

    var text = this.$("identicanotifier-message-input");
    if (!text) {
      return;
    }

    text.focus();
    goDoCommand("cmd_paste");
  },

  onBalloonClick: function(e) {
    var node = e.target;
    if (e.button == 0) {
      var url = node.getAttribute('href');

      if (url) {
        this.showMessage();
        this.openURL(url);
        this.closePopup(false);
      }
    }
    else if (e.button == 2) {
      var menu = this.$("identicanotifier-status-menupopup");
      while (!node.id) {
        node = node.parentNode;
      }
      menu.node = node;

      menu.childNodes[1].disabled = false;
      menu.childNodes[2].disabled = false;
      menu.lastChild.disabled = true;

      if (this._popup.activeTab == 'messages') {
        menu.lastChild.disabled = false;
        menu.childNodes[1].disabled = true;
        menu.childNodes[2].disabled = true;
      }
      if (this._username.toLowerCase() == node.getAttribute("screen_name").toLowerCase()) {
        menu.lastChild.disabled = false;
      }
    }
  },

  copyDent: function(target) {

    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);

    clipboard.copyString(target.parentNode.node.getAttribute("text"));
  },

  redent: function(target) {
    var dent = target.parentNode.node;
      var text = "RD: @" + dent.getAttribute("screen_name") + ": " + dent.getAttribute("text");

      this._popup.text = text;
      this._popup.input.value = text;
      this._popup.showTextBox(true);

      this._popup.setAttribute("charcount", text.length == 0 ? "" : 140 - text.length);
      this._popup.setAttribute("charover", (text.length > 140) ? 1 : 0);

      this._popup.input.focus();
      this._popup.input.value = text;
  },

  openDent: function(target) {
    var dent = target.parentNode.node;

    var url = "http://floss.pro/notice/" + dent.getAttribute("messageId");
    this.openURL(url);
  },

  deleteDent: function(target) {
    var dent = target.parentNode.node;
    this._util.notify("deleteDent", 
                      {id:dent.getAttribute("messageId"), type:this._popup.activeTab});
  },

  messageDeleted: function(obj) {
    for (var i = 0; i < this._popup.childNodes.length; ++i) {
      var e = this._popup.childNodes[i];
      if (e.getAttribute("messageId") == obj.id) {
        this._popup.removeChild(e);
        break;
      }
    }
  },

  onBalloonMouseOver: function(e) {
    this._onFocus = true;
  },

  onBalloonMouseOut: function(e) {
    this._onFocus = false;
    if (this._needToUpdate) {
      this._needToUpdate = false;
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this._timer = setTimeout("gIdenticaNotifier.onTimeoutBalloon()", 1000);
    }
  },

  resetInReplyTo: function() {
    this._inReplyTo = 0;
  },

  onReply: function(msg) {
    if (!this._popup.isOpen) {
      this.onOpenPopup();
    }
    
    this._inReplyTo = msg.getAttribute("messageId");

    var input = this._popup.input;
    var reply = (msg.getAttribute("attr") == "messages" ? "d " : "@") + msg.getAttribute("name") + " ";

    var text = reply + input.value;
    this._popup.text = text;
    input.value = text;
    this._popup.showTextBox(true);

    this._popup.setAttribute("charcount", text.length == 0 ? "" : 140 - text.length);
    this._popup.setAttribute("charover", (text.length > 140) ? 1 : 0);

    input.focus();
    input.value = text;
  },

  onFavorite: function(msg) {
    var messageId = msg.getAttribute("messageId");
    var method;
    if (msg.getAttribute("favorited") == "false") {
      method = "create";
    }
    else {
      method = "destroy";
    }
    
    this._util.notify("setFavorite",{id: messageId, method: method});
  },

  updateFavorite: function(msg) {
    var elem = this.$("tooltip-balloon-" + msg.id);
    if (elem) {
      elem.setAttribute("favorited", msg.state);
    }
  },

  openURL: function(url) {
    var tabbrowser = gBrowser;
    var tabs = tabbrowser.tabContainer.childNodes;
    for (var i = 0; i < tabs.length; ++i) {
      var tab = tabs[i];
      try {
        var browser = tabbrowser.getBrowserForTab(tab);
        if (browser) {
          var doc = browser.contentDocument;
          var loc = doc.location.toString();
          if (loc == url) {
            gBrowser.selectedTab = tab;
            return;
          }
        }
      }
      catch (e) {
      }
    }
    
    // There is no tab. open new tab...
    var tab = gBrowser.addTab(url, null, null);
    gBrowser.selectedTab = tab;
  },

  updateStatuses: function(e) {
    this._util.notify("updateDents");
  },

  markAllRead: function(e) {
    this.showUnreadCount(-1);
    
    for (var i = 0; i < this._popup.childNodes.length; ++i) {
      var e = this._popup.childNodes[i];
      e.setAttribute("unread", true);
    }
    this._util.notify("markAllRead");
    if (this._popup.isOpen) {
      this._popup.markRead();
    }
  },

  onPreference: function(e) {
    if (this._prefWindow) {
      this._prefWindow.focus();
      return true;
    }

    this._prefWindow = window.openDialog("chrome://identicanotifier/content/login.xul", 
                                         "_blank",
                                         "chrome,resizable=no,dependent=yes");
    return true;
  },

  onTogglePopup: function(e) {
    var menu = this.$("identicanotifier-menuitem-togglepopup");
    this._showBalloon = !this._showBalloon;
    menu.setAttribute("checked", this._showBalloon);
    this._util.pref().setBoolPref("popup", this._showBalloon);
  },

  onLogout: function() {
    this.logout();
    this._util.notify("logout");
  },

  logout: function() {
    this.showUnreadCount(-1);
    this.setButtonState("");
    this.$("identicanotifier-menuitem-logout").setAttribute("disabled", true);
    this.$("identicanotifier-menuitem-update").setAttribute("disabled", true);
    this.$("identicanotifier-menuitem-account").setAttribute("label", this._strings.getString("SignIn"));

    this.checkMenuItem(null, "identicanotifier-accounts");
    this.checkMenuItem(null, "identicanotifier-accounts-popup");

    // Close balloon and popup window, reset window settings
    this.removeBalloon();
    this.closePopup(true);
    this._util.pref().setBoolPref("login", false);
  },

  onAccountMenuShowing: function(menu) {

    this._util.accounts = this._util.getPassword();
    var currentUser = this._util.pref().getCharPref("currentUser");
    this.removeAllChild(menu);

    var loggedIn = this._util.pref().getBoolPref("login");

    for (var user in this._util.accounts) {
      if (this._util.accounts.hasOwnProperty(user)) {
        var item = document.createElement("menuitem");
        item.setAttribute("label", user);
        item.setAttribute("type", "radio");
        item.setAttribute("oncommand", "gIdenticaNotifier.onChangeAccount(this.label)");

        if (currentUser == null) {
          currentUser = user;
        }

        if (user == currentUser && loggedIn) {
          item.setAttribute("checked", true);
        }
        menu.appendChild(item);
      }
    }

  },

  onChangeAccount: function(user) {

    var currentUser = this._util.pref().getCharPref("currentUser");

    if (user != currentUser || this._util.pref().getBoolPref("login") == false) {

      // Close balloon and popup window, reset window settings
      this.removeBalloon();
      this.showUnreadCount(-1);
      this._popup.removeStatuses();

      this._util.pref().setBoolPref("login", true);

      this.$("identicanotifier-menuitem-logout").setAttribute("disabled", false);
      this.$("identicanotifier-menuitem-update").setAttribute("disabled", false);
      this.$("identicanotifier-menuitem-account").setAttribute("label", this._strings.getString("ChangeAccount"));

      this._util.accounts = this._util.getPassword();

      this._util.pref().setCharPref("currentUser", user);
      this._util.notify("changeAccount", {user: user, pass: this._util.accounts[user]});
    }
  },

  //
  // Private utilities
  //
  isActiveWindow: function() {

    if (navigator.platform == "Win32" &&
        window.screenX == -32000 &&
        window.screenY == -32000) {
        return false;
    }

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
      .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow("");
    return (win == window) ? true : false;
  },

  replaceLinkText : function(text) {

    text = this._unescapeHTML.unescape(text.replace(/&amp;/g,"&"));

    var elem = document.createElement("description");
    elem.className = "identicanotifier-message-body";

    var pat = /((http(s?))\:\/\/)([0-9a-zA-Z\-]+\.)+[a-zA-Z]{2,6}(\:[0-9]+)?(\/([\w#!:.?+=&%@~*\';,\-\/\$])*)?/g;
    var re = /[.,;:]$/;
    while (pat.exec(text) != null) {
      var left = RegExp.leftContext;
      var url = RegExp.lastMatch;
      text = RegExp.rightContext;
      if (re.test(url)) {
        text = RegExp.lastMatch + text;
        url = url.replace(re, '');
      }

      this.convertFollowLink(elem, left);

      var urltext = url;
      if (url.length > 27) {
        urltext = url.substr(0, 27) + "...";
      }
      var anchor = this.createAnchorText(url, urltext, true);
      elem.appendChild(anchor);
      pat.lastIndex = 0;
    }

    if (text) {
      this.convertFollowLink(elem, text);
    }

    return elem;
  },

  convertFollowLink: function(elem, text) {
    var pat = /@(\w+)/;

    while(pat.exec(text) != null) {
      var username = RegExp.$1;
      var atUsername = RegExp.lastMatch;
      text = RegExp.rightContext;

      //elem.appendChild(document.createTextNode(RegExp.leftContext));
      this.convertHashTag(elem, RegExp.leftContext);

      var a = this.createAnchorText("http://floss.pro/" + username, atUsername, false);
      elem.appendChild(a);
      pat.lastIndex = 0;
      if (username.toLowerCase() == this._username) {
        elem.setAttribute("attr", "replies");
      }
    }
    if (text) {
      //elem.appendChild(document.createTextNode(text));
      this.convertHashTag(elem, text);
    }
  },

  convertHashTag: function(elem, text) {
    var pat = /\#([\w0-9\.\-_]*[\w0-9\-_])/;

    while(pat.exec(text) != null) {
      var tag = RegExp.$1;
      var hashTag = RegExp.lastMatch;
      text = RegExp.rightContext;

      //      elem.appendChild(document.createTextNode(RegExp.leftContext+"#"));
      this.convertGroupLink(elem, RegExp.leftContext);

      var a = this.createAnchorText("http://floss.pro/tag/" + tag, hashTag, false);
      elem.appendChild(a);
      pat.lastIndex = 0;
    }
    if (text) {
	//      elem.appendChild(document.createTextNode(text));
      this.convertGroupLink(elem, text);
    }
  },

  convertGroupLink: function(elem, text) {
    var pat = /\!([\w0-9\.\-_]*[\w0-9\-_])/;

    while(pat.exec(text) != null) {
      var group = RegExp.$1;
      var bangGroup = RegExp.lastMatch;
      text = RegExp.rightContext;

      elem.appendChild(document.createTextNode(RegExp.leftContext));

      var a = this.createAnchorText("http://floss.pro/group/" + group, bangGroup, false);
      elem.appendChild(a);
      pat.lastIndex = 0;
    }
    if (text) {
      elem.appendChild(document.createTextNode(text));
    }
  },

  createAnchorText: function(link, text, doTinyURL) {
      var anchor = document.createElement("a");
      anchor.className = "identicanotifier-hyperlink";
      anchor.setAttribute("href", link);

      anchor.setAttribute("tooltiptext", link);

      if (doTinyURL && link.match(this._tinyURL)) {
        anchor.setAttribute("onmouseover", "gIdenticaNotifier.onHoverTinyURL(this)");
      }
      anchor.appendChild(document.createTextNode(text));

      return anchor;
  },

  onHoverTinyURL: function(anchor) {
    var uri = anchor.getAttribute("tooltiptext");
    if (!uri.match(this._tinyURL)) {
      return;
    }

    var notifier = Components.classes['@uncryptic/identicanotifier;1']
      .getService(Components.interfaces.nsIIdenticaNotifier);

    var result = notifier.getDecodedTinyURL(uri);
    anchor.setAttribute("tooltiptext", result ? result : uri);
  },

  checkMenuItem: function(user, container) {
    var menu = this.$(container);
    if (menu) {
      for (var i = 0; i < menu.childNodes.length; ++i) {
        if (menu.childNodes[i].getAttribute("label") == user) {
          menu.childNodes[i].setAttribute("checked", true);
        }
        else {
          menu.childNodes[i].setAttribute("checked", false);
        }
      }
    }
  },

  initKeyConfig: function() {
    // setup short cut keys
    var key = ["togglePopup", "insertURL"];

    for (var i = 0; i < key.length; ++i) {
      var pref = this._util.pref().getCharPref(key[i]);
      var params = pref.split(/,/);

      var elem = this.$("identicanotifier-key-" + key[i]);

      if (elem) {
        if (params[0])
          elem.setAttribute("key", params[0]);
        if (params[1])
          elem.setAttribute("keycode", params[1]);
        elem.setAttribute("modifiers", params[2]);
      }
    }

  },

  removeAllChild: function(obj) {
    while(obj.firstChild) obj.removeChild(obj.firstChild);
  },

  getLocalTimeForDate: function(time) {

    system_date = new Date(time);
    user_date = new Date();
    delta_minutes = Math.floor((user_date - system_date) / (60 * 1000));
    if (Math.abs(delta_minutes) <= (8 * 7 * 24 * 60)) { // eight weeks... I'm lazy to count days for longer than that
      distance = this.distanceOfTimeInWords(delta_minutes);
      if (delta_minutes < 0) {
        return this._strings.getFormattedString("DateTimeFromNow", [distance]);
      } else {
        return this._strings.getFormattedString("DateTimeAgo", [distance]);
      }
    } else {
      return this._strings.getFormattedString("OnDateTime", [system_date.toLocaleDateString()]);
    }
  },

  // a vague copy of rails' inbuilt function, 
  // but a bit more friendly with the hours.
  distanceOfTimeInWords: function(minutes) {
    if (minutes.isNaN) return "";

    var index;

    minutes = Math.abs(minutes);
    if (minutes < 1)         index = 'LessThanAMinute';
    else if (minutes < 50)   index = (minutes == 1 ? 'Minute' : 'Minutes');
    else if (minutes < 90)   index = 'AboutOneHour';
    else if (minutes < 1080) {
      minutes = Math.round(minutes / 60);
      index = 'Hours';
    }
    else if (minutes < 1440) index = 'OneDay';
    else if (minutes < 2880) index = 'AboutOneDay';
    else {
      minutes = Math.round(minutes / 1440);
      index = 'Days';
    }
    return this._strings.getFormattedString(index, [minutes]);
  },

  log: function(msg) {
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    if (pref.getBoolPref("extensions.identicanotifier.debug")) {
      if (this._console == null) 
        this._console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
      this._console.logStringMessage(msg);
      dump(msg + "\n");
    }
  }

};

var gIdenticaNotifier = new IdenticaNotifier();

window.addEventListener("load", function(e) { gIdenticaNotifier.load(e); }, false);
window.addEventListener("unload", function(e) { gIdenticaNotifier.unload(e); }, false);
