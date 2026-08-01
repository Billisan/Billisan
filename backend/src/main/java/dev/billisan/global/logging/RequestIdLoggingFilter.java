package dev.billisan.global.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * {@code X-Request-Id} 헤더를 MDC에 심어 같은 요청의 로그 줄을 서로 묶어볼 수 있게 하고,
 * 요청 종료 시 액세스 로그 한 줄(method·URI·status·소요시간)을 남긴다. 헤더 자체의 필수
 * 여부·형식 검증은 각 컨트롤러의 {@code @RequestHeader}가 담당하므로 여기서는 값이 있으면
 * MDC에 넣고, 없으면 그냥 통과시킨다(검증 중복 방지).
 */
@Component
public class RequestIdLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestIdLoggingFilter.class);

    public static final String MDC_KEY = "requestId";
    private static final String HEADER_NAME = "X-Request-Id";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String requestId = request.getHeader(HEADER_NAME);
        if (requestId != null && !requestId.isBlank()) {
            MDC.put(MDC_KEY, requestId);
        }
        long startedAt = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
            // MDC.remove는 finally에서 하므로, 로그는 반드시 그 전에 남겨야 requestId가 찍힌다.
            log.info("{} {} -> {} ({}ms)",
                    request.getMethod(), request.getRequestURI(), response.getStatus(),
                    System.currentTimeMillis() - startedAt);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
