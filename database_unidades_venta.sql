USE BD_BoticaProyecto;

CREATE TABLE IF NOT EXISTS UV_UnidadVenta (
    IdUnidadVenta Int AUTO_INCREMENT PRIMARY KEY,
    IdItem Int NOT NULL,
    Nombre Varchar(50) NOT NULL,
    Abreviatura Varchar(20) NOT NULL,
    FactorConversion Int NOT NULL,
    PrecioVenta Decimal(12,2),
    EsUnidadMinima Char(1) DEFAULT 'N',
    Estado Char(1) DEFAULT 'A',
    FechaRegistro Datetime DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (IdItem, Abreviatura),
    FOREIGN KEY (IdItem) REFERENCES IT_Item(IdItem),
    CHECK (FactorConversion > 0)
) ENGINE = InnoDB;

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

DELIMITER //
CREATE PROCEDURE AddColumnIfNotExists(
    IN p_table_name Varchar(64),
    IN p_column_name Varchar(64),
    IN p_column_definition Text
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table_name
          AND COLUMN_NAME = p_column_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', p_table_name, ' ADD COLUMN ', p_column_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//
DELIMITER ;

CALL AddColumnIfNotExists('DV_DetalleVenta', 'IdUnidadVenta', 'IdUnidadVenta Int NULL AFTER IdLote');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'UnidadVenta', 'UnidadVenta Varchar(50) NULL AFTER Cantidad');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'FactorConversion', 'FactorConversion Int NOT NULL DEFAULT 1 AFTER UnidadVenta');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'CantidadUnidadesMinimas', 'CantidadUnidadesMinimas Int NOT NULL DEFAULT 0 AFTER FactorConversion');

DROP PROCEDURE AddColumnIfNotExists;

UPDATE DV_DetalleVenta
SET FactorConversion = 1
WHERE FactorConversion IS NULL OR FactorConversion <= 0;

UPDATE DV_DetalleVenta
SET CantidadUnidadesMinimas = Cantidad
WHERE CantidadUnidadesMinimas IS NULL OR CantidadUnidadesMinimas = 0;

SET @fk_dv_unidad_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'DV_DetalleVenta'
      AND CONSTRAINT_NAME = 'FK_DV_UnidadVenta'
);

SET @ddl_fk = IF(
    @fk_dv_unidad_exists = 0,
    'ALTER TABLE DV_DetalleVenta ADD CONSTRAINT FK_DV_UnidadVenta FOREIGN KEY (IdUnidadVenta) REFERENCES UV_UnidadVenta(IdUnidadVenta)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO CA_Categoria (Codigo, Nombre)
VALUES
    ('MED', 'Medicamentos'),
    ('DERM', 'Dermatologicos')
ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A';

INSERT INTO MA_Marca (Codigo, Nombre)
VALUES
    ('GEN', 'Generico'),
    ('NOVA', 'Nova Salud')
ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A';

INSERT INTO PR_Presentacion (Codigo, Nombre)
VALUES
    ('TAB', 'Tabletas'),
    ('JAR', 'Jarabe'),
    ('CRE', 'Crema'),
    ('AMP', 'Ampollas')
ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A';

SET @cat_med = (SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'MED');
SET @cat_derm = (SELECT IdCategoria FROM CA_Categoria WHERE Codigo = 'DERM');
SET @marca_gen = (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'GEN');
SET @marca_nova = (SELECT IdMarca FROM MA_Marca WHERE Codigo = 'NOVA');
SET @pres_tab = (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'TAB');
SET @pres_jar = (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'JAR');
SET @pres_cre = (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'CRE');
SET @pres_amp = (SELECT IdPresentacion FROM PR_Presentacion WHERE Codigo = 'AMP');

INSERT INTO IT_Item
(Codigo, CodigoBarras, Nombre, Descripcion, PrecioVenta, PrecioCompra, IdCategoria, IdMarca, IdPresentacion, UnidadMedida, StockMinimo, UsuarioRegistro)
VALUES
('PAR500', '775000000001', 'Paracetamol 500mg', 'Caja de 10 blisteres x 10 tabletas', 0.20, 0.10, @cat_med, @marca_gen, @pres_tab, 'tableta', 100, 'admin'),
('JAR120', '775000000002', 'Jarabe para la tos 120ml', 'Frasco de 120 ml', 0.08, 0.04, @cat_med, @marca_nova, @pres_jar, 'ml', 240, 'admin'),
('CRE030', '775000000003', 'Crema dermatologica 30g', 'Tubo de 30 gramos', 0.50, 0.25, @cat_derm, @marca_nova, @pres_cre, 'g', 90, 'admin'),
('INY001', '775000000004', 'Inyectable analgesico 1ml', 'Caja de 10 ampollas', 5.00, 3.00, @cat_med, @marca_gen, @pres_amp, 'ampolla', 20, 'admin')
ON DUPLICATE KEY UPDATE
    Nombre = VALUES(Nombre),
    Descripcion = VALUES(Descripcion),
    PrecioVenta = VALUES(PrecioVenta),
    PrecioCompra = VALUES(PrecioCompra),
    IdCategoria = VALUES(IdCategoria),
    IdMarca = VALUES(IdMarca),
    IdPresentacion = VALUES(IdPresentacion),
    UnidadMedida = VALUES(UnidadMedida),
    StockMinimo = VALUES(StockMinimo),
    Estado = 'A';

SET @paracetamol = (SELECT IdItem FROM IT_Item WHERE Codigo = 'PAR500');
SET @jarabe = (SELECT IdItem FROM IT_Item WHERE Codigo = 'JAR120');
SET @crema = (SELECT IdItem FROM IT_Item WHERE Codigo = 'CRE030');
SET @inyectable = (SELECT IdItem FROM IT_Item WHERE Codigo = 'INY001');

INSERT INTO UV_UnidadVenta (IdItem, Nombre, Abreviatura, FactorConversion, PrecioVenta, EsUnidadMinima)
VALUES
(@paracetamol, 'Tableta', 'TAB', 1, 0.20, 'S'),
(@paracetamol, 'Blister', 'BLI', 10, 2.00, 'N'),
(@paracetamol, 'Caja', 'CAJ', 100, 19.00, 'N'),
(@jarabe, 'Mililitro', 'ML', 1, 0.08, 'S'),
(@jarabe, 'Frasco 120ml', 'FRA', 120, 10.00, 'N'),
(@jarabe, 'Caja 12 frascos', 'CAJ', 1440, 110.00, 'N'),
(@crema, 'Gramo', 'G', 1, 0.50, 'S'),
(@crema, 'Tubo 30g', 'TUB', 30, 15.00, 'N'),
(@crema, 'Caja 12 tubos', 'CAJ', 360, 170.00, 'N'),
(@inyectable, 'Ampolla', 'AMP', 1, 5.00, 'S'),
(@inyectable, 'Caja 10 ampollas', 'CAJ', 10, 48.00, 'N')
ON DUPLICATE KEY UPDATE
    Nombre = VALUES(Nombre),
    FactorConversion = VALUES(FactorConversion),
    PrecioVenta = VALUES(PrecioVenta),
    EsUnidadMinima = VALUES(EsUnidadMinima),
    Estado = 'A';

INSERT INTO LT_Lote (IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
SELECT @paracetamol, 'PAR-L001', '2027-12-31', CURDATE(), 0.10, 1000, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM LT_Lote WHERE IdItem = @paracetamol AND NumeroLote = 'PAR-L001');

INSERT INTO LT_Lote (IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
SELECT @jarabe, 'JAR-L001', '2027-10-31', CURDATE(), 0.04, 2400, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM LT_Lote WHERE IdItem = @jarabe AND NumeroLote = 'JAR-L001');

INSERT INTO LT_Lote (IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
SELECT @crema, 'CRE-L001', '2028-03-31', CURDATE(), 0.25, 900, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM LT_Lote WHERE IdItem = @crema AND NumeroLote = 'CRE-L001');

INSERT INTO LT_Lote (IdItem, NumeroLote, FechaVencimiento, FechaIngreso, CostoCompraLote, StockActual, UsuarioRegistro)
SELECT @inyectable, 'INY-L001', '2027-08-31', CURDATE(), 3.00, 100, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM LT_Lote WHERE IdItem = @inyectable AND NumeroLote = 'INY-L001');
