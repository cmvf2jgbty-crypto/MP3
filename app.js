function download(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
let CAPACITY=0x750000;
const layout=document.querySelector('#layout');
function capacityLabel(){return CAPACITY===0x500000?'5':'7.3125';}
function musicAddress(){return CAPACITY===0x500000?'0x300000':'0xb0000';}
layout.onchange=()=>{CAPACITY=Number(layout.value);document.querySelector('#write-command').textContent=`python -m esptool --chip esp32c3 --port COM端口 write-flash ${musicAddress()} music.bin`;render();};
async function buildPack(files) {
  if(!files.length || files.length>32) throw Error('请选择 1–32 个 MP3 文件');
  let cursor=8+64*files.length;
  const items=[];
  for(const file of files) {
    if(!/\.mp3$/i.test(file.name) || !file.size) throw Error('仅支持非空 MP3 文件');
    if(cursor+file.size>CAPACITY) throw Error('曲库超过所选固件容量，请减少歌曲或降低码率');
    items.push({file,offset:cursor}); cursor+=file.size;
  }
  const bytes=new Uint8Array(cursor), view=new DataView(bytes.buffer);
  bytes.set([80,77,80,51]); view.setUint32(4,items.length,true);
  for(let i=0;i<items.length;i++) {
    const {file,offset}=items[i], r=8+64*i;
    view.setUint32(r,offset,true); view.setUint32(r+4,file.size,true);
    // Device font is ASCII. Keep titles readable instead of missing glyphs.
    const name=file.name.replace(/\.mp3$/i,'').replace(/[^\x20-\x7e]/g,'_').slice(0,55)||`Track ${i+1}`;
    bytes.set(new TextEncoder().encode(name),r+8);
    bytes.set(new Uint8Array(await file.arrayBuffer()),offset);
  }
  return bytes;
}


let files=[], url;
const $=s=>document.querySelector(s), msg=s=>$('#message').textContent=s;
function render(){
 const list=$('#list'); list.replaceChildren();
 if(!files.length){const li=document.createElement('li');li.className='empty';li.textContent='还没有歌曲，添加一首开始吧。';list.append(li);}
 files.forEach((file,i)=>{const li=document.createElement('li'),name=document.createElement('span'),play=document.createElement('button'),remove=document.createElement('button');name.textContent=`${String(i+1).padStart(2,'0')}  ${file.name}`;play.textContent='试听';play.onclick=()=>{if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);$('#audio').src=url;$('#audio').play().catch(()=>msg('无法播放此文件，请检查 MP3 编码'));};remove.textContent='×';remove.setAttribute('aria-label',`移除 ${file.name}`);remove.onclick=()=>{files.splice(i,1);render();};const save=document.createElement('button');save.textContent='下载 MP3';save.onclick=()=>download(file,file.name);li.append(name,play,save,remove);list.append(li);});
 const total=8+64*files.length+files.reduce((s,f)=>s+f.size,0);$('#usage').textContent=`${(total/1048576).toFixed(2)} / ${capacityLabel()} MiB`;$('#pack').disabled=!files.length||total>CAPACITY||files.length>32;
 if(total>CAPACITY)msg(`曲库超过 ${capacityLabel()} MiB，请移除部分歌曲。`);else if(files.length>32)msg('最多支持 32 首。');else msg('');
}
function add(items){const valid=Array.from(items).filter(f=>/\.mp3$/i.test(f.name)&&f.size);files.push(...valid);render();if(valid.length<items.length)msg('已跳过非 MP3 或空文件。');}
$('#files').onchange=e=>{add(e.target.files);e.target.value='';};
$('#drop').ondragover=e=>e.preventDefault();$('#drop').ondrop=e=>{e.preventDefault();add(e.dataTransfer.files);};
$('#clear').onclick=()=>{files=[];$('#audio').pause();$('#audio').removeAttribute('src');if(url)URL.revokeObjectURL(url);render();};
$('#pack').onclick=async()=>{try{const data=await buildPack(files),link=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type:'application/octet-stream'}));link.href=u;link.download='music.bin';link.click();setTimeout(()=>URL.revokeObjectURL(u),30000);msg(`曲库已生成。请写入所选固件的曲库地址 ${musicAddress()}。`);}catch(e){msg(e.message);}};

let port;
const connection=document.querySelector('#connection');
const connect=document.querySelector('#connect');
const disconnect=document.querySelector('#disconnect');
connect.onclick=async()=>{
 if(!('serial' in navigator)){connection.textContent='当前浏览器不支持 USB 串口，请在电脑 Chrome 或 Edge 中打开。';return;}
 connect.disabled=true;
 try{const selected=await navigator.serial.requestPort();await selected.open({baudRate:115200});port=selected;disconnect.disabled=false;connection.textContent='串口已连接。此连接用于确认设备；写入曲库前请先断开。';}
 catch(e){connection.textContent=e.name==='NotFoundError'?'未选择设备。':`连接失败：${e.message}。请关闭占用串口的程序后重试。`;connect.disabled=false;}
};
disconnect.onclick=async()=>{try{if(port)await port.close();port=null;connect.disabled=false;disconnect.disabled=true;connection.textContent='已断开，可在电脑终端写入曲库。';}catch(e){connection.textContent=`断开失败：${e.message}`;}};
if('serial' in navigator)navigator.serial.addEventListener('disconnect',()=>{port=null;connect.disabled=false;disconnect.disabled=true;connection.textContent='设备已断开。';});
