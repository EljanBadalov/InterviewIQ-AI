"""Bounded, process-local inference admission. No model startup or network side effects."""
import time
from contextlib import contextmanager


class GenerationExpired(Exception):
    pass


class GenerationBudget:
    def __init__(self, budget_ms=None, deadline_unix_ms=None, cancelled=None):
        self.started = time.monotonic()
        self.until = self.started + min(300000, budget_ms if budget_ms is not None else 300000) / 1000
        self.deadline_unix_ms = deadline_unix_ms
        self.cancelled = cancelled or (lambda: False)
        self.queue_wait_ms = 0.0

    def remaining(self):
        remaining = self.until - time.monotonic()
        if self.deadline_unix_ms is not None:
            remaining = min(remaining, (self.deadline_unix_ms - time.time() * 1000) / 1000)
        return max(0.0, remaining)

    def check(self):
        if self.cancelled() or self.remaining() <= 0:
            raise GenerationExpired('Generation request is no longer eligible for dispatch')

    @contextmanager
    def slot(self, lock):
        acquired = False
        try:
            while not acquired:
                self.check()
                acquired = lock.acquire(timeout=min(0.05, self.remaining()))
            self.queue_wait_ms = (time.monotonic() - self.started) * 1000
            self.check()
            yield self
        finally:
            if acquired:
                lock.release()


def normalize_finish_reason(value):
    return value if isinstance(value, str) and value in {'stop', 'length', 'content_filter', 'error'} else 'unknown'
