package dev.billisan.chatbot.knowledge;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

/**
 * {@code src/main/resources/knowledge/*.md}를 기동 시 한 번만 읽어 프롬프트에 그대로 주입할
 * 텍스트로 조립해둔다.
 *
 * <p>⚠️ 이 클래스는 반드시 생성자에서 한 번만 조립하고 불변으로 들고 있어야 한다. 매 요청마다
 * 다시 읽으면 프롬프트 캐싱이 조용히 깨진다(CLAUDE.md 챗봇 "구현 주의" 항목).
 */
@Component
public class FaqKnowledge {

    private final String content;

    public FaqKnowledge(ApplicationContext applicationContext,
                         @Value("${chatbot.knowledge-location:classpath:knowledge/*.md}") String location) {
        this.content = load(applicationContext, location);
    }

    private static String load(ApplicationContext applicationContext, String location) {
        try {
            Resource[] resources = applicationContext.getResources(location);
            Arrays.sort(resources, Comparator.comparing(Resource::getFilename,
                    Comparator.nullsLast(Comparator.naturalOrder())));

            StringBuilder sb = new StringBuilder();
            for (Resource resource : resources) {
                sb.append(StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8));
                sb.append("\n\n");
            }
            return sb.toString().strip();
        } catch (IOException e) {
            throw new UncheckedIOException("챗봇 지식 문서를 읽지 못했습니다: " + location, e);
        }
    }

    public String content() {
        return content;
    }
}
