package dev.billisan.global.paging;

import dev.billisan.global.exception.InvalidRequestException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** App REST 목록 조회의 불투명 cursor — 클라이언트가 해석하지 않는 Base64 인코딩 offset. */
public final class OffsetCursor {

    private OffsetCursor() {
    }

    public static int decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            // Base64.decode()의 IllegalArgumentException과 Integer.parseInt()의
            // NumberFormatException(IllegalArgumentException 하위 클래스)을 함께 잡는다.
            throw new InvalidRequestException("올바르지 않은 cursor 값입니다.", e);
        }
    }

    public static String encode(int offset) {
        return Base64.getEncoder().encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
    }
}
