def parse_policy(policy_str):
    """
    Example policy:
    "Role:Doctor AND Dept:Cardiology AND Consent:True"
    """
    rules = []

    parts = policy_str.split("AND")
    for part in parts:
        key, value = part.strip().split(":")
        rules.append((key.strip(), value.strip()))

    return rules


def evaluate_policy(user, policy_str):
    rules = parse_policy(policy_str)

    for key, value in rules:
        if str(user.attributes.get(key)) != value:
            return False

    return True
