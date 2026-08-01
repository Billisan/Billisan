package dev.billisan.global.security;

import tools.jackson.databind.ObjectMapper;
import dev.billisan.global.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public JwtAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        // setCharacterEncoding을 안 하면 Tomcat이 Writer에 기본 ISO-8859-1을 써서
        // 한글이 "?"로 되돌릴 수 없이 깨진다(실기 테스트로 발견) — getWriter() 전에 설정.
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        // hasRole("ADMIN")이 걸린 경로는 현재 /api/v1/admin/** 뿐이라 이 핸들러가 타는 403은
        // 전부 "관리자 권한 필요" 케이스다. 다른 role 제약이 추가되면 그때 분기 필요.
        response.getWriter().write(objectMapper.writeValueAsString(
                new ApiError("ADMIN_ACCOUNT_REQUIRED", "관리자 권한이 필요합니다.")));
    }
}
