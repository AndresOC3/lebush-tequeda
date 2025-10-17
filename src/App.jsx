
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
const API={async login(e,p){const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})});if(!r.ok)throw new Error("Credenciales incorrectas");return r.json();},async register(u,t){const r=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify(u)});if(!r.ok)throw new Error("No se pudo crear");return r.json();},async meFetch(u,o={}){const t=localStorage.getItem("token");const h=Object.assign({"Content-Type":"application/json",Authorization:"Bearer "+t},o.headers||{});const r=await fetch(u,{...o,headers:h});if(r.status===401)throw new Error("No autorizado");return r;}};
const STATES=["PorHacer","Iniciado","Finalizado","Entregado"];const DOT={PorHacer:"d-por",Iniciado:"d-ini",Finalizado:"d-fin",Entregado:"d-ent"};const uid=()=>Math.random().toString(36).slice(2,9);
export default function App(){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem("user")||"null"));
  const [token,setToken]=useState(()=>localStorage.getItem("token"));
  const [authErr,setAuthErr]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  const [orders,setOrders]=useState([]);const [filter,setFilter]=useState("Todos");
  const [sizes,setSizes]=useState(["S","M","L","XL"]);const [priceBySize,setPriceBySize]=useState({S:0,M:0,L:0,XL:0});
  const [form,setForm]=useState({id:null,customer:"",phone:"",references:"",deliveryDate:"",notes:"",deposit:0,status:"PorHacer",items:[{id:uid(),garment:"",fabric:"",color:"",quantities:{S:0,M:0,L:0,XL:0}}],imageFile:null,imagePreview:null,imageUrl:null});
  useEffect(()=>{const root=document.getElementById("root");root.classList.add("app-bg");root.style.backgroundImage="url('/fondo-lebush.png')";},[]);
  async function doLogin(e){e.preventDefault();setAuthErr("");try{const {token,user}=await API.login(email,password);localStorage.setItem("token",token);localStorage.setItem("user",JSON.stringify(user));setToken(token);setUser(user);loadOrders().catch(()=>{});}catch(err){setAuthErr(err.message||"Error");}}
  function logout(){localStorage.removeItem("token");localStorage.removeItem("user");setToken(null);setUser(null);}
  async function loadOrders(){const r=await API.meFetch("/api/pedidos");const j=await r.json();setOrders(j.pedidos||[]);}useEffect(()=>{if(token)loadOrders().catch(()=>{});},[token]);
  function onSelectImage(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>setForm(f=>({...f,imageFile:file,imagePreview:ev.target.result}));reader.readAsDataURL(file);}
  async function uploadImage(file){const fd=new FormData();fd.append("image",file);const r=await fetch("/api/upload",{method:"POST",headers:{Authorization:"Bearer "+token},body:fd});if(!r.ok)throw new Error("No se pudo subir");const j=await r.json();return j.url;}
  const qtyOf=it=>Object.values(it.quantities||{}).reduce((a,b)=>a+Number(b||0),0);
  const subtotalOf=it=>Object.entries(it.quantities||{}).reduce((s,[sz,q])=>s+Number(q||0)*Number(priceBySize[sz]||0),0);
  const total=useMemo(()=>form.items.reduce((s,it)=>s+subtotalOf(it),0),[form.items,priceBySize]);
  const saldo=useMemo(()=>total-Number(form.deposit||0),[total,form.deposit]);
  const estadoPago=useMemo(()=>{if(total===0)return "Pendiente";const dep=Number(form.deposit||0);return dep===0?"Pendiente":(dep<total?"Parcial":"Pagado");},[total,form.deposit]);
  function addSize(){const raw=prompt("Nueva talla (ej. 2XL, Niño):");if(!raw)return;const sz=raw.trim();if(!sz)return;if(sizes.includes(sz))return alert("La talla ya existe");setSizes(p=>[...p,sz]);setPriceBySize(p=>({...p,[sz]:0}));setForm(f=>({...f,items:f.items.map(i=>({...i,quantities:{...i.quantities,[sz]:0}}))}));}
  function addItem(){const base=Object.fromEntries(sizes.map(sz=>[sz,0]));setForm(f=>({...f,items:[...f.items,{id:uid(),garment:"",fabric:"",color:"",quantities:base}]}));}
  function removeItem(id){setForm(f=>({...f,items:f.items.filter(i=>i.id!==id)}));}
  function updateItem(id,field,val){setForm(f=>({...f,items:f.items.map(i=>i.id===id?{...i,[field]:val}:i)}));}
  function updateQty(id,sz,val){setForm(f=>({...f,items:f.items.map(i=>i.id===id?{...i,quantities:{...i.quantities,[sz]:Math.max(0,Number(val||0))}}:i)}));}
  async function saveOrder(e){e?.preventDefault();if(!form.customer)return alert("Falta el nombre del cliente");let imageUrl=form.imageUrl||null;if(form.imageFile){try{imageUrl=await uploadImage(form.imageFile);}catch{return alert("Error subiendo imagen");}}const payload={customer:form.customer,phone:form.phone,references:form.references,deliveryDate:form.deliveryDate,notes:form.notes,deposit:Number(form.deposit||0),status:form.status,sizes,priceBySize,items:form.items,total,imageUrl,estadoPago};if(form.id){const r=await API.meFetch("/api/pedidos/"+form.id,{method:"PATCH",body:JSON.stringify(payload)});if(!r.ok)return alert("No se pudo actualizar");}else{const r=await API.meFetch("/api/pedidos",{method:"POST",body:JSON.stringify(payload)});if(!r.ok)return alert("No se pudo guardar");}await loadOrders();resetForm();}
  function resetForm(){setForm({id:null,customer:"",phone:"",references:"",deliveryDate:"",notes:"",deposit:0,status:"PorHacer",items:[{id:uid(),garment:"",fabric:"",color:"",quantities:Object.fromEntries(sizes.map(s=>[s,0]))}],imageFile:null,imagePreview:null,imageUrl:null});}
  function editOrder(o){setSizes(o.sizes||["S","M","L","XL"]);setPriceBySize(o.priceBySize||{S:0,M:0,L:0,XL:0});setForm({id:o.id,customer:o.customer||"",phone:o.phone||"",references:o.references||"",deliveryDate:o.deliveryDate||"",notes:o.notes||"",deposit:Number(o.deposit||0),status:o.status||"PorHacer",items:(o.items||[]).map(it=>({id:it.id||uid(),garment:it.garment||"",fabric:it.fabric||"",color:it.color||"",quantities:it.quantities||{}})),imageFile:null,imagePreview:null,imageUrl:o.imageUrl||null});window.scrollTo({top:0,behavior:"smooth"});}
  async function changeStatus(id,status){const r=await API.meFetch("/api/pedidos/"+id,{method:"PATCH",body:JSON.stringify({status})});if(r.ok)setOrders(p=>p.map(x=>x.id===id?{...x,status}:x));}
  async function deleteOrder(id){if(!confirm("¿Eliminar este pedido?"))return;const r=await API.meFetch("/api/pedidos/"+id,{method:"DELETE"});if(r.ok)setOrders(p=>p.filter(x=>x.id!==id));}
  function exportAll(){const rows=(orders||[]).map(o=>{const sizes=o.sizes||["S","M","L","XL"];const priceMap=o.priceBySize||{};const t=(o.items||[]).reduce((sum,it)=>sum+sizes.reduce((acc,sz)=>acc+Number(it.quantities?.[sz]||0)*(Number(priceMap[sz]||0)),0),0);const tallaResumen=sizes.map(sz=>`${sz}:${(o.items||[]).reduce((a,it)=>a+Number(it.quantities?.[sz]||0),0)}`).join(" | ");const precios=sizes.map(sz=>`${sz}:Q${Number(priceMap[sz]||0).toFixed(2)}`).join(" | ");const dep=Number(o.deposit||0);const estadoPago=dep===0?"Pendiente":(dep<t?"Parcial":"Pagado");return {ID:o.id,Cliente:o.customer,EstadoTrabajo:o.status,EstadoPago:estadoPago,Entrega:o.deliveryDate||"",Anticipo_Q:dep,Total_Q:t,Saldo_Q:t-dep,Tallas:tallaResumen,Precios:precios,Imagen:o.imageUrl||""};});const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Pedidos");XLSX.writeFile(wb,"Pedidos_LEBUSH_VFinal4.xlsx");}
  function exportOne(o){const sizes=o.sizes||["S","M","L","XL"];const priceMap=o.priceBySize||{};const t=(o.items||[]).reduce((sum,it)=>sum+sizes.reduce((acc,sz)=>acc+Number(it.quantities?.[sz]||0)*(Number(priceMap[sz]||0)),0),0);const dep=Number(o.deposit||0);const estadoPago=dep===0?"Pendiente":(dep<t?"Parcial":"Pagado");const head=[{Cliente:o.customer,EstadoTrabajo:o.status,EstadoPago:estadoPago,Entrega:o.deliveryDate||"",Anticipo_Q:dep,Total_Q:t,Saldo_Q:t-dep,Dueño:o.owner||"",Imagen:o.imageUrl||""}];const detalle=(o.items||[]).map(it=>{const row={Prenda:it.garment||"",Tela:it.fabric||"",Color:it.color||""};sizes.forEach(sz=>{row["Cant_"+sz]=Number(it.quantities?.[sz]||0);row["Precio_"+sz]=Number(priceBySize[sz]||0);row["Subtotal_"+sz]=Number(it.quantities?.[sz]||0)*Number(priceBySize[sz]||0);});return row;});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(head),"Resumen");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(detalle),"Detalle");XLSX.writeFile(wb,`Pedido_${o.id||"sinid"}.xlsx`);}
  if(!token){return(<div className="app-bg" style={{backgroundImage:"url('/fondo-lebush.png')",minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="card" style={{maxWidth:420,width:"100%",padding:18}}><h2 style={{marginTop:0}}>LEBUSH — ¡TeQueda!</h2><p style={{color:"#6b7280",marginTop:0}}>Inicia sesión</p><form onSubmit={doLogin} className="grid"><input className="input" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/><input className="input" type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/>{authErr&&<div style={{color:"#ef4444",fontSize:12}}>{authErr}</div>}<button className="btn">🔑 Entrar</button></form></div></div>);}
  return(<div className="container">
    <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
      <div><h2 className="header-title" style={{margin:"8px 0"}}>LEBUSH — ¡TeQueda!</h2><div className="header-sub">Hola, {user?.name} ({user?.role})</div></div>
      <div className="row">{user?.role==="admin"&&<AdminCreateUser token={token}/>}<button className="btn" onClick={logout}>🔒 Salir</button></div>
    </div>
    <div className="card" style={{marginBottom:16,padding:12}}>
      <h3 style={{marginTop:0}}>{form.id?"Editar pedido":"Nuevo pedido"}</h3>
      <div className="grid grid-2">
        <input className="input" placeholder="Cliente" value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))}/>
        <input className="input" type="date" value={form.deliveryDate} onChange={e=>setForm(f=>({...f,deliveryDate:e.target.value}))}/>
        <input className="input" placeholder="Teléfono" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
        <input className="input" placeholder="Referencia / PO" value={form.references} onChange={e=>setForm(f=>({...f,references:e.target.value}))}/>
      </div>
      <textarea className="input" style={{marginTop:12}} placeholder="Notas / Presupuesto" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
      <div style={{marginTop:12}}>
        <div className="row" style={{justifyContent:"space-between"}}><h4 style={{margin:"6px 0"}}>Precios por talla</h4><button className="btn" type="button" onClick={addSize}>➕ Agregar talla</button></div>
        <div className="grid grid-3">{sizes.map(sz=>(<div key={sz}><label style={{color:"#6b7280"}}>Precio {sz} (Q)</label><input className="input" type="number" step="0.01" value={priceBySize[sz]??0} onChange={e=>setPriceBySize(p=>({...p,[sz]:Number(e.target.value)}))}/></div>))}</div>
      </div>
      <div style={{marginTop:12}}>
        <div className="row" style={{justifyContent:"space-between"}}><h4 style={{margin:"6px 0"}}>Ítems</h4><button className="btn" type="button" onClick={addItem}>➕ Agregar ítem</button></div>
        <div className="grid">{form.items.map(it=>(<div key={it.id} className="card" style={{padding:12}}>
          <div className="grid grid-3">
            <input className="input" placeholder="Prenda" value={it.garment} onChange={e=>updateItem(it.id,"garment",e.target.value)}/>
            <input className="input" placeholder="Tela" value={it.fabric} onChange={e=>updateItem(it.id,"fabric",e.target.value)}/>
            <input className="input" placeholder="Color" value={it.color} onChange={e=>updateItem(it.id,"color",e.target.value)}/>
          </div>
          <div className="grid grid-3" style={{marginTop:8}}>{sizes.map(sz=>(<div key={sz}><label style={{color:"#6b7280"}}>{sz}</label><input className="input" type="number" min="0" value={it.quantities[sz]??0} onChange={e=>updateQty(it.id,sz,e.target.value)}/></div>))}</div>
          <div className="row" style={{justifyContent:"space-between",marginTop:8}}><div style={{color:"#6b7280"}}>Cant: <b>{qtyOf(it)}</b></div><div style={{color:"#6b7280"}}>Subtotal: <b>Q{subtotalOf(it).toFixed(2)}</b></div></div>
          <div style={{textAlign:"right",marginTop:6}}><button className="btn" type="button" onClick={()=>removeItem(it.id)}>❌ Eliminar ítem</button></div>
        </div>))}</div>
      </div>
      <div className="grid grid-3" style={{marginTop:12}}>
        <div><label style={{color:"#6b7280"}}>Anticipo (Q)</label><input className="input" type="number" step="0.01" value={form.deposit} onChange={e=>setForm(f=>({...f,deposit:Number(e.target.value)}))}/></div>
        <div><label style={{color:"#6b7280"}}>Estado de trabajo</label><select className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATES.map(s=>(<option key={s}>{s}</option>))}</select></div>
        <div><label style={{color:"#6b7280"}}>Imagen</label><input className="input" type="file" accept="image/*" onChange={onSelectImage}/></div>
      </div>
      {form.imagePreview&&<img src={form.imagePreview} className="thumb" style={{marginTop:8}}/>}
      <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
        <div style={{color:"#111"}}>Total: <b>Q{total.toFixed(2)}</b> • Saldo: <b>Q{saldo.toFixed(2)}</b> • Estado de pago: <span className={"badge "+(estadoPago==="Pagado"?"pay-pago":estadoPago==="Parcial"?"pay-parc":"pay-pend")}>{estadoPago==="Pagado"?"✅ Pagado":(estadoPago==="Parcial"?"🟡 Parcial":"🔴 Pendiente")}</span></div>
        <div className="row"><button className="btn" onClick={saveOrder}>{form.id?"💾 Actualizar pedido":"💾 Guardar pedido"}</button>{form.id&&<button className="btn" type="button" onClick={resetForm}>↩️ Cancelar edición</button>}</div>
      </div>
    </div>
    <div className="card" style={{padding:12}}>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div className="row"><span style={{color:"#6b7280"}}>Filtrar</span><select className="input" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:180}}><option>Todos</option>{STATES.map(s=>(<option key={s}>{s}</option>))}</select></div>
        <button className="btn" onClick={exportAll}>📤 Exportar todos a Excel</button>
      </div>
      <table className="table" style={{marginTop:12}}>
        <thead><tr><th>Cliente</th><th>Entrega</th><th>Trabajo</th><th>Pago</th><th>Anticipo</th><th>Total</th><th>Saldo</th><th>Acciones</th><th>Imagen</th></tr></thead>
        <tbody>
          {orders.length===0?(<tr><td colSpan="9" style={{color:"#6b7280"}}>No hay pedidos.</td></tr>):(orders.filter(o=>filter==="Todos"||o.status===filter).map(o=>{const sizes=o.sizes||["S","M","L","XL"];const priceMap=o.priceBySize||{};const t=(o.items||[]).reduce((s,it)=>s+sizes.reduce((a,sz)=>a+Number(it.quantities?.[sz]||0)*Number(priceBySize[sz]||0),0),0);const dep=Number(o.deposit||0);const ep=dep===0?"Pendiente":(dep<t?"Parcial":"Pagado");const saldo=t-dep;return(<tr key={o.id}>
            <td><b><span className={"dot "+(DOT[o.status]||"")}></span>{o.customer}</b><div style={{color:"#9ca3af",fontSize:12}}>#{o.id}</div></td>
            <td>{o.deliveryDate||"-"}</td>
            <td><select className="input" value={o.status} onChange={e=>changeStatus(o.id,e.target.value)}>{STATES.map(s=>(<option key={s}>{s}</option>))}</select></td>
            <td><span className={"badge "+(ep==="Pagado"?"pay-pago":ep==="Parcial"?"pay-parc":"pay-pend")}>{ep==="Pagado"?"✅ Pagado":(ep==="Parcial"?"🟡 Parcial":"🔴 Pendiente")}</span></td>
            <td>Q{dep.toFixed(2)}</td><td>Q{t.toFixed(2)}</td><td>Q{saldo.toFixed(2)}</td>
            <td className="actions"><button className="btn" onClick={()=>editOrder(o)}>✏️ Editar</button><button className="btn" onClick={()=>exportOne(o)}>📄 Excel</button><button className="btn" onClick={()=>deleteOrder(o.id)}>🗑 Eliminar</button></td>
            <td style={{textAlign:"center"}}>{o.imageUrl?(<a href={o.imageUrl} target="_blank" rel="noreferrer"><img src={o.imageUrl} className="thumb"/></a>):(<div className="empty-img">Sin imagen</div>)}</td>
          </tr>);}))}
        </tbody>
      </table>
    </div>
  </div>);}
function AdminCreateUser({token}){const [nu,setNu]=useState({name:"",email:"",password:"",role:"usuario"});async function create(){if(!nu.name||!nu.email||!nu.password)return alert("Completa los campos");try{await API.register(nu,token);alert("Usuario creado");setNu({name:"",email:"",password:"",role:"usuario"});}catch{alert("No se pudo crear");}}return(<div className="row" style={{gap:6}}><input className="input" style={{width:150}} placeholder="Nombre" value={nu.name} onChange={e=>setNu({...nu,name:e.target.value})}/><input className="input" style={{width:180}} placeholder="Correo" value={nu.email} onChange={e=>setNu({...nu,email:e.target.value})}/><input className="input" style={{width:150}} placeholder="Contraseña" value={nu.password} onChange={e=>setNu({...nu,password:e.target.value})}/><select className="input" style={{width:120}} value={nu.role} onChange={e=>setNu({...nu,role:e.target.value})}><option value="usuario">usuario</option><option value="admin">admin</option></select><button className="btn" type="button" onClick={create}>👤 Crear</button></div>);}