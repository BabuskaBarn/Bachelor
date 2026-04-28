// WorkoutStatsDto.java - Ein DTO für alles
package fhv.at.demo.Dtos;

import lombok.Data;
import java.util.List;

@Data
public class WorkoutStatsDto {
    // Session Vergleich
    private SessionComparison sessionComparison;

    // Gesamtstatistiken
    private OverallStats overallStats;

    // Persönliche Nachricht
    private String message;
    private String recommendation;

    @Data
    public static class SessionComparison {
        private Integer latestReps;
        private Integer previousReps;
        private Integer latestErrors;
        private Integer previousErrors;
        private String trend; // "BETTER", "WORSE", "SAME"
    }

    @Data
    public static class OverallStats {
        private Integer totalSessions;
        private Integer totalReps;
        private Double averageReps;
        private String bestWorkout;
        private String mostCommonMistake;
    }
}