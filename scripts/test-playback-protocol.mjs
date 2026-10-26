import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
function load(file,requireFn=()=>({}),globals={}){
 const ctx={exports:{},require:requireFn,...globals};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;
}
const protocol=load('src/features/control-tv/api/playback-protocol.ts');
const tracker=load('src/features/control-tv/api/playback-requests.ts');
const adapter=load('src/features/control-tv/api/admin-message-adapter.ts',()=>protocol);
const {buildPlaybackCommand:build,buildSocketCommand,selectedPlaybackTargets}=protocol;
const {parseAdminMessage:parse}=adapter;
const playlist={id:randomUUID(),name:'Sala',kind:'PLAYLIST'},video={id:randomUUID(),name:'Video',kind:'VIDEO'},image={id:randomUUID(),name:'Imagen',kind:'IMAGE'};
for(const selection of [playlist,video,image]){
 const command=build('start',['TV-A','TV-B','TV-A'],selection,randomUUID());
 assert.equal(command.datos.tv_ids.join(','),'TV-A,TV-B');assert.equal('tv_id' in command.datos,false);
 assert.equal(command.evento,selection.kind==='IMAGE'?'media.show':'media.play');
 assert.equal(command.datos[selection.kind==='PLAYLIST'?'playlist_id':'contenido_id'],selection.id);
}
for(const enabled of [true,false])for(const action of ['repeat','shuffle']){
 const command=build(action,['TV-A'],playlist,randomUUID(),enabled);
 assert.equal(command.datos[action==='repeat'?'repetir':'aleatorio'],enabled);assert.equal('playlist_id' in command.datos,false);
}
assert.equal(buildSocketCommand('media.play',['TV-A'],{},randomUUID()).datos.contenido_id,undefined);
const resumed=build('resume',['TV-A','TV-B'],null,randomUUID());
assert.equal(resumed.evento,'media.play');assert.equal(resumed.datos.tv_ids.join(','),'TV-A,TV-B');assert.equal(resumed.datos.playlist_id,undefined);
for (const selection of [playlist, video, image]) {
  const prepared = build('prepare',['TV-A'],selection,randomUUID());
  assert.equal(prepared.datos.auto_reproducir,false);
  assert.equal(build('start',['TV-A'],selection,randomUUID()).datos.auto_reproducir,true);
}
const stopAll=build('stop',['TV-A','TV-B'],playlist,randomUUID());
assert.equal(stopAll.evento,'media.stop');assert.equal(stopAll.datos.tv_ids.join(','),'TV-A,TV-B');assert.equal(stopAll.datos.playlist_id,undefined);
const duration=load('src/features/playlists/video-duration.ts');
assert.equal(duration.videoDurationSeconds(150.5),151);
assert.throws(()=>duration.videoDurationSeconds(NaN));
const playlistAdapter=load('src/features/playlists/api/playlists-api.ts',()=>({createApi:()=>({}),fetchBaseQuery:()=>()=>({})}));
const mixed=playlistAdapter.mapPlaylist({id:'list',nombre:'Mixta',items:[{id:'video',contenido:{id:'v',nombre:'Video',tipo:'VIDEO'},duracion_segundos:151,orden:0},{id:'image',contenido:{id:'i',nombre:'Imagen',tipo:'IMAGEN'},orden:1}]});
assert.equal(mixed.items[0].duration,151);assert.equal(mixed.items[1].duration,10);
assert.throws(()=>build('start',[],video,randomUUID()));assert.throws(()=>build('start',['TV-A'],null,randomUUID()));
assert.throws(()=>build('stop',Array.from({length:101},(_,i)=>'TV-'+i),null,randomUUID()));
assert.throws(()=>build('repeat',['TV-A'],null,randomUUID(),'true'));
assert.throws(()=>buildSocketCommand('media.volume',['TV-A'],{volumen:1.5},randomUUID()));
assert.throws(()=>buildSocketCommand('media.play',['TV-A'],{playlist_id:'p',contenido_id:'c'},randomUUID()));
assert.throws(()=>build('stop',['TV-A'],null,'invalid'));
assert.equal(selectedPlaybackTargets([{id:'a',tvCode:'TV-A',connectionStatus:'online'},{id:'b',tvCode:'TV-B',connectionStatus:'offline'},{id:'c',tvCode:'TV-C',connectionStatus:'low-signal'}],['a','b','c']).join(','),'TV-A,TV-C');
const command=build('start',['TV-A','TV-B'],playlist,randomUUID());
let requests=tracker.registerRequest({},command);
const response={requestId:command.datos.request_id,tvId:'TV-A',action:'media.play',ok:true};
requests=tracker.settleResult(requests,response);
assert.equal(requests[response.requestId].targets['TV-A'].status,'success');assert.equal(requests[response.requestId].targets['TV-B'].status,'pending');
for(const changed of [response,{...response,requestId:randomUUID()},{...response,tvId:'TV-Z'},{...response,tvId:'TV-B',action:'media.stop'}])assert.equal(tracker.settleResult(requests,changed),requests);
requests=tracker.settleResult(requests,{...response,tvId:'TV-B',ok:false,code:'TV_OFFLINE',message:'Desconectada'});
assert.equal(requests[response.requestId].targets['TV-B'].code,'TV_OFFLINE');
assert.equal(tracker.failPending(requests,'CONNECTION_LOST','Sin conexión')[response.requestId].targets['TV-A'].status,'success');
const resultData={request_id:response.requestId,tv_id:'TV-A',accion:'media.play',ok:true};
assert.equal(parse({evento:'media.result',datos:resultData}).type,'command-result');
assert.equal(parse({evento:'media.result',datos:{...resultData,ok:'true'}}),null);
assert.equal(parse({evento:'media.result',datos:{...resultData,accion:'unknown'}}),null);
assert.equal(parse(JSON.stringify({evento:'media.error',datos:{code:'INVALID_COMMAND',message:'Sobre inválido'}})).type,'command-error');
assert.equal(parse({evento:'media.repeat',datos:{tv_id:'TV-A',repetir:false}}).repeat,false);
assert.equal(parse({evento:'media.shuffle',datos:{tv_id:'TV-A',aleatorio:true}}).shuffle,true);
assert.equal(parse({evento:'media.shuffle',datos:{tv_id:'TV-A',aleatorio:'true'}}),null);
assert.equal(parse({evento:'devices.status',datos:{enline:[],low_sengal:[{tv_id:'TV-C'}]}}).onlineTvIds[0],'TV-C');
// Hook integration with an isolated socket and simulated authentication, no real TVs.
const slots=[],effects=[],timers=new Map(),windows=new Map(),sockets=[];
let timerId=0,token='test-token-1';
const react={useState:initial=>{const i=slots.push(initial)-1;return[initial,next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef:initial=>({current:initial}),useCallback:callback=>callback,useEffect:effect=>effects.push(effect)};
function fakeIo(_url,options){
 const listeners=new Map();const socket={connected:false,options,emissions:[],listeners,on:(e,f)=>listeners.set(e,f),off:e=>listeners.delete(e),emit:(event,payload)=>socket.emissions.push({event,payload}),connect:()=>{socket.connected=true;listeners.get('connect')?.();},close:()=>{socket.connected=false;listeners.get('disconnect')?.();}};sockets.push(socket);return socket;
}
const hook=load('src/features/control-tv/hooks/use-connected-tvs.ts',name=>{
 if(name==='react')return react;if(name==='socket.io-client')return{io:fakeIo};if(name.endsWith('auth-context'))return{useAuth:()=>({user:{id:'admin'},can:()=>true})};
 if(name.endsWith('playback-protocol'))return protocol;if(name.endsWith('playback-requests'))return tracker;if(name.endsWith('admin-message-adapter'))return adapter;
 if(name.endsWith('tv-adapter'))return{mapConnectedTv:value=>value};throw new Error('Unexpected import: '+name);
},{process:{env:{NEXT_PUBLIC_SOCKET_URL:'http://test/tvs'}},crypto:{randomUUID},AbortController,AbortSignal,queueMicrotask,setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),window:{addEventListener:(e,f)=>windows.set(e,f),removeEventListener:e=>windows.delete(e)},fetch:async()=>({ok:true,json:async()=>({token,expiresAt:Date.now()+600000})})});
const client=hook.useConnectedTvs(),cleanups=effects.map(effect=>effect());
const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();
let socket=sockets[0];assert.equal(socket.options.auth.token,'test-token-1');assert.equal(socket.emissions[0].payload.evento,'devices.status.request');
let sent=client.sendPlayback('start',['TV-A','TV-B'],video);
assert.equal(socket.emissions.filter(e=>e.payload.evento==='media.play').length,1);assert.equal(socket.emissions.at(-1).payload.datos.tv_ids.join(','),'TV-A,TV-B');
assert.equal(Object.keys(slots[9]).length,0,'Emitir no cambia reproducción');assert.equal(slots[10][sent.requestId].targets['TV-A'].status,'pending');
socket.listeners.get('admin.message')({evento:'media.play',datos:{tv_id:'TV-A',contenido_id:video.id,volumen:50,repetir:false,aleatorio:false}});
assert.equal(slots[9]['TV-A'].repeat,false);assert.equal(slots[9]['TV-A'].volume,50);
socket.listeners.get('admin.message')({evento:'media.result',datos:{request_id:sent.requestId,tv_id:'TV-A',accion:'media.play',ok:true}});
assert.equal(slots[10][sent.requestId].targets['TV-A'].status,'success');assert.equal(slots[10][sent.requestId].targets['TV-B'].status,'pending');assert.equal(slots[9]['TV-A'].playbackState,'playing');assert.equal(slots[9]['TV-B'],undefined);
socket.listeners.get('admin.message')({evento:'media.result',datos:{request_id:sent.requestId,tv_id:'TV-B',accion:'media.play',ok:false,code:'PLAYBACK_TIMEOUT',message:'No confirmó'}});
assert.equal(slots[10][sent.requestId].targets['TV-B'].status,'error');
client.sendAdminCommand('media.pause',{tv_id:'TV-A',contenido_id:video.id});
assert.equal(socket.emissions.at(-1).payload.datos.tv_ids.join(','),'TV-A');assert.equal('tv_id' in socket.emissions.at(-1).payload.datos,false);assert.equal('contenido_id' in socket.emissions.at(-1).payload.datos,false);assert.equal(slots[9]['TV-A'].playbackState,'playing');
const invalidId=socket.emissions.at(-1).payload.datos.request_id;
socket.listeners.get('admin.message')({evento:'media.error',datos:{request_id:invalidId,code:'INVALID_COMMAND',message:'Petición inválida'}});assert.equal(slots[10][invalidId].targets['TV-A'].status,'error');
const older=client.sendPlayback('start',['TV-A'],video),newer=client.sendPlayback('stop',['TV-A'],null);
socket.listeners.get('admin.message')({evento:'media.stop',datos:{tv_id:'TV-A'}});
socket.listeners.get('admin.message')({evento:'media.result',datos:{request_id:newer.requestId,tv_id:'TV-A',accion:'media.stop',ok:true}});
socket.listeners.get('admin.message')({evento:'media.result',datos:{request_id:older.requestId,tv_id:'TV-A',accion:'media.play',ok:true}});
assert.equal(slots[9]['TV-A'].playbackState,'stopped','Una respuesta tardía no debe sobrescribir una orden más nueva');
const waiting=client.sendPlayback('repeat',['TV-A'],null,false);const [timeoutId,timeout]=[...timers.entries()].find(([,t])=>t.delay===35000);timers.delete(timeoutId);timeout.callback();assert.equal(slots[10][waiting.requestId].targets['TV-A'].code,'PLAYBACK_TIMEOUT');
const downloading=client.sendPlayback('start',['TV-A'],video);
socket.listeners.get('admin.message')({evento:'media.progress',datos:{request_id:downloading.requestId,tv_id:'TV-A',accion:'media.play',porcentaje:40}});
assert.equal(slots[10][downloading.requestId].targets['TV-A'].progress,40);
assert.equal(slots[10][downloading.requestId].targets['TV-A'].status,'pending');
assert.equal([...timers.values()].some(t=>t.delay===920000),true);
socket.listeners.get('admin.message')({evento:'media.pause',datos:{tv_id:'TV-A',origen:'tv'}});
assert.equal(slots[9]['TV-A'].playbackState,'paused');
socket.listeners.get('admin.message')({evento:'media.result',datos:{request_id:downloading.requestId,tv_id:'TV-A',accion:'media.play',ok:true}});
assert.equal(slots[9]['TV-A'].playbackState,'paused','Un resultado atrasado no revierte el control local');
socket.listeners.get('admin.message')({evento:'media.play',datos:{tv_id:'TV-A',playlist_id:'playlist-current',contenido_actual:{id:'video-current',nombre:'probando.mp4',tipo:'VIDEO'}}});
assert.deepEqual(JSON.parse(JSON.stringify(slots[9]['TV-A'].currentMedia)),{id:'video-current',name:'probando.mp4',kind:'VIDEO'});
assert.equal(slots[9]['TV-A'].playlistId,'playlist-current');
socket.listeners.get('admin.message')({evento:'media.play',datos:{tv_id:'TV-A',playlist_id:'playlist-current',contenido_actual:{id:'image-current',nombre:'Horario.png',tipo:'IMAGEN'}}});
assert.equal(slots[9]['TV-A'].currentMedia.name,'Horario.png');
assert.equal(slots[9]['TV-A'].currentMedia.kind,'IMAGE');
socket.listeners.get('admin.message')({evento:'media.repeat',datos:{tv_id:'TV-A',playlist_id:'playlist-current',playlist_nombre:'Sala de espera',repetir:false,estado_reproduccion:'STOPPED'}});
assert.equal(slots[9]['TV-A'].playlistName,'Sala de espera');
assert.equal(slots[9]['TV-A'].playbackState,'stopped','El estado confirmado debe prevalecer incluso en actualizaciones de opciones');
assert.equal(slots[9]['TV-A'].status,'available');
token='test-token-2';windows.get('focus')();await tick();assert.equal(sockets.length,2);socket=sockets[1];assert.equal(socket.options.auth.token,token);assert.equal(socket.emissions.filter(e=>e.payload.evento.startsWith('media.')).length,0);
sent=client.sendPlayback('stop',['TV-A'],null);socket.close();assert.equal(slots[10][sent.requestId].targets['TV-A'].code,'CONNECTION_LOST');assert.equal(client.sendPlayback('stop',['TV-A'],null).sent.length,0);
cleanups.forEach(cleanup=>cleanup?.());assert.equal(timers.size,0);
// Socket-token route: only the own authenticated session, permissions and no caching.
let socketPermissions=["televisions.control"];
let permitted=true,sessionStatus=200,renewed=false,sessionChecks=0;
function jsonResponse(body,options={}){
 const response=new Response(JSON.stringify(body),options);const values=new Map();
 response.cookies={get:name=>values.get(name),getAll:()=>[...values.values()],set:cookie=>values.set(cookie.name,cookie)};return response;
}
const tokenRoute=load('src/app/api/auth/socket-token/route.ts',name=>{
 if(name==='next/headers')return{cookies:async()=>({get:()=>({value:'test-access-token'})})};
 if(name==='next/server')return{NextResponse:{json:jsonResponse}};
 if(name.endsWith('session/route'))return{GET:async()=>{sessionChecks++;const response=jsonResponse({user:{permissions:permitted?socketPermissions:[]}},{status:sessionStatus});if(renewed)response.cookies.set({name:'access',value:'renewed-test-token',httpOnly:true});return response;}};
 if(name.endsWith('auth-config'))return{ACCESS_TOKEN_COOKIE:'access'};
 throw new Error('Unexpected route import: '+name);
},{Response,Buffer,URL});
const ownRequest=()=>new Request('http://panel.test/api/auth/socket-token',{method:'POST',headers:{origin:'http://panel.test'}});
let authResponse=await tokenRoute.POST(ownRequest());assert.equal(authResponse.status,200);assert.equal(authResponse.headers.get('cache-control'),'no-store');assert.equal((await authResponse.json()).token,'test-access-token');
renewed=true;authResponse=await tokenRoute.POST(ownRequest());assert.equal((await authResponse.json()).token,'renewed-test-token');assert.equal(authResponse.cookies.get('access').httpOnly,true);
socketPermissions=["televisions.view"];authResponse=await tokenRoute.POST(ownRequest());assert.equal(authResponse.status,200);
permitted=false;authResponse=await tokenRoute.POST(ownRequest());assert.equal(authResponse.status,403);
const checked=sessionChecks;authResponse=await tokenRoute.POST(new Request('http://panel.test/api/auth/socket-token',{method:'POST',headers:{origin:'http://other.test'}}));assert.equal(authResponse.status,403);assert.equal(sessionChecks,checked);
sessionStatus=401;authResponse=await tokenRoute.POST(ownRequest());assert.equal(authResponse.status,401);
console.log('OK: token/reconexión, un mensaje por grupo, request_id, resultados parciales, duplicados/ajenos, errores, timeout y sin éxito optimista.');
