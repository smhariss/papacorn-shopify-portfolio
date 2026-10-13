import {sceneProgress} from './motion-state.js';
const root=document.querySelector('papacorn-homepage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const bar=document.createElement('div');
bar.className='page-progress';
bar.setAttribute('aria-hidden','true');
document.body.append(bar);
let frame=0;
function update(){
 frame=0;
 document.documentElement.style.setProperty('--page-progress',sceneProgress(scrollY,0,document.documentElement.scrollHeight-innerHeight));
 document.body.classList.toggle('is-shopping',scrollY>innerHeight*.65);
}
function schedule(){if(!frame)frame=requestAnimationFrame(update)}
addEventListener('scroll',schedule,{passive:true});
addEventListener('resize',schedule,{passive:true});
schedule();
document.addEventListener('click',e=>{
 if(e.defaultPrevented)return;
 const link=e.target.closest('a[href="#flavours"]');
 if(!link||!root.motion)return;
 const sequence=root.querySelector('[data-pc-opening]')||root.querySelector('[data-pc-sequence]');
 e.preventDefault();
 history.pushState(null,'','#flavours');
 const top=sequence.getBoundingClientRect().top+scrollY+(sequence.offsetHeight-innerHeight)*.48;
 window.scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
});
