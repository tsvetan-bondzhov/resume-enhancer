package com.tsvetanbondzhov.resumeenhancer.ai;

import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    /**
     * Shared in-memory chat memory store.
     * MessageWindowChatMemory is thread-safe and keyed by conversationId.
     * Window size of 20 messages prevents unbounded context growth.
     * Memory is ephemeral — no DB persistence; cleared on JVM restart (AC4).
     */
    @Bean
    public MessageWindowChatMemory messageChatMemory() {
        return MessageWindowChatMemory.builder()
                .maxMessages(20)
                .build();
    }
}
