const {runCalendarSync}=require('./calendar-sync-core');
exports.handler=async()=>runCalendarSync({shard:1,shardCount:2,label:'B'});
