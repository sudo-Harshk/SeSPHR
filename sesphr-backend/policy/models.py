class User:
    def __init__(self, user_id, attributes=None):
        self.user_id = user_id
        self.attributes = attributes or {}

    def add_attribute(self, key, value=True):
        self.attributes[key] = value

    def remove_attribute(self, key):
        if key in self.attributes:
            del self.attributes[key]

    def has_attribute(self, key, value=True):
        return self.attributes.get(key) == value

    def __str__(self):
        return f"User({self.user_id}, {self.attributes})"
