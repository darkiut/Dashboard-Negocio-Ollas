package com.negocio.inventarioollas.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.*
import com.negocio.inventarioollas.models.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirebaseRepository {

    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val database: FirebaseDatabase = FirebaseDatabase.getInstance()

    // Referencias a las colecciones
    private val usuariosRef = database.getReference("usuarios")
    private val productosRef = database.getReference("productos")
    private val ventasRef = database.getReference("ventas")

    // ==================== AUTENTICACIÓN ====================

    suspend fun registrarUsuario(email: String, password: String, nombre: String, rol: String): Result<Usuario> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            val userId = result.user?.uid ?: throw Exception("Error al obtener ID de usuario")

            val usuario = Usuario(
                id = userId,
                nombre = nombre,
                email = email,
                rol = rol
            )

            usuariosRef.child(userId).setValue(usuario).await()
            Result.success(usuario)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun iniciarSesion(email: String, password: String): Result<Usuario> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            val userId = result.user?.uid ?: throw Exception("Error al obtener ID de usuario")

            // Usamos la función auxiliar para obtener los datos completos
            obtenerUsuarioPorId(userId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- ESTA ES LA FUNCIÓN QUE FALTABA Y CAUSABA EL ERROR ---
    suspend fun obtenerUsuarioPorId(userId: String): Result<Usuario> {
        return try {
            val snapshot = usuariosRef.child(userId).get().await()
            val usuario = snapshot.getValue(Usuario::class.java)

            if (usuario != null) {
                Result.success(usuario)
            } else {
                Result.failure(Exception("Usuario no encontrado en la base de datos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun cerrarSesion() {
        auth.signOut()
    }

    fun obtenerUsuarioActual(): String? {
        return auth.currentUser?.uid
    }

    // ==================== PRODUCTOS ====================

    suspend fun agregarProducto(producto: Producto): Result<String> {
        return try {
            val productoId = productosRef.push().key ?: throw Exception("Error al generar ID")
            producto.id = productoId
            productosRef.child(productoId).setValue(producto).await()
            Result.success(productoId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun actualizarProducto(producto: Producto): Result<Unit> {
        return try {
            productosRef.child(producto.id).setValue(producto).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun obtenerProductos(): Flow<List<Producto>> = callbackFlow {
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val productos = mutableListOf<Producto>()
                for (child in snapshot.children) {
                    child.getValue(Producto::class.java)?.let { productos.add(it) }
                }
                trySend(productos)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        productosRef.addValueEventListener(listener)
        awaitClose { productosRef.removeEventListener(listener) }
    }

    suspend fun aumentarStock(productoId: String, cantidad: Int): Result<Unit> {
        return try {
            val ref = productosRef.child(productoId).child("stock")
            val snapshot = ref.get().await()
            val stockActual = snapshot.getValue(Int::class.java) ?: 0
            ref.setValue(stockActual + cantidad).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun eliminarProducto(productoId: String): Result<Unit> {
        return try {
            productosRef.child(productoId).removeValue().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ==================== VENTAS ====================

    suspend fun registrarVenta(venta: Venta): Result<String> {
        return try {
            val ventaId = ventasRef.push().key ?: throw Exception("Error al generar ID")
            venta.id = ventaId

            val updates = HashMap<String, Any>()
            updates["/ventas/$ventaId"] = venta

            // Descontar stock de manera atómica con la venta
            // Primero obtenemos el stock actual de todos los productos involucrados
            // Nota: Esto no es una transacción completa de base de datos, pero asegura que la venta
            // y las actualizaciones de stock ocurran juntas o fallen juntas en el servidor.
            // Para mayor seguridad en concurrencia alta, se requeriría una lógica más compleja o Cloud Functions.

            for (item in venta.productos.values) {
                val productoSnapshot = productosRef.child(item.productoId).get().await()
                val producto = productoSnapshot.getValue(Producto::class.java)
                    ?: throw Exception("Producto no encontrado: ${item.nombre}")

                if (producto.stock < item.cantidad) {
                    throw Exception("Stock insuficiente para ${item.nombre}. Disponible: ${producto.stock}")
                }

                val nuevoStock = producto.stock - item.cantidad
                updates["/productos/${item.productoId}/stock"] = nuevoStock
            }

            database.reference.updateChildren(updates).await()
            Result.success(ventaId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun obtenerVentas(): Flow<List<Venta>> = callbackFlow {
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val ventas = mutableListOf<Venta>()
                for (child in snapshot.children) {
                    child.getValue(Venta::class.java)?.let { ventas.add(it) }
                }
                trySend(ventas.sortedByDescending { it.fecha })
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        ventasRef.addValueEventListener(listener)
        awaitClose { ventasRef.removeEventListener(listener) }
    }

    fun obtenerVentasPorVendedor(vendedorId: String): Flow<List<Venta>> = callbackFlow {
        val query = ventasRef.orderByChild("vendedorId").equalTo(vendedorId)

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val ventas = mutableListOf<Venta>()
                for (child in snapshot.children) {
                    child.getValue(Venta::class.java)?.let { ventas.add(it) }
                }
                trySend(ventas.sortedByDescending { it.fecha })
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        query.addValueEventListener(listener)
        awaitClose { query.removeEventListener(listener) }


    }
    // ... (el resto de tu código arriba)

    // ==================== CONFIGURACIÓN NEGOCIO ====================

    private val configRef = database.getReference("configuracion")

    suspend fun guardarDatosNegocio(datos: DatosNegocio): Result<Unit> {
        return try {
            configRef.setValue(datos).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun obtenerDatosNegocio(): Result<DatosNegocio> {
        return try {
            val snapshot = configRef.get().await()
            val datos = snapshot.getValue(DatosNegocio::class.java) ?: DatosNegocio()
            Result.success(datos)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
// Fin de la clase FirebaseRepository
