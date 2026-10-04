import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvsepnwkkcibzskuapsz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2Vwbndra2NpYnpza3VhcHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MDc0MTAsImV4cCI6MjEwNjQ4MzQxMH0.pDg6hJTFl7MnuadztS_cmZLgKk9rydvmlHtEfhT25H0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let usuarioActual = localStorage.getItem('usuario_app') || null;
let periodo = { preset: 'mes', offset: 0, desde: null, hasta: null };
let cacheDatos = { 
  gastos: [], ingresos: [], configuracion: [], 
  bcp: {tabla:'bcp_credito', data:[]}, 
  bbva_credito: {tabla:'bbva_credito', data:[]}, 
  bbva_tarjeta: {tabla:'bbva_tarjeta', data:[]} 
};

// Formateadores y utilidades ultrarrápidas
const S = n => 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const iso = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const dm = d => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);

function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  if(!t) { alert(msg); return; } 
  t.className = `fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm rounded-2xl px-4 py-3 text-xs font-bold text-center shadow-2xl transition-all duration-300 ${ok ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'}`;
  t.innerText = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3500);
}

function normalizar(obj) {
  const nuevo = {};
  for (let key in obj) {
    const cleanKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    nuevo[cleanKey] = obj[key];
  }
  nuevo.id = obj.id || obj.ID || obj.Id;
  return nuevo;
}

async function fetchSafe(...nombresPosibles) {
  for (let nombre of nombresPosibles) {
    if (!nombre) continue;
    try {
      let { data, error } = await supabase.from(nombre).select('*').limit(5000);
      if (!error && data) return { tabla: nombre, data: data.map(normalizar) };
    } catch (e) {}
  }
  return { tabla: '', data: [] };
}

/* REGISTRO DE SERVICE WORKER PARA APP MÓVIL (PWA / APK) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
  });
}

/* SISTEMA DE LOGIN Y PANTALLA COMPLETA */
function verificarAutenticacion() {
  let layer = document.getElementById('viewLogin');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'viewLogin';
    layer.className = 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4';
    document.body.appendChild(layer);
  }

  if (!usuarioActual) {
    layer.innerHTML = `
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-fade-in">
        <div class="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
          <i class="fa-solid fa-wallet"></i>
        </div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Finanzas Personales</h2>
        <p class="text-xs text-slate-400 mb-5">Ingresa tus credenciales de acceso</p>
        
        <form id="formLogin" onsubmit="window.ejecutarLogin(event)" class="space-y-3.5 text-left">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Usuario</label>
            <select id="loginUsuario" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500">
              <option value="Jhonathan">Jhonathan</option>
              <option value="Sindy">Sindy</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Contraseña</label>
            <input type="password" id="loginClave" required placeholder="••••••••" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500">
          </div>
          <button type="submit" id="btnIngresarApp" class="w-full bg-slate-900 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-slate-900/20 transition-all mt-2">
            Ingresar al Sistema
          </button>
        </form>
      </div>`;
    layer.classList.remove('hidden');
  } else {
    layer.classList.add('hidden');
    cargarDashboard();
  }
}

window.ejecutarLogin = async function(e) {
  if(e) e.preventDefault();
  const usu = document.getElementById('loginUsuario').value;
  const cla = document.getElementById('loginClave').value;
  const btn = document.getElementById('btnIngresarApp');
  
  btn.innerText = 'Verificando...';
  btn.disabled = true;

  try {
    const { data, error } = await supabase.from('usuarios').select('*').eq('usuario', usu).single();
    if (error || !data) throw new Error('Usuario no registrado.');
    if (data.clave !== cla) throw new Error('Contraseña incorrecta.');

    if (cla === '1234') {
      btn.innerText = 'Ingresar al Sistema';
      btn.disabled = false;
      window.mostrarModalCambioClave(usu);
      return;
    }

    usuarioActual = usu;
    localStorage.setItem('usuario_app', usu);
    toast(`¡Bienvenido, ${usu}!`, true);
    verificarAutenticacion();
  } catch (err) {
    toast(err.message, false);
    btn.innerText = 'Ingresar al Sistema';
    btn.disabled = false;
  }
}

window.mostrarModalCambioClave = function(usu) {
  const layer = document.getElementById('viewLogin');
  layer.innerHTML = `
    <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center">
      <div class="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl">
        <i class="fa-solid fa-key"></i>
      </div>
      <h2 class="text-base font-bold text-slate-800 mb-1">Cambio Obligatorio</h2>
      <p class="text-xs text-slate-500 mb-5">Hola <b>${usu}</b>, debes cambiar tu clave predeterminada por seguridad.</p>
      
      <form onsubmit="window.actualizarClaveNueva(event, '${usu}')" class="space-y-3.5 text-left">
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nueva Contraseña</label>
          <input type="password" id="nuevaClaveInput" required placeholder="Escribe tu nueva clave" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-500">
        </div>
        <button type="submit" class="w-full bg-amber-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-amber-600/20 transition-all">
          Guardar y Entrar
        </button>
      </form>
    </div>`;
}

window.actualizarClaveNueva = async function(e, usu) {
  if(e) e.preventDefault();
  const nueva = document.getElementById('nuevaClaveInput').value;
  if(!nueva || nueva.length < 3) {
    toast('Ingresa una clave válida', false);
    return;
  }

  try {
    const { error } = await supabase.from('usuarios').update({ clave: nueva }).eq('usuario', usu);
    if(error) throw error;

    toast('Clave actualizada correctamente', true);
    usuarioActual = usu;
    localStorage.setItem('usuario_app', usu);
    verificarAutenticacion();
  } catch(err) {
    toast('Error: ' + err.message, false);
  }
}

window.cerrarSesion = function() {
  localStorage.removeItem('usuario_app');
  usuarioActual = null;
  verificarAutenticacion();
}

/* NAVEGACIÓN Y VISTAS */
function mostrarVista(vista) {
  const mapa = { dash: 'viewDash', registro: 'viewRegistro', creditos: 'viewDeudas', config: 'viewConfig' };
  Object.keys(mapa).forEach(v => {
    const el = document.getElementById(mapa[v]);
    if(el) {
      el.classList.toggle('hidden', v !== vista);
      if (v === vista) el.classList.add('pb-28'); // Padding inferior para menú móvil
    }
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    const activo = b.dataset.vista === vista || (vista === 'creditos' && b.dataset.vista === 'deudas');
    b.classList.toggle('activo', activo);
  });
  
  const titulos = { dash: 'Panel General', registro: 'Nuevo Registro', creditos: 'Créditos Pendientes', config: 'Ajustes' };
  const titMovil = document.getElementById('tituloVistaMovil');
  if(titMovil) titMovil.innerText = titulos[vista];
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (vista === 'creditos') cargarModuloCreditosDetallado();
  if (vista === 'registro') setTimeout(() => {
      const g = document.getElementById('montoGasto');
      if(g) g.focus();
  }, 150);
}

document.querySelectorAll('.nav-item').forEach(b => {
  b.addEventListener('click', () => {
    const v = b.dataset.vista;
    mostrarVista(v === 'deudas' ? 'creditos' : v);
  });
});

window.cambiarTab = function(tipo) {
  const esIngreso = String(tipo).toLowerCase().includes('ingreso');
  const fg = document.getElementById('formGasto');
  const fi = document.getElementById('formIngreso');
  
  document.querySelectorAll('button[onclick*="cambiarTab"]').forEach(btn => {
    const esBtnIngreso = btn.textContent.toLowerCase().includes('ingreso');
    if (esIngreso === esBtnIngreso) {
      btn.className = "flex-1 py-2.5 text-xs font-bold rounded-2xl bg-white text-slate-900 shadow-sm transition-all";
    } else {
      btn.className = "flex-1 py-2.5 text-xs font-semibold rounded-2xl text-slate-500 hover:text-slate-800 transition-all";
    }
  });

  if (fg && fi) {
    fg.classList.toggle('hidden', esIngreso);
    fi.classList.toggle('hidden', !esIngreso);
  }
};

/* PERIODO DE TIEMPO */
function calcularRango() {
  const hoy = new Date(), o = periodo.offset;
  let desde, hasta, etiqueta;
  if (periodo.preset === 'dia') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + o); hasta = new Date(desde);
    etiqueta = o === 0 ? 'Hoy' : (o === -1 ? 'Ayer' : desde.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }));
  } else if (periodo.preset === 'semana') {
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + o * 7);
    const ds = (base.getDay() + 6) % 7;
    desde = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ds);
    hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 6);
    etiqueta = dm(desde) + ' – ' + dm(hasta);
  } else if (periodo.preset === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() + o, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth() + o + 1, 0);
    etiqueta = desde.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  } else if (periodo.preset === 'anio') {
    desde = new Date(hoy.getFullYear() + o, 0, 1); hasta = new Date(hoy.getFullYear() + o, 11, 31);
    etiqueta = 'Año ' + (hoy.getFullYear() + o);
  } else {
    desde = new Date(2000, 0, 1); hasta = new Date(hoy.getFullYear() + 5, 11, 31); etiqueta = 'Historial';
  }
  return { desde: iso(desde), hasta: iso(hasta), etiqueta: etiqueta };
}

function pintarChips() {
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('activo', b.dataset.preset === periodo.preset));
}

document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  periodo.preset = b.dataset.preset; periodo.offset = 0; pintarChips(); cargarDashboard();
}));

window.moverPeriodo = function(p) { periodo.offset += p; cargarDashboard(); }

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();
  if(document.getElementById('fechaIngreso')) document.getElementById('fechaIngreso').valueAsDate = hoy;
  if(document.getElementById('fechaGasto')) document.getElementById('fechaGasto').valueAsDate = hoy;
  pintarChips();
  verificarAutenticacion();
});

window.cargarDashboard = async function() {
  try {
    const [resG, resI, resC] = await Promise.all([
      supabase.from('gastos').select('*').limit(50000).order('id', { ascending: false }),
      supabase.from('ingresos').select('*').limit(50000).order('id', { ascending: false }),
      supabase.from('configuracion').select('*').limit(5000)
    ]);

    cacheDatos.gastos = (!resG.error && resG.data) ? resG.data.map(normalizar) : [];
    cacheDatos.ingresos = (!resI.error && resI.data) ? resI.data.map(normalizar) : [];
    cacheDatos.configuracion = (!resC.error && resC.data) ? resC.data.map(normalizar) : [];

    cacheDatos.bcp = await fetchSafe('bcp_credito', 'bcp');
    cacheDatos.bbva_credito = await fetchSafe('bbva_credito', 'bbva');
    cacheDatos.bbva_tarjeta = await fetchSafe('bbva_tarjeta', 'bbvatarjeta');

    procesarYRenderizarDashboard();
  } catch (err) {
    toast('Error al actualizar datos', false);
  }
}

function ocultarModulosSinUso() {
  Array.from(document.querySelectorAll('h2, h3, div, span, p'))
    .filter(el => el.textContent && el.textContent.trim() === 'Camino sin deudas')
    .forEach(el => {
      const box = el.closest('.bg-white') || el.parentElement.parentElement;
      if (box) box.remove();
    });
}

function renderHeaderUsuario() {
  const dashView = document.getElementById('viewDash');
  if (!dashView || !usuarioActual) return;

  let headerDash = document.getElementById('headerDashUsuario');
  if (!headerDash) {
      headerDash = document.createElement('div');
      headerDash.id = 'headerDashUsuario';
      headerDash.className = 'flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm mb-4 w-full';
      dashView.prepend(headerDash);
  }
  
  headerDash.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold text-base shadow-md shadow-sky-500/20">
        ${usuarioActual.charAt(0).toUpperCase()}
      </div>
      <div>
        <h3 class="text-sm font-bold text-slate-800">Hola, ${usuarioActual}</h3>
        <p class="text-[10px] text-slate-400">Sesión activa</p>
      </div>
    </div>
    <button onclick="window.cerrarSesion()" class="bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5">
      <i class="fa-solid fa-right-from-bracket"></i> <span>Salir</span>
    </button>`;
}

function procesarYRenderizarDashboard() {
  const filtro = calcularRango();
  const etiq = document.getElementById('etiquetaPeriodo');
  if(etiq) etiq.innerText = filtro.etiqueta;

  renderHeaderUsuario();
  ocultarModulosSinUso();

  const selGasto = document.getElementById('categoriaGasto');
  const selIng = document.getElementById('categoriaIngreso');
  
  if(selGasto) selGasto.innerHTML = '';
  if(selIng) selIng.innerHTML = '';

  const gruposG = {};
  cacheDatos.configuracion.forEach(c => {
    if (c.tipo === 'Gasto' || c.tipo === 'gasto') {
      const grp = c.grupo || 'General';
      (gruposG[grp] = gruposG[grp] || []).push(c.categoria);
    }
  });

  for (const grp in gruposG) {
    const og = document.createElement('optgroup'); og.label = grp;
    gruposG[grp].forEach(cat => {
      const o = document.createElement('option'); o.value = cat; o.textContent = cat; og.appendChild(o);
    });
    if(selGasto) selGasto.appendChild(og);
  }

  cacheDatos.configuracion.filter(c => c.tipo === 'Ingreso' || c.tipo === 'ingreso').forEach(c => {
    const o = document.createElement('option'); o.value = c.categoria; o.textContent = c.categoria;
    if(selIng) selIng.appendChild(o);
  });

  let totalIngresos = cacheDatos.ingresos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  let totalGastos = cacheDatos.gastos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  let saldoHist = totalIngresos - totalGastos;

  if(document.getElementById('saldoDisponible')) document.getElementById('saldoDisponible').innerText = S(saldoHist);
  if(document.getElementById('sbSaldo')) document.getElementById('sbSaldo').innerText = S(saldoHist);
  if(document.getElementById('sbIngresos')) document.getElementById('sbIngresos').innerText = totalIngresos.toFixed(2);
  if(document.getElementById('sbGastos')) document.getElementById('sbGastos').innerText = totalGastos.toFixed(2);

  const statsResp = { 'Jhonathan': { in: 0, out: 0 }, 'Sindy': { in: 0, out: 0 } };
  cacheDatos.ingresos.forEach(i => {
    const resp = i.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].in += Number(i.monto) || 0;
  });
  cacheDatos.gastos.forEach(g => {
    const resp = g.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].out += Number(g.monto) || 0;
  });

  if(document.getElementById('jhoIngresos')) document.getElementById('jhoIngresos').innerText = S(statsResp['Jhonathan'].in);
  if(document.getElementById('jhoGastos')) document.getElementById('jhoGastos').innerText = S(statsResp['Jhonathan'].out);
  if(document.getElementById('jhoSaldo')) document.getElementById('jhoSaldo').innerText = S(statsResp['Jhonathan'].in - statsResp['Jhonathan'].out);
  if(document.getElementById('sinIngresos')) document.getElementById('sinIngresos').innerText = S(statsResp['Sindy'].in);
  if(document.getElementById('sinGastos')) document.getElementById('sinGastos').innerText = S(statsResp['Sindy'].out);
  if(document.getElementById('sinSaldo')) document.getElementById('sinSaldo').innerText = S(statsResp['Sindy'].in - statsResp['Sindy'].out);

  let movimientos = [];
  cacheDatos.ingresos.forEach(i => movimientos.push({ id: i.id, tipo: 'Ingreso', fecha: i.fecha, categoria: i.categoria, monto: Number(i.monto)||0, responsable: i.responsable||'Jhonathan', detalle: i.comentario||'' }));
  cacheDatos.gastos.forEach(g => movimientos.push({ id: g.id, tipo: 'Gasto', fecha: g.fecha, categoria: g.categoria, monto: Number(g.monto)||0, responsable: g.responsable||'Jhonathan', detalle: g.descripcion||'' }));

  const panelMov = document.getElementById('panelMovimientos');
  if(panelMov) {
    panelMov.innerHTML = '';
    movimientos.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'') || b.id - a.id);

    movimientos.slice(0, 30).forEach(m => {
      const ing = m.tipo === 'Ingreso';
      panelMov.innerHTML += `
        <div class="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center ${ing ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0 text-xs font-bold">
            <i class="fa-solid ${ing ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-slate-800 truncate">${esc(m.categoria)}</p>
            <p class="text-[10px] text-slate-400 truncate">${esc(m.fecha ? m.fecha.substring(0,10) : '')} · ${esc(m.responsable)}</p>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold block ${ing ? 'text-emerald-600' : 'text-slate-800'}">${ing ? '+' : '−'}${S(m.monto)}</span>
          </div>
        </div>`;
    });
  }

  renderConfiguracion();
  renderFondos();
}

function renderFondos() {
  const dashView = document.getElementById('viewDash');
  if(!dashView) return;

  let contenedor = document.getElementById('panelFondosCreditos');
  if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.id = 'panelFondosCreditos';
      contenedor.className = 'mb-4 w-full';
      const header = document.getElementById('headerDashUsuario');
      if(header && header.nextSibling) dashView.insertBefore(contenedor, header.nextSibling);
      else dashView.appendChild(contenedor);
  }

  const configCreditos = [
      { titulo: 'BCP Crédito', clave: 'bcp', nombreCat: 'bcp crédito' },
      { titulo: 'BBVA Crédito', clave: 'bbva_credito', nombreCat: 'bbva crédito' },
      { titulo: 'BBVA Tarjeta', clave: 'bbva_tarjeta', nombreCat: 'bbva tarjeta' }
  ];

  let html = '<h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">Resumen de Créditos</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';

  configCreditos.forEach(cred => {
      const cuotas = (cacheDatos[cred.clave] || {}).data || [];
      let cuotasPendientes = cuotas.filter(c => {
          const pag = (c.pagado || c.estado || '').toString().toLowerCase().trim();
          return pag !== 'pagado' && pag !== 'si' && pag !== 'sí' && pag !== 'true' && pag !== '1' && c.pagado !== true && pag !== 'fondo';
      });

      cuotasPendientes.sort((a, b) => (a.proximo_vencimiento||a.fecha||'9999').localeCompare(b.proximo_vencimiento||b.fecha||'9999'));

      const prox = cuotasPendientes[0];
      const montoProxVal = prox ? Number(prox.monto || prox.cuota || 0) : 0;
      const rawFecha = prox ? (prox.proximo_vencimiento || prox.vencimiento || prox.fecha || '') : '';

      html += `
        <div class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-slate-800">${esc(cred.titulo)}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${cuotasPendientes.length} pendientes</span>
          </div>
          ${prox ? `
            <div class="flex justify-between items-end text-xs">
              <span class="text-[10px] text-slate-400 font-medium">Próx: ${rawFecha.substring(0, 10)}</span>
              <span class="font-bold text-slate-900">${S(montoProxVal)}</span>
            </div>
          ` : `<p class="text-[11px] text-emerald-600 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>Al día</p>`}
        </div>`;
  });

  html += '</div>';
  contenedor.innerHTML = html;
}

window.cargarModuloCreditosDetallado = async function() {
  const contenedor = document.getElementById('viewDeudas');
  if(!contenedor) return;

  const configCreditos = [
      { titulo: 'BCP Crédito', clave: 'bcp' },
      { titulo: 'BBVA Crédito', clave: 'bbva_credito' },
      { titulo: 'BBVA Tarjeta', clave: 'bbva_tarjeta' }
  ];

  let html = `<div class="space-y-4">`;

  configCreditos.forEach(cred => {
      let cuotas = [...((cacheDatos[cred.clave] || {}).data || [])];
      cuotas.sort((a, b) => (a.proximo_vencimiento||a.fecha||'9999').localeCompare(b.proximo_vencimiento||b.fecha||'9999'));

      let totalCuotas = cuotas.length, pagadasCount = 0;
      let capPag = 0, intPag = 0, segPag = 0;
      let capPen = 0, intPen = 0, segPen = 0;

      cuotas.forEach(c => {
          const pag = (c.pagado || c.estado || '').toString().toLowerCase().trim();
          const esPagado = pag === 'pagado' || pag === 'si' || pag === 'sí' || pag === 'true' || pag === '1' || c.pagado === true || pag === 'fondo';
          const cap = Number(c.capital || c.amortizacion || 0);
          const inte = Number(c.interes || 0);
          const segu = Number(c.seguro_desgravamen || c.seguro || 0);

          if (esPagado) { pagadasCount++; capPag += cap; intPag += inte; segPag += segu; }
          else { capPen += cap; intPen += inte; segPen += segu; }
      });

      const porcAvance = totalCuotas > 0 ? (pagadasCount / totalCuotas) * 100 : 0;

      html += `
        <div class="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800">${esc(cred.titulo)}</h3>
            <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">${pagadasCount}/${totalCuotas} cuotas</span>
          </div>

          <div class="w-full bg-slate-100 rounded-full h-1.5">
            <div class="bg-emerald-500 h-1.5 rounded-full transition-all" style="width:${porcAvance}%"></div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-100">
              <span class="block font-bold text-emerald-800 mb-1">Pagado</span>
              <div class="text-slate-600 space-y-0.5">
                <div class="flex justify-between"><span>Cap:</span><span class="font-semibold">${S(capPag)}</span></div>
                <div class="flex justify-between"><span>Int:</span><span class="font-semibold">${S(intPag)}</span></div>
                <div class="flex justify-between"><span>Seg:</span><span class="font-semibold">${S(segPag)}</span></div>
              </div>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60">
              <span class="block font-bold text-slate-800 mb-1">Pendiente</span>
              <div class="text-slate-600 space-y-0.5">
                <div class="flex justify-between"><span>Cap:</span><span class="font-semibold">${S(capPen)}</span></div>
                <div class="flex justify-between"><span>Int:</span><span class="font-semibold">${S(intPen)}</span></div>
                <div class="flex justify-between"><span>Seg:</span><span class="font-semibold">${S(segPen)}</span></div>
              </div>
            </div>
          </div>

          <details class="group rounded-xl bg-slate-50 p-2">
            <summary class="flex justify-between items-center text-xs font-bold text-slate-700 cursor-pointer">
              <span>Cronograma (${totalCuotas})</span>
              <i class="fa-solid fa-chevron-down text-[10px] group-open:rotate-180 transition-transform"></i>
            </summary>
            <div class="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">`;

      cuotas.forEach((c, idx) => {
          const pag = (c.pagado || c.estado || '').toString().toLowerCase().trim();
          const esPagado = pag === 'pagado' || pag === 'si' || pag === 'sí' || pag === 'true' || pag === '1' || c.pagado === true || pag === 'fondo';
          const montoCuota = Number(c.monto || c.cuota || 0);
          const fechaCuota = c.proximo_vencimiento || c.vencimiento || c.fecha || '';

          html += `
            <div class="bg-white p-2 rounded-xl border border-slate-200/60 flex justify-between items-center text-[11px]">
              <div>
                <span class="font-bold text-slate-800">#${idx + 1}</span>
                <span class="text-slate-400 text-[10px] ml-1.5">${fechaCuota.substring(0, 10)}</span>
              </div>
              <div class="text-right">
                <span class="font-bold block">${S(montoCuota)}</span>
                <span class="text-[9px] font-bold ${esPagado ? 'text-emerald-600' : 'text-amber-600'}">${esPagado ? 'Pagado' : 'Pendiente'}</span>
              </div>
            </div>`;
      });

      html += `</div></details></div>`;
  });

  html += `</div>`;
  contenedor.innerHTML = html;
}

/* REGISTRO DE GASTOS E INGRESOS */
window.enviarGasto = async function(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('btnGuardarGasto');
  if(btn) { btn.innerText = 'Registrando...'; btn.disabled = true; }

  try {
    const monto = parseFloat(document.getElementById('montoGasto')?.value || 0);
    if(monto <= 0) throw new Error("Monto inválido");

    const payload = {
      fecha: document.getElementById('fechaGasto')?.value || iso(new Date()),
      categoria: document.getElementById('categoriaGasto')?.value || 'Gasto',
      monto: monto,
      responsable: usuarioActual || 'Jhonathan',
      descripcion: document.getElementById('descripcionGasto')?.value || ''
    };

    const { error } = await supabase.from('gastos').insert([payload]);
    if (error) throw error;
    
    if(btn) { btn.innerText = 'Registrar Salida'; btn.disabled = false; }
    document.getElementById('formGasto')?.reset();
    toast('Gasto guardado con éxito', true);
    cargarDashboard();
  } catch(err) {
    if(btn) { btn.innerText = 'Registrar Salida'; btn.disabled = false; }
    toast(err.message, false);
  }
}

window.enviarIngreso = async function(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('btnGuardarIngreso');
  if(btn) { btn.innerText = 'Registrando...'; btn.disabled = true; }

  try {
    const monto = parseFloat(document.getElementById('montoIngreso')?.value || 0);
    if(monto <= 0) throw new Error("Monto inválido");

    const payload = {
      fecha: document.getElementById('fechaIngreso')?.value || iso(new Date()),
      categoria: document.getElementById('categoriaIngreso')?.value || 'Ingreso',
      monto: monto,
      responsable: usuarioActual || 'Jhonathan',
      comentario: document.getElementById('comentarioIngreso')?.value || ''
    };

    const { error } = await supabase.from('ingresos').insert([payload]);
    if (error) throw error;
    
    if(btn) { btn.innerText = 'Registrar Entrada'; btn.disabled = false; }
    document.getElementById('formIngreso')?.reset();
    toast('Ingreso guardado con éxito', true);
    cargarDashboard();
  } catch(err) {
    if(btn) { btn.innerText = 'Registrar Entrada'; btn.disabled = false; }
    toast(err.message, false);
  }
}

function renderConfiguracion() {
  const cont = document.getElementById('contenedorGrupos');
  if(!cont) return;
  cont.innerHTML = '';

  const grupos = {};
  cacheDatos.configuracion.forEach(c => {
    const grp = c.grupo || 'General';
    if(c.tipo === 'Gasto' || c.tipo === 'gasto') (grupos[grp] = grupos[grp] || []).push(c);
  });

  let html = '<h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categorías</h3><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  for(let grp in grupos) {
    html += `<div class="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
      <p class="text-xs font-bold text-slate-800 mb-1.5">${esc(grp)}</p>
      <div class="space-y-1">`;
    grupos[grp].forEach(c => {
      html += `<div class="flex justify-between text-[11px] border-b border-slate-50 pb-0.5"><span class="text-slate-700">${esc(c.categoria)}</span><span class="text-slate-400">${S(c.presupuesto)}</span></div>`;
    });
    html += `</div></div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
}

verificarAutenticacion();
