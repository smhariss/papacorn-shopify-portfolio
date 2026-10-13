const products=[
  {id:'choc-corn',name:'Choc Corn',kind:'Sweet',categories:['sweet']},
  {id:'butter-scotch',name:'Butter Scotch',kind:'Sweet',categories:['sweet']},
  {id:'caramel-peanut',name:'Caramel Peanut',kind:'Sweet',categories:['sweet']},
  {id:'sweet-salted',name:'Sweet & Salted',kind:'Sweet + salty',categories:['sweet','savoury']},
  {id:'plain',name:'Plain',kind:'Classic',categories:['savoury']},
  {id:'toffee',name:'Toffee',kind:'Sweet',categories:['sweet']},
  {id:'cheese',name:'Cheese',kind:'Savoury',categories:['savoury']},
  {id:'bbq',name:'BBQ',kind:'Savoury',categories:['savoury']},
  {id:'hot-spicy',name:'Hot & Spicy',kind:'Spicy',categories:['savoury']}
];
const price=150, cart=new Map(), grid=document.getElementById('product-grid'), drawer=document.querySelector('.cart-drawer');
let toastTimer;
function renderProducts(filter='all'){
  const selected=products.filter(p=>filter==='all'||p.categories.includes(filter));
  grid.innerHTML=selected.map(p=>`<article class="product-card"><div class="product-image"><img src="assets/${p.id}.webp" alt="PapaCorn ${p.name}, 50g" width="900" height="900" loading="lazy"><span class="product-kind">${p.kind.toUpperCase()}</span></div><div class="product-info"><div><h3>${p.name}</h3><p>50g <span>·</span> Rs. 150</p></div><button class="add-button" data-add="${p.id}" aria-label="Add ${p.name} to bag">+</button></div></article>`).join('');
  document.querySelector('.filter-status').textContent=`${selected.length} flavours shown`;
}
function notify(message){const toast=document.querySelector('.toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2800)}
function updateCart(){
  const items=document.getElementById('cart-items'),active=document.activeElement;
  const focusedControl=items.contains(active)?{id:active.dataset.quantity||active.dataset.remove,delta:active.dataset.delta,remove:active.hasAttribute('data-remove')}:null;
  const count=[...cart.values()].reduce((a,b)=>a+b,0);
  document.querySelectorAll('.cart-count').forEach(el=>el.textContent=count);
  document.querySelectorAll('[data-open-cart]').forEach(el=>el.setAttribute('aria-label',`${el.dataset.bagLabel||'Open bag'}, ${count} ${count===1?'item':'items'}`));
  items.innerHTML=[...cart].map(([id,quantity])=>{const p=products.find(p=>p.id===id);return `<div class="cart-line"><img src="assets/${id}.webp" width="80" height="80" alt="${p.name} bag"><div><h3>${p.name}</h3><p>50g · Rs. 150</p><div class="quantity-control"><button data-quantity="${id}" data-delta="-1" aria-label="Remove one ${p.name}">−</button><span>${quantity}</span><button data-quantity="${id}" data-delta="1" aria-label="Add one ${p.name}">+</button></div></div><button class="remove-item" data-remove="${id}" aria-label="Remove ${p.name} from bag">×</button></div>`}).join('');
  document.getElementById('cart-total').textContent=`Rs. ${(count*price).toLocaleString('en-PK')}`;
  document.querySelector('.cart-summary').hidden=count===0;
  document.querySelector('.empty-cart').hidden=count!==0;
  if(focusedControl){
    const selector=focusedControl.remove?`[data-remove="${focusedControl.id}"]`:`[data-quantity="${focusedControl.id}"][data-delta="${focusedControl.delta}"]`;
    const nextControl=items.querySelector(selector)||items.querySelector('[data-quantity]')||document.querySelector('.empty-cart [data-close-cart]');
    nextControl?.focus({preventScroll:true});
  }
}
document.addEventListener('click',event=>{
  const add=event.target.closest('[data-add]');
  if(add){const id=add.dataset.add;if(!products.some(p=>p.id===id))return;cart.set(id,(cart.get(id)||0)+1);updateCart();notify(`${products.find(p=>p.id===id).name} added to your bag`)}
  const filter=event.target.closest('[data-filter]');
  if(filter){document.querySelectorAll('[data-filter]').forEach(button=>{const active=button===filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});renderProducts(filter.dataset.filter)}
  if(event.target.closest('[data-open-cart]')){updateCart();drawer.showModal()}
  if(event.target.closest('[data-close-cart]'))drawer.close();
  const quantity=event.target.closest('[data-quantity]');
  if(quantity){const id=quantity.dataset.quantity,next=(cart.get(id)||0)+Number(quantity.dataset.delta);if(next<=0)cart.delete(id);else cart.set(id,next);updateCart()}
  const remove=event.target.closest('[data-remove]');if(remove){cart.delete(remove.dataset.remove);updateCart()}
  if(event.target.closest('.checkout-button')){document.querySelector('.preview-note').textContent='This preview does not place orders. Shopify checkout will be connected during store installation.'}
});
drawer.addEventListener('click',event=>{if(event.target===drawer){const bounds=drawer.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right)drawer.close()}});
renderProducts();updateCart();
