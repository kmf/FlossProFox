const IdenticaNotifierLogin = {

  util: new naanExUtils("identicanotifier"),
  keyconfig: ["togglePopup", "insertURL"],
  vkNames: [],
  platformKeys: {},
  localKeys: {},
 
  onLoad: function() {

    var $ = this.util.$;
    this.strings = document.getElementById("identicanotifier-strings");

    this.buildUserList();

    var interval = this.util.pref().getIntPref("interval");
    if (!interval || interval < 3) {
      interval = 3;
    }
    $("refresh-interval").value = interval;

    var popup = this.util.pref().getIntPref("popup-interval");
    if (!popup) {
      popup = 3;
    }
    $("popup-interval").value = popup;

    $("popup-autoclose").checked = this.util.pref().getBoolPref("autoClose");
    $("balloon-popup").checked   = this.util.pref().getBoolPref("popup");

    $("sound").checked         = this.util.pref().getBoolPref("sound");
    $("sound-file").value      = this.util.pref().getCharPref("soundFile");
    $("sound-file").disabled   = !$("sound").checked;
    $("choose-sound").disabled = !$("sound").checked;

    this.localeKeys = document.getElementById("localeKeys");

    var platformKeys = document.getElementById("platformKeys");
    this.platformKeys.shift   = platformKeys.getString("VK_SHIFT");
    this.platformKeys.meta    = platformKeys.getString("VK_META");
    this.platformKeys.alt     = platformKeys.getString("VK_ALT");
    this.platformKeys.control = platformKeys.getString("VK_CONTROL");
    this.platformKeys.sep     = platformKeys.getString("MODIFIER_SEPARATOR");

    pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefService).getBranch("ui.key.");

    switch (pref.getIntPref("accelKey")) {
    case 17:
      this.platformKeys.accel = this.platformKeys.control;
      break;
    case 18: 
      this.platformKeys.accel = this.platformKeys.alt;
      break;
    case 224:
      this.platformKeys.accel = this.platformKeys.meta;
      break;
    default:
      this.platformKeys.accel = (window.navigator.platform.search("Mac") == 0 ?
                                 this.platformKeys.meta : this.platformKeys.control);
    }

    for (var property in KeyEvent) {
      this.vkNames[KeyEvent[property]] = property.replace("DOM_","");
    }
    this.vkNames[8] = "VK_BACK";

    for (var i in this.keyconfig) {
      var pref = this.util.pref().getCharPref(this.keyconfig[i]);
      var param = pref.split(/,/);
      var e = $("identicanotifier-key-" + this.keyconfig[i]);
      e.value = this.getPrintableKeyName(param[2], param[0], param[1]);
      e.initialValue = e.pref = pref;
    }

  },

  onUnload: function() {
    try {
      window.opener.gIdenticaNotifier._prefWindow = null;
    }
    catch (e) {}
  },

  onAddAccount: function() {
    var msg = this.strings.getString("AddAccount");
    var user = {value: ""};
    var pass = {value: ""};

    if (!this.promptPasswordDialog(user, pass, msg)) return;

    var list = this.util.$("accounts");
    for (var i = 0; i < list.itemCount; ++i) {
      if (list.getItemAtIndex(i).value == user.value) {
        var err = this.strings.getFormattedString("AccountAlreadyExist", [user.value]);
        alert(err);
        return;
      }
    }
    var item = list.appendItem(user.value, user.value);
    list.selectItem(item);

    this.util.savePassword(user.value, pass.value);
    this.util.pref().setCharPref("currentUser", user.value);
    this.updateButtonState();
    this.showMessage(this.strings.getFormattedString("AccountAdded", [user.value]));
    this.accountChanged = true;
  },

  onEditAccount: function() {

    var list = this.util.$("accounts");
    var username = list.selectedItem.value;
    var msg = this.strings.getFormattedString("EditAccount", [username]);

    var user = {value: username};
    var pass = {value: this.util.getUserPassword(username)};

    if (!this.promptPasswordDialog(user, pass, msg)) return;

    this.util.savePassword(user.value, pass.value);
    this.util.pref().setCharPref("currentUser", user.value);
    this.showMessage(this.strings.getFormattedString("AccountModified", [user.value]));
    this.accountChanged = true;
  },

  promptPasswordDialog: function(user, pass, msg) {
    var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    while (1) {
      var result = prompt.promptUsernameAndPassword(window, "FlossProFox", msg, user, pass, "", {value:false});
      if (!result) return false;
      if (user.value && pass.value) return true;
    }
    return true;
  },

  onRemoveAccount: function() {
    var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    var list = this.util.$("accounts");
    var user = list.selectedItem.value;
    var msg = this.strings.getFormattedString("RemoveAccountConfirm", [user]);
    var result = prompt.confirm(window, "FlossProFox", msg);
    if (!result) return;

    this.util.removePassword(user);
    list.removeItemAt(list.selectedIndex);
    this.updateButtonState();
    this.showMessage(this.strings.getFormattedString("AccountRemoved", [user]));
    this.accountChanged = true;
  },


  onCheckSound: function(flag) {
    document.getElementById('sound-file').disabled = flag;
    document.getElementById('choose-sound').disabled = flag;
  },

  onBrowseFile: function() {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, this.strings.getString("ChooseSoundFile"), nsIFilePicker.modeOpen);
    if (navigator.platform == "MacPPC" || 
        navigator.platform == "MacIntel") {
      fp.appendFilter(this.strings.getString("SoundFileFilter") + " (*.wav, *.aiff)" , "*.wav; *.aiff");
    }
    else {
      fp.appendFilter(this.strings.getString("SoundFileFilter") + " (*.wav)", "*.wav");
    }

    var ret = fp.show();
    if (ret == nsIFilePicker.returnOK || ret == nsIFilePicker.returnReplace) {
      var file = fp.file;
      this.util.$("sound-file").value = file.path;
    }
  },

  buildUserList: function() {
    this.accounts = this.util.getPassword();
    var list = this.util.$("accounts");
    while (list.firstChild) list.removeChild(menu.firstChild);

    if (this.accounts == null) {
      this.updateButtonState();
      return;
    }

    var currentUser = this.util.pref().getCharPref("currentUser");
    if (!this.accounts[currentUser]) {
      currentUser = "";
    }

    for (var user in this.accounts) {
      if (this.accounts.hasOwnProperty(user)) {
        var item = list.appendItem(user, user);
      }
    }
    this.updateButtonState();
  },

  updateButtonState: function() {

    var list = this.util.$("accounts");
    if (list.itemCount) {
      this.util.$("remove-account-button").disabled = false;
      this.util.$("edit-account-button").disabled = false;
    }
    else {
      this.util.$("remove-account-button").disabled = true;
      this.util.$("edit-account-button").disabled = true;
    }

  },

  showMessage: function(msg) {
    this.util.$("message").value = msg;
  },

  recognize: function(e) {
    e.preventDefault();
    e.stopPropagation();

    var modifiers = [];
    if(e.altKey)   modifiers.push("alt");
    if(e.ctrlKey)  modifiers.push("control");
    if(e.metaKey)  modifiers.push("meta");
    if(e.shiftKey) modifiers.push("shift");

    modifiers = modifiers.join(" ");

    var key = "";
    var keycode = "";
    if(e.charCode) {
      key = String.fromCharCode(e.charCode).toUpperCase();
    }
    else { 
      keycode = this.vkNames[e.keyCode];
      if(!keycode) return;
    }

    var val = this.getPrintableKeyName(modifiers, key, keycode);
    if (val) {
      e.target.value = val;
      e.target.pref = key + "," + keycode + "," + modifiers;
    }

    this.showMessage(this.strings.getString("WarnKeyConfig"));
  },

  revert: function(e) {
    var target = e.target.previousSibling;
    var param = target.initialValue.split(/,/);
    target.value = this.getPrintableKeyName(param[2], param[0], param[1]);
    target.pref  = param[0] + "," + param[1] + "," + param[2];
  },

  getPrintableKeyName: function(modifiers,key,keycode) {
    if(modifiers == "shift,alt,control,accel" && keycode == "VK_SCROLL_LOCK") return "";

    if (!modifiers && !keycode)
      return "";

    var val = "";
    if(modifiers) {
      val = modifiers.replace(/^[\s,]+|[\s,]+$/g,"").split(/[\s,]+/g).join(this.platformKeys.sep);
    }

    var   mod = ["alt", "shift", "control", "meta", "accel"];
    for (var i in mod) {
      val = val.replace(mod[i], this.platformKeys[mod[i]]);
    }

    if (val)
      val += this.platformKeys.sep;

    if(key) {
      val += key;
    }
    if(keycode) {
      try {
        val += this.localeKeys.getString(keycode);
      }
      catch(e) {
        val += keycode;
      }
    }

    return val;
  },

  onSubmit: function() {
    var $ = this.util.$;

    this.util.pref().setIntPref("interval", $("refresh-interval").value);
    this.util.pref().setIntPref("popup-interval", $("popup-interval").value);
    this.util.pref().setBoolPref("autoClose", $("popup-autoclose").checked);
    this.util.pref().setBoolPref("popup", $("balloon-popup").checked);

    this.util.pref().setBoolPref("sound", $("sound").checked);
    this.util.pref().setCharPref("soundFile", $("sound-file").value);

    for (var i in this.keyconfig) {
      var elem = $("identicanotifier-key-" + this.keyconfig[i]);
      this.util.pref().setCharPref(this.keyconfig[i], elem.pref);
    }

    this.util.notify("updatePref");

    if (this.accountChanged) {
      var item = this.util.$("accounts").selectedItem;
      if (item == null) {
        return;
      }

      var username = item.value;
      this.util.pref().setCharPref("currentUser", username);

      var password = this.util.getAccountInfo();
      this.util.notify("changeAccount", password);
      this.util.pref().setBoolPref("login", true);
    }

    return true;
  },

  onCancel: function() {
    try {
      window.opener.gIdenticaNotifier._prefWindow = null;
    }
    catch (e) {}
  }
};

