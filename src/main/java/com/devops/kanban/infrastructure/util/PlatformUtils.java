package com.devops.kanban.infrastructure.util;

/**
 * Platform-specific utility methods for cross-platform support.
 * Handles differences between Windows and Unix-like systems.
 */
public final class PlatformUtils {

    private static final boolean IS_WINDOWS = System.getProperty("os.name").toLowerCase().contains("windows");

    private PlatformUtils() {
        // Prevent instantiation
    }

    /**
     * Check if the current OS is Windows.
     * @return true if running on Windows
     */
    public static boolean isWindows() {
        return IS_WINDOWS;
    }

    /**
     * Check if the current OS is Unix-like (Linux, macOS, etc.).
     * @return true if running on Unix-like system
     */
    public static boolean isUnix() {
        return !IS_WINDOWS;
    }

    /**
     * Get the home directory path for the current user.
     * @return user home directory path
     */
    public static String getHomeDirectory() {
        if (IS_WINDOWS) {
            String userProfile = System.getenv("USERPROFILE");
            if (userProfile != null) {
                return userProfile;
            }
            // Fallback to system property
            return System.getProperty("user.home");
        }
        String home = System.getenv("HOME");
        if (home != null) {
            return home;
        }
        return System.getProperty("user.home");
    }

    /**
     * Get the current username.
     * @return current username
     */
    public static String getCurrentUser() {
        if (IS_WINDOWS) {
            String username = System.getenv("USERNAME");
            if (username != null) {
                return username;
            }
        }
        String user = System.getenv("USER");
        if (user != null) {
            return user;
        }
        return System.getProperty("user.name");
    }

    /**
     * Get the shell command prefix for executing commands.
     * @return array of command prefix parts
     */
    public static String[] getShellPrefix() {
        if (IS_WINDOWS) {
            return new String[]{"cmd.exe", "/c"};
        }
        return new String[]{"bash", "-c"};
    }

    /**
     * Get shell-specific command separator.
     * @return command separator string
     */
    public static String getCommandSeparator() {
        return IS_WINDOWS ? "&" : "&&";
    }

    /**
     * Build a change-directory prefix command.
     * @param path the directory path to change to
     * @return the cd command string
     */
    public static String buildCdCommand(String path) {
        if (IS_WINDOWS) {
            return "cd /d \"" + path + "\"";
        }
        return "cd \"" + path + "\"";
    }

    /**
     * Escape a string for shell usage.
     * @param s the string to escape
     * @return the escaped string
     */
    public static String escapeShell(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }

        if (IS_WINDOWS) {
            // Windows cmd.exe escaping - escape double quotes
            return s.replace("\"", "\\\"");
        } else {
            // Unix bash escaping - escape double quotes, $, and backticks
            return s.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("$", "\\$")
                    .replace("`", "\\`");
        }
    }
}
