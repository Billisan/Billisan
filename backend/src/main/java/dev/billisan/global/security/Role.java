package dev.billisan.global.security;

public enum Role {
    USER("ROLE_USER"),
    ADMIN("ROLE_ADMIN");

    public static final String CLAIM_KEY = "role";

    private final String authority;

    Role(String authority) {
        this.authority = authority;
    }

    public String claimValue() {
        return name();
    }

    public String authority() {
        return authority;
    }
}
