"""Plain exceptions that services raise. main.py maps them to HTTP status codes."""


class NotFoundError(Exception):
    pass


class ConflictError(Exception):
    pass


class InvalidInputError(Exception):
    pass


class ServiceUnavailableError(Exception):
    """A needed component (for example the AI model) cannot be used right now."""