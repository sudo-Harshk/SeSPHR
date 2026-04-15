"""Policy evaluation: department gates, whitespace, and case-insensitive AND/OR."""
from types import SimpleNamespace

from app.services.policy.parser import evaluate_policy


def _user(attrs):
    return SimpleNamespace(user_id="u1", attributes=attrs)


def test_all_doctors_any_department():
    pol = "Role:Doctor"
    cardio = _user({"Role": "Doctor", "Dept": "Cardiology"})
    ortho = _user({"Role": "Doctor", "Dept": "Orthopedics"})
    assert evaluate_policy(cardio, pol) is True
    assert evaluate_policy(ortho, pol) is True


def test_cardiology_only_denies_orthopedics():
    pol = "Role:Doctor AND Dept:Cardiology"
    cardio = _user({"Role": "Doctor", "Dept": "Cardiology"})
    ortho = _user({"Role": "Doctor", "Dept": "Orthopedics"})
    assert evaluate_policy(cardio, pol) is True
    assert evaluate_policy(ortho, pol) is False


def test_lowercase_and_whitespace():
    pol = "Role:Doctor  and  Dept:Cardiology"
    cardio = _user({"Role": "Doctor", "Dept": "Cardiology"})
    ortho = _user({"Role": "Doctor", "Dept": "Orthopedics"})
    assert evaluate_policy(cardio, pol) is True
    assert evaluate_policy(ortho, pol) is False


def test_orthopedics_only_denies_cardiology():
    pol = "Role:Doctor AND Dept:Orthopedics"
    cardio = _user({"Role": "Doctor", "Dept": "Cardiology"})
    ortho = _user({"Role": "Doctor", "Dept": "Orthopedics"})
    assert evaluate_policy(ortho, pol) is True
    assert evaluate_policy(cardio, pol) is False


def test_malformed_policy_rejected():
    u = _user({"Role": "Doctor", "Dept": "Cardiology"})
    assert evaluate_policy(u, "Role:Doctor; DROP TABLE") is False
