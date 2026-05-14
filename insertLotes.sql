START TRANSACTION;

-- =========================
-- LOTES ADICIONALES (Para los 20 productos restantes)
-- =========================

INSERT INTO LT_Lote
(IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
VALUES
(4, 'LOT-ASP-001', '2028-02-15', '2026-05-10', 0.90, 150, 'admin'),
(5, 'LOT-IBU-001', '2027-11-20', '2026-05-10', 1.10, 200, 'admin'),
(6, 'LOT-DIC-001', '2027-08-10', '2026-05-10', 1.50, 120, 'admin'),
(7, 'LOT-NAP-001', '2028-03-01', '2026-05-10', 2.00, 100, 'admin'),
(9, 'LOT-AMX-001', '2027-05-30', '2026-05-11', 2.00, 80, 'admin'),
(11, 'LOT-CEF-001', '2027-09-15', '2026-05-11', 2.50, 90, 'admin'),
(12, 'LOT-CLI-001', '2028-01-20', '2026-05-11', 4.00, 50, 'admin'),
(14, 'LOT-TNO-001', '2027-06-10', '2026-05-12', 2.10, 100, 'admin'),
(15, 'LOT-NDI-001', '2027-06-10', '2026-05-12', 2.00, 110, 'admin'),
(16, 'LOT-DES-001', '2027-10-05', '2026-05-12', 2.20, 130, 'admin'),
(18, 'LOT-RED-001', '2028-04-15', '2026-05-13', 1.40, 160, 'admin'),
(19, 'LOT-SUP-001', '2028-02-28', '2026-05-13', 2.20, 90, 'admin'),
(20, 'LOT-BED-001', '2027-11-10', '2026-05-13', 3.20, 40, 'admin'),
(22, 'LOT-SAL-001', '2028-08-20', '2026-05-14', 0.70, 300, 'admin'),
(23, 'LOT-HEP-001', '2027-12-12', '2026-05-14', 2.80, 80, 'admin'),
(24, 'LOT-DIG-001', '2028-01-15', '2026-05-14', 1.90, 75, 'admin'),
(26, 'LOT-CET-001', '2027-07-25', '2026-05-14', 1.20, 140, 'admin'),
(27, 'LOT-ALD-001', '2027-09-30', '2026-05-14', 2.00, 85, 'admin'),
(29, 'LOT-APP-001', '2027-04-10', '2026-05-14', 5.80, 45, 'admin'),
(30, 'LOT-AMS-001', '2027-05-15', '2026-05-14', 8.00, 60, 'admin');

-- =========================
-- KARDEX / MOVIMIENTOS DE INVENTARIO (ENTRADAS DE LOS LOTES NUEVOS)
-- =========================

INSERT INTO MI_MovimientoInventario
(IdLote, IdUsuario, IdTipoMovimiento, IdTipoDocumento, NumeroDocumento, TablaReferencia, IdReferencia, CantidadEntrada, CantidadSalida, StockAnterior, StockNuevo, CostoUnitario, ValorMovimiento, MetodoCosto, Motivo) 
VALUES
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ASP-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-ASP-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ASP-001'), 150, 0, 0, 150, 0.90, 135.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-IBU-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-IBU-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-IBU-001'), 200, 0, 0, 200, 1.10, 220.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIC-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-DIC-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIC-001'), 120, 0, 0, 120, 1.50, 180.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-NAP-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-NAP-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-NAP-001'), 100, 0, 0, 100, 2.00, 200.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMX-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-AMX-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMX-001'), 80, 0, 0, 80, 2.00, 160.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CEF-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-CEF-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CEF-001'), 90, 0, 0, 90, 2.50, 225.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CLI-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-CLI-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CLI-001'), 50, 0, 0, 50, 4.00, 200.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-TNO-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-TNO-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-TNO-001'), 100, 0, 0, 100, 2.10, 210.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-NDI-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-NDI-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-NDI-001'), 110, 0, 0, 110, 2.00, 220.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DES-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-DES-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DES-001'), 130, 0, 0, 130, 2.20, 286.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-RED-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-RED-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-RED-001'), 160, 0, 0, 160, 1.40, 224.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-SUP-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-SUP-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-SUP-001'), 90, 0, 0, 90, 2.20, 198.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-BED-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-BED-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-BED-001'), 40, 0, 0, 40, 3.20, 128.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-SAL-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-SAL-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-SAL-001'), 300, 0, 0, 300, 0.70, 210.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-HEP-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-HEP-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-HEP-001'), 80, 0, 0, 80, 2.80, 224.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIG-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-DIG-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-DIG-001'), 75, 0, 0, 75, 1.90, 142.50, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CET-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-CET-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-CET-001'), 140, 0, 0, 140, 1.20, 168.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ALD-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-ALD-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-ALD-001'), 85, 0, 0, 85, 2.00, 170.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-APP-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-APP-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-APP-001'), 45, 0, 0, 45, 5.80, 261.00, 'FIFO', 'Ingreso inicial de lote'),
((SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMS-001'), (SELECT IdUsuario FROM US_Usuario WHERE Username = 'admin'), (SELECT IdTipoMovimiento FROM TM_TipoMovimiento WHERE Codigo = 'ENTRADA'), (SELECT IdTipoDocumento FROM TD_TipoDocumento WHERE Codigo = 'LOTE'), 'LOT-AMS-001', 'LT_Lote', (SELECT IdLote FROM LT_Lote WHERE NumeroLote = 'LOT-AMS-001'), 60, 0, 0, 60, 8.00, 480.00, 'FIFO', 'Ingreso inicial de lote');

COMMIT;