import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import firebase_admin
from firebase_admin import credentials, auth, firestore
from backend.app.config import settings

# Global state
_firebase_initialized = False
_firestore_client = None
_in_memory_db: Dict[str, Dict[str, Dict[str, Any]]] = {}
_db_lock = threading.RLock()


class InMemoryDocumentSnapshot:
    def __init__(self, doc_id: str, data: Optional[Dict[str, Any]], exists: bool = True):
        self.id = doc_id
        self._data = data.copy() if data else {}
        self.exists = exists

    def to_dict(self) -> Optional[Dict[str, Any]]:
        return self._data.copy() if self.exists else None


class InMemoryDocumentReference:
    def __init__(self, db: "InMemoryFirestoreClient", collection_name: str, doc_id: str):
        self._db = db
        self.collection_name = collection_name
        self.id = doc_id

    def get(self, transaction=None) -> InMemoryDocumentSnapshot:
        with _db_lock:
            col = _in_memory_db.get(self.collection_name, {})
            data = col.get(self.id)
            if data is None:
                return InMemoryDocumentSnapshot(self.id, None, exists=False)
            return InMemoryDocumentSnapshot(self.id, data, exists=True)

    def set(self, data: Dict[str, Any], merge: bool = False, transaction=None):
        with _db_lock:
            if self.collection_name not in _in_memory_db:
                _in_memory_db[self.collection_name] = {}
            if merge and self.id in _in_memory_db[self.collection_name]:
                _in_memory_db[self.collection_name][self.id].update(data)
            else:
                _in_memory_db[self.collection_name][self.id] = data.copy()

    def create(self, data):
        from google.api_core.exceptions import AlreadyExists
        with _db_lock:
            if self.get().exists:
                raise AlreadyExists("Document already exists")
            self.set(data)

    def update(self, data: Dict[str, Any], transaction=None):
        with _db_lock:
            col = _in_memory_db.get(self.collection_name, {})
            if self.id not in col:
                raise KeyError(f"Document {self.id} does not exist in {self.collection_name}")
            col[self.id].update(data)

    def delete(self, transaction=None):
        with _db_lock:
            if self.collection_name in _in_memory_db and self.id in _in_memory_db[self.collection_name]:
                del _in_memory_db[self.collection_name][self.id]


class InMemoryQuery:
    def __init__(self, db: "InMemoryFirestoreClient", collection_name: str, filters=None, order_by_fields=None, limit_val=None):
        self._db = db
        self.collection_name = collection_name
        self.filters = filters or []
        self.order_by_fields = order_by_fields or []
        self.limit_val = limit_val

    def where(self, field: str, op: str, value: Any) -> "InMemoryQuery":
        new_filters = list(self.filters)
        new_filters.append((field, op, value))
        return InMemoryQuery(self._db, self.collection_name, new_filters, self.order_by_fields, self.limit_val)

    def order_by(self, field: str, direction: str = "ASCENDING") -> "InMemoryQuery":
        new_orders = list(self.order_by_fields)
        new_orders.append((field, direction))
        return InMemoryQuery(self._db, self.collection_name, self.filters, new_orders, self.limit_val)

    def limit(self, count: int) -> "InMemoryQuery":
        return InMemoryQuery(self._db, self.collection_name, self.filters, self.order_by_fields, count)

    def stream(self, transaction=None):
        with _db_lock:
            col = _in_memory_db.get(self.collection_name, {})
            docs = []
            for doc_id, data in col.items():
                match = True
                for field, op, value in self.filters:
                    doc_val = data.get(field)
                    if op in ("==", "="):
                        if doc_val != value:
                            match = False
                            break
                    elif op == "!=":
                        if doc_val == value:
                            match = False
                            break
                    elif op == ">":
                        if doc_val is None or doc_val <= value:
                            match = False
                            break
                    elif op == "<":
                        if doc_val is None or doc_val >= value:
                            match = False
                            break
                    elif op == ">=":
                        if doc_val is None or doc_val < value:
                            match = False
                            break
                    elif op == "<=":
                        if doc_val is None or doc_val > value:
                            match = False
                            break
                    elif op in ("array_contains", "array-contains"):
                        if not isinstance(doc_val, list) or value not in doc_val:
                            match = False
                            break
                    elif op in ("in", "IN"):
                        if doc_val not in value:
                            match = False
                            break
                if match:
                    docs.append(InMemoryDocumentSnapshot(doc_id, data, exists=True))

            for field, direction in reversed(self.order_by_fields):
                reverse = direction.upper() in ("DESCENDING", "DESC")
                docs.sort(key=lambda d: d.to_dict().get(field) or "", reverse=reverse)

            if self.limit_val is not None:
                docs = docs[:self.limit_val]

            for doc in docs:
                yield doc


class InMemoryCollectionReference(InMemoryQuery):
    def __init__(self, db: "InMemoryFirestoreClient", collection_name: str):
        super().__init__(db, collection_name)

    def document(self, doc_id: Optional[str] = None) -> InMemoryDocumentReference:
        if not doc_id:
            import uuid
            doc_id = uuid.uuid4().hex
        return InMemoryDocumentReference(self._db, self.collection_name, doc_id)


class InMemoryTransaction:
    def __init__(self, db: "InMemoryFirestoreClient"):
        self._db = db
        self._reads = {}
        self._writes = []

    def get(self, doc_ref: InMemoryDocumentReference) -> InMemoryDocumentSnapshot:
        snap = doc_ref.get()
        self._reads[f"{doc_ref.collection_name}/{doc_ref.id}"] = snap.to_dict()
        return snap

    def set(self, doc_ref: InMemoryDocumentReference, data: Dict[str, Any], merge: bool = False):
        self._writes.append(("set", doc_ref, data, merge))

    def update(self, doc_ref: InMemoryDocumentReference, data: Dict[str, Any]):
        self._writes.append(("update", doc_ref, data, False))

    def delete(self, doc_ref: InMemoryDocumentReference):
        self._writes.append(("delete", doc_ref, None, False))

    def commit(self):
        with _db_lock:
            for action, doc_ref, data, merge in self._writes:
                if action == "set":
                    doc_ref.set(data, merge=merge)
                elif action == "update":
                    doc_ref.update(data)
                elif action == "delete":
                    doc_ref.delete()


class InMemoryFirestoreClient:
    def collection(self, name: str) -> InMemoryCollectionReference:
        return InMemoryCollectionReference(self, name)

    def transaction(self) -> InMemoryTransaction:
        return InMemoryTransaction(self)

    def clear(self):
        with _db_lock:
            _in_memory_db.clear()


def transactional(func):
    """Decorator mimicking firestore.transactional"""
    def wrapper(transaction, *args, **kwargs):
        res = func(transaction, *args, **kwargs)
        if hasattr(transaction, "commit"):
            transaction.commit()
        return res
    return wrapper


def init_firebase():
    """Fail closed: offline storage is available only to isolated unit tests."""
    global _firebase_initialized, _firestore_client
    if _firebase_initialized and _firestore_client is not None:
        return
    if settings.ENVIRONMENT == "test":
        _firestore_client = InMemoryFirestoreClient()
    else:
        cred_path = settings.FIREBASE_CREDENTIALS_PATH
        if cred_path:
            from pathlib import Path
            path = Path(cred_path)
            if not path.is_absolute():
                path = Path(__file__).resolve().parents[1] / path
            cred = credentials.Certificate(str(path))
            if cred.project_id != settings.FIREBASE_PROJECT_ID:
                raise RuntimeError("Firebase credential project differs from FIREBASE_PROJECT_ID.")
        else:
            cred = credentials.ApplicationDefault()
        try:
            app = firebase_admin.get_app()
        except ValueError:
            app = firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        if app.project_id != settings.FIREBASE_PROJECT_ID:
            raise RuntimeError("Firebase Admin app project mismatch.")
        _firestore_client = firestore.client(app)
    _firebase_initialized = True


def get_firestore_client():
    init_firebase()
    return _firestore_client


def is_live_firebase() -> bool:
    return not isinstance(get_firestore_client(), InMemoryFirestoreClient)


def check_firebase_auth_user_exists(email: str) -> bool:
    if not is_live_firebase():
        return False
    try:
        auth.get_user_by_email(email)
        return True
    except auth.UserNotFoundError:
        return False


def create_firebase_auth_user(uid: str, email: str, password: str, display_name: str):
    if not is_live_firebase():
        return uid
    try:
        return auth.create_user(uid=uid, email=email, password=password, display_name=display_name).uid
    except auth.EmailAlreadyExistsError:
        raise ValueError("EMAIL_ALREADY_EXISTS") from None


def verify_firebase_id_token(token: str) -> Dict[str, Any]:
    init_firebase()
    # Tests must inject their verifier explicitly; no application-level fake tokens.
    return auth.verify_id_token(token, check_revoked=True)


def run_transaction(db, operation):
    if isinstance(db, InMemoryFirestoreClient):
        with _db_lock:
            tx = db.transaction()
            result = operation(tx)
            tx.commit()
            return result
    return firestore.transactional(operation)(db.transaction())
