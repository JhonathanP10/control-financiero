import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvsepnwkkcibzskuapsz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2Vwbndra2NpYnpza3VhcHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MDc0MTAsImV4cCI6MjEwNjQ4MzQxMH0.pDg6hJTFl7MnuadztS_cmZLgKk9rydvmlHtEfhT25H0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let periodo = { preset: 'mes', offset: 0, desde: null, hasta: null };
let cacheDatos = { 
  gastos: [], ingresos: [], configuracion: [], deudas: [], 
  bcp: {tabla:'bcp_credito', data:[]}, 
  bbva_credito: {tabla:'bbva_credito', data:[]}, 
  bbva_tarjeta: {tabla:'bbva_tarjeta', data:[]} 
};

const S = n => 'S/ ' + (Number(n) || 0).toFixed(2);
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const iso = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const dm = d => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);

function toast(msg, ok) {
  const t = document.getElementById('toast');
  if(!t) { alert(msg); return; } 
  t.className = 'fixed bottom-24 lg:bottom-8 right-4 z-50 max-w-xs rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ' + (ok === false ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white');
  t.innerText = msg;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 4000);
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

async function fetchSafe(t1, t2) {
  let { data, error } = await supabase.from(t1).select('*').limit(5000);
  if (!error && data) return { tabla: t1, data: data.map(normalizar) };
  if (t2) {
    let res2 = await supabase.from(t2).select('*').limit(5000);
    if (!res2.error && res2.data) return { tabla: t2, data: res2.data.map(normalizar) };
  }
  return { tabla: t1, data: [] };
}

/* Vistas */
function mostrarVista(vista) {
  const mapa = { dash: 'viewDash', registro: 'viewRegistro', deudas: 'viewDeudas', config: 'viewConfig' };
  Object.keys(mapa).forEach(v => {
    const el = document.getElementById(mapa[v]);
    if(el) el.classList.toggle('hidden', v !== vista);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    const activo = b.dataset.vista === vista;
    b.classList.toggle('activo', activo);
  });
  const titulos = { dash: 'Panel', registro: 'Registrar', deudas: 'Salir de deudas', config: 'Categorías' };
  const titMovil = document.getElementById('tituloVistaMovil');
  if(titMovil) titMovil.innerText = titulos[vista];
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (vista === 'deudas') cargarPlanDeudas();
  if (vista === 'registro') setTimeout(() => {
      const g = document.getElementById('montoGasto');
      if(g) g.focus();
  }, 250);
}
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));

/* Periodo */
function calcularRango() {
  const hoy = new Date(), o = periodo.offset;
  let desde, hasta, etiqueta;
  if (periodo.preset === 'dia') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + o); hasta = new Date(desde);
    etiqueta = o === 0 ? 'Hoy' : (o === -1 ? 'Ayer' : desde.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }));
  } else if (periodo.preset === 'semana') {
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + o * 7);
    const ds = (base.getDay() + 6) % 7;
    desde = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ds);
    hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 6);
    etiqueta = (o === 0 ? 'Esta semana · ' : '') + dm(desde) + ' – ' + dm(hasta);
  } else if (periodo.preset === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() + o, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth() + o + 1, 0);
    etiqueta = desde.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  } else if (periodo.preset === 'anio') {
    desde = new Date(hoy.getFullYear() + o, 0, 1); hasta = new Date(hoy.getFullYear() + o, 11, 31);
    etiqueta = 'Año ' + (hoy.getFullYear() + o);
  } else if (periodo.preset === 'todo') {
    desde = new Date(2000, 0, 1); hasta = new Date(hoy.getFullYear() + 5, 11, 31); etiqueta = 'Todo el historial';
  } else {
    desde = periodo.desde ? new Date(periodo.desde + 'T00:00:00') : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    hasta = periodo.hasta ? new Date(periodo.hasta + 'T00:00:00') : hoy;
    etiqueta = dm(desde) + '/' + desde.getFullYear() + ' – ' + dm(hasta) + '/' + hasta.getFullYear();
  }
  return { desde: iso(desde), hasta: iso(hasta), etiqueta: etiqueta };
}

function pintarChips() {
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('activo', b.dataset.preset === periodo.preset));
  const fijo = periodo.preset === 'rango' || periodo.preset === 'todo';
  ['btnAnterior', 'btnSiguiente'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.disabled = fijo; el.classList.toggle('opacity-30', fijo); }
  });
  const rp = document.getElementById('rangoPersonalizado');
  if(rp) rp.classList.toggle('hidden', periodo.preset !== 'rango');
}

document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  periodo.preset = b.dataset.preset; periodo.offset = 0; pintarChips();
  if (periodo.preset === 'rango') {
    const hoy = new Date();
    if (!document.getElementById('fDesde').value) document.getElementById('fDesde').valueAsDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    if (!document.getElementById('fHasta').value) document.getElementById('fHasta').valueAsDate = hoy;
    return;
  }
  cargarDashboard();
}));

window.moverPeriodo = function(p) { if (periodo.preset === 'rango' || periodo.preset === 'todo') return; periodo.offset += p; cargarDashboard(); }
window.aplicarRango = function() {
  const d = document.getElementById('fDesde').value, h = document.getElementById('fHasta').value;
  if (!d || !h) { toast('Elige las dos fechas', false); return; }
  periodo.desde = d; periodo.hasta = h; cargarDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();
  if(document.getElementById('fechaIngreso')) document.getElementById('fechaIngreso').valueAsDate = hoy;
  if(document.getElementById('fechaGasto')) document.getElementById('fechaGasto').valueAsDate = hoy;
  if(document.getElementById('pagoFecha')) document.getElementById('pagoFecha').valueAsDate = hoy;
  pintarChips();
  cargarDashboard();
});

window.cargarDashboard = async function() {
  try {
    const [resG, resI, resC, resD] = await Promise.all([
      supabase.from('gastos').select('*').limit(100000).order('id', { ascending: false }),
      supabase.from('ingresos').select('*').limit(100000).order('id', { ascending: false }),
      supabase.from('configuracion').select('*').limit(5000),
      supabase.from('deudas').select('*').limit(5000)
    ]);

    if (resG.error) throw resG.error;

    cacheDatos.gastos = (resG.data || []).map(normalizar);
    cacheDatos.ingresos = (resI.data || []).map(normalizar);
    cacheDatos.configuracion = (resC.data || []).map(normalizar);
    cacheDatos.deudas = (resD.data || []).map(normalizar);

    cacheDatos.bcp = await fetchSafe('bcp_credito', 'bcp');
    cacheDatos.bbva_credito = await fetchSafe('bbva_credito', 'bbvacredito');
    cacheDatos.bbva_tarjeta = await fetchSafe('bbva_tarjeta', 'bbvatarjeta');

    procesarYRenderizarDashboard();
  } catch (err) {
    console.error(err);
    toast('Error cargando datos de Supabase. Revisa la consola.', false);
  }
}

function procesarYRenderizarDashboard() {
  const filtro = calcularRango();
  const etiq = document.getElementById('etiquetaPeriodo');
  if(etiq) etiq.innerText = filtro.etiqueta;

  const selGasto = document.getElementById('categoriaGasto');
  const selIng = document.getElementById('categoriaIngreso');
  const selDeudaCat = document.getElementById('deudaCategoria');
  
  if(selGasto) selGasto.innerHTML = '';
  if(selIng) selIng.innerHTML = '';
  if(selDeudaCat) selDeudaCat.innerHTML = '<option value="">(usar nombre de la deuda)</option>';

  const gruposG = {};
  cacheDatos.configuracion.forEach(c => {
    if (c.tipo === 'Gasto' || c.tipo === 'gasto') {
      const grp = c.grupo || 'Sin grupo';
      (gruposG[grp] = gruposG[grp] || []).push(c.categoria);
    }
  });

  for (const grp in gruposG) {
    const og = document.createElement('optgroup'); og.label = grp;
    const og2 = document.createElement('optgroup'); og2.label = grp;
    gruposG[grp].forEach(cat => {
      const o = document.createElement('option'); o.value = cat; o.textContent = cat; og.appendChild(o);
      const o2 = document.createElement('option'); o2.value = cat; o2.textContent = cat; og2.appendChild(o2);
    });
    if(selGasto) selGasto.appendChild(og);
    if(selDeudaCat) selDeudaCat.appendChild(og2);
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
  if(document.getElementById('sbSaldoMovil')) document.getElementById('sbSaldoMovil').innerText = S(saldoHist);
  if(document.getElementById('sbIngresos')) document.getElementById('sbIngresos').innerText = totalIngresos.toFixed(2);
  if(document.getElementById('sbGastos')) document.getElementById('sbGastos').innerText = totalGastos.toFixed(2);

  const statsResp = { 'Jhonathan': { in: 0, out: 0, perIn: 0 }, 'Sindy': { in: 0, out: 0, perIn: 0 } };
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

  const fDesdeStr = filtro.desde;
  const fHastaStr = filtro.hasta;

  let ingresosPeriodo = 0, gastosPeriodo = 0;
  let gastosPorCat = {}, gastosPorGrupo = {}, ingresosPorCat = {};
  let movimientos = [];

  cacheDatos.ingresos.forEach(i => {
    const fStr = i.fecha ? i.fecha.substring(0, 10) : '';
    const m = Number(i.monto) || 0;
    const resp = i.responsable || 'Jhonathan';
    
    if (fStr >= fDesdeStr && fStr <= fHastaStr) {
      ingresosPeriodo += m;
      if(statsResp[resp]) statsResp[resp].perIn += m;
      ingresosPorCat[i.categoria] = (ingresosPorCat[i.categoria] || 0) + m;
    }
    movimientos.push({ id: i.id, tipo: 'Ingreso', fecha: i.fecha, categoria: i.categoria, monto: m, responsable: resp, detalle: i.comentario || i.descripcion || '' });
  });

  const grupoDeCat = {};
  cacheDatos.configuracion.forEach(c => { if(c.tipo === 'Gasto' || c.tipo === 'gasto') grupoDeCat[c.categoria] = c.grupo || 'Sin grupo'; });

  cacheDatos.gastos.forEach(g => {
    const fStr = g.fecha ? g.fecha.substring(0, 10) : '';
    const m = Number(g.monto) || 0;
    const resp = g.responsable || 'Jhonathan';
    
    if (fStr >= fDesdeStr && fStr <= fHastaStr) {
      gastosPeriodo += m;
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + m;
      const grp = grupoDeCat[g.categoria] || 'Sin grupo';
      gastosPorGrupo[grp] = (gastosPorGrupo[grp] || 0) + m;
    }
    movimientos.push({ id: g.id, tipo: 'Gasto', fecha: g.fecha, categoria: g.categoria, monto: m, responsable: resp, detalle: g.descripcion || '' });
  });

  if(document.getElementById('periodoJhoIn')) document.getElementById('periodoJhoIn').innerText = 'Jho: ' + S(statsResp['Jhonathan'].perIn);
  if(document.getElementById('periodoSinIn')) document.getElementById('periodoSinIn').innerText = 'Sin: ' + S(statsResp['Sindy'].perIn);
  if(document.getElementById('nombrePeriodo')) document.getElementById('nombrePeriodo').innerText = filtro.etiqueta;
  if(document.getElementById('periodoIngresos')) document.getElementById('periodoIngresos').innerText = S(ingresosPeriodo);
  if(document.getElementById('periodoGastos')) document.getElementById('periodoGastos').innerText = S(gastosPeriodo);
  if(document.getElementById('periodoTasaAhorro')) document.getElementById('periodoTasaAhorro').innerText = ingresosPeriodo > 0 ? ('Guardas el ' + ((ingresosPeriodo - gastosPeriodo)/ingresosPeriodo * 100).toFixed(0) + '%') : '';
  
  const resPer = ingresosPeriodo - gastosPeriodo;
  const elRes = document.getElementById('periodoResultado');
  if(elRes) {
    elRes.innerText = (resPer >= 0 ? 'Te quedan ' : 'Vas sobre-gastado ') + S(Math.abs(resPer));
    elRes.className = 'text-[11px] mt-1 ' + (resPer >= 0 ? 'text-emerald-600' : 'text-rose-600');
  }

  let totalTopeGlobal = 0, totalGastadoGlobal = 0;
  const panelPres = document.getElementById('panelPresupuestos');
  if(panelPres) {
    panelPres.innerHTML = '';
    cacheDatos.configuracion.filter(c => (c.tipo === 'Gasto' || c.tipo === 'gasto') && Number(c.presupuesto) > 0).forEach(c => {
      const tope = Number(c.presupuesto);
      const gastado = gastosPorCat[c.categoria] || 0;
      totalTopeGlobal += tope; totalGastadoGlobal += gastado;
      const porc = tope > 0 ? (gastado / tope) * 100 : 0;
      const color = porc > 100 ? 'bg-rose-500' : (porc > 75 ? 'bg-amber-500' : 'bg-sky-500');
      
      panelPres.innerHTML += `<div>
        <div class="flex justify-between items-end mb-1"><span class="text-xs font-semibold text-slate-600">${esc(c.categoria)}</span><span class="text-[10px] text-slate-400">${S(gastado)} / ${S(tope)}</span></div>
        <div class="w-full bg-slate-100 rounded-full h-1"><div class="${color} h-1 rounded-full" style="width:${Math.min(porc, 100)}%"></div></div>
      </div>`;
    });
  }

  if(document.getElementById('totalPresupuestos')) document.getElementById('totalPresupuestos').innerText = S(totalGastadoGlobal) + ' / ' + S(totalTopeGlobal);
  const barraPres = document.getElementById('barraTotalPresupuestos');
  const porcGlobal = totalTopeGlobal > 0 ? (totalGastadoGlobal / totalTopeGlobal) * 100 : 0;
  if(barraPres) barraPres.style.width = Math.min(porcGlobal, 100) + '%';

  const panelGrp = document.getElementById('panelGrupos');
  if(panelGrp) {
    panelGrp.innerHTML = '';
    const arrGrp = Object.keys(gastosPorGrupo).map(g => ({ grupo: g, monto: gastosPorGrupo[g] })).sort((a,b) => b.monto - a.monto);
    const maxG = arrGrp[0]?.monto || 1;
    arrGrp.forEach(g => {
      panelGrp.innerHTML += `<div><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700">${esc(g.grupo)}</span><span class="text-slate-500">${S(g.monto)}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-slate-800 h-2 rounded-full" style="width:${(g.monto/maxG)*100}%"></div></div></div>`;
    });
  }

  const panelIngCat = document.getElementById('panelIngresosCat');
  if(panelIngCat) {
    panelIngCat.innerHTML = '';
    const arrIng = Object.keys(ingresosPorCat).map(c => ({ cat: c, monto: ingresosPorCat[c] })).sort((a,b) => b.monto - a.monto);
    const maxI = arrIng[0]?.monto || 1;
    arrIng.forEach(i => {
      panelIngCat.innerHTML += `<div><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700">${esc(i.cat)}</span><span class="text-slate-500">${S(i.monto)}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width:${(i.monto/maxI)*100}%"></div></div></div>`;
    });
  }

  const panelMov = document.getElementById('panelMovimientos');
  if(panelMov) {
    panelMov.innerHTML = '';
    
    movimientos.sort((a,b) => {
      const fA = a.fecha ? a.fecha.substring(0,10) : '';
      const fB = b.fecha ? b.fecha.substring(0,10) : '';
      if (fA === fB) return b.id - a.id;
      return fB > fA ? 1 : -1;
    });

    movimientos.slice(0, 50).forEach(m => {
      const ing = m.tipo === 'Ingreso';
      panelMov.innerHTML += `<div class="flex items-center gap-3 py-3">
        <div class="w-9 h-9 rounded-full flex items-center justify-center ${ing ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0"><i class="fa-solid ${ing ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">${esc(m.categoria)}</p>
          <p class="text-[11px] text-slate-500 truncate">${esc(m.fecha ? m.fecha.substring(0,10) : '')} · ${esc(m.responsable)}${m.detalle ? ' · ' + esc(m.detalle) : ''}</p>
        </div>
        <div class="text-right">
          <span class="text-sm font-bold block ${ing ? 'text-emerald-600' : 'text-slate-800'}">${ing ? '+' : '−'}${S(m.monto)}</span>
          <div class="flex justify-end gap-2 mt-1">
            <button class="w-7 h-7 rounded flex items-center justify-center bg-slate-50 text-slate-400 hover:text-sky-600" onclick="editarMov(${m.id}, '${m.tipo}')"><i class="fa-solid fa-pen text-[10px]"></i></button>
            <button class="w-7 h-7 rounded flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-600" onclick="eliminarMov(${m.id}, '${m.tipo}')"><i class="fa-solid fa-trash text-[10px]"></i></button>
          </div>
        </div>
      </div>`;
    });
  }

  if(document.getElementById('cargandoAlertas')) document.getElementById('cargandoAlertas').style.display = 'none';
  renderConfiguracion();
  renderFondos();
}

// Módulo de Fondos y Autopago adaptado a "BCP Crédito", "BBVA Crédito" y columna "proximo_vencimiento"
function renderFondos() {
  const dashView = document.getElementById('viewDash');
  if(!dashView) return;

  let contenedor = document.getElementById('panelFondosCreditos');
  if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.id = 'panelFondosCreditos';
      contenedor.className = 'mb-6 mt-6 w-full';
      
      const pagosPendientesEl = Array.from(document.querySelectorAll('div, h2, h3')).find(el => el.textContent.trim() === 'Pagos pendientes');
      if (pagosPendientesEl) {
          let targetBox = pagosPendientesEl.closest('div.bg-white') || pagosPendientesEl.parentElement.parentElement;
          if(targetBox && targetBox.parentElement) {
              targetBox.parentElement.replaceChild(contenedor, targetBox);
          } else {
              dashView.prepend(contenedor);
          }
      } else {
          dashView.prepend(contenedor);
      }
  }
  
  const hoyIso = iso(new Date());

  const configCreditos = [
      { titulo: 'BCP CRÉDITO', clave: 'bcp', nombreCat: 'bcp crédito' },
      { titulo: 'BBVA CRÉDITO', clave: 'bbva_credito', nombreCat: 'bbva crédito' },
      { titulo: 'BBVA TARJETA', clave: 'bbva_tarjeta', nombreCat: 'bbva tarjeta' }
  ];

  let html = '<h3 class="text-sm font-bold text-slate-700 mb-3">Pagos pendientes</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

  configCreditos.forEach(cred => {
      const datosObj = cacheDatos[cred.clave] || {tabla:'', data:[]};
      const cuotas = datosObj.data || [];
      const tablaBd = datosObj.tabla;
      
      // 1. Sumar los gastos que coincidan exactamente con la categoría (ej: "BCP Crédito")
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

      // 2. Ordenar cuotas pendientes usando proximo_vencimiento
      cuotasPendientes.sort((a, b) => {
          const fA = a.proximo_vencimiento || a.vencimiento || a.fecha || '9999-12-31';
          const fB = b.proximo_vencimiento || b.vencimiento || b.fecha || '9999-12-31';
          return fA > fB ? 1 : -1;
      });

      // 3. Motor de Autopago
      for (let c of cuotasPendientes) {
          const fVenc = c.proximo_vencimiento || c.vencimiento || c.fecha || '';
          const montoCuota = Number(c.monto || c.cuota || 0);

          if (fVenc && fVenc <= hoyIso && fondoDisponible >= montoCuota && montoCuota > 0) {
              if (tablaBd) {
                  supabase.from(tablaBd).update({ pagado: 'Fondo' }).eq('id', c.id).catch(() => {});
              }
              fondoDisponible -= montoCuota;
              c.pagado = 'Fondo'; 
          }
      }

      cuotasPendientes = cuotasPendientes.filter(c => c.pagado !== 'Fondo');

      const prox = cuotasPendientes[0];
      const montoProxVal = prox ? Number(prox.monto || prox.cuota || 0) : 0;
      const proxMonto = S(montoProxVal);
      
      let rawFecha = prox ? (prox.proximo_vencimiento || prox.vencimiento || prox.fecha || '') : '';
      const proxFecha = rawFecha ? rawFecha.substring(0, 10) : 'Sin fecha';
      
      const porc = (montoProxVal > 0) ? Math.min(100, (fondoDisponible / montoProxVal) * 100) : 100;
      const color = porc >= 100 ? 'bg-emerald-500' : 'bg-sky-500';

      html += `<div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <div class="flex justify-between items-start mb-4">
              <p class="text-sm font-bold text-slate-800">${esc(cred.titulo)}</p>
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fondo Actual</span>
                <span class="text-sm font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">${S(fondoDisponible)}</span>
              </div>
          </div>
          ${prox ? `
              <div class="text-xs text-slate-600 flex justify-between mb-1.5"><span class="font-medium"><i class="fa-regular fa-calendar mr-1"></i> Vence: ${proxFecha}</span> <span class="font-bold text-slate-800">${proxMonto}</span></div>
              <div class="w-full bg-slate-200 rounded-full h-2 mb-1.5"><div class="${color} h-2 rounded-full transition-all" style="width:${porc}%"></div></div>
              <p class="text-[10px] text-slate-400 text-right font-medium">${porc.toFixed(0)}% de la cuota cubierto</p>
          ` : `<div class="mt-4 text-center p-2 bg-emerald-50 rounded-xl border border-emerald-100"><p class="text-xs text-emerald-600 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>¡Todas las cuotas al día!</p></div>`}
      </div>`;
  });

  html += '</div>';
  contenedor.innerHTML = html;
}

// ---------------------------------------------------------------------------------
// REGISTRO DE GASTOS E INGRESOS TOTALMENTE AISLADOS Y SEGUROS
// ---------------------------------------------------------------------------------

window.enviarGasto = async function(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('btnGuardarGasto');
  if(btn) { btn.innerText = 'Registrando...'; btn.disabled = true; }

  try {
    const monto = parseFloat(document.getElementById('montoGasto')?.value || 0) || 0;
    if(monto <= 0) throw new Error("Debes ingresar un monto válido mayor a cero.");

    const payload = {
      fecha: document.getElementById('fechaGasto')?.value || iso(new Date()),
      categoria: document.getElementById('categoriaGasto')?.value || 'Gasto',
      monto: monto,
      metodo_de_pago: 'App Web'
    };

    const resp = document.getElementById('responsableGasto')?.value;
    if(resp) payload.responsable = resp;

    const det = document.getElementById('descripcionGasto')?.value;
    if(det) payload.descripcion = det; 

    const { error } = await supabase.from('gastos').insert([payload]);
    if (error) throw error;
    
    if(btn) { btn.innerText = 'Registrar salida'; btn.disabled = false; }
    document.getElementById('formGasto')?.reset();
    if(document.getElementById('fechaGasto')) document.getElementById('fechaGasto').valueAsDate = new Date();
    toast('Gasto registrado con éxito', true);
    cargarDashboard();

  } catch(err) {
    if(btn) { btn.innerText = 'Registrar salida'; btn.disabled = false; }
    toast('ERROR GASTO: ' + err.message, false);
  }
}

window.enviarIngreso = async function(e) {
  if(e) e.preventDefault();
  const btn = document.getElementById('btnGuardarIngreso');
  if(btn) { btn.innerText = 'Registrando...'; btn.disabled = true; }

  try {
    const monto = parseFloat(document.getElementById('montoIngreso')?.value || 0) || 0;
    if(monto <= 0) throw new Error("Debes ingresar un monto válido mayor a cero.");

    // Estructura limpia y directa para la tabla ingresos
    const payload = {
      fecha: document.getElementById('fechaIngreso')?.value || iso(new Date()),
      categoria: document.getElementById('categoriaIngreso')?.value || 'Ingreso',
      monto: monto
    };

    const resp = document.getElementById('responsableIngreso')?.value;
    if(resp) payload.responsable = resp;

    const com = document.getElementById('comentarioIngreso')?.value;
    if(com) payload.comentario = com;

    let res = await supabase.from('ingresos').insert([payload]);

    if (res.error) {
        // Fallback ultra seguro si alguna columna adicional no existe en la tabla de Supabase
        res = await supabase.from('ingresos').insert([{
            fecha: payload.fecha,
            categoria: payload.categoria,
            monto: payload.monto
        }]);
    }

    if (res.error) throw res.error;
    
    if(btn) { btn.innerText = 'Registrar entrada'; btn.disabled = false; }
    document.getElementById('formIngreso')?.reset();
    if(document.getElementById('fechaIngreso')) document.getElementById('fechaIngreso').valueAsDate = new Date();
    toast('Ingreso registrado con éxito', true);
    cargarDashboard();

  } catch(err) {
    if(btn) { btn.innerText = 'Registrar entrada'; btn.disabled = false; }
    toast('ERROR INGRESOS: ' + err.message, false);
  }
}

window.eliminarMov = async function(id, tipo) {
  if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
  const tabla = tipo === 'Gasto' ? 'gastos' : 'ingresos';
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) toast('Error al eliminar: ' + error.message, false);
  else { toast('Eliminado correctamente', true); cargarDashboard(); }
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

window.cargarPlanDeudas = async function() {
  const deudas = cacheDatos.deudas;
  const vacio = document.getElementById('deudasVacio');
  const bloque = document.getElementById('bloquePlan');
  if(vacio) vacio.classList.toggle('hidden', deudas.length > 0);
  if(bloque) bloque.classList.toggle('hidden', deudas.length === 0);

  if (!deudas.length) return;

  const totalSaldo = deudas.reduce((s, d) => s + (Number(d.saldo_actual || d.saldo) || 0), 0);
  const totalMinimos = deudas.reduce((s, d) => s + (Number(d.pago_minimo || d.minimo) || 0), 0);
  const interesMensual = deudas.reduce((s, d) => s + (Number(d.saldo_actual || d.saldo) * ((Number(d.tasa_anual || d.tasa) / 100) / 12)), 0);

  if(document.getElementById('dTotal')) document.getElementById('dTotal').innerText = S(totalSaldo);
  if(document.getElementById('dMinimos')) document.getElementById('dMinimos').innerText = S(totalMinimos);
  if(document.getElementById('dInteres')) document.getElementById('dInteres').innerText = S(interesMensual);
  if(document.getElementById('dExcedente')) document.getElementById('dExcedente').innerText = S(0);

  const lista = document.getElementById('listaDeudas');
  if(lista) {
    lista.innerHTML = '';
    deudas.forEach(d => {
      const saldo = Number(d.saldo_actual || d.saldo) || 0;
      const inicial = Number(d.saldo_inicial || d.inicial) || saldo;
      const avance = inicial > 0 ? Math.min(100, Math.max(0, (1 - saldo / inicial) * 100)) : 0;
      lista.innerHTML += `<div class="border border-slate-100 rounded-2xl p-4">
        <p class="text-sm font-bold text-slate-800">${esc(d.nombre)}</p>
        <p class="text-[11px] text-slate-500">${Number(d.tasa_anual || d.tasa || 0).toFixed(1)}% anual · mínimo ${S(d.pago_minimo || d.minimo)}</p>
        <div class="flex justify-between text-xs my-1"><span class="font-bold text-slate-800">${S(saldo)}</span><span>${avance.toFixed(0)}% liquidado</span></div>
        <div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width:${avance}%"></div></div>
      </div>`;
    });
  }
}

window.guardarDeuda = async function(e) {
  if(e) e.preventDefault();
  const getE = i => document.getElementById(i);
  const payload = {
    nombre: getE('deudaNombre')?.value || 'Nueva Deuda',
    saldo_actual: parseFloat(getE('deudaSaldo')?.value || 0),
    tasa_anual: parseFloat(getE('deudaTasa')?.value || 0) || 0,
    pago_minimo: parseFloat(getE('deudaMinimo')?.value || 0),
    dia_pago: parseInt(getE('deudaDia')?.value || 15) || 15,
    categoria_gasto: getE('deudaCategoria')?.value || null,
    saldo_inicial: parseFloat(getE('deudaSaldo')?.value || 0)
  };

  const { error } = await supabase.from('deudas').insert([payload]);
  if (error) toast('Error al guardar deuda: ' + error.message, false);
  else {
    document.getElementById('formDeuda')?.reset();
    toast('Deuda guardada', true);
    cargarDashboard();
  }
}

function renderConfiguracion() {
  const cont = document.getElementById('contenedorGrupos');
  if(!cont) return;
  cont.innerHTML = '';

  const grupos = {};
  cacheDatos.configuracion.forEach(c => {
    const grp = c.grupo || 'Sin grupo';
    if(c.tipo === 'Gasto' || c.tipo === 'gasto') (grupos[grp] = grupos[grp] || []).push(c);
  });

  let html = '<h3 class="text-sm font-bold text-slate-700 mb-3">Categorías de Gasto</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
  for(let grp in grupos) {
    html += `<div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
      <p class="text-sm font-bold text-slate-800 mb-2">${esc(grp)}</p>
      <div class="space-y-2">`;
    grupos[grp].forEach(c => {
      html += `<div class="flex justify-between text-xs border-b border-slate-50 pb-1"><span>${esc(c.categoria)}</span><span class="text-slate-400">Presupuesto: ${S(c.presupuesto)}</span></div>`;
    });
    html += `</div></div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
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
  if(error) toast('Error: ' + error.message, false);
  else {
    document.getElementById('formCategoria')?.reset();
    toast('Categoría guardada', true);
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

cargarDashboard();
