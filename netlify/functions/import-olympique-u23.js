const {runOlympicsU23Import}=require('./olympics-u23-import-core');
exports.handler=async()=>{
  try{
    const summary=await runOlympicsU23Import({skipIfComplete:false});
    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(summary)};
  }catch(error){
    console.error('import-olympique-u23 fatal',error);
    return {statusCode:500,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:String(error?.message||error)})};
  }
};
