CREATE TABLE statuses (
   'id'                         INTEGER,
    'type'                      INTEGER,
    'account_id'                INTEGER,
    'user_id'                   INTEGER,
    'text'                      TEXT,
    'created_at'                INTEGER,
    'source'                    TEXT,
    'favorited'                 INTEGER,
    'truncated'                 INTEGER,
    'in_reply_to_status_id'     INTEGER,
    'in_reply_to_user_id'       INTEGER,
    'in_reply_to_screen_name'   TEXT,
PRIMARY KEY(id, type, account_id)
);
CREATE INDEX statuses_in_reply_to_status_id on statuses(in_reply_to_status_id);

CREATE TABLE direct_messages (
    'id'                     INTEGER,
    'sender_id'              INTEGER,
    'recipient_id'           INTEGER,
    'text'                   TEXT,
    'created_at'             INTEGER,
    'sender_screen_name'     TEXT,
    'recipient_screen_name'  TEXT,
PRIMARY KEY(id)
);
CREATE INDEX direct_messages_sender_id on direct_messages(sender_id);
CREATE INDEX direct_messages_recipient_id on direct_messages(recipient_id);

CREATE TABLE users (
    'user_id'                INTEGER PRIMARY KEY,
    'name'                   TEXT,
    'screen_name'            TEXT,
    'location'               TEXT,
    'description'            TEXT,
    'url'                    TEXT,
    'followers_count'        INTEGER,
    'profile_image_url'      TEXT,
    'protected'              INTEGER
);
CREATE INDEX users_name on users(name);
CREATE INDEX users_screen_name on users(screen_name);

CREATE TABLE followees (
    'user_id'                INTEGER PRIMARY KEY,
    'name'                   TEXT,
    'screen_name'            TEXT,
    'profile_image_url'      TEXT
);
CREATE INDEX followees_name on followees(name);
CREATE INDEX followees_screen_name on followees(screen_name);

CREATE TABLE queries (
    'query'                  TEXT PRIMARY KEY
);

