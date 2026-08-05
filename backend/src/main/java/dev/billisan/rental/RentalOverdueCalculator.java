package dev.billisan.rental;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * 12-R §A-2.1 연체 산정식 — {@code RentalAppService}(RENTAL-001)와 홈 요약(HOME-001)이
 * 공유한다. {@code dueAt}과 정확히 같은 시각은 연체가 아니며, 초과한 첫 24시간 구간은
 * 1일로 올림 계산한다.
 */
public final class RentalOverdueCalculator {

    private static final long OVERDUE_DAILY_FEE = 1_000L;
    private static final long OVERDUE_FEE_CAP = 7_000L;
    private static final long ONE_DAY_MILLIS = 86_400_000L;

    private RentalOverdueCalculator() {
    }

    /** REQUESTED 대여처럼 {@code dueAt}이 아직 없으면 0이다. */
    public static int overdueDays(LocalDateTime dueAt, LocalDateTime asOf) {
        if (dueAt == null || !asOf.isAfter(dueAt)) {
            return 0;
        }
        long overdueMillis = Duration.between(dueAt, asOf).toMillis();
        return (int) ((overdueMillis + ONE_DAY_MILLIS - 1) / ONE_DAY_MILLIS);
    }

    public static long overdueFee(int overdueDays) {
        return Math.min(overdueDays * OVERDUE_DAILY_FEE, OVERDUE_FEE_CAP);
    }

    public static boolean isOverdue(LocalDateTime dueAt, LocalDateTime asOf) {
        return dueAt != null && asOf.isAfter(dueAt);
    }

    /** 기한 경과 시 0. {@code dueAt}이 아직 없으면(REQUESTED) 0. */
    public static long remainingFreeSeconds(LocalDateTime dueAt, LocalDateTime asOf) {
        if (dueAt == null || !asOf.isBefore(dueAt)) {
            return 0;
        }
        return Duration.between(asOf, dueAt).getSeconds();
    }
}
