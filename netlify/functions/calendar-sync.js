const {runCalendarSync}=require('./calendar-sync-core');
const {runOlympicsU23Import}=require('./olympics-u23-import-core');
exports.handler=async()=>{
  try{
    await runOlympicsU23Import({skipIfComplete:true});
  }catch(error){
    console.error('calendar-sync olympics-u23 preload',error?.message||error);
  }
  return runCalendarSync();
};
