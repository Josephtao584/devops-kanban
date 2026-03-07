package com.devops.kanban.util;

/**
 * Backward-compatible alias for PlatformUtils.
 * All static methods delegate to the new infrastructure.util.PlatformUtils.
 *
 * @deprecated Use {@link com.devops.kanban.infrastructure.util.PlatformUtils} instead.
 */
@Deprecated
public final class PlatformUtils {

    private PlatformUtils() {
        // Prevent instantiation
    }

    public static boolean isWindows() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.isWindows();
    }

    public static boolean isUnix() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.isUnix();
    }

    public static String getHomeDirectory() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.getHomeDirectory();
    }

    public static String getCurrentUser() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.getCurrentUser();
    }

    public static String[] getShellPrefix() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.getShellPrefix();
    }

    public static String getCommandSeparator() {
        return com.devops.kanban.infrastructure.util.PlatformUtils.getCommandSeparator();
    }

    public static String buildCdCommand(String path) {
        return com.devops.kanban.infrastructure.util.PlatformUtils.buildCdCommand(path);
    }

    public static String escapeShell(String s) {
        return com.devops.kanban.infrastructure.util.PlatformUtils.escapeShell(s);
    }
}
