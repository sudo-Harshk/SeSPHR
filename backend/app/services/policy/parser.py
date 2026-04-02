import re

def parse_policy(policy_str):
    """
    Parses a policy string into a format that can be evaluated.
    Example policy: "(Role:Doctor AND Dept:Cardiology) OR Role:Admin"
    """
    # This is a simplified parser for demonstration.
    # For real use, use a proper boolean expression parser.
    return policy_str


def evaluate_policy(user, policy_str):
    """
    Evaluates the policy string against the user's attributes.
    Supports AND, OR, and parentheses.
    """
    if not policy_str or policy_str == "N/A":
        return True

    # Replace "Key:Value" with True/False based on user attributes
    # We use a regex to find all Attribute:Value pairs
    def replace_rule(match):
        rule = match.group(0)
        if ":" not in rule:
            return rule
        
        attr, val = rule.split(":", 1)
        attr = attr.strip()
        val = val.strip()
        
        user_val = str(user.attributes.get(attr, ""))
        return "True" if user_val == val else "False"

    # 1. Identify all "Attr:Val" patterns
    # This regex looks for alphanumeric chars followed by a colon and then more alphanumeric chars
    # It also handles simple values like True/False
    processed_policy = re.sub(r'[\w-]+:[\w-]+', replace_rule, policy_str)

    # 2. Normalize logical operators to Python equivalents
    processed_policy = processed_policy.replace("AND", "and").replace("OR", "or")

    # 3. Security check: Only allow 'True', 'False', 'and', 'or', '(', ')'
    if not re.match(r'^[TrueFalseandor\s\(\)]+$', processed_policy):
        # If it contains anything else, it's potentially unsafe or malformed
        # Fallback to simple check if regex fails or just return False
        return False

    try:
        # Safe eval of boolean expression
        return eval(processed_policy, {"__builtins__": None}, {})
    except Exception:
        return False
