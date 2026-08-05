FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar app.jar

EXPOSE 8080
# 베이스 이미지 기본 타임존(UTC)과 무관하게 앱 전체(응답 타임스탬프 포함)를 KST 기준으로
# 고정한다 — JDBC URL의 serverTimezone=Asia/Seoul과 짝을 맞추는 값. 이게 없으면 컨테이너가
# UTC로 뜨는 환경(EC2 등)에서 LocalDateTime.now()가 실제 한국 시각보다 9시간 이르게 찍혀
# DB저장 시각이 밀리고, CK_*_TIME_ORDER류 체크 제약을 깰 수 있다(EC2에서 실측 확인된 버그).
ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]