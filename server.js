
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'lebush-secret';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_DIR = path.join(__dirname, '.lebush_data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PEDIDOS_FILE = path.join(DATA_DIR, 'pedidos.json');

await fs.ensureDir(PUBLIC_DIR);
await fs.ensureDir(UPLOADS_DIR);
await fs.ensureDir(DATA_DIR);
app.use('/uploads', express.static(UPLOADS_DIR));

// Inicial limpio: admin y pedidos vacíos
async function initClean(){
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = { name:'Administrador', email:'admin@lebush.local', passwordHash, role:'admin' };
  await fs.writeJson(USERS_FILE, { users:[admin] }, { spaces:2 });
  await fs.writeJson(PEDIDOS_FILE, { pedidos:[] }, { spaces:2 });
  console.log('✅ Admin inicial: admin@lebush.local / admin123');
}
await initClean();

async function readJSON(f,def={}){ try{ if(!(await fs.pathExists(f))) await fs.writeJson(f,def,{spaces:2}); return await fs.readJson(f); } catch { return def; } }
async function writeJSON(f,d){ await fs.writeJson(f,d,{spaces:2}); }

function auth(req,res,next){ const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):null; if(!t) return res.status(401).json({error:'No autorizado'}); try{ req.user=jwt.verify(t,JWT_SECRET); next(); }catch{ return res.status(401).json({error:'Token inválido'}); } }
function adminOnly(req,res,next){ if(req.user?.role!=='admin') return res.status(403).json({error:'Solo admin'}); next(); }

const storage = multer.diskStorage({
  destination: (_req,_file,cb)=>cb(null,UPLOADS_DIR),
  filename: (_req,file,cb)=>{ const ext=path.extname(file.originalname)||'.jpg'; cb(null, Date.now()+'_'+Math.random().toString(36).slice(2,9)+ext); }
});
const upload = multer({ storage });

app.post('/api/login', async (req,res)=>{
  const { email, password } = req.body||{};
  const data = await readJSON(USERS_FILE,{users:[]});
  const u = data.users.find(x=>x.email===email);
  if(!u) return res.status(401).json({error:'Usuario no encontrado'});
  const ok = await bcrypt.compare(password||'', u.passwordHash||'');
  if(!ok) return res.status(401).json({error:'Contraseña incorrecta'});
  const token = jwt.sign({email:u.email,name:u.name,role:u.role}, JWT_SECRET, {expiresIn:'12h'});
  res.json({ token, user:{ name:u.name, email:u.email, role:u.role } });
});

app.post('/api/users', auth, adminOnly, async (req,res)=>{
  const { name, email, password, role } = req.body||{};
  if(!name || !email || !password) return res.status(400).json({error:'Datos incompletos'});
  const data = await readJSON(USERS_FILE,{users:[]});
  if(data.users.some(u=>u.email===email)) return res.status(400).json({error:'Email ya existe'});
  const passwordHash = await bcrypt.hash(password, 10);
  data.users.push({ name, email, passwordHash, role: role==='admin' ? 'admin':'usuario' });
  await writeJSON(USERS_FILE, data);
  res.json({ ok:true });
});

app.get('/api/pedidos', auth, async (_req,res)=>{
  const data = await readJSON(PEDIDOS_FILE,{pedidos:[]});
  res.json(data);
});

app.post('/api/pedidos', auth, async (req,res)=>{
  const p = req.body||{};
  if(!p.customer) return res.status(400).json({error:'Pedido incompleto'});
  const data = await readJSON(PEDIDOS_FILE,{pedidos:[]});
  p.id = Math.random().toString(36).slice(2,9);
  p.owner = req.user.email;
  p.createdAt = new Date().toISOString();
  data.pedidos.unshift(p);
  await writeJSON(PEDIDOS_FILE, data);
  res.json(p);
});

app.patch('/api/pedidos/:id', auth, async (req,res)=>{
  const { id } = req.params;
  const updates = req.body||{};
  const data = await readJSON(PEDIDOS_FILE,{pedidos:[]});
  const i = data.pedidos.findIndex(x=>x.id===id);
  if(i===-1) return res.status(404).json({error:'No encontrado'});
  const isOwner = data.pedidos[i].owner===req.user.email;
  const isAdmin = req.user.role==='admin';
  if(!isOwner && !isAdmin) return res.status(403).json({error:'Sin permiso'});
  data.pedidos[i] = { ...data.pedidos[i], ...updates };
  await writeJSON(PEDIDOS_FILE, data);
  res.json(data.pedidos[i]);
});

app.delete('/api/pedidos/:id', auth, async (req,res)=>{
  const { id } = req.params;
  const data = await readJSON(PEDIDOS_FILE,{pedidos:[]});
  const i = data.pedidos.findIndex(x=>x.id===id);
  if(i===-1) return res.status(404).json({error:'No encontrado'});
  const isOwner = data.pedidos[i].owner===req.user.email;
  const isAdmin = req.user.role==='admin';
  if(!isOwner && !isAdmin) return res.status(403).json({error:'Sin permiso'});
  data.pedidos.splice(i,1);
  await writeJSON(PEDIDOS_FILE, data);
  res.json({ ok:true });
});

app.post('/api/upload', auth, upload.single('image'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'No file'});
  res.json({ url:'/uploads/'+req.file.filename });
});

const DIST_DIR = path.join(__dirname, 'dist');
if(await fs.pathExists(DIST_DIR)){
  app.use(express.static(DIST_DIR));
  app.get('*', (_req,res)=>res.sendFile(path.join(DIST_DIR,'index.html')));
}

app.listen(PORT, ()=>console.log('🚀 LEBUSH VFinal4 API en puerto '+PORT));
