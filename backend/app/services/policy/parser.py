import re


def parse_policy(policy_str):
    """
    Parses a policy string into a format that can be evaluated.
    Example policy: "(Role:Doctor AND Dept:Cardiology) OR Role:Admin"
    """
    # This is a simplified parser for demonstration.
    # For real use, use a proper boolean expression parser.
    return policy_str


def _normalize_policy_input(policy_str):
    """Trim and collapse whitespace so policies are resilient to extra spaces."""
    if not policy_str:
        return policy_str
    s = policy_str.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def evaluate_policy(user, policy_str):
    """
    Evaluates the policy string against the user's attributes.
    Supports AND, OR, and parentheses (case-insensitive AND/OR after attribute substitution).
    """
    if not policy_str or policy_str == "N/A":
        return True

    policy_str = _normalize_policy_input(policy_str)

    # Replace "Key:Value" with True/False based on user attributes
    def replace_rule(match):
        rule = match.group(0)
        if ":" not in rule:
            return rule

        attr, val = rule.split(":", 1)
        attr = attr.strip()
        val = val.strip()

        user_val = str(user.attributes.get(attr, ""))
        return "True" if user_val == val else "False"

    processed_policy = re.sub(r"[\w-]+:[\w-]+", replace_rule, policy_str)
    # Normalize logical operators (case-insensitive word boundaries)
    processed_policy = re.sub(r"(?i)\band\b", "and", processed_policy)
    processed_policy = re.sub(r"(?i)\bor\b", "or", processed_policy)
    processed_policy = re.sub(r"\s+", " ", processed_policy.strip())

    # Security check: Only allow 'True', 'False', 'and', 'or', '(', ')', whitespace
    if not re.match(r"^[TrueFalseandor\s\(\)]+$", processed_policy):
        return False

    try:
        return eval(processed_policy, {"__builtins__": None}, {})
    except Exception:
        return False
