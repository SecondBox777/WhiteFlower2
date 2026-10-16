import { isLanguage } from '../i18n.js';
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const key=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function issueShareToken({result,language},secret,now=Date.now()){
 if(!secret)return null;
 const payload=encode(encoder.encode(JSON.stringify({purpose:'result-share-v1',id:crypto.randomUUID(),iq:Math.round(result.iq),language,expires:now+86400000})));
 return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload))))}`;
}
export async function verifyShareToken(token,secret,now=Date.now()){
 try{
  const parts=token.split('.');if(!secret||parts.length!==2||!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),encoder.encode(parts[0])))return null;
  const data=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  return data.purpose==='result-share-v1'&&/^[0-9a-f-]{36}$/.test(data.id)&&Number.isInteger(data.iq)&&isLanguage(data.language)&&data.expires>now&&data.expires<=now+86400000?data:null;
 }catch{return null;}
}
