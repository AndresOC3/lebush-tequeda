import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs"; // ✅ reemplazo de bcrypt nativo
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

// Configuración de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist"))); // para servir el frontend

// ✅ Conexión a MongoDB Atlas
const mongoURI =
  process.env.MONGODB_URI ||
  "mongodb+srv://admin:Lebush2025@cluster0.ndrrpj5.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// 📦 Esquema de usuarios (login)
const userSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  password: String,
  rol: { type: String, default: "usuario" },
});
const Usuario = mongoose.model("Usuario", userSchema);

// 📦 Esquema de pedidos
const pedidoSchema = new mongoose.Schema({
  cliente: String,
  descripcion: String,
  fecha: String,
  entrega: String,
  anticipo: Number,
  estado: { type: String, default: "PorHacer" },
  imagen: String,
  tallas: [
    {
      talla: String,
      cantidad: Number,
      precioUnitario: Number,
    },
  ],
  total: Number,
  pagado: { type: Boolean, default: false },
});
const Pedido = mongoose.model("Pedido", pedidoSchema);

// 🧾 Configuración de subida de archivos (imágenes)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Ruta: registrar usuario (solo admin puede crear)
app.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ mensaje: "El usuario ya existe" });

    const hashed = await bcrypt.hash(password, 10);
    const nuevoUsuario = new Usuario({ nombre, email, password: hashed, rol });
    await nuevoUsuario.save();
    res.json({ mensaje: "Usuario creado exitosamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al registrar", error });
  }
});

// ✅ Ruta: login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(400).json({ mensaje: "Usuario no encontrado" });

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) return res.status(400).json({ mensaje: "Contraseña incorrecta" });

    res.json({
      mensaje: "Login exitoso",
      usuario: { nombre: usuario.nombre, rol: usuario.rol, email: usuario.email },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al iniciar sesión", error });
  }
});

// ✅ Ruta: crear pedido
app.post("/api/pedidos", upload.single("imagen"), async (req, res) => {
  try {
    const datos = req.body;
    let imagen = null;

    if (req.file) {
      imagen = `/uploads/${req.file.filename}`;
    }

    // Calcular total automáticamente
    const tallas = JSON.parse(datos.tallas || "[]");
    const total = tallas.reduce(
      (sum, t) => sum + t.cantidad * t.precioUnitario,
      0
    );

    const nuevo = new Pedido({
      ...datos,
      tallas,
      imagen,
      total,
      pagado: Number(datos.anticipo) >= total,
    });

    await nuevo.save();
    res.json({ mensaje: "Pedido guardado exitosamente", pedido: nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al guardar el pedido", error });
  }
});

// ✅ Ruta: obtener todos los pedidos
app.get("/api/pedidos", async (req, res) => {
  const pedidos = await Pedido.find();
  res.json(pedidos);
});

// ✅ Ruta: editar pedido
app.put("/api/pedidos/:id", upload.single("imagen"), async (req, res) => {
  try {
    const { id } = req.params;
    const datos = req.body;
    let imagen = datos.imagen;

    if (req.file) {
      imagen = `/uploads/${req.file.filename}`;
    }

    const tallas = JSON.parse(datos.tallas || "[]");
    const total = tallas.reduce(
      (sum, t) => sum + t.cantidad * t.precioUnitario,
      0
    );

    const actualizado = await Pedido.findByIdAndUpdate(
      id,
      {
        ...datos,
        tallas,
        imagen,
        total,
        pagado: Number(datos.anticipo) >= total,
      },
      { new: true }
    );

    res.json({ mensaje: "Pedido actualizado", pedido: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al editar pedido", error });
  }
});

// ✅ Ruta: eliminar pedido
app.delete("/api/pedidos/:id", async (req, res) => {
  await Pedido.findByIdAndDelete(req.params.id);
  res.json({ mensaje: "Pedido eliminado" });
});

// ✅ Para Render: servir el frontend (React) desde /dist
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 LEBUSH ¡TeQueda!!! corriendo en puerto ${PORT}`);
});

