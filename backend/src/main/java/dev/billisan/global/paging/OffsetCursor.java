package dev.billisan.global.paging;

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
        return Integer.parseInt(new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8));
    }

    public static String encode(int offset) {
        return Base64.getEncoder().encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
    }
}
