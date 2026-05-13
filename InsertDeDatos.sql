USE botica_nova;

-- =========================
-- 	TABLAS MAESTRAS
-- ========================

INSERT INTO CA_Categoria (Codigo, Nombre) VALUES
('ANA', 'Analgésicos'),
('ATB', 'Antibióticos'),
('AIN', 'Antiinflamatorios'),
('AGR', 'Antigripales'),
('VIT', 'Vitaminas'),
('GST', 'Gastrointestinales'),
('AAL', 'Antialérgicos'),
('PED', 'Pediátricos'),
('INY', 'Inyectables');

INSERT INTO MA_Marca (Codigo, Nombre) VALUES
('BAY', 'Bayer'),
('MK', 'MK'),
('GEN', 'Genfar'),
('PFZ', 'Pfizer'),
('ABB', 'Abbott'),
('MDF', 'Medifarma'),
('BAG', 'Bagó'),
('HER', 'Hersil'),
('IQF', 'IQ Farma'),
('TEV', 'Teva');


INSERT INTO PR_Presentacion (Codigo, Nombre) VALUES
('TAB', 'Tableta'),
('CAP', 'Cápsula'),
('JAR', 'Jarabe'),
('SUS', 'Suspensión'),
('INY', 'Inyectable'),
('CRE', 'Crema'),
('GOT', 'Gotas'),
('AMP', 'Ampolla'),
('FRA', 'Frasco'),
('BLI', 'Blíster');


INSERT INTO TP_TipoPago (Codigo, Nombre) VALUES
('EFE', 'Efectivo'),
('TDB', 'Tarjeta Débito'),
('TCR', 'Tarjeta Crédito'),
('YAP', 'Yape'),
('PLI', 'Plin');

INSERT INTO TM_TipoMovimiento (Codigo, Nombre) VALUES
('ENTRADA', 'Entrada'),
('SALIDA', 'Salida'),
('AJUSTE', 'Ajuste'),
('DCL', 'Devolución Cliente'),
('DPR', 'Devolución Proveedor'),
('VNC', 'Producto Vencido');

INSERT INTO TD_TipoDocumento (Codigo, Nombre) VALUES
('DNI', 'DNI'),
('RUC', 'RUC'),
('BOL', 'Boleta'),
('FAC', 'Factura'),
('LOTE', 'Registro de lote'),
('VENTA', 'Venta'),
('AJUSTE', 'Ajuste de stock');

INSERT INTO EV_EstadoVenta (Codigo, Nombre) VALUES
('REG', 'Registrada'),
('PEN', 'Pendiente'),
('PAG', 'Pagado'),
('ANU', 'Anulado');

-- PERSONAS
INSERT INTO PE_Persona (Codigo,Nombres,Apellidos,TipoDocumento,NumeroDocumento,Telefono,Direccion) VALUES
('JSLV','Jhosep Jhair','Silva Lazo','DNI','60245903','987654321','Lima'),
('MGOZ','Maria','Gomez Torres','DNI','74581236','965214785','SJL'),
('CRAM','Carlos','Ramirez Soto','RUC','20125874125','984512365','Ate'),
('LFER','Lucia','Fernandez Ruiz','DNI','75896321','951753852','Surco'),
('PCAS','Pedro','Castillo Vega','DNI','71478596','987123654','Los Olivos');

-- PROVEEDORES
INSERT INTO PV_Proveedor (IdPersona,Codigo,RazonSocial,Ruc) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'CRAM'),'PRO1','Medifarma S.A.C.','20125874125');

-- CLIENTES
INSERT INTO CL_Cliente (IdPersona) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'LFER')),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'PCAS'));

-- USUARIOS
INSERT INTO US_Usuario (IdPersona,Username,PasswordHash,Rol) VALUES
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'JSLV'),'admin','$2b$10$kHp7bjzWVWXu.ozhAhq1ru1LqgqSRYOC4VFwkPdNJRUTD5FZANDk.','ADMIN'),
((SELECT IdPersona FROM PE_Persona WHERE Codigo = 'MGOZ'),'cajero','$2b$10$kHp7bjzWVWXu.ozhAhq1ru1LqgqSRYOC4VFwkPdNJRUTD5FZANDk.','CAJERO');

-- PRODUCTOS
INSERT INTO IT_Item
(Codigo,CodigoBarras,Nombre,Descripcion,PrecioVenta,PrecioCompra,IdCategoria,IdMarca,IdPresentacion,IdProveedor,RequiereReceta,EsControlado,UnidadMedida,StockMinimo,UsuarioRegistro) VALUES
('PAR01','775100000001','Paracetamol 500mg','Analgésico',1.00,0.40,(SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'ANA'), (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'BAY'), (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'TAB'), (SELECT IdProveedor FROM PV_Proveedor WHERE Codigo = 'PRO1'),'N','N','UND',20,'admin'),
('AMX01','775100000002','Amoxicilina 500mg','Antibiótico',2.50,1.20,(SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'ATB'), (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'GEN'), (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'CAP'), (SELECT IdProveedor FROM PV_Proveedor WHERE Codigo = 'PRO1'),'S','N','UND',15,'admin'),
('IBU01','775100000003','Ibuprofeno 400mg','Antiinflamatorio',1.80,0.90,(SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'AIN'), (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'MK'), (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'TAB'), (SELECT IdProveedor FROM PV_Proveedor WHERE Codigo = 'PRO1'),'N','N','UND',15,'admin'),
('ANT01','775100000004','Antigripal MK','Antigripal',2.20,1.10,(SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'AGR'), (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'MK'), (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'TAB'), (SELECT IdProveedor FROM PV_Proveedor WHERE Codigo = 'PRO1'),'N','N','UND',10,'admin'),
('VIT01','775100000005','Vitamina C 1g','Vitamina',1.50,0.70,(SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'VIT'), (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'ABB'), (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'TAB'), (SELECT IdProveedor FROM PV_Proveedor WHERE Codigo = 'PRO1'),'N','N','UND',20,'admin');

-- UNIDADES VENTA
INSERT INTO UV_UnidadVenta (IdItem,Nombre,Abreviatura,FactorConversion,PrecioVenta,EsUnidadMinima) VALUES
((SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR01'),'Caja x100','CAJ',100,85.00,'N'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR01'),'Blister x10','BLI',10,8.50,'N'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR01'),'Unidad','UND',1,1.00,'S'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'AMX01'),'Caja x50','CAJ',50,110.00,'N'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'AMX01'),'Capsula','CAP',1,2.50,'S');

-- LOTES
INSERT INTO LT_Lote (IdItem,NumeroLote,FechaVencimiento,FechaIngreso,CostoCompraLote,StockActual,UsuarioRegistro) VALUES
((SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR01'),'LOT-PAR-001','2027-12-31','2026-05-01',0.40,500,'admin'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'AMX01'),'LOT-AMX-001','2027-10-15','2026-05-01',1.20,300,'admin'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'IBU01'),'LOT-IBU-001','2027-08-20','2026-05-01',0.90,400,'admin'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'ANT01'),'LOT-ANT-001','2027-11-10','2026-05-01',1.10,250,'admin'),
((SELECT IdItem FROM IT_Item WHERE Codigo = 'VIT01'),'LOT-VIT-001','2028-01-15','2026-05-01',0.70,600,'admin');

-- KARDEX
INSERT INTO MI_MovimientoInventario (IdLote,IdUsuario,IdTipoMovimiento,IdTipoDocumento,NumeroDocumento,TablaReferencia,IdReferencia,CantidadEntrada,CantidadSalida,StockAnterior,StockNuevo,CostoUnitario,ValorMovimiento,MetodoCosto,Motivo) VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'),(SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'),'LOT-PAR-001','LT_Lote',(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'),500,0,0,500,0.40,200.00,'FIFO','Ingreso inicial'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMX-001'),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'),(SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'),'LOT-AMX-001','LT_Lote',(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMX-001'),300,0,0,300,1.20,360.00,'FIFO','Ingreso inicial'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-IBU-001'),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'),(SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'),'LOT-IBU-001','LT_Lote',(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-IBU-001'),400,0,0,400,0.90,360.00,'FIFO','Ingreso inicial'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ANT-001'),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'),(SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'),'LOT-ANT-001','LT_Lote',(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ANT-001'),250,0,0,250,1.10,275.00,'FIFO','Ingreso inicial'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'),(SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'),'LOT-VIT-001','LT_Lote',(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-VIT-001'),600,0,0,600,0.70,420.00,'FIFO','Ingreso inicial');

-- ALERTAS
INSERT INTO AS_AlertaStock (IdLote,TipoAlerta,Descripcion) VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMX-001'),'STOCK','Stock próximo al mínimo'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-IBU-001'),'VENCIMIENTO','Producto próximo a vencer');

-- VENTAS
INSERT INTO VE_Venta (NumeroVenta,IdCliente,IdUsuario,IdEstadoVenta,Subtotal,Igv,Total,TipoComprobante,Serie,NumeroComprobante,Observacion) VALUES
('V0001',(SELECT IdCliente FROM CL_Cliente WHERE IdPersona = (SELECT IdPersona FROM PE_Persona WHERE Codigo = 'LFER')),(SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'),(SELECT IdEstadoVenta FROM EV_EstadoVenta WHERE Codigo = 'PAG'),10.00,1.80,11.80,'BOLETA','B001','000001','Venta mostrador');

-- DETALLE VENTA
INSERT INTO DV_DetalleVenta (IdVenta,IdLote,IdUnidadVenta,Cantidad,UnidadVenta,FactorConversion,CantidadUnidadesMinimas,PrecioUnitario,Descuento,Subtotal) VALUES
((SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V0001'),(SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-PAR-001'),(SELECT IdUnidadVenta FROM UV_UnidadVenta WHERE IdItem = (SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR01') AND Abreviatura = 'UND'),5,'Unidad',1,5,1.00,0.00,5.00);

-- PAGOS
INSERT INTO PG_Pago (NumeroPago,IdVenta,MontoTotal,EstadoPago) VALUES
('P0001',(SELECT IdVenta FROM VE_Venta WHERE NumeroVenta = 'V0001'),11.80,'PAGADO');

-- DETALLE PAGOS
INSERT INTO DP_DetallePago (IdPago,IdTipoPago,Monto,Referencia) VALUES
((SELECT IdPago FROM PG_Pago WHERE NumeroPago = 'P0001'),(SELECT IdTipoPago FROM TP_TipoPago WHERE Codigo = 'EFE'),11.80,'Pago efectivo');
