import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvsepnwkkcibzskuapsz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2Vwbndra2NpYnpza3VhcHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MDc0MTAsImV4cCI6MjEwNjQ4MzQxMH0.pDg6hJTFl7MnuadztS_cmZLgKk9rydvmlHtEfhT25H0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let periodo = { preset: 'mes', offset: 0, desde: null, hasta: null };
let cacheDatos = { gastos: [], ingresos: [], configuracion: [], deudas: [], bcp: [], bbva_credito: [], bbva_tarjeta: [] };

const S = n => 'S/ ' + (Number(n) || 0).toFixed(2);
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const iso = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const dm = d => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
const enAnios = m => m < 12 ? m + ' meses' : (Math.floor(m / 12) + ' a ' + (m % 12) + ' m');

function toast(msg, ok) {
  const t = document.getElementById('toast');
  t.className = 'fixed bottom-24 lg:bottom-8 right-4 z-50 max-w-xs rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ' + (ok === false ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white');
  t.innerText = msg;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 4000);
}

/* Vistas */
function mostrarVista(vista) {
  const mapa = { dash: 'viewDash', registro: 'viewRegistro', deudas: 'viewDeudas', config: 'viewConfig' };
  Object.keys(mapa).forEach(v => document.getElementById(mapa[v]).classList.toggle('hidden', v !== vista));
  document.querySelectorAll('.nav-item').forEach(b => {
    const activo = b.dataset.vista === vista;
    b.classList.toggle('activo', activo);
  });
  const titulos = { dash: 'Panel', registro: 'Registrar', deudas: 'Salir de deudas', config: 'Categorías' };
  if(document.getElementById('tituloVistaMovil')) document.getElementById('tituloVistaMovil').innerText = titulos[vista];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (vista === 'deudas') cargarPlanDeudas();
  if (vista === 'registro') setTimeout(() => document.getElementById('montoGasto').focus(), 250);
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

/* Inicialización */
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
      supabase.from('gastos').select('*').order('id', { ascending: false }),
      supabase.from('ingresos').select('*').order('id', { ascending: false }),
      supabase.from('configuracion').select('*'),
      supabase.from('deudas').select('*')
    ]);

    if (resG.error) throw resG.error;
    if (resI.error) throw resI.error;
    if (resC.error) throw resC.error;

    cacheDatos.gastos = resG.data || [];
    cacheDatos.ingresos = resI.data || [];
    cacheDatos.configuracion = resC.data || [];
    cacheDatos.deudas = resD.data || [];

    procesarYRenderizarDashboard();
  } catch (err) {
    console.error(err);
    toast('Error cargando datos de Supabase', false);
  }
}

function procesarYRenderizarDashboard() {
  const filtro = calcularRango();
  document.getElementById('etiquetaPeriodo').innerText = filtro.etiqueta;

  // Llenar selects de categorías en Registro
  const selGasto = document.getElementById('categoriaGasto');
  const selIng = document.getElementById('categoriaIngreso');
  const selDeudaCat = document.getElementById('deudaCategoria');
  
  if(selGasto) selGasto.innerHTML = '';
  if(selIng) selIng.innerHTML = '';
  if(selDeudaCat) selDeudaCat.innerHTML = '<option value="">(usar nombre de la deuda)</option>';

  const gruposG = {};
  cacheDatos.configuracion.forEach(c => {
    if (c.tipo === 'Gasto') {
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

  cacheDatos.configuracion.filter(c => c.tipo === 'Ingreso').forEach(c => {
    const o = document.createElement('option'); o.value = c.categoria; o.textContent = c.categoria;
    if(selIng) selIng.appendChild(o);
  });

  // Totales históricos
  let totalIngresos = cacheDatos.ingresos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  let totalGastos = cacheDatos.gastos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  let saldoHist = totalIngresos - totalGastos;

  document.getElementById('saldoDisponible').innerText = S(saldoHist);
  document.getElementById('sbSaldo').innerText = S(saldoHist);
  if(document.getElementById('sbSaldoMovil')) document.getElementById('sbSaldoMovil').innerText = S(saldoHist);
  document.getElementById('sbIngresos').innerText = totalIngresos.toFixed(2);
  document.getElementById('sbGastos').innerText = totalGastos.toFixed(2);

  // Stats por responsable
  const statsResp = { 'Jhonathan': { in: 0, out: 0, perIn: 0 }, 'Sindy': { in: 0, out: 0, perIn: 0 } };
  cacheDatos.ingresos.forEach(i => {
    const resp = i.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].in += Number(i.monto) || 0;
  });
  cacheDatos.gastos.forEach(g => {
    const resp = g.responsable || 'Jhonathan';
    if(statsResp[resp]) statsResp[resp].out += Number(g.monto) || 0;
  });

  document.getElementById('jhoIngresos').innerText = S(statsResp['Jhonathan'].in);
  document.getElementById('jhoGastos').innerText = S(statsResp['Jhonathan'].out);
  document.getElementById('jhoSaldo').innerText = S(statsResp['Jhonathan'].in - statsResp['Jhonathan'].out);
  document.getElementById('sinIngresos').innerText = S(statsResp['Sindy'].in);
  document.getElementById('sinGastos').innerText = S(statsResp['Sindy'].out);
  document.getElementById('sinSaldo').innerText = S(statsResp['Sindy'].in - statsResp['Sindy'].out);

  // Filtrado por periodo
  const dInicio = new Date(filtro.desde + 'T00:00:00');
  const dFin = new Date(filtro.hasta + 'T23:59:59');

  let ingresosPeriodo = 0, gastosPeriodo = 0;
  let gastosPorCat = {}, gastosPorGrupo = {}, ingresosPorCat = {};
  let movimientos = [];

  cacheDatos.ingresos.forEach(i => {
    const f = new Date(i.fecha);
    const m = Number(i.monto) || 0;
    const resp = i.responsable || 'Jhonathan';
    if (f >= dInicio && f <= dFin) {
      ingresosPeriodo += m;
      if(statsResp[resp]) statsResp[resp].perIn += m;
      ingresosPorCat[i.categoria] = (ingresosPorCat[i.categoria] || 0) + m;
    }
    movimientos.push({ id: i.id, tipo: 'Ingreso', fecha: i.fecha, categoria: i.categoria, monto: m, responsable: resp, detalle: i.comentario || '' });
  });

  const grupoDeCat = {};
  cacheDatos.configuracion.forEach(c => { if(c.tipo === 'Gasto') grupoDeCat[c.categoria] = c.grupo || 'Sin grupo'; });

  cacheDatos.gastos.forEach(g => {
    const f = new Date(g.fecha);
    const m = Number(g.monto) || 0;
    const resp = g.responsable || 'Jhonathan';
    if (f >= dInicio && f <= dFin) {
      gastosPeriodo += m;
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + m;
      const grp = grupoDeCat[g.categoria] || 'Sin grupo';
      gastosPorGrupo[grp] = (gastosPorGrupo[grp] || 0) + m;
    }
    movimientos.push({ id: g.id, tipo: 'Gasto', fecha: g.fecha, categoria: g.categoria, monto: m, responsable: resp, detalle: g.descripcion || '' });
  });

  document.getElementById('periodoJhoIn').innerText = 'Jho: ' + S(statsResp['Jhonathan'].perIn);
  document.getElementById('periodoSinIn').innerText = 'Sin: ' + S(statsResp['Sindy'].perIn);
  document.getElementById('nombrePeriodo').innerText = filtro.etiqueta;
  document.getElementById('periodoIngresos').innerText = S(ingresosPeriodo);
  document.getElementById('periodoGastos').innerText = S(gastosPeriodo);
  document.getElementById('periodoTasaAhorro').innerText = ingresosPeriodo > 0 ? ('Guardas el ' + ((ingresosPeriodo - gastosPeriodo)/ingresosPeriodo * 100).toFixed(0) + '%') : '';
  
  const resPer = ingresosPeriodo - gastosPeriodo;
  const elRes = document.getElementById('periodoResultado');
  elRes.innerText = (resPer >= 0 ? 'Te quedan ' : 'Vas sobre-gastado ') + S(Math.abs(resPer));
  elRes.className = 'text-[11px] mt-1 ' + (resPer >= 0 ? 'text-emerald-600' : 'text-rose-600');

  // Presupuestos
  let totalTopeGlobal = 0, totalGastadoGlobal = 0;
  const panelPres = document.getElementById('panelPresupuestos');
  if(panelPres) panelPres.innerHTML = '';
  
  cacheDatos.configuracion.filter(c => c.tipo === 'Gasto' && Number(c.presupuesto) > 0).forEach(c => {
    const tope = Number(c.presupuesto);
    const gastado = gastosPorCat[c.categoria] || 0;
    totalTopeGlobal += tope; totalGastadoGlobal += gastado;
    const porc = tope > 0 ? (gastado / tope) * 100 : 0;
    const color = porc > 100 ? 'bg-rose-500' : (porc > 75 ? 'bg-amber-500' : 'bg-sky-500');
    
    if(panelPres) {
      panelPres.innerHTML += `<div>
        <div class="flex justify-between items-end mb-1"><span class="text-xs font-semibold text-slate-600">${esc(c.categoria)}</span><span class="text-[10px] text-slate-400">${S(gastado)} / ${S(tope)}</span></div>
        <div class="w-full bg-slate-100 rounded-full h-1"><div class="${color} h-1 rounded-full" style="width:${Math.min(porc, 100)}%"></div></div>
      </div>`;
    }
  });

  document.getElementById('totalPresupuestos').innerText = S(totalGastadoGlobal) + ' / ' + S(totalTopeGlobal);
  const barraPres = document.getElementById('barraTotalPresupuestos');
  const porcGlobal = totalTopeGlobal > 0 ? (totalGastadoGlobal / totalTopeGlobal) * 100 : 0;
  if(barraPres) barraPres.style.width = Math.min(porcGlobal, 100) + '%';

  // Gasto por grupo
  const panelGrp = document.getElementById('panelGrupos');
  if(panelGrp) {
    panelGrp.innerHTML = '';
    const arrGrp = Object.keys(gastosPorGrupo).map(g => ({ grupo: g, monto: gastosPorGrupo[g] })).sort((a,b) => b.monto - a.monto);
    const maxG = arrGrp[0]?.monto || 1;
    arrGrp.forEach(g => {
      panelGrp.innerHTML += `<div><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700">${esc(g.grupo)}</span><span class="text-slate-500">${S(g.monto)}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-slate-800 h-2 rounded-full" style="width:${(g.monto/maxG)*100}%"></div></div></div>`;
    });
  }

  // Ingresos por categoría
  const panelIngCat = document.getElementById('panelIngresosCat');
  if(panelIngCat) {
    panelIngCat.innerHTML = '';
    const arrIng = Object.keys(ingresosPorCat).map(c => ({ cat: c, monto: ingresosPorCat[c] })).sort((a,b) => b.monto - a.monto);
    const maxI = arrIng[0]?.monto || 1;
    arrIng.forEach(i => {
      panelIngCat.innerHTML += `<div><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700">${esc(i.cat)}</span><span class="text-slate-500">${S(i.monto)}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width:${(i.monto/maxI)*100}%"></div></div></div>`;
    });
  }

  // Movimientos recientes
  const panelMov = document.getElementById('panelMovimientos');
  if(panelMov) {
    panelMov.innerHTML = '';
    movimientos.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    movimientos.slice(0, 40).forEach(m => {
      const ing = m.tipo === 'Ingreso';
      panelMov.innerHTML += `<div class="flex items-center gap-3 py-3">
        <div class="w-9 h-9 rounded-full flex items-center justify-center ${ing ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0"><i class="fa-solid ${ing ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">${esc(m.categoria)}</p>
          <p class="text-[11px] text-slate-500 truncate">${esc(m.fecha)} · ${esc(m.responsable)}${m.detalle ? ' · ' + esc(m.detalle) : ''}</p>
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
}

/* Registrar Gasto/Ingreso */
window.enviarGasto = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarGasto');
  btn.innerText = 'Registrando...'; btn.disabled = true;

  const { error } = await supabase.from('gastos').insert([{
    fecha: document.getElementById('fechaGasto').value,
    categoria: document.getElementById('categoriaGasto').value,
    descripcion: document.getElementById('descripcionGasto').value || null,
    monto: parseFloat(document.getElementById('montoGasto').value),
    responsable: document.getElementById('responsableGasto').value,
    metodo_de_pago: 'App Web'
  }]);

  btn.innerText = 'Registrar salida'; btn.disabled = false;
  if (error) { toast('Error: ' + error.message, false); }
  else {
    document.getElementById('formGasto').reset();
    document.getElementById('fechaGasto').valueAsDate = new Date();
    toast('Gasto registrado con éxito', true);
    cargarDashboard();
  }
}

window.enviarIngreso = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarIngreso');
  btn.innerText = 'Registrando...'; btn.disabled = true;

  const { error } = await supabase.from('ingresos').insert([{
    fecha: document.getElementById('fechaIngreso').value,
    responsable: document.getElementById('responsableIngreso').value,
    categoria: document.getElementById('categoriaIngreso').value,
    comentario: document.getElementById('comentarioIngreso').value || null,
    monto: parseFloat(document.getElementById('montoIngreso').value)
  }]);

  btn.innerText = 'Registrar entrada'; btn.disabled = false;
  if (error) { toast('Error: ' + error.message, false); }
  else {
    document.getElementById('formIngreso').reset();
    document.getElementById('fechaIngreso').valueAsDate = new Date();
    toast('Ingreso registrado con éxito', true);
    cargarDashboard();
  }
}

/* Eliminar y Editar Movimientos */
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

  document.getElementById('editMovId').value = item.id;
  document.getElementById('editMovTipo').value = tipo;
  document.getElementById('editMovMonto').value = item.monto;
  document.getElementById('editMovFecha').value = item.fecha ? item.fecha.substring(0, 10) : '';
  document.getElementById('editMovResponsable').value = item.responsable || 'Jhonathan';
  document.getElementById('editMovDetalle').value = item.descripcion || item.comentario || '';

  const selCat = document.getElementById('editMovCategoria');
  selCat.innerHTML = document.getElementById(tipo === 'Gasto' ? 'categoriaGasto' : 'categoriaIngreso').innerHTML;
  selCat.value = item.categoria;

  document.getElementById('modalEdicionMovimiento').classList.remove('hidden');
  document.getElementById('modalEdicionMovimiento').classList.add('flex');
}

window.cerrarModalEdicion = function() {
  document.getElementById('modalEdicionMovimiento').classList.add('hidden');
  document.getElementById('modalEdicionMovimiento').classList.remove('flex');
}

window.enviarEdicionMovimiento = async function(e) {
  e.preventDefault();
  const id = document.getElementById('editMovId').value;
  const tipo = document.getElementById('editMovTipo').value;
  const tabla = tipo === 'Gasto' ? 'gastos' : 'ingresos';

  const payload = tipo === 'Gasto' ? {
    monto: parseFloat(document.getElementById('editMovMonto').value),
    fecha: document.getElementById('editMovFecha').value,
    responsable: document.getElementById('editMovResponsable').value,
    categoria: document.getElementById('editMovCategoria').value,
    descripcion: document.getElementById('editMovDetalle').value
  } : {
    monto: parseFloat(document.getElementById('editMovMonto').value),
    fecha: document.getElementById('editMovFecha').value,
    responsable: document.getElementById('editMovResponsable').value,
    categoria: document.getElementById('editMovCategoria').value,
    comentario: document.getElementById('editMovDetalle').value
  };

  const { error } = await supabase.from(tabla).update(payload).eq('id', id);
  if (error) toast('Error al actualizar: ' + error.message, false);
  else {
    toast('Actualizado correctamente', true);
    cerrarModalEdicion();
    cargarDashboard();
  }
}

/* Deudas */
window.cargarPlanDeudas = async function() {
  const deudas = cacheDatos.deudas;
  const vacio = document.getElementById('deudasVacio');
  const bloque = document.getElementById('bloquePlan');
  if(vacio) vacio.classList.toggle('hidden', deudas.length > 0);
  if(bloque) bloque.classList.toggle('hidden', deudas.length === 0);

  if (!deudas.length) return;

  const totalSaldo = deudas.reduce((s, d) => s + (Number(d.saldo_actual) || 0), 0);
  const totalMinimos = deudas.reduce((s, d) => s + (Number(d.pago_minimo) || 0), 0);
  const interesMensual = deudas.reduce((s, d) => s + (Number(d.saldo_actual) * ((Number(d.tasa_anual) / 100) / 12)), 0);

  document.getElementById('dTotal').innerText = S(totalSaldo);
  document.getElementById('dMinimos').innerText = S(totalMinimos);
  document.getElementById('dInteres').innerText = S(interesMensual);
  document.getElementById('dExcedente').innerText = S(0);

  const lista = document.getElementById('listaDeudas');
  if(lista) {
    lista.innerHTML = '';
    deudas.forEach(d => {
      const saldo = Number(d.saldo_actual) || 0;
      const inicial = Number(d.saldo_inicial) || saldo;
      const avance = inicial > 0 ? Math.min(100, Math.max(0, (1 - saldo / inicial) * 100)) : 0;
      lista.innerHTML += `<div class="border border-slate-100 rounded-2xl p-4">
        <p class="text-sm font-bold text-slate-800">${esc(d.nombre)}</p>
        <p class="text-[11px] text-slate-500">${Number(d.tasa_anual || 0).toFixed(1)}% anual · mínimo ${S(d.pago_minimo)}</p>
        <div class="flex justify-between text-xs my-1"><span class="font-bold text-slate-800">${S(saldo)}</span><span>${avance.toFixed(0)}% liquidado</span></div>
        <div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width:${avance}%"></div></div>
      </div>`;
    });
  }
}

window.guardarDeuda = async function(e) {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('deudaNombre').value,
    saldo_actual: parseFloat(document.getElementById('deudaSaldo').value),
    tasa_anual: parseFloat(document.getElementById('deudaTasa').value) || 0,
    pago_minimo: parseFloat(document.getElementById('deudaMinimo').value),
    dia_pago: parseInt(document.getElementById('deudaDia').value) || 15,
    categoria_gasto: document.getElementById('deudaCategoria').value || null,
    saldo_inicial: parseFloat(document.getElementById('deudaSaldo').value)
  };

  const { error } = await supabase.from('deudas').insert([payload]);
  if (error) toast('Error al guardar deuda: ' + error.message, false);
  else {
    document.getElementById('formDeuda').reset();
    toast('Deuda guardada', true);
    cargarDashboard();
  }
}

/* Categorías */
function renderConfiguracion() {
  const cont = document.getElementById('contenedorGrupos');
  if(!cont) return;
  cont.innerHTML = '';

  const grupos = {};
  cacheDatos.configuracion.forEach(c => {
    const grp = c.grupo || 'Sin grupo';
    if(c.tipo === 'Gasto') (grupos[grp] = grupos[grp] || []).push(c);
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
  e.preventDefault();
  const payload = {
    tipo: document.getElementById('confTipo').value,
    grupo: document.getElementById('confGrupo').value || null,
    categoria: document.getElementById('confCategoria').value,
    presupuesto: parseFloat(document.getElementById('confPresupuesto').value) || 0
  };

  const { error } = await supabase.from('configuracion').insert([payload]);
  if(error) toast('Error: ' + error.message, false);
  else {
    document.getElementById('formCategoria').reset();
    toast('Categoría guardada', true);
    cargarDashboard();
  }
}

window.togglePorTipo = function() {
  const esIngreso = document.getElementById('confTipo').value === 'Ingreso';
  document.getElementById('divConfGrupo').style.display = esIngreso ? 'none' : 'block';
  document.getElementById('divConfPresupuesto').style.display = esIngreso ? 'none' : 'block';
}

cargarDashboard();
