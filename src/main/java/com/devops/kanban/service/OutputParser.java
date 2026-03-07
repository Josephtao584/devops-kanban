package com.devops.kanban.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Backward-compatible wrapper for OutputParser.
 *
 * @deprecated Use {@link com.devops.kanban.infrastructure.util.OutputParser} instead.
 */
@Service
@Deprecated
public class OutputParser {

    private final com.devops.kanban.infrastructure.util.OutputParser delegate;

    @Autowired
    public OutputParser(com.devops.kanban.infrastructure.util.OutputParser delegate) {
        this.delegate = delegate;
    }

    public String stripAnsiCodes(String input) {
        return delegate.stripAnsiCodes(input);
    }

    public String parseSessionId(String rawOutput) {
        return delegate.parseSessionId(rawOutput);
    }

    public String parseResult(String rawOutput) {
        return delegate.parseResult(rawOutput);
    }

    public boolean hasValidJson(String output) {
        return delegate.hasValidJson(output);
    }
}
