package com.tsvetanbondzhov.resumeenhancer.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class OllamaHealthGuard {

    private static final Logger log = LoggerFactory.getLogger(OllamaHealthGuard.class);

    @Value("${spring.ai.ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    /**
     * Returns true if Ollama is reachable. This is a synchronous HTTP probe.
     * Called once at the start of parsing — no caching (availability can change).
     * Never throws — returns false on any exception.
     */
    public boolean isAvailable() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaBaseUrl))
                    .GET()
                    .timeout(Duration.ofSeconds(3))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() < 500;
        } catch (Exception e) {
            log.warn("Ollama health check failed: {}", e.getMessage());
            return false;
        }
    }
}
