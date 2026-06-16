package com.tsvetanbondzhov.resumeenhancer.resume;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ResumeNotFoundExceptionTest {

    @Test
    void constructor_storesMessage() {
        ResumeNotFoundException ex = new ResumeNotFoundException("Resume 42 not found");

        assertThat(ex.getMessage()).isEqualTo("Resume 42 not found");
    }

    @Test
    void isRuntimeException() {
        assertThat(new ResumeNotFoundException("msg"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void canBeThrownAndCaught() {
        assertThatThrownBy(() -> {
            throw new ResumeNotFoundException("not found");
        })
                .isInstanceOf(ResumeNotFoundException.class)
                .hasMessage("not found");
    }
}
