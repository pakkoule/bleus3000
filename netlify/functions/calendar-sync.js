const {runCalendarSync}=require('./calendar-sync-core');
exports.handler=async()=>runCalendarSync({shard:0,shardCount:2,label:'A'});
