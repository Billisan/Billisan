package dev.billisan.snapshot;

public class BootSnapshotRejectedException extends RuntimeException {

	private final Reason reason;
	private final String identifier;

	public BootSnapshotRejectedException(
		Reason reason,
		String identifier
	) {
		this(reason, identifier, null);
	}

	public BootSnapshotRejectedException(
		Reason reason,
		String identifier,
		Throwable cause
	) {
		super("Boot snapshot was rejected: " + reason, cause);
		this.reason = reason;
		this.identifier = identifier;
	}

	public Reason getReason() {
		return reason;
	}

	public String getIdentifier() {
		return identifier;
	}

	public enum Reason {
		UNKNOWN_STATION,
		IDEMPOTENCY_CONFLICT,
		STALE_SNAPSHOT
	}
}
