package com.tsvetanbondzhov.resumeenhancer.ai;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

import static org.assertj.core.api.Assertions.assertThat;

class OllamaHealthGuardTest {

    private OllamaHealthGuard guard;
    private HttpServer server;
    private int port;

    @BeforeEach
    void setUp() throws IOException {
        guard = new OllamaHealthGuard();
        // Start an in-process HTTP server on a random available port
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();
        server.start();
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void isAvailable_returns_true_when_server_responds_with_2xx() throws IOException {
        server.createContext("/", exchange -> {
            byte[] body = "Ollama is running".getBytes();
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        ReflectionTestUtils.setField(guard, "ollamaBaseUrl", "http://localhost:" + port);

        assertThat(guard.isAvailable()).isTrue();
    }

    @Test
    void isAvailable_returns_true_when_server_responds_with_status_below_500() throws IOException {
        server.createContext("/", exchange -> {
            byte[] body = "Not Found".getBytes();
            exchange.sendResponseHeaders(404, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        ReflectionTestUtils.setField(guard, "ollamaBaseUrl", "http://localhost:" + port);

        assertThat(guard.isAvailable()).isTrue();
    }

    @Test
    void isAvailable_returns_false_when_server_responds_with_status_500_or_above() throws IOException {
        server.createContext("/", exchange -> {
            byte[] body = "Internal Server Error".getBytes();
            exchange.sendResponseHeaders(500, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        ReflectionTestUtils.setField(guard, "ollamaBaseUrl", "http://localhost:" + port);

        assertThat(guard.isAvailable()).isFalse();
    }

    @Test
    void isAvailable_returns_false_when_no_server_is_running_on_target_url() {
        // Point to a port with nothing running — connection refused triggers the catch block
        ReflectionTestUtils.setField(guard, "ollamaBaseUrl", "http://localhost:1");

        assertThat(guard.isAvailable()).isFalse();
    }

    @Test
    void isAvailable_returns_false_for_invalid_url() {
        // An invalid URL causes URI.create to throw IllegalArgumentException,
        // caught by the generic Exception handler
        ReflectionTestUtils.setField(guard, "ollamaBaseUrl", "not a valid url %%");

        assertThat(guard.isAvailable()).isFalse();
    }
}
