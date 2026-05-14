USE botica_nova;

START TRANSACTION;

-- =========================
-- TABLAS MAESTRAS
-- =========================

INSERT INTO CA_Categoria (Codigo, Nombre) VALUES
('ANA', 'Analgesicos'),
('ATB', 'Antibioticos'),
('AIN', 'Antiinflamatorios'),
('AGR', 'Antigripales'),
('VIT', 'Vitaminas'),
('GST', 'Gastrointestinales'),
('AAL', 'Antialergicos'),
('PED', 'Pediatricos'),
('INY', 'Inyectables');

INSERT INTO MA_Marca (Codigo, Nombre) VALUES
('BAY', 'Bayer'),
('MK', 'MK'),
('GEN', 'Genfar'),
('PFZ', 'Pfizer'),
('ABB', 'Abbott'),
('MDF', 'Medifarma'),
('BAG', 'Bago'),
('HER', 'Hersil'),
('IQF', 'IQ Farma'),
('TEV', 'Teva');

INSERT INTO PR_Presentacion (Codigo, Nombre) VALUES
('TAB', 'Tableta'),
('CAP', 'Capsula'),
('JAR', 'Jarabe'),
('SUS', 'Suspension'),
('INY', 'Inyectable'),
('CRE', 'Crema'),
('GOT', 'Gotas'),
('AMP', 'Ampolla'),
('FRA', 'Frasco'),
('BLI', 'Blister');

INSERT INTO TP_TipoPago (Codigo, Nombre) VALUES
('EFE', 'Efectivo'),
('TDB', 'Tarjeta Debito'),
('TCR', 'Tarjeta Credito'),
('YAP', 'Yape'),
('PLI', 'Plin');

INSERT INTO TM_TipoMovimiento (Codigo, Nombre) VALUES
('ENTRADA', 'Entrada'),
('SALIDA', 'Salida'),
('AJUSTE', 'Ajuste'),
('DCL', 'Devolucion Cliente'),
('DPR', 'Devolucion Proveedor'),
('VNC', 'Producto Vencido'),
('TRF', 'Transferencia');

INSERT INTO TD_TipoDocumento (Codigo, Nombre) VALUES
('DNI', 'DNI'),
('RUC', 'RUC'),
('BOL', 'Boleta'),
('FAC', 'Factura'),
('LOTE', 'Registro de lote'),
('VENTA', 'Venta'),
('AJUSTE', 'Ajuste de stock');

INSERT INTO EV_EstadoVenta (Codigo, Nombre) VALUES
('PEN', 'Pendiente'),
('PAG', 'Pagado'),
('ANU', 'Anulado');

-- =========================
-- PERSONAS, PROVEEDORES, CLIENTES Y USUARIOS
-- =========================

INSERT INTO PE_Persona
(Codigo, Nombres, Apellidos, TipoDocumento, NumeroDocumento, Telefono, Correo, Direccion) VALUES
('JSLV', 'Jhosep Jhair Lamec', 'Silva Lazo', 'DNI', '60245903', '987654321', 'jhosepsilva@gmail.com', 'Ate'),
('MLDZ', 'Maria Fernanda', 'Lopez Diaz', 'DNI', '74125896', '965874123', 'maria.lopez@gmail.com', 'San Juan de Lurigancho'),
('JLTV', 'Jose Luis', 'Torres Vega', 'DNI', '78541236', '998745632', 'jose.torres@gmail.com', 'Ate'),
('APRS', 'Ana Patricia', 'Rojas Silva', 'DNI', '74123698', '987123654', 'ana.rojas@gmail.com', 'Comas'),
('LEPR', 'Luis Enrique', 'Paredes Ruiz', 'DNI', '78965412', '945612378', 'luis.paredes@gmail.com', 'Santiago de Surco'),
('DFNS', 'Distribuidora Farmaceutica', 'Norte SAC', 'RUC', '20125896314', '958963214', 'ventas@dfn.com', 'Lima'),
('LPSA', 'Laboratorios Peruanos', 'SAC', 'RUC', '20547896321', '947896321', 'contacto@labperu.com', 'Lima'),
('BSVS', 'Boticas Salud', 'Vida SAC', 'RUC', '20658974125', '956321478', 'ventas@saludvida.com', 'Callao');

INSERT INTO PV_Proveedor (IdPersona, Codigo, RazonSocial, Ruc) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'DFNS'), 'PRO001', 'Distribuidora Farmaceutica Norte SAC', '20125896314'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'LPSA'), 'PRO002', 'Laboratorios Peruanos SAC', '20547896321'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'BSVS'), 'PRO003', 'Boticas Salud Vida SAC', '20658974125');

INSERT INTO CL_Cliente (IdPersona, CodigoCliente) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'JSLV'), 'CLI-JSLV'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'MLDZ'), 'CLI-MLDZ'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'JLTV'), 'CLI-JLTV'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'APRS'), 'CLI-APRS'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'LEPR'), 'CLI-LEPR');

INSERT INTO US_Usuario (IdPersona, Username, PasswordHash, Rol) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'JSLV'), 'admin', '$2b$10$wudTrbUFLiWO2nm3jtjyn.7Z0UXMXe1nllhxCSnIbVLdjl/uUGHNm', 'ADMIN'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'MLDZ'), 'cajero', '$2b$10$wudTrbUFLiWO2nm3jtjyn.7Z0UXMXe1nllhxCSnIbVLdjl/uUGHNm', 'CAJERO');

-- =========================
-- PRODUCTOS REALES - PERU
-- =========================

INSERT INTO IT_Item
(
Codigo,
CodigoBarras,
Nombre,
Descripcion,
PrecioVenta,
PrecioCompra,
IdCategoria,
IdMarca,
IdPresentacion,
IdProveedor,
RequiereReceta,
EsControlado,
UnidadMedida,
StockMinimo,
UsuarioRegistro
)
VALUES
('MED001', '775100000001', 'Paracetamol 500mg', 'Tabletas para dolor y fiebre', 1.50, 0.80, 1, 1, 1, 1, 'N', 'N', 'UND', 20, 'admin'),
('MED002', '775100000002', 'Panadol Extra', 'Tabletas analgesicas y antipireticas', 2.50, 1.40, 1, 1, 1, 1, 'N', 'N', 'UND', 15, 'admin'),
('MED003', '775100000003', 'Dolocordralan', 'Tabletas para dolor muscular', 3.20, 1.80, 1, 7, 1, 2, 'N', 'N', 'UND', 12, 'admin'),
('MED004', '775100000004', 'Aspirina 500mg', 'Tabletas analgesicas', 1.80, 0.90, 1, 1, 1, 1, 'N', 'N', 'UND', 20, 'admin'),
('MED005', '775100000005', 'Ibuprofeno 400mg', 'Antiinflamatorio en tabletas', 2.00, 1.10, 3, 2, 1, 2, 'N', 'N', 'UND', 15, 'admin'),
('MED006', '775100000006', 'Diclofenaco 50mg', 'Antiinflamatorio en tabletas', 2.80, 1.50, 3, 9, 1, 1, 'N', 'N', 'UND', 15, 'admin'),
('MED007', '775100000007', 'Naproxeno Sodico', 'Antiinflamatorio y analgesico', 3.50, 2.00, 3, 3, 1, 2, 'N', 'N', 'UND', 10, 'admin'),
('MED008', '775100000008', 'Diclofenaco Inyectable', 'Ampolla antiinflamatoria', 4.00, 2.20, 9, 9, 8, 1, 'S', 'N', 'AMP', 10, 'admin'),
('MED009', '775100000009', 'Amoxicilina 500mg', 'Antibiotico en capsulas', 3.50, 2.00, 2, 4, 2, 2, 'S', 'N', 'UND', 10, 'admin'),
('MED010', '775100000010', 'Azitromicina 500mg', 'Antibiotico de amplio espectro', 5.50, 3.20, 2, 10, 1, 2, 'S', 'N', 'UND', 10, 'admin'),
('MED011', '775100000011', 'Cefalexina 500mg', 'Antibiotico oral', 4.20, 2.50, 2, 3, 2, 2, 'S', 'N', 'UND', 10, 'admin'),
('MED012', '775100000012', 'Clindamicina 300mg', 'Antibiotico en capsulas', 6.50, 4.00, 2, 5, 2, 1, 'S', 'N', 'UND', 8, 'admin'),
('MED013', '775100000013', 'Panadol Antigripal', 'Alivio de sintomas de gripe', 2.80, 1.60, 4, 1, 10, 1, 'N', 'N', 'UND', 15, 'admin'),
('MED014', '775100000014', 'Tabcin Noche', 'Antigripal nocturno', 3.80, 2.10, 4, 5, 1, 2, 'N', 'N', 'UND', 10, 'admin'),
('MED015', '775100000015', 'Nastizol Dia', 'Antigripal diurno', 3.50, 2.00, 4, 6, 1, 1, 'N', 'N', 'UND', 12, 'admin'),
('MED016', '775100000016', 'Desenfriol D', 'Antigripal descongestionante', 4.00, 2.20, 4, 8, 1, 3, 'N', 'N', 'UND', 12, 'admin'),
('MED017', '775100000017', 'Vitamina C 1g', 'Suplemento vitaminico', 1.20, 0.60, 5, 3, 1, 3, 'N', 'N', 'UND', 30, 'admin'),
('MED018', '775100000018', 'Redoxon', 'Vitamina C efervescente', 2.50, 1.40, 5, 1, 1, 1, 'N', 'N', 'UND', 20, 'admin'),
('MED019', '775100000019', 'Supradyn', 'Multivitaminico', 3.80, 2.20, 5, 4, 1, 2, 'N', 'N', 'UND', 15, 'admin'),
('MED020', '775100000020', 'Bedoyecta', 'Complejo vitaminico inyectable', 5.00, 3.20, 5, 9, 8, 1, 'N', 'N', 'AMP', 10, 'admin'),
('MED021', '775100000021', 'Omeprazol 20mg', 'Protector gastrico', 2.20, 1.10, 6, 5, 2, 1, 'N', 'N', 'UND', 15, 'admin'),
('MED022', '775100000022', 'Sal de Andrews', 'Antiacido digestivo', 1.50, 0.70, 6, 7, 1, 2, 'N', 'N', 'UND', 20, 'admin'),
('MED023', '775100000023', 'Hepabionta', 'Protector hepatico', 4.50, 2.80, 6, 6, 1, 3, 'N', 'N', 'UND', 10, 'admin'),
('MED024', '775100000024', 'Digestase', 'Digestivo enzimatico', 3.50, 1.90, 6, 8, 1, 3, 'N', 'N', 'UND', 10, 'admin'),
('MED025', '775100000025', 'Loratadina 10mg', 'Antialergico en tabletas', 2.00, 1.00, 7, 8, 1, 3, 'N', 'N', 'UND', 15, 'admin'),
('MED026', '775100000026', 'Cetirizina 10mg', 'Antialergico oral', 2.20, 1.20, 7, 2, 1, 2, 'N', 'N', 'UND', 12, 'admin'),
('MED027', '775100000027', 'Alercet D', 'Antialergico descongestionante', 3.80, 2.00, 7, 3, 1, 2, 'N', 'N', 'UND', 10, 'admin'),
('MED028', '775100000028', 'Panadol Ninos', 'Jarabe pediatrico', 8.50, 5.20, 8, 1, 3, 1, 'N', 'N', 'FRA', 10, 'admin'),
('MED029', '775100000029', 'Apronax Pediatrico', 'Suspension pediatrica', 9.00, 5.80, 8, 7, 4, 2, 'N', 'N', 'FRA', 8, 'admin'),
('MED030', '775100000030', 'Amoxicilina Suspension', 'Antibiotico pediatrico', 12.50, 8.00, 8, 4, 4, 2, 'S', 'N', 'FRA', 8, 'admin');

-- =========================
-- UNIDADES DE VENTA
-- =========================

INSERT INTO UV_UnidadVenta (IdItem, Nombre, Abreviatura, FactorConversion, PrecioVenta, EsUnidadMinima) VALUES
(1, 'Tableta', 'TAB', 1, 1.50, 'S'),
(1, 'Blister x10', 'BLI', 10, 14.00, 'N'),
(1, 'Caja x100', 'CAJ', 100, 135.00, 'N'),
(2, 'Tableta', 'TAB', 1, 2.50, 'S'),
(2, 'Blister x10', 'BLI', 10, 25.00, 'N'),
(3, 'Tableta', 'TAB', 1, 3.20, 'S'),
(3, 'Caja x12', 'CAJ', 12, 36.00, 'N'),
(4, 'Tableta', 'TAB', 1, 1.80, 'S'),
(5, 'Tableta', 'TAB', 1, 2.00, 'S'),
(5, 'Blister x10', 'BLI', 10, 19.00, 'N'),
(6, 'Tableta', 'TAB', 1, 2.80, 'S'),
(6, 'Blister x10', 'BLI', 10, 26.00, 'N'),
(7, 'Tableta', 'TAB', 1, 3.50, 'S'),
(8, 'Ampolla', 'AMP', 1, 4.00, 'S'),
(8, 'Caja x10 ampollas', 'CAJ', 10, 38.00, 'N'),
(9, 'Capsula', 'CAP', 1, 3.50, 'S'),
(9, 'Caja x50 capsulas', 'CAJ', 50, 160.00, 'N'),
(10, 'Tableta', 'TAB', 1, 5.50, 'S'),
(10, 'Caja x3 tabletas', 'CAJ', 3, 15.00, 'N'),
(11, 'Capsula', 'CAP', 1, 4.20, 'S'),
(12, 'Capsula', 'CAP', 1, 6.50, 'S'),
(13, 'Tableta', 'TAB', 1, 2.80, 'S'),
(13, 'Blister x10', 'BLI', 10, 26.00, 'N'),
(14, 'Tableta', 'TAB', 1, 3.80, 'S'),
(15, 'Tableta', 'TAB', 1, 3.50, 'S'),
(16, 'Tableta', 'TAB', 1, 4.00, 'S'),
(17, 'Tableta', 'TAB', 1, 1.20, 'S'),
(17, 'Blister x10', 'BLI', 10, 11.00, 'N'),
(18, 'Tableta efervescente', 'TAB', 1, 2.50, 'S'),
(19, 'Tableta', 'TAB', 1, 3.80, 'S'),
(20, 'Ampolla', 'AMP', 1, 5.00, 'S'),
(21, 'Capsula', 'CAP', 1, 2.20, 'S'),
(21, 'Blister x10', 'BLI', 10, 20.00, 'N'),
(22, 'Sobre', 'SOB', 1, 1.50, 'S'),
(23, 'Tableta', 'TAB', 1, 4.50, 'S'),
(24, 'Tableta', 'TAB', 1, 3.50, 'S'),
(25, 'Tableta', 'TAB', 1, 2.00, 'S'),
(25, 'Blister x10', 'BLI', 10, 19.00, 'N'),
(26, 'Tableta', 'TAB', 1, 2.20, 'S'),
(27, 'Tableta', 'TAB', 1, 3.80, 'S'),
(28, 'Frasco', 'FRA', 1, 8.50, 'S'),
(29, 'Frasco', 'FRA', 1, 9.00, 'S'),
(30, 'Frasco', 'FRA', 1, 12.50, 'S');

-- =========================
-- LOTES
-- =========================

INSERT INTO LT_Lote
(IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
VALUES
(1, 'LOT-PAR-001', '2027-12-31', '2026-05-01', 0.80, 190, 'admin'),
(2, 'LOT-PANX-001', '2027-10-15', '2026-05-01', 1.40, 140, 'admin'),
(3, 'LOT-DOL-001', '2027-08-20', '2026-05-02', 1.80, 100, 'admin'),
(13, 'LOT-PANG-001', '2027-11-10', '2026-05-02', 1.60, 120, 'admin'),
(17, 'LOT-VIT-001', '2028-01-05', '2026-05-03', 0.60, 245, 'admin'),
(21, 'LOT-OME-001', '2027-09-25', '2026-05-03', 1.10, 176, 'admin'),
(25, 'LOT-LOR-001', '2026-12-30', '2026-05-04', 1.00, 60, 'admin'),
(28, 'LOT-PED-001', '2026-11-18', '2026-05-04', 5.20, 70, 'admin'),
(8, 'LOT-DIC-INY-001', '2027-07-15', '2026-05-05', 2.20, 90, 'admin'),
(10, 'LOT-AZI-001', '2027-06-28', '2026-05-05', 3.20, 110, 'admin');

-- =========================
-- KARDEX / MOVIMIENTOS DE INVENTARIO
-- =========================

INSERT INTO MI_MovimientoInventario
(
IdLote,
IdUsuario,
IdTipoMovimiento,
IdTipoDocumento,
NumeroDocumento,
TablaReferencia,
IdReferencia,
CantidadEntrada,
CantidadSalida,
StockAnterior,
StockNuevo,
CostoUnitario,
ValorMovimiento,
MetodoCosto,
Motivo
)
VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-PAR-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'), 200, 0, 0, 200, 0.80, 160.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANX-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-PANX-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANX-001'), 150, 0, 0, 150, 1.40, 210.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DOL-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-DOL-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DOL-001'), 100, 0, 0, 100, 1.80, 180.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANG-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-PANG-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANG-001'), 120, 0, 0, 120, 1.60, 192.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-VIT-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'), 250, 0, 0, 250, 0.60, 150.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-OME-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-OME-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-OME-001'), 180, 0, 0, 180, 1.10, 198.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-LOR-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-LOR-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-LOR-001'), 60, 0, 0, 60, 1.00, 60.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PED-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-PED-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PED-001'), 70, 0, 0, 70, 5.20, 364.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIC-INY-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-DIC-INY-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIC-INY-001'), 90, 0, 0, 90, 2.20, 198.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AZI-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-AZI-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AZI-001'), 110, 0, 0, 110, 3.20, 352.00, 'FIFO', 'Ingreso inicial de lote');

-- =========================
-- ALERTAS STOCK
-- =========================

INSERT INTO AS_AlertaStock (IdLote, TipoAlerta, Descripcion) VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-LOR-001'), 'VENCIMIENTO', 'Producto proximo a vencer en menos de 6 meses'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PED-001'), 'STOCK_MINIMO', 'Producto con stock cercano al minimo permitido');

-- =========================
-- VENTAS
-- =========================

INSERT INTO VE_Venta
(
NumeroVenta,
IdCliente,
IdUsuario,
IdEstadoVenta,
Subtotal,
Igv,
Total,
TipoComprobante,
Serie,
NumeroComprobante,
Moneda,
TipoCambio,
Observacion
)
VALUES
('V000001', (SELECT IdCliente FROM CL_Cliente WHERE CodigoCliente = 'CLI-JSLV'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdEstadoVenta FROM EV_EstadoVenta WHERE Codigo = 'PAG'), 25.00, 4.50, 29.50, 'Boleta', 'B001', '000001', 'PEN', 1.0000, 'Venta mostrador pagada'),
('V000002', (SELECT IdCliente FROM CL_Cliente WHERE CodigoCliente = 'CLI-MLDZ'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdEstadoVenta FROM EV_EstadoVenta WHERE Codigo = 'PAG'), 12.54, 2.26, 14.80, 'Boleta', 'B001', '000002', 'PEN', 1.0000, 'Venta rapida pagada'),
('V000003', (SELECT IdCliente FROM CL_Cliente WHERE CodigoCliente = 'CLI-JLTV'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdEstadoVenta FROM EV_EstadoVenta WHERE Codigo = 'PEN'), 30.51, 5.49, 36.00, 'Factura', 'F001', '000001', 'PEN', 1.0000, 'Pedido pendiente de pago');

INSERT INTO DV_DetalleVenta
(
IdVenta,
IdLote,
IdUnidadVenta,
Cantidad,
UnidadVenta,
FactorConversion,
CantidadUnidadesMinimas,
PrecioUnitario,
Descuento,
Subtotal
)
VALUES
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000001'), (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'), (SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = 1 AND Abreviatura = 'BLI'), 1, 'Blister x10', 10, 10, 14.00, 0.00, 14.00),
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000001'), (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANX-001'), (SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = 2 AND Abreviatura = 'BLI'), 1, 'Blister x10', 10, 10, 18.00, 2.50, 15.50),
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000002'), (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'), (SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = 17 AND Abreviatura = 'TAB'), 5, 'Tableta', 1, 5, 1.20, 0.00, 6.00),
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000002'), (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-OME-001'), (SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = 21 AND Abreviatura = 'CAP'), 4, 'Capsula', 1, 4, 2.20, 0.00, 8.80),
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000003'), (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DOL-001'), (SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = 3 AND Abreviatura = 'CAJ'), 1, 'Caja x12', 12, 12, 36.00, 0.00, 36.00);

INSERT INTO MI_MovimientoInventario
(
IdLote,
IdUsuario,
IdTipoMovimiento,
IdTipoDocumento,
NumeroDocumento,
TablaReferencia,
IdReferencia,
CantidadEntrada,
CantidadSalida,
StockAnterior,
StockNuevo,
CostoUnitario,
ValorMovimiento,
MetodoCosto,
Motivo
)
VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'SALIDA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'VENTA'), 'Boleta B001-000001', 'VE_Venta', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000001'), 0, 10, 200, 190, 0.80, 8.00, 'FIFO', 'Salida por venta V000001'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PANX-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'SALIDA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'VENTA'), 'Boleta B001-000001', 'VE_Venta', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000001'), 0, 10, 150, 140, 1.40, 14.00, 'FIFO', 'Salida por venta V000001'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'SALIDA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'VENTA'), 'Boleta B001-000002', 'VE_Venta', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000002'), 0, 5, 250, 245, 0.60, 3.00, 'FIFO', 'Salida por venta V000002'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-OME-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'cajero'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'SALIDA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'VENTA'), 'Boleta B001-000002', 'VE_Venta', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000002'), 0, 4, 180, 176, 1.10, 4.40, 'FIFO', 'Salida por venta V000002');

-- =========================
-- PAGOS
-- =========================

INSERT INTO PG_Pago (NumeroPago, IdVenta, MontoTotal, EstadoPago) VALUES
('P000001', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000001'), 29.50, 'PAGADO'),
('P000002', (SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V000002'), 14.80, 'PAGADO');

INSERT INTO DP_DetallePago (IdPago, IdTipoPago, Monto, Referencia) VALUES
((SELECT IdPago FROM PG_Pago WHERE NumeroPago = 'P000001'), (SELECT IdTipoPago FROM TP_TipoPago WHERE Codigo = 'EFE'), 29.50, 'Pago efectivo en caja'),
((SELECT IdPago FROM PG_Pago WHERE NumeroPago = 'P000002'), (SELECT IdTipoPago FROM TP_TipoPago WHERE Codigo = 'YAP'), 14.80, 'Operacion Yape 998877');

COMMIT;
