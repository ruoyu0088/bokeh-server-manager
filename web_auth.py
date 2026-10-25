"""Single-password credential storage for optional web mode.

This module is deliberately independent from the server manager's normal
configuration.  Credentials live in ``.runtime/web_auth.json`` and contain a
salted scrypt hash plus a random session secret, never the password itself.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
AUTH_DIR = ROOT / ".runtime"
AUTH_FILE = AUTH_DIR / "web_auth.json"
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


class AuthError(Exception):
    """Base class for credential errors."""


class AuthNotConfigured(AuthError):
    """Raised when web mode is requested before a password was configured."""


class AuthConfigError(AuthError):
    """Raised when the credential file is malformed."""


def _encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _decode(value: Any, field: str) -> bytes:
    if not isinstance(value, str):
        raise AuthConfigError(f'Credential field "{field}" must be a string.')
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except (ValueError, UnicodeError) as exc:
        raise AuthConfigError(
            f'Credential field "{field}" is not valid base64.'
        ) from exc


def _derive(password: str, salt: bytes, n: int, r: int, p: int, dklen: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=dklen,
        maxmem=64 * 1024 * 1024,
    )


def load_credentials() -> dict[str, Any] | None:
    """Load and validate the configured credentials.

    Returns ``None`` when no password has been configured.  A corrupt file
    raises :class:`AuthConfigError` so web mode can refuse to start.
    """
    if not AUTH_FILE.exists():
        return None
    if not AUTH_FILE.is_file():
        raise AuthConfigError("The credential path is not a regular file.")
    try:
        raw = AUTH_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuthConfigError(f"Could not read the credential file: {exc}") from exc
    if not isinstance(data, dict):
        raise AuthConfigError("The credential file must contain a JSON object.")
    if data.get("version") != 1:
        raise AuthConfigError("Unsupported credential file version.")
    if data.get("algorithm") != "scrypt":
        raise AuthConfigError("Unsupported password hashing algorithm.")
    for field in ("salt", "hash", "auth_id", "session_secret"):
        if not isinstance(data.get(field), str) or not data[field]:
            raise AuthConfigError(f'Credential field "{field}" is missing.')
    for field in ("n", "r", "p", "dklen"):
        value = data.get(field)
        if not isinstance(value, int) or value <= 0:
            raise AuthConfigError(f'Credential field "{field}" must be a positive integer.')
    salt = _decode(data["salt"], "salt")
    digest = _decode(data["hash"], "hash")
    if len(salt) < 8 or len(digest) < 16:
        raise AuthConfigError("Credential hash parameters are too small.")
    data["_salt"] = salt
    data["_hash"] = digest
    return data


def verify_password(password: str, credentials: dict[str, Any] | None = None) -> bool:
    """Check a password against the stored scrypt hash."""
    if not isinstance(password, str) or not password:
        return False
    if credentials is None:
        try:
            credentials = load_credentials()
        except AuthConfigError:
            return False
    if credentials is None:
        return False
    try:
        candidate = _derive(
            password,
            credentials["_salt"],
            int(credentials["n"]),
            int(credentials["r"]),
            int(credentials["p"]),
            int(credentials["dklen"]),
        )
    except (KeyError, TypeError, ValueError, OSError):
        return False
    return hmac.compare_digest(candidate, credentials["_hash"])


def save_password(password: str) -> None:
    """Replace the single web password and invalidate existing sessions."""
    if not isinstance(password, str) or not password:
        raise AuthError("Password cannot be empty.")
    salt = secrets.token_bytes(16)
    digest = _derive(
        password,
        salt,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        SCRYPT_DKLEN,
    )
    data = {
        "version": 1,
        "algorithm": "scrypt",
        "n": SCRYPT_N,
        "r": SCRYPT_R,
        "p": SCRYPT_P,
        "dklen": SCRYPT_DKLEN,
        "salt": _encode(salt),
        "hash": _encode(digest),
        # A new auth id and session secret invalidate every existing session.
        "auth_id": secrets.token_hex(16),
        "session_secret": secrets.token_hex(32),
    }
    try:
        AUTH_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = AUTH_FILE.with_name(f".{AUTH_FILE.name}.tmp-{os.getpid()}")
        temp_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            pass
        os.replace(temp_path, AUTH_FILE)
        try:
            os.chmod(AUTH_FILE, 0o600)
        except OSError:
            pass
    except OSError as exc:
        raise AuthError(f"Could not save the credential file: {exc}") from exc


def set_password_interactive() -> int:
    """Prompt twice with hidden input and save the password."""
    print("Set the single password for Bokeh Server Manager web mode.")
    try:
        password = getpass.getpass("Password: ")
        if not password:
            print("Password cannot be empty.")
            return 1
        confirmation = getpass.getpass("Confirm password: ")
    except (EOFError, KeyboardInterrupt):
        print("\nPassword setup cancelled.")
        return 1
    if password != confirmation:
        print("Passwords do not match.")
        return 1
    try:
        save_password(password)
    except AuthError as exc:
        print(f"Could not save the password: {exc}")
        return 1
    print("Password saved.")
    print("Start web mode with: start.bat --web")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Manage the Bokeh Server Manager web password."
    )
    parser.add_argument(
        "--set-password",
        action="store_true",
        help="prompt for a new password twice and save its salted hash",
    )
    args = parser.parse_args(argv)
    if args.set_password:
        return set_password_interactive()
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
