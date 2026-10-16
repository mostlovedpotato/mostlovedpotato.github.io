'use strict';
const config=window.WORKBUD_CONFIG||{}, status=document.querySelector('#status');
let token='', busy=false;
const value=id=>document.getElementById(id).value;
function message(text){status.textContent=text;}
function lock(value){busy=value;document.querySelectorAll('button').forEach(button=>button.disabled=value);}
function forget(){token='';document.getElementById('password').value='';document.getElementById('confirmation').value='';document.getElementById('deletion').hidden=true;}
async function api(path,body,auth='',method='POST'){
  const response=await fetch(config.url+path,{method,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{apikey:config.publicKey,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});
  const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{data={};}
  if(!response.ok)throw new Error(response.status===429?'Too many attempts. Please wait and try again.':path.includes('account-delete')?(data.message||'Deletion could not be confirmed. Contact support or retry.'):'Could not complete this request. Check your details, or request a new code.');
  return data;
}
function handle(id,action){document.getElementById(id).addEventListener('submit',async event=>{event.preventDefault();if(busy)return;lock(true);try{await action();}catch(error){message(error.name==='TimeoutError'?'The request timed out. Its outcome is uncertain; check before retrying.':error.message);}finally{lock(false);}});}
try{
  const url=new URL(config.url);if(url.protocol!=='https:'||!url.hostname.match(/^[a-z0-9-]+\.supabase\.co$/)||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!config.publicKey?.startsWith('sb_publishable_'))throw new Error();
  config.url=url.origin;
  message('Sign in below to manage your account.');
  document.getElementById('support').textContent='Support: '+config.supportEmail+' · '+config.developerName;
  handle('login',async()=>{const credentials={email:value('email').trim(),password:value('password')};forget();const session=await api('/auth/v1/token?grant_type=password',credentials);token=session.access_token;document.getElementById('password').value='';if(!token)throw new Error('Sign-in did not complete.');document.getElementById('deletion').hidden=false;message('Identity verified. Review the deletion details below.');});
  handle('send-code',async()=>{await api('/auth/v1/recover',{email:value('recovery-email').trim()});message('If this account exists, a recovery code will arrive by email.');});
  handle('reset',async()=>{if(value('new-password')!==value('repeat-password'))throw new Error('Passwords do not match.');const session=await api('/auth/v1/verify',{email:value('recovery-email').trim(),token:value('code').trim(),type:'recovery'});try{await api('/auth/v1/user',{password:value('new-password')},session.access_token,'PUT');}finally{try{await api('/auth/v1/logout?scope=local',{},session.access_token);}catch{}}for(const id of ['code','new-password','repeat-password'])document.getElementById(id).value='';message('Password updated. Sign in above to delete your account.');});
  handle('delete',async()=>{if(!token||value('confirmation')!=='DELETE')throw new Error('Sign in and type DELETE first.');const result=await api('/functions/v1/account-delete',{},token);if(result.deleted!==true)throw new Error('Deletion was not confirmed.');forget();message('Your account and associated server app records have been deleted. Clear app storage on your phone to remove local files.');});
  document.getElementById('signout').addEventListener('click',async()=>{if(busy)return;lock(true);let warning='';try{await api('/auth/v1/logout?scope=local',{},token);}catch{warning=' Server sign-out could not be confirmed.';}finally{forget();lock(false);message('Signed out of this page.'+warning);}});
}catch{lock(true);message('Account tools are not configured yet. This development page must not be submitted as a live deletion URL.');}
