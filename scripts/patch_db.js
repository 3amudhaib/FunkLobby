const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

function out(obj){
  try{ console.log(JSON.stringify(obj)); }catch(e){ console.log(obj); }
}

const appdata = process.env.APPDATA;
const user = process.env.USERPROFILE || process.env.HOME;
if(!appdata){ out({status:'ERROR', reason:'APPDATA not found'}); process.exit(2); }

const db = path.join(appdata, 'FunkLobby', 'funklobby.db');
if(!fs.existsSync(db)){ out({status:'MISSING_DB', path: db}); process.exit(2); }

const bak = path.join((user||'.'),'Desktop','funklobby.db.bak');
try{ fs.copyFileSync(db, bak, fs.constants.COPYFILE_FICLONE); out({backup:'OK', backup_path: bak}); }
catch(e){ try{ fs.copyFileSync(db, bak); out({backup:'OK', backup_path: bak}); }catch(er){ out({backup:'FAILED', error: String(er)}); }}

function trySqlite3Module(cb){
  try{
    const sqlite3 = require('sqlite3').verbose();
    const conn = new sqlite3.Database(db, (err)=>{
      if(err) return cb(err);
      conn.run("ALTER TABLE Engine ADD COLUMN exePath TEXT;", function(err){
        if(err) return cb(err);
        cb(null, 'COLUMN_ADDED');
        conn.close();
      });
    });
  }catch(e){ cb(e); }
}

function trySqliteCli(cb){
  // sqlite3 "path" "ALTER TABLE...;"
  const cmd = 'sqlite3';
  const args = [db, "ALTER TABLE Engine ADD COLUMN exePath TEXT;"];
  const child = child_process.spawn(cmd, args, {windowsHide:true});
  let stderr='';
  child.stderr.on('data', d=> stderr += d.toString());
  child.on('close', code=>{
    if(code===0) return cb(null, 'COLUMN_ADDED');
    cb(new Error(`sqlite3_cli_exit_${code}: ${stderr}`));
  });
}

trySqlite3Module((err, ok)=>{
  if(!err){ out({status:ok}); return process.exit(0); }
  // try CLI
  trySqliteCli((err2, ok2)=>{
    if(!err2){ out({status:ok2}); return process.exit(0); }
    out({status:'FAILED', errors:[String(err), String(err2)]});
    return process.exit(1);
  });
});
