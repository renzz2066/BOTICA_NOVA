-- Script idempotente para corregir columnas faltantes del proyecto Botica Nova

USE botica_nova;

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

ALTER TABLE PE_Persona MODIFY COLUMN Codigo Varchar(10) NULL;
ALTER TABLE PV_Proveedor MODIFY COLUMN Codigo Varchar(10) NULL;

CALL AddColumnIfNotExists('PE_Persona', 'Correo', 'Correo Varchar(100) NULL AFTER Telefono');
CALL AddColumnIfNotExists('CL_Cliente', 'CodigoCliente', 'CodigoCliente Varchar(20) NULL UNIQUE AFTER IdPersona');
CALL AddColumnIfNotExists('UV_UnidadVenta', 'Abreviatura', 'Abreviatura Varchar(20) NULL AFTER Nombre');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'UnidadVenta', 'UnidadVenta Varchar(50) NULL AFTER Cantidad');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'FactorConversion', 'FactorConversion Int NOT NULL DEFAULT 1 AFTER UnidadVenta');
CALL AddColumnIfNotExists('DV_DetalleVenta', 'CantidadUnidadesMinimas', 'CantidadUnidadesMinimas Int NOT NULL DEFAULT 0 AFTER FactorConversion');

SET @has_codigo_unidad = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'UV_UnidadVenta'
      AND COLUMN_NAME = 'Codigo'
);

SET @ddl_codigo_unidad = IF(
    @has_codigo_unidad > 0,
    'ALTER TABLE UV_UnidadVenta MODIFY COLUMN Codigo Varchar(20) NULL',
    'SELECT 1'
);

PREPARE stmt FROM @ddl_codigo_unidad;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl_update_abreviatura = IF(
    @has_codigo_unidad > 0,
    "UPDATE UV_UnidadVenta SET Abreviatura = COALESCE(NULLIF(Abreviatura, ''), NULLIF(Codigo, ''), UPPER(LEFT(Nombre, 20)), 'UND') WHERE Abreviatura IS NULL OR Abreviatura = ''",
    "UPDATE UV_UnidadVenta SET Abreviatura = COALESCE(NULLIF(Abreviatura, ''), UPPER(LEFT(Nombre, 20)), 'UND') WHERE Abreviatura IS NULL OR Abreviatura = ''"
);

PREPARE stmt FROM @ddl_update_abreviatura;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE UV_UnidadVenta MODIFY COLUMN Abreviatura Varchar(20) NOT NULL;
ALTER TABLE DV_DetalleVenta MODIFY COLUMN IdUnidadVenta Int NULL;

UPDATE DV_DetalleVenta
SET FactorConversion = 1
WHERE FactorConversion IS NULL OR FactorConversion <= 0;

UPDATE DV_DetalleVenta
SET CantidadUnidadesMinimas = Cantidad * FactorConversion
WHERE CantidadUnidadesMinimas IS NULL OR CantidadUnidadesMinimas = 0;

SET @idx_unidad_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'UV_UnidadVenta'
          AND NON_UNIQUE = 0
        GROUP BY INDEX_NAME
        HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') = 'IdItem,Abreviatura'
    ) indices
);

SET @ddl_idx_unidad = IF(
    @idx_unidad_exists = 0,
    'CREATE UNIQUE INDEX UX_UV_Item_Abreviatura ON UV_UnidadVenta (IdItem, Abreviatura)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl_idx_unidad;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP PROCEDURE AddColumnIfNotExists;

SELECT 'Columnas corregidas correctamente' AS Mensaje;
