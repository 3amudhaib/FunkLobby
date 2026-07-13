import os, shutil, sqlite3, sys

appdata = os.environ.get('APPDATA')
user = os.environ.get('USERPROFILE')
if not appdata:
    print('ERROR: APPDATA not found')
    sys.exit(2)

db = os.path.join(appdata, 'FunkLobby', 'funklobby.db')
if not os.path.exists(db):
    print('MISSING_DB')
    sys.exit(2)

bak = os.path.join(user or '.', 'Desktop', 'funklobby.db.bak')
try:
    shutil.copy2(db, bak)
    print('BACKUP_CREATED', bak)
except Exception as e:
    print('BACKUP_FAILED', str(e))
    # continue, attempt to modify original

try:
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info('Engine');")
    cols = [r[1] for r in cur.fetchall()]
    if 'exePath' in cols:
        print('ALREADY_PRESENT')
        conn.close()
        sys.exit(0)
    try:
        cur.execute("ALTER TABLE Engine ADD COLUMN exePath TEXT;")
        conn.commit()
        print('COLUMN_ADDED')
    except Exception as e:
        print('ALTER_FAILED', str(e))
        conn.rollback()
        conn.close()
        sys.exit(1)
    conn.close()
except Exception as e:
    print('ERROR', str(e))
    sys.exit(1)
