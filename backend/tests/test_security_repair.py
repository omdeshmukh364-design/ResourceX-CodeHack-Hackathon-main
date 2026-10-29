from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.firebase import get_firestore_client
from backend.app.services.user_service import UserService
from backend.app.models.user import StudentRegisterRequest

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    db = get_firestore_client()
    db.clear()
    from backend.app.services.seed_service import seed_database
    seed_database(force=True)

def headers(token='demo-student-token'):
    return {'Authorization': 'Bearer ' + token}

def test_actual_verifier_rejects_demo_tokens(monkeypatch):
    from backend.app.firebase import verify_firebase_id_token
    import firebase_admin.auth
    verifier = Mock(side_effect=ValueError('not a JWT'))
    monkeypatch.setattr(firebase_admin.auth, 'verify_id_token', verifier)
    with pytest.raises(ValueError):
        verify_firebase_id_token('demo-admin-token')
    verifier.assert_called_once_with('demo-admin-token', check_revoked=True)

@pytest.mark.parametrize('role,token', [('student','demo-student-token'),('teacher','demo-faculty-token'),('admin','demo-admin-token')])
def test_login_role_must_match(role,token):
    assert client.get('/api/auth/me?expected_role='+role, headers=headers(token)).status_code == 200
    wrong = 'admin' if role != 'admin' else 'teacher'
    assert client.get('/api/auth/me?expected_role='+wrong, headers=headers(token)).status_code == 403

def test_missing_profile_does_not_get_created():
    uid='unprofiled'
    response=client.get('/api/auth/me',headers=headers(f'test-token:{uid}:missing@pcu.edu.in:admin:true'))
    assert response.status_code==403
    assert not get_firestore_client().collection('users').document(uid).get().exists

def test_missing_role_fails_closed():
    ref=get_firestore_client().collection('users').document('student-jamie-001')
    data=ref.get().to_dict();data.pop('role');ref.set(data)
    assert client.get('/api/auth/me',headers=headers()).status_code==403

def test_profile_idor():
    assert client.get('/api/users/admin-main-003',headers=headers()).status_code==403

def test_seed_endpoint_removed():
    assert client.post('/api/resources/seed').status_code in (404,405)

def test_invalid_token():
    assert client.get('/api/auth/me',headers=headers('invalid')).status_code==401

def test_bootstrap_disabled(monkeypatch):
    from backend.app.config import settings
    monkeypatch.setattr(settings,'ADMIN_BOOTSTRAP_KEY','')
    response=client.post('/api/auth/bootstrap-admin',json=dict(bootstrap_key='',email='new@pcu.edu.in',name='Admin',password='password123'))
    assert response.status_code==403

def test_first_bootstrap_creates_auth_user_and_profile(monkeypatch):
    get_firestore_client().clear()
    create=Mock()
    monkeypatch.setattr('backend.app.services.user_service.create_firebase_auth_user',create)
    profile=UserService.bootstrap_admin('unit-test-secret-only-32-characters-long','first@pcu.edu.in','First','password123')
    assert profile.role.value=='admin'
    assert create.call_args.args[0]==profile.uid
    assert get_firestore_client().collection('users').document(profile.uid).get().exists
    with pytest.raises(Exception) as exc:
        UserService.bootstrap_admin('unit-test-secret-only-32-characters-long','second@pcu.edu.in','Second','password123')
    assert exc.value.status_code==409

def test_privileged_provisioning_creates_auth_identity(monkeypatch):
    create=Mock()
    monkeypatch.setattr('backend.app.services.user_service.create_firebase_auth_user',create)
    response=client.post('/api/users/privileged',headers=headers('demo-admin-token'),json=dict(name='Teacher Test',email='teacher.test@pcu.edu.in',password='password123',role='teacher'))
    assert response.status_code==201
    create.assert_called_once()
    assert create.call_args.args[0]==response.json()['uid']

def test_student_profile_failure_retains_auth_and_returns_recovery(monkeypatch):
    from backend.app.firebase import InMemoryDocumentReference
    create=Mock()
    monkeypatch.setattr('backend.app.services.user_service.create_firebase_auth_user',create)
    monkeypatch.setattr(InMemoryDocumentReference,'create',Mock(side_effect=RuntimeError('profile unavailable')))
    response=client.post('/api/auth/register',json=dict(name='Partial Student',email='partial@pcu.edu.in',password='password123'))
    assert response.status_code==503
    assert 'incomplete' in response.json()['detail']
    create.assert_called_once()

def test_recovery_requires_server_registration_marker(monkeypatch):
    monkeypatch.setattr('firebase_admin.auth.get_user',lambda uid: SimpleNamespace(disabled=False,email='recover@pcu.edu.in',display_name='Recover',custom_claims={}))
    token='test-token:recover:recover@pcu.edu.in:student:true'
    assert client.post('/api/auth/recover-student',headers=headers(token)).status_code==403
    monkeypatch.setattr('firebase_admin.auth.get_user',lambda uid: SimpleNamespace(disabled=False,email='recover@pcu.edu.in',display_name='Recover',custom_claims={'student_registration':True}))
    response=client.post('/api/auth/recover-student',headers=headers(token))
    assert response.status_code==200
    assert response.json()['role']=='student'
    # Retry preserves data and UID.
    assert client.post('/api/auth/recover-student',headers=headers(token)).json()['uid']=='recover'

def test_recovery_never_demotes_admin(monkeypatch):
    monkeypatch.setattr('firebase_admin.auth.get_user',lambda uid: SimpleNamespace(disabled=False,email='admin@pcu.edu.in',display_name='Admin',custom_claims={'student_registration':True}))
    assert client.post('/api/auth/recover-student',headers=headers('demo-admin-token')).status_code==403
    assert UserService.get_user('admin-main-003').role.value=='admin'

def test_registration_auth_duplicate_and_service_error_are_distinct(monkeypatch):
    monkeypatch.setattr('backend.app.services.user_service.check_firebase_auth_user_exists',lambda email: True)
    req=dict(name='Duplicate Auth',email='auth.only@pcu.edu.in',password='password123')
    assert client.post('/api/auth/register',json=req).status_code==400


def test_resource_update_rejects_null_and_excess_capacity():
    for body in [{'name':None},{'available_quantity':9999}]:
        assert client.patch('/api/resources/res-electronics-001',headers=headers('demo-admin-token'),json=body).status_code==422

def test_configuration_mismatch_fails_before_network(monkeypatch):
    import backend.app.firebase as fb
    from backend.app.config import settings
    monkeypatch.setattr(fb,'_firebase_initialized',False)
    monkeypatch.setattr(fb,'_firestore_client',None)
    monkeypatch.setattr(settings,'ENVIRONMENT','development')
    monkeypatch.setattr(settings,'FIREBASE_CREDENTIALS_PATH','dummy.json')
    monkeypatch.setattr(fb.credentials,'Certificate',lambda path: SimpleNamespace(project_id='wrong-project'))
    initialize=Mock()
    monkeypatch.setattr(fb.firebase_admin,'initialize_app',initialize)
    with pytest.raises(RuntimeError,match='project differs'):
        fb.init_firebase()
    initialize.assert_not_called()

def test_application_lifespan_isolated_startup():
    with TestClient(app) as running:
        assert running.get('/api/health').status_code==200
        assert running.get('/api/resources').status_code==200

def test_booking_rejects_invalid_return_condition():
    response=client.post('/api/bookings/book-demo-001/return',headers=headers('demo-admin-token'),json={'condition':'unknown'})
    assert response.status_code==422

def test_return_history_filtered_for_unrelated_teacher():
    db=get_firestore_client()
    now='2026-10-29T12:00:00+00:00'
    db.collection('returns').document('foreign').set(dict(id='foreign',booking_id='book-demo-001',resource_id='res-electronics-001',resource_name='Kit',borrower_uid='student-jamie-001',borrower_name='Jamie',processed_by_uid='faculty-reynolds-002',processed_by_name='Teacher',return_condition='Good',returned_at=now,created_at=now))
    token='test-token:faculty-other-999:other@pcu.edu.in:teacher:true'
    assert client.get('/api/returns',headers=headers(token)).json()==[]
    assert len(client.get('/api/returns',headers=headers('demo-faculty-token')).json())==1
