const mysql=require('mysql2/promise'),assert=require('node:assert/strict'),fs=require('fs'),{randomUUID}=require('crypto');
const {writeGps}=require('../scripts/house-gps-writer.cjs');
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:33317,user:'root',password:'local-fixture-only'});try{
 const name='house_gps_test_'+Date.now();await db.query('CREATE DATABASE `'+name+'`');await db.query('USE `'+name+'`');
 await db.query('CREATE TABLE village(village_id INT PRIMARY KEY,village_moo VARCHAR(10)) ENGINE=InnoDB');
 await db.query('CREATE TABLE house(house_id INT PRIMARY KEY,village_id INT,address VARCHAR(150),latitude VARCHAR(100),longitude VARCHAR(100)) ENGINE=InnoDB');
 await db.query(fs.readFileSync('scripts/house-gps-receipts.sql','utf8').replace(/^\uFEFF/,''));
 await db.query("INSERT INTO village VALUES(1,'1');").catch(e=>{throw e});await db.query("INSERT INTO house VALUES(1,1,'10',NULL,NULL)");
 const q={id:randomUUID(),house_id:'1',village_id:'1',moo:'1',address:'10',old_latitude:null,old_longitude:null,latitude:16,longitude:103,accuracy:5};
 await assert.rejects(writeGps(db,{...q,address:'wrong'}),/HOUSE_CHANGED/);
 await assert.rejects(writeGps(db,{...q,old_latitude:'15'}),/GPS_CHANGED/);
 assert.equal((await writeGps(db,q)).replayed,false);assert.equal((await writeGps(db,q)).replayed,true);
 await assert.rejects(writeGps(db,{...q,longitude:102}),/RECEIPT_CONFLICT/);
 const [r]=await db.query('SELECT latitude,longitude FROM house');assert.deepEqual(r[0],{latitude:'16',longitude:'103'});
 console.log('PASS real MariaDB: identity and baseline rollback, write + receipt, replay without overwrite, changed payload blocked');
 }finally{await db.end();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
