package com.tsvetanbondzhov.resumeenhancer.resume;

/**
 * Thrown when a resume cannot be found by ID, regardless of ownership.
 *
 * <p><strong>Design decision:</strong> User-facing resume endpoints always use
 * {@code ResumeRepository.findByIdAndUser}, which returns an empty {@code Optional}
 * for both "not found" and "wrong owner" cases. Both map to HTTP 403 via
 * {@code ResumeAccessDeniedException} — this avoids leaking whether a resume ID
 * exists to a different user (AC-5).
 *
 * <p>{@code ResumeNotFoundException} is intentionally unused in the current
 * user-facing paths. It is retained for future admin-scoped endpoints that need
 * to distinguish a genuine 404 (resume does not exist at all) from a 403
 * (resume exists but requester lacks access). Remove this class and its handler
 * in {@code GlobalExceptionHandler} if no such admin endpoint is implemented
 * by the end of Epic 6.
 */
public class ResumeNotFoundException extends RuntimeException {

    public ResumeNotFoundException(String message) {
        super(message);
    }
}
