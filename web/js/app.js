// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmS7sAc1P6GV-HQB-3HD3cX_j5ZiX44pA",
  authDomain: "inventarioollas.firebaseapp.com",
  databaseURL: "https://inventarioollas-default-rtdb.firebaseio.com",
  projectId: "inventarioollas",
  storageBucket: "inventarioollas.firebasestorage.app",
  messagingSenderId: "977587125876",
  appId: "1:977587125876:web:406b1bb54127990ede1b21"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let datosNegocio = {
    nombre: "Mi Negocio",
    ruc: "20123456789",
    direccion: "Av. Principal 123",
    telefono: "555-1234"
};

// Fetch Datos Negocio
database.ref('configuracion').once('value').then(snapshot => {
    if (snapshot.exists()) {
        datosNegocio = snapshot.val();
    }
});

// --- Auth Functions ---

function login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    }).catch((error) => {
        console.error("Error signing out", error);
    });
}

function checkAuth() {
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "index.html";
        } else {
            const userEmailEl = document.getElementById("userEmail");
            if (userEmailEl) {
                userEmailEl.textContent = user.email;
            }
        }
    });
}

// --- Dashboard Logic ---

function initDashboard() {
    loadProductos();
    loadVentas();
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar nav a').forEach(el => el.classList.remove('active'));
    
    document.getElementById(sectionId + 'Section').style.display = 'block';
    // Update active link logic roughly
    event.target.classList.add('active');
}

function loadProductos() {
    const tableBody = document.querySelector("#productosTable tbody");
    if (!tableBody) return;

    database.ref('productos').on('value', (snapshot) => {
        // Save globally for search
        window.allProductos = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderProductos(window.allProductos);
    });
}

function renderProductos(productos) {
    const tableBody = document.querySelector("#productosTable tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (!productos || productos.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No hay productos registrados.</td></tr>";
        return;
    }

    productos.forEach(producto => {
        const stock = producto.stock;
        let stockClass = "";
        
        // Semáforo Logic
        if (stock <= 5) { 
            stockClass = "stock-critical";
        } else if (stock >= 6 && stock <= 15) {
            stockClass = "stock-warning";
        } else {
            stockClass = "stock-good";
        }

        const row = document.createElement("tr");
        row.className = stockClass; 
        
        // Safe DOM creation
        const cellNombre = document.createElement("td");
        cellNombre.textContent = producto.nombre;
        
        const cellCodigo = document.createElement("td");
        cellCodigo.textContent = producto.codigo;
        
        const cellStock = document.createElement("td");
        cellStock.innerHTML = `<strong>${stock}</strong>`;
        
        // Anti-NaN Logic: Prioritize precioUnitario, fallback to precio, or 0
        const precioFinal = producto.precioUnitario || producto.precio || 0;
        
        const cellPrecio = document.createElement("td");
        cellPrecio.textContent = `S/ ${parseFloat(precioFinal).toFixed(2)}`;
        
        const cellCategoria = document.createElement("td");
        cellCategoria.textContent = producto.categoria;

        const cellAcciones = document.createElement("td");
        // Serialize safely
        const prodJson = JSON.stringify(producto).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        cellAcciones.innerHTML = `
            <button class="btn-edit" onclick="abrirModalEditar(${prodJson})">Editar</button>
            <button class="btn-stock" onclick="abrirModalStock(${prodJson})">Ajuste (+/-)</button>
        `;

        row.appendChild(cellNombre);
        row.appendChild(cellCodigo);
        row.appendChild(cellStock);
        row.appendChild(cellPrecio);
        row.appendChild(cellCategoria);
        row.appendChild(cellAcciones);

        tableBody.appendChild(row);
    });
    actualizarMetricas();
}

function filterProductos() {
    const search = document.getElementById('searchProduct').value.toLowerCase();
    
    if (!window.allProductos) return;

    const filtered = window.allProductos.filter(prod => {
        const nombre = (prod.nombre || "").toLowerCase();
        const categoria = (prod.categoria || "").toLowerCase();
        return nombre.includes(search) || categoria.includes(search);
    });

    renderProductos(filtered);
}

function loadVentas() {
    const tableBody = document.querySelector("#ventasTable tbody");
    if (!tableBody) return;

    // Set default date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput && !filterDateInput.value) {
        filterDateInput.value = todayStr;
    }

    // Listen to changes in real-time
    database.ref('ventas').limitToLast(100).on('value', (snapshot) => {
        // Save data globally for filtering
        window.allVentas = snapshot.val() ? Object.values(snapshot.val()) : [];
        // Apply filter immediately (which defaults to today)
        filterVentas();
    });
}

function renderVentas(ventas) {
    const tableBody = document.querySelector("#ventasTable tbody");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";

    if (!ventas || ventas.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='5' style='text-align: center;'>No hay ventas registradas.</td></tr>";
        return;
    }

    // Calculate total for displayed sales
    const totalVentas = ventas.reduce((sum, venta) => sum + parseFloat(venta.total || 0), 0);
    const totalDisplay = document.getElementById('totalVentasDiaDisplay');
    if (totalDisplay) {
        totalDisplay.textContent = `S/ ${totalVentas.toFixed(2)}`;
    }

    // Sort by date descending
    const ventasSorted = [...ventas].sort((a, b) => b.fecha - a.fecha);

    ventasSorted.forEach(venta => {
        const dateObj = new Date(venta.fecha);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        
        // WhatsApp Link Construction
        const cliente = venta.clienteNombre || "Cliente";
        const mensaje = encodeURIComponent(`Hola ${cliente}, aquí tienes tu nota de pedido de Ollas.`);
        const telefono = venta.clienteTelefono || ""; 
        const waLink = `https://wa.me/${telefono}?text=${mensaje}`;

        // Serialize venta for print function safely
        const ventaJson = JSON.stringify(venta).replace(/'/g, "\\'").replace(/"/g, '&quot;');

        const row = document.createElement("tr");

        // Safe DOM creation
        const cellDate = document.createElement("td");
        cellDate.textContent = dateStr;

        const cellCliente = document.createElement("td");
        cellCliente.textContent = venta.clienteNombre || 'Cliente General';

        const cellVendedor = document.createElement("td");
        cellVendedor.textContent = venta.vendedorNombre || 'Desconocido';

        const cellTotal = document.createElement("td");
        cellTotal.textContent = `S/ ${parseFloat(venta.total).toFixed(2)}`;

                const cellAcciones = document.createElement("td");
        cellAcciones.innerHTML = `
            <button onclick="verDetalleVenta(${ventaJson})" class="btn-detail" style="background: #2196F3;">👁️ Ver</button>
            <a href="${waLink}" target="_blank" class="btn-whatsapp">WhatsApp</a>
            <button onclick="imprimirVenta(${ventaJson}, 'a4')" class="btn-print">A4</button>
            <button onclick="imprimirVenta(${ventaJson}, 'ticket')" class="btn-print">Ticket</button>
        `;


        row.appendChild(cellDate);
        row.appendChild(cellCliente);
        row.appendChild(cellVendedor);
        row.appendChild(cellTotal);
        row.appendChild(cellAcciones);

        tableBody.appendChild(row);
    });
    actualizarMetricas();
}

function filterVentas() {
    const dateInput = document.getElementById('filterDate').value;
    const sellerInput = document.getElementById('filterSeller').value.toLowerCase();
    
    if (!window.allVentas) return;

    // Use requested logic with setHours(0,0,0,0) for date comparison
    let fechaSeleccionada = null;
    if (dateInput) {
        // Construct date explicitly to ensure local time match with browser
        const parts = dateInput.split('-');
        fechaSeleccionada = new Date(parts[0], parts[1] - 1, parts[2]).setHours(0,0,0,0);
    }

    const filtered = window.allVentas.filter(venta => {
        const fechaVenta = new Date(venta.fecha).setHours(0,0,0,0);
        
        const dateMatch = !fechaSeleccionada || fechaVenta === fechaSeleccionada;
        const sellerMatch = !sellerInput || (venta.vendedorNombre && venta.vendedorNombre.toLowerCase().includes(sellerInput));
        
        return dateMatch && sellerMatch;
    });

    renderVentas(filtered);
}

function imprimirVenta(venta, modo) {
    const printableArea = document.getElementById('printableArea');
    const dateStr = new Date(venta.fecha).toLocaleString();
    const tituloDoc = (venta.tipoDocumento || "Nota de Pedido").toUpperCase().replace('_', ' ');
    
    // Clear previous content
    printableArea.innerHTML = '';
    
    // Remove previous print classes
    document.body.classList.remove('print-a4', 'print-ticket');
    // Add current print class
    document.body.classList.add(modo === 'ticket' ? 'print-ticket' : 'print-a4');
    
    const invoiceContainer = document.createElement('div');
    invoiceContainer.className = 'invoice-container';
    
    // Header
    const header = document.createElement('div');
    header.className = 'invoice-header';
    header.innerHTML = `
        <h3>${datosNegocio.nombre}</h3>
        <p>${datosNegocio.direccion}</p>
        <p>RUC: ${datosNegocio.ruc} | Telf: ${datosNegocio.telefono}</p>
        <hr style="margin: 0.5rem 0;">
        <h2>${tituloDoc}</h2>
        <p>Fecha: ${dateStr}</p>
        <p>Nro: ${venta.id ? venta.id.substring(1, 8).toUpperCase() : '---'}</p>
    `;
    
    // Details (Sanitized)
    const details = document.createElement('div');
    details.className = 'invoice-details';
    
    // Helper to create detail lines safely
    const createDetail = (label, value) => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label + ': ';
        p.appendChild(strong);
        p.appendChild(document.createTextNode(value || '-'));
        return p;
    };
    
    details.appendChild(createDetail('Cliente', venta.clienteNombre || 'General'));
    details.appendChild(createDetail('DNI/RUC', venta.clienteDni || venta.clienteRuc));
    details.appendChild(createDetail('Dirección', venta.clienteDireccion));
    details.appendChild(createDetail('Vendedor', venta.vendedorNombre));
    
    // Table
    const table = document.createElement('table');
    table.className = 'invoice-items';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>P. Unit.</th>
                <th>Subtotal</th>
            </tr>
        </thead>
    `;
    
    const tbody = document.createElement('tbody');
    if (venta.productos) {
        Object.values(venta.productos).forEach(item => {
            const tr = document.createElement('tr');
            
            const tdNombre = document.createElement('td');
            tdNombre.textContent = item.nombre;
            
            const tdCant = document.createElement('td');
            tdCant.textContent = item.cantidad;
            
            const tdPrice = document.createElement('td');
            tdPrice.textContent = `S/ ${parseFloat(item.precioUnitario).toFixed(2)}`;
            
            const tdSub = document.createElement('td');
            tdSub.textContent = `S/ ${parseFloat(item.subtotal).toFixed(2)}`;
            
            tr.appendChild(tdNombre);
            tr.appendChild(tdCant);
            tr.appendChild(tdPrice);
            tr.appendChild(tdSub);
            tbody.appendChild(tr);
        });
    }
    table.appendChild(tbody);
    
    // Total
    const totalDiv = document.createElement('div');
    totalDiv.className = 'invoice-total';
    totalDiv.textContent = `TOTAL: S/ ${parseFloat(venta.total).toFixed(2)}`;
    
    // Footer
    const footer = document.createElement('div');
    footer.style.textAlign = 'center';
    footer.style.marginTop = '2rem';
    footer.style.fontSize = '0.8rem';
    footer.textContent = '¡Gracias por su preferencia!';

    invoiceContainer.appendChild(header);
    invoiceContainer.appendChild(details);
    invoiceContainer.appendChild(table);
    invoiceContainer.appendChild(totalDiv);
    invoiceContainer.appendChild(footer);
    
    printableArea.appendChild(invoiceContainer);

    window.print();
}

function verDetallePicking(venta) {
    const modal = document.getElementById('pickingModal');
    const content = document.getElementById('pickingContent');
    content.innerHTML = ''; // Clear

    if (venta.productos) {
        Object.values(venta.productos).forEach(item => {
            const div = document.createElement('div');
            div.className = 'picking-item';
            div.innerHTML = `<strong>${item.cantidad} x</strong> ${item.nombre}`;
            content.appendChild(div);
        });
    } else {
        content.textContent = "No hay productos en esta venta.";
    }

    modal.style.display = "block";
}

function cerrarModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// --- Product Logic ---

function abrirModalProducto() {
    document.getElementById('productoForm').reset();
    document.getElementById('productoModal').style.display = "block";
}

function guardarNuevoProducto(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('prodNombre').value;
    const codigo = document.getElementById('prodCodigo').value;
    const categoria = document.getElementById('prodCategoria').value;
    const precioInput = document.getElementById('prodPrecio').value;
    const stockInput = document.getElementById('prodStock').value;
    
    // Explicit conversion and validation
    const precio = parseFloat(precioInput);
    const stock = parseInt(stockInput);
    
    if (isNaN(precio) || isNaN(stock)) {
        alert("Por favor, ingrese valores numéricos válidos para precio y stock.");
        return;
    }

    const newRef = database.ref('productos').push();
    
    // Ensure numeric types for Android compatibility
    const producto = {
        id: newRef.key,
        nombre: nombre,
        codigo: codigo,
        categoria: categoria,
        precioUnitario: Number(precio), // Double check force number
        urlImagen: "", // Default empty string
        stock: Number(stock), // Double check force number
        fechaIngreso: Date.now()
    };
    
    newRef.set(producto).then(() => {
        alert("Producto creado exitosamente");
        cerrarModal('productoModal');
    }).catch(error => {
        alert("Error al crear producto: " + error.message);
    });
}

function abrirModalEditar(producto) {
    document.getElementById('editId').value = producto.id;
    document.getElementById('editNombre').value = producto.nombre;
    // Anti-NaN Logic for edit modal as well
    document.getElementById('editPrecio').value = producto.precioUnitario || producto.precio || 0;
    document.getElementById('editStock').value = producto.stock || 0;
    document.getElementById('editarModal').style.display = "block";
}

function guardarEdicionProducto() {
    const id = document.getElementById('editId').value;
    const nombre = document.getElementById('editNombre').value;
    const precioInput = document.getElementById('editPrecio').value;
    const stockInput = document.getElementById('editStock').value;
    
    // Explicit conversion
    const precio = parseFloat(precioInput);
    const stock = parseInt(stockInput);
    
    if (!nombre || isNaN(precio) || isNaN(stock)) {
        alert("Por favor complete los campos correctamente");
        return;
    }
    
    database.ref('productos/' + id).update({
        nombre: nombre,
        precioUnitario: Number(precio), // Force number type
        stock: Number(stock) // Force number type
    }).then(() => {
        alert("Producto actualizado");
        cerrarModal('editarModal');
    }).catch(error => {
        alert("Error: " + error.message);
    });
}

function abrirModalStock(producto) {
    document.getElementById('stockId').value = producto.id;
    document.getElementById('stockProdName').textContent = producto.nombre;
    document.getElementById('stockActualDisplay').textContent = producto.stock;
    document.getElementById('stockCantidad').value = 1;
    document.getElementById('stockModal').style.display = "block";
}

function aplicarStock(multiplicador) {
    const id = document.getElementById('stockId').value;
    const cantidadInput = parseInt(document.getElementById('stockCantidad').value);
    
    if (isNaN(cantidadInput) || cantidadInput <= 0) {
        alert("Ingrese una cantidad válida");
        return;
    }
    
    const cambio = cantidadInput * multiplicador;
    
    // Check current stock logic
    database.ref('productos/' + id + '/stock').transaction((currentStock) => {
        if (currentStock === null) return 0; // If doesn't exist, assume 0
        
        const newStock = (currentStock || 0) + cambio;
        
        if (newStock < 0) {
            // Cancel transaction if stock would be negative
            return; // Abort
        }
        
        return newStock;
    }, (error, committed, snapshot) => {
        if (error) {
            alert("Error al actualizar stock: " + error.message);
        } else if (!committed) {
            alert("No se pudo realizar el ajuste. Verifique que no resulte en stock negativo.");
        } else {
            alert("Stock actualizado correctamente.");
            cerrarModal('stockModal');
        }
    });
}

function exportarReporteDiario() {
    if (!window.allVentas || window.allVentas.length === 0) {
        alert("No hay ventas para exportar.");
        return;
    }

    const dateInput = document.getElementById('filterDate');
    let fechaSeleccionada = null;
    let fechaStr = "Hoy";

    if (dateInput && dateInput.value) {
        const parts = dateInput.value.split('-');
        // Create date at local midnight
        fechaSeleccionada = new Date(parts[0], parts[1] - 1, parts[2]).setHours(0,0,0,0);
        fechaStr = dateInput.value;
    } else {
        // Fallback to today if logic fails, though input is usually pre-filled
        fechaSeleccionada = new Date().setHours(0,0,0,0);
    }
    
    const dailySales = window.allVentas.filter(venta => {
        const fechaVenta = new Date(venta.fecha).setHours(0,0,0,0);
        return fechaVenta === fechaSeleccionada;
    });

    if (dailySales.length === 0) {
        alert("No hay ventas registradas para la fecha seleccionada.");
        return;
    }

    // Calculate total
    const totalDia = dailySales.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);

    // Map to export format
    const dataToExport = dailySales.map(v => ({
        "Fecha": new Date(v.fecha).toLocaleString(),
        "Tipo Comprobante": (v.tipoDocumento || "Boleta").toUpperCase(),
        "Cliente": v.clienteNombre || "General",
        "RUC/DNI": v.clienteDni || v.clienteRuc || "-",
        "Total": parseFloat(v.total).toFixed(2),
        "Vendedor": v.vendedorNombre || "-"
    }));

    // Add Total Row
    dataToExport.push({
        "Fecha": "",
        "Tipo Comprobante": "",
        "Cliente": "",
        "RUC/DNI": "TOTAL DÍA",
        "Total": totalDia.toFixed(2),
        "Vendedor": ""
    });

    // Create Sheet
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Diario");

    // Export
    XLSX.writeFile(wb, `Reporte_Contable_${fechaStr}.xlsx`);
}

// --- Login Page Logic ---

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        // Redirect if already logged in
        auth.onAuthStateChanged((user) => {
            if (user) {
                window.location.href = "dashboard.html";
            }
        });

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const errorMsg = document.getElementById("errorMessage");
            const btn = document.getElementById("loginBtn");

            btn.disabled = true;
            btn.textContent = "Ingresando...";
            errorMsg.textContent = "";

            login(email, password)
                .then(() => {
                    // Redirect handled by onAuthStateChanged
                })
                .catch((error) => {
                    btn.disabled = false;
                    btn.textContent = "Ingresar";
                    let msg = "Error al iniciar sesión.";
                    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                        msg = "Correo o contraseña incorrectos.";
                    } else if (error.code === 'auth/invalid-email') {
                        msg = "Correo inválido.";
                    }
                    errorMsg.textContent = msg;
                    console.error(error);
                });
        });
    }
});

// ==================== EDITAR Y ELIMINAR VENTAS ====================

let ventaActual = null; // Para guardar la venta que se está editando

// Ver detalles completos de la venta
// Ver detalles completos de la venta - VERSIÓN CARDS
function verDetalleVenta(venta) {
    ventaActual = venta;
    const modal = document.getElementById('detalleVentaModal');
    const content = document.getElementById('detalleVentaContent');
    content.innerHTML = '';

    const dateStr = new Date(venta.fecha).toLocaleString();

    // Información del cliente
    const infoCliente = `
        <div style="background: linear-gradient(135deg, #f8fafc, #e2e8f0); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; border-left: 4px solid var(--primary);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; font-size: 0.9rem;">
                <div><strong>📅 Fecha:</strong><br><span style="color: var(--text-secondary);">${dateStr}</span></div>
                <div><strong>👤 Cliente:</strong><br><span style="color: var(--text-secondary);">${venta.clienteNombre || 'General'}</span></div>
                <div><strong>📝 DNI/RUC:</strong><br><span style="color: var(--text-secondary);">${venta.clienteDni || venta.clienteRuc || '-'}</span></div>
                <div><strong>📞 Teléfono:</strong><br><span style="color: var(--text-secondary);">${venta.clienteTelefono || '-'}</span></div>
            </div>
            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; font-size: 0.9rem;">
                <div><strong>📍 Dirección:</strong><br><span style="color: var(--text-secondary);">${venta.clienteDireccion || '-'}</span></div>
                <div><strong>🛒 Vendedor:</strong><br><span style="color: var(--text-secondary);">${venta.vendedorNombre || 'Desconocido'}</span></div>
                <div><strong>📄 Documento:</strong><br><span style="color: var(--text-secondary);">${(venta.tipoDocumento || 'Boleta').toUpperCase()}</span></div>
            </div>
        </div>
    `;

    // Productos como cards
    const productosCards = Object.values(venta.productos || {}).map(item => `
        <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; transition: var(--transition);" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; margin-bottom: 0.5rem;">${item.nombre}</div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--text-secondary);">
                    <span style="background: var(--bg-main); padding: 0.25rem 0.625rem; border-radius: 6px;">
                        📦 Cant: <strong>${item.cantidad}</strong>
                    </span>
                    <span style="background: var(--bg-main); padding: 0.25rem 0.625rem; border-radius: 6px;">
                        💵 P.Unit: <strong>S/ ${parseFloat(item.precioUnitario).toFixed(2)}</strong>
                    </span>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Subtotal</div>
                <div style="font-weight: 700; color: var(--primary); font-size: 1.25rem; white-space: nowrap;">
                    S/ ${parseFloat(item.subtotal).toFixed(2)}
                </div>
            </div>
        </div>
    `).join('');

    const totalCard = `
        <div style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 1.5rem; border-radius: 12px; text-align: right; border: 2px solid var(--primary); margin-top: 1rem;">
            <div style="font-size: 0.9rem; color: #1e40af; margin-bottom: 0.5rem; font-weight: 600;">💰 TOTAL A PAGAR</div>
            <div style="font-size: 2.25rem; font-weight: 700; color: var(--primary); line-height: 1;">
                S/ ${parseFloat(venta.total).toFixed(2)}
            </div>
        </div>
    `;

    const detalleHTML = `
        ${infoCliente}
        <h3 style="margin: 1.5rem 0 1rem; color: var(--text-primary); font-size: 1.1rem;">🛍️ Productos Pedidos</h3>
        <div style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
            ${productosCards}
        </div>
        ${totalCard}
    `;

    content.innerHTML = detalleHTML;
    modal.style.display = 'block';
}



// Iniciar edición de venta
function iniciarEdicionVenta() {
    if (!ventaActual) return;
    
    const modal = document.getElementById('editarVentaModal');
    const content = document.getElementById('editarVentaContent');
    
    let productosHTML = '<div style="max-height: 400px; overflow-y: auto;">';
    
    Object.entries(ventaActual.productos || {}).forEach(([prodId, item]) => {
        productosHTML += `
            <div class="producto-editable" data-producto-id="${prodId}" style="background: #f5f5f5; padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <strong>${item.nombre}</strong><br>
                    <span style="font-size: 0.9rem; color: #666;">S/ ${parseFloat(item.precioUnitario).toFixed(2)} c/u</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button onclick="cambiarCantidad('${prodId}', -1)" style="padding: 0.25rem 0.75rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">-</button>
                    <input type="number" id="cant_${prodId}" value="${item.cantidad}" min="0" style="width: 60px; text-align: center; padding: 0.25rem;" onchange="actualizarSubtotal('${prodId}')">
                    <button onclick="cambiarCantidad('${prodId}', 1)" style="padding: 0.25rem 0.75rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">+</button>
                    <span id="subtotal_${prodId}" style="margin-left: 1rem; min-width: 80px; text-align: right;">S/ ${parseFloat(item.subtotal).toFixed(2)}</span>
                    <button onclick="eliminarProductoVenta('${prodId}')" style="padding: 0.25rem 0.75rem; background: #9e9e9e; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
                </div>
            </div>
        `;
    });
    
    productosHTML += '</div>';
    productosHTML += `
        <div style="text-align: right; margin-top: 1rem; font-size: 1.3rem; font-weight: bold; color: #2196F3;">
            TOTAL: <span id="totalEditado">S/ ${parseFloat(ventaActual.total).toFixed(2)}</span>
        </div>
    `;
    
    content.innerHTML = productosHTML;
    
    cerrarModal('detalleVentaModal');
    modal.style.display = 'block';
}

// Cambiar cantidad de producto
function cambiarCantidad(productoId, delta) {
    const input = document.getElementById(`cant_${productoId}`);
    const newValue = Math.max(0, parseInt(input.value) + delta);
    input.value = newValue;
    actualizarSubtotal(productoId);
}

// Actualizar subtotal de producto
function actualizarSubtotal(productoId) {
    const cantidad = parseInt(document.getElementById(`cant_${productoId}`).value) || 0;
    const producto = ventaActual.productos[productoId];
    
    if (!producto) return;
    
    const subtotal = cantidad * parseFloat(producto.precioUnitario);
    document.getElementById(`subtotal_${productoId}`).textContent = `S/ ${subtotal.toFixed(2)}`;
    
    // Actualizar total general
    let totalGeneral = 0;
    Object.keys(ventaActual.productos).forEach(pid => {
        const cant = parseInt(document.getElementById(`cant_${pid}`)?.value || 0);
        const prod = ventaActual.productos[pid];
        totalGeneral += cant * parseFloat(prod.precioUnitario);
    });
    
    document.getElementById('totalEditado').textContent = `S/ ${totalGeneral.toFixed(2)}`;
}

// Eliminar producto de la venta
function eliminarProductoVenta(productoId) {
    if (confirm('¿Eliminar este producto de la venta?')) {
        delete ventaActual.productos[productoId];
        iniciarEdicionVenta(); // Recargar modal
    }
}

// Guardar edición de venta
function guardarEdicionVenta() {
    if (!ventaActual || !ventaActual.id) {
        alert('Error: No se puede identificar la venta');
        return;
    }
    
    // Recopilar nuevos datos
    const productosActualizados = {};
    let totalNuevo = 0;
    let cambioStock = {}; // { productoId: diferenciaCantidad }
    
    Object.keys(ventaActual.productos).forEach(prodId => {
        const cantInput = document.getElementById(`cant_${prodId}`);
        if (!cantInput) return;
        
        const cantidadNueva = parseInt(cantInput.value) || 0;
        
        if (cantidadNueva > 0) {
            const producto = ventaActual.productos[prodId];
            const subtotal = cantidadNueva * parseFloat(producto.precioUnitario);
            
            productosActualizados[prodId] = {
                ...producto,
                cantidad: cantidadNueva,
                subtotal: subtotal
            };
            
            totalNuevo += subtotal;
            
            // Calcular diferencia para ajustar stock
            const cantidadAntigua = ventaActual.productos[prodId].cantidad;
            const diferencia = cantidadAntigua - cantidadNueva; // Positivo = reponer, Negativo = descontar más
            cambioStock[prodId] = diferencia;
        } else {
            // Si cantidad es 0, significa que se eliminó
            const cantidadAntigua = ventaActual.productos[prodId].cantidad;
            cambioStock[prodId] = cantidadAntigua; // Reponer todo
        }
    });
    
    if (Object.keys(productosActualizados).length === 0) {
        alert('No puedes dejar la venta sin productos. Si deseas eliminarla, usa el botón Eliminar Venta.');
        return;
    }
    
    if (!confirm('¿Guardar los cambios en esta venta?')) return;
    
    // Actualizar venta en Firebase
    const updates = {
        productos: productosActualizados,
        total: totalNuevo
    };
    
    database.ref('ventas/' + ventaActual.id).update(updates)
        .then(() => {
            // Ajustar stock de productos
            const promesas = [];
            
            Object.entries(cambioStock).forEach(([prodId, diferencia]) => {
                if (diferencia !== 0) {
                    const promesa = database.ref('productos/' + prodId + '/stock').transaction((currentStock) => {
                        return (currentStock || 0) + diferencia;
                    });
                    promesas.push(promesa);
                }
            });
            
            return Promise.all(promesas);
        })
        .then(() => {
            alert('✅ Venta actualizada y stock ajustado correctamente');
            cerrarModal('editarVentaModal');
            ventaActual = null;
        })
        .catch(error => {
            alert('Error al actualizar venta: ' + error.message);
        });
}

// Confirmar eliminación
function confirmarEliminarVenta() {
    if (!ventaActual || !ventaActual.id) {
        alert('Error: No se puede identificar la venta');
        return;
    }
    
    const listaHTML = Object.values(ventaActual.productos || {}).map(item => `
        <div style="padding: 0.5rem; text-align: left;">
            • <strong>${item.nombre}:</strong> +${item.cantidad} unidades
        </div>
    `).join('');
    
    document.getElementById('stockReponerLista').innerHTML = listaHTML;
    
    cerrarModal('detalleVentaModal');
    document.getElementById('confirmarEliminarModal').style.display = 'block';
}

// Eliminar venta y reponer stock
function eliminarVenta() {
    if (!ventaActual || !ventaActual.id) {
        alert('Error: No se puede identificar la venta');
        return;
    }
    
    const ventaId = ventaActual.id;
    const productos = ventaActual.productos || {};
    
    // Primero reponer stock
    const promesas = [];
    
    Object.values(productos).forEach(item => {
        const promesa = database.ref('productos/' + item.productoId + '/stock').transaction((currentStock) => {
            return (currentStock || 0) + item.cantidad;
        });
        promesas.push(promesa);
    });
    
    Promise.all(promesas)
        .then(() => {
            // Luego eliminar venta
            return database.ref('ventas/' + ventaId).remove();
        })
        .then(() => {
            alert('✅ Venta eliminada y stock repuesto correctamente');
            cerrarModal('confirmarEliminarModal');
            ventaActual = null;
        })
        .catch(error => {
            alert('Error al eliminar venta: ' + error.message);
        });
}

// ==================== ACTUALIZAR MÉTRICAS ====================
function actualizarMetricas() {
    if (!window.allVentas || !window.allProductos) return;
    
    // Total vendido hoy
    const hoy = new Date().setHours(0,0,0,0);
    const ventasHoy = window.allVentas.filter(v => new Date(v.fecha).setHours(0,0,0,0) === hoy);
    const totalHoy = ventasHoy.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const metricTotalHoyEl = document.getElementById('metricTotalHoy');
    if (metricTotalHoyEl) {
        metricTotalHoyEl.textContent = `S/ ${totalHoy.toFixed(2)}`;
    }
    
    // Ventas del mes
    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();
    const ventasMes = window.allVentas.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta.getMonth() === mesActual && fechaVenta.getFullYear() === añoActual;
    });
    const metricVentasMesEl = document.getElementById('metricVentasMes');
    if (metricVentasMesEl) {
        metricVentasMesEl.textContent = ventasMes.length;
    }
    
    // Productos con stock bajo (≤ 10)
    const stockBajo = window.allProductos.filter(p => p.stock <= 10).length;
    const metricStockBajoEl = document.getElementById('metricStockBajo');
    if (metricStockBajoEl) {
        metricStockBajoEl.textContent = stockBajo;
    }
    
    // Total productos
    const metricTotalProductosEl = document.getElementById('metricTotalProductos');
    if (metricTotalProductosEl) {
        metricTotalProductosEl.textContent = window.allProductos.length;
    }
}
