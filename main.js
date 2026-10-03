import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvsepnwkkcibzskuapsz.supabase.co/rest/v1/'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c2Vwbndra2NpYnpza3VhcHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MDc0MTAsImV4cCI6MjEwNjQ4MzQxMH0.pDg6hJTFl7MnuadztS_cmZLgKk9rydvmlHtEfhT25H0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const statusBadge = document.getElementById('status-conexion')
const tablaCuerpo = document.getElementById('tabla-gastos-cuerpo')
const formGasto = document.getElementById('form-gasto')

async function inicializar() {
    try {
        // Consultamos la tabla en minúsculas 'gastos'
        const { data, error } = await supabase.from('gastos').select('*').limit(15).order('id', { ascending: false })
        if (error) throw error

        statusBadge.textContent = 'Conectado a Supabase'
        statusBadge.className = 'text-xs px-3 py-1.5 rounded-full font-medium bg-emerald-100 text-emerald-700'
        renderizarTabla(data)
    } catch (err) {
        console.error(err)
        statusBadge.textContent = 'Error de conexión'
        statusBadge.className = 'text-xs px-3 py-1.5 rounded-full font-medium bg-rose-100 text-rose-700'
        tablaCuerpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-500">Error al conectar. Verifica tus credenciales en main.js</td></tr>`
    }
}

function renderizarTabla(gastos) {
    if (!gastos || gastos.length === 0) {
        tablaCuerpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No hay gastos registrados todavía.</td></tr>`
        return
    }

    tablaCuerpo.innerHTML = gastos.map(g => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-4">${g.fecha ? new Date(g.fecha).toLocaleDateString() : '-'}</td>
            <td class="p-4 font-medium text-slate-700">${g.categoria || '-'}</td>
            <td class="p-4 text-slate-500">${g.descripcion || 'Sin descripción'}</td>
            <td class="p-4 font-semibold text-rose-600">S/. ${Number(g.monto || 0).toFixed(2)}</td>
            <td class="p-4">${g.responsable || '-'}</td>
            <td class="p-4"><span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs">${g.metodo_de_pago || '-'}</span></td>
        </tr>
    `).join('')
}

formGasto.addEventListener('submit', async (e) => {
    e.preventDefault()
    const nuevoGasto = {
        fecha: document.getElementById('g-fecha').value,
        categoria: document.getElementById('g-categoria').value,
        descripcion: document.getElementById('g-descripcion').value || 'NULL',
        monto: parseFloat(document.getElementById('g-monto').value),
        responsable: document.getElementById('g-responsable').value,
        metodo_de_pago: 'Efectivo'
    }

    // Insertamos también en la tabla en minúsculas 'gastos'
    const { error } = await supabase.from('gastos').insert([nuevoGasto])
    if (error) {
        alert('Hubo un error al guardar: ' + error.message)
    } else {
        formGasto.reset()
        document.getElementById('g-fecha').valueAsDate = new Date()
        inicializar()
    }
})

document.getElementById('g-fecha').valueAsDate = new Date()
window.cargarDatos = inicializar
inicializar()
