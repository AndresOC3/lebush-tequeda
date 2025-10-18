import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

const API = {
  async login(e, p) {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: e, password: p }),
    });

    const data = await r.json();
    console.log("🔍 Respuesta del servidor:", data);

    if (!r.ok || data.mensaje !== "Login exitoso") {
      throw new Error(data.mensaje || "Credenciales incorrectas");
    }

    return data;
  },

  async register(u, t) {
    const r = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + t,
      },
      body: JSON.stringify(u),
    });
    if (!r.ok) throw new Error("No se pudo crear");
    return r.json();
  },

  async meFetch(u, o = {}) {
    const t = localStorage.getItem("token");
    const h = Object.assign(
      {
        "Content-Type": "application/json",
        Authorization: "Bearer " + t,
      },
      o.headers || {}
    );
    const r = await fetch(u, { ...o, headers: h });
    if (r.status === 401) throw new Error("No autorizado");
    return r;
  },
};

const STATES = ["PorHacer", "Iniciado", "Finalizado", "Entregado"];
const DOT = {
  PorHacer: "d-por",
  Iniciado: "d-ini",
  Finalizado: "d-fin",
  Entregado: "d-ent",
};
const uid = () => Math.random().toString(36).slice(2, 9);

export default function App() {
  // ✅ Corrección: evita error "undefined is not valid JSON"
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // ✅ Token seguro
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  const [authErr, setAuthErr] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("Todos");
  const [sizes, setSizes] = useState(["S", "M", "L", "XL"]);
  const [priceBySize, setPriceBySize] = useState({ S: 0, M: 0, L: 0, XL: 0 });

  const [form, setForm] = useState({
    id: null,
    customer: "",
    phone: "",
    references: "",
    deliveryDate: "",
    notes: "",
    deposit: 0,
    status: "PorHacer",
    items: [
      {
        id: uid(),
        garment: "",
        fabric: "",
        color: "",
        quantities: { S: 0, M: 0, L: 0, XL: 0 },
      },
    ],
    imageFile: null,
    imagePreview: null,
    imageUrl: null,
  });

  // ✅ Fondo corregido
  useEffect(() => {
    const root = document.getElementById("root");
    root.classList.add("app-bg");
    root.style.backgroundImage = "url('./fondo-lebush.png')";
  }, []);

  async function doLogin(e) {
    e.preventDefault();
    setAuthErr("");
    try {
      const { token, user } = await API.login(email, password);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setToken(token);
      setUser(user);
      loadOrders().catch(() => {});
    } catch (err) {
      setAuthErr(err.message || "Error");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  async function loadOrders() {
    const r = await API.meFetch("/api/pedidos");
    const j = await r.json();
    setOrders(j.pedidos || []);
  }

  useEffect(() => {
    if (token) loadOrders().catch(() => {});
  }, [token]);

  function onSelectImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setForm((f) => ({ ...f, imageFile: file, imagePreview: ev.target.result }));
    reader.readAsDataURL(file);
  }

  async function uploadImage(file) {
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd,
    });
    if (!r.ok) throw new Error("No se pudo subir");
    const j = await r.json();
    return j.url;
  }

  const qtyOf = (it) =>
    Object.values(it.quantities || {}).reduce((a, b) => a + Number(b || 0), 0);

  const subtotalOf = (it) =>
    Object.entries(it.quantities || {}).reduce(
      (s, [sz, q]) => s + Number(q || 0) * Number(priceBySize[sz] || 0),
      0
    );

  const total = useMemo(
    () => form.items.reduce((s, it) => s + subtotalOf(it), 0),
    [form.items, priceBySize]
  );

  const saldo = useMemo(() => total - Number(form.deposit || 0), [total, form.deposit]);

  const estadoPago = useMemo(() => {
    if (total === 0) return "Pendiente";
    const dep = Number(form.deposit || 0);
    return dep === 0 ? "Pendiente" : dep < total ? "Parcial" : "Pagado";
  }, [total, form.deposit]);

  function addSize() {
    const raw = prompt("Nueva talla (ej. 2XL, Niño):");
    if (!raw) return;
    const sz = raw.trim();
    if (!sz) return;
    if (sizes.includes(sz)) return alert("La talla ya existe");
    setSizes((p) => [...p, sz]);
    setPriceBySize((p) => ({ ...p, [sz]: 0 }));
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => ({
        ...i,
        quantities: { ...i.quantities, [sz]: 0 },
      })),
    }));
  }

  function addItem() {
    const base = Object.fromEntries(sizes.map((sz) => [sz, 0]));
    setForm((f) => ({
      ...f,
      items: [...f.items, { id: uid(), garment: "", fabric: "", color: "", quantities: base }],
    }));
  }

  function removeItem(id) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.id !== id) }));
  }

  function updateItem(id, field, val) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.id === id ? { ...i, [field]: val } : i)),
    }));
  }

  function updateQty(id, sz, val) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        i.id === id
          ? { ...i, quantities: { ...i.quantities, [sz]: Math.max(0, Number(val || 0)) } }
          : i
      ),
    }));
  }

  async function saveOrder(e) {
    e?.preventDefault();
    if (!form.customer) return alert("Falta el nombre del cliente");
    let imageUrl = form.imageUrl || null;
    if (form.imageFile) {
      try {
        imageUrl = await uploadImage(form.imageFile);
      } catch {
        return alert("Error subiendo imagen");
      }
    }
    const payload = {
      customer: form.customer,
      phone: form.phone,
      references: form.references,
      deliveryDate: form.deliveryDate,
      notes: form.notes,
      deposit: Number(form.deposit || 0),
      status: form.status,
      sizes,
      priceBySize,
      items: form.items,
      total,
      imageUrl,
      estadoPago,
    };
    if (form.id) {
      const r = await API.meFetch("/api/pedidos/" + form.id, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!r.ok) return alert("No se pudo actualizar");
    } else {
      const r = await API.meFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!r.ok) return alert("No se pudo guardar");
    }
    await loadOrders();
    resetForm();
  }

  function resetForm() {
    setForm({
      id: null,
      customer: "",
      phone: "",
      references: "",
      deliveryDate: "",
      notes: "",
      deposit: 0,
      status: "PorHacer",
      items: [
        {
          id: uid(),
          garment: "",
          fabric: "",
          color: "",
          quantities: Object.fromEntries(sizes.map((s) => [s, 0])),
        },
      ],
      imageFile: null,
      imagePreview: null,
      imageUrl: null,
    });
  }

  // ✅ resto del código igual
  // (desde tu return y funciones AdminCreateUser quedan exactamente igual)
}
