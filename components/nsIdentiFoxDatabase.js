//
// Implementation of IdentiFox database client
//

const Cc = Components.classes;
const Ci = Components.interfaces;
const CLASS_ID = Components.ID("7801FBDA-05C0-11DE-BE33-AA2956D89593");
const CLASS_NAME = "IdentiFox Database";
const CONTRACT_ID = "@uncryptic.com/identifox-database;1";
const IDENTIFOX_UUID = "identicanotifier@uncryptic.com";
const SQLITE_TEMPLATE = "identifox_1.8.sqlite";

function IdentiFoxDatabase()
{
  this._conn = null;
}

IdentiFoxDatabase.prototype = {

  QueryInterface: function(aIID) {
    // add any other interfaces you support here
    if (!aIID.equals(Components.interfaces.nsISupports) && 
        !aIID.equals(Components.interfaces.nsIIdentiFoxDatabase))
        throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

  openDatabase: function() {
    try {
      var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
      file.append("identifox_1.8.sqlite");

      if (!file.exists()) {

        var manager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);

        var defaultFile = manager.getInstallLocation(IDENTIFOX_UUID).getItemLocation(IDENTIFOX_UUID);
        defaultFile.append("defaults");
        defaultFile.append(SQLITE_TEMPLATE);
        defaultFile.copyTo(file.parent, file.leafName);
      }

      var storageService = Components.classes["@mozilla.org/storage/service;1"]
      .getService(Components.interfaces.mozIStorageService);
      this._conn = storageService.openDatabase(file);
    }
    catch (e) {
      dump("Failed to initialize database: " + e.message + "\n");
    }
  },

  exec: function(sql) {
    try {
      this._conn.executeSimpleSQL(sql);
    }
    catch (e) {
      dump(e.message + "\n");
    }
  },

  prepare: function(sql) {
    var stmt;
    try {
      stmt = this._conn.createStatement(sql);
    }
    catch (e) {
      dump(e.message + "\n");
    }
    return stmt;

  },

  close: function() {
    this._conn.close();
    dump("Database closed\n");
  },

  insert: function(obj) {
    var sql = "INSERT INTO " + obj._tablename + " (";
    sql += obj._columns.join(",") + ") VALUES (";
    for (var i = 1; i < obj._columns.length; ++i) {
      sql += "?" + i + ",";
    }
    sql += "?" + i + ")";
    dump(sql);
  },
};


//=================================================
// Note: You probably don't want to edit anything
// below this unless you know what you're doing.
//
// Singleton
var gIdentiFoxDatabase = null;

// Factory
var IdentiFoxDatabaseFactory = {
  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    if (gIdentiFoxDatabase === null) {
      gIdentiFoxDatabase = new IdentiFoxDatabase().QueryInterface(aIID);
    }
    return gIdentiFoxDatabase;
  }
};

// Module
var IdentiFoxDatabaseModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME, CONTRACT_ID, aFileSpec, aLocation, aType);

    Components.classes["@mozilla.org/categorymanager;1"]
      .getService(Components.interfaces.nsICategoryManager)
        .addCategoryEntry("app-startup", 
                          CLASS_NAME,
                          "service," + CONTRACT_ID,
                          true, true);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);        

    Components.classes["@mozilla.org/categorymanager;1"]
      .getService(Components.interfaces.nsICategoryManager)
        .deleteCategoryEntry("app-startup", 
                             CLASS_NAME,
                             true);
  },
  
  getClassObject: function(aCompMgr, aCID, aIID)  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return IdentiFoxDatabaseFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) { return IdentiFoxDatabaseModule; }

