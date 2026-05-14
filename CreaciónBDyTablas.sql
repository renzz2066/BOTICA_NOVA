
DROP DATABASE IF EXISTS botica_nova;
CREATE DATABASE botica_nova;
USE botica_nova;

CREATE TABLE CA_Categoria (
    IdCategoria        Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             Varchar(5) NOT NULL UNIQUE,
    Nombre             Varchar(100) NOT NULL,
    Estado             Char(1) DEFAULT 'A',
    FechaRegistro      Datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE MA_Marca (
    IdMarca            Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             Varchar(5) NOT NULL UNIQUE,
    Nombre             Varchar(100) NOT NULL,
    Estado             Char(1) DEFAULT 'A'
) ENGINE = InnoDB;

CREATE TABLE PR_Presentacion (
    IdPresentacion     Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             Varchar(5) NOT NULL UNIQUE,
    Nombre             Varchar(100) NOT NULL,
    Estado             Char(1) DEFAULT 'A'
) ENGINE = InnoDB;

CREATE TABLE TP_TipoPago (
    IdTipoPago         Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             Varchar(5) NOT NULL UNIQUE,
    Nombre             Varchar(50) NOT NULL,
    Estado             Char(1) DEFAULT 'A'
) ENGINE = InnoDB;

CREATE TABLE TM_TipoMovimiento (
    IdTipoMovimiento   	Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             	Varchar(10) NOT NULL UNIQUE,
    Nombre             	Varchar(50) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE TD_TipoDocumento (
    IdTipoDocumento    	Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             	Varchar(10) NOT NULL UNIQUE,
    Nombre             	Varchar(50) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE EV_EstadoVenta (
    IdEstadoVenta      	Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             	Varchar(5) NOT NULL UNIQUE,
    Nombre             	Varchar(50)
) ENGINE = InnoDB;

-- =========================================
-- PERSONAS
-- =========================================

CREATE TABLE PE_Persona (
    IdPersona          Int AUTO_INCREMENT PRIMARY KEY,
    Codigo			   Varchar(10) UNIQUE,
    Nombres            Varchar(100) NOT NULL,
    Apellidos          Varchar(100) NOT NULL,
    TipoDocumento      Varchar(20),
    NumeroDocumento    Varchar(20) UNIQUE,
    Telefono           Varchar(20),
    Correo             Varchar(100),
    Direccion          Varchar(150),
    Estado             Char(1) DEFAULT 'A',

    CHECK (Telefono IS NULL OR Telefono = '' OR Telefono REGEXP '^9[0-9]{8}$'),
    CHECK (Correo IS NULL OR Correo = '' OR (Correo LIKE '%@%.%' AND Correo NOT LIKE '% %')),
    CHECK (TipoDocumento IS NULL OR TipoDocumento NOT IN ('DNI', 'RUC') OR (TipoDocumento = 'DNI' AND NumeroDocumento REGEXP '^[0-9]{8}$') OR (TipoDocumento = 'RUC' AND NumeroDocumento REGEXP '^[0-9]{11}$'))
) ENGINE = InnoDB;

CREATE TABLE PV_Proveedor (
    IdProveedor        Int AUTO_INCREMENT PRIMARY KEY,
    IdPersona          Int NOT NULL UNIQUE,
    Codigo	   		   Varchar(10) UNIQUE,
    RazonSocial        Varchar(150),
    Ruc                Varchar(20) UNIQUE,
    Estado             Char(1) DEFAULT 'A',

    CHECK (Ruc REGEXP '^[0-9]{11}$'),
    FOREIGN KEY (IdPersona) REFERENCES PE_Persona(IdPersona)
) ENGINE = InnoDB;

CREATE TABLE CL_Cliente (
    IdCliente          Int AUTO_INCREMENT PRIMARY KEY,
    IdPersona          Int NOT NULL UNIQUE,
    CodigoCliente      Varchar(20) UNIQUE,
    Estado             Char(1) DEFAULT 'A',

    FOREIGN KEY (IdPersona) REFERENCES PE_Persona(IdPersona)
) ENGINE = InnoDB;

CREATE TABLE US_Usuario (
    IdUsuario          Int AUTO_INCREMENT PRIMARY KEY,
    IdPersona          Int NOT NULL UNIQUE,
    Username           Varchar(50) UNIQUE,
    PasswordHash       Varchar(255),
    Rol                Varchar(50),
    Estado             Char(1) DEFAULT 'A',
    FechaUltimoLogin   Datetime,
    IntentosFallidos   Int DEFAULT 0,

    FOREIGN KEY (IdPersona) REFERENCES PE_Persona(IdPersona)
) ENGINE = InnoDB;

-- =========================================
-- PRODUCTOS
-- =========================================

CREATE TABLE IT_Item (
    IdItem             Int AUTO_INCREMENT PRIMARY KEY,
    Codigo             Varchar(50) UNIQUE,
    CodigoBarras       Varchar(100) UNIQUE,
    Nombre             Varchar(150) NOT NULL,
    Descripcion        Varchar(255),
    PrecioVenta        Decimal(12,2) NOT NULL,
    PrecioCompra       Decimal(12,2),
    IdCategoria        Int NOT NULL,
    IdMarca            Int NOT NULL,
    IdPresentacion     Int NOT NULL,
    IdProveedor        Int NULL,
    RequiereReceta     Char(1) DEFAULT 'N',
    EsControlado       Char(1) DEFAULT 'N',
    UnidadMedida       Varchar(10),
    StockMinimo        Int DEFAULT 0,
    Estado             Char(1) DEFAULT 'A',
    UsuarioRegistro    Varchar(20),
    FechaRegistro      Datetime DEFAULT CURRENT_TIMESTAMP,
    UsuarioModifica    Varchar(20),
    FechaModifica      Datetime,

    FOREIGN KEY (IdCategoria)    REFERENCES CA_Categoria(IdCategoria),
    FOREIGN KEY (IdMarca)        REFERENCES MA_Marca(IdMarca),
    FOREIGN KEY (IdPresentacion) REFERENCES PR_Presentacion(IdPresentacion),
    FOREIGN KEY (IdProveedor)    REFERENCES PV_Proveedor(IdProveedor)
) ENGINE = InnoDB;

CREATE INDEX idx_item_categoria ON IT_Item(IdCategoria);

-- =========================================
-- UNIDADES DE VENTA
-- =========================================

CREATE TABLE UV_UnidadVenta (
    IdUnidadVenta      Int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    IdItem             Int NOT NULL,
    Nombre             Varchar(50) NOT NULL,
    Abreviatura        Varchar(20) NOT NULL,
    FactorConversion   Int NOT NULL,
    PrecioVenta        Decimal(12,2),
    EsUnidadMinima     Char(1) DEFAULT 'N',
    Estado             Char(1) DEFAULT 'A',
    FechaRegistro      Datetime DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (IdItem, Abreviatura),
    FOREIGN KEY (IdItem) 		REFERENCES IT_Item(IdItem),

    CHECK (FactorConversion > 0),
    CHECK (PrecioVenta IS NULL OR PrecioVenta >= 0),
    CHECK (EsUnidadMinima IN ('S', 'N'))
) ENGINE = InnoDB;

-- =========================================
-- LOTES
-- =========================================

CREATE TABLE LT_Lote (
    IdLote             Int AUTO_INCREMENT PRIMARY KEY,
    IdItem             Int NOT NULL,
    NumeroLote         Varchar(50) NOT NULL UNIQUE,
    FechaVencimiento   Date,
    FechaIngreso       Date,
    CostoCompraLote    Decimal(12,2),
    StockActual        Int NOT NULL,
    Estado             Char(1) DEFAULT 'A',
    UsuarioRegistro    Varchar(20),
    FechaRegistro      Datetime DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (IdItem) REFERENCES IT_Item(IdItem),
    CHECK (StockActual >= 0),
    CHECK (CostoCompraLote IS NULL OR CostoCompraLote >= 0)
) ENGINE = InnoDB;

CREATE INDEX idx_lote_item ON LT_Lote(IdItem);

-- =========================================
-- KARDEX (MOVIMIENTO INVENTARIO)
-- =========================================

CREATE TABLE MI_MovimientoInventario (
    IdMovimiento        Int AUTO_INCREMENT PRIMARY KEY,
    IdLote              Int NOT NULL,
    IdUsuario           Int NULL,
    IdTipoMovimiento    Int NOT NULL,
    IdTipoDocumento     Int NOT NULL,
    NumeroDocumento     Varchar(50),
    TablaReferencia     Varchar(50),
    IdReferencia        Int,
    CantidadEntrada     Int DEFAULT 0,
    CantidadSalida      Int DEFAULT 0,
    StockAnterior       Int NOT NULL DEFAULT 0,
    StockNuevo          Int NOT NULL DEFAULT 0,
    CostoUnitario       Decimal(12,2),
    ValorMovimiento     Decimal(12,2),
    MetodoCosto         Varchar(10),
    Motivo              Varchar(255),
    FechaMovimiento     Datetime DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (IdLote)           REFERENCES LT_Lote(IdLote),
    FOREIGN KEY (IdUsuario)        REFERENCES US_Usuario(IdUsuario),
    FOREIGN KEY (IdTipoMovimiento) REFERENCES TM_TipoMovimiento(IdTipoMovimiento),
    FOREIGN KEY (IdTipoDocumento)  REFERENCES TD_TipoDocumento(IdTipoDocumento),

    CHECK (CantidadEntrada >= 0 AND CantidadSalida >= 0),
    CHECK (NOT (CantidadEntrada > 0 AND CantidadSalida > 0)),
    CHECK (StockAnterior >= 0 AND StockNuevo >= 0),
    CHECK (CostoUnitario IS NULL OR CostoUnitario >= 0),
    CHECK (ValorMovimiento IS NULL OR ValorMovimiento >= 0)
) ENGINE = InnoDB;

CREATE INDEX idx_kardex_lote_fecha ON MI_MovimientoInventario(IdLote, FechaMovimiento);
CREATE INDEX idx_kardex_referencia ON MI_MovimientoInventario(TablaReferencia, IdReferencia);

-- =========================================
-- ALERTAS
-- =========================================

CREATE TABLE AS_AlertaStock (
    IdAlerta           Int AUTO_INCREMENT PRIMARY KEY,
    IdLote             Int NOT NULL,
    TipoAlerta         Varchar(30),
    Descripcion        Varchar(255),
    FechaAlerta        Datetime DEFAULT CURRENT_TIMESTAMP,
    Estado             Char(1) DEFAULT 'A',

    FOREIGN KEY (IdLote) REFERENCES LT_Lote(IdLote)
) ENGINE = InnoDB;

-- =========================================
-- VENTAS
-- =========================================

CREATE TABLE VE_Venta (
    IdVenta            Int AUTO_INCREMENT PRIMARY KEY,
    NumeroVenta        Varchar(10) UNIQUE,
    IdCliente          Int NOT NULL,
    IdUsuario          Int NOT NULL,
    IdEstadoVenta      Int NOT NULL,
    FechaVenta         Datetime DEFAULT CURRENT_TIMESTAMP,
    Subtotal           Decimal(12,2),
    Igv                Decimal(12,2),
    Total              Decimal(12,2),
    TipoComprobante    Varchar(50),
    Serie              Varchar(10),
    NumeroComprobante  Varchar(20),
    Moneda             Varchar(10) DEFAULT 'PEN',
    TipoCambio         Decimal(10,4),
    Observacion        Varchar(255),
    Estado             Char(1) DEFAULT 'A',

    UNIQUE (Serie, NumeroComprobante),
    FOREIGN KEY (IdCliente)     	REFERENCES CL_Cliente(IdCliente),
    FOREIGN KEY (IdUsuario)     	REFERENCES US_Usuario(IdUsuario),
    FOREIGN KEY (IdEstadoVenta) 	REFERENCES EV_EstadoVenta(IdEstadoVenta),
    CHECK (Subtotal IS NULL OR Subtotal >= 0),
    CHECK (Igv IS NULL OR Igv >= 0),
    CHECK (Total IS NULL OR Total >= 0),
    CHECK (TipoComprobante IS NULL OR TipoComprobante IN ('Boleta', 'Factura', 'Ticket')),
    CHECK (Moneda = 'PEN')
) ENGINE = InnoDB;

CREATE INDEX idx_venta_fecha ON VE_Venta(FechaVenta);

CREATE TABLE DV_DetalleVenta (
    IdDetalleVenta     Int AUTO_INCREMENT PRIMARY KEY,
    IdVenta            Int NOT NULL,
    IdLote             Int NOT NULL,
    IdUnidadVenta      Int NULL,
    Cantidad           Int NOT NULL,
    UnidadVenta        Varchar(50),
    FactorConversion   Int NOT NULL DEFAULT 1,
    CantidadUnidadesMinimas Int NOT NULL DEFAULT 0,
    PrecioUnitario     Decimal(12,2),
    Descuento          Decimal(12,2),
    Subtotal           Decimal(12,2),

    FOREIGN KEY (IdVenta) 			REFERENCES VE_Venta(IdVenta),
    FOREIGN KEY (IdLote)  			REFERENCES LT_Lote(IdLote),
    FOREIGN KEY (IdUnidadVenta)		REFERENCES UV_UnidadVenta(IdUnidadVenta),

    CHECK (Cantidad > 0),
    CHECK (FactorConversion > 0),
    CHECK (CantidadUnidadesMinimas > 0),
    CHECK (PrecioUnitario IS NULL OR PrecioUnitario >= 0),
    CHECK (Descuento IS NULL OR Descuento >= 0),
    CHECK (Subtotal IS NULL OR Subtotal >= 0)
) ENGINE = InnoDB;

CREATE INDEX idx_detalle_venta_lote ON DV_DetalleVenta(IdLote);

-- =========================================
-- PAGOS
-- =========================================

CREATE TABLE PG_Pago (
    IdPago             Int AUTO_INCREMENT PRIMARY KEY,
    NumeroPago         Varchar(10) NOT NULL UNIQUE,
    IdVenta            Int NOT NULL UNIQUE,
    FechaPago          Datetime DEFAULT CURRENT_TIMESTAMP,
    MontoTotal         Decimal(12,2) NOT NULL,
    EstadoPago         Varchar(20) NOT NULL,

    FOREIGN KEY (IdVenta) REFERENCES VE_Venta(IdVenta),
    CHECK (MontoTotal >= 0),
    CHECK (EstadoPago IN ('PAGADO', 'ANULADO'))
) ENGINE = InnoDB;

CREATE TABLE DP_DetallePago (
    IdDetallePago      Int AUTO_INCREMENT PRIMARY KEY,
    IdPago             Int NOT NULL,
    IdTipoPago         Int NOT NULL,
    Monto              Decimal(12,2) NOT NULL,
    Referencia         Varchar(100),

    FOREIGN KEY (IdPago)     REFERENCES PG_Pago(IdPago),
    FOREIGN KEY (IdTipoPago) REFERENCES TP_TipoPago(IdTipoPago),
    CHECK (Monto > 0)
) ENGINE = InnoDB;
