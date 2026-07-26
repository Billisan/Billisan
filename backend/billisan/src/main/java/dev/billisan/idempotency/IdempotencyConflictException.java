package dev.billisan.idempotency;

public class IdempotencyConflictException extends RuntimeException {

	private final String keyName;
	private final String keyValue;

	public IdempotencyConflictException(String keyName, String keyValue) {
		this(keyName, keyValue, null);
	}

	public IdempotencyConflictException(
		String keyName,
		String keyValue,
		Throwable cause
	) {
		super("The idempotency key is already bound to a different payload: " + keyName, cause);
		this.keyName = keyName;
		this.keyValue = keyValue;
	}

	public String getKeyName() {
		return keyName;
	}

	public String getKeyValue() {
		return keyValue;
	}
}
