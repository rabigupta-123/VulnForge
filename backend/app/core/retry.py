import time
import functools
import logging
from typing import Callable, Any
import requests

logger = logging.getLogger(__name__)


def retry_transient(max_attempts: int = 3, backoff_delays: tuple = (1, 2, 4)):
    """
    Retry decorator for transient network/service failures.
    - Max attempts: 3 (by default)
    - Exponential backoff: 1s, 2s, 4s
    - Retries ONLY on transient errors: Timeouts, Connection Error/Resets, OS socket errors, 5xx server responses.
    - NEVER retries on 4xx client errors (fails immediately).
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    res = func(*args, **kwargs)
                    # If function returns a requests.Response object directly
                    if isinstance(res, requests.Response):
                        if 400 <= res.status_code < 500:
                            # 4xx client error: fail immediately, do not retry
                            return res
                        if res.status_code >= 500:
                            # 5xx server error: raise so it gets caught as retryable
                            res.raise_for_status()
                    return res

                except requests.exceptions.HTTPError as e:
                    # Check if response status code was 4xx vs 5xx
                    if e.response is not None and 400 <= e.response.status_code < 500:
                        raise e  # Fail immediately on 4xx client errors
                    last_exception = e

                except (
                    requests.exceptions.Timeout,
                    requests.exceptions.ConnectionError,
                    requests.exceptions.RequestException,
                    TimeoutError,
                    ConnectionError,
                    OSError,
                ) as e:
                    # Check if exception has response attribute with 4xx status
                    if hasattr(e, "response") and getattr(e, "response", None) is not None:
                        status_code = getattr(e.response, "status_code", 0)
                        if 400 <= status_code < 500:
                            raise e
                    last_exception = e

                except Exception as e:
                    # Generic unexpected exceptions
                    last_exception = e

                if attempt < max_attempts - 1:
                    delay = backoff_delays[attempt] if attempt < len(backoff_delays) else backoff_delays[-1]
                    logger.warning(
                        f"Transient failure in {func.__name__} (attempt {attempt+1}/{max_attempts}): {last_exception}. Retrying in {delay}s..."
                    )
                    time.sleep(delay)

            # Re-raise last exception after exhausting retries
            raise last_exception

        return wrapper
    return decorator
