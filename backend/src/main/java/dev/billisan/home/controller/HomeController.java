package dev.billisan.home.controller;

import dev.billisan.home.dto.HomeSummaryResponse;
import dev.billisan.home.service.HomeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("/api/v1/app/home")
    public ResponseEntity<HomeSummaryResponse> getHome(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef) {
        return ResponseEntity.ok(homeService.summary(userRef));
    }
}
