export const LOG_PAGE_SIZE=50;
export function logFilters({start='',end='',username='',action=''}) {
 const date=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('วันที่ไม่ถูกต้อง');return new Date(s+'T00:00:00+07:00');};
 const from=start?date(start):null,to=end?date(end):null;
 if(from&&to&&from>to)throw Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
 const literal=s=>s.trim().replace(/[\\%_*]/g,c=>'\\'+c);
 return {from:from?.toISOString(),until:to?new Date(to.getTime()+86400000).toISOString():null,username:literal(username),action:literal(action)};
}
export function activityLogQuery(client,filters,page){
 let q=client.from('activity_logs').select('id,created_at,username,action,details',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false});
 if(filters.from)q=q.gte('created_at',filters.from);if(filters.until)q=q.lt('created_at',filters.until);
 if(filters.username)q=q.ilike('username','%'+filters.username+'%');if(filters.action)q=q.ilike('action','%'+filters.action+'%');
 return q.range((page-1)*LOG_PAGE_SIZE,page*LOG_PAGE_SIZE-1);
}
