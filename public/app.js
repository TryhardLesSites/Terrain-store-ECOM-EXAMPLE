const state = { products: [], categories: [], cart: [], user: null, selectedSize: null, adminTab: "products", supportEmail:"" };
const $ = (s) => document.querySelector(s);
const money = (cents) => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(cents/100);
const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const headers={...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(options.headers||{})};
  const response = await fetch(url,{credentials:"same-origin",headers,...options});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) {
    const details = data.details?.fieldErrors
      ? Object.entries(data.details.fieldErrors).flatMap(([field, messages]) => messages.map(message => `${field}: ${message}`)).join(" · ")
      : "";
    throw new Error([data.error, details].filter(Boolean).join(" ") || `Erreur HTTP ${response.status}`);
  }
  return data;
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function cartStorageKey(){return state.user ? `terrain-cart:user:${state.user.id}` : "terrain-cart:guest"}
function loadCart(){state.cart=JSON.parse(localStorage.getItem(cartStorageKey()) || "[]");updateCartCount()}
function saveCart(){localStorage.setItem(cartStorageKey(),JSON.stringify(state.cart));updateCartCount()}
function updateCartCount(){$("#cart-count").textContent=state.cart.reduce((n,x)=>n+x.quantity,0)}
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(`#page-${name}`)?.classList.add("active");window.scrollTo(0,0)}
function productCard(p){return `<article class="product-card"><a href="#product/${encodeURIComponent(p.slug)}"><div class="product-image-wrap">${p.isDemo?'<span class="demo-product-badge">PRODUIT DÉMO</span>':""}<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy"></div><div class="product-info"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.categoryName)}</p></div><span class="product-price">${money(p.priceCents)}</span></div></a></article>`}
function categoryTile(category,index){
  const number=String(index+1).padStart(2,"0");
  return `<a class="category-tile category-${escapeHtml(category.slug)}" href="#shop?category=${encodeURIComponent(category.slug)}"><span>${number} / ${escapeHtml(category.name.toUpperCase())}</span><strong>${escapeHtml(category.name)}</strong><b>EXPLORER ↗</b></a>`;
}
async function loadBase(){
  const [categories,products,me,publicConfig]=await Promise.all([api("/api/categories"),api("/api/products"),api("/api/auth/me"),api("/api/config")]);
  state.categories=categories;state.products=products;state.user=me.user;state.supportEmail=publicConfig.supportEmail;
  const supportLink=$("#support-email-link");
  if(supportLink){
    if(state.supportEmail){supportLink.href=`mailto:${state.supportEmail}`;supportLink.textContent=`${state.supportEmail.toUpperCase()} ↗`;}
    else{supportLink.removeAttribute("href");supportLink.textContent="SUPPORT À CONFIGURER";}
  }
  const legacyCart=localStorage.getItem("terrain-cart");
  if(legacyCart && !localStorage.getItem("terrain-cart:guest")) localStorage.setItem("terrain-cart:guest",legacyCart);
  localStorage.removeItem("terrain-cart");
  loadCart();
  $("#home-categories").innerHTML=categories.map(categoryTile).join("");
  $("#home-products").innerHTML=products.filter(p=>p.isFeatured).slice(0,4).map(productCard).join("");
  $("#category-filters").innerHTML=`<button class="filter active" data-category="">TOUT</button>`+categories.map(c=>`<button class="filter" data-category="${escapeHtml(c.slug)}">${escapeHtml(c.name.toUpperCase())}</button>`).join("");
  renderShop();saveCart();
}
function renderShop(){
  const params=new URLSearchParams((location.hash.split("?")[1]||""));
  const active=params.get("category")||"", search=$("#product-search").value.trim().toLowerCase();
  const list=state.products.filter(p=>(!active||p.categorySlug===active)&&(!search||`${p.name} ${p.description}`.toLowerCase().includes(search)));
  document.querySelectorAll(".filter").forEach(button=>button.classList.toggle("active",button.dataset.category===active));
  $("#shop-products").innerHTML=list.map(productCard).join("");$("#shop-empty").classList.toggle("hidden",list.length>0);
}
async function renderProduct(slug){
  let p=state.products.find(x=>x.slug===slug);
  if(!p)p=await api(`/api/products/${encodeURIComponent(slug)}`);
  state.selectedSize=p.sizes[0];
  $("#product-detail").innerHTML=`<img class="detail-image" src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}"><div class="detail-copy"><p class="eyebrow">${escapeHtml(p.categoryName)}${p.isDemo?" / PRODUIT DÉMO":""}</p><h1>${escapeHtml(p.name)}</h1><div class="detail-price">${money(p.priceCents)}</div><p class="detail-description">${escapeHtml(p.description)}</p><p class="size-label">CHOISIS TA TAILLE</p><div class="size-options">${p.sizes.map(s=>`<button data-size="${s}" class="${s===state.selectedSize?"selected":""}">${s}</button>`).join("")}</div><div class="detail-buy"><button class="button button-dark" id="add-to-cart">AJOUTER AU PANIER ↗</button></div><div class="detail-meta">STOCK DISPONIBLE : ${p.stock}<br>CONSEIL : vérifie les mesures avant commande.</div></div>`;
  $("#product-detail").querySelectorAll("[data-size]").forEach(b=>b.addEventListener("click",()=>{state.selectedSize=b.dataset.size;$("#product-detail").querySelectorAll("[data-size]").forEach(x=>x.classList.toggle("selected",x===b))}));
  $("#add-to-cart").addEventListener("click",()=>addToCart(p,state.selectedSize));
}
function addToCart(p,size){
  const found=state.cart.find(x=>x.productId===p.id&&x.size===size);
  if(found)found.quantity=Math.min(10,found.quantity+1);else state.cart.push({productId:p.id,size,quantity:1});
  saveCart();toast("Ajouté au panier.");location.hash="#cart";
}
function renderCart(){
  const rows=state.cart.map(item=>({...item,product:state.products.find(p=>p.id===item.productId)})).filter(x=>x.product);
  const total=rows.reduce((s,x)=>s+x.product.priceCents*x.quantity,0);
  $("#cart-items").innerHTML=rows.length?rows.map(x=>`<div class="cart-line"><img src="${escapeHtml(x.product.imageUrl)}" alt=""><div><h3>${escapeHtml(x.product.name)}</h3><p>TAILLE : ${x.size} · ${money(x.product.priceCents)}</p><div class="qty-control"><button data-qty="-1" data-id="${x.productId}" data-size="${x.size}">−</button>${x.quantity}<button data-qty="1" data-id="${x.productId}" data-size="${x.size}">+</button></div><button data-remove="${x.productId}" data-size="${x.size}">RETIRER</button></div><strong>${money(x.product.priceCents*x.quantity)}</strong></div>`).join(""):`<div class="cart-empty">Ton sac est vide. Il est temps de trouver ta prochaine pièce.</div>`;
  $("#cart-summary").innerHTML=`<h3>ORDER SUMMARY</h3><div class="summary-row"><span>SOUS-TOTAL</span><b>${money(total)}</b></div><div class="summary-row"><span>LIVRAISON</span><span>Calculée à l'étape suivante</span></div><div class="summary-row"><strong>TOTAL</strong><strong>${money(total)}</strong></div>${state.user?"":`<label class="checkout-email-label" for="checkout-email">E-MAIL POUR LE REÇU</label><input id="checkout-email" class="checkout-email" type="email" placeholder="ton@email.com" required>`}<button class="button button-dark" id="checkout-button" ${rows.length?"":"disabled"}>PASSER AU PAIEMENT ↗</button><p class="eyebrow" style="margin-top:15px">CARTE OU REVOLUT PAY VIA STRIPE</p>`;
  if(state.user) renderOrderTracking("#cart-order-tracking");
  $("#cart-items").querySelectorAll("[data-qty]").forEach(b=>b.addEventListener("click",()=>{const item=state.cart.find(x=>x.productId===Number(b.dataset.id)&&x.size===b.dataset.size);item.quantity=Math.max(1,Math.min(10,item.quantity+Number(b.dataset.qty)));saveCart();renderCart()}));
  $("#cart-items").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{state.cart=state.cart.filter(x=>!(x.productId===Number(b.dataset.remove)&&x.size===b.dataset.size));saveCart();renderCart()}));
  $("#checkout-button")?.addEventListener("click",checkout);
}
const orderStatus = {
  paid: { label:"Commande confirmée", step:1 },
  processing: { label:"Préparation en cours", step:2 },
  shipped: { label:"Commande expédiée", step:3 },
  cancelled: { label:"Commande annulée", step:0 },
  refunded: { label:"Commande remboursée", step:0 }
};
function renderOrderCard(order){
  const stateInfo=orderStatus[order.status]||{label:order.status,step:1};
  const steps=["Commande confirmée","Préparation","Expédition","Livraison"];
  return `<article class="tracking-card"><div class="tracking-card-head"><div><p class="eyebrow">COMMANDE #${order.id}</p><h3>${stateInfo.label}</h3><p class="tracking-date">Passée le ${new Date(order.createdAt).toLocaleDateString("fr-FR")}</p></div><strong>${money(order.totalCents)}</strong></div><div class="tracking-steps ${stateInfo.step===0?"tracking-stopped":""}">${steps.map((label,index)=>`<div class="tracking-step ${index<stateInfo.step?"done":""} ${index===stateInfo.step-1?"current":""}"><span>${index<stateInfo.step?"✓":index+1}</span><small>${label}</small></div>`).join("")}</div><div class="tracking-items">${order.items.map(item=>`<div class="tracking-item">${item.imageUrl?`<img src="${escapeHtml(item.imageUrl)}" alt="">`:""}<div><strong>${escapeHtml(item.name)}</strong><small>Taille ${escapeHtml(item.size)} · Quantité ${item.quantity}</small></div><b>${money(item.unitPriceCents*item.quantity)}</b></div>`).join("")}</div><div class="tracking-actions"><a class="button button-light" href="mailto:${escapeHtml(state.supportEmail)}?subject=Problème%20commande%20%23${order.id}">PROBLÈME DE COMMANDE</a><a class="button button-light" href="mailto:${escapeHtml(state.supportEmail)}?subject=Retour%20ou%20remboursement%20commande%20%23${order.id}">RETOUR OU REMBOURSEMENT</a></div></article>`;
}
async function renderOrderTracking(selector){
  const target=$(selector);
  if(!target)return;
  target.innerHTML=`<div class="tracking-loading">CHARGEMENT DU SUIVI…</div>`;
  try{
    const orders=await api("/api/account/orders");
    target.innerHTML=`<div class="tracking-heading"><div><p class="eyebrow">YOUR ORDERS / DELIVERY</p><h2>SUIVI DE MES COMMANDES.</h2></div><span class="tracking-count">${orders.length} commande${orders.length>1?"s":""}</span></div>${orders.length?orders.map(renderOrderCard).join(""):`<p class="tracking-empty">Aucune commande à suivre pour le moment.</p>`}`;
  }catch(error){target.innerHTML=`<p class="tracking-error">${escapeHtml(error.message)}</p>`;}
}
async function checkout(){
  try{
    let email=state.user?.email;
    if(!email)email=$("#checkout-email")?.value.trim();
    if(!email)return;
    const result=await api("/api/checkout/session",{method:"POST",body:JSON.stringify({items:state.cart,customerEmail:email})});
    location.href=result.url;
  }catch(e){toast(e.message)}
}
function renderAccount(){
  if(!state.user){
    $("#account-panel").innerHTML=`<div class="auth-grid"><form class="form-stack" id="login-form"><p class="eyebrow">WELCOME BACK</p><h2>SE CONNECTER.</h2><input name="email" type="email" placeholder="Adresse e-mail" required><input name="password" type="password" placeholder="Mot de passe" required><button class="button button-dark">CONNEXION ↗</button></form><form class="form-stack" id="register-form"><p class="eyebrow">NEW AROUND HERE?</p><h2>CRÉER UN COMPTE.</h2><input name="firstName" placeholder="Prénom" required><input name="lastName" placeholder="Nom" required><input name="email" type="email" placeholder="Adresse e-mail" required><input name="password" type="password" minlength="10" placeholder="Mot de passe (10 caractères min.)" required><button class="button button-dark">CRÉER MON COMPTE ↗</button></form></div>`;
    $("#login-form").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/auth/login",{method:"POST",body:JSON.stringify(d)});await refreshUser();loadCart();renderAccount();toast("Connexion réussie.")}catch(err){toast(err.message)}});
    $("#register-form").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/auth/register",{method:"POST",body:JSON.stringify(d)});await refreshUser();loadCart();renderAccount();toast("Compte créé.")}catch(err){toast(err.message)}});
  }else{
    $("#account-panel").innerHTML=`<div class="admin-top"><div><p class="eyebrow">SIGNED IN AS</p><h2>${escapeHtml(state.user.firstName)} ${escapeHtml(state.user.lastName)}</h2><p>${escapeHtml(state.user.email)}</p></div><button class="button button-dark" id="logout">DÉCONNEXION</button></div><div id="account-order-tracking" class="order-tracking"></div>${state.user.role==="admin"?'<p><a class="text-link" href="#admin">OUVRIR LE BACK OFFICE ↗</a></p>':""}`;
    $("#logout").addEventListener("click",async()=>{saveCart();await api("/api/auth/logout",{method:"POST"});await refreshUser();loadCart();renderAccount();toast("Déconnecté.")});
    renderOrderTracking("#account-order-tracking");
  }
}
async function refreshUser(){state.user=(await api("/api/auth/me")).user}
async function renderAdmin(){
  if(!state.user||state.user.role!=="admin"){ $("#admin-panel").innerHTML=`<p>Accès réservé à l'équipe Terrain.</p><a class="text-link" href="#account">SE CONNECTER ↗</a>`;return;}
  $("#admin-panel").innerHTML=`<div class="admin-top"><div><p class="eyebrow">ADMINISTRATOR</p><h2>BACK OFFICE</h2></div><span class="eyebrow">API CONNECTÉE / SQLITE</span></div><div class="admin-tabs"><button data-tab="products" class="${state.adminTab==="products"?"active":""}">PRODUITS</button><button data-tab="orders" class="${state.adminTab==="orders"?"active":""}">COMMANDES</button><button data-tab="users" class="${state.adminTab==="users"?"active":""}">UTILISATEURS</button></div><div id="admin-content">Chargement…</div>`;
  $("#admin-panel").querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{state.adminTab=b.dataset.tab;renderAdmin()}));
  if(state.adminTab==="products"){
    const [products,archivedProducts,adminCategories]=await Promise.all([api("/api/admin/products"),api("/api/admin/products?archived=true"),api("/api/admin/categories")]);
    const activeCategories=adminCategories.filter(c=>c.isActive);
    const archivedCategories=adminCategories.filter(c=>!c.isActive);
    $("#admin-content").innerHTML=`<h2>AJOUTER UNE PIÈCE</h2><form class="admin-form" id="product-form"><input name="name" placeholder="Nom du produit" required><input name="slug" placeholder="slug-produit" required><select name="categoryId">${activeCategories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select><input name="price" type="number" min="0" step=".01" placeholder="Prix en euros" required><input name="stock" type="number" min="0" placeholder="Stock" required><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required><input name="sizes" placeholder="Tailles séparées par virgules (S,M,L,XL)" value="S,M,L,XL" required><textarea class="wide" name="description" placeholder="Description détaillée" required></textarea><label><input type="checkbox" name="isFeatured"> Mise en avant</label><button class="button button-dark wide">CRÉER LE PRODUIT ↗</button></form><h2 style="margin-top:35px">CRÉER UNE CATÉGORIE</h2><form class="admin-form" id="category-form"><input name="name" placeholder="Nom de la catégorie" required><input name="slug" placeholder="slug-categorie (optionnel)"><textarea class="wide" name="description" placeholder="Description de la catégorie"></textarea><button class="button button-dark wide">CRÉER LA CATÉGORIE ↗</button></form><h2 style="margin-top:35px">CATÉGORIES ACTIVES (${activeCategories.length})</h2>${activeCategories.map(c=>`<div class="admin-product-row"><span>#${c.id} · ${escapeHtml(c.name)} · ${escapeHtml(c.slug)} · ACTIVE</span><span class="admin-row-actions"><button data-category-edit="${c.id}">MODIFIER</button><button data-category-archive="${c.id}">ARCHIVER</button><button data-category-delete="${c.id}">SUPPRIMER</button></span></div>`).join("")||"<p>Aucune catégorie active.</p>"}<h2 style="margin-top:35px">CATÉGORIES ARCHIVÉES (${archivedCategories.length})</h2>${archivedCategories.map(c=>`<div class="admin-product-row"><span>#${c.id} · ${escapeHtml(c.name)} · ${escapeHtml(c.slug)} · ARCHIVÉE</span><span class="admin-row-actions"><button data-category-restore="${c.id}">DÉSARCHIVER</button><button data-category-delete="${c.id}">SUPPRIMER</button></span></div>`).join("")||"<p>Aucune catégorie archivée.</p>"}<h2 style="margin-top:35px">CATALOGUE ACTIF (${products.length}) <button id="delete-demo-products" class="text-link">SUPPRIMER TOUS LES PRODUITS DE DÉMO</button></h2>${products.map(p=>`<div class="admin-product-row"><span>${escapeHtml(p.name)} · ${money(p.priceCents)} · stock ${p.stock} · ACTIF${p.isDemo?" · DÉMO":""}</span><span class="admin-row-actions"><button data-edit="${p.id}">MODIFIER</button><button data-archive="${p.id}">ARCHIVER</button><button data-delete="${p.id}">SUPPRIMER</button></span></div>`).join("")||"<p>Aucun produit actif.</p>"}<h2 style="margin-top:35px">PRODUITS ARCHIVÉS (${archivedProducts.length})</h2>${archivedProducts.map(p=>`<div class="admin-product-row"><span>${escapeHtml(p.name)} · ${money(p.priceCents)} · stock ${p.stock} · ARCHIVÉ${p.isDemo?" · DÉMO":""}</span><span class="admin-row-actions"><button data-restore="${p.id}">DÉSARCHIVER</button><button data-delete="${p.id}">SUPPRIMER</button></span></div>`).join("")||"<p>Aucun produit archivé.</p>"}`;
    $("#product-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const file=f.get("image");if(!(file instanceof File)||!file.size){toast("Sélectionne une image.");return;}try{const upload=new FormData();upload.append("image",file);const uploaded=await api("/api/admin/uploads",{method:"POST",headers:{},body:upload});const d={name:f.get("name"),slug:f.get("slug"),description:f.get("description"),categoryId:Number(f.get("categoryId")),priceCents:Math.round(Number(f.get("price"))*100),compareAtCents:null,imageUrl:uploaded.imageUrl,sizes:f.get("sizes").split(",").map(x=>x.trim().toUpperCase()),stock:Number(f.get("stock")),isFeatured:f.has("isFeatured"),isActive:true};await api("/api/admin/products",{method:"POST",body:JSON.stringify(d)});state.products=await api("/api/products");toast("Produit créé via l'API.");renderAdmin()}catch(err){toast(err.message)}});
    $("#category-form").addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/admin/categories",{method:"POST",body:JSON.stringify(data)});state.categories=await api("/api/categories");toast("Catégorie créée.");renderAdmin()}catch(err){toast(err.message)}});
    $("#admin-content").querySelectorAll("[data-category-archive]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Archiver cette catégorie ? Ses produits ne seront plus visibles dans le Shop."))return;try{await api(`/api/admin/categories/${b.dataset.categoryArchive}`,{method:"DELETE"});[state.categories,state.products]=await Promise.all([api("/api/categories"),api("/api/products")]);toast("Catégorie archivée.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-category-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Supprimer définitivement cette catégorie ? Cette action est irréversible."))return;try{await api(`/api/admin/categories/${b.dataset.categoryDelete}/permanent`,{method:"DELETE"});[state.categories,state.products]=await Promise.all([api("/api/categories"),api("/api/products")]);toast("Catégorie supprimée définitivement.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-category-restore]").forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/admin/categories/${b.dataset.categoryRestore}/restore`,{method:"PATCH"});state.categories=await api("/api/categories");toast("Catégorie désarchivée.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-category-edit]").forEach(b=>b.addEventListener("click",()=>editCategory(Number(b.dataset.categoryEdit),adminCategories.find(category=>category.id===Number(b.dataset.categoryEdit)))));
    $("#admin-content").querySelectorAll("[data-archive]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Archiver ce produit ?"))return;try{await api(`/api/admin/products/${b.dataset.archive}`,{method:"DELETE"});state.products=await api("/api/products");toast("Produit archivé.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Supprimer définitivement ce produit ? Cette action est irréversible. L'historique des commandes sera conservé."))return;try{await api(`/api/admin/products/${b.dataset.delete}/permanent`,{method:"DELETE"});state.products=await api("/api/products");toast("Produit supprimé définitivement.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#delete-demo-products")?.addEventListener("click",async()=>{if(!confirm("Supprimer définitivement tous les produits de démonstration ?"))return;try{const result=await api("/api/admin/demo-products",{method:"DELETE"});[state.products,state.categories]=await Promise.all([api("/api/products"),api("/api/categories")]);toast(result.message);renderAdmin()}catch(e){toast(e.message)}});
    $("#admin-content").querySelectorAll("[data-restore]").forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/admin/products/${b.dataset.restore}/restore`,{method:"PATCH"});state.products=await api("/api/products");toast("Produit désarchivé.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(Number(b.dataset.edit))));
  }else if(state.adminTab==="orders"){
    const orders=await api("/api/admin/orders");
    const statusLabels={paid:"PAYÉE",processing:"EN PRÉPARATION",shipped:"EXPÉDIÉE",cancelled:"ANNULÉE",refunded:"REMBOURSÉE"};
    $("#admin-content").innerHTML=`<h2>COMMANDES (${orders.length})</h2>${orders.map(o=>`<div class="admin-product-row"><span>#${o.id} · ${escapeHtml(o.email)} · <strong>${statusLabels[o.status]||escapeHtml(o.status)}</strong> · ${money(o.total_cents)}</span><select data-order-status="${o.id}" aria-label="Statut de la commande #${o.id}"><option value="">Changer statut…</option><option value="processing" ${o.status==="processing"?"selected":""}>✓ En préparation</option><option value="shipped" ${o.status==="shipped"?"selected":""}>✓ Expédiée</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>✓ Annulée</option><option value="refunded" ${o.status==="refunded"?"selected":""}>✓ Remboursée</option></select></div>`).join("")||"Aucune commande."}`;
    $("#admin-content").querySelectorAll("[data-order-status]").forEach(s=>s.addEventListener("change",async()=>{if(!s.value)return;try{await api(`/api/admin/orders/${s.dataset.orderStatus}/status`,{method:"PATCH",body:JSON.stringify({status:s.value})});toast("Statut mis à jour.");renderAdmin()}catch(e){toast(e.message)}}));
  }else{
    const users=await api("/api/admin/users");
    $("#admin-content").innerHTML=`<h2>UTILISATEURS (${users.length})</h2><p class="admin-note">Les mots de passe ne sont jamais visibles. Tu peux uniquement en définir un nouveau.</p>${users.map(user=>`<div class="admin-product-row"><span><strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong> · ${escapeHtml(user.email)} · ${user.role} · ${user.isBanned?"BANNI":"ACTIF"}</span><span class="admin-row-actions"><button data-reset-user="${user.id}">NOUVEAU MDP</button>${user.id!==state.user.id?`<button data-ban-user="${user.id}" data-banned="${user.isBanned}">${user.isBanned?"DÉBANNIR":"BANNIR"}</button>`:""}</span></div>`).join("")}`;
    $("#admin-content").querySelectorAll("[data-ban-user]").forEach(button=>button.addEventListener("click",async()=>{try{await api(`/api/admin/users/${button.dataset.banUser}/ban`,{method:"PATCH",body:JSON.stringify({banned:button.dataset.banned!=="true"})});toast("Statut utilisateur mis à jour.");renderAdmin()}catch(e){toast(e.message)}}));
    $("#admin-content").querySelectorAll("[data-reset-user]").forEach(button=>button.addEventListener("click",()=>showPasswordReset(Number(button.dataset.resetUser))));
  }
}
function showPasswordReset(id){
  $("#admin-content").insertAdjacentHTML("afterbegin",`<form class="password-reset-form form-stack" id="password-reset-form"><div class="admin-form-heading"><h2>NOUVEAU MOT DE PASSE</h2><button type="button" class="text-link" id="cancel-password-reset">ANNULER</button></div><input name="password" type="password" minlength="10" maxlength="100" placeholder="Nouveau mot de passe (10 caractères min.)" required><input name="confirmation" type="password" minlength="10" maxlength="100" placeholder="Confirmer le mot de passe" required><button class="button button-dark wide">RÉINITIALISER ↗</button></form>`);
  $("#cancel-password-reset").addEventListener("click",()=>renderAdmin());
  $("#password-reset-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const password=String(form.get("password"));
    if(password!==String(form.get("confirmation"))){toast("Les mots de passe ne correspondent pas.");return;}
    try{await api(`/api/admin/users/${id}/reset-password`,{method:"POST",body:JSON.stringify({password})});toast("Mot de passe réinitialisé.");renderAdmin();}
    catch(error){toast(error.message);}
  });
}
async function editCategory(id, category){
  if(!category)return;
  const form=document.createElement("form");
  form.className="admin-form";
  form.innerHTML=`<div class="admin-form-heading"><h2>MODIFIER LA CATÉGORIE</h2><button type="button" class="text-link" id="cancel-category-edit">ANNULER</button></div><input name="name" value="${escapeHtml(category.name)}" required><input name="slug" value="${escapeHtml(category.slug)}" required><textarea class="wide" name="description">${escapeHtml(category.description)}</textarea><button class="button button-dark wide">ENREGISTRER LA CATÉGORIE ↗</button>`;
  $("#admin-content").prepend(form);
  $("#cancel-category-edit").addEventListener("click",()=>form.remove());
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    try{await api(`/api/admin/categories/${id}`,{method:"PUT",body:JSON.stringify(data)});[state.categories,state.products]=await Promise.all([api("/api/categories"),api("/api/products")]);toast("Catégorie modifiée.");renderAdmin()}catch(err){toast(err.message)}
  });
}
async function editProduct(id){
  const p=await api("/api/admin/products");
  const item=p.find(x=>x.id===id);if(!item)return;
  $("#admin-content").insertAdjacentHTML("afterbegin",`<form class="admin-edit-form form-stack" id="edit-product-form"><div class="admin-form-heading"><h2>MODIFIER LA PIÈCE</h2><button type="button" class="text-link" id="cancel-edit">ANNULER</button></div><input name="name" value="${escapeHtml(item.name)}" placeholder="Nom du produit" required><input name="slug" value="${escapeHtml(item.slug)}" placeholder="slug-produit" required><select name="categoryId">${state.categories.map(c=>`<option value="${c.id}" ${c.id===item.categoryId?"selected":""}>${escapeHtml(c.name)}</option>`).join("")}</select><input name="price" type="number" min="0" step=".01" value="${item.priceCents/100}" placeholder="Prix en euros" required><input name="stock" type="number" min="0" value="${item.stock}" placeholder="Stock" required><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><p class="admin-note">Image actuelle conservée si aucun nouveau fichier n'est choisi.</p><input name="sizes" value="${escapeHtml(item.sizes.join(","))}" placeholder="Tailles séparées par virgules" required><textarea class="wide" name="description" required>${escapeHtml(item.description)}</textarea><label><input type="checkbox" name="isFeatured" ${item.isFeatured?"checked":""}> Mise en avant</label><label><input type="checkbox" name="isActive" ${item.isActive?"checked":""}> Visible dans le shop</label><button class="button button-dark wide">ENREGISTRER ↗</button></form>`);
  $("#cancel-edit").addEventListener("click",()=>renderAdmin());
  $("#edit-product-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    try{let imageUrl=item.imageUrl;const file=f.get("image");if(file instanceof File&&file.size){const upload=new FormData();upload.append("image",file);imageUrl=(await api("/api/admin/uploads",{method:"POST",body:upload})).imageUrl;}const data={name:f.get("name"),slug:f.get("slug"),description:f.get("description"),categoryId:Number(f.get("categoryId")),priceCents:Math.round(Number(f.get("price"))*100),compareAtCents:item.compareAtCents,imageUrl,sizes:f.get("sizes").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean),stock:Number(f.get("stock")),isFeatured:f.has("isFeatured"),isActive:f.has("isActive")};await api(`/api/admin/products/${id}`,{method:"PUT",body:JSON.stringify(data)});state.products=await api("/api/products");toast("Produit modifié.");renderAdmin()}catch(err){toast(err.message)}
  });
}
function route(){
  const hash=location.hash||"#home";
  if(hash.startsWith("#product/")){showPage("product");renderProduct(decodeURIComponent(hash.slice(9))).catch(e=>toast(e.message))}
  else if(hash.startsWith("#shop")){showPage("shop");renderShop()}
  else if(hash==="#about"){showPage("about")}
  else if(hash==="#contact"){showPage("contact")}
  else if(hash==="#cart"){showPage("cart");renderCart()}
  else if(hash==="#account"){showPage("account");renderAccount()}
  else if(hash==="#admin"){showPage("admin");renderAdmin().catch(e=>toast(e.message))}
  else{showPage("home")}
}
document.addEventListener("click",e=>{
  if(e.target.closest("#cart-open"))location.hash="#cart";
  if(e.target.closest("#account-open"))location.hash="#account";
  if(e.target.closest("#menu-toggle"))$(".main-nav").classList.toggle("open");
  if(e.target.closest(".main-nav a"))$(".main-nav").classList.remove("open");
  const filter=e.target.closest("[data-category]");
  if(filter)location.hash=filter.dataset.category ? `#shop?category=${filter.dataset.category}` : "#shop";
});
$("#product-search").addEventListener("input",renderShop);
window.addEventListener("hashchange",route);
(async()=>{
  try{await loadBase();route();const params=new URLSearchParams(location.search);if(params.get("payment")==="success"){state.cart=[];saveCart();try{const confirmation=await api(`/api/checkout/confirmation?session_id=${encodeURIComponent(params.get("session_id")||"")}`);toast(`Commande #${confirmation.orderId} confirmée — reçu préparé pour ${confirmation.email}.`)}catch(error){toast(error.message)}history.replaceState(null,"",location.pathname+"#account")}else if(params.get("payment")==="cancelled"){toast("Paiement annulé, ton panier est conservé.");history.replaceState(null,"",location.pathname+"#cart")}}
  catch(e){console.error(e);toast("Impossible de charger la boutique. Vérifie que le serveur est lancé.")}
})();
