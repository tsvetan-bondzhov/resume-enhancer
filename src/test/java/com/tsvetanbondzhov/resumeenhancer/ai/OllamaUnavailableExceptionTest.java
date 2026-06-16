package com.tsvetanbondzhov.resumeenhancer.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OllamaUnavailableExceptionTest {

    @Test
    void constructor_message_storesMessage() {
        OllamaUnavailableException ex = new OllamaUnavailableException("Ollama is unavailable");

        assertThat(ex.getMessage()).isEqualTo("Ollama is unavailable");
    }

    @Test
    void constructor_messageCause_storesMessageAndCause() {
        Throwable cause = new RuntimeException("Connection refused");
        OllamaUnavailableException ex = new OllamaUnavailableException("Ollama is unavailable", cause);

        assertThat(ex.getMessage()).isEqualTo("Ollama is unavailable");
        assertThat(ex.getCause()).isSameAs(cause);
    }

    @Test
    void isRuntimeException() {
        assertThat(new OllamaUnavailableException("msg"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void canBeThrownAndCaught_withCause() {
        Throwable cause = new IllegalStateException("root cause");
        assertThatThrownBy(() -> {
            throw new OllamaUnavailableException("unavailable", cause);
        })
                .isInstanceOf(OllamaUnavailableException.class)
                .hasMessage("unavailable")
                .hasCause(cause);
    }
}
