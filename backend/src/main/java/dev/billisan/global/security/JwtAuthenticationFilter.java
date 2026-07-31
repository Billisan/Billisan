package dev.billisan.global.security;

import dev.billisan.admin.repository.AdminAccountRepository;
import dev.billisan.user.repository.UserAccountRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;
    private final UserAccountRepository userAccountRepository;
    private final AdminAccountRepository adminAccountRepository;

    public JwtAuthenticationFilter(
            JwtProvider jwtProvider,
            UserAccountRepository userAccountRepository,
            AdminAccountRepository adminAccountRepository) {
        this.jwtProvider = jwtProvider;
        this.userAccountRepository = userAccountRepository;
        this.adminAccountRepository = adminAccountRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length());
            try {
                String roleClaim = jwtProvider.getClaim(token, Role.CLAIM_KEY);
                if (Role.USER.claimValue().equals(roleClaim)) {
                    authenticateUser(token);
                } else if (Role.ADMIN.claimValue().equals(roleClaim)) {
                    authenticateAdmin(token);
                } else {
                    SecurityContextHolder.clearContext();
                }
            } catch (JwtException | IllegalArgumentException e) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private void authenticateUser(String token) {
        UUID userRef = UUID.fromString(jwtProvider.getSubject(token));
        userAccountRepository.findByUserRef(userRef).ifPresent(user ->
                SecurityContextHolder.getContext().setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                user, null, List.of(new SimpleGrantedAuthority(Role.USER.authority())))));
    }

    private void authenticateAdmin(String token) {
        UUID adminId = UUID.fromString(jwtProvider.getSubject(token));
        adminAccountRepository.findById(adminId).ifPresent(admin ->
                SecurityContextHolder.getContext().setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                admin, null, List.of(new SimpleGrantedAuthority(Role.ADMIN.authority())))));
    }
}
