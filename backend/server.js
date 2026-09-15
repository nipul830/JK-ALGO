import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app=express();
app.use(cors());
app.use(express.json({limit:'64kb'}));

const PORT=Number(process.env.PORT||8787);

function deltaBase(environment='testnet'){
  return environment==='live'
    ? (process.env.DELTA_BASE_URL||'https://api.india.delta.exchange')
    : (process.env.DELTA_TESTNET_BASE_URL||'https://cdn-ind.testnet.deltaex.org');
}

function signDelta(method,path,timestamp,body,secret){
  const payload=String(timestamp)+method.toUpperCase()+path+(body||'');
  return crypto.createHmac('sha256',secret).update(payload).digest('hex');
}

function credentials(body){
  const key=String(body?.apiKey||'').trim();
  const secret=String(body?.apiSecret||'').trim();
  if(!key||!secret) throw new Error('Delta API Key and API Secret are required');
  return {key,secret};
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'JK Algo Hub Backend'}));

app.post('/api/delta/test',async(req,res)=>{
  try{
    const {key,secret}=credentials(req.body);
    const environment=req.body.environment==='live'?'live':'testnet';
    const path='/v2/time';
    const base=deltaBase(environment);
    const timestamp=Math.floor(Date.now()/1000);
    const signature=signDelta('GET',path,timestamp,'',secret);
    const upstream=await fetch(base+path,{headers:{
      'api-key':key,'timestamp':String(timestamp),'signature':signature,'User-Agent':'JK-Algo-Hub'
    }});
    const text=await upstream.text();
    res.status(upstream.ok?200:502).json({ok:upstream.ok,status:upstream.status,environment,response:text.slice(0,1000)});
  }catch(e){res.status(400).json({ok:false,error:e.message});}
});

if (!process.env.VERCEL) {
  app.listen(PORT,()=>console.log('JK Algo Hub backend listening on '+PORT));
}

export default app;
