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

// Formateadores rápidos
const S = n => 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const iso = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const dm = d => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);

// Función global para establecer el día de "hoy" forzando la zona horaria local (Perú)
window.setFechaHoy = function(id) {
  const d = new Date();
  const el = document.getElementById(id);
  if (el) el.value = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
};

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

/* REGISTRO DE SERVICE WORKER PARA APP MÓVIL (PWA) */
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
  if(!nueva || nueva.length < 3) { toast('Ingresa una clave válida', false); return; }

  try {
    const { error } = await supabase.from('usuarios').update({ clave: nueva }).eq('usuario', usu);
    if(error) throw error;
    toast('Clave actualizada correctamente', true);
    usuarioActual = usu;
    localStorage.setItem('usuario_app', usu);
    verificarAutenticacion();
  } catch(err) { toast('Error: ' + err.message, false); }
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
    if(el) el.classList.toggle('hidden', v !== vista);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    const activo = b.dataset.vista === vista || (vista === 'creditos' && b.dataset.vista === 'deudas');
    b.classList.toggle('activo', activo);
  });
  const titulos = { dash: 'Panel General', registro: 'Nuevo Registro', creditos: 'Créditos Pendientes', config: 'Ajustes' };
  const titMovil = document.getElementById('tituloVistaMovil');
  if(titMovil) titMovil.innerText = titulos[vista];
  
  if (vista === 'registro') {
    const hoy = new Date();
    const fG = document.getElementById('fechaGasto');
    const fI = document.getElementById('fechaIngreso');
    if (fG && (!fG.value || fG.value === '')) fG.value = iso(hoy);
    if (fI && (!fI.value || fI.value === '')) fI.value = iso(hoy);
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (vista === 'creditos') cargarModuloCreditosDetallado();
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
      btn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white shadow-sm text-slate-800 transition-all";
    } else {
      btn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 transition-all";
    }
  });

  if (fg && fi) {
    fg.classList.toggle('hidden', esIngreso);
    fi.classList.toggle('hidden', !esIngreso);
  }
};

/* PERIODO DE TIEMPO Y FILTROS */
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
  } else if (periodo.preset === 'rango') {
    desde = periodo.desde ? new Date(periodo.desde + 'T00:00:00') : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    hasta = periodo.hasta ? new Date(periodo.hasta + 'T00:00:00') : hoy;
    etiqueta = dm(desde) + ' – ' + dm(hasta);
  } else {
    desde = new Date(2000, 0, 1); hasta = new Date(hoy.getFullYear() + 5, 11, 31); etiqueta = 'Historial';
  }
  return { desde: iso(desde), hasta: iso(hasta), etiqueta: etiqueta };
}

function pintarChips() {
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('activo', b.dataset.preset === periodo.preset));
  
  const rp = document.getElementById('rangoPersonalizado');
  if(rp) rp.classList.toggle('hidden', periodo.preset !== 'rango');
  
  const fijo = periodo.preset === 'rango' || periodo.preset === 'todo';
  ['btnAnterior', 'btnSiguiente'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.disabled = fijo; el.classList.toggle('opacity-30', fijo); }
  });
}

function asociarBotonesPeriodo() {
  document.querySelectorAll('[data-preset]').forEach(b => {
    b.removeEventListener('click', b._listener);
    b._listener = () => {
        periodo.preset = b.dataset.preset; 
        periodo.offset = 0; 
        pintarChips(); 
        
        if (periodo.preset === 'rango') {
            const hoy = new Date();
            // Corregido valueAsDate por format ISO para evitar saltos UTC
            if (!document.getElementById('fDesde').value) document.getElementById('fDesde').value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
            if (!document.getElementById('fHasta').value) document.getElementById('fHasta').value = iso(hoy);
            return;
        }
        cargarDashboard();
    };
    b.addEventListener('click', b._listener);
  });
}

window.moverPeriodo = function(p) { if(periodo.preset==='rango') return; periodo.offset += p; cargarDashboard(); }

window.aplicarRango = function() {
  const d = document.getElementById('fDesde').value;
  const h = document.getElementById('fHasta').value;
  if (!d || !h) { toast('Elige ambas fechas', false); return; }
  periodo.desde = d; periodo.hasta = h;
  cargarDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();
  
  ['fechaGasto', 'fechaIngreso'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.value = iso(hoy); // Corregido valueAsDate
      const label = input.previousElementSibling;
      if (label && label.tagName === 'LABEL' && !label.querySelector('.btn-hoy')) {
        label.innerHTML += ` <button type="button" onclick="window.setFechaHoy('${id}')" class="btn-hoy text-sky-500 hover:text-sky-600 font-bold ml-1 text-[10px] lowercase tracking-normal">(hoy)</button>`;
      }
    }
  });

  const chipContainer = document.querySelector('[data-preset="dia"]')?.parentElement;
  if (chipContainer && !document.querySelector('[data-preset="rango"]')) {
      const btnRango = document.createElement('button');
      btnRango.dataset.preset = 'rango';
      btnRango.className = 'chip px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex-shrink-0 transition-colors';
      btnRango.innerText = 'Rango';
      chipContainer.insertBefore(btnRango, document.getElementById('etiquetaPeriodo'));
  }

  const headerBox = chipContainer?.parentElement;
  if (headerBox && !document.getElementById('rangoPersonalizado')) {
      const rp = document.createElement('div');
      rp.id = 'rangoPersonalizado';
      rp.className = 'hidden mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3 animate-fade-in';
      rp.innerHTML = `
        <div><label class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Desde</label><input type="date" id="fDesde" class="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700"></div>
        <div><label class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Hasta</label><input type="date" id="fHasta" class="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700"></div>
        <button onclick="window.aplicarRango()" class="bg-sky-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-transform flex-shrink-0">Aplicar</button>
      `;
      headerBox.appendChild(rp);
  }

  asociarBotonesPeriodo();
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

    cacheDatos.bcp = await fetchSafe('bcp_credito', 'bcp', 'bcpcredito');
    cacheDatos.bbva_credito = await fetchSafe('bbva_credito', 'bbvacredito', 'bbva');
    cacheDatos.bbva_tarjeta = await fetchSafe('bbva_tarjeta', 'bbvatarjeta', 'tarjeta_bbva');

    procesarYRenderizarDashboard();
  } catch (err) {
    toast('Error al sincronizar datos. Verifica tu conexión.', false);
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
    <button onclick="window.cerrarSesion()" class="bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 border border-rose-100">
      <i class="fa-solid fa-right-from-bracket"></i> <span class="hidden sm:inline">Salir</span>
    </button>`;
}

/* LÓGICA PRINCIPAL DEL DASHBOARD Y FILTROS */
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
  const grupoDeCat = {};
  cacheDatos.configuracion.forEach(c => {
    if (c.tipo === 'Gasto' || c.tipo === 'gasto') {
      const grp = c.grupo || 'General';
      (gruposG[grp] = gruposG[grp] || []).push(c.categoria);
      grupoDeCat[c.categoria] = grp;
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

  // 1. CALCULOS GLOBALES HISTÓRICOS
  let totalIngresos = 0, totalGastos = 0;
  const statsResp = { 'Jhonathan': { in: 0, out: 0 }, 'Sindy': { in: 0, out: 0 } };

  cacheDatos.ingresos.forEach(i => {
    const m = Number(i.monto) || 0;
    totalIngresos += m;
    const resp = i.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].in += m;
  });

  cacheDatos.gastos.forEach(g => {
    const m = Number(g.monto) || 0;
    totalGastos += m;
    const resp = g.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].out += m;
  });

  let saldoHist = totalIngresos - totalGastos;
  let saldoMiUsuario = 0;
  if (usuarioActual && statsResp[usuarioActual]) {
      saldoMiUsuario = statsResp[usuarioActual].in - statsResp[usuarioActual].out;
  }

  if(document.getElementById('saldoDisponible')) document.getElementById('saldoDisponible').innerText = S(saldoHist);
  
  // Ajuste para el Saldo del header superior (Mostrar saldo del usuario y no el global)
  if(document.getElementById('sbSaldo')) document.getElementById('sbSaldo').innerText = S(saldoMiUsuario);
  
  if(document.getElementById('sbSaldoMovil')) {
      const elMovil = document.getElementById('sbSaldoMovil');
      elMovil.innerText = S(saldoMiUsuario);
      
      // Cambiar la etiqueta superior a "MI SALDO"
      if (elMovil.previousElementSibling) {
          elMovil.previousElementSibling.innerText = 'MI SALDO';
      }

      // Ajuste visual para evitar que el header se vea cortado en el celular
      const headerTop = elMovil.closest('header') || elMovil.parentElement.parentElement;
      if (headerTop) {
          headerTop.style.paddingTop = 'max(1rem, env(safe-area-inset-top))';
          headerTop.style.paddingBottom = '0.75rem';
          headerTop.style.display = 'flex';
          headerTop.style.alignItems = 'center';
      }
  }

  if(document.getElementById('sbIngresos')) document.getElementById('sbIngresos').innerText = totalIngresos.toLocaleString('es-PE', { minimumFractionDigits: 2 });
  if(document.getElementById('sbGastos')) document.getElementById('sbGastos').innerText = totalGastos.toLocaleString('es-PE', { minimumFractionDigits: 2 });

  if(document.getElementById('jhoSaldo')) document.getElementById('jhoSaldo').innerText = S(statsResp['Jhonathan'].in - statsResp['Jhonathan'].out);
  if(document.getElementById('sinSaldo')) document.getElementById('sinSaldo').innerText = S(statsResp['Sindy'].in - statsResp['Sindy'].out);

  // 2. CÁLCULOS DEL PERIODO FILTRADO
  const fDesdeStr = filtro.desde;
  const fHastaStr = filtro.hasta;

  let ingresosPeriodo = 0, gastosPeriodo = 0;
  let gastosPorCat = {}, gastosPorGrupo = {};
  let ingresosPorRespCat = { 'Jhonathan': {}, 'Sindy': {} };
  let ingresosPorResp = { 'Jhonathan': 0, 'Sindy': 0 };
  let movimientos = [];

  cacheDatos.ingresos.forEach(i => {
    const fStr = i.fecha ? i.fecha.substring(0, 10) : '';
    const m = Number(i.monto) || 0;
    const resp = i.responsable || 'Jhonathan';
    const cat = i.categoria || 'Otros';
    
    if (fStr >= fDesdeStr && fStr <= fHastaStr) {
      ingresosPeriodo += m;
      if(ingresosPorResp[resp] !== undefined) ingresosPorResp[resp] += m;
      const targetUser = ingresosPorRespCat[resp] ? resp : 'Jhonathan';
      ingresosPorRespCat[targetUser][cat] = (ingresosPorRespCat[targetUser][cat] || 0) + m;
    }
    movimientos.push({ id: i.id, tipo: 'Ingreso', fecha: i.fecha, categoria: i.categoria, monto: m, responsable: resp, detalle: i.comentario || i.descripcion || '' });
  });

  cacheDatos.gastos.forEach(g => {
    const fStr = g.fecha ? g.fecha.substring(0, 10) : '';
    const m = Number(g.monto) || 0;
    const resp = g.responsable || 'Jhonathan';
    
    if (fStr >= fDesdeStr && fStr <= fHastaStr) {
      gastosPeriodo += m;
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + m;
      
      const grp = grupoDeCat[g.categoria] || 'General';
      
      if (!gastosPorGrupo[grp]) gastosPorGrupo[grp] = { total: 0, subcats: {} };
      gastosPorGrupo[grp].total += m;
      gastosPorGrupo[grp].subcats[g.categoria] = (gastosPorGrupo[grp].subcats[g.categoria] || 0) + m;
    }
    movimientos.push({ id: g.id, tipo: 'Gasto', fecha: g.fecha, categoria: g.categoria, monto: m, responsable: resp, detalle: g.descripcion || '' });
  });

  if(document.getElementById('periodoIngresos')) document.getElementById('periodoIngresos').innerText = S(ingresosPeriodo);
  if(document.getElementById('periodoGastos')) document.getElementById('periodoGastos').innerText = S(gastosPeriodo);
  if(document.getElementById('periodoJhoIn')) document.getElementById('periodoJhoIn').innerText = 'Jho: ' + S(ingresosPorResp['Jhonathan'] || 0);
  if(document.getElementById('periodoSinIn')) document.getElementById('periodoSinIn').innerText = 'Sin: ' + S(ingresosPorResp['Sindy'] || 0);

  const resPer = ingresosPeriodo - gastosPeriodo;
  const elRes = document.getElementById('periodoResultado');
  if(elRes) {
    elRes.innerText = (resPer >= 0 ? 'Te quedan ' : 'Vas sobre-gastado ') + S(Math.abs(resPer));
    elRes.className = 'text-[10px] mt-1 font-bold ' + (resPer >= 0 ? 'text-emerald-600' : 'text-rose-600');
  }

  // 3. INYECCIÓN DEL DETALLE DE INGRESOS
  let oldPanel = document.getElementById('panelIngresosCat');
  if (oldPanel && oldPanel.closest('.mt-4') && !oldPanel.closest('.min-h-[140px]')) {
      oldPanel.parentElement.remove();
  }

  let panelIngCat = document.getElementById('panelIngresosCat');
  if (!panelIngCat) {
      const cardIngresos = document.getElementById('periodoIngresos')?.closest('.bg-white');
      if(cardIngresos && cardIngresos.parentElement) {
          const gridContainer = cardIngresos.parentElement;
          
          gridContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4';
          
          const cardSaldo = document.getElementById('saldoDisponible')?.closest('.bg-slate-900');
          if (cardSaldo) cardSaldo.className = 'bg-slate-900 rounded-3xl p-5 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden flex flex-col justify-between sm:col-span-2 lg:col-span-1 min-h-[140px]';

          const newBox = document.createElement('div');
          newBox.className = 'bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col min-h-[140px] animate-fade-in';
          newBox.innerHTML = `
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Ingresos por Categoría</p>
            <div id="panelIngresosCat" class="flex flex-col gap-1.5 overflow-y-auto scroll-fino pr-1 flex-1"></div>
          `;
          
          gridContainer.insertBefore(newBox, cardIngresos);
          panelIngCat = document.getElementById('panelIngresosCat');
      }
  }

  if (panelIngCat) {
      panelIngCat.innerHTML = '';
      ['Jhonathan', 'Sindy'].forEach(resp => {
          const catsUser = ingresosPorRespCat[resp] || {};
          const arrIngUser = Object.keys(catsUser).map(c => ({ cat: c, monto: catsUser[c] })).sort((a,b) => b.monto - a.monto);

          if(arrIngUser.length > 0) {
              panelIngCat.innerHTML += `<div class="mb-1 mt-1"><p class="text-[9px] font-bold text-slate-500 uppercase tracking-wider"><i class="fa-solid fa-user mr-1 text-emerald-500"></i>${resp} (${S(ingresosPorResp[resp])})</p></div>`;
              const maxI = arrIngUser[0]?.monto || 1;
              arrIngUser.forEach(i => {
                  panelIngCat.innerHTML += `
                  <div class="mb-1.5 pl-2 border-l-2 border-emerald-200">
                    <div class="flex justify-between items-center text-[10px] mb-0.5">
                      <span class="font-bold text-slate-700 truncate pr-1">${esc(i.cat)}</span>
                      <span class="text-slate-500 font-medium">${S(i.monto)}</span>
                    </div>
                    <div class="w-full bg-slate-50 rounded-full h-1">
                      <div class="bg-emerald-400 h-1 rounded-full transition-all" style="width:${(i.monto/maxI)*100}%"></div>
                    </div>
                  </div>`;
              });
          }
      });
      if(panelIngCat.innerHTML === '') panelIngCat.innerHTML = '<p class="text-[10px] text-slate-400 py-2">No hay ingresos registrados en este rango de fechas.</p>';
  }

  // 4. RENDERIZAR PRESUPUESTOS Y BARRAS
  let totalTopeGlobal = 0, totalGastadoGlobal = 0;
  const panelPres = document.getElementById('panelPresupuestos');
  if(panelPres) {
    panelPres.innerHTML = '';
    cacheDatos.configuracion.filter(c => (c.tipo === 'Gasto' || c.tipo === 'gasto') && Number(c.presupuesto) > 0).forEach(c => {
      const tope = Number(c.presupuesto);
      const gastado = gastosPorCat[c.categoria] || 0;
      totalTopeGlobal += tope; 
      totalGastadoGlobal += gastado;
      const porc = tope > 0 ? (gastado / tope) * 100 : 0;
      const color = porc > 100 ? 'bg-rose-500' : (porc > 75 ? 'bg-amber-500' : 'bg-sky-500');
      
      panelPres.innerHTML += `<div>
        <div class="flex justify-between items-end mb-1">
          <span class="text-[11px] font-bold text-slate-700">${esc(c.categoria)}</span>
          <span class="text-[10px] text-slate-500 font-medium">${S(gastado)} / ${S(tope)}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5"><div class="${color} h-1.5 rounded-full transition-all" style="width:${Math.min(porc, 100)}%"></div></div>
      </div>`;
    });
    if(panelPres.innerHTML === '') panelPres.innerHTML = '<p class="text-xs text-slate-400">No hay presupuestos definidos.</p>';
  }

  if(document.getElementById('totalPresupuestos')) {
      document.getElementById('totalPresupuestos').innerText = totalGastadoGlobal.toLocaleString('es-PE', {minimumFractionDigits:2}) + ' / ' + totalTopeGlobal.toLocaleString('es-PE', {minimumFractionDigits:2});
  }
  const barraPres = document.getElementById('barraTotalPresupuestos');
  const porcGlobal = totalTopeGlobal > 0 ? (totalGastadoGlobal / totalTopeGlobal) * 100 : 0;
  if(barraPres) {
      barraPres.style.width = Math.min(porcGlobal, 100) + '%';
      barraPres.className = porcGlobal > 100 ? 'bg-rose-500 h-1.5 rounded-full transition-all' : (porcGlobal > 75 ? 'bg-amber-500 h-1.5 rounded-full transition-all' : 'bg-sky-500 h-1.5 rounded-full transition-all');
  }

  // 5. RENDERIZAR GASTOS POR GRUPO CON DESPLEGABLES DE SUBCATEGORÍA
  const panelGrp = document.getElementById('panelGrupos');
  if(panelGrp) {
    panelGrp.innerHTML = '';
    const arrGrp = Object.keys(gastosPorGrupo).map(g => ({ grupo: g, ...gastosPorGrupo[g] })).sort((a,b) => b.total - a.total);
    const maxG = arrGrp[0]?.total || 1;
    
    if (arrGrp.length === 0 || (arrGrp.length === 1 && arrGrp[0].total === 0)) {
        panelGrp.innerHTML = '<p class="text-[11px] text-slate-400">No hay gastos en este periodo.</p>';
    } else {
        arrGrp.forEach(g => {
          if (g.total > 0) {
              let subHtml = '';
              const subs = Object.keys(g.subcats).map(k => ({cat: k, monto: g.subcats[k]})).sort((a,b) => b.monto - a.monto);
              subs.forEach(s => {
                  if (s.monto > 0) {
                      subHtml += `<div class="flex justify-between items-center text-[10px] text-slate-500 py-1"><span class="truncate pr-2 pl-1 border-l-2 border-slate-200 ml-1.5">${esc(s.cat)}</span><span class="font-bold">${S(s.monto)}</span></div>`;
                  }
              });

              panelGrp.innerHTML += `
              <details class="group rounded-xl bg-slate-50 p-2.5 mb-2 border border-slate-100 hover:border-slate-200 transition-colors">
                  <summary class="flex flex-col cursor-pointer list-none outline-none select-none">
                      <div class="flex justify-between items-center text-[11px] mb-1.5">
                          <span class="font-bold text-slate-700 flex items-center gap-1.5"><i class="fa-solid fa-chevron-right text-[9px] text-slate-400 group-open:rotate-90 transition-transform"></i> ${esc(g.grupo)}</span>
                          <span class="text-slate-600 font-bold">${S(g.total)}</span>
                      </div>
                      <div class="w-full bg-slate-200 rounded-full h-1.5">
                          <div class="bg-slate-800 h-1.5 rounded-full transition-all" style="width:${(g.total/maxG)*100}%"></div>
                      </div>
                  </summary>
                  <div class="mt-2 space-y-0.5">
                      ${subHtml}
                  </div>
              </details>`;
          }
        });
    }
  }

  // 6. RENDERIZAR MOVIMIENTOS
  const panelMov = document.getElementById('panelMovimientos');
  if(panelMov) {
    panelMov.innerHTML = '';
    movimientos.sort((a,b) => {
      const fA = a.fecha ? a.fecha.substring(0,10) : '';
      const fB = b.fecha ? b.fecha.substring(0,10) : '';
      if (fA === fB) return b.id - a.id;
      return fB > fA ? 1 : -1;
    });

    if (movimientos.length === 0) {
        panelMov.innerHTML = '<p class="text-[11px] text-slate-400 py-2">No hay movimientos registrados en este rango.</p>';
    } else {
        movimientos.slice(0, 40).forEach(m => {
          const ing = m.tipo === 'Ingreso';
          panelMov.innerHTML += `
            <div class="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors group" onclick="editarMov(${m.id}, '${m.tipo}')">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center ${ing ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0 text-xs font-bold shadow-sm border border-${ing ? 'emerald' : 'rose'}-100">
                <i class="fa-solid ${ing ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-bold text-slate-800 truncate leading-tight">${esc(m.categoria)}</p>
                <p class="text-[9px] text-slate-400 truncate mt-0.5">${esc(m.fecha ? m.fecha.substring(0,10) : '')} · ${esc(m.responsable)} ${m.detalle ? '· '+esc(m.detalle) : ''}</p>
              </div>
              <div class="text-right flex flex-col justify-center items-end gap-1">
                <span class="text-[11px] font-bold block ${ing ? 'text-emerald-600' : 'text-slate-800'}">${ing ? '+' : '−'}${S(m.monto)}</span>
                <span class="text-[9px] font-bold text-slate-400 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200"><i class="fa-solid fa-pen"></i> Editar</span>
              </div>
            </div>`;
        });
    }
  }

  renderConfiguracion();
  renderFondos();
}

/* RENDER DE FONDOS Y CRÉDITOS */
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

  const hoyIso = iso(new Date());
  const configCreditos = [
      { titulo: 'BCP Crédito', clave: 'bcp', nombreCat: 'bcp crédito' },
      { titulo: 'BBVA Crédito', clave: 'bbva_credito', nombreCat: 'bbva crédito' },
      { titulo: 'BBVA Tarjeta', clave: 'bbva_tarjeta', nombreCat: 'bbva tarjeta' }
  ];

  let html = '<h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1 mt-4">Resumen de Créditos</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';

  configCreditos.forEach(cred => {
      const datosObj = cacheDatos[cred.clave] || {tabla:'', data:[]};
      const cuotas = datosObj.data || [];
      const tablaBd = datosObj.tabla;
      
      let fondoTotal = 0;
      cacheDatos.gastos.forEach(g => {
          const catGasto = (g.categoria || '').toLowerCase().trim();
          const catBuscada = cred.nombreCat.toLowerCase().trim();
          if (catGasto === catBuscada) {
              fondoTotal += (Number(g.monto) || 0);
          }
      });

      let fondoUsado = 0;
      let cuotasPendientes = [];
      
      cuotas.forEach(c => {
          const pag = (c.pagado || c.estado || '').toString().toLowerCase().trim();
          const montoCuota = Number(c.monto || c.cuota || 0);
          
          if (pag === 'fondo') {
              fondoUsado += montoCuota; 
          } else if (pag !== 'pagado' && pag !== 'si' && pag !== 'sí' && pag !== 'true' && pag !== '1' && c.pagado !== true) {
              cuotasPendientes.push(c);
          }
      });

      let fondoDisponible = Math.max(0, fondoTotal - fondoUsado);

      cuotasPendientes.sort((a, b) => {
          const fA = a.proximo_vencimiento || a.vencimiento || a.fecha || '9999-12-31';
          const fB = b.proximo_vencimiento || b.vencimiento || b.fecha || '9999-12-31';
          return fA > fB ? 1 : -1;
      });

      for (let c of cuotasPendientes) {
          const fVenc = c.proximo_vencimiento || c.vencimiento || c.fecha || '';
          const montoCuota = Number(c.monto || c.cuota || 0);

          if (fVenc && fVenc <= hoyIso && fondoDisponible >= montoCuota && montoCuota > 0) {
              if (tablaBd) { supabase.from(tablaBd).update({ pagado: 'Fondo' }).eq('id', c.id).then(); }
              fondoDisponible -= montoCuota;
              c.pagado = 'Fondo'; 
          }
      }

      cuotasPendientes = cuotasPendientes.filter(c => c.pagado !== 'Fondo');

      const prox = cuotasPendientes[0];
      const montoProxVal = prox ? Number(prox.monto || prox.cuota || 0) : 0;
      const rawFecha = prox ? (prox.proximo_vencimiento || prox.vencimiento || prox.fecha || '') : '';
      const porc = (montoProxVal > 0) ? Math.min(100, (fondoDisponible / montoProxVal) * 100) : 100;
      const color = porc >= 100 ? 'bg-emerald-500' : 'bg-sky-500';

      html += `
        <div class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-slate-800">${esc(cred.titulo)}</span>
            <span class="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">${S(fondoDisponible)} abono</span>
          </div>
          ${prox ? `
            <div class="flex justify-between items-end text-[11px] mb-1">
              <span class="text-[10px] text-slate-500 font-medium">Vence: ${rawFecha.substring(0, 10)}</span>
              <span class="font-bold text-slate-900">${S(montoProxVal)}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1"><div class="${color} h-1 rounded-full transition-all" style="width:${porc}%"></div></div>
          ` : `<div class="mt-2 text-center py-1 bg-emerald-50 rounded-lg border border-emerald-100"><p class="text-[10px] text-emerald-600 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>Cuotas al día</p></div>`}
        </div>`;
  });

  html += '</div>';
  contenedor.innerHTML = html;
}

window.cargarModuloCreditosDetallado = async function() {
  const contenedor = document.getElementById('viewDeudas');
  if(!contenedor) return;

  const configCreditos = [
      { titulo: 'BCP Crédito', clave: 'bcp', nombreCat: 'bcp crédito' },
      { titulo: 'BBVA Crédito', clave: 'bbva_credito', nombreCat: 'bbva crédito' },
      { titulo: 'BBVA Tarjeta', clave: 'bbva_tarjeta', nombreCat: 'bbva tarjeta' }
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
      responsable: document.getElementById('responsableGasto')?.value || usuarioActual || 'Jhonathan',
      descripcion: document.getElementById('descripcionGasto')?.value || ''
    };

    const { error } = await supabase.from('gastos').insert([payload]);
    if (error) throw error;
    
    if(btn) { btn.innerText = 'Guardar Salida'; btn.disabled = false; }
    document.getElementById('formGasto')?.reset();
    toast('Gasto guardado con éxito', true);
    cargarDashboard();
  } catch(err) {
    if(btn) { btn.innerText = 'Guardar Salida'; btn.disabled = false; }
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
      responsable: document.getElementById('responsableIngreso')?.value || usuarioActual || 'Jhonathan',
      comentario: document.getElementById('comentarioIngreso')?.value || ''
    };

    const { error } = await supabase.from('ingresos').insert([payload]);
    if (error) throw error;
    
    if(btn) { btn.innerText = 'Guardar Entrada'; btn.disabled = false; }
    document.getElementById('formIngreso')?.reset();
    toast('Ingreso guardado con éxito', true);
    cargarDashboard();
  } catch(err) {
    if(btn) { btn.innerText = 'Guardar Entrada'; btn.disabled = false; }
    toast(err.message, false);
  }
}

/* EDICIÓN Y ELIMINACIÓN REFORZADA (AHORA CON BOTÓN ROJO DE BORRAR) */
window.eliminarMov = async function(id, tipo) {
  if (!confirm('¿Seguro que deseas eliminar este registro permanentemente?')) return;
  const tabla = tipo === 'Gasto' ? 'gastos' : 'ingresos';
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) toast('Error al eliminar: ' + error.message, false);
  else { toast('Eliminado correctamente', true); cargarDashboard(); cerrarModalEdicion(); }
}

window.editarMov = function(id, tipo) {
  const lista = tipo === 'Gasto' ? cacheDatos.gastos : cacheDatos.ingresos;
  const item = lista.find(x => x.id === id);
  if (!item) return;

  const getE = i => document.getElementById(i);
  if(getE('editMovId')) getE('editMovId').value = item.id;
  if(getE('editMovTipo')) getE('editMovTipo').value = tipo;
  if(getE('editMovMonto')) getE('editMovMonto').value = item.monto;
  if(getE('editMovFecha')) getE('editMovFecha').value = item.fecha ? item.fecha.substring(0, 10) : '';
  if(getE('editMovResponsable')) getE('editMovResponsable').value = item.responsable || 'Jhonathan';
  if(getE('editMovDetalle')) getE('editMovDetalle').value = item.descripcion || item.comentario || '';

  const selCat = getE('editMovCategoria');
  if(selCat) {
      selCat.innerHTML = getE(tipo === 'Gasto' ? 'categoriaGasto' : 'categoriaIngreso').innerHTML;
      selCat.value = item.categoria;
  }

  let form = getE('formEdicionMov');
  let btnDel = getE('btnEliminarMov');
  if(form && !btnDel) {
      btnDel = document.createElement('button');
      btnDel.id = 'btnEliminarMov';
      btnDel.type = 'button';
      btnDel.className = 'w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3.5 rounded-xl mt-2 transition-all text-xs border border-rose-100 flex items-center justify-center gap-2';
      btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar Permanentemente';
      form.appendChild(btnDel);
  }
  if(btnDel) btnDel.onclick = () => window.eliminarMov(item.id, tipo);

  const modal = getE('modalEdicionMovimiento');
  if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

window.cerrarModalEdicion = function() {
  const modal = document.getElementById('modalEdicionMovimiento');
  if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

window.enviarEdicionMovimiento = async function(e) {
  if(e) e.preventDefault();
  try {
      const getE = i => document.getElementById(i);
      const id = getE('editMovId')?.value;
      const tipo = getE('editMovTipo')?.value || 'Gasto';
      const tabla = tipo === 'Gasto' ? 'gastos' : 'ingresos';

      const payload = {
        monto: parseFloat(getE('editMovMonto')?.value || 0),
        fecha: getE('editMovFecha')?.value,
        categoria: getE('editMovCategoria')?.value
      };

      if(getE('editMovResponsable')) payload.responsable = getE('editMovResponsable').value;
      
      const det = getE('editMovDetalle');
      if(det) {
          if (tipo === 'Gasto') payload.descripcion = det.value;
          else payload.comentario = det.value;
      }

      const { error } = await supabase.from(tabla).update(payload).eq('id', id);
      if (error) throw error;
      
      toast('Actualizado correctamente', true);
      cerrarModalEdicion();
      cargarDashboard();
  } catch (err) {
      toast('Error al actualizar: ' + err.message, false);
  }
}

/* EDICIÓN DE CATEGORÍAS */
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
      // AQUÍ INYECTAMOS EL BOTÓN DE LÁPIZ PARA EDITAR
      html += `
      <div class="flex justify-between items-center text-[11px] border-b border-slate-50 pb-1 pt-1 group">
        <span class="text-slate-700 font-bold">${esc(c.categoria)}</span>
        <div class="flex items-center gap-2">
            <span class="text-slate-400 font-medium">Tope: ${S(c.presupuesto)}</span>
            <button onclick="window.abrirModalEdicionCategoria(${c.id})" class="text-sky-500 hover:text-sky-600 transition-colors p-1" title="Editar Categoría">
                <i class="fa-solid fa-pen"></i>
            </button>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
}

window.abrirModalEdicionCategoria = function(id) {
    const cat = cacheDatos.configuracion.find(c => c.id === id);
    if (!cat) return;
    
    let modal = document.getElementById('modalEditCat');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalEditCat';
        modal.className = 'fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
    <div class="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl animate-fade-in border border-slate-200">
        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center"><i class="fa-solid fa-layer-group"></i></div>
            Editar Categoría
        </h3>
        <input type="hidden" id="editCatId" value="${cat.id}">
        <input type="hidden" id="editCatViejo" value="${esc(cat.categoria)}">
        <input type="hidden" id="editCatTipo" value="${esc(cat.tipo)}">
        
        <div class="space-y-3">
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre de Subcategoría</label>
                <input type="text" id="editCatNombre" value="${esc(cat.categoria)}" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-sky-500">
            </div>
            
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo Principal</label>
                <input type="text" id="editCatGrupo" value="${esc(cat.grupo || '')}" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-sky-500" ${cat.tipo.toLowerCase() === 'ingreso' ? 'disabled' : ''}>
            </div>
            
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tope / Presupuesto</label>
                <input type="number" id="editCatTope" value="${cat.presupuesto || 0}" step="0.01" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-sky-500">
            </div>
        </div>
        
        <div class="flex gap-2 mt-5">
            <button onclick="document.getElementById('modalEditCat').classList.add('hidden')" class="flex-1 bg-slate-100 active:scale-95 text-slate-600 font-bold py-3 rounded-xl text-xs transition-all">Cancelar</button>
            <button onclick="window.guardarEdicionCategoria()" class="flex-1 bg-sky-500 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-sky-500/30 transition-all">Guardar Cambios</button>
        </div>
    </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.guardarEdicionCategoria = async function() {
    const id = document.getElementById('editCatId').value;
    const viejoNombre = document.getElementById('editCatViejo').value;
    const tipo = document.getElementById('editCatTipo').value;
    const nuevoNombre = document.getElementById('editCatNombre').value.trim();
    const nuevoGrupo = document.getElementById('editCatGrupo').value.trim();
    const nuevoTope = parseFloat(document.getElementById('editCatTope').value) || 0;
    
    if (!nuevoNombre) { toast('El nombre no puede estar vacío', false); return; }
    
    try {
        const btn = document.querySelector('#modalEditCat button.bg-sky-500');
        if(btn) { btn.innerText = 'Guardando...'; btn.disabled = true; }

        // 1. Actualizar la base de configuracion
        const { error: errConf } = await supabase.from('configuracion').update({
            categoria: nuevoNombre,
            grupo: tipo.toLowerCase() === 'gasto' ? nuevoGrupo : null,
            presupuesto: nuevoTope
        }).eq('id', id);
        if (errConf) throw errConf;
        
        // 2. Actualizar gastos o ingresos históricos para que no queden huérfanos
        if (nuevoNombre !== viejoNombre) {
            const tabla = tipo.toLowerCase() === 'gasto' ? 'gastos' : 'ingresos';
            const { error: errHis } = await supabase.from(tabla).update({ categoria: nuevoNombre }).eq('categoria', viejoNombre);
            if (errHis) throw errHis;
        }
        
        toast('Categoría y registros actualizados', true);
        document.getElementById('modalEditCat').classList.add('hidden');
        cargarDashboard(); // Recarga toda la interfaz para aplicar los cambios inmediatamente
    } catch(e) {
        toast('Error: ' + e.message, false);
        const btn = document.querySelector('#modalEditCat button.bg-sky-500');
        if(btn) { btn.innerText = 'Guardar Cambios'; btn.disabled = false; }
    }
}

window.guardarCategoria = async function(e) {
  if(e) e.preventDefault();
  const getE = i => document.getElementById(i);
  const payload = {
    tipo: getE('confTipo')?.value || 'Gasto',
    grupo: getE('confGrupo')?.value || null,
    categoria: getE('confCategoria')?.value || 'Nueva',
    presupuesto: parseFloat(getE('confPresupuesto')?.value || 0) || 0
  };

  const { error } = await supabase.from('configuracion').insert([payload]);
  if(error) toast('Error al crear categoría', false);
  else {
    getE('formCategoria')?.reset();
    toast('Categoría creada exitosamente', true);
    cargarDashboard();
  }
}

window.togglePorTipo = function() {
  const confTipo = document.getElementById('confTipo');
  if(!confTipo) return;
  const esIngreso = confTipo.value === 'Ingreso';
  if(document.getElementById('divConfGrupo')) document.getElementById('divConfGrupo').style.display = esIngreso ? 'none' : 'block';
  if(document.getElementById('divConfPresupuesto')) document.getElementById('divConfPresupuesto').style.display = esIngreso ? 'none' : 'block';
}

verificarAutenticacion();
