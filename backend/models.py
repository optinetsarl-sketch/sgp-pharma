from datetime import datetime, timezone, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, EmailStr
import uuid


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def gen_id() -> str:
    return str(uuid.uuid4())


# ---------- Roles ----------
RoleType = Literal["super_admin", "admin", "pharmacist", "cashier", "storekeeper"]


# ---------- Pharmacy (tenant) ----------
class PharmacyBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    license_number: Optional[str] = None
    currency: str = "FCFA"
    active: bool = True


class Pharmacy(PharmacyBase):
    id: str = Field(default_factory=gen_id)
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Users ----------
class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: RoleType
    pharmacy_id: Optional[str] = None
    active: bool = True
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)
    role: RoleType
    pharmacy_id: Optional[str] = None  # super_admin can leave null


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[RoleType] = None
    active: Optional[bool] = None
    password: Optional[str] = None
    pharmacy_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- Categories ----------
class CategoryBase(BaseModel):
    name: str


class Category(CategoryBase):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None


# ---------- Products ----------
class ProductBase(BaseModel):
    code_barre: str
    nom_commercial: str
    dci: Optional[str] = None
    forme_pharmaceutique: Optional[str] = None
    categorie_id: Optional[str] = None
    seuil_alerte_stock: int = 10
    requires_prescription: bool = False
    prix_vente: float = 0.0


class Product(ProductBase):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Suppliers ----------
class SupplierBase(BaseModel):
    raison_sociale: str
    contact: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None


class Supplier(SupplierBase):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Batches ----------
class BatchBase(BaseModel):
    product_id: str
    batch_number: str
    expiry_date: date
    purchase_price: float
    initial_quantity: int
    supplier_id: Optional[str] = None


class Batch(BatchBase):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    current_quantity: int
    status: Literal["active", "depleted", "blocked"] = "active"
    received_at: datetime = Field(default_factory=now_utc)


class ReceptionItem(BaseModel):
    product_id: str
    batch_number: str
    expiry_date: date
    purchase_price: float
    quantity: int


class ReceptionRequest(BaseModel):
    supplier_id: Optional[str] = None
    items: List[ReceptionItem]
    purchase_order_id: Optional[str] = None


# ---------- Stock movements ----------
MovementType = Literal[
    "ENTREE_ACHAT", "SORTIE_VENTE", "PERTE_PEREMPTION",
    "PERTE_CASSE", "PERTE_VOL", "RETOUR", "AJUSTEMENT"
]


class StockMovement(BaseModel):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    batch_id: str
    product_id: str
    type: MovementType
    quantity: int
    created_at: datetime = Field(default_factory=now_utc)
    user_id: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None


# ---------- Sales / POS ----------
class SaleItemRequest(BaseModel):
    product_id: str
    quantity: int
    unit_price: Optional[float] = None


class SaleItem(BaseModel):
    product_id: str
    batch_id: str
    quantity: int
    unit_price: float
    subtotal: float


class SaleRequest(BaseModel):
    items: List[SaleItemRequest]
    payment_method: str = "cash"
    customer_name: Optional[str] = None
    prescription_ref: Optional[str] = None
    prescription_image: Optional[str] = None  # base64 data URL


class Sale(BaseModel):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    date: datetime = Field(default_factory=now_utc)
    total_amount: float
    payment_method: str
    prescription_ref: Optional[str] = None
    prescription_image: Optional[str] = None
    customer_name: Optional[str] = None
    user_id: str
    items: List[SaleItem]


# ---------- Losses ----------
LossMotif = Literal["peremption", "casse", "vol"]


class LossRequest(BaseModel):
    batch_id: str
    quantity: int
    motif: LossMotif
    notes: Optional[str] = None


class Loss(BaseModel):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    batch_id: str
    product_id: str
    quantity: int
    motif: LossMotif
    notes: Optional[str] = None
    user_id: str
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Purchase orders ----------
PurchaseOrderStatus = Literal["draft", "validated", "partial", "received", "closed", "cancelled"]


class PurchaseOrderItem(BaseModel):
    product_id: str
    quantity: int
    unit_price: float


class PurchaseOrderRequest(BaseModel):
    supplier_id: str
    items: List[PurchaseOrderItem]
    notes: Optional[str] = None


class PurchaseOrder(BaseModel):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    supplier_id: str
    items: List[PurchaseOrderItem]
    status: PurchaseOrderStatus = "draft"
    total: float = 0.0
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    user_id: str


# ---------- Audit ----------
class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=gen_id)
    pharmacy_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    entity: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
